# Bugs e Correções Técnicas — Maré Digital (`BUGS_E_CORRECOES.md`)

Este arquivo concentra o registro técnico de **bugs reportados**, **correções pontuais**, **ajustes de regressão**, **investigações de causa-raiz** e **achados do `/monitorarbugs`** em todo o ecossistema Maré Digital.

- **Por que este arquivo existe:** manter o [`CHANGELOG.md`](CHANGELOG.md) focado exclusivamente em **novas funcionalidades (features)** e **grandes melhorias/entregas estruturais**, facilitando a leitura de evolução de produto, enquanto este documento serve como base de conhecimento técnica e memória de incidentes para desenvolvedores e agentes.
- **Como registrar novas correções:** via automação `node scripts/mare-cli.js log --type bug ...` ou adicionando uma entrada no topo da seção `## 🐛 Histórico de Bugs e Correções` abaixo.

---

## 🛡️ Armadilhas Conhecidas & Regras de Ouro (Não Repetir)

Antes de alterar código compartilhado, queries do Firebase, fluxos de autenticação ou scripts de promoção, consulte sempre estas **8 armadilhas recorrentes** já enfrentadas no projeto:

1. **Comentários de cards (`ts` sempre ISO string):**
   - `loadComments()` ordena comentários usando `a.ts.localeCompare(b.ts)`.
   - **Nunca** grave `ts: Date.now()` (número) em comentários de cards (`kanban/comments/{cardId}`), pois `Number.prototype.localeCompare` não existe e quebra a renderização/ordenação. Sempre grave `new Date().toISOString()`.

2. **Queries Firebase em `<script>` clássico vs `<script type="module">`:**
   - As páginas principais (`kanban.html`, `painel.html`, `quadro.html`, `radar.html`, etc.) carregam o SDK do Firebase em um `<script type="module">` e expõem as referências para o `<script>` clássico global via `window._x` (ou helpers equivalentes).
   - Qualquer função do SDK (`query`, `orderByChild`, `equalTo`, `limitToLast`, `orderByKey`, `startAt`, `endAt`) usada fora do módulo **precisa** estar exposta em `window._x` dentro do `<script type="module">`, caso contrário lançará `ReferenceError` silencioso em runtime no script clássico.

3. **Ordenação de notificações (`orderByChild('ts')` vs `orderByKey()`):**
   - Notificações com IDs determinísticos (`due_today_`, `mention_`, `reuniao-`) **não** começam com `'n' + timestamp`.
   - Usar `orderByKey()` combinado com `limitToLast()` exclui ou ordena incorretamente essas notificações lexicograficamente. Sempre use `orderByChild('ts')` (com `.indexOn: ["ts"]` garantido em `database.rules.json`).

4. **Isolamento de `localStorage` do Firebase (`FB_OVERRIDE_NS`):**
   - Chaves de override de configuração do Firebase no `localStorage` devem obrigatoriamente incluir o sufixo de namespace da página (`_kanban_dev`, `_painel_dev`, etc.).
   - Sem esse isolamento, um override salvo em `-dev.html` vaza para a página de produção `.html` por compartilharem o mesmo domínio no GitHub Pages (`caiofsoares.github.io`).

5. **Login Popup e `Cross-Origin-Opener-Policy` (COOP) / Safari iOS:**
   - **Chrome Desktop:** a página de login do Google ocasionalmente aplica headers COOP que fazem `signInWithPopup` perder a referência da janela e disparar `auth/popup-closed-by-user` falsamente, exigindo fallback automático para `signInWithRedirect` após 2 falhas consecutivas.
   - **iPhone / iPad (Safari e Web App na Tela de Início):** nunca depender de `signInWithPopup` puro; usar sempre `MareLogin` (`mare-login.js`) com fluxo OAuth direto (`response_type=id_token`).

6. **Iniciais de usuários (`init_registry` via `runTransaction`):**
   - Toda criação ou edição de sigla/iniciais de usuário (`autoRegistrar`, `editarInicial`, `confirmarInscricao`) deve passar por transação atômica (`runTransaction`) em `kanban/init_registry/{INIT}` para impedir colisão entre usuários simultâneos.

7. **Divergências permanentes entre `-dev.html` e `.html` (nunca sobrescrever na promoção):**
   - Na promoção de `-dev.html` para `.html`, **nunca** faça cópia cega de arquivo inteiro sem preservar os 4 pontos de divergência intencional:
     - **(a)** String de versão (`vX.Y.Z-dev` vs `vX.Y.Z`) + constantes `VERSION_KEY` / `FB_OVERRIDE_NS`;
     - **(b)** Ícone da aba (`favicon-dev.png` vs `favicon.png`);
     - **(c)** Chave de logout remoto (`force_logout_after_dev` vs `force_logout_after`);
     - **(d)** Imports de módulos compartilhados (`mare-*-dev.js?v=N` vs `mare-*.js?v=N`).

