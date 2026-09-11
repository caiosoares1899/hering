---
name: otimizaçãoderotina
description: Audita o código do Maré Digital (kanban.html/kanban-dev.html, e por extensão painel.html se pedido) em busca de oportunidades reais de otimização de bytes de download da PÁGINA, performance, mobile, E consumo de LEITURA do Firebase (query/fallback/tree completa) — sem alterar a arquitetura de página única self-contained do projeto. Use sempre que o usuário pedir para "otimizar o código", "revisar performance do board", "economizar bytes/download", "deixar o board mais rápido", "otimização para mobile", "revisar consumo do Firebase", "rotina de otimização", ou pedir pra rodar essa rotina de novo — mesmo que a frase não mencione "kanban" ou "bytes" explicitamente (ex.: "o board tá pesado", "dá uma olhada se tem gordura pra cortar no código", "nosso consumo de Firebase tá alto").
---

# Rotina de otimização — Maré Digital

Auditoria repetível de bytes/performance/mobile no `kanban.html` (produção)
e `kanban-dev.html` (dev), criada depois de uma primeira rodada manual que
achou e corrigiu um favicon duplicado 4x no HTML (~75KB de bytes
redundantes). Esta skill existe pra repetir esse tipo de achado sem
precisar reconstruir o método do zero a cada vez.

## O que esta rotina NÃO faz (restrição de arquitetura)

O app não tem build step, não tem bundler — cada página é um único arquivo
HTML self-contained, com `<style>` e `<script>` inline, sem imports entre
páginas (ver `CLAUDE.md`, seção "What this repo is"). Isso é uma decisão de
arquitetura deliberada, não um descuido. Por isso:

- **Nunca minifique** o HTML/CSS/JS fonte — não existe pipeline de build
  pra desfazer isso no deploy; minificar a fonte tornaria o código
  permanentemente ilegível pra manutenção futura.
- **Nunca quebre o `<script>`/`<style>` principal em arquivos externos**
  sem aprovação explícita do usuário — mesmo sendo o MAIOR ganho de bytes
  possível (o script principal tem ~1MB), isso contraria a arquitetura
  documentada. Se achar esse tipo de oportunidade, **reporte como
  recomendação separada**, não implemente.
- Mudanças visuais/de UX (cortar `backdrop-filter`, reduzir efeitos) só
  com sinal verde explícito — são trade-off de design, não bug.

O que ESTÁ dentro do escopo: cortar bytes redundantes, adicionar hints de
rede de graça, apontar leaks/ineficiências concretas, e auditar se as
LEITURAS do Firebase (não só o download da página) estão filtrando no
servidor como deveriam — tudo que reduz download/trabalho do navegador
(inicial OU recorrente) sem mudar como o app é estruturado ou como ele se
parece.

**Duas classes de custo diferentes, não confunda uma com a outra**: bytes
de PÁGINA (Passos 1-8, abaixo) são um custo de UMA VEZ por reload — cresce
com o tamanho do HTML, não com o quanto o squad usa o board. Bytes de
LEITURA do Firebase (Passo 4.1, novo) são um custo RECORRENTE que escala
com uso real — uma query mal filtrada custa pouco pra 1 pessoa testando e
muito pra 20 pessoas com o board aberto o dia inteiro. Os Passos 1-8 nunca
teriam achado o bug de `comunicados` (~181MB/30 dias, achado fora desta
skill, ver Passo 4.1) porque nenhum deles lê código de busca de dado — só
o HTML/CSS/JS que o navegador baixa pra montar a página.

## Passo 1 — Levantar o tamanho real do arquivo

```bash
wc -c kanban.html kanban-dev.html
wc -l kanban.html kanban-dev.html
```

Pra achar os blocos `<script>`/`<style>` de verdade, **não confie num
regex varrendo o arquivo inteiro** (`<script[^>]*>...<\/script>`) — este
repo tem um comentário no código que menciona literalmente o texto
`<script>` no meio de uma frase (explicando o mecanismo de tema claro), e
isso engana esse tipo de regex, fazendo ele "fechar" o bloco errado e
bagunçar a contagem. Use âncoras de início de linha em vez disso:

