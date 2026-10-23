# Guia de UI/UX do ecossistema Oceano — a "aula" (como o Claude pensa fluxos, páginas e cores)

> Para **qualquer agente ou pessoa** que desenhe ou altere tela no Maré, no Painel, no Radar, no Oceano, na Escala e no Intake.
> É a parte **de design** do que já está em `MARINE_GLASS.md` (identidade) e `docs/GUIA_DE_CODIGO.md` (código). Este guia explica **o raciocínio**: por que cada decisão foi tomada, para você decidir sozinho o caso que não está escrito.
> Tudo aqui vem de telas **reais** deste repositório e de rodadas de UI/UX já feitas (cada exemplo cita onde). Quando o guia e o código divergirem, **o código ganha** — e o guia deve ser corrigido.

**Como usar:** leia as seções 1–3 sempre; as demais, quando a tarefa pedir (fluxo → 5, página → 6, gráfico → 7, celular → 8). O procedimento de uma rodada completa está na skill `/melhoriauiux` (`.claude/skills/melhoriauiux/SKILL.md`).

**Até onde vai a sua autonomia (Antigravity):** ajuste **localizado** (1 página, 1 componente, texto, espaçamento, cor, estado vazio, acessibilidade, mobile de uma tela) você faz sozinho, no `-dev`, seguindo este guia. **Redesenho de fluxo, de página inteira, de gráfico novo, módulo compartilhado (`mare-*-dev.js`) ou 3+ páginas** → escale ao Claude pelo Quadro (`docs/COORDENACAO_AGENTES.md`), com o print do problema.

---

## 1. A mentalidade (cinco ideias que explicam quase tudo)

**1.1 Comece por quem usa e pelo que ela quer fazer em 10 segundos.**
Antes de mexer em pixel, responda: *quem abre essa tela (papel), por que ela abriu, e qual é a ação mais frequente?* O Maré é de uso diário por squads (PO, Organizador, membro); o Painel é de quem coordena; o Radar é de quem acompanha OKR; o Oceano é a "sala de estar" de **todo mundo**. A tela existe para a ação mais frequente — o resto fica a um clique, não no caminho.
> Exemplo real: o Oceano mostrava o controle de ADM do plantão para todos. Separamos **por audiência**: Oceano = só o que a pessoa comum precisa (o aviso minimizado, reportar bug, "Meus chamados"); Painel › Monitor = todo o controle de ADM. (`docs/PLANTAO_BUGS.md`, "Onde cada pessoa mexe").

**1.2 O dado manda — renderize com dado realista antes de opinar.**
Uma tela bonita com 3 itens de exemplo mente. Eu sempre **abro a página de verdade** (boot real + Firebase falso) com: poucos dados, muitos dados, **zero** dados, texto longo, nome comprido, 3 squads e 12 squads — em 1280 px e 390 px, nos 3 temas. A maioria dos achados só aparece assim (a 3ª squad que nunca aparecia na comparação; as 2 barras gigantes do "throughput de 14 dias"; o `[object Object]` no risco).

**1.3 Uma coisa por tela, um significado por cor, uma informação em um lugar só.**
Confusão quase sempre é **repetição** (a mesma distribuição em 3 gráficos) ou **ambiguidade** (a mesma cor querendo dizer coisas diferentes). Se duas coisas mostram o mesmo número, uma delas sai.

**1.4 Reaproveite antes de inventar.**
Antes de criar um componente: ache o irmão que já resolve (`grep` no arquivo e nas páginas vizinhas). Seções recolhíveis já são `<details class="pt-bucket">`; avisos já são `showToast()`; confirmação é `uiConfirm()`; modal é `.ov` + `.panel`; chip, pílula, abas e drawer já existem. Componente novo **só** se nenhum serve — e aí ele nasce com os tokens e funciona nos 3 temas e no celular. A coerência entre telas vale mais que a "melhor" solução isolada.

**1.5 A interface é a regra de negócio visível — mas a regra do servidor é a segurança.**
O que a tela esconde **não** é permissão (já custou um incidente: restrição "só o autor" que existia só na tela). Toda restrição que o design mostra precisa existir também em `database.rules.json`. E o contrário: se o servidor recusa, a tela precisa dizer **por quê** e **o que fazer**, não ficar muda.

---

## 2. Marine Glass na prática (o que está no código, não só no manual)

A identidade (vidro sobre oceano, peixinhos, Syne/DM Sans) está em `MARINE_GLASS.md`. Aqui está **como aplicar sem errar**.

### 2.1 Tokens — sempre variável, nunca cor crua
O `:root` das páginas define a paleta; **todo** CSS novo usa `var(--…)`. Cor crua (`#38b6ff`, `rgba(56,182,255,.2)`) quebra o tema claro e o Vice City.

