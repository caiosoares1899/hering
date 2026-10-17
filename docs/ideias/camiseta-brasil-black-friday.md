# 👕 Camiseta Brasil que "ganha forma" conforme a meta (ideia — fazer na volta das férias do Caio, a partir de 04/11/2026)

> Status: **ideia desenhada, nada implementado.** Pedido do Caio em 16/10/2026. Black Friday 2026 = 27/11, então há folga; o que mais pode atrasar é a **arte oficial**.

## O pedido
A Hering lançou a nova Camiseta Brasil e, na Black Friday, haverá uma meta específica só para ela. Dentro do Oceano, uma **grande camiseta que vai ganhando forma** conforme a meta é atingida, até aparecer inteira em **100%**.

## Como seria (proposta do Claude)
Reaproveita o módulo **`mare-metas`** (percentual = realizado ÷ alvo, `esperado`, `projecao`, marcos de 20 %). A camiseta é só mais uma forma de mostrar o mesmo número do anel, e cresce **ao vivo** porque as páginas já escutam a meta no Firebase.

1. **Enchimento contínuo:** SVG com uma cópia apagada (contorno/cinza) por baixo e a versão colorida por cima, recortada por um retângulo que **sobe** com o percentual; ondinha animada na borda de cima (tema Oceano).
2. **Peças nos marcos de 20 %** (já existe popup + buzina de navio): 20 % contorno com a gola · 40 % uma manga · 60 % a outra manga · 80 % o corpo estampado · 100 % escudo e estrelas, camiseta inteira e confete.
3. **Projeção como "volta fantasma":** contorno tracejado mostra até onde a camiseta estaria se mantivermos o ritmo atual (mesmo conceito do anel).

**Onde aparece:** cartão da **Meta Global na home do Oceano** (principal) · **modo telão** em tela cheia para TV (algo como `oceano.html?telao=camiseta`) · opcional: aba Dados do Maré e do Painel.

## O que precisa ser feito
- **Código (~200 linhas de SVG/CSS):** função nova no `mare-metas-dev.js` (`camisetaHtml`), campo novo na meta ("visual: anel | camiseta" + qual arte), camiseta no cartão do Oceano. Respeitar `prefers-reduced-motion`, celular e texto alternativo ("73 % da meta").
- **Dados:** o campo fica dentro da própria meta (sem nó novo); as regras do banco podem precisar de uma linha para aceitar o campo → `firebase deploy --only database` (só o Caio).
- **Testes:** Firebase falso (`docs/arezzo/testes/fakefb.js`) + Playwright conferindo 0 %, 35 % e 100 % e o disparo dos marcos.
- **Fluxo normal do repositório:** dev primeiro (`mare-metas-dev.js` + `oceano-dev.html`), validação do Caio, promoção; módulo compartilhado → Claude (ver `docs/COORDENACAO_AGENTES.md`). Avaliar **dica** (regra 7 do `CLAUDE.md`).

## Decisões em aberto (perguntar ao Caio na volta)
1. **A arte:** desenho oficial da Camiseta Brasil em SVG (ou PNG transparente em alta resolução) do time de design. Sem ela, começa com uma camiseta genérica nas cores do Brasil e troca depois.
2. **Estilo:** enchimento, peças, ou os dois (recomendação: os dois).
3. **Onde mostrar:** só Oceano, ou também Maré e Painel.
4. **A meta:** alvo, período e indicador (é a base do percentual).

## Ordem sugerida
PR 1 de dev só com o enchimento no Oceano (para ver funcionando) → PR 2 com as peças e o popup → PR 3 com o modo telão. Antes disso, rodar `/seatualizar` e conferir se `mare-metas-dev.js` está livre no Quadro.