```bash
grep -an '^<script\|^</script>\|^<style\|^</style>' kanban.html
```

Isso dá as linhas reais de abertura/fechamento — dá pra conferir o
tamanho de cada bloco por `sed -n 'INICIO,FIMp' arquivo | wc -c` a partir
daí.

## Passo 2 — Caçar assets embutidos duplicados (o achado mais valioso até agora)

```bash
grep -ao 'data:image/[^"'"'"']*' kanban-dev.html | awk '{print length($0)}' | sort -rn
grep -abon 'data:image/[^"'"'"']\{1,60\}' kanban-dev.html   # posição + prévia de cada ocorrência
```

Se aparecer mais de uma ocorrência do MESMO asset (favicon, logo, ícone
de manifest PWA são os candidatos óbvios — aparecem em `<link rel="icon">`,
`<link rel="apple-touch-icon">`, telas de login/loading, e no manifest
dinâmico de PWA gerado em JS), decodifique e compare por tamanho em bytes
E por hash, não só pelo tamanho do base64 — encodes diferentes do MESMO
PNG podem ter tamanhos de base64 ligeiramente diferentes:

```bash
node -e "
const fs=require('fs');
const html=fs.readFileSync('kanban-dev.html','utf8');
const matches=[...html.matchAll(/data:image\/(png|jpeg|svg\+xml)[^\"']*/g)];
matches.forEach((m,i)=>{
  const b64 = m[0].split('base64,')[1];
  if(!b64) return;
  const buf=Buffer.from(b64,'base64');
  fs.writeFileSync('/tmp/asset_'+i+'.png', buf);
  console.log(i, 'bytes:', buf.length);
});
"
md5sum /tmp/asset_*.png
```

Se os hashes baterem (ou os arquivos parecerem visualmente iguais mesmo
com hash diferente — **use a ferramenta de leitura de imagem pra
confirmar visualmente antes de decidir**, nunca assuma só pelo tamanho),
extraia UMA cópia pra um arquivo de verdade na raiz do repo (convenção já
existente aqui: `marinheiro.png`, `qr-onboarding.png` — arquivos soltos na
raiz, não numa pasta `assets/`), e referencie ele por caminho relativo
(`favicon.png`, **nunca** `/favicon.png` com barra no início — o
GitHub Pages pode servir o repo debaixo de um subpath, e um caminho
absoluto quebraria isso).

Por que isso importa tanto nesse app especificamente: o mecanismo de
auto-atualização (`version.json`, `cache:'no-store'`) faz o navegador
rebaixar o HTML **inteiro** toda vez que a versão muda — o que acontece
com bastante frequência neste projeto. Todo byte que não foi externalizado
é baixado de novo a cada release, mesmo sem ter mudado nada nele. Um
asset externo, em compensação, fica cacheado à parte e só é baixado uma
vez.

Depois de extrair, confira que sobrou zero ocorrência do padrão antigo:

```bash
grep -c 'data:image/png;base64' kanban-dev.html   # deve dar 0
```

## Passo 3 — Hints de rede de graça

Confira se o `<head>` já tem `<link rel="preconnect">` pros domínios
externos usados logo cedo — Google Fonts (`fonts.googleapis.com`,
`fonts.gstatic.com`) e o CDN do Firebase (`www.gstatic.com`, de onde os
módulos do SDK são importados). Se faltar, adicionar é seguro e de graça
(adianta DNS/TLS em paralelo, não muda nada visualmente). Confira também
que o link de fonte do Google já tem `display=swap` (evita texto invisível
enquanto a fonte carrega) — normalmente já tem, só confirme.

## Passo 4 — Confirmar que o import do Firebase já é modular

```bash
sed -n '/<script type="module">/,/^<\/script>/p' kanban-dev.html | grep '^import'
```

Deve mostrar imports nomeados de módulos separados
(`firebase-app.js`/`firebase-database.js`/`firebase-auth.js`/
`firebase-messaging.js`), não um bundle monolítico. Se já for assim
(normalmente é), não tem nada a fazer aqui — só confirme e siga em
frente. Isso já evita puxar Firestore/Storage/Analytics que o app não usa.