| Token | Papel | Observação |
|---|---|---|
| `--deep`, `--deep-rgb` | fundo da página | nunca branco/preto puro |
| `--glass`, `--glass-rgb`, `--glass-b` (borda), `--glass-h` (hover) | superfícies de vidro | receita na 2.3 |
| `--surface-rgb` / `--surface2-rgb` | "levantado" (modal, dropdown, card) / "rebaixado" (input, sub-painel) | use `rgba(var(--surface-rgb), .97)`; assim a **mesma opacidade** serve nos 3 temas |
| `--txt`, `--txt2`, `--txt3` | texto principal / secundário / apoio | 3 níveis só; apoio (`--txt3`) nunca para o que a pessoa precisa ler |
| `--accent`, `--blue`, `--cyan` | ação, foco, navegação, links | `--accent` é "clicável/ativo" |
| `--teal` | positivo, ok, concluído, destaque secundário | |
| `--warn` | atenção, prazo hoje, risco médio | |
| `--danger` | erro, bloqueio, atraso, destrutivo | |
| `--r` (10 px), `--r2` (14 px) | raio | 8–14 px; nada de canto reto nem pílula gigante |

Cores **translúcidas com texto saturado próprio** (tags, prioridades, status) ficam de fora dos temas de propósito — são chips que já têm fundo e texto próprios.

### 2.2 Os três temas e o que cada um exige
- 🌙 **Abrolhos** (escuro, padrão), ☀️ **Lençóis Maranhenses** (claro) e 🌴 **Vice City** (entardecer, rosa/laranja) — além do automático e de variantes experimentais. Eles se alternam por `data-theme` no `<html>`.
- **Regra dos dois lados:** o que você fizer tem de ficar legível nos três. No claro, "branco" é `#FCFEFF` (1–2 % de azul); no Vice City, o fundo tem faixas claras e **colunas/cards somem** se a opacidade do vidro for baixa — por isso `.col` sobe para `.78` lá. Sintoma clássico: "texto cinza claro sobre vidro claro" (houve correção de contraste ilegível no Radar em 15/10).
- Teste sempre: `document.documentElement.dataset.theme = 'light' | 'vice' | ''` e olhe a tela.

### 2.3 Receita do vidro (decorar)
```css
background: var(--glass);                  /* ou rgba(var(--glass-rgb), .55–.78) */
border: 1px solid var(--glass-b);
border-radius: var(--r) /* 10 */ ou var(--r2) /* 14 */;
backdrop-filter: blur(8px);                /* botão, chip */
/* card/painel 12–14px · modal/overlay 16–18px */
```
`backdrop-filter` custa GPU no celular: **não** empilhe vidro dentro de vidro dentro de vidro (card dentro de painel dentro de modal): o de dentro usa fundo translúcido **sem** blur.

### 2.4 Fundo, peixinhos e movimento
Fundo é sempre camadas (radial + base escura), nunca sólido. Peixinhos/bolhas ficam **atrás** do conteúdo, `pointer-events:none`, e a pessoa pode desligar (preferência). Movimento serve a **significado** (algo mudou, algo chegou) e é curto; respeite `@media (prefers-reduced-motion: reduce)` (já existe em kanban e Oceano) — qualquer animação nova entra nesse bloco.

---

## 3. Cor: como escolho

### 3.1 Cor é significado, não enfeite
| Quero dizer… | Uso | Nunca |
|---|---|---|
| "isto é clicável / ativo / selecionado" | `--accent` | usar `--accent` para "bom" |
| "deu certo / no ritmo / concluído" | `--teal` (+ ✅) | verde diferente do teal |
| "atenção / vence hoje / risco" | `--warn` (+ ⚠️) | amarelo para decoração |
| "erro / bloqueado / atrasado / vai apagar" | `--danger` (+ ❌/🚧) | vermelho para "destaque" |
| "isto é a squad X / a pessoa Y" (identidade) | cor da squad/pessoa, **a mesma em todo o app** | reaproveitar a cor de status para identidade |

**Uma cor = um significado na tela inteira.** Se o azul já é "ação", ele não é também "squad Dados" na mesma tela — por isso, nos gráficos, a **identidade** (squad) usa a cor da squad e o **estado** (andando, na fila, bloqueado) vira **intensidade** da mesma cor (cheia / clara) e vermelho só para bloqueio.
> Exemplo real (Painel › Fluxo, 10/10): as barras usavam a cor de cada *coluna* (azul/verde/vermelho repetidos entre squads) → "é tudo a mesma cor, esse fluxo". Passou a ser: cor = squad; cheia = em andamento; clara = na fila; vermelho = bloqueado.

### 3.2 Estado nunca só pela cor
Daltonismo, sol na tela e impressão. Todo estado leva **cor + ícone/emoji + texto** (ex.: `⚠ 3d atrasado`, `🚧`, `⏸`). A cor reforça; não carrega sozinha.

