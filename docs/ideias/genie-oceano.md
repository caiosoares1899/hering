# 🐙 Polvo · Pergunte aos dados — nota de desenho (R3, 27/11/2026)

Integração de consulta em linguagem natural com o **Databricks AI/BI Genie** (espaço **"Polvo"**) diretamente de dentro do **Oceano** (`oceano-dev.html`), via Cloud Function dedicada (`oceanoGenie`), sem novo login para quem já está autenticado no Oceano e sem expor credenciais, hosts ou IDs do Databricks no navegador ou no repositório público.

> **Premissa do projeto (27/11/2026):** o espaço **Polvo** no Databricks já possui sua própria estrutura, regras de negócio, instruções e benchmarks configurados lá. O Oceano não configura nem recalcula nada do Genie: ele atua exclusivamente como ponte segura e **camada de exposição/visualização** — envia a pergunta do usuário e apresenta as análises, os **gráficos prontos**, as tabelas e o SQL devolvidos pelo Polvo em uma **vista ampla dedicada** dentro do Oceano.
>
> **Risco R3:** cria Cloud Function `onRequest` nova, integração externa via OAuth M2M, nó novo fechado no Realtime Database (`kanban/genie/**`) e texto/gráficos/tabelas gerados por LLM chegando ao DOM. Este documento registra o desenho **antes** da implementação (Fase 0).

---

## 1. Objetivo, Nome Visível e Decisão de Dica

- **Nome visível proposto:** **`🐙 Polvo · Pergunte aos dados`**
  - **Botão no menu lateral (`#rail`, só ADM):** ícone `🐙` + rótulo curto **`Polvo`** (`title="🐙 Polvo · Pergunte aos dados"`, `aria-label="Polvo · Pergunte aos dados"`).
  - **Cabeçalho da vista:** **`🐙 Polvo · Pergunte aos dados`** e subtítulo *"Pergunte em português sobre os dados — análises, gráficos, tabelas e SQL do Polvo sem sair do Oceano"*.
  - **Atalho no `🔍 Sonar` do Oceano (só ADM):** `🐙 Polvo · Pergunte aos dados` (abre a vista do Polvo).
  - **Por quê:** mantém o vocabulário marítimo da família (`docs/OCEANO.md` e `MARINE_GLASS.md`: Maré, Radar, Concha, Sonar, Ilha, Polvo), coincide com o nome do espaço no Genie ("Polvo") e explica a ação em português claro sem jargão de infraestrutura na tela.
- **Decisão de dica (`CLAUDE.md` §7):** **Dica: não no piloto.** Apenas ADMs têm acesso nesta fase; quando o acesso for ampliado para outros papéis, avaliamos incluir uma entrada no `CATALOGO` de `mare-dicas-dev.js`.

---

## 2. Arquitetura e Fluxo Ponta a Ponta

O navegador nunca fala diretamente com o Databricks nem conhece `DATABRICKS_HOST`, `GENIE_SPACE_ID` ou credenciais da conta de serviço.

```text
[oceano-dev.html · Vista ampla #polvo (ADM logado)]
   │  Authorization: Bearer <Firebase idToken>
   │  1) POST oceanoGenie { acao: 'perguntar', pergunta, conversa? }
   │  2) GET  oceanoGenie?acao=estado&conversa=...&mensagem=...            (a cada 3 s)
   │  3) GET  oceanoGenie?acao=grafico&conversa=...&mensagem=...&anexo=... (PNG pronto do Polvo)
   ▼
[Cloud Function `oceanoGenie` (us-central1, hering-onboarding)]
   ├─ Auth: verifyIdToken + contaDaEmpresa + ADM (role === 'adm' ou adm_emails)
   ├─ Cota (só no POST): .transaction() em kanban/genie/uso/{uid} e _casa
   ├─ Posse: kanban/genie/conversas/{uid}/{conversation_id} (msgs + anexos)
   ├─ Token OAuth M2M em memória: POST {DATABRICKS_HOST}/oidc/v1/token
   ▼
[Databricks Genie Conversation API (/api/2.0/genie/spaces/{GENIE_SPACE_ID})]
   ├─ POST /start-conversation                      (com enable_visualization: true)
   ├─ POST /conversations/{cid}/messages             (seguimento, enable_visualization: true)
   ├─ GET  /conversations/{cid}/messages/{mid}       (status + attachments: text, query, viz, suggested_questions)
   ├─ GET  /.../attachments/{aid}/query-result       (statement_response)
   ├─ POST /.../attachments/{aid}/execute-query      (quando QUERY_RESULT_EXPIRED)
   └─ GET  /.../attachments/{aid}/download-visualization (PNG pronto gerado pelo Polvo)
```