## Passo 4.1 — Leitura do Firebase: query filtra de verdade, ou cai em fallback de árvore inteira?

**Nasceu de um gap real** (2026-09-11): uma rodada desta skill, feita horas
antes de descobrir que `comunicados` respondia por ~181MB/30 dias (o maior
path isolado do sistema), saiu "limpa" — porque nenhum dos Passos 1-8 olha
pra ISSO. A causa raiz (`query()`/`orderByChild()`/`equalTo()` chamados
bare dentro do `<script>` clássico, sem acesso aos bindings do `<script
type="module">` anterior — bindings de import de módulo ES não atravessam
esse limite) fazia a query filtrada lançar `ReferenceError` em SILÊNCIO
(engolido por um `try/catch` de blindagem) em 100% das chamadas desde que
a feature existia — todo refresh baixava a árvore `comunicados` INTEIRA
(ativos + arquivados) em vez de só os ativos. Nenhum dos Passos 1-8
passaria perto disso: são todos sobre o peso da PÁGINA (HTML/CSS/JS que o
navegador baixa pra montar a tela), não sobre quanto dado uma leitura do
Firebase transfere depois que a página já carregou.

**1. Ache bindings de módulo usados fora de escopo (a causa raiz exata do
bug de `comunicados`)**. Liste os nomes importados no `<script
type="module">`:

```bash
grep -an '^import {' kanban-dev.html
```

Pra cada nome da lista (`query`, `orderByChild`, `equalTo`, `limitToLast`,
`startAt`, `endAt`, `runTransaction`, `onChildAdded`, `signInWithPopup`,
`onAuthStateChanged`, `getMessaging`, etc.), confirme que TODO uso fora do
próprio `<script type="module">` passa por um alias em `window` (mesmo
padrão de `window._ref`/`window._get`/`window._query`), nunca bare:

```bash
# Ache onde o script clássico começa (depois do </script> do módulo) --
# -a sempre, senão emoji/unicode fazem grep reportar "binary file matches"
grep -an '^</script>' kanban-dev.html | head -2
# Pegue só o conteúdo a partir dali e procure uso BARE de cada nome
awk 'NR>LINHA_DO_FECHAMENTO' kanban-dev.html > /tmp/_classic_script.txt
for nome in query orderByChild equalTo limitToLast startAt endAt runTransaction onChildAdded onChildChanged onChildRemoved signInWithPopup onAuthStateChanged getMessaging; do
  echo "== $nome =="
  grep -na "[^._a-zA-Z]$nome(" /tmp/_classic_script.txt | grep -v "window\._$nome("
done
```

Qualquer ocorrência fora de comentário é candidato real — `ReferenceError`
síncrono, quase sempre engolido por algum `try/catch` de blindagem (como o
de `comunicados`), nunca aparece no console de quem não está procurando.
**Cuidado com falso positivo**: uma `const nome = (a,b)=>{...}` LOCAL
dentro de uma função (sombra de propósito, nome genérico tipo `set`/`get`)
não é bug — confirme lendo a função inteira antes de reportar.

**2. Pra cada `query(`/`onValue(`/`get(fb(...))` que lê um node do
Firebase, pergunte: filtra no servidor, ou baixa tudo e filtra no
cliente?**

```bash
grep -an 'window\._query(\|window\._onValue(fb(\|window\._get(fb(' kanban-dev.html
```

Pra cada ocorrência: o node lido (`kanban/comunicados`, `kanban/squads/...`)
cresce sem limite (histórico que só aumenta, nunca é podado)? Se sim, e só
uma FATIA é usada depois (`.filter(c=>c.ativo)`, `.filter(c=>!c.archived)`
logo em seguida), isso é candidato a um `query()`+`orderByChild()`/
`equalTo()`/`limitToLast()` que filtre no servidor em vez de baixar tudo —
mesma economia que o fix de `comunicados` já aplicou. **Não é automático
que todo `get()`+`filter()` seja bug** — nodes pequenos/limitados (tags,
columns, membros) não valem a complexidade de uma query; o critério é
"esse node cresce sem limite E é lido com frequência" (poll/listener ao
vivo, não uma leitura única no boot).