### 3.3 Hierarquia por luminosidade, não por mais cores
Para dar peso: aumente contraste de texto (`--txt` × `--txt2` × `--txt3`), tamanho ou **uma** cor de destaque. Se a tela tem 5 cores competindo, tire 3. O destaque deve ser **raro** (um número grande, um selo vermelho) — se tudo grita, nada grita.

### 3.4 Contraste mínimo
Texto normal ≥ 4,5:1; texto grande/ícone ≥ 3:1; foco visível ≥ 3:1. **Meça** (seção 12.3) em vez de achar. `--txt3` sobre vidro claro **falha** com frequência: informação importante nunca vai em `--txt3`.

### 3.5 Série de cores em gráfico
Ordem fixa e estável (a entidade mantém a cor mesmo se o filtro mudar a contagem); no máximo ~8 séries — a 9ª vira "Outros" ou o gráfico é dividido. Nunca gerar uma cor nova na hora. Detalhes em 7.

---

## 4. Tipografia, espaço, ícone

- **Syne** (700–800): títulos, números grandes, chamadas. **DM Sans**: leitura, botões, rótulos. **JetBrains Mono / Space Mono**: código, ids, contadores. Não inclua uma 4ª fonte.
- **Escala usada nas telas:** corpo 12–13 px (denso, é ferramenta de trabalho); apoio 10–11 px; título de seção 13–16 px; número de destaque 26–40 px. Campo de texto em **toque** tem de ter 16 px (senão o iOS dá zoom — já há regra `(hover:none) and (pointer:coarse)`).
- **Espaço:** múltiplos de 4 (4/6/8/12/16/24). Agrupe por proximidade: itens do mesmo grupo a 6–8 px, grupos a 16–24 px. Sem borda onde o espaço já separa.
- **Alinhamento:** um eixo de borda esquerda por bloco. O cartão da Meta no Oceano começava 47 px abaixo dos quadrados dos apps por causa de um cabeçalho — alinhar topo e altura dos vizinhos é parte do design (16/10).
- **Ícones = emoji semântico** (seção 7 do `MARINE_GLASS.md`): sempre o mesmo emoji para a mesma coisa, no **início** do rótulo. Emoji decorativo ou novo para algo que já tem emoji = ruído. Nunca emoji colorido junto de borda lateral colorida "dizendo a mesma coisa".
- **Números:** com unidade (`d`, `/sem`, `%`) e, quando é média, o **tamanho da amostra**; alinhados à direita em tabela; mesma casa decimal na coluna. `Math.round` × `Math.floor` muda o que a pessoa vê (66 % × 67 %): use o mesmo critério da tela vizinha.

---

## 5. Fluxos: como eu desenho o caminho

### 5.1 A ordem de pensamento
1. **Gatilho** — o que fez a pessoa chegar aqui (notificação, link, menu, rotina)? Ela já tem contexto? Se veio por link/notificação, abra **no ponto certo** (ex.: `?card=…&opencard=…`).
2. **Ação principal** — uma só, visualmente óbvia (botão primário `.btn-p`/`.pri`), no lugar onde o olho termina.
3. **Padrões sensatos** — pré-preencha o que dá para saber (squad atual, hoje, quem está logado, última escolha). Cada campo a menos é uma desistência a menos.
4. **Passos mínimos** — se passa de ~5 campos, divida por **relevância** (o essencial visível; o raro em `<details>`), não por "página 1 de 3".
5. **Resultado visível** — depois de salvar, a pessoa **vê** o efeito (toast + o item aparece/atualiza). "Salvo" sem sinal é ansiedade.
6. **Saída** — dá para desfazer, cancelar, voltar? (Ctrl+Z do board; Esc fecha; "↩ Continuar" no Oceano.)

### 5.2 Estados — desenhe todos, não só o "feliz"
| Estado | O que a tela faz |
|---|---|
| **Vazio** | explica **o que é** e **o que fazer** em 1 frase + a ação ("Nenhum comentário ainda. Seja o primeiro!"). Não deixa um buraco. |
| **Carregando** | mostra a estrutura/uma linha de "Conferindo…"; nunca tela em branco; leitura pesada é **sob demanda** (botão "📥 Carregar") |
| **Erro** | diz **o que houve + consequência + o que fazer** ("Não deu pra confirmar o salvamento (conexão instável) — o card continua aberto, tente salvar de novo."). Nada de "Erro" ou código cru |
| **Sem permissão** | mostra **por quê** e **quem** pode ("Seleção múltipla disponível para ADM, PO e Organizadores.") — e o servidor também recusa |
| **Parcial / muito dado** | limita (top 6 + "ver todas"), pagina ou recolhe; nunca renderiza 80 itens abertos no fim de um modal |
| **Offline** | indicador de conexão + fila (o Maré guarda ações e reaplica) |
| **Travado por outra pessoa** | modo leitura + aviso de quem edita (🔒) |