### Segredos no servidor (`defineSecret`)

Todos configurados exclusivamente no Google Secret Manager (nunca no código, testes, docs ou PR):
- `DATABRICKS_HOST` (nos testes: `https://exemplo.databricks.test`)
- `GENIE_SPACE_ID` (nos testes: `space_exemplo_001`)
- `DATABRICKS_CLIENT_ID`
- `DATABRICKS_CLIENT_SECRET`

### Autenticação OAuth M2M (`genieCore.js`)

- Endpoint: `POST {DATABRICKS_HOST}/oidc/v1/token`
- Cabeçalhos: `Authorization: Basic <base64(client_id:client_secret)>`, `Content-Type: application/x-www-form-urlencoded`, `Accept: application/json`
- Corpo: `grant_type=client_credentials&scope=all-apis`
- **Cache em memória da instância:** reutiliza `access_token` até `expires_in - 60 s` (com proteção contra rajada concorrente via promessa única em voo).
- **Renovação em `401`:** se qualquer chamada à Genie API devolver HTTP `401`, o cache é invalidado, um novo token é obtido 1 vez e a chamada é repetida automaticamente.

### Endpoints da Genie Conversation API (conferidos na documentação oficial)

Base: `{DATABRICKS_HOST}/api/2.0/genie/spaces/{GENIE_SPACE_ID}` (Conversation API estável; a *Agent Mode API* Beta em `/agents/{space_id}/responses` via SSE não é utilizada neste piloto):

1. `POST /start-conversation` com `{ content: pergunta, enable_visualization: true }` (fallback automático para `{ content: pergunta }` caso o workspace retorne `400` para o campo opcional):
   - Extrai `conversation_id` (`r.conversation_id || r.conversation?.id || r.message?.conversation_id`) e `message_id` (`r.message_id || r.message?.message_id || r.message?.id || r.id`), cobrindo as variações documentadas de payload.
2. `POST /conversations/{cid}/messages` com `{ content: pergunta, enable_visualization: true }` (com o mesmo fallback):
   - Pergunta de seguimento na mesma conversa (somente após validar que `cid` pertence ao `uid`).
3. `GET /conversations/{cid}/messages/{mid}`:
   - Status possíveis: `SUBMITTED`, `FILTERING_CONTEXT`, `ASKING_AI`, `PENDING_WAREHOUSE`, `EXECUTING_QUERY`, `COMPLETED`, `FAILED`, `CANCELLED`, `QUERY_RESULT_EXPIRED`.
   - Lê `attachments[]`: `attachment_id || id`, `text.content`, `query.query`, `query.description`, `viz` (descrição/metadado de visualização pronta) e `suggested_questions.questions`.
4. `GET /conversations/{cid}/messages/{mid}/attachments/{aid}/query-result`:
   - Lê `statement_response` (`status.state`, `manifest.schema.columns`, `manifest.total_row_count`, `manifest.truncated`, `result.data_array`, `result.next_chunk_index`).
5. `POST /conversations/{cid}/messages/{mid}/attachments/{aid}/execute-query`:
   - Acionado automaticamente quando a mensagem retorna `status === 'QUERY_RESULT_EXPIRED'` (ou quando `query-result` indica resultado expirado/`CLOSED`). Se a resposta já trouxer `statement_response.status.state === 'SUCCEEDED'`, devolve `COMPLETED` com os dados; se vier `PENDING` ou `RUNNING`, devolve `EXECUTING_QUERY` para o próximo ciclo de consulta concluir.
6. `GET /conversations/{cid}/messages/{mid}/attachments/{aid}/download-visualization`:
   - Baixa o PNG pronto do gráfico gerado pelo Polvo para aquele `attachment_id` (apenas quando a mensagem já está `COMPLETED` e o `aid` está registrado como anexo válido da conversa/mensagem do usuário).