**3. Se tiver acesso ao console de uma sessão de verdade (não só leitura
estática do arquivo)**, rode a telemetria que o próprio app já expõe antes
de adivinhar qual path investigar:

```js
// No console do kanban.html/painel.html, já logado, com permissão de ADM
await debugBytesAllSquads()
```

Isso mostra o consumo real por path/squad dos últimos dias
(`_dbgTrack`/`_debug_bytes_daily`) — qualquer path desproporcional ao
resto (como `comunicados` estava) é prioridade #1 pra aplicar os itens 1-2
acima nele especificamente, em vez de auditar todo `onValue()`/`get()` do
arquivo sem prioridade.

## Passo 5 — Heurística de leak em `setInterval`

```bash
grep -aoc 'setInterval(' kanban-dev.html
grep -aoc 'clearInterval(' kanban-dev.html
grep -an 'setInterval(' kanban-dev.html
```

Contagens muito diferentes (bem mais `setInterval` que `clearInterval`)
merecem investigar CADA intervalo sem par: alguns são intencionalmente
"vida inteira da sessão" (poll de versão, kudos, presença — esses não
precisam de `clearInterval` correspondente e está tudo bem). Outros são
escopados a um modal/contexto específico (ex.: indicador de "não salvo"
enquanto um card está aberto) e ESSES precisam ser limpos quando o
contexto fecha, senão ficam rodando pra sempre em segundo plano, gastando
bateria/CPU à toa no celular. **Não mexa em nada aqui sem rastrear o
ciclo de vida específico daquele intervalo** — é um passo de "sinalizar
pra investigar", não de correção automática.

## Passo 6 — `backdrop-filter` (custo de GPU no mobile)

```bash
grep -aoc 'backdrop-filter' kanban-dev.html
```

Só reporte a contagem como observação de baixa prioridade. Este app tem
um sistema visual "glass"/tema de água deliberado (ver comentários de
tema no CSS e o `CLAUDE.md`) — `backdrop-filter` é escolha de design, não
bug. Só vale destacar se a contagem tiver crescido de forma desproporcional
release a release; nunca remova/reduza sem aprovação explícita, porque é
uma troca visual, não uma correção técnica.

## Passo 7 — Assets de imagem grandes

Pra qualquer imagem referenciada (`marinheiro.png`, `qr-onboarding.png`,
etc.), confira: (a) já está externalizada (bom, já cacheável) em vez de
embutida — se estiver embutida, aplique o Passo 2; (b) é carregada no
caminho crítico (bloqueia o primeiro render) ou só sob demanda (ex.: ícone
de notificação do browser, que só baixa quando uma notificação de
verdade dispara — isso está OK como está, não é um problema).

## Passo 8 — Mobile: viewport e gestos de toque