8. **Inspeção SSL corporativa (FortiGate/VPN):**
   - O SDK do Firebase (`10.14.1`) é servido localmente a partir de `vendor/firebase-10.14.1/` porque firewalls corporativos (FortiGate/VPN) com inspeção SSL truncavam ou corrompiam o bundle ESM vindo de `www.gstatic.com`. Nunca reverta os imports de produção/dev para CDN externa sem fallback local.

---

## 🐛 Histórico de Bugs e Correções

### 2026-10-15 · Radar (`radar.html` / `radar-dev.html` v2.0.95) — Títulos de 2 linhas cortados na Apresentação ao Vivo
- **Sintoma:** Na Apresentação ao Vivo do Radar (tela cheia e impressão PDF), títulos de capítulos ou objetivos que quebravam em 2 linhas ficavam com a segunda linha cortada ou sobreposta aos subtítulos.
- **Causa-raiz:** O cálculo de auto-fit em `_fitHeaderTitles` e `_okrFitDetailSections` media apenas `scrollWidth > clientWidth` ou usava `line-height` fixo sem descontar a altura real ocupada quando o título permitia wrap em até 2 linhas (`max-height` / `scrollHeight`).
- **Correção:** Ajuste nos helpers `_fitHeaderTitles` e `_okrFitDetailSections` em `radar-dev.html` e `radar.html` para verificar também `scrollHeight` e recalcular o `font-size` / `line-height` preservando visibilidade integral em títulos de 2 linhas.

### 2026-10-15 · Ecossistema (`painel.html`, `intake.html`, `maredigital.html`) — Submarca `Geral` oculta ou sem badge nos filtros
- **Sintoma:** Cards e demandas classificadas com submarca `Geral` não exibiam badge consistente ou desapareciam ao filtrar submarcas no Painel, Intake e portal Maré Digital.
- **Causa-raiz:** Mapas de cores/labels de submarcas tratavam apenas `Básico`, `Hering`, `Intimates`, `Kids` e `Sports`, ignorando `Geral` ou tratando-o como vazio.
- **Correção:** Inclusão explícita da submarca `Geral` nos dicionários de filtro, badges e seletores em `painel-dev.html`/`painel.html`, `intake-dev.html`/`intake.html` e `maredigital-dev.html`/`maredigital.html`.

### 2026-10-15 · Radar (`radar.html` / `radar-dev.html` v2.0.90–v2.0.91) — Permissão de edição em Atas/Reuniões e `Invalid Date` em `#notes-date-sel`
- **Sintoma:** (1) Usuários autorizados não conseguiam editar ou criar pautas/atas na aba Calendário/Reuniões; (2) O seletor `#notes-date-sel` exibia `Invalid Date` quando uma nota de reunião possuía chave de data fora do formato `YYYY-MM-DD` ou campo `date` ausente.
- **Causa-raiz:** Checagem restritiva de papel de edição na UI de notas e ausência de validação/fallback antes de instanciar `new Date(dateStr + 'T12:00:00')` ao popular `#notes-date-sel`.
- **Correção:** Ajuste na guarda de permissão de edição de reuniões/atas e sanitização de datas com fallback seguro na renderização de `#notes-date-sel`.

### 2026-10-14 · Gerador de Apresentação OKR (`okr-apresentacao.slide.html`) — Pacote de 7 correções do `/monitorarbugs`
- **Sintoma:** Sete bugs potenciais detectados na auditoria estática de `okr-apresentacao.slide.html`, incluindo risco de XSS/quebra de atributo HTML em textos interpolados de KRs, divisão por zero quando meta e baseline são iguais (`target === start`), falta de cleanup de listeners ao fechar modais/previews e referências nulas quando capítulos não possuem KRs cadastrados.
- **Causa-raiz:** Interpolação direta de strings sem helper de escape em templates de slides e ausência de guardas defensivas para arrays vazios e denominadores zerados no cálculo de progresso percentual.
- **Correção:** Aplicação das 7 correções defensivas em `okr-apresentacao.slide.html` (escape HTML consistente, guarda `denom === 0`, optional chaining em listas de KRs e remoção limpa de listeners temporários).

### 2026-10-12 · Data Studio & Painel (`datastudio.html`, `painel.html`) — Correções `/monitorarbugs` nos monitores de status GitHub/Firebase
- **Sintoma:** Falhas silenciosas de timeout/rate-limit ao consultar status de deploy/GitHub API e atualização concorrente de indicadores de conectividade Firebase no Painel e no Data Studio.
- **Causa-raiz:** `fetch` sem `AbortController`/timeout explícito e ausência de tratamento para respostas HTTP 403/429 da API pública do GitHub ao verificar o último commit/workflow.
- **Correção:** Adição de timeout defensivo, fallback visual gracioso em caso de rate-limit da API do GitHub e dessincronização corrigida nos badges de status em `datastudio-dev.html`/`datastudio.html` e `painel-dev.html`/`painel.html`.