**Observação sobre vazão:** apenas chamadas `POST` contam nos limites do Genie; chamadas `GET` (`estado` e `grafico`) não contam. Resposta `429` do Genie dispara backoff exponencial curto (até 2 retentativas com jitter, respeitando `Retry-After` limitado) e, persistindo, devolve erro `429 { erro: 'genie_ocupado' }`. Nenhuma constante fixa de RPM do Genie é assumida no código.

---

## 3. Contrato da API da Cloud Function (`oceanoGenie`)

Molde obrigatório idêntico a `functions/oceano/conchaGif.js` + `conchaGifCore.js`:
- `onRequest({ region: 'us-central1', cors: 'https://caiosoares1899.github.io', secrets: [...], timeoutSeconds: 30, maxInstances: 3 })`
- Cabeçalho `// AUTH:` explícito no topo do arquivo (exigido pelo `scripts/checar.js`).
- Dependências injetáveis em `_tratar(req, res, deps)` (`{ auth, db, fetch, secrets, agora }`) e núcleo puro sem Firebase em `functions/oceano/genieCore.js`.
- Autorização em toda chamada (`POST` e `GET`):
  1. `Authorization: Bearer <idToken>` → `auth.verifyIdToken` (`401 sem_token` / `401 token_invalido`).
  2. `contaDaEmpresa(decoded)` + `UID_RE` (`403 conta`).
  3. Critério de ADM reutilizado do projeto (`kanban/usuarios/{uid}/role === 'adm'` ou e-mail verificado em `kanban/config/adm_emails`, com fallback `DEFAULT_ADM_EMAILS` de `functions/common/admsDestino.js`) → fora do piloto: `403 { erro: 'sem_acesso' }`.

### Ação `perguntar` — `POST /oceanoGenie`

- **Corpo JSON:** `{ acao?: 'perguntar', pergunta: string, conversa?: string }`
  - `pergunta`: obrigatória, string de 2 a 1000 caracteres após `trim()`, sem caracteres de controle (`\u0000–\u0008`, `\u000B`, `\u000C`, `\u000E–\u001F`, `\u007F`) nem invisíveis/zero-width/bidi (`\u200B–\u200F`, `\u202A–\u202E`, `\u2060–\u206F`, `\uFEFF`).
  - `conversa` (opcional): id da conversa existente para pergunta de seguimento. Se informado, deve existir em `kanban/genie/conversas/{uid}/{conversa}`; caso contrário, `403 { erro: 'conversa_alheia' }`.
- **Cota (via `.transaction()` antes de chamar o Genie):**
  - `kanban/genie/uso/{uid}`: máx. `LIMITE_PESSOA_H = 30` perguntas/hora → `429 { erro: 'limite_pessoa' }`.
  - `kanban/genie/uso/_casa`: máx. `TETO_CASA_H = 200` perguntas/hora → `429 { erro: 'limite_casa' }`.
- **Resposta `200`:**
  ```json
  {
    "conversa": "<conversation_id>",
    "mensagem": "<message_id>",
    "status": "SUBMITTED"
  }
  ```

### Ação `estado` — `GET /oceanoGenie?acao=estado&conversa=<cid>&mensagem=<mid>`

- Chamada pela página a cada **3 s** até status final ou timeout de **10 min** no cliente (que exibe estado `'demorou'`). **Não** consome cota.
- Valida `conferirPosse` contra `kanban/genie/conversas/{uid}/{cid}`: `cid` precisa ser do `uid` e `mid` precisa estar registrado em `msgs[mid] === true`. Qualquer divergência retorna `403 { erro: 'conversa_alheia' }`.
- Ao receber `attachments[]` do Genie para aquela mensagem, grava os `attachment_id`s (tanto de `query` quanto de `viz`) em `kanban/genie/conversas/{uid}/{cid}/anexos/{aid} = mid`.
- **Respostas `200`:**
  - **Em andamento:** `{ conversa, mensagem, status }` (`SUBMITTED`, `FILTERING_CONTEXT`, `ASKING_AI`, `PENDING_WAREHOUSE`, `EXECUTING_QUERY`).
  - **Concluída (`COMPLETED`):**
    ```json
    {
      "conversa": "<cid>",
      "mensagem": "<mid>",
      "status": "COMPLETED",
      "texto": "Análise textual do Polvo (ou vazio)",
      "sql": "SELECT ... (ou null)",
      "descricao": "Descrição da consulta gerada (ou null)",
      "colunas": [{ "nome": "coluna", "tipo": "STRING" }],
      "linhas": [["valor1", "valor2"]],
      "cortado": false,
      "totalLinhas": 12,
      "graficos": [{ "anexo": "<attachment_id>", "descricao": "Título/descrição do gráfico" }],
      "sugestoes": ["Pergunta sugerida 1"]
    }
    ```
    - `linhas` é limitado a no máximo **`MAX_LINHAS = 200`**.
    - `cortado` é `true` quando `data_array.length > 200`, `manifest.total_row_count > 200`, `manifest.truncated === true` ou `result.next_chunk_index != null`.
  - **Encerrada com falha/cancelamento (`FAILED` / `CANCELLED`):** `{ conversa, mensagem, status }` (sem vazar detalhes internos do workspace).