### 5.3 Divulgação progressiva (o truque mais usado)
- **Seção recolhida quando vazia, aberta quando tem algo** (`<details>`): "Cards vinculados" fechado se não há vínculo, aberto se há (não esconde o que já existe).
- **Histórico longo** → recolhido por padrão se >5 entradas.
- **Recurso raro** não ocupa espaço permanente (busca dentro de uma lista vazia, por exemplo).
- **Ajuda sob demanda:** Central de Ajuda (Ctrl+K), dicas (1 por dia por app), tooltip com sentido — nunca um parágrafo fixo explicando a tela.

### 5.4 Componentes da casa (use estes)
| Preciso de… | Use | Observação |
|---|---|---|
| aviso rápido | `showToast(msg)` | `role="status"` `aria-live="polite"` já embutido; msg curta, com consequência |
| confirmar algo destrutivo | `uiConfirm(msg, opts)` | nunca `confirm()` nativo |
| modal | `.ov` + `.panel` (`openOv/closeOv`) | Esc fecha; modal dentro de modal precisa de z-index maior (teste com `elementFromPoint`) |
| seção recolhível | `<details class="pt-bucket">` + `.pt-chevron` | |
| abas | o padrão `ptab`/`ag-tab` da página | trocar de aba cancela captura/edição pendente |
| filtro | chips (`.filter-bar`) com rótulo | filtros lado a lado, **com rótulo** |
| status | pílula/ponto + **texto** | |
| atalho de teclado | catálogo `ATALHO_ACOES` | combinação com Ctrl/Alt; tecla de função sozinha vale |
| dica | `CATALOGO` em `mare-dicas-dev.js` | só para o que a pessoa não descobre sozinha |

### 5.5 Quem vê o quê (audiência)
Desenhe a **versão da pessoa comum** primeiro. O controle de administração vive em **outro lugar** (Painel), não "escondido por papel" no mesmo layout — isso evita tela cheia de botões que 90 % não pode usar, e evita o vazamento ("?adm=1" liberava o painel do plantão no Oceano).

---

## 6. Páginas: hierarquia, densidade, composição

### 6.1 Três níveis, sempre
1. **O que importa agora** (1–3 itens: um número grande, o alerta, a ação principal) — topo, esquerda.
2. **O contexto** (lista, gráfico, comparação) — meio.
3. **O detalhe / raro** (histórico, configuração, tabela completa) — recolhido, em modal ou em outra aba.

### 6.2 Densidade: ferramenta de trabalho ≠ landing page
O Maré é denso de propósito (12 px, colunas, chips) — quem trabalha 6 h por dia quer ver mais. Mas densidade **sem agrupamento** vira ruído. Regra prática: **no máximo ~5 KPIs** numa linha; cada um com unidade e amostra; se um KPI repete o que a tabela já mostra, **corta**.
> Exemplo real (Radar › Dashboard, 09/10): 6 cartões de KPI repetiam a tabela, o gráfico misturava barra de contagem e linha de % no mesmo eixo (eixo duplo disfarçado) e as cores de status apareciam 3 vezes. Virou: **um número grande** (atingimento médio + variação) + a linha da evolução no **mesmo desenho** do gráfico de atingimento; situação = uma barra única + lista clicável; tabela ordenada por **pior situação primeiro**.

### 6.3 Composição e escaneabilidade
- Leitura em **F**: título/KPI no alto-esquerda, ação principal no fim do bloco.
- **Ordem = prioridade** (pior primeiro em lista de risco; mais recente primeiro em feed).
- **Mesmo componente, mesmo lugar** em todas as telas parecidas (cabeçalho, botão "+ Novo", filtros). Quem aprendeu em uma aprende em todas.
- **Sem rolagem lateral** em lugar nenhum (o redesenho do modal do card no celular existiu por isso). Sem rolagem **dupla** (modal dentro de página que também rola).
- **Largura:** conteúdo de leitura em 560–980 px; gráficos preenchem a largura disponível (o "Dados do Board" ganhou popup maior e gráficos que preenchem).

