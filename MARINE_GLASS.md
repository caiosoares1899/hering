# Marine Glass — Manual de Marca & Sistema de Design

Referência para aplicar a identidade visual **Marine Glass** em qualquer peça —
apresentações, artes para WhatsApp, telas de ferramentas internas, onboarding,
dashboards. Não é o manual de um app específico: é o manual do *estilo* que
várias construções do time já usam (Maré Digital, Painel, Radar, Oceano, Escala,
Intake, A Bordo) e que deve se manter reconhecível em qualquer coisa nova.

> **Fonte de verdade:** os valores abaixo foram conferidos no código de
> `oceano.html` e `kanban.html` (17/10/2026). Se o código mudar, o código ganha —
> e este manual é atualizado. O **raciocínio de design** (por que cada coisa é
> assim, como montar uma tela) está em [`docs/GUIA_UI_UX.md`](docs/GUIA_UI_UX.md);
> o **código** (armadilhas de JS/CSS) em `docs/GUIA_DE_CODIGO.md`.

**Neste documento:** 1 O que é · 2 Princípios · 3 Paleta e temas · 4 Vidro ·
5 Peixinhos e bolhas · 6 Tipografia · 7 Emojis · 8 Tom de voz · 9 Onde já foi
aplicado · 10 Prompt-modelo · 11 Movimento e acessibilidade · 12 Receita CSS
pronta · 13 Checklist e erros comuns.

## 1. O que é o Marine Glass

Um sistema visual de **"vidro sobre oceano"**: fundo escuro e profundo com
camadas de gradiente radial simulando água, e superfícies translúcidas com
efeito de vidro fosco (glassmorphism) flutuando por cima. Em peças mais
"vivas" (produtos interativos), o oceano ganha peixinhos e bolhas animados no
fundo; em peças estáticas (slides, artes, cards), o mesmo princípio de
profundidade e translucidez se mantém mesmo sem animação.

A identidade não é "um tema escuro com efeito de vidro" genérico — é
especificamente **aquática**: cor, nomenclatura, textura e até o tom de voz
remetem a mar, correnteza, profundidade. Isso é o que faz peças diferentes (um
board, um card de WhatsApp, um slide) parecerem "da mesma família" mesmo sendo
formatos totalmente diferentes.

**Em uma frase para quem for criar algo:** *fundo de água, blocos de vidro,
peixinhos discretos, Syne nos títulos, DM Sans no resto, emoji como ícone, fala
de colega.*

## 2. Os dois princípios inegociáveis

Qualquer peça nova em Marine Glass precisa ter, no mínimo, estes dois
elementos — é o que garante reconhecimento de marca:

- **Fundo oceânico**: nunca um fundo sólido plano. Sempre camadas — pode ser
  gradiente radial simulando profundidade, pode ser uma cor sólida escura com
  um leve degradê de canto, mas sempre com sensação de profundidade/água.
- **Superfícies em vidro fosco**: qualquer bloco de conteúdo (card, painel,
  texto em destaque) fica sobre um fundo translúcido com blur — nunca sólido
  opaco, nunca sem borda sutil. É esse contraste vidro-sobre-água que cria a
  sensação de profundidade em camadas.

Tudo o mais (peixinhos, bolhas, tipografia, emojis, tom de voz) é reforço da
identidade, mas esses dois pontos são o mínimo pra algo "ser" Marine Glass.

Dois **cuidados** que acompanham os princípios (detalhes na seção 11): o
movimento é sempre *opcional e respeitoso* (a pessoa desliga; quem pede menos
movimento não recebe) e o **conteúdo vem primeiro** — o oceano é cenário, nunca
disputa com o texto.

## 3. Paleta de cores e temas

Os temas têm nome de paisagem brasileira/aquática — nunca "dark/light"
genérico. Use os nomes ao se referir aos temas, inclusive em texto de
interface (reforça a identidade).

