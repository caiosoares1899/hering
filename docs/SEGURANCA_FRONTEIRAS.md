# 🔐 Segurança por fronteira de confiança — como achar (e como não inventar) vulnerabilidade no Oceano

> Método destilado do [`cloudflare/security-audit-skill`](https://github.com/cloudflare/security-audit-skill) (MIT, Cloudflare), adaptado ao Oceano: sem JSON, sem relatórios em arquivo, sem as fases pesadas. Fica ao lado da auditoria de 18/10 (`docs/AUDITORIA_SEGURANCA_2026-10-18.md`, o que já foi achado e fechado) e do `docs/GUIA_DE_CODIGO.md` (§6, revisão adversarial). Quem usa: `/auditoriaseguranca`, `/monitorarbugs` em área sensível, e **todo agente quando a mudança cria ou altera uma fronteira** (regra 8 do Release process do `CLAUDE.md`).

## 1. A regra de entrada: sem fronteira, não é achado

Um candidato só vira achado se você consegue escrever as quatro linhas:
1. **Quem** tem menos confiança (lista na §2) e o que ele controla.
2. **Que fronteira** o dado/ação cruza (ex.: texto anônimo do Intake → contexto do Agente Ágil).
3. **Qual controle** deveria barrar e não barra (regra do banco, `esc()`, checagem no handler…).
4. **Qual resultado observável** em outra pessoa ou recurso (leu o que não podia, gravou o que não podia, gastou o que não devia).

Não é achado: falta de "boa prática" sem caminho até um resultado; defesa em profundidade ausente quando outra camada já barra (vira nota de endurecimento); autoimpacto; o **modelo de confiança interno já aceito** (qualquer `@ciahering` grava em qualquer squad — riscos aceitos 2 e 3 da auditoria de 18/10). Escalada **além** desse modelo (virar ADM/PO, abrir acesso a quem é de fora) é achado.

## 2. Quem é quem (menor → maior confiança)

| Principal | Onde entra | O que NÃO pode |
|---|---|---|
| Anônimo | formulário público do Intake (`intakeSubmit`) | tudo que não seja deixar texto em `intake_pending` |
| Externo | `squads/{id}/externos`, `painel_viewers` | gravar no Painel/Radar; sair do squad liberado |
| Funcionário `@ciahering` (login Google) | todas as páginas | virar PO/ADM, mudar `role`, abrir acesso a externo |
| PO / Organizador / ADM | papéis em `usuarios/{uid}` | — |
| **Identidade de serviço** (Admin SDK das Cloud Functions) | `functions/` | **ignora as regras do banco** — por isso cada handler tem que rechecar quem pediu |
| **Modelo de linguagem** | Agente Ágil, `okrAgenteChat` | **nunca é fronteira**: prompt de guarda não conta |

## 3. Os quatro mapas do Oceano (percorra o que a mudança toca)

**A. Texto de fora → Agente Ágil / Radar (`functions/agente-agil-orquestrador/`, `functions/okr/agente*.js`, `functions/intake/`)**
- Prompt injection sozinho não é achado: precisa falha de código — conteúdo que chega ao contexto de outra pessoa, ação com autoridade que o solicitante não tem, ou dado que ele não podia ler.
- Descrição/comentário de card, anotação, Intake e resposta de ferramenta são **entrada não confiável**. A ferramenta (`tools/realHandlers.js`, `okr/agenteTools.js`) precisa **no código** conferir squad/card/solicitante (confused deputy: a credencial é de admin).
- Vínculo entre aprovação e ação: o agente só **propõe** (`agenda_propostas`); o handler que confirma tem que executar exatamente o objeto aprovado, não argumentos remontados.
- Gasto: o Intake anônimo e os loops do agente gastam cota paga — conferir teto por pedido/IP/squad (já existe limite por IP e squad; confirme que o caminho novo passa por ele).

**B. Squad como isolamento (regras, backup, restauração, exclusão)**
- Consulta e regra discordam: a página filtra por squad mas a regra deixa ler/gravar outro? (O modelo aceito é "grava em qualquer squad"; o que não pode é perder o filtro de **leitura sensível** ou o de papel.)
- Backup/restauração (`backup/completo.js`, `restaurarApi.js`, tela 🛟): quem pode pedir, de qual squad, e se a restauração amplia autoridade (devolve papel/acesso que já tinha sido revogado).
- Exclusão: `cards_deleted_intentionally` e o espelho do Guardião (`cards_espelho`) são cópias — exclusão de verdade tem que valer nelas também, ou a "lixeira" vira leitor alternativo.
- Nó novo no banco: regra por filho + backup (`NOS_GLOBAIS`) + o teste de regras que falha quando nasce nó sem regra.

**C. Guard na tela × regra no banco (`*-dev.html` × `database.rules.json`)**
- `_isPOorOrg()`, `isAdmUser()`, `_blockIfPainelViewer()`, `_okrCanEdit()` etc. são **conveniência**, não segurança. Todo guard que protege algo importante precisa de contrapartida na regra, testada no simulador (`functions/rules/rulesSim.js`, testes em `functions/rules/__tests__/`).
- Antes de afirmar "falta guard", ache a fronteira real: em 07/09 o modal de OKR sem `_blockIfPainelViewer()` estava protegido por `_okrCanEdit()` (falso positivo evitado).

**D. Dado do banco / URL → DOM (páginas, iframes, service worker, armazenamento)**
- Fonte controlável + sink que executa: campo do banco ou `?param` indo para `innerHTML`, atributo inline, `href`/`src`, `window.open`. Regra de ouro (Armadilha nº 13): texto → `esc()`; URL do banco → `_hrefOk()`; markdown → `_mdAttr()`. Teste: `docs/arezzo/testes/test_seguranca_xss.js`.
- `postMessage` e iframes (Oceano hospedando produtos, Escala `?embed=1`): origem conferida, `next=` por regex.
- Armazenamento do navegador sobrevive ao logout: cache de cards (IndexedDB) e `firebaseConfig` em `localStorage` — quem escreve, quem lê, quando limpa na troca de conta.
- **Sem CSP** (GitHub Pages não deixa definir cabeçalho): não assuma proteção que não existe, nem acuse a falta de uma que não dá para ter.

Outras fronteiras (checar só se a mudança tocar): HTTP (`onRequest`: autenticação declarada, comparação de segredo em tempo constante, HMAC em webhook, CORS só do site); gatilhos do banco são **at-least-once** (idempotência — `sendPushOnNotification`, `cardsGuardiao`); chaves de app (`OCEANO_RESUMO_KEY`) com escopo mínimo.

## 4. Três veredictos (e o que fazer com cada um)

| Veredicto | Quando | Saída |
|---|---|---|
| **confirmado** | trace completo no código + resultado observável (teste local com Firebase falso, `rulesSim.js` ou Playwright) | corrija no `-dev`/`functions/`, entrada em `BUGS_E_CORRECOES.md`, teste de regressão |
| **precisa_validar** | a hipótese depende de algo que o repositório não mostra: regra no Console (o arquivo é espelho manual), configuração do Google Cloud/Auth, cabeçalho do Pages | **sem severidade**; escreva o fato exato que falta e quem o vê (normalmente o Caio, no console) |
| **rejeitado** | outra camada barra, é modelo interno aceito ou autoimpacto | registre em uma linha com o motivo (evita reabrir o mesmo palpite) |

**Verificador que tenta refutar:** cada candidato passa por alguém de contexto limpo que só recebe o trecho e o contrato (sem a explicação de quem achou) e tenta provar que a fronteira já está protegida. Mesmo protocolo da revisão adversarial (`GUIA_DE_CODIGO.md` §6: CLAIM → EXTRACT → DOUBT → RECONCILE → STOP). Quem achou nunca é quem valida.

## 5. Severidade (só para `confirmado`)

- **crítica** — anônimo/externo executa código, lê/apaga o banco todo ou assume contas.
- **alta** — derrota um controle explícito com consequência real: virar ADM/PO, abrir acesso a externo, script armazenado rodando em outras pessoas, ler/gravar dado que a regra deveria proteger.
- **média** — violação real, mas de alcance pequeno ou com pré-condição incomum.
- **baixa** — vazamento de detalhe interno sem segredo, ou efeito que exige esforço contínuo para ganho mínimo.
- Se você não consegue dizer o dano concreto, a severidade é menor do que parece.

## 6. Regras de execução

- Código-fonte é lido; teste roda **local** (Firebase falso, `rulesSim.js`, Playwright em `localhost`). **Nunca** sondar produção, o Console, contas reais ou outras pessoas.
- Cada rodada diz o que cobriu e o que não cobriu — uma passada nunca esgota o alvo. Registre em `BUGS_E_CORRECOES.md` (rodada, área, veredictos).

## 7. Antipadrões

Apresentar desvio de checklist como vulnerabilidade · defesa em profundidade sem caminho até um resultado · tratar autoridade legítima do mesmo usuário como cruzamento de fronteira · adivinhar configuração do Google Cloud/Pages · severidade para `precisa_validar` · relatório antes da verificação independente · repetir como exemplo um achado antigo e deixar ele ancorar a caça.