### 6.4 Exemplos de decisão de página (do repositório)
| Tela | Problema | Decisão e por quê |
|---|---|---|
| **Oceano — home** | produtos e Mural disputavam espaço; precisava rolar | apps à **esquerda**, Mural à **direita** (aberto no desktop), sem rolar: o que a pessoa quer (abrir um produto) e o que precisa saber (aviso) lado a lado |
| **Oceano — Meta Global** | cartão 47 px abaixo dos quadrados | esconder o cabeçalho (o cartão já traz o rótulo) e alinhar o **topo** — sem esticar os quadrados (esticar deformava com 2 metas) |
| **Plantão** | controle de ADM no Oceano de todos | separar por audiência (5.5) |
| **Painel — Fluxo** | cor = coluna; mesma info 3×; 2 barras gigantes | cor = squad, uma visão por pergunta ("quanto entregamos", "onde está o trabalho", "o que está parado") |
| **Modal do card (celular)** | rolagem lateral | redesenho estilo Trello: uma coluna, seções empilhadas, nada de scroll horizontal |
| **Escala** | filtros ocupando a tela | botão 🔎 Filtros → mini tela (squad + subtime) |

---

## 7. Dados e gráficos (a regra da casa)

Seguimos a skill/método de **dataviz** (forma → cor → validação → marcas → interação → acessibilidade). Em uma frase por etapa:

1. **A forma segue o trabalho do dado:** magnitude → barra/coluna; evolução → linha; composição → barra empilhada **só** se há poucas partes; um número → **número grande** (não gráfico). Às vezes a resposta é *não* fazer gráfico.
2. **Um eixo só.** Nunca eixo duplo. Duas medidas de escala diferente → dois gráficos, ou índice comum (a meta "volta fantasma" usa o **mesmo** eixo do realizado).
3. **Cor segue a entidade, não o ranking.** O filtro não repinta quem sobrou.
4. **Marcas finas** (linha 2 px, ponto com anel, barra com canto de 4 px ancorado na base), **grade quase invisível**, **valor só onde importa** (nunca número em todo ponto), **legenda sempre** com ≥2 séries (e rótulo direto nas até 4 primeiras).
5. **Interação por padrão:** dica ao passar o mouse/tocar (a mesma caixa em todos os gráficos), alvo maior que a marca, e **tabela alternativa** quando fizer sentido (modo "⛶ Expandir" com a tabela diária).
6. **Escrito para o leitor:** título diz a conclusão ou a pergunta; unidade e período explícitos; amostra quando for média.
7. **Gráfico novo = SVG inline** (sem biblioteca; o módulo `mare-metas` já traz padrões: anel, linha, linha de projeção, marcos). Se há um desenho irmão, **use o mesmo** (mesma grade, mesmos pontos, mesma dica).

> A metáfora "mar" vale para **nomes e microcopy** ("O mar tá pra peixe", "volta fantasma"), não para torcer o gráfico: o gráfico continua sendo um gráfico legível.

---

## 8. Mobile, toque e iPad

- **Dois conceitos diferentes:** *largura* (`max-width`) e *toque* (`@media (hover:none) and (pointer:coarse)`). O iPad é largo **e** é toque — regra de largura sozinha deixa o iPad com a UI de mouse (já gerou quatro bugs de uma vez em 23/09).
- **Breakpoints** que o código já usa: 980 (Oceano, 2 colunas → 1), 768 (celular no Maré), 560/520/480/380 (apertos). Não crie outro valor sem motivo.
- **Alvo de toque ≥ 44 px** (`min-height:44px` já é usado nos botões do celular).
- **Nada que dependa de hover:** botão "remover" só visível no `:hover` some no toque → no bloco `pointer:coarse` ele fica `opacity:1`. `title="…"` **não** aparece em toque: se o botão é só-ícone, a explicação precisa estar em **texto visível** ou na ajuda.
- **Campos com 16 px** (senão o iOS dá zoom ao focar).
- **Teclado virtual** cobre campo: o modal ajusta a altura (`_onVVResize` usa o critério de toque, não de largura).
- **Uma coluna no celular**, ações principais ao alcance do polegar, menu "⋯" para o raro, **zero rolagem lateral**.
- Teste em **390 × 800** e **834 × 1112** (iPad), com `hasTouch` quando for o caso.

---

## 9. Acessibilidade e microinterações

- **Teclado primeiro:** tudo que clica, tabula. Ordem de tab = ordem visual. `Enter`/`Espaço` ativam. **Esc fecha**; em modal empilhado, só o de cima responde ao Esc (registre o dono do Esc em captura + `stopPropagation`).
- **Foco visível e preservado.** Redesenhar com `innerHTML` **perde o foco** e o texto digitado: sincronize o rascunho antes, ou atualize no lugar; e devolva o foco ao elemento certo — procurando por `data-*` (**nunca** pelo texto de um `onclick`: o `jsq()` escapa as aspas e o seletor não casa — bug real dos atalhos, 16/10).
- **Leitor de tela:** toast com `role="status"`; gráfico com `aria-label` ("73 % da meta"); ícone-botão com `aria-label`/texto.
- **Não bloqueie a pessoa:** `display:flex` vence o atributo `[hidden]` → escreva `.classe[hidden]{display:none}`; modal de dentro de modal precisa de `z-index` maior.
- **Tempo e movimento:** animação curta (≤ 250 ms para microinteração), sem piscar, e dentro de `prefers-reduced-motion`. "Modo insistente" (tremor/som) é **opt-in**, nunca padrão.
- **Clique duplo:** todo botão que grava com id novo tem trava de "em andamento" e fica desabilitado (clique duplo criava dois).
- **Datas:** `new Date(str + 'T00:00:00')`; "dias úteis" ignora sábado **e** domingo; compare pelo dia, não pela hora.

