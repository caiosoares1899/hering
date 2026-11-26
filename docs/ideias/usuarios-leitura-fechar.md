# 🔒 Fechar a leitura ampla de `kanban/usuarios` (desenho de 24/11/2026, R3)

**Problema** (`docs/quadro/escalados.md#usuarios-leitura-ampla`): `database.rules.json` dá `.read` no nó-pai `kanban/usuarios` a **qualquer conta Google @ciahering**, e a leitura desce em cascata. Toda a Hering lê, de todo mundo:
- `notificacoes`, que já expõe o `travessia_apoio`: "{nome} marcou que não está bem hoje";
- `fcm_tokens` e `notif_prefs`;
- papéis e squads.

**Inventário:** `docs/ideias/usuarios-leitura-inventario.md` (#1953). Fora o próprio usuário, são **4 leituras do nó inteiro** (Painel ×3, Radar ×1) e **5 de outro uid** (a transação de `createNotif` no Maré e 3 rotinas ADM do Painel).

## Decisões do Caio (24/11)
| # | Decisão |
|---|---|
| D1 | Depois da correção, **só ADM** lê o cadastro completo dos outros, incluindo notificações, tokens e Não Perturbe. A Central de Notificações do Painel continua com indicadores por pessoa, só para ADM. |
| D2 | **Torre** e **Gestor OKR** passam para o diretório público (`usuarios_publicos`), para o Radar continuar igual para todo mundo. |

## Regra final (fase C)
- **Nó-pai:** `kanban/usuarios` `.read` = Google @ciahering **e** ADM, pela mesma régua das outras regras: `role === 'adm'` no próprio cadastro ou o e-mail do Caio.
- **Cadastro próprio:** `$uid` `.read` continua sendo só o dono.
- **Regras de outros nós** que consultam `root.child('kanban/usuarios/…')` rodam no servidor e **não** dependem de `.read`, então nada muda nelas.
- **Funções:** usam Admin SDK, então nada muda.

## Sequência (a ordem importa: fechar a regra antes de mudar as páginas quebraria o Painel e o Radar)

**Fase A — diretório completo (regra + escritores + carga inicial), sem fechar nada ainda**
1. `usuarios_publicos/$uid` ganha `torre` e `gestorOkr`, validados **iguais à fonte** (`root.child('kanban/usuarios/'+$uid+'/torre')`), como já é feito com `diretoria`. O espelho público não pode mentir: o Radar usa o `gestorOkr` dos outros para mostrar controles, e o espelho é gravável pelo próprio usuário.
2. Escritores gravam fonte e espelho **no mesmo `update`**:
   - a torre na inscrição do Maré (`kanban-dev.html`, inventário L14071);
   - a escolha de torre no Radar (`okr-dev.html` L7081);
   - o ADM pelo Painel (`painel-dev.html` L11518);
   - o `gestorOkr` no Painel (L11620).
3. **Carga inicial:** script de console do ADM, que copia `torre` e `gestorOkr` de cada cadastro para o espelho e cria o espelho básico de quem não tem (`nome`, `foto`, `init`, `email`, `role`, `squads`, `squads_roles`). Escreve só onde falta ou diverge, e mostra o que fez.

**Fase B — as páginas param de ler o nó inteiro (sem fechar ainda; tudo continua funcionando com a regra atual)**
4. **Radar** `loadGlobalUsers`: lê `usuarios_publicos` para todo mundo. O cadastro completo continua sendo lido só para a **própria** pessoa (papel, torre e `gestorOkr` dela, para os próprios controles).
5. **Painel** `_getUsuariosMap` / `loadGlobalUsers`:
   - **quem não é ADM** lê `usuarios_publicos`;
   - **ADM** continua lendo o nó inteiro, para a gestão de papéis, a migração midia→prf, os reparos de diretoria e a Central de Notificações (D1).
   - A troca acontece no `_usuariosNode()`, que já escolhe o diretório para o externo.
6. **Maré** `createNotif` com id determinístico: sai a transação que **lê** a notificação do outro. Entra um `set` simples, e a regra recusa regravar.
   - A regra de `notificacoes/$notifId` hoje já exige `!data.exists()` para quem não é o dono, **exceto PO/ADM**. Esse ramo de PO/ADM passa a valer só para notificação nova ou para apagar, nunca para regravar uma existente, que reabriria um aviso lido.
   - A página trata `PERMISSION_DENIED` nesse `set` como "já existe".
   - Antes, conferir que nenhum fluxo de PO/ADM regrava a notificação de outra pessoa de propósito (grep de escritas em `notificacoes/` de outro uid).
7. **Gantt** (`mare-gcal-dev.js` L160): o ramo que leria a notificação de terceiros fora do dev segue o mesmo caminho do item 6.

### Antes da fase C (checklist: fechar antes disto quebra o prod)
- [ ] **A1 + B6 no ar:** regras (#1955) com deploy, e `createNotif` sem ler a caixa alheia **promovido ao `kanban.html`**.
- [ ] **A2:** os escritores do espelho (torre/Gestor OKR) promovidos (Maré, Radar e Painel de prod). *(Código no dev: #1957.)*
- [ ] **A3:** carga inicial rodada pelo ADM, com o espelho completo conferido. *(Script entregue: #1958, `console_espelho_diretorio.js`; rodar no `painel.html` de prod **depois** do A2 promovido.)*
- [ ] **B4 e B5:** Radar e Painel lendo o diretório, **promovidos** (`okr.html` e `painel.html`).
- [ ] **B7:** o pedido de atualização do Gantt (`mare-gcal.js`) sem ler a notificação de terceiros, promovido. *(Código no dev: `pedido.gravar` em `mare-gcal-dev.js` v11, 26/11.)*
- [ ] **ADM pela mesma régua (achado de 26/11, contrato B5):** o Painel decide ADM pela lista `adm_emails` (`isAdmUser`), mas a regra da fase C só enxerga `role === 'adm'` no próprio cadastro ou o e-mail do Caio. Antes de fechar, conferir que **toda** pessoa de `adm_emails` tem `role: 'adm'` no cadastro (ou aceitar que quem não tem passa a ver o Painel como não ADM). Script de conferência: Claude, junto da fase C.
- [ ] **Ajuste de A1 (24/11, revisão):** a trava das notificações ficou **estreita**. Ninguém além da dona transforma uma notificação **lida** em não lida, e PO/ADM ainda atualizam uma não lida. Travessia (`apoio_{pessoa}_{dia}`), Gantt (`gantt_pedido_…_{dia}`) e Plantão (`nf_bug_{bug}_{status}`) usam id fixo e foram conferidos (dev e prod). **Revisão do Codex (#1955):** (P1) a notificação de id fixo do Maré (`noTTLDelete: true`) é **só criar**: nem PO/ADM a regravam, mesmo não lida, que é o "só cria se não existe" da transação antiga, agora na regra. (P2) o Plantão (desligado desde 03/11) reusa `nf_bug_{bug}_{status}`: **se for religado**, cada aviso novo precisa de id próprio (`…_{número}`, que o filtro do Oceano já aceita), senão o segundo "sendo tratado" depois do primeiro lido é recusado. (P2) **As regras sobem antes do merge**, a partir da branch, porque o merge publica o Maré dev na hora.

**Fase C — fechar** (só depois de A e B no ar **e validados no prod**, porque as páginas de prod também leem o nó)
8. Regra do nó-pai só para ADM, com testes no simulador:
   - pessoa comum não lê o nó nem a caixa de outro;
   - ADM lê;
   - o dono lê a própria;
   - o externo não lê nada.

   Sabotagem e duas revisões (Codex + Antigravity).
9. Deploy: `firebase deploy --only database`, **depois** da promoção das páginas da fase B.

## Contratos do Codex (fase B, escritos em 26/11/2026)

A2 (escritores do espelho) já está no dev pela #1957, e o script da carga A3 pela #1958, então ficam só estes dois. Um PR por página, nesta ordem (B4 é menor e destrava o desenho do B5).

### B4 — Radar lê o diretório

```
Objetivo: o okr-dev.html deixa de ler kanban/usuarios inteiro. Todo mundo (interno e externo) monta o cache de pessoas a partir de kanban/usuarios_publicos; o cadastro completo é lido só para a PRÓPRIA pessoa. O Radar continua igual na tela.
Risco: R3 (fase B do fechamento de kanban/usuarios)  ·  Modelo e esforço: Sol high  ·  Orçamento: ~1 h; estourou, para e relata
Contexto:
- Leia docs/ideias/usuarios-leitura-fechar.md inteiro (decisões D1/D2, sequência A → B → C) e o inventário docs/ideias/usuarios-leitura-inventario.md (linha do okr-dev.html loadGlobalUsers).
- Hoje: _usuariosNode() (grep -n "function _usuariosNode" okr-dev.html) só escolhe usuarios_publicos para o externo (window._isPainelViewer); loadGlobalUsers() põe o nó inteiro em _globalUsersCache. O cache alimenta responsáveis, participantes, menções, convites, avatares, nomes, papéis/squads (elegibilidade), torre e gestorOkr (escopo e controles).
- O espelho já tem nome, email, foto, init, role, squads, squads_roles, diretoria e, desde a #1957, torre e gestorOkr (regra: iguais à fonte; ver database.rules.json "usuarios_publicos"). Quem não tem espelho some do cache: é aceito (a carga A3 cria o espelho de todo mundo antes da fase C).
- O que o Radar usa de quem está logado (role, torre, gestorOkr, squads) deve vir do cadastro PRÓPRIO, lido por kanban/usuarios/{uid} (o dono continua lendo o seu na fase C), e sobrepor a entrada dele no cache. Escritas locais no cache (ex.: _okrDefinirMinhaTorre) continuam valendo.
- A regra atual não muda neste PR: tudo continua funcionando no prod antigo.
Arquivos: okr-dev.html (loadGlobalUsers, _usuariosNode e quem mais ler kanban/usuarios de outra pessoa: grep -n "kanban/usuarios" okr-dev.html) · bump da versão do okr-dev (node scripts/mare-cli.js bump okr-dev) · teste novo docs/arezzo/testes/test_radar_diretorio.js · BUGS_E_CORRECOES.md (log --type bug). Reservados por outros (não tocar): ver docs/QUADRO.md › Em andamento.
Critérios de aceite:
- Teste com fakefb, conta interna comum: window.__log não tem nenhum get/onValue de "kanban/usuarios" (nó-pai) nem de "kanban/usuarios/<outro uid>"; só de kanban/usuarios_publicos e de kanban/usuarios/<o próprio uid>[/…].
- O mesmo teste mostra avatares e nomes de responsáveis, a torre e os controles de Gestor OKR iguais ao comportamento de antes (compare com o espelho preenchido).
- Gestor OKR e papel da própria pessoa vêm do cadastro dela, mesmo com o espelho dela desatualizado (caso no teste).
- Externo (painel_viewers) segue lendo só usuarios_publicos.
- node scripts/checar.js e cd functions && npm test verdes; test_radar_gantt.js e os testes do Radar que usam _globalUsersCache continuam passando.
Não fazer: deploy, merge, promoção para okr.html, mudança em database.rules.json, mexer no Painel ou no Maré.
Prova: saída dos testes colada · o trecho do __log que mostra as leituras · o que NÃO verificou.
Entrega: branch codex/usuarios-b4-radar + PR aberto (sem merge) + resumo com o que fez, a Prova, a linha "Fronteira:" e a decisão de dica (esperado: não, é interna).
```

### B5 — Painel: só o ADM lê o cadastro completo

```
Objetivo: no painel-dev.html, quem não é ADM monta o cache de pessoas a partir de kanban/usuarios_publicos; o ADM continua lendo kanban/usuarios inteiro (gestão de papéis, migração midia→prf, reparos de diretoria e a Central de Notificações, decisão D1). A tela de quem não é ADM continua igual.
Risco: R3 (fase B do fechamento de kanban/usuarios)  ·  Modelo e esforço: Sol high  ·  Orçamento: ~1h30; estourou, para e relata
Contexto:
- Leia docs/ideias/usuarios-leitura-fechar.md inteiro e a parte do Painel do inventário (docs/ideias/usuarios-leitura-inventario.md).
- A troca é no _usuariosNode() (grep -n "function _usuariosNode" painel-dev.html), usado por _getUsuariosMap e loadGlobalUsers. Hoje ele só escolhe usuarios_publicos para o externo.
- ⚠ Régua de ADM: a fase C vai dar leitura do nó inteiro só a quem tem role === 'adm' no PRÓPRIO cadastro (kanban/usuarios/{uid}/role) ou ao e-mail caio.soares@ciahering.com.br. O Painel decide ADM por isAdmUser() = lista ADM_EMAILS (adm_emails). O ramo "lê o nó inteiro" deve usar a régua da regra (role do próprio cadastro, lido por kanban/usuarios/{uid}/role, ou o e-mail do Caio), não a lista. Quem está na lista e não tem role 'adm' cai no ramo do diretório e o Painel avisa uma vez no console (console.warn) que falta o papel no cadastro. NÃO mude isAdmUser nem as guardas de tela.
- Fluxos que só o ADM usa e precisam da fonte (ficam no ramo ADM, sem mudança): _migrarSquadMidiaParaPrf, _guPreencherDigital, _guCorrigirEspelho, setGlobalUserDiretoria e a Central de Notificações.
- Fluxos de quem não é ADM que leem o cache (loadSquadData/members, loadPcfgUsers, addGuestByEmail, comunicados, totais) passam a usar o espelho, que tem nome, email, foto, init, role, squads, squads_roles, diretoria, torre e gestorOkr. Confira cada um; se algum precisar de campo que o espelho não tem, PARE e relate (não acrescente campo ao espelho neste PR).
- A regra atual não muda neste PR.
Arquivos: painel-dev.html · bump do painel-dev (node scripts/mare-cli.js bump painel-dev) · teste novo docs/arezzo/testes/test_painel_diretorio.js · BUGS_E_CORRECOES.md (log --type bug). Lembre que painel.html e painel-dev.html divergem: não toque no painel.html. Reservados por outros (não tocar): ver docs/QUADRO.md › Em andamento.
Critérios de aceite:
- Teste com fakefb, PO com role 'po': window.__log sem get/onValue do nó-pai "kanban/usuarios" nem de outro uid; membros das squads, avatares e a gestão de papéis por squad continuam aparecendo.
- ADM com role 'adm': lê o nó inteiro; a gestão (papéis, diretoria, Gestor OKR, torre) e a Central de Notificações continuam como hoje.
- Pessoa em adm_emails SEM role 'adm': cai no diretório e gera o console.warn (caso no teste).
- Externo segue em usuarios_publicos.
- node scripts/checar.js e cd functions && npm test verdes; os testes do Painel que mexem em usuários (grep -l "_globalUsersCache\|loadGlobalUsers" docs/arezzo/testes/test_painel*.js) continuam passando.
Não fazer: deploy, merge, promoção para painel.html, mudança em database.rules.json, mudar isAdmUser/ADM_EMAILS, mexer no Radar ou no Maré.
Prova: saída dos testes colada · trecho do __log por papel (PO, ADM, adm_emails sem role) · o que NÃO verificou.
Entrega: branch codex/usuarios-b5-painel + PR aberto (sem merge) + resumo com o que fez, a Prova, a linha "Fronteira:" e a decisão de dica (esperado: não, é interna).
```

## Testes
- **Simulador:** espelho `torre`/`gestorOkr` igual à fonte, com sabotagem; leitura do nó-pai por papel; `createNotif` sem regravar.
- **Páginas:** Radar e Painel com um usuário comum lendo só `usuarios_publicos` (conferido no log do fakefb, sem nenhuma leitura de `kanban/usuarios` de outro uid); ADM continua com a gestão e a Central.

## Divisão
- **Claude:** regras (A1, C8), `createNotif` (B6) e a revisão de tudo.
- **Codex, por contrato:** escritores do espelho (A2), Radar (B4) e Painel (B5), um PR por página.
- **Script de carga (A3):** Claude escreve, o Caio roda.

**Fronteira:** quem lê o quê muda, e é exatamente o objetivo. Na fase A, o espelho público ganha dois campos, validados contra a fonte. Exige validação do Caio: a carga inicial e a fase C, que vem depois do prod validado.
