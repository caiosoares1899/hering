---
name: melhoriauiux
description: Rodada de melhoria de UI/UX e design de uma tela (ou de várias) do ecossistema Oceano — Maré Digital, Painel, Radar, Oceano, Escala, Intake — seguindo o padrão Marine Glass e o guia docs/GUIA_UI_UX.md. Audita renderizando a tela de verdade (1280 e 390 px, 3 temas, dados realistas e extremos), lista achados (bug × design × decisão de produto), corrige o que é claro reaproveitando os componentes da casa, testa e entrega no -dev. Use sempre que o usuário pedir "melhoria de UI/UX", "roda um /melhoriauiux", "melhora o design de X", "faz uma rodada de UI/UX", "tá confuso/feio/desalinhado", "melhora a experiência de X" — de preferência direcionada a uma tela; sem alvo, escolhe por critério. Não é o /monitorarbugs (comportamento errado) nem o /otimizaçãoderotina (bytes/leitura do Firebase).
---

# `/melhoriauiux` — rodada de UI/UX (a que o Caio pede sempre)

Nasceu do padrão de pedido que se repete: *"quero que você faça uma análise de UI/UX e melhore o design"* — a tela está confusa, é "tudo a mesma cor", os números repetem, o celular aperta, o tema claro some o texto. Esta skill transforma o método que funcionou (Painel › Visão e Fluxo, Radar › Dashboard, modal do card no celular, Escala, Oceano) em procedimento repetível.

**Antes de tudo, leia `docs/GUIA_UI_UX.md`** (a "aula": como se pensam fluxos, páginas e cores aqui) e `MARINE_GLASS.md` (identidade). Esta skill é o **procedimento**; o guia é o **raciocínio**. Não os duplique: se achar uma regra nova, ela entra no guia.

## O que esta rotina NÃO é
- **Não é `/monitorarbugs`.** Aquela caça comportamento errado/inconsistente. Aqui o foco é **clareza, hierarquia, cor, fluxo, consistência, mobile, acessibilidade e copy**. Bug achado **de passagem** é corrigido e registrado em `BUGS_E_CORRECOES.md` (como o `renderFilterBar()` que nunca gerava o filtro de squad), mas não é o objetivo.
- **Não é `/otimizaçãoderotina`** (bytes e leitura do Firebase) — embora "ler só ao abrir" seja regra de design (guia, seção 10).
- **Não é licença para redesenhar o que está bom nem para trocar a identidade.** Marine Glass não muda; a tela se **adequa** a ele. Nada de biblioteca nova, fonte nova, paleta nova.
- **Não muda dado nem métrica em silêncio.** Se a regra de um número muda ("Item mais velho" → "Parado há mais tempo"), isso é **decisão de produto**: sinalize como *mudança de propósito* e peça confirmação quando for relevante.

## Quem faz o quê (Claude × Antigravity) — `docs/COORDENACAO_AGENTES.md`
- **Antigravity:** ajuste **localizado** (1 página, 1 componente, até ~1 tela de mudança): espaçamento, alinhamento, cor/token, estado vazio, texto/copy, acessibilidade, mobile de uma tela. Usa os subagentes por produto (`agente-mare`, `agente-radar`, `agente-painel-oceano`), **sem terminal para ler/editar arquivo**, e fecha com **um** comando agrupado.
- **Claude:** redesenho de fluxo/página inteira, gráfico novo, módulo compartilhado (`mare-*-dev.js`), 3+ páginas, qualquer coisa que mude métrica ou permissão.
- Escalar **não é falha**: pare, registre no Quadro (*Escalado*) com **print/descrição do problema e como reproduzir**, e siga com o resto.

## Passo 0 — Em dia e sem pisar no outro
1. `/seatualizar` (quadro, `version.json`, topo do `CHANGELOG.md`/`BUGS_E_CORRECOES.md`, `git log` recente). **Arquivo reservado no Quadro por outro agente = não toque** até o PR dele sair.
2. Declare no Quadro ("Em andamento": branch `claude/…` ou `antigravity/…`, arquivos que vai tocar) se a rodada for mexer em página grande.

## Passo 1 — Escopo: direcionada (ideal) ou geral
- **Direcionada** ("melhora a aba Fluxo", "o modal de Comunicados", "a home do Oceano"): o escopo é essa tela **e** o que ela compartilha (modal que ela abre, componente que ela usa). Diga o escopo na primeira linha da resposta.
- **Geral** (sem alvo): **não** tente a página inteira de uma vez (kanban tem ~39 mil linhas). Escolha 1–2 telas, nesta ordem:
  1. telas **alteradas há pouco** (`git log --oneline -20 -- <página>-dev.html`) — código fresco, desenho fresco;
  2. telas **mais usadas** (Maré board/card, Oceano home, Painel Visão) ainda sem rodada no **histórico** abaixo;
  3. telas com **relato** do usuário em `BUGS_E_CORRECOES.md`/chamados do plantão;
  4. se nada se destacar, **pergunte** qual tela.