---

## 10. Performance é UX

Pesar a tela é errar a experiência: o Maré recarrega todos quando a versão muda (por isso promoção de funcionalidade vai em lote diário). Regras de design que protegem isso:
- **Zero leitura no boot** do que a pessoa talvez nem use (aba "Cards" do Radar só baixa ao clicar "📥 Carregar"; "Central de Dados" baixa só 15 dias).
- **Query que filtra no servidor** (não baixar a árvore inteira para filtrar no cliente).
- **Listener só enquanto a tela está aberta.**
- **Sem biblioteca** só para um gráfico; sem imagem embutida em base64 duplicada.
- Efeito caro (`backdrop-filter` empilhado, `filter` pesado) só onde dá retorno visual.

---

## 11. Tom de voz e copy

Direto, curto, conversacional — alguém do time avisando algo; **explica a consequência prática**, não só o status.

| Em vez de… | Escreva… |
|---|---|
| "Erro ao salvar" | "⚠️ Não deu pra confirmar o salvamento (conexão instável) — o card continua aberto, tente salvar de novo." |
| "Operação concluída" | "✅ Descrição salva!" |
| "Acesso negado" | "🔒 Seleção múltipla disponível para ADM, PO e Organizadores." |
| "Nenhum dado" | "Nenhum comentário ainda. Seja o primeiro!" |
| "Cadastrar" (botão sem objeto) | "+ Novo Objetivo" |
| "Tem certeza?" | "Excluir o card “X”? Os comentários dele também vão embora." |

Regras: português do Brasil falado (contração quando cabe); verbo no botão; **mesmo nome para a mesma coisa em todo o app** ("Radar", não "OKR", quando é a página; "Maré Digital", "Painel", "Oceano" — `docs/OCEANO.md`); nada de jargão técnico na interface (`kanban/usuarios/…`, `uid`) fora de telas de ADM; sem **dado pessoal** em texto de bug/log; emoji **no início**, semântico.

---

## 12. Como auditar uma tela (método)

### 12.1 Os oito passos
1. **Escopo e audiência** (1.1) e a pergunta "qual a ação mais frequente?".
2. **Ler** `MARINE_GLASS.md`, este guia, e a seção da página em `CODE_MAP_FAST.md`; `grep` os irmãos (como a mesma coisa é feita em outro lugar).
3. **Renderizar de verdade** (boot real + Firebase falso, `docs/arezzo/testes/fakefb.js`) com **dados realistas e extremos** (vazio, muito, texto longo, N squads) — **1280 e 390 px**, **3 temas**.
4. **Olhar** (screenshot) e **medir** (12.3). Se você não consegue ver imagens, meça por DOM: overflow, caixas, contraste.
5. **Listar achados** com a regra violada, o cenário concreto e o impacto (quem sofre e quanto). Marque: **bug** (comportamento errado) × **design** (confuso/feio) × **decisão de produto** (muda métrica/fluxo).
6. **Corrigir o claro**, reutilizando componentes; **perguntar** o que é decisão de produto; **registrar** como *de propósito* qualquer mudança de métrica ("Item mais velho" → "Parado há mais tempo").
7. **Testar:** o teste de layout e comportamento, nos dois tamanhos e nos três temas, sem regressão das suítes vizinhas.
8. **Entregar** com o checklist da seção 15.

### 12.2 Rubrica rápida (marque cada item da tela)
- [ ] Dá para dizer **o que fazer aqui** em 3 s? A ação principal é óbvia?
- [ ] Cada cor tem **um** significado? Estado tem cor **+ ícone + texto**?
- [ ] Nenhuma informação aparece **duas vezes**? Nenhum KPI repete a tabela?
- [ ] Os **estados** (vazio, carregando, erro, sem permissão, muito dado) existem e dizem o que fazer?
- [ ] Funciona em **390 px**, sem rolagem lateral, alvos ≥ 44 px, nada só-hover?
- [ ] Legível nos **3 temas** (contraste medido)?
- [ ] **Teclado** (tab, Enter, Esc) e **foco** preservado ao redesenhar?
- [ ] Copy no **tom da casa**, com consequência, sem jargão?
- [ ] Só usa **componentes e tokens** que já existem?
- [ ] Não lê mais dado do que precisa no boot?
- [ ] A restrição mostrada na tela também existe nas **regras do banco**?