### Ação `grafico` — `GET /oceanoGenie?acao=grafico&conversa=<cid>&mensagem=<mid>&anexo=<aid>`

- Busca e transmite o PNG pronto gerado pelo Polvo para um anexo `viz`. **Não** consome cota.
- Reconfere autenticação (`idToken`, `contaDaEmpresa`, ADM) + posse estrita (`cid` da pessoa, `mid` em `msgs`, e `anexos[aid] === mid` — senão `403 { erro: 'conversa_alheia' }`).
- Chama `GET .../conversations/{cid}/messages/{mid}/attachments/{aid}/download-visualization` com o token M2M.
- Valida antes de repassar ao navegador:
  - Resposta `200` com payload não vazio até **`MAX_GRAFICO_BYTES = 8 MB`**;
  - **Assinatura mágica PNG obrigatória** (`89 50 4E 47 0D 0A 1A 0A`) — nunca repassa HTML, SVG ou JSON inesperado como imagem.
- Devolve HTTP `200` binário com `Content-Type: image/png`, `X-Content-Type-Options: nosniff` e `Cache-Control: private, max-age=300`.

### Tabela completa de erros (`{ erro: '<codigo>' }`)

| HTTP | Código `erro` | Quando ocorre |
|---|---|---|
| `400` | `pergunta_invalida` / `entrada` | Pergunta fora de 2–1000 chars, com caractere proibido, ou parâmetros inválidos |
| `401` | `sem_token` / `token_invalido` | Cabeçalho `Authorization: Bearer` ausente ou `idToken` inválido |
| `403` | `conta` | Conta fora de `@ciahering.com.br` / sem Google verificado |
| `403` | `sem_acesso` | Conta Hering válida, porém fora do grupo ADM do piloto |
| `403` | `conversa_alheia` | `conversation_id`, `message_id` ou `attachment_id` não pertence à conversa da pessoa |
| `405` | `metodo` | Método HTTP diferente de `POST` (`perguntar`) ou `GET` (`estado` / `grafico`) |
| `429` | `limite_pessoa` / `limite_casa` | Cota por hora excedida (`30/h` pessoa ou `200/h` casa) |
| `429` | `genie_ocupado` | Genie respondeu `429` mesmo após backoff exponencial curto |
| `500` | `config_ausente` / `interno` | Segredo ausente/inválido ou falha interna não esperada |
| `502` | `genie_auth` / `genie_tempo` / `genie_falhou` / `genie_resposta` | Falha no OAuth M2M, timeout HTTP, PNG inválido ou erro/payload inválido do Databricks |

---

## 4. Isolamento no Banco, Regras e Backup

Como todas as chamadas usam a mesma conta de serviço no Databricks, **todas as conversas no espaço pertencem à mesma identidade técnica lá**. O isolamento por pessoa é garantido no Firebase pelo servidor:

- `kanban/genie/conversas/{uid}/{conversation_id}`:
  - `ts`: ISO timestamp da criação/última atualização
  - `ultima_msg`: último `message_id` criado na conversa
  - `msgs/{message_id}: true`: todo `message_id` devolvido pelo Genie para aquela conversa
  - `anexos/{attachment_id}: message_id`: todo `attachment_id` (de query ou de gráfico) devolvido pelo Genie para aquela mensagem
- `kanban/genie/uso/{uid}` e `kanban/genie/uso/_casa`: `{ h: 'AAAAMMDDHH', n: number }`.
- **Regra em `database.rules.json`:**
  ```json
  "genie": {
    ".read": false,
    ".write": false
  }
  ```
  Testada em `functions/rules/__tests__/genieRules.test.js` via `rulesSim.js`: nem a dona, nem outro usuário, nem PO, nem ADM, nem o e-mail do Caio conseguem ler ou gravar em `kanban/genie/**` pelo cliente (apenas o Admin SDK da Cloud Function).