- **Pergunta de partida** (guia 1.1): quem usa, por que abre, qual a ação mais frequente. Se o papel/ação não estiver claro, **pergunte** antes de desenhar.

## Passo 2 — Reconstituir o contexto sem ler o arquivo inteiro
`CODE_MAP_FAST.md` → âncora da tela → `grep -an` do nome → **leia a função/CSS inteiros** (não trechos). `grep` os **irmãos** (como a mesma coisa é feita em outra página) antes de decidir. Para o CSS, procure o bloco da tela e os `@media` dela; confira se usa `var(--…)` ou cor crua.

## Passo 3 — Auditar renderizando de verdade (o passo que mais rende)
Não opine por leitura de código. Boot real + Firebase falso (`docs/arezzo/testes/fakefb.js`; copie o início de `test_menu_kanban.js`, `test_painel_fluxo.js` ou `test_okr_dashboard.js`) com **dados realistas e extremos**:
- **Quantidade:** vazio · poucos · muitos (≥ 4 squads, 50+ itens).
- **Texto:** nome longo, título longo, emoji, HTML no texto (deve aparecer como texto).
- **Papéis:** membro × PO × ADM × externo (só leitura), se a tela muda por papel.
- **Telas:** **1280 × 900** e **390 × 800** (e **834 × 1112** se for tela de uso em tablet/toque).
- **Temas:** Abrolhos (padrão), Lençóis (`data-theme="light"`), Vice City (`data-theme="vice"`).
- Tire **screenshot** de cada combinação relevante e **olhe** (Read na imagem). Rode o **harness de medição** do guia (seção 12.3): rolagem lateral (falha objetiva), alvos de toque, onde olhar o contraste. Se não consegue ver imagem, meça por DOM (caixas, overflow, cores computadas).

## Passo 4 — Avaliar com a rubrica (guia 12.2) e classificar
Para cada falha: **regra violada**, **cenário concreto** (dado/papel/tamanho), **quem sofre e quanto**, e a classe:
- 🐞 **bug** (comportamento errado) → corrige e registra em `BUGS_E_CORRECOES.md`;
- 🎨 **design** (confuso, repetido, desalinhado, ilegível, só-hover, sem estado vazio…) → corrige;
- 🧭 **decisão de produto** (muda métrica, fluxo, permissão, nomenclatura) → **pergunta**; não implementa de bandeja.
Priorize por **impacto × esforço**: primeiro o que confunde a ação principal e o que quebra no celular/tema claro; depois polimento.

## Passo 5 — Corrigir (regras de implementação)
1. **Só no `-dev`** (nunca `kanban.html`/`painel.html`/`oceano.html`… direto). Bug de produção urgente é outro fluxo (`/subirproprod`).
2. **Tokens, não cores cruas** (`var(--accent)`, `rgba(var(--surface-rgb),.97)`…); **componentes da casa** (`showToast`, `uiConfirm`, `.ov/.panel`, `<details class="pt-bucket">`, chips/abas do arquivo). Componente novo só se nenhum serve — e aí nasce nos 3 temas e no celular.
3. **Uma cor = um significado; estado = cor + ícone + texto; uma informação em um lugar só** (guia 3 e 1.3). Corte o que repete.
4. **Todos os estados** (vazio, carregando, erro, sem permissão, muito dado) com texto no tom da casa (guia 5.2 e 11).
5. **Mobile/toque:** uma coluna, alvos ≥ 44 px, nada só-hover, campos 16 px, zero rolagem lateral; use `(hover:none) and (pointer:coarse)` para toque, não só largura (guia 8).
6. **Acessibilidade:** teclado, foco preservado ao redesenhar (por `data-*`, nunca por texto de `onclick`), `aria-label` em ícone-botão, `prefers-reduced-motion` em animação nova (guia 9).
7. **Sem refatorar além do necessário**; sem mexer em dado/métrica sem declarar. Mudou texto/ícone numa página? `grep` as páginas irmãs (a cópia esquecida é o achado mais comum).
8. **Não leia mais dado no boot** do que antes; leitura nova é **sob demanda** (guia 10).
9. **Segurança:** o que a tela mostra como restrição precisa existir em `database.rules.json` (guia 1.5). Valor que vai para atributo/JS inline usa `jsq()`/`esc()`.

## Passo 6 — Testar
- **Teste novo** em `docs/arezzo/testes/test_<tela>_ui.js` (boot real + Firebase falso): o que foi corrigido **e** os casos extremos (vazio, N squads, texto longo), em **1280 e 390 px**, nos **3 temas**; assert de **sem rolagem lateral**. Mantenha as suítes vizinhas sem regressão.
- `node --check` nos `<script>` (ou `node scripts/checar.js`, que já faz) e `cd functions && npm test` se tocou em `functions/`.
- Compare **antes × depois** (screenshots) — guarde o que for útil para a descrição do PR.