### 12.3 Harness de medição (Playwright + Firebase falso)
Copie de um teste existente (`test_menu_kanban.js`, `test_okr_dashboard.js`) o boot real e acrescente:
```js
for (const [w, h, nome] of [[1280, 900, 'desktop'], [390, 800, 'celular']]) {
  for (const tema of ['', 'light', 'vice']) {
    await p.setViewportSize({ width: w, height: h });
    await p.evaluate(t => { t ? document.documentElement.setAttribute('data-theme', t) : document.documentElement.removeAttribute('data-theme'); }, tema);
    // 1) sem rolagem lateral
    const sobra = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    t(`${nome}/${tema || 'abrolhos'}: sem rolagem lateral`, sobra <= 0, sobra);
    // 2) alvos de toque (só no celular)
    if (w < 500) { const pequenos = await p.evaluate(() => [...document.querySelectorAll('button,a,[role=button]')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && (r.height < 32 || r.width < 32); }).length); console.log(`ℹ️ ${nome}: ${pequenos} alvos de toque menores que 32px (alvo ideal ≥ 44px; ignore o que é decoração)`); }
    // 3) contraste do texto (heurística p/ decidir ONDE olhar): pior razão entre a cor do texto e o 1º fundo opaco acima dele
    const pior = await p.evaluate(() => {
      const num = c => (c.match(/[\d.]+/g) || []).map(Number);
      const lum = c => { const [r, g, b] = num(c).slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
      const sonda = document.createElement('div'); sonda.style.cssText = 'background:var(--deep);position:fixed;width:1px;height:1px;opacity:0'; document.body.appendChild(sonda);
      const fundoPagina = getComputedStyle(sonda).backgroundColor; sonda.remove();
      const fundo = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor, n = num(c); if (n.length >= 3 && (n[3] === undefined || n[3] > .6)) return c; } return fundoPagina; };
      const ruins = [];
      document.querySelectorAll('p,span,td,li,label,h1,h2,h3,button,a').forEach(e => {
        const txt = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
        if (!/[\p{L}\p{N}]/u.test(txt)) return;                       // só emoji/símbolo não conta
        const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
        if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < .5) return;
        const L1 = lum(cs.color), L2 = lum(fundo(e)); ruins.push({ r: (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05), txt: txt.slice(0, 28) });
      });
      ruins.sort((x, y) => x.r - y.r); return { min: +(ruins[0] ? ruins[0].r : 21).toFixed(2), piores: ruins.slice(0, 4).map(x => x.txt + ' ' + x.r.toFixed(1)) };
    });
    console.log(`ℹ️ ${nome}/${tema || 'abrolhos'}: contraste — onde olhar primeiro: ${pior.piores.join(' | ')}`);   // INFORMATIVO: vidro translúcido engana a conta; confirme na imagem
    await p.screenshot({ path: `/tmp/ui_${nome}_${tema || 'abrolhos'}.png`, fullPage: true });
  }
}
```
(Contraste e alvos de toque saem como **informação** (ℹ️), não como falha: texto sobre vidro translúcido, gradiente ou imagem engana a conta. O limite é 4,5:1 para texto normal; use os "piores" para **decidir onde olhar** e confirme na imagem. A rolagem lateral, essa sim, é falha objetiva.)

---

## 13. Anti-padrões que já aconteceram aqui (e a causa)

| Sintoma | Causa | O que fazer |
|---|---|---|
| "É tudo a mesma cor" | cor ligada à coluna/categoria, não ao significado | 3.1 |
| Mesma distribuição em 3 lugares | cada seção nasceu de uma necessidade, ninguém cortou | uma pergunta, uma visão |
| 2 barras gigantes num gráfico "de 14 dias" | janela maior que o dado | mostrar a janela real; "Nenhum dado" explica |
| A 3ª squad nunca aparece | layout com N fixo | renderizar a partir da lista (`SQUADS`), testar com N≥4 |
| KPI com número "bonito" e errado | métrica contava fila como "parado" | decidir a regra, registrar a mudança **de propósito** |
| Botão some no celular | só existia no `:hover` | `pointer:coarse` ou sempre visível |
| Tooltip como única explicação | `title` não aparece em toque | texto visível / ajuda |
| Texto ilegível no tema claro | cor crua ou `--txt3` sobre vidro claro | tokens + medir contraste |
| Foco perdido ao salvar/re-renderizar | `innerHTML` recria o elemento | atualizar no lugar / devolver foco por `data-*` |
| "Salvar" que não salva | handler sem trava, id novo a cada clique | trava + desabilitar botão |
| Restrição só na tela | regra do banco aberta | 1.5 |
| Cartão deformado ao "alinhar" | esticar o vizinho em vez de alinhar o topo | alinhar topo, não altura |
| `[object Object]` na tela | campo aceita texto **ou** objeto | normalizar antes de renderizar |
| "Cara de checkbox, tudo quadradão" (Travessia) | raio pequeno, borda forte em tudo, caixinha nativa, abas retas, todo bloco com o mesmo peso | cantos grandes (cartão ≥ 22 px, botão em pílula), borda suave + brilho, **interruptor** para ligar/desligar e **pílula marcável** para escolher, ícone de título em bolinha, 1 bloco de destaque por tela (hero), componentes com forma própria (anel, medidor, trilha, linha do tempo) |
| Rolagem lateral no celular | largura fixa / tabela larga | 1 coluna; tabela em `overflow-x` **dentro** do contêiner, nunca na página |

