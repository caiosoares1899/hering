# 🛡️ Auditoria de Segurança — 🐚 Concha (26/11/2026)

> **Método:** [`docs/SEGURANCA_FRONTEIRAS.md`](SEGURANCA_FRONTEIRAS.md) + `.claude/skills/auditoriaseguranca/SKILL.md` (por fronteira de confiança, com verificação independente de refutação).
> **Escopo (3 itens R3 da Fila do Antigravity):**
> 1. **⏩ Encaminhar** (`msgs/{canal}/{msgId}/enc`, `cardume-dev.html`, `conchaAvisos.js`, `cardumePush.js`)
> 2. **Regras novas de 25/11** — 🔔 Avisos (#1969: `avisos`, `seguidas`, `vendo`, `aviso_env`, `avisos_a`, `conchaAvisos.js`), 📁 Seções (#1970: `secoes`) e 🧵 Assuntos (`assuntos`, `ultima_a`, `lidas_a`, `msgs/.../a`)
> 3. **📌 Fixar** (`fixadas/{canal}/{msgId}`, tipos `topo`/`regra`, `cardume-dev.html`)
>
> **Base:** `origin/main` @ `af789c2c` (já contendo a revisão cruzada do Codex, PR #2001). Nenhum achado já corrigido ou adiado com motivo no #2001 foi repetido.
> **Cobertura parcial:** uma passada focada nesses 3 itens não esgota toda a Concha nem o restante do banco.

---

## Tabela de Achados (ordem de severidade)

| ID | Severidade | Veredicto | Item da Fila | Local | Resumo | Status |
|---|---|---|---|---|---|---|
| **A1** | **média** | `confirmado` | (2) 🔔 Avisos (`seguidas`) | `functions/oceano/conchaAvisos.js` L61 | `#constructor` / `#__proto__` casam com `Object.prototype` em `seguidas[t]`, furando `🔕 silenciar` (canal e assunto) e a trava de rajada (`INTERVALO_MS`) para todos os membros | **Corrigido** neste PR (aguarda deploy de `conchaAvisoMsg`) |
| **A2** | **média** | `confirmado` | (2) 🔔 Avisos / `#tags` | `cardume-dev.html` L2150, L2156-2157, L2126, L2201 | `#constructor` gravado em `tags_ult/{canal}/constructor` (aceito pelas regras) derruba `carregarTagsUlt()` com `TypeError` (DoS persistente de `#tags` no Sonar/autocomplete para todo o canal; só ADM limpa) e faz `botaoSeguir` mostrar "Seguindo" sem seguir | **Corrigido** neste PR (`cardume-dev.html` v0.45) |
| **A3** | **baixa** | `confirmado` | (3) 📌 Fixar (`regra`) | `cardume-dev.html` L1144 | `chaveRegras` grava `concha_regras_<canal>` no `localStorage` sem `user.uid`, expondo id/slug de canais privados em aparelho compartilhado e dispensando o aviso de regras para a conta seguinte | **Corrigido** neste PR (`cardume-dev.html` v0.45) |

---

## Veredicto por Item da Fila

### Item (1) — ⏩ Encaminhar (conteúdo de canal privado → outro canal por decisão de um membro)
- **Veredicto geral:** **Sem vulnerabilidade confirmada.**
- **Controles verificados:**
  - `database.rules.json` L1156-1176 (`msgs/$canal/$msgId/enc`): exige `root.child('kanban/cardume/membros/' + c + '/' + auth.uid).val() === true` (nem ADM fora da origem encaminha; sem oráculo de existência para não membro), confere integridade exata de `texto`, `gif/{u,t,s,w,h}`, `de`, `ts` e `n` (nome atual da origem), barra `apagada === true`, barra re-encaminhar (`!hasChild('enc')`), barra `resp`/`a`/`card`/`cardSq` e recusa `c === $canal`. Edição bloqueada por `!data.hasChild('enc')` (L1104) e criação de `enc` na edição bloqueada por `!data.parent().exists()` (L1157).
  - `cardume-dev.html` L1310, L1952-2005: `cOrig.nome`, `enc.n` e texto entram apenas por `textContent`/`createTextNode`; o modal analisa diferença de membros (`membros/{dest}` vs `membrosOrig`) e avisa antes quando mais gente ou canal aberto vai ver.
  - `functions/oceano/conchaAvisos.js` L73, L91, L99: canal privado (`convite`) no destino continua escondendo o nome do canal no push (`"num canal privado"`), e o push nunca leva trecho do texto.

### Item (2) — Regras novas de 25/11 (🔔 Avisos, 📁 Seções, 🧵 Assuntos)
- **Veredicto geral:** **2 achados confirmados (A1 e A2, severidade `média`), ambos corrigidos.**
- **Controles verificados nas regras (`database.rules.json`):**
  - `avisos` (L1300-1317), `seguidas` (L1318-1326), `vendo` (L1327-1335), `avisos_a` (L1432-1451), `secoes` (L1340-1372), `lidas_a` (L1421-1431): estritamente privados (`auth.uid === $uid` + `@ciahering.com.br` + Google), sem referência a nós de terceiros (sem oráculo) e com `$outro: false`.
  - `aviso_env` (L1336-1339): `.read: false, .write: false` (exclusivo do Admin SDK com `.transaction()`).
  - `assuntos` (L1373-1399) e `ultima_a` (L1400-1420) e `msgs/.../a` (L1153-1155): leitura restrita a membro/ADM; `por` e `criado` imutáveis; assunto encerrado (`fim`) barra nova mensagem, edição e reação; `ultima_a` confere correspondência exata com `msgs/$canal/$id` e assunto no estado final (`newData`).

### Item (3) — 📌 Fixar (`fixadas/{canal}/{msgId}`, tipos `topo`/`regra`)
- **Veredicto geral:** **1 achado confirmado (A3, severidade `baixa`), corrigido; regras do banco sem vulnerabilidade confirmada.**
- **Controles verificados:**
  - `database.rules.json` L1452-1472 (`fixadas`): leitura restrita a membro/ADM; criar e trocar tipo exigem `(membro || ADM) && GESTOR && !vencido` e mensagem viva antes (`root`) e depois (`newData`); `por` e `em` imutáveis após criação; `t` restrito a `^(topo|regra)$`; desafixar por membro comum restrito a fixadas órfãs (mensagem apagada/inexistente no estado final).
  - `cardume-dev.html` L1065-1231: texto da fixada vem da própria mensagem (nada duplicado no nó `fixadas`) e entra via `textContent` / `renderTexto` (sem `innerHTML`).

---

## Detalhamento dos Achados Confirmados

### A1 — Bypass de `🔕 silenciar` (canal e assunto) e da trava de push (`INTERVALO_MS`) via `#constructor` / `#__proto__`
- **Local:** `functions/oceano/conchaAvisos.js` L32-37 (`tagsEm`) e L61 (`decidir`)
- **Severidade:** `média` · **Veredicto:** `confirmado` (sobreviveu à verificação independente de refutação)
- **Fronteira:** texto livre enviado por um membro → Admin SDK (`conchaAvisoMsg`) → preferência privada de silenciamento (`avisos`/`avisos_a`) e rate-limit (`aviso_env`) de todos os demais membros do canal.
- **Cenário concreto:**
  1. Um membro do canal envia uma mensagem contendo `#constructor` ou `#__proto__`.
  2. `tagsEm()` (L32-37) aceita ambas (2–32 caracteres em `[\p{L}\p{N}_-]`, tudo minúsculo, contém letra).
  3. Em `runAvisoMsg()` (L115), para qualquer destinatário que não segue nenhuma tag, `seguidas` é `{}` (herda `Object.prototype`).
  4. Em `decidir()` (L61), `seguidas[t] != null` avalia `({}).constructor != null` (`true`) e `({}).__proto__ != null` (`true`).
  5. **Resultado errado:** `decidir()` retorna `{ envia: true, motivo: 'tag', tags: ['constructor'] }`, **furando `🔕 mencoes` do canal e do assunto** (L62-63) e **pulando a trava de rajada de 2 min** (L67 e L123), permitindo flood ilimitado de push FCM a todos os membros (exceto quem está em `🚫 nada`, `vendo` ou `dnd`).
- **Correção aplicada:** `Object.prototype.hasOwnProperty.call(seguidas, t) && typeof seguidas[t] === 'number'` em `functions/oceano/conchaAvisos.js` L61.
- **Prova:** teste `'segurança (26/11): #constructor e #__proto__ com seguidas vazio NÃO furam 🔕 silenciar nem a trava de rajada'` em `functions/oceano/__tests__/conchaAvisos.test.js` (falhou antes com `AssertionError: canal silenciado + #constructor (true !== false)` e passou depois).

### A2 — DoS persistente na lista de `#tags` (Sonar e autocompletar `#`) via `#constructor` em `tags_ult`
- **Local:** `cardume-dev.html` L2150, L2156-2157 (`carregarTagsUlt`), L2126 (`botaoSeguir`), L2201 (`deRecente`) + `database.rules.json` L1291-1299 (`tags_ult`)
- **Severidade:** `média` · **Veredicto:** `confirmado` (sobreviveu à verificação independente de refutação)
- **Fronteira:** texto de um membro → `tags_ult/{canal}/constructor` no banco (aceito pelas regras, pois `constructor` é minúscula, sem espaço, ≤ 32 chars) → `carregarTagsUlt()` no navegador de todos os membros do canal.
- **Cenário concreto:**
  1. Qualquer membro envia uma mensagem contendo `#constructor`, gravando `tags_ult/{canal}/constructor = ts`.
  2. Quando qualquer membro abre o Sonar ou digita `#`, `carregarTagsUlt()` inicializa `const m = {}` e executa `const x = m['constructor'] = m['constructor'] || { ult: 0, canais: [] }; x.canais.push(c)`.
  3. Como `m['constructor']` resolve para `Function Object` (truthy), `x.canais` é `undefined` e lança `TypeError: Cannot read properties of undefined (reading 'push')`.
  4. **Resultado errado:** o `.catch` zera `tagsUltEm = 0` sem atualizar `tagsUlt`, deixando o Sonar e o autocompletar `#` **sem nenhuma `#tag`** para todos os membros do canal (além de repetir leituras de `tags_ult` a cada abertura). Como `database.rules.json` L1295 só permite a **ADM** apagar `tags_ult`, o DoS persiste mesmo após apagar a mensagem. Adicionalmente, `botaoSeguir('constructor')` (L2126) exibe `"✓ Seguindo #constructor"` mesmo com `seguidas` vazio.
- **Correção aplicada:** `Object.create(null)` para `tagsUlt` e `m` em `cardume-dev.html` (L2150, L2156, L2640) e `Object.prototype.hasOwnProperty.call(...)` em `botaoSeguir` (L2126) e `deRecente` (L2201).
- **Prova:** `docs/arezzo/testes/test_concha_seguranca.js` (falhou antes com a lista de `#tags` vazia no Sonar e `botaoSeguir` marcando `"✓ Seguindo #constructor"`; passou depois).

### A3 — Chave `concha_regras_<canal>` no `localStorage` sem `user.uid`
- **Local:** `cardume-dev.html` L1144-1146 (`chaveRegras`)
- **Severidade:** `baixa` · **Veredicto:** `confirmado` (sobreviveu à verificação independente de refutação)
- **Fronteira:** armazenamento local do navegador que sobrevive ao logout (`docs/SEGURANCA_FRONTEIRAS.md` §3D) entre contas diferentes no mesmo aparelho.
- **Cenário concreto:**
  1. Conta A abre um canal com regras (inclusive temático privado `t-<slug>-xxxx`) e dispensa ou visualiza as regras.
  2. `chaveRegras(id)` grava `concha_regras_t-<slug>-xxxx` sem `user.uid` no `localStorage`, e `limparSessao()` não a remove.
  3. **Resultado errado:** a Conta B no mesmo navegador pode ver a chave com o slug do canal privado no `localStorage`, e se também for membro do canal, o aviso `"Este canal tem N regras"` já nasce dispensado para ela.
- **Correção aplicada:** `const chaveRegras = id => 'concha_regras_' + (user ? user.uid : '') + '_' + id;` (mesmo padrão de `chaveRascunho` em L546).
- **Prova:** `docs/arezzo/testes/test_concha_seguranca.js` + `docs/arezzo/testes/test_concha_fixar.js` (falhou antes com `semUid` gravado e a segunda conta sem ver o aviso; passou depois).

---

## Candidatos Rejeitados (Verificação Independente)

- **`mencoes/$uid/$id/.write` (L1229) e `cardumePush.mencaoConfere` (L40-50) não rejeitam `msg.enc`:** `rejeitado` — não cruza fronteira de confiança (autoridade legítima do mesmo usuário: quem encaminha já é membro do destino e já pode enviar mensagem normal com `@Fulano`; `🚫 nada` continua barrando ambos). Fica apenas como nota opcional de consistência de contrato.
- **`assuntos/$canal/$aid/.write` (L1377) permite edição por gestor fora de `membros/{canal}`:** `rejeitado` — não cruza fronteira (o gestor já tem permissão em `membros/$canal/$uid/.write` L1090 para se adicionar ao canal e ler/editar qualquer assunto).
- **`limparSessao()` (L2631-2642) sem `pararFixadas()` e `infoObjs`:** `rejeitado` — sem caminho até resultado observável (`limparSessao` desconecta todos os `ouvintes`, `iniciar()` L2666 recarrega a página na troca de conta quando o Sino está ligado, `abrirCanal()` chama `pararFixadas()`, e `objetivos` é legível por toda a empresa).
- **`fixadas/$canal/$msgId/.write` (L1456, ramo 2 trocar tipo) sem checar `canais/$canal.exists()`:** `rejeitado` — estado inalcançável pelas regras (criação de `msgs` e `fixadas` exige `canais/$canal`, e temáticos não podem ser apagados pelas regras).

---

## O que NÃO foi verificado

- Regras realmente publicadas no Console do Firebase (`database.rules.json` é espelho manual; o deploy da revisão #2001 e da `conchaAvisoMsg` ainda está em *Pendente de deploy* no `docs/QUADRO.md`).
- Fluxo de entrega real no FCM / iOS / Android e configurações de projeto no Google Cloud / Firebase Auth.
- Demais áreas da Concha fora dos 3 itens da Fila (ex.: `conchaGifBusca`, `reacoes`, `card_comments`, `mencoes` fora de `enc`).