| Tema | Quando | Como ativa |
|---|---|---|
| 🌙 **Abrolhos** | escuro, **padrão** | sem atributo |
| ☀️ **Lençóis Maranhenses** | claro | `data-theme="light"` (chave `mare_theme`, a mesma em todas as páginas) |
| 🌅 **Entardecer** | opcional, só no Oceano | `data-theme="sunset"` |
| 🌴 **Vice City** | tema extra do Maré (menu de tema) | `data-theme="vice"` |
| 🏷️ **Black Friday** | sazonal do Maré (experimental, clique direito no botão de tema) | `data-theme="blackfriday"` |

**Regra de ouro válida para todos os temas:** nada de branco ou preto puro em
nenhuma superfície. Tudo tem uma fração de azul (ou, nos temas quentes, do tom
do tema) — é o que faz uma peça "parecer que faz parte da água" mesmo em fundo
claro. O mínimo de uma peça nova é Abrolhos + Lençóis.

### 🌙 Abrolhos (tema escuro — padrão)

```css
--deep:#030d1a;  --deep-rgb:3,13,26;           /* base da página */
--glass:rgba(10,37,64,.6);                     /* = rgba(var(--glass-rgb),.6) no Maré */
--glass-b:rgba(56,182,255,.18);                /* borda do vidro */
--glass-h:rgba(56,182,255,.10);                /* hover (o Oceano não usa; Maré/Painel/Radar sim) */
--blue:#2563c9;  --accent:#38b6ff;  --cyan:#7ec8e3;  --teal:#1de9b6;
--txt:#e8f4fd;   --txt2:rgba(200,230,255,.65);  --txt3:rgba(150,200,240,.40);
--warn:#ffd166;  --danger:#ff6b6b;  --ok:#4ade80;
--r:10px;  --r2:14px;                           /* raios: controles / cards */
--shadow:0 10px 34px rgba(0,0,0,.35);
```

Fundo oceânico (variável `--ocean`, aplicada numa camada `position:fixed; inset:0; z-index:-3`):

```css
--ocean:
  radial-gradient(ellipse at 20% 80%, rgba(0,80,160,.4) 0%, transparent 60%),
  radial-gradient(ellipse at 80% 20%, rgba(0,150,180,.25) 0%, transparent 55%),
  #010810;
```

### ☀️ Lençóis Maranhenses (tema claro)

```css
--deep:#0F87C4;  --deep-rgb:15,135,196;
--glass:rgba(255,255,255,.55);   --glass-b:rgba(0,124,168,.28);   --glass-h:rgba(0,124,168,.16);
--blue:#0077AD;  --accent:#0077AD;  --cyan:#065670;  --teal:#33D6D0;   /* Oceano usa #0a8f86 no teal (texto sobre claro) */
--txt:#0B2436;   --txt2:rgba(11,36,54,.72);  --txt3:rgba(11,36,54,.50);
--warn:#F6B73C;  --danger:#F15B6C;
--surface-rgb:251,253,255;       /* cards: "duna branca" — nunca branco puro */
--shadow:0 10px 30px rgba(7,70,110,.22);
--ocean:
  radial-gradient(ellipse at 20% 80%, rgba(0,183,180,.30) 0%, transparent 62%),
  radial-gradient(ellipse at 80% 15%, rgba(0,151,214,.30) 0%, transparent 58%),
  linear-gradient(175deg,#57C4E0 0%,#0F87C4 100%);
```

No Maré há uma variante **mais escura** do claro (duplo clique no botão de
tema). A leitura do fundo claro foi ajustada em várias rodadas de feedback do
time ("tá muito claro"): em peça nova, **prefira o azul de `--deep` acima ao
branco-azulado** e confira o contraste do texto (`--txt` sobre `--glass`).

### 🌅 Entardecer (opcional — só no Oceano)