- **Backup (`functions/backup/completo.js`):** acrescentar `'genie'` em `EXCLUIDOS` (não entra no backup, pois guarda apenas metadados efêmeros de controle de posse e cota por hora — nenhuma pergunta, SQL, gráfico ou resultado é armazenado no Firebase).

---

## 5. Política de Logs

- Toda linha de log emitida por `oceanoGenie` registra **apenas**: `acao`, `uid`, `codigo` (de erro ou status) e `ms` (duração).
- **Nunca** registra a pergunta, a resposta textual, a tabela, o SQL, o `access_token`, o `idToken`, o `GENIE_SPACE_ID` nem a URL do `DATABRICKS_HOST` (inclusive em erros lançados pelo `fetch`, que são substituídos por `ErroGenie` com código fixo — verificado por teste automatizado que espiona `console.log`/`console.warn`/`console.error`).

---

## 6. Tela no `oceano-dev.html` (Vista Ampla de Exposição, Marine Glass, 1280 px e 390 px, 3 Temas)

Como o Polvo já entrega análises, **gráficos prontos**, tabelas e SQL, a interface no Oceano é uma **vista ampla dedicada de exposição** ao lado do menu lateral (`#rail`), dando leitura confortável para gráficos e tabelas largas em vez de espremê-los numa gaveta estreita:

- **Entrada:**
  - Item no menu lateral (`#rail`, `data-rail="polvo"`): ícone `🐙` + `Polvo`, visível **somente quando `ehAdm === true`** (ao lado de Painel). No celular (`≤ 899 px`), acomoda-se na barra inferior mantendo alvos de toque ≥ 44 px e zero rolagem horizontal.
  - Entrada equivalente no `🔍 Sonar` do Oceano (só ADM).
  - Estado aberto lembrado em `localStorage.oceano_polvo_aberto` (`'1'`/`'0'`). Nenhum dado de conversa ou resultado fica no `localStorage`.
- **Área de exposição (`#polvo`):**
  - No desktop (`1280 px`): ocupa a área inteira à direita do `#rail` (`left: var(--rail-w); right: 0; top: 0; bottom: 0`), com coluna central de leitura e visualização até **`980 px`** de largura.
  - No celular (`390 px`): ocupa a tela inteira acima da barra inferior (`bottom: calc(62px + env(safe-area-inset-bottom))`), sem rolagem lateral na página.
  - Alternar entre `Polvo`, `Início` ou um app do `#rail` não apaga a conversa em memória durante a sessão; `Esc` fecha a vista do Polvo de volta ao lobby/app.
- **Composição de cada resposta do Polvo (ordem de leitura):**
  1. **Análise textual do Polvo:** parágrafos e linhas com `white-space: pre-wrap` montados por `createElement` + `textContent`.
  2. **📊 Gráfico pronto do Polvo** (quando `graficos.length > 0`): cartão Marine Glass com a descrição (por `textContent`), imagem PNG carregada via `fetch` autenticado → `Blob('image/png')` → `URL.createObjectURL` em `<img>` (com revogação automática de `blob:` ao limpar/iniciar nova conversa), botão **⛶ Ampliar** (modal de visualização) e **⬇ Baixar PNG**; em caso de falha ao baixar a imagem, mostra aviso inline sem quebrar o restante da resposta.
  3. **📋 Tabela de resultado** (quando `colunas.length > 0`): tabela ampla em wrapper rolável (`overflow: auto; max-height: 360px`) com cabeçalho fixo (`sticky`), números alinhados com `font-variant-numeric: tabular-nums`, contagem de linhas e aviso `⚠️ Mostrando as primeiras 200 linhas` quando `cortado: true`.
  4. **🧾 Ver SQL gerado** (quando `sql`): bloco `<details>` recolhido por padrão, com descrição opcional e botão `📋 Copiar SQL` (`✓ Copiado`).
  5. **Chips de sugestões de seguimento** (quando `sugestoes.length > 0`): cliques enviam a pergunta na mesma conversa.
