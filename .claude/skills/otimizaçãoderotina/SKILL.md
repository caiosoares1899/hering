---
name: otimizaçãoderotina
description: Audita o código do Maré Digital (kanban.html/kanban-dev.html, e por extensão painel.html se pedido) em busca de oportunidades reais de otimização de bytes de download, performance e mobile — sem alterar a arquitetura de página única self-contained do projeto. Use sempre que o usuário pedir para "otimizar o código", "revisar performance do board", "economizar bytes/download", "deixar o board mais rápido", "otimização para mobile", "rotina de otimização", ou pedir pra rodar essa rotina de novo — mesmo que a frase não mencione "kanban" ou "bytes" explicitamente (ex.: "o board tá pesado", "dá uma olhada se tem gordura pra cortar no código").
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
rede de graça, e apontar leaks/ineficiências concretas — tudo que reduz
download/trabalho do navegador sem mudar como o app é estruturado ou como
ele se parece.

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

- **v8.30.332-dev**: favicon/logo/ícone PWA embutidos 4x como base64
  (~75KB redundantes) — extraído pra `favicon.png`. `<link
  rel="preconnect">` adicionado pros domínios de fonte/Firebase. Import
  do Firebase já era modular (nada a fazer). `setInterval`/`clearInterval`
  já pareciam bem pareados na auditoria manual. Split do script principal
  em arquivo externo foi sinalizado como oportunidade futura, não
  implementado (contraria a arquitetura self-contained).

- **v8.30.354-dev / v8.30.236 (prod)**: rodada limpa, nada pra corrigir.
  kanban.html e kanban-dev.html tinham acabado de sincronizar (mesma
  base de código, só a versão diverge) depois de um lote grande de
  trabalho no supercard/fan-out — nenhum asset novo, nenhum vazamento
  novo. Conferido em detalhe:
  - `data:image` embutido: 0 ocorrências nos dois arquivos (fix da
    v8.30.332-dev continua valendo).
  - Blocos reais do arquivo (por linha, não regex ingênuo): CSS
    principal ~174KB, script módulo Firebase ~7KB, script principal
    ~1.13MB (`kanban-dev.html`, 24961 linhas, 1.49MB total).
  - `setInterval`/`clearInterval`: 14/14 nos dois arquivos. Rastreado
    caso a caso — 9 timers com clear pareado (alguns com guard
    "clear antes de re-setar" + o stop de verdade, por isso mais
    clears que sets em alguns) e 5 timers intencionalmente "vida
    inteira da sessão" (poll de versão/kudos/presença/lembrete de
    reunião/sino) sem clear — bate exatamente com o padrão esperado,
    zero vazamento novo.
  - `backdrop-filter`: 29 ocorrências (novo baseline pra próxima
    rodada comparar — informativo, não é problema).
  - Preconnect (fonts.googleapis/fonts.gstatic/www.gstatic) e
    `display=swap`: presentes. Import do Firebase: modular (app/
    database/auth/messaging, sem Firestore/Storage/Analytics).
  - Imagem referenciada fora do favicon: só `marinheiro.png` (ícone de
    notificação do browser, carregado sob demanda — já é o
    comportamento correto, sem ação).
  - Viewport meta + `addTouchDnD` (drag por toque no celular):
    intactos, sem sinal de regressão.

Atualize esta seção a cada rodada nova, com a versão e o que foi
encontrado/corrigido — isso evita re-analisar do zero algo que já foi
checado e está limpo.
