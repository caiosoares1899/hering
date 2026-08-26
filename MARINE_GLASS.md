# Marine Glass — Manual de Marca & Sistema de Design

Referência para aplicar a identidade visual **Marine Glass** em qualquer peça —
apresentações, artes para WhatsApp, telas de ferramentas internas, onboarding,
dashboards. Não é o manual de um app específico: é o manual do *estilo* que
várias construções do time já usam (Maré Digital, onboarding, bolão da Copa) e
que deve se manter reconhecível em qualquer coisa nova.

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

**Onde já existe:** Maré Digital (kanban + painel), `onboarding.html` (tela de
apresentação/onboarding com cards ao vivo via Firebase), bolão da Copa do
Mundo 2026. Cada peça adapta a intensidade do efeito ao contexto — mas a raiz
visual é a mesma.

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

## 3. Paleta de cores

Os temas têm nome de paisagem brasileira/aquática — nunca "dark/light"
genérico. Use os nomes ao se referir aos temas, inclusive em texto de
interface (reforça a identidade).

### 🌙 Abrolhos (tema escuro — padrão)

```css
--deep: #030d1a;                              /* base da página */
--glass-rgb: 10,37,64;  --glass: rgba(var(--glass-rgb), .6);
--glass-border: rgba(56,182,255,.18);
--glass-hover: rgba(56,182,255,.1);
--blue:#2563c9;  --accent:#38b6ff;  --cyan:#7ec8e3;  --teal:#1de9b6;
--txt:#e8f4fd;   --txt2:rgba(200,230,255,.65);
--warn:#ffd166;  --danger:#ff6b6b;
```

Fundo oceânico:

```css
background:
  radial-gradient(ellipse at 20% 80%, rgba(0,80,160,.4) 0%, transparent 60%),
  radial-gradient(ellipse at 80% 20%, rgba(0,150,180,.25) 0%, transparent 55%),
  #010810;
```

### ☀️ Lençóis Maranhenses (tema claro)

```css
--deep: #0F87C4;
--surface-rgb: 251,253,255;  /* nunca branco puro — sempre 1-2% de azul */
--glass: rgba(255,255,255,.55);
--blue:#0077AD;  --accent:#0077AD;  --cyan:#065670;  --teal:#33D6D0;
--txt:#0B2436;
```

**Regra de ouro válida pros dois temas:** nada de branco ou preto puro em
nenhuma superfície. Tudo tem uma fração de azul — é o que faz uma peça
"parecer que faz parte da água" mesmo em fundo claro.

Variações mais simples (uma peça estática, um card, um slide) podem usar só
um subconjunto da paleta — mas sempre dentro dessa família de azuis/teals,
nunca cores fora dela sem justificativa forte.

## 4. O efeito de vidro (regra de aplicação universal)

Todo elemento "flutuante" — card, caixa de texto, botão, bloco de destaque —
segue a mesma receita, ajustando só a intensidade do blur pela "altura" do
elemento na composição:

```css
background: var(--glass);
border: 1px solid var(--glass-border);
border-radius: 10px a 14px;
backdrop-filter: blur(8px a 18px);
```

| Tipo de elemento | Blur sugerido |
|---|---|
| botão, chip, tag | 8px |
| card, painel, coluna | 12–14px |
| modal, overlay, tela cheia | 16–18px |

Em ferramentas que não suportam `backdrop-filter` (alguns editores de slide,
geradores de imagem estática), simule o efeito com uma camada
semi-transparente clara/escura + sombra suave — o efeito visual de "vidro" é
o objetivo, a técnica CSS é só um dos jeitos de chegar lá.

## 5. Peixinhos e bolhas — quando usar

Elemento de assinatura, mas **opcional conforme o formato**:

- **Produtos interativos/telas ao vivo** (dashboards, ferramentas, apps): use
  peixinhos e bolhas animados no fundo — SVGs simples (silhueta triangular +
  elipse do corpo + círculo do olho), translúcidos, nadando em velocidades e
  posições aleatórias, sempre atrás do conteúdo e sem interceptar clique.
- **Peças estáticas** (slide, arte de WhatsApp, card de convite): não dá pra
  animar, então os peixinhos viram **elemento gráfico decorativo fixo** —
  silhuetas translúcidas espalhadas no fundo, paradas, reforçando o tema
  aquático sem depender de movimento. Use com moderação (2–4 silhuetas, nunca
  poluindo o texto principal).