- **Estados obrigatórios (`docs/GUIA_UI_UX.md` §5.2):**
  - **Vazio:** explicação curta do que é o Polvo + chips neutros de exemplo para começar.
  - **Pensando… (polling 3 s até 10 min):** traduz os estados (`Enviando pergunta…` → `Entendendo a pergunta…` → `Montando a consulta…` → `Ligando o motor de dados…` → `Consultando os dados…`).
  - **Demorou (> 10 min):** avisa claramente que passou do tempo e orienta a tentar de novo ou reformular.
  - **Erro:** mensagem inline clara por código (`sem_acesso`, `limite_pessoa`, `genie_ocupado`, falha de rede) sem expor código técnico cru nem perder o texto digitado.
- **Botão `+ Nova conversa`:** limpa o thread na tela, revoga `blob:` URLs abertas e inicia uma nova `conversation_id` na próxima pergunta (seguindo a orientação da Databricks).
- **Temas e Acessibilidade:** usa exclusivamente tokens `var(--…)` em 🌙 Abrolhos, ☀️ Lençóis Maranhenses e 🌅 Entardecer; respeita `@media (prefers-reduced-motion: reduce)` (sem pulso contínuo); foco visível `:focus-visible`; `textarea` de `16 px` no toque (`Enter` envia, `Shift+Enter` quebra linha).
- **Segurança no DOM (Fronteira D):** **todo** texto vindo do Genie (`texto`, `sql`, `descricao`, `graficos[].descricao`, `sugestoes`, nomes de coluna e células da tabela) entra exclusivamente via `document.createElement` + `el.textContent` — zero `innerHTML`, zero `href`, zero renderizador de markdown.

### Wireframe Desktop (`1280 × 900` — Vista Ampla ao lado do `#rail`)

```text
+------+-----------------------------------------------------------------------------------------------+
| #rail|  🐙 Polvo · Pergunte aos dados                                        [+ Nova conversa]  [✕]  |
|      |  Análises, gráficos, tabelas e SQL do Polvo sem sair do Oceano · só ADM                       |
| [≡]  +-----------------------------------------------------------------------------------------------+
| 🏠   |                                                                                               |
|      |  ┌─ Container central (até 980 px) ─────────────────────────────────────────────────────────┐ |
| 🐟   |  │                                                                                          │ |
| 🐚   |  │                                         ┌──────────────────────────────────────────────┐ │ |
| 📡   |  │                                         │ Como evoluíram os pedidos nos últimos meses? │ │ |
| 🧭   |  │                                         └──────────────────────────────────────────────┘ │ |
| 🐙*  |  │                                                                                          │ |
|      |  │  ┌────────────────────────────────────────────────────────────────────────────────────┐  │ |
| 🔍   |  │  │ 🐙 Análise do Polvo                                                                │  │ |
|      |  │  │ Texto da análise resumindo o comportamento observado no período…                   │  │ |
| (👤) |  │  │                                                                                    │  │ |
|      |  │  │ ┌─ 📊 Gráfico pronto do Polvo ──────────────────────── [⛶ Ampliar] [⬇ Baixar PNG] ┐│  │ |
|      |  │  │ │  [            Imagem PNG renderizada pelo Genie (blob:)                     ]   ││  │ |
|      |  │  │ └─────────────────────────────────────────────────────────────────────────────────┘│  │ |
|      |  │  │                                                                                    │  │ |
|      |  │  │ ┌─ 📋 Resultado (12 linhas) ──────────────────────────────────────────────────────┐│  │ |
|      |  │  │ │ Mês        │ Pedidos      │ Ticket médio │ Participação                         ││  │ |
|      |  │  │ ├────────────┼──────────────┼──────────────┼──────────────────────────────────────┤│  │ |
|      |  │  │ │ Outubro    │        1.240 │       289,10 │                                34,2% ││  │ |
|      |  │  │ └────────────┴──────────────┴──────────────┴──────────────────────────────────────┘│  │ |
|      |  │  │                                                                                    │  │ |
|      |  │  │ ▸ 🧾 Ver SQL gerado  [📋 Copiar SQL]                                               │  │ |
|      |  │  │ [Comparar com o ano anterior]  [Detalhar por canal]                                │  │ |
|      |  │  └────────────────────────────────────────────────────────────────────────────────────┘  │ |
|      |  └──────────────────────────────────────────────────────────────────────────────────────────┘ |
|      +-----------------------------------------------------------------------------------------------+
|      |  [ Pergunte aos dados em português… (Enter envia · Shift+Enter quebra)           ]  [Enviar]  |
+------+-----------------------------------------------------------------------------------------------+
```