---

## 14. Receitas de decisão (se → então)

- **Preciso mostrar um número importante** → número grande (Syne) + variação + unidade; gráfico só se a evolução importa.
- **Lista com muitos itens** → ordem por prioridade, top N + "ver todas", filtros com rótulo, estado vazio explicado.
- **Ação destrutiva** → `uiConfirm` com consequência; **desfazer** quando possível; vermelho só no botão final.
- **Algo novo e raro** → fora do caminho principal (`<details>`, "⋯", aba), e talvez uma **dica** (1 frase + "Saiba mais").
- **Campo obrigatório** → marque **antes** de salvar (e diga qual falta), não só no erro.
- **Dado que muda ao vivo** → atualize no lugar (sem piscar a tela), e se a pessoa está editando, **não** sobrescreva.
- **Tela de ADM** → no Painel; funcionalidades de gestão não poluem o Oceano.
- **Gráfico novo** → procure o desenho irmão; reuse grade, ponto, dica; um eixo; cor por entidade.
- **Mudou texto/ícone numa página** → `grep` a mesma coisa nas páginas irmãs (a cópia esquecida é o achado mais comum).
- **Dúvida de produto** (muda métrica, fluxo ou permissão) → pergunte; não decida sozinho.

---

## 15. O que acompanha toda mudança de UI

1. **Só no `-dev`** (nunca prod direto); versão do `-dev` + `version.json` (`node scripts/mare-cli.js bump <alvo>`); `?v=` se mexeu em módulo compartilhado (e aí é Claude).
2. **Teste** de layout/comportamento (nos dois tamanhos e nos três temas) em `docs/arezzo/testes/`; sem regressão nas suítes vizinhas; `node scripts/checar.js`.
3. **Registro:** `CHANGELOG.md` (feature/redesenho) ou `BUGS_E_CORRECOES.md` (bug achado de passagem), com data · arquivo · versão **reais**.
4. **Dica?** (regra 7 do `CLAUDE.md`): "dica: sim, X" ou "dica: não, porque Y" — redesenho de tela que a pessoa já usa normalmente é **não**.
5. **Ajuda in-app** em dia (`/atualizarhelpcontent`) se o comportamento descrito mudou; **CODE_MAP** (`node scripts/mare-cli.js map`) se nasceu âncora.
6. **Script de teste de console** (português, só leitura, só nomes que existem no `-dev`) para o Caio/ADM validar antes de promover.
7. **Antes/depois** na descrição do PR (print ou descrição objetiva) e o que **não** foi feito.
8. Promoção só depois da validação explícita; funcionalidade em lote diário, correção na hora.

---

## 16. Onde olhar (referências vivas)

| Preciso de… | Arquivo |
|---|---|
| identidade e prompt-modelo | `MARINE_GLASS.md` |
| tokens e temas | `:root`, `[data-theme="light"]`, `[data-theme="vice"]` no `<style>` de `kanban-dev.html` |
| um modal, toast, confirm | `showToast`, `uiConfirm`, `.ov/.panel` em `kanban-dev.html` |
| gráficos (anel, linha, projeção, marcos) | `mare-metas-dev.js` |
| redesenho de gráfico bem-feito | Painel › Fluxo (`painel-dev.html`) e Radar › Dashboard (`okr-dev.html`) |
| lobby/layout de produto | `oceano-dev.html` |
| harness de teste de tela | `docs/arezzo/testes/` (`fakefb.js`, `test_menu_kanban.js`, `test_painel_fluxo.js`, `test_okr_dashboard.js`) |
| armadilhas de código | `docs/GUIA_DE_CODIGO.md`, `BUGS_E_CORRECOES.md` |
| histórico de rodadas de UI/UX | `CHANGELOG.md` (busque "UI/UX") e `docs/changelog-archive-2026-07-a-09.md` |

> **Resumo de uma linha:** *quem usa, o que quer em 10 segundos, um significado por cor, uma informação em um lugar, reaproveite o que existe, desenhe todos os estados, teste em 390 px e nos 3 temas — e a regra do servidor é a segurança de verdade.*
