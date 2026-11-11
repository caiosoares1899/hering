# 🧭 Programa de boas-vindas do Maré Digital (onboarding da ferramenta)

Pedido do Caio (11/11/2026): o onboarding do Maré hoje é feito ao vivo (via A Bordo) e o tempo é curto. Queremos um programa **guiado e autosserviço**, em duas versões — **Resumida** (principais ações, ~5 min) e **Completa** (tudo) — que aparece no **primeiro cadastro** e pode ser revisto depois. O A Bordo continua sendo o onboarding do **método ágil**; este é o da **ferramenta**.

## Decisões do Caio (11/11/2026)
- **Formato:** página própria `guia-mare.html` (telas **simuladas em HTML/CSS**, sem gif/print — leve) + **tour curto dentro do board** que destaca os botões reais.
- **Resumido:** board e cards · funções do card · comentar e @mencionar · notificações · Meu Dia e Sonar.
- **Agente Ágil:** botão "Pergunte ao Agente" leva ao **card de conversa que já existe** (`openAgenteHotline()`), só nas squads onde ele está ativo (`AGENTE_AGIL_MENTION_SQUADS`, hoje `dev` e `dados`). Sem função nova, sem deploy.
- **Progresso:** no perfil, `kanban/usuarios/{uid}/onboarding_mare`.

## Pendências combinadas
- **Dica** (regra 7): sim — "🧭 Boas-vindas em ❓ Ajuda" para quem já usa o Maré. Entra **depois que o `guia-mare.html` estiver na main** (mexer no `mare-dicas-dev.js` exige bump do `?v=` nas 4 páginas; antes do guia a dica levaria a 404).
- **`.validate` de formato** para `onboarding_mare` (opcional, deploy de regras): necessária se alguém além do próprio usuário passar a ler esse nó no DOM (ex.: visão do ADM de quem concluiu).

## Divisão (§7.7)
| Parte | Quem | Arquivos |
|---|---|---|
| Página do guia (telas simuladas, textos, modos, progresso local) | **Codex** (11/11: o Antigravity estava num `/monitorarbugs`; contrato em `~/hering-logs/delegacoes/2026-11-11-codex-guia-mare.md`; revisão visual do Claude) | `guia-mare.html` (novo), linha em `docs/BIBLIOTECA.md` |
| Entrada no 1º cadastro, tour no board, `?hotline=1`, sincronizar progresso, Ajuda, dica, versão | **Claude** | `kanban-dev.html`, `version.json`, `mare-dicas-dev.js`, `CHANGELOG.md` |

## Interface entre as duas partes (fixa — não mudar sem combinar)

**Abrir o guia** (o board monta a URL):
`guia-mare.html?modo=resumido|completo&squad=<id>&agente=0|1&volta=<kanban-dev.html|kanban.html>`
- `modo` ausente → tela inicial com a escolha entre os dois.
- `agente=1` → o guia mostra o passo/botão do Agente Ágil; `agente=0` → esconde tudo do Agente.
- `volta` só aceita exatamente `kanban.html` ou `kanban-dev.html` (qualquer outro valor → `kanban.html`). **Nunca** usar o valor cru num `href`.
- `squad` só `[a-z0-9_-]`, até 40 caracteres (senão, ignora).

**Botões do guia que voltam ao board:**
- "👉 Fazer no board" → `<volta>?squad=<squad>&tour=<passo>` (abre o tour daquele passo no board real).
- "🤖 Pergunte ao Agente" (só com `agente=1`) → `<volta>?squad=<squad>&hotline=1`.
- Abrem sempre na **mesma aba nomeada** `mare_board` (`target="mare_board"` / `window.open(url,'mare_board')`): os 9 passos reaproveitam uma aba do board, em vez de abrir 9 boards (cada um com 2,7 MB + listeners).

**Progresso (o guia NÃO usa Firebase):** o guia grava em `localStorage['guia_mare_prog']` (envolver em try/catch):
```json
{"passos":{"board":"2026-11-11T12:00:00.000Z","card-criar":"…"},"resumido":"<iso quando terminou>","completo":"<iso>"}
```
O board lê essa chave ao carregar e quando a aba volta ao foco, junta no perfil (`onboarding_mare`) e apaga a chave. O guia também lê `localStorage['guia_mare_prog_espelho']` (escrito pelo board com o que já está no perfil) para mostrar ✓ nos passos já feitos.

**IDs dos passos (fixos):**
- Resumido (nesta ordem): `board`, `card-criar`, `card-mover`, `card-funcoes`, `comentar`, `notificacoes`, `meu-dia`, `sonar`, `agente` (só com `agente=1`).
- Completo = os do Resumido + um por tema da Ajuda: `agil`, `raia`, `filtros`, `selecionar`, `calendarios`, `campanhas`, `intake`, `timeline`, `dashboard`, `criativos`, `dependencias`, `links`, `automacoes`, `comunicacao` (Mural/comunicados), `kudos`, `ilha` (Timer e Ilha Dinâmica), `dicas`, `metas`, `tema`, `config` (Minhas preferências), `pausar-continuo`, `arquivar-excluir`, `duplicar-modelo`, `spotify`.
- O tour do board atende (`?tour=`): `board`, `card-criar`, `card-mover`, `card-funcoes`, `comentar`, `notificacoes`, `meu-dia`, `sonar`, `agente` e `resumido` (todos em sequência). Outros IDs: o guia **não** mostra "Fazer no board".