### Wireframe Celular (`390 × 800`)

```text
+--------------------------------------+
| 🐙 Polvo · Pergunte aos dados        |
| [+ Nova]                       [✕]   |
+--------------------------------------+
|       ┌────────────────────────────┐ |
|       │ Evolução por canal no mês  │ |
|       └────────────────────────────┘ |
| ┌──────────────────────────────────┐ |
| │ 🐙 Análise textual do Polvo…     │ |
| │ ┌─ 📊 Gráfico ──── [⛶] [⬇] ────┐ │ |
| │ │  [ PNG pronto do Polvo ]     │ │ |
| │ └──────────────────────────────┘ │ |
| │ ┌──────────────┬───────────┐ ◄─► │ |  <- scroll horizontal só dentro
| │ │ Canal        │ Pedidos   │     │ |     do wrapper da tabela (zero
| │ ├──────────────┼───────────┤     │ |     overflow na página)
| │ │ Site         │     1.240 │     │ |
| │ └──────────────┴───────────┘     │ |
| │ ▸ 🧾 Ver SQL gerado  [📋 Copiar] │ |
| │ [Detalhar por semana]            │ |
| └──────────────────────────────────┘ |
+--------------------------------------+
| [Pergunte aos dados… (16px) ] [Env.] |
+--------------------------------------+
| [🏠] [🐟] [🐚] [📡] [🧭] [🐙] [👤]  |
+--------------------------------------+
```

---

## 7. Fronteiras (`docs/SEGURANCA_FRONTEIRAS.md`), Fora do Piloto e Deploy

### Fronteiras mapeadas

1. **Função HTTP `onRequest` nova (`oceanoGenie`):** declarada com `// AUTH:`, CORS restrito a `https://caiosoares1899.github.io`, `verifyIdToken` + `contaDaEmpresa` + checagem explícita de ADM no servidor (guard de UI é apenas conveniência).
2. **Identidade compartilhada no Databricks (Service Principal):** `conversation_id`, `message_id` e `attachment_id` vinculados ao `uid` em `kanban/genie/conversas/{uid}/{cid}` e conferidos em toda leitura (`estado`, `grafico`) e seguimento (`403 conversa_alheia`); `space_id` fixo no Secret Manager.
3. **Proxy de visualização (`acao=grafico`):** só baixa anexo `viz` pertencente à conversa da pessoa, valida magic bytes PNG (`89 50 4E 47 0D 0A 1A 0A`) e tamanho máximo (`8 MB`), responde com `Content-Type: image/png` + `X-Content-Type-Options: nosniff` e nunca repassa HTML/SVG nem expõe URL do workspace.
4. **Gasto / abuso de cota:** transação atômica em `kanban/genie/uso/{uid}` (`30/h`) e `_casa` (`200/h`) apenas no `POST`, antes de chamar o Genie.
5. **Nó novo no banco (`kanban/genie`):** `.read: false`, `.write: false` para todo cliente (testado no `rulesSim.js`).
6. **Saída de LLM / dados externos chegando ao DOM:** inserção 100% por `textContent`/`createElement`, testada com payload XSS (`<img src=x onerror=alert(1)>`) em resposta, coluna e célula.

### O que fica fora do piloto

- Acesso para usuários não-ADM (POs, Organizadores, membros ou externos).
- Persistência do histórico de mensagens do Polvo no Firebase ou `localStorage` após recarregar a página (o `kanban/genie/conversas` guarda apenas IDs/posse).
- Busca em documentos/volumes via *Agent Mode API*.
- Exportação CSV ou paginação de chunks além do teto de 200 linhas.
- Promoção para `oceano.html` (produção).

### Ordem de deploy (quando as Fases 1 e 2 forem entregues — apenas pelo Caio)

1. `firebase deploy --only database --project hering-onboarding` (antes do merge, a partir da branch `antigravity/oceano-genie`)
2. `firebase functions:secrets:set DATABRICKS_HOST` / `GENIE_SPACE_ID` / `DATABRICKS_CLIENT_ID` / `DATABRICKS_CLIENT_SECRET`
3. `firebase deploy --only functions:oceanoGenie --project hering-onboarding`