Confirme que a meta viewport (`width=device-width, initial-scale=1.0`)
continua no `<head>`, e que os handlers de toque (long-press pra arrastar
card/coluna no celular — ver `addTouchDnD` e funções irmãs) continuam
intactos. Este passo é só um spot-check de regressão, não um redesenho —
esse comportamento já foi construído com cuidado (ver dica "Arrastar card
no celular" na Central de Ajuda in-app).

## Passo 9 — Verificar antes de considerar seguro pra commit

Depois de qualquer correção (dedup de asset, preconnect, etc.), rode os
dois checks já estabelecidos neste repo:

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('kanban-dev.html', 'utf8');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach((s, i) => { fs.writeFileSync('/tmp/_opt_check_'+i+'.js', s); });
"
for f in /tmp/_opt_check_1.js /tmp/_opt_check_2.js; do node --check "$f"; done
# bloco 0 SEMPRE falha por causa do mesmo artefato de comentário do Passo 1 — ignore.
# qualquer OUTRO bloco precisa passar limpo.

node -e "
const fs = require('fs');
const html = fs.readFileSync('kanban-dev.html', 'utf8');
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
const o=(styles.match(/\{/g)||[]).length, c=(styles.match(/\}/g)||[]).length;
console.log('open:',o,'close:',c,'balanced:',o===c);
"
```

## Passo 10 — Fluxo de release

Siga o processo já documentado no `CLAUDE.md` ("Release process"):

1. Aplique a correção só no `kanban-dev.html` — **nunca edite
   `kanban.html` diretamente**.
2. Bump da versão: `<div class="version">` dentro do HTML + a chave
   `kanban_dev` em `version.json`.
3. Entrada nova no `CHANGELOG.md`, sob `## kanban-dev.html (ambiente de
   teste)` — separe claramente **o que foi corrigido agora** de
   **grandes oportunidades sinalizadas mas não implementadas** (ex.:
   externalizar o script principal — sempre mencionar como recomendação
   futura que precisa de aprovação, nunca implementar de bandeja).
4. `git add` dos arquivos certos (inclusive qualquer asset novo extraído,
   tipo `favicon.png`).
5. `git fetch origin main && git rebase origin/main` — o `main` deste
   repo avança com frequência, sempre reconfira antes de empurrar.
6. `git diff origin/main --stat` — confirme que só os arquivos esperados
   mudaram.
7. `git push -u origin <branch-atual>`.
8. Abra PR (nunca faça self-merge).

A promoção pra produção (`kanban.html`) é uma etapa **separada e
posterior**, que só acontece depois de validação explícita do usuário —
não faz parte desta rotina por padrão, a menos que peçam.

## Resumo do que já foi encontrado (histórico, pra não repetir trabalho)

Rodada limpa = todos os 10 checks (asset duplicado, tamanho dos blocos,
**leitura do Firebase filtrando de verdade (Passo 4.1, a partir de
2026-09-11)**, setInterval/clearInterval pareados, backdrop-filter,
preconnect, import modular do Firebase, asset fora do favicon,
viewport/touch, sintaxe+brace balance) conferidos sem achado, só
registrando o baseline atual pra próxima rodada comparar.

- **v8.30.332-dev (origem)**: achado real — favicon/logo/ícone PWA
  embutidos 4x como base64 (~75KB redundantes), extraído pra
  `favicon.png`. Preconnect adicionado. Import do Firebase já modular.
- **v8.30.354-dev**: limpa. Baseline: CSS ~174KB, script ~1.13MB
  (24961 linhas), 14/14 timers, 29 `backdrop-filter`.
- **v8.30.426-dev (2026-08-14)**: achado real — preconnect pro
  `www.gstatic.com` ficou órfão depois do SDK do Firebase ser
  vendorizado localmente; removido + comentário corrigido. Baseline:
  script ~1.28MB (27500 linhas), 14/12 timers, 31 `backdrop-filter`.
- **v8.30.439-dev (2026-08-20)**: limpa. Baseline: script ~1.30MB
  (27888 linhas), 14/12 timers, 31 `backdrop-filter`.
- **v8.30.458-dev (2026-08-24)**: achado informativo (não bug) — novo
  timer `window._colTagPoll` (re-sync de columns/tags a cada 60s, com
  guard contra polling duplicado) subiu a contagem pra 15/14, dentro
  do padrão esperado (vida inteira da sessão). Baseline: script
  ~1.34MB (28442 linhas), 31 `backdrop-filter`.
- **v8.30.492-dev (2026-08-27)**: limpa. Baseline: script ~1.39MB
  (29303 linhas), 15/14 timers, 31 `backdrop-filter`.
- **v8.30.504-dev (2026-08-29)**: limpa. Baseline: script ~1.40MB
  (29486 linhas), 15/14 timers, 31 `backdrop-filter`.
- **v8.30.594-dev (2026-09-06)**: limpa. Crescimento de timers (15/14→
  17/15) e `backdrop-filter` (31→33) proporcional a features legítimas
  do período (Timeline, OKR, orquestrador do Agente Ágil, tempo em
  atraso/bloqueado) — nenhum leak/órfão real encontrado nos 2 novos
  timers checados individualmente. Baseline: HTML total 2.033.748 bytes
  (32508 linhas), CSS ~212.5KB, script principal ~1.595MB, 17/15
  timers, 33 `backdrop-filter`, zero `data:image` embutido.

- **v8.30.629-dev (2026-09-11)**: limpa. Crescimento de timers (17/15→
  18/17) e `backdrop-filter` (33→34) proporcional a features legítimas
  do período (tema automático, board em branco pós-login, race
  conditions em `functions/`, OKR — todas rastreadas individualmente:
  `_themeAutoInterval` — pareado certinho — e um `waitFb` novo que se
  autolimpa no próprio callback, sem leak). Baseline: HTML total
  2.156.026 bytes (34293 linhas), CSS ~217KB, script principal
  ~1.70MB, 18/17 timers, 34 `backdrop-filter`, zero `data:image`
  embutido.

- **2026-09-11 (retroativo)**: a rodada v8.30.629-dev acima foi marcada
  "limpa" usando o checklist de 9 passos que existia até então — horas
  depois, uma investigação de consumo FORA desta skill achou o bug de
  `comunicados` (~181MB/30 dias). Não é um erro da rodada em si (os 9
  passos de então cobriram tudo que se propunham a cobrir) — é um gap de
  ESCOPO da skill, corrigido agora com o Passo 4.1 (leitura do Firebase).
  Rodadas anteriores a esta data não foram reauditadas retroativamente
  contra o Passo 4.1 — se for reabrir uma área antiga, vale rodar esse
  passo nela mesmo que já tenha sido marcada "limpa" antes.

- **2026-09-11, 1ª validação real do Passo 4.1 (pedido explícito: "roda o
  passo novo numa área antiga pra validar")**: achado real, não em código
  recente — `loadNotifs()` (kanban-dev.html, feature existe desde
  v8.30.64-dev) e `loadPainelNotifs()` (painel-dev.html, mesmo node)
  mantinham `onValue` sempre ligado em
  `kanban/usuarios/{uid}/notificacoes` sem filtro server-side, baixando o
  node inteiro a cada mudança. Diferente de `comunicados`, não era bug
  (nenhuma query silenciosamente falhando) — era um filtro nunca
  tentado, e o node é auto-limitado por TTL (não cresce sem fim). Fix
  Fase 1 (`query()+limitToLast(80)`, sem mudar schema) nos 2 leitores —
  dev v8.30.640-dev / painel-dev v3.42. Fase 2 (campo `expiraEm`
  indexável, filtro exato) documentada como recomendação futura — exige
  migração de dado existente + Cloud Function de limpeza nova, fora do
  escopo desta rodada. Confirma que o Passo 4.1 funciona em área antiga,
  não só no caso que motivou sua criação.
  **Correção no mesmo dia** (usuário rodou o teste de console entregue e
  reportou `❌`): a 1ª versão do fix ordenava por `orderByKey()`,
  assumindo que todo id de notificação começa com `'n'+timestamp` — falso,
  `createNotif()` aceita `idOverride` determinístico
  (`due_today_`/`due_overdue_`/`mention_`/`reuniao-`/`rascunho_`, nenhum
  com esse prefixo), então essas notificações caíam sistematicamente fora
  do `limitToLast(80)` mesmo sendo recentes. Trocado pra
  `orderByChild('ts')` (ISO 8601, gravado por todo ponto de escrita,
  lexicograficamente ordenável = cronologicamente ordenável) — dev
  v8.30.641-dev / painel-dev v3.43. **Lição pra próxima vez**: ao usar
  `limitToLast`/`orderByKey` como proxy de "mais recente" por causa do
  formato do id, confirmar que TODO gerador de id no arquivo (não só o
  mais comum) segue o mesmo formato — `grep` por todo `idOverride`/id
  customizado antes de assumir um prefixo único, mesma disciplina que já
  vale pra "grep por todo call site" nas outras técnicas desta skill/do
  `/monitorarbugs`.

Atualize esta seção a cada rodada nova (1-3 linhas: versão, achado ou
"limpa", baseline atual) — evita re-analisar do zero algo já checado.