```css
--deep:#1a1530;  --glass:rgba(38,28,58,.62);  --glass-b:rgba(255,176,110,.26);
--blue:#c4642f;  --accent:#ffb36b;  --cyan:#ffd2a1;  --teal:#ffcf6e;
--txt:#fdf1e4;   --txt2:rgba(253,241,228,.72);
--ocean: radial-gradient(ellipse 80% 45% at 50% 38%, rgba(255,160,70,.5) 0%, rgba(255,120,60,.16) 45%, transparent 70%),
         linear-gradient(180deg,#141d3f 0%,#2a2a55 22%,#7a4a56 38%,#d98a58 47%,#1b4a63 48.4%,#0d2f4b 62%,#071c33 100%);
```
O gradiente desenha **um horizonte** (céu, sol, linha d'água a 47–48 %): é a
referência de como um tema quente continua sendo "mar".

### 🌴 Vice City e 🏷️ Black Friday (temas do Maré)
Mesmo esqueleto de tokens, outra paleta: **Vice** — `--deep:#2f1930`, `--accent:#E59F7C`,
borda `rgba(197,97,95,.35)`, fundo em degradê roxo→laranja→vinho; **Black Friday** —
`--deep:#0a0807`, `--accent:#b3665f`, `--danger:#ff2b4d`, borda `rgba(255,43,77,.16)`
(esconde a silhueta do peixe e usa outra no lugar). Tema sazonal **troca a cor e o
fundo, nunca a estrutura**: vidro, tipografia, raios e sombra continuam iguais.

Variações mais simples (uma peça estática, um card, um slide) podem usar só
um subconjunto da paleta — mas sempre dentro dessa família de azuis/teals,
nunca cores fora dela sem justificativa forte.

**Cor significa coisa:** `--ok` verde = sucesso/no prazo; `--warn` amarelo =
atenção/risco; `--danger` vermelho = erro/atrasado/bloqueado; `--accent` azul =
ação e foco; `--teal` = destaque positivo e métrica viva. Não use vermelho
decorativo nem verde como "cor bonita" — a pessoa lê cor como status.

## 4. O efeito de vidro (regra de aplicação universal)

Todo elemento "flutuante" — card, caixa de texto, botão, bloco de destaque —
segue a mesma receita, ajustando só a intensidade do blur pela "altura" do
elemento na composição:

```css
background: var(--glass);
border: 1px solid var(--glass-b);
border-radius: var(--r) a var(--r2);     /* 10px a 14px */
backdrop-filter: blur(8px a 18px);
```

| Tipo de elemento | Blur | Raio |
|---|---|---|
| botão, chip, tag | 8px | `--r` (10px) ou pílula `999px` (chips) |
| card, painel, coluna | 12–14px | `--r2` (14px) |
| modal, overlay, tela cheia | 16–18px | `--r2` |

**Escada de elevação (do fundo para a frente):** oceano (`z-index:-3`) →
bolhas (`-2`) → peixinhos (`-1`) → conteúdo (0) → vidro (cards) → modais.
Cada degrau a mais = *um pouco* mais de blur e sombra (`--shadow`), nunca uma
cor nova.

**Estados do vidro:** repouso (`--glass` + `--glass-b`) → hover (`--glass-h` ou
borda mais viva, `transition: .2s`) → foco (anel `2px solid var(--accent)` com
`outline-offset:2px`, sempre visível por teclado, `:focus-visible`) → selecionado
(fundo `--accent` a ~18 % + borda `--accent`) → desabilitado (opacidade, nunca
cinza chapado).

**Custo:** `backdrop-filter` pesa na GPU do celular. **Não empilhe vidro dentro
de vidro dentro de vidro** (card dentro de painel dentro de modal): o de dentro
usa fundo translúcido *sem* blur próprio. Em listas longas, só o contêiner tem blur.

Em ferramentas que não suportam `backdrop-filter` (alguns editores de slide,
geradores de imagem estática), simule o efeito com uma camada
semi-transparente clara/escura + sombra suave — o efeito visual de "vidro" é
o objetivo, a técnica CSS é só um dos jeitos de chegar lá.

## 5. Peixinhos e bolhas — quando usar e **como são de verdade**

Elemento de assinatura, mas **opcional conforme o formato**. A implementação de
referência é a do **Oceano** (`oceano.html`, `FISH_SVGS` + `criarPeixes()`) —
a mesma do Maré Digital. Em qualquer dúvida, **copie de lá**, não reinvente a
silhueta.

### Os três peixinhos (silhuetas oficiais)

Três tamanhos e três cores, todos no mesmo desenho: **cauda triangular + corpo em
elipse com contorno fino + um olho**. Sempre translúcidos (preenchimento ~10–22 %,
contorno ~25–32 %, olho ~50 %).

```html
<!-- 1 · azul (--accent) · médio, 60×28 -->
<svg viewBox="0 0 60 28" width="60" height="28" xmlns="http://www.w3.org/2000/svg"><polygon points="0,4 14,14 0,24" fill="rgba(56,182,255,.22)"/><ellipse cx="34" cy="14" rx="22" ry="9" fill="rgba(56,182,255,.15)" stroke="rgba(56,182,255,.32)" stroke-width="1"/><circle cx="47" cy="11" r="2.5" fill="rgba(56,182,255,.55)"/></svg>
<!-- 2 · teal (--teal) · pequeno, 42×22 -->
<svg viewBox="0 0 42 22" width="42" height="22" xmlns="http://www.w3.org/2000/svg"><polygon points="0,3 12,11 0,19" fill="rgba(29,233,182,.2)"/><ellipse cx="26" cy="11" rx="15" ry="8" fill="rgba(29,233,182,.12)" stroke="rgba(29,233,182,.28)" stroke-width="1"/><circle cx="36" cy="8" r="2" fill="rgba(29,233,182,.5)"/></svg>
<!-- 3 · cyan (--cyan) · grande, 72×34 -->
<svg viewBox="0 0 72 34" width="72" height="34" xmlns="http://www.w3.org/2000/svg"><polygon points="0,5 16,17 0,29" fill="rgba(126,200,227,.2)"/><ellipse cx="42" cy="17" rx="27" ry="12" fill="rgba(126,200,227,.1)" stroke="rgba(126,200,227,.25)" stroke-width="1"/><circle cx="57" cy="13" r="3" fill="rgba(126,200,227,.48)"/></svg>
```

O peixe **nada com a cabeça para a direita** no desenho original (olho à direita da
elipse); para ir da direita para a esquerda, o contêiner é espelhado
(`scaleX(-1)`), nunca o SVG redesenhado.

### Bolhas
Círculos de **3 a 17 px**, borda `1px rgba(56,182,255,.2)` e preenchimento radial
(`radial-gradient(circle at 35% 35%, rgba(56,182,255,.25), rgba(0,229,255,.05))`),
subindo do rodapé (`bottom:-40px`) até além do topo.

### Movimento (CSS)
```css
.fish-wrap,.bubble-wrap{position:fixed;inset:0;pointer-events:none;overflow:hidden;}
.bubble-wrap{z-index:-2;}  .fish-wrap{z-index:-1;}      /* sempre ATRÁS do conteúdo, nunca recebem clique */
.fish-ltr{position:absolute;animation:swimLTR linear infinite;}
.fish-rtl{position:absolute;animation:swimRTL linear infinite;}
@keyframes swimLTR{0%{transform:translateX(-140px)} 100%{transform:translateX(calc(100vw + 140px))}}
@keyframes swimRTL{0%{transform:translateX(calc(100vw + 140px)) scaleX(-1)} 100%{transform:translateX(-140px) scaleX(-1)}}
.bubble{position:absolute;bottom:-40px;border-radius:50%;animation:rise linear infinite; /* + borda e radial-gradient acima */}
@keyframes rise{0%{transform:translateY(0);opacity:0} 10%{opacity:.8} 90%{opacity:.3} 100%{transform:translateY(-110vh);opacity:0}}
[data-theme="light"] .fish-wrap,[data-theme="light"] .bubble{filter:brightness(2.3) saturate(.5) drop-shadow(0 0 3px rgba(0,35,55,.4));}   /* no claro, "acende" a silhueta */
[data-anim-paused] .fish-ltr,[data-anim-paused] .fish-rtl,[data-anim-paused] .bubble{animation-play-state:paused;}
@media (prefers-reduced-motion:reduce){.fish-ltr,.fish-rtl,.bubble{animation:none!important;}}
```

### Quantidade, velocidade e aleatoriedade
- **Desktop: 8 peixes e 16 bolhas. Celular (`max-width:768px`): 4 e 8.** Modo "poucos" = metade.
- Peixes alternam os três desenhos (`i % 3`), sentido sorteado (`ltr`/`rtl`), altura
  `5%–85%` da tela, **duração 14–38 s**, atraso negativo aleatório (já "no meio do
  caminho" ao carregar).
- Bolhas: tamanho `3–17px`, posição horizontal aleatória, duração `8–26 s`, atraso negativo.
- A página **pausa** tudo com a aba escondida (`visibilitychange` →
  `data-anim-paused`).

```js
function criarPeixes(){            // o mesmo do Oceano
  const fw=$('#fwrap'), bw=$('#bwrap'); fw.innerHTML=''; bw.innerHTML='';
  if(prefs.peixes==='off') return;
  const mobile=matchMedia('(max-width:768px)').matches, fator=prefs.peixes==='poucos'?.5:1;
  const nF=Math.max(2,Math.round((mobile?4:8)*fator)), nB=Math.max(4,Math.round((mobile?8:16)*fator));
  for(let i=0;i<nF;i++){ const f=document.createElement('div'); f.className=Math.random()>.5?'fish-ltr':'fish-rtl';
    f.style.top=(5+Math.random()*80)+'%'; f.style.animationDuration=(14+Math.random()*24)+'s';
    f.style.animationDelay=(-Math.random()*24)+'s'; f.innerHTML=FISH_SVGS[i%FISH_SVGS.length]; fw.appendChild(f); }
  for(let i=0;i<nB;i++){ const b=document.createElement('div'), sz=3+Math.random()*14; b.className='bubble';
    b.style.cssText='width:'+sz+'px;height:'+sz+'px;left:'+(Math.random()*100)+'%;animation-duration:'+(8+Math.random()*18)+'s;animation-delay:-'+(Math.random()*18)+'s;'; bw.appendChild(b); }
}
```

### Controle da pessoa
Peixinhos e bolhas têm **3 modos**: *Desligados* (mar calmo) · *Poucos* (um cardume
discreto) · *Como no Maré* (8 e 16). No Maré o liga/desliga é `fish_bg_off` no
`localStorage`; no Oceano é a preferência `peixes` (em ⚙ Meu perfil). Quem tem
"reduzir movimento" no sistema **começa com os peixes desligados**. Produto novo com
peixes **precisa** oferecer o liga/desliga.

### Em peças estáticas (slide, arte de WhatsApp, card de convite)
Não dá pra animar, então os peixinhos viram **elemento gráfico fixo**: use as
**mesmas três silhuetas** acima (não invente outra), espalhadas no fundo, paradas,
**2–4 no máximo**, uma de cada cor se possível, em tamanhos diferentes e alturas
diferentes, nadando na mesma direção ou em direções opostas (espelhe o SVG), nunca
sobre o texto principal. Bolhas: 3–6 círculos pequenos subindo em diagonal suave,
opacidade baixa.

### Em peças muito minimalistas
Um único CTA, uma citação: pode-se omitir os peixinhos e manter só o fundo
oceânico + vidro — ainda é reconhecível como Marine Glass pelos dois princípios da
seção 2.

### Erros comuns com peixinhos
- Redesenhar o peixe (barbatana, listras, boca) ou usar emoji 🐠 no lugar da silhueta.
- Peixe **opaco** ou saturado demais: ele é textura, não personagem (🐟 como emoji
  é a *marca*; a silhueta é o *cenário*).
- Esquecer `pointer-events:none` (o peixe come o clique) ou colocar o peixe **acima**
  do conteúdo.
- Não tratar o tema claro (some no azul — por isso o `filter` acima) nem o
  `prefers-reduced-motion`.
- Mais de ~8 peixes no desktop ou sem metade no celular: pesa a GPU/bateria.

## 6. Tipografia

| Fonte | Uso |
|---|---|
| **Syne** (peso 700–800) | Títulos, chamadas, números de destaque — a fonte "de impacto" (`--ff-d`) |
| **DM Sans** (400–700) | Corpo de texto, legendas, botões, rótulos — a fonte "de leitura" (`--ff`) |
| **JetBrains Mono / Space Mono** | Só código, ids, contadores técnicos |

Vale pra qualquer formato: um slide de apresentação deve usar Syne no título
do slide e DM Sans no corpo, exatamente como uma tela de produto usa Syne no
header e DM Sans no resto.

Carregamento (idêntico nas páginas do ecossistema):
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
```
```css
--ff-d:'Syne','DM Sans',sans-serif;   --ff:'DM Sans',system-ui,sans-serif;
```
**Escala prática:** títulos de seção Syne 700–800 (18–28 px na tela, maiores em
slide); rótulos e botões DM Sans 11–13 px/600; corpo 13–14 px; legenda/apoio 10–11 px
em `--txt2`/`--txt3`. Número grande de métrica = Syne, **tabular** quando muda ao vivo.

## 7. Emojis como linguagem, não decoração

Em qualquer peça Marine Glass — interface, mensagem, texto de apresentação —
o emoji funciona como **ícone semântico fixo**, sempre o mesmo emoji para a
mesma categoria, sempre no início da frase/label:

| Emoji | Significado |
|---|---|
| ✅ | sucesso / confirmação |
| ⚠️ | atenção |
| ❌ | erro / negativo |
| 🔒 | restrito / privado |
| 🤖 | IA / automação |
| 🌙 / ☀️ | tema escuro / claro |
| 🐟 | identidade da marca / elemento vivo |
| 🔔 | sino / notificações |
| 💡 | dica |
| 🐛 | bug |
| 🛟 | Plantão de Bugs (pedido de ajuda) |
| 🎯 | meta / objetivo |

**Os produtos têm emoji fixo** (use sempre o mesmo, no início do nome): 🐟 Maré Digital ·
🧭 Painel · 📡 Radar · 🌊 Oceano · 📅 Escala · 📥 Intake/Pedido · 🎙️ apresentação
ao vivo · 🧳 Travessia (futuro). O **A Bordo** usa o logo próprio (o convés), sem emoji fixo.

Em peças estáticas (slide, card), isso vira também recurso gráfico: o 🐟 pode
aparecer como "logo informal" no canto, e emojis de categoria ajudam a
escanear bullets rapidamente. **Emoji novo só para categoria nova** — nunca um
segundo emoji para algo que já tem um; e nunca como enfeite solto no meio da frase.

## 8. Tom de voz

Direto, curto, conversacional — como alguém do time avisando algo, nunca como
texto de sistema corporativo genérico. Vale para toast de interface, texto de
slide, legenda de card.

Características:
- Frases curtas, com a contração natural do português falado quando cabe
- Explica a consequência prática de algo, não só o status ("a resposta chega
  como comentário no card", não só "enviado")
- Nunca é seco/técnico demais nem infantilizado

**A metáfora do mar mora nos nomes e na microcopy, não na bagunça do dado.** Pode
chamar a meta de *"O mar tá pra peixe"*, a projeção de *volta fantasma*, o tema de
*Abrolhos*; **não** pode torcer um número, trocar o rótulo de um status ou esconder
um erro atrás de uma piada. Em erro, bloqueio e permissão, o texto é claro primeiro
e simpático depois.

Exemplos reais do ecossistema:
- ✅ Descrição salva!
- 🔒 Seleção múltipla disponível para ADM, PO e Organizadores.
- ⚠️ Não deu pra confirmar o salvamento (conexão instável) — o card continua
  aberto, tente salvar de novo.
- 🐟 O mar tá pra peixe — faltam 12 % pra bater a meta do mês.

## 9. Onde já foi aplicado (referência)

Todas as páginas abaixo usam os **mesmos tokens** (seção 3) e a mesma receita de vidro:

- **Maré Digital** (`kanban.html`) — versão mais completa e animada: 4 temas (+ automático por horário),
  peixes, bolhas, card-modal, quadro, gráficos
- **Painel** (`painel.html`), **Radar** (`okr.html`, + `okr-apresentacao.slide.html`),
  **Escala** (`escala.html`), **Intake** (`intake.html`) — mesma base, densidade de
  ferramenta de trabalho
- **Oceano** (`oceano.html`) — o lobby: **implementação de referência dos
  peixinhos**, 3 temas (Abrolhos, Lençóis, Entardecer), janela de vidro "porthole"
  (avatar circular com borda de vidro), Mural
- **`onboarding.html`** (A Bordo) — versão para apresentação/onboarding com cards
  ao vivo (Firebase), mesma paleta de vidro sobre oceano, sem peixinhos
- **Documentos visuais:** `ecossistema.html`, `maredigital.html`, `guia-okr.html`
  (slides) — vidro e tipografia, peixes estáticos
- *Bolão Copa do Mundo 2026* foi uma aplicação lúdica do sistema, **fora deste repositório**

Cada aplicação prova que o sistema funciona fora do board original — é isso
que o torna um sistema de marca, não uma feature de um produto só.

## 10. Prompt-modelo (para gerar qualquer peça em Marine Glass)

Use este prompt como base — ajuste o trecho `[O QUE VOCÊ PRECISA]` pro
formato desejado (slide, card de WhatsApp, wireframe de tela, arte para post,
etc.):

```
Crie [O QUE VOCÊ PRECISA] seguindo o sistema de design "Marine Glass":

CONCEITO: identidade visual "vidro sobre oceano" — fundo escuro e
profundo simulando água, com blocos de conteúdo em vidro fosco
(glassmorphism) flutuando por cima. Nunca use fundo sólido plano nem
superfícies 100% opacas — a sensação de profundidade em camadas é o
ponto central do estilo.

FUNDO (tema escuro "Abrolhos", padrão):
- base quase-preta #030d1a a #010810
- duas manchas de gradiente radial suaves: azul (~#0050A0) num canto
  inferior-esquerdo, teal-azulado (~#0096B4) no canto superior-direito,
  ambas esmaecendo pra transparência

TEMA CLARO alternativo "Lençóis Maranhenses": fundo azul-céu #0F87C4
(degradê de #57C4E0 para #0F87C4), superfícies quase brancas mas nunca
100% branco puro (sempre com leve tom azulado). Texto #0B2436.

VIDRO (qualquer card/bloco de destaque):
- fundo translúcido azul-escuro rgba(10,37,64,0.6) [ou branco
  translúcido rgba(255,255,255,0.55) no tema claro]
- borda sutil rgba(56,182,255,0.18) [rgba(0,124,168,0.28) no claro]
- efeito de blur/desfoque por trás do bloco (backdrop-filter blur
  8-18px, ou simulado com transparência + sombra se a ferramenta não
  suportar blur)
- cantos arredondados (10-14px)

CORES DE DESTAQUE: azul #38b6ff, cyan #7ec8e3, teal #1de9b6. Sucesso
#4ade80, aviso #ffd166, erro/negativo #ff6b6b. Texto principal
quase-branco levemente azulado (#e8f4fd no escuro / #0B2436 no claro).
Cor é status: nada de vermelho ou verde decorativos.

TIPOGRAFIA: "Syne" (peso bold/800) para títulos e números de
destaque; "DM Sans" para corpo de texto e legendas.

ELEMENTO DE ASSINATURA (opcional, se o formato permitir): 2-4
silhuetas translúcidas de peixinho espalhadas discretamente no fundo,
SEMPRE no mesmo desenho — cauda triangular + corpo em elipse com
contorno fino + um olho —, em três cores e tamanhos: azul #38b6ff
(médio), teal #1de9b6 (pequeno) e cyan #7ec8e3 (grande). Preenchimento
~10-22% de opacidade, contorno ~25-32%, olho ~50%. Paradas (ou nadando
bem devagar, se animar) e nunca sobre o texto principal. Pode haver 3-6
bolhas pequenas (3-17px) subindo, bem transparentes.

EMOJIS: use como ícone funcional, não decoração — sempre o mesmo
emoji pra mesma categoria de informação (✅ positivo, ⚠️ atenção, ❌
negativo, 🔒 restrito, 🐟 marca), no início do texto/bullet.

TOM DE VOZ (se houver texto/copy): direto e curto, como alguém do
time avisando algo — nunca formal/corporativo. Prefira frases que
expliquem a consequência prática, não só o status técnico. A
metáfora do mar vale para nomes e microcopy, nunca para esconder
dado ou erro.
```

## 11. Movimento e acessibilidade (o que torna o vidro bom de usar)

- **Reduzir movimento:** `@media (prefers-reduced-motion: reduce)` desliga peixes,
  bolhas e animações decorativas (e os peixes começam desligados). Animação de
  *feedback* (um toast, um foco) pode ficar, curta.
- **Aba escondida:** pause as animações (`data-anim-paused`) — bateria do celular.
- **Contraste:** texto `--txt` sobre `--glass` sempre legível *com o peixe passando
  por trás*; se um tema novo deixa o texto no limite, escureça o vidro, não o texto.
- **Foco visível** por teclado (`:focus-visible`, anel `--accent` de 2 px) em tudo que
  clica; alvo de toque ≥ 44 px no celular.
- **Rolagem:** barra fina e discreta (`scrollbar-width:thin`, cor `rgba(56,182,255,.25)`).
- **Celular:** metade dos peixes/bolhas; blur de 8–12 px nos cards (o de 16–18 px só
  em modal); sem rolagem lateral (largura 390 px é o teste).
- **Tema salvo e lembrado:** a escolha (e o liga/desliga dos peixes) é da pessoa e
  sobrevive ao recarregar.

## 12. Receita CSS pronta (fundo + vidro + peixes, para colar numa página nova)

```html
<div class="ocean"></div>
<div class="bubble-wrap" id="bwrap" aria-hidden="true"></div>
<div class="fish-wrap" id="fwrap" aria-hidden="true"></div>
```
```css
:root{ /* tokens da seção 3 (Abrolhos) + --ocean */ }
:root[data-theme="light"]{ /* tokens do Lençóis */ }
html,body{min-height:100vh;overflow-x:hidden;}
body{font-family:var(--ff);background:var(--deep);color:var(--txt);-webkit-font-smoothing:antialiased;}
.ocean{position:fixed;inset:0;z-index:-3;pointer-events:none;background:var(--ocean);}
.card{background:var(--glass);border:1px solid var(--glass-b);border-radius:var(--r2);backdrop-filter:blur(12px);box-shadow:var(--shadow);}
.btn{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;font-size:13px;font-weight:600;border:1px solid var(--glass-b);border-radius:var(--r);background:var(--glass);color:var(--txt);cursor:pointer;transition:all .2s;backdrop-filter:blur(8px);}
.chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:3px 10px;border-radius:999px;border:1px solid var(--glass-b);background:var(--glass);color:var(--cyan);}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:6px;}
/* + os blocos de peixes/bolhas/animações da seção 5 e o criarPeixes() */
```
O ponto de partida mais fiel é abrir `oceano.html` (uma página só, sem build) e copiar
o que precisa — **não** misture tokens de duas páginas.

## 13. Checklist e erros comuns

**Antes de entregar uma peça, confira:**
- [ ] Fundo em camadas (não sólido) e com a fração de azul — nada de #000/#fff puros
- [ ] Todo bloco de conteúdo em vidro (fundo translúcido + borda sutil + blur)
- [ ] Syne nos títulos e números; DM Sans no resto
- [ ] Emoji semântico no início dos rótulos, sempre o mesmo por categoria
- [ ] Peixinhos: as **três silhuetas oficiais**, translúcidas, atrás do conteúdo, com
      liga/desliga (produto) ou 2–4 fixas (peça estática)
- [ ] Tema claro e escuro testados; celular (390 px) sem rolagem lateral
- [ ] Texto curto, de colega, com a consequência prática
- [ ] Reduzir movimento respeitado

**Erros que já apareceram:**
- Fundo sólido "escuro com vidro por cima" sem profundidade (parece tema escuro genérico)
- Vidro dentro de vidro dentro de vidro (pesa e fica lavado)
- Peixe diferente em cada peça (a silhueta é única — copiar do Oceano)
- Cor decorativa que parece status (vermelho/verde sem significado)
- Branco puro no tema claro; preto puro no escuro
- Tema novo que muda a estrutura (raios, sombra, fonte) em vez de só cor e fundo
- Metáfora do mar escondendo o dado ("tudo azul!" quando há atraso)

---

*Documento baseado no código-fonte real das peças já construídas em Marine
Glass (Maré Digital, Oceano, Painel, Radar, `onboarding.html`), conferido em
17/10/2026. Atualize se a paleta ou as convenções evoluírem em novas peças.*
