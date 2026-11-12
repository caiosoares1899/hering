# Quadro: detalhe dos itens escalados

> Texto completo de cada item de "Escalado" do [`QUADRO.md`](../QUADRO.md), movido sem edição de `docs/COORDENACAO_AGENTES.md` em 11/11/2026.

<a id="radar-reduced-motion"></a>

| Quem achou | O que | Como reproduzir | Data |
|---|---|---|---|
| Claude | `okr-dev.html` não tem bloco `@media (prefers-reduced-motion: reduce)`: o `okrPulse` infinito do "digitando…" do Agente (`.okr-agente-typing`) roda mesmo com movimento reduzido. Entra na rodada `codex/radar-uiux` (o arquivo está reservado). | `grep -c prefers-reduced-motion okr-dev.html` → 0 | 09/11/2026 |

<a id="apresentacao-live"></a>

| Quem achou | O que | Como reproduzir | Data |
|---|---|---|---|
| Claude | `docs/arezzo/testes/test_apresentacao_live.js` falha também na `main`: "fora da sincronização, o slide do apresentador NÃO puxa a pessoa" (a pessoa fica "Acompanhando ✓" e vai junto para `ger:digital:tech`). Pode ser o teste (ordem de eventos do Firebase falso) ou o código do `liveSeguindo`: investigar antes de mexer no ao vivo. | rodar a suíte na `main` (2/2 vezes falha) | 09/11/2026 |

<a id="travessia-humor-inteiro"></a>

| Quem achou | O que | Como reproduzir | Data |
|---|---|---|---|
| Antigravity | `database.rules.json` (`travessia/humor/$uid/$dia` e `humor_comp`, L344/L365/L386): `.validate` aceita float entre `1` e `5` (ex.: `1.5`), sem exigir inteiro. O front (`travessia-dev.html`) já foi blindado com `faceDe()`, mas vale exigir `% 1 === 0` na regra. | gravar `{n: 1.5, ts: ServerValue.TIMESTAMP}` em `travessia/humor_comp/{uid}/{dia}` | 11/11/2026 |

<a id="seguranca-regras-c3-c4"></a>

| Quem achou | O que | Como reproduzir | Data |
|---|---|---|---|
| Antigravity | **Segurança (`database.rules.json` · `/auditoriaseguranca` de `painel-dev.html`):** 5 achados de regras RTDB confirmados por simulador (**✅ C1/C2 tratados pelo Claude em 11/11/2026 — PR das regras de papel; faltam C3, C4, D7/D8**) (`functions/rules/rulesSim.js`) e escalados sem editar `database.rules.json`: **(C1 · Alta)** escalada PO→ADM em `kanban/usuarios/$uid` (`L816–819`: `@ciahering` com `role === 'po'` consegue gravar `role: 'adm'` no próprio `$uid` ou rebaixar ADM, destravando `config/adm_emails/.write` `L789`, `painel_viewers/.write` `L779` e `config/agente_agil_orquestrador/.write` `L791`); **(C2 · Média)** auto-promoção em `kanban/usuarios/$uid` (`L816–832`: `auth.uid === $uid` aceita campos arbitrários sem `.validate`, permitindo gravar `gestorOkr: true` e `torre: 'geral'`, o que destrava `okr/datastudio/.write` `L199`); **(C3 · Alta)** leitura ampla concedida a `painel_viewers` externos nos nós-pai `kanban/painel_viewers` (`L778`: expõe lista completa de e-mails/nomes de todos os convidados), `kanban/painel` (`L172`: expõe `painel/config/backup_cfg` com chaves EmailJS), `kanban/config` (`L788`: expõe `adm_emails` e `webhookUrl` de `agentesExternos`), `kanban/feedback` (`L30`) e `kanban/squads/$sq/error_logs` (`L61`); **(C4 · Média)** `kanban/feedback/.write` (`L31`) na raiz permite a externo de 1 squad sobrescrever/apagar todo o nó; **(D7/D8 · Média)** `kanban/comunicados/.write` (`L26`) aceita qualquer `@ciahering` (não só ADM) e faltam regras para `campanhas_dev`/`feedback_dev`. ⚠️ **Aviso explícito do Caio:** ao apertar `database.rules.json` (especialmente C3/C1), **cuidado redobrado para NÃO bloquear os autorizados externos de entrar no Maré Digital** (`squads/$sq/externos` + `usuarios/$uid/squads` + `mare-login.js`) nem quebrar o `_check` de `painel_viewers` no boot do `painel.html` (`L10477`, que hoje lê `kanban/painel_viewers` inteiro — exigir migração coordenada para leitura por chave `$emailKey` antes de fechar o nó-pai). | `rulesSim.js` em `database.rules.json` (`L26,30-31,61,172,199,778-779,788-791,816-832`) | 11/11/2026 |