## Passo 7 — Registrar e entregar (guia 15)
1. **Versão** do `-dev` + `version.json` (`node scripts/mare-cli.js bump <alvo>`); `?v=` se mexeu em módulo (aí é Claude).
2. **`CHANGELOG.md`** (`node scripts/mare-cli.js log --type feature …`, "SÓ DEV") com **o que estava ruim → o que ficou**, e **`BUGS_E_CORRECOES.md`** para o bug achado de passagem (data · arquivo real · versão real). Nomes de arquivo e versão **só depois de conferir** (`ls`/`grep`).
3. **Dica?** (regra 7 do `CLAUDE.md`) — diga **"dica: sim, X"** ou **"dica: não, porque Y"** (redesenho de tela que já é usada costuma ser **não**).
4. **Ajuda in-app** (`/atualizarhelpcontent`) se o comportamento descrito mudou; `CODE_MAP.md`/`CODE_MAP_FAST.md` (`mare-cli.js map`) se nasceu âncora.
5. **Script de teste de console** em português (só leitura, só nomes que existem no `-dev`, `console.table` ✅/❌ — `/monitorarbugs`, Passo 6) para o Caio/ADM validar **antes** de promover.
6. Commit com trailer `Agent: claude`/`Agent: antigravity`, branch `claude/…`/`antigravity/…`, **PR** (nunca merge do próprio PR). Promoção só após validação explícita (**correção sobe na hora; redesenho entra no lote diário**).

## Formato da resposta final
1. **Escopo** (1 linha) e **para quem** é a tela.
2. **Achados** (tabela: tela · o que estava ruim · por quê (regra do guia) · classe 🐞/🎨/🧭 · feito?).
3. **O que mudou** (antes → depois, em termos de uso, não de código) + prints/descrição.
4. **Decisões de produto pendentes** (perguntas objetivas) e **o que não foi feito e por quê**.
5. **Como validar** (passos curtos, no `-dev`, em celular e no tema claro) + o script de console.
6. **Dica:** sim/não + versões e PR.

## Armadilhas desta rotina (aprendidas)
- **Dado de exemplo mente:** renderize com poucos **e** muitos itens; a 3ª squad que "nunca aparecia" só aparecia assim.
- **Cor repetida ≠ identidade:** cor de coluna usada como identidade de squad virou "tudo a mesma cor".
- **Esticar o vizinho para alinhar** deforma com 2 itens — alinhe o **topo**.
- **`title=` não existe em toque:** botão só-ícone precisa de texto visível/ajuda.
- **`innerHTML` perde foco e rascunho:** sincronize antes ou atualize no lugar.
- **Seletor montado com o texto de um `onclick`/`jsq()` nunca casa** (aspas escapadas): use `data-*` + `CSS.escape`.
- **Redesign que muda número**: declare a mudança; a pessoa compara com o que lembrava.
- **Fake Firebase:** reabrir um 2º card com o `fakefb` entra em laço síncrono no `_checkCardLock` (artefato do teste); para "trocar de card" use `openNewCard()`.
- **Empilhar `backdrop-filter`** pesa no celular; o vidro de dentro não leva blur.

## Histórico de rodadas (não repetir análise já feita)
Formato: data · tela · achados · versão. Consulte também `CHANGELOG.md` (busque "UI/UX") e `docs/changelog-archive-2026-07-a-09.md`.
- **2026-09-02 · modal do card (celular):** redesenho estilo Trello sem rolagem lateral (v8.30.541-dev).
- **2026-09-23 · iPad/toque (Maré):** zoom de campo < 16 px, botões só-hover invisíveis, teclado virtual cobrindo campo; critério passou a ser `(hover:none) and (pointer:coarse)` (v8.30.734-dev). Sinalizado e não corrigido: 278 `title=` como única explicação de botão só-ícone.
- **2026-10-01 · Radar/OKR (aba e modal):** histórico recolhido quando longo, "Cards vinculados" recolhido quando vazio, status do Marco reforçado por borda lateral (painel-dev v3.85–v3.86).
- **2026-10-05/06 · Radar:** modais com seções coloridas e paleta do Vice City; 📈 Histórico semanal redesenhado (v3.97–v4.3).
- **2026-10-09 · Radar › Dashboard:** KPIs repetidos cortados, um número grande + linha no desenho do atingimento, sem eixo duplo, tabela por pior situação (okr-dev v2.58).
- **2026-10-10 · Painel › Visão e Fluxo:** cor = squad (cheia/clara/vermelha), uma pergunta por visão, "Parado há mais tempo" (mudança de métrica **de propósito**), filtro de squad que nunca nascia (painel-dev v5.36–v5.37).
- **2026-10-16 · Oceano:** plantão separado por audiência (usuário no Oceano, ADM no Painel); cartão da Meta alinhado pelo topo (oceano v1.48–v1.50). **Metas:** projeção como "volta fantasma" no anel e linha no gráfico (mare-metas v16).
- **2026-10-16 · Maré › Atalhos:** foco do botão "Definir" (bug) + combinações reservadas do navegador (v8.30.875-dev).

Atualize esta seção a cada rodada nova (1–3 linhas: tela, achados, versão/PR).