- **Peças muito minimalistas** (ex.: um único CTA, uma citação): pode-se
  omitir os peixinhos e manter só o fundo oceânico + vidro — ainda é
  reconhecível como Marine Glass pelos dois princípios da seção 2.

## 6. Tipografia

| Fonte | Uso |
|---|---|
| **Syne** (peso 700–800) | Títulos, chamadas, números de destaque — a fonte "de impacto" |
| **DM Sans** | Corpo de texto, legendas, botões — a fonte "de leitura" |

Vale pra qualquer formato: um slide de apresentação deve usar Syne no título
do slide e DM Sans no corpo, exatamente como uma tela de produto usa Syne no
header e DM Sans no resto.

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

Em peças estáticas (slide, card), isso vira também recurso gráfico: o 🐟 pode
aparecer como "logo informal" no canto, e emojis de categoria ajudam a
escanear bullets rapidamente.

## 8. Tom de voz

Direto, curto, conversacional — como alguém do time avisando algo, nunca como
texto de sistema corporativo genérico. Vale para toast de interface, texto de
slide, legenda de card.

Características:
- Frases curtas, com a contração natural do português falado quando cabe
- Explica a consequência prática de algo, não só o status ("a resposta chega
  como comentário no card", não só "enviado")
- Nunca é seco/técnico demais nem infantilizado

Exemplos reais do ecossistema:
- ✅ Descrição salva!
- 🔒 Seleção múltipla disponível para ADM, PO e Organizadores.
- ⚠️ Não deu pra confirmar o salvamento (conexão instável) — o card continua
  aberto, tente salvar de novo.

## 9. Onde já foi aplicado (referência)

- **Maré Digital** (`kanban.html` / `painel.html`) — versão mais completa e
  animada do sistema, produto de uso diário do squad
- **`onboarding.html`** — versão para apresentação/onboarding com cards ao
  vivo (Firebase), mesma paleta de vidro sobre oceano, sem peixinhos
- **Bolão Copa do Mundo 2026** — aplicação do sistema num contexto
  lúdico/gamificado

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
- duas manchas de gradiente radial suaves: azul (~#0050A0) num canto,
  teal-azulado (~#0096B4) no canto oposto, ambas esmaecendo pra
  transparência

TEMA CLARO alternativo "Lençóis Maranhenses": fundo azul-céu #0F87C4,
superfícies quase brancas mas nunca 100% branco puro (sempre com leve
tom azulado).

VIDRO (qualquer card/bloco de destaque):
- fundo translúcido azul-escuro rgba(10,37,64,0.6) [ou branco
  translúcido rgba(255,255,255,0.55) no tema claro]
- borda sutil rgba(56,182,255,0.18)
- efeito de blur/desfoque por trás do bloco (backdrop-filter blur
  8-18px, ou simulado com transparência + sombra se a ferramenta não
  suportar blur)
- cantos arredondados (10-14px)

CORES DE DESTAQUE: azul #38b6ff, cyan #7ec8e3, teal #1de9b6. Aviso em
#ffd166, erro/negativo em #ff6b6b. Texto principal quase-branco
levemente azulado (#e8f4fd no escuro / #0B2436 no claro).

TIPOGRAFIA: "Syne" (peso bold/800) para títulos e números de
destaque; "DM Sans" para corpo de texto e legendas.

ELEMENTO DE ASSINATURA (opcional, se o formato permitir): 2-4
silhuetas translúcidas de peixinho (formato simples: triângulo da
cauda + elipse do corpo + círculo do olho) espalhadas discretamente
no fundo, cor azul/teal translúcida — reforça o tema aquático sem
competir com o conteúdo principal.

EMOJIS: use como ícone funcional, não decoração — sempre o mesmo
emoji pra mesma categoria de informação (✅ positivo, ⚠️ atenção, ❌
negativo, 🔒 restrito), no início do texto/bullet.

TOM DE VOZ (se houver texto/copy): direto e curto, como alguém do
time avisando algo — nunca formal/corporativo. Prefira frases que
expliquem a consequência prática, não só o status técnico.
```

---

*Documento baseado no código-fonte real das peças já construídas em Marine
Glass (Maré Digital, `onboarding.html`). Atualize se a paleta ou as
convenções evoluírem em novas peças.*