---

## Contrato para o Antigravity (colar na janela dele)

```
Objetivo: criar guia-mare.html — o programa de boas-vindas do Maré Digital, com versão Resumida (~5 min, 8–9 passos) e Completa (~32 passos), passo a passo guiado e "prints" SIMULADOS em HTML/CSS (sem imagens, sem gif).

Contexto:
- Leia docs/ideias/onboarding-mare.md inteiro (decisões, interface FIXA de URL/localStorage e IDs dos passos), docs/GUIA_UI_UX.md e MARINE_GLASS.md antes de desenhar.
- Precedente de estilo: guia-okr.html (guia do Radar), mas ele pesa 14 MB por causa de gifs — aqui é o oposto: cada "print" é uma mini-tela montada em HTML/CSS (colunas, cards, modal do card, sino, Meu Dia, Sonar…) com um cursor/destaque animado indicando onde clicar. Meta: a página inteira < 250 KB.
- Textos: use a Central de Ajuda do Maré como fonte da verdade — const HELP_CONTENT em kanban-dev.html (grep -n "const HELP_CONTENT"). Reescreva em linguagem de usuário, curta, 1 ação por frase. Não invente recurso que não está lá.
- Nomes visíveis: "Maré Digital", "Radar" (nunca "página do OKR"), "Oceano" — ver docs/OCEANO.md.
- Estrutura de cada passo: título · "por que importa" (1 frase) · mini-tela simulada · 2–4 passos numerados · botões "👉 Fazer no board" (só nos IDs que o tour atende) e "🤖 Pergunte ao Agente" (só com agente=1) · "Concluir passo ✓".
- Tela inicial: escolha ⚡ Resumido (5 min) × 📚 Completo; barra de progresso; ✓ nos passos feitos; no fim de cada modo, tela de conclusão (grava "resumido"/"completo" no progresso). Navegação por teclado (← →), "pular", índice lateral no Completo (no celular, vira lista recolhível).
- Sem Firebase, sem login, sem fetch: página estática. Sem par -dev (como guia-okr.html).
- 3 temas (escuro/claro/sistema, mesmo padrão de tokens das outras páginas, prefers-color-scheme) e 390 px sem rolagem horizontal; respeitar prefers-reduced-motion (sem animação infinita).

Arquivos: guia-mare.html (novo, raiz) · docs/BIBLIOTECA.md (1 linha em "Sem par dev", junto do guia-okr) · capturas antes/depois em docs/capturas/guia-mare/ (1280 e 390 px, 3 temas).
Reservados por outros (não tocar): kanban-dev.html, kanban.html, version.json, mare-dicas-dev.js, CHANGELOG.md (Claude, branch claude/onboarding-mare).

Critérios de aceite:
- node scripts/checar.js passa.
- Abrir guia-mare.html?modo=resumido&squad=dados&agente=1&volta=kanban-dev.html mostra os 9 passos na ordem do doc; com agente=0 o passo "agente" e os botões do Agente somem.
- volta=https://evil.com resulta em links para kanban.html; squad com caractere fora de [a-z0-9_-] é ignorado (os parâmetros só entram via textContent/encodeURIComponent, nunca innerHTML).
- Concluir um passo grava localStorage['guia_mare_prog'] no formato do doc; recarregar mantém o ✓; com localStorage bloqueado a página funciona sem quebrar.
- Capturas em docs/capturas/guia-mare/ nas 3 cores e 2 larguras, sem texto cortado nem sobreposição.

Não fazer: deploy, merge, promoção a prod; mexer em kanban*.html ou em qualquer arquivo reservado; usar imagens/gif; carregar script externo além de fontes do Google já usadas nas outras páginas.

Entrega: branch antigravity/guia-mare + PR para a main (sem merge) + resumo com: o que fez, como validou, o que NÃO verificou, linha "Fronteira:" (parâmetros de URL → DOM/href), decisão de dica (provável "não": a dica fica no board, com o Claude).
```

## Telas reais (11/11/2026, `/melhoriauiux`)
As mini-telas do guia são **capturas do próprio `kanban-dev.html`** (dados fictícios), geradas por `scripts/guia-mare-telas.js` e gravadas entre os marcadores `TELAS-GERADAS` do `guia-mare.html`. **Quando o visual do Maré mudar** (redesenho do board, do card, do sino…): suba um servidor na raiz e rode `node scripts/guia-mare-telas.js` (usa `~/hering-tools`), confira as capturas e faça o commit. Por padrão captura o `kanban-dev.html`; depois que o onboarding for promovido, capture a produção com `PAGINA=kanban.html` (o guia serve quem usa o prod — nada só-dev deve aparecer nele). Para mudar o que cada passo destaca, edite `ESTADOS` no script; para os textos, o `CONTENT` do guia.
