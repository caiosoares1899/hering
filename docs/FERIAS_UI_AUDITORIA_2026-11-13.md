# Auditoria de UI/UX — modo Férias — 13/11/2026

Escopo: calendário geral, Minhas férias e 🧳 Preparar minha saída no Maré e no Radar. Público: integrantes do Digital que consultam ausências, cadastram seus períodos e organizam a cobertura antes de sair.

Base: `origin/main` **87b937c4**; Maré **v8.30.982-dev**, Radar **v2.130**, `mare-ferias-dev.js` **v3**. Esta entrega contém auditoria, evidências e escalonamento. **Não altera a interface nem publica correções.**

## Método e prova

- Boot real das páginas com `fakefb.js`, sem conexão com Firebase real. Dados inteiramente sintéticos.
- 36 combinações: Maré/Radar × 1280×900/390×800 × Abrolhos/Lençóis/Vice × vazio/poucos/muitos. O cenário muitos tem 54 pessoas adicionais, quatro squads adicionais e mais de 50 itens para passagem.
- Um cenário visual adicional em tablet 834×1112, toque e ADM. Quatro cenários focados confirmam fontes e teclado nos dois apps em 390/834 px.
- Os papéis membro, PO, ADM e visualizador externo são cobertos também pela regressão existente do calendário; nenhuma permissão foi alterada.
- Roteiros: `docs/arezzo/testes/auditar_ferias_ui.js` e `auditar_ferias_ui_foco.js`. Medem a linha de base, **não atestam aprovação da rubrica de UX**. As falhas abaixo continuam presentes.
- Evidências: [capturas e medidas](capturas/ferias_ui/). Capturas completas são regeneráveis pelo roteiro; exemplos representativos foram preservados no repositório.
- Regressões existentes: `test_ferias_calendario.js` **28 verificações aprovadas**; `test_ferias_saida.js` **45 aprovadas**.

## Achados priorizados

| ID · prioridade | Cenário e problema observado | Regra do guia | Classe | Encaminhamento |
|---|---|---|---|---|
| UI01 · alta | **Maré, claro/Vice:** datas dos períodos quase somem. O token herdado produz `rgb(51,214,208)` sobre superfície quase branca no claro e `rgb(156,111,138)` sobre roxo no Vice. A heurística aponta aproximadamente **1,76:1 / 3,04:1**, abaixo de 4,5:1; confirmado visualmente. Radar claro usa outro token e não reproduz esse caso. | §§2.2, 3.4; cor de texto precisa funcionar na página que hospeda o módulo. | 🎨 design | No módulo, usar cor segura para texto nos períodos, sem mudar a paleta global das páginas. Reavaliar também mensagens auxiliares. |
| UI02 · alta | **Atalho Minhas férias em 390 px:** mostra primeiro a agenda geral, e o cadastro fica fora da primeira tela. Topo do formulário: **895 px no Maré / 1176 px no Radar**, mesmo vazio; com muitos períodos, **7312 / 7593 px**. A pessoa precisa atravessar as listas e a grade para cadastrar ou preparar a saída. | §§1.1, 5.1, 8; entrada deve levar ao objetivo da ação. | 🎨 design | Fazer o atalho chegar ao bloco pessoal com foco/rolagem corretos. Uma reordenação geral da vista exige decisão de desenho; não foi aplicada. |
| UI03 · alta | **Preparar minha saída, teclado:** Tab a partir do último controle habilitado sai do diálogo e alcança a página sob o véu. Reproduzido nos dois apps, também no tablet. `aria-modal` sozinho não contém o foco. | §9; teclado e modal acessível. | 🐞 bug | Conter Tab/Shift+Tab no diálogo, preservar Esc e devolver foco ao elemento que abriu a tela. |
| UI04 · média | **Filtros de período/squad:** o seletor focado é destruído por `desenhar()` e o foco cai no body após a mudança; quebra a sequência de navegação por teclado. Rascunho de observação foi preservado, portanto não se trata de perda do texto. | §9; foco preservado após redesenhar. | 🐞 bug | Restaurar o seletor por `data-filtro`, sem parsing de `onclick`; testar em ambos os apps. |
| UI05 · alta | **Passagem com 50+ itens e título longo:** 55 títulos cortados no Maré e 54 no Radar em 390 px. O fim do texto distingue a tarefa e fica escondido; `title` não resolve no toque, e a revisão também usa linha truncada. | §§8, 9, 11; dado precisa ser legível na hora de decidir. | 🎨 design | Permitir leitura completa do título na lista/revisão, por quebra de linhas ou expansão explícita acessível. Sem mudar o conjunto de itens ou quem recebe. |
| UI06 · média | **Toque:** barras mensais medem cerca de **20 px de altura**; setas de navegação **35–37×44 px** e editar/excluir **40×44 px** em 390 px. Tablet tem controles com **28–34 px de altura** nos dois apps. | §8; área de toque ≥44×44, critério por capacidade e não só largura. | 🎨 design | Garantir alvo de toque pelo `pointer:coarse`, incluindo barras e ícones, preservando a grade em rolagem interna. |
| UI07 · média | **Radar, tablet 834 px com toque:** inputs/selects de férias ficam com **12 px**, altura 28–30 px. No celular dos dois apps e no tablet do Maré, a medição real confirmou **16 px**; esses casos não são achados de fonte. | §8; campos de toque ≥16 px. | 🎨 design | Aplicar a regra de toque no módulo compartilhado sem depender do CSS herdado de uma das páginas. |

**Estado de todos os achados: reproduzidos e escalados; nenhuma correção aplicada.**

## Reprodução e critérios de aceite para a implementação

1. Entrar em dev como membro, no celular, e escolher **Minhas férias** pelo nome (Maré) ou ⋯ Mais (Radar). O cadastro deve ser alcançável imediatamente pelo atalho, inclusive com dezenas de períodos de outras pessoas.
2. No Maré claro e Vice, ler datas dos períodos sem esforço. Medir contraste após composição do vidro e revisar a captura; o valor de contraste do harness é uma aproximação para localizar problemas, não um laudo WCAG.
3. Abrir 🧳 Preparar minha saída com títulos longos. Ler o conteúdo inteiro antes de Manter/Passar e na revisão; nenhuma decisão pode vir pré-marcada.
4. Usar Tab e Shift+Tab no diálogo: foco fica dentro. Esc fecha e o foco volta ao botão de origem.
5. Focar um filtro e mudá-lo por teclado: o foco permanece no mesmo controle após atualizar os resultados. O rascunho digitado continua intacto.
6. Repetir em 390 px e tablet com toque, três temas: campos ≥16 px e alvos ≥44×44 px. Manter zero transbordamento horizontal da **página**; a grade pode continuar com rolagem dentro do contêiner.
7. Reexecutar regressões de calendário e saída; só o ✅ Confirmar aplica mudanças; externo não vê a vista e PO não edita férias alheias.

Console de validação, somente leitura: [console_ferias_ui.js](arezzo/testes/console_ferias_ui.js). Abra a vista Férias antes de colar; alguns ❌ são esperados nesta linha de base. O script não modifica dados, não imprime nomes e não faz o teste interativo de foco automaticamente.

## O que está bom e deve ser preservado

- Zero transbordamento horizontal da página e dos hosts auditados; a grade mensal já contém sua própria rolagem.
- Nenhum erro JavaScript ou execução do payload HTML nos 37 cenários visuais.
- Rascunho preservado ao mudar filtros; confirmação explícita antes de passar itens; sem decisões pré-marcadas.
- Férias seguem como organização do time, com aviso do Senior; matriz de papéis e regras preservada.

## Limite de autoria e próximo passo

A skill `.agents/skills/melhoriauiux/SKILL.md`, em **Quem faz o quê**, reserva ao Claude: **“módulo compartilhado (`mare-*-dev.js`)”**. `AGENTS.md` também exige escalar módulo compartilhado/redesenho ao Claude. A maior parte dos achados está na renderização/CSS de `mare-ferias-dev.js`; não se deve duplicar correções nos dois HTMLs para contornar essa divisão.

Escalar ao Claude com este relatório, roteiro e capturas. Não houve redesenho de fluxo, alteração de métrica, permissão ou dado. A decisão entre reposicionar a seção pessoal e apenas direcionar o atalho permanece no desenho da implementação; nenhuma decisão nova do Caio foi presumida.

Não verificado: navegador/teclado reais de iPhone e iPad, leitor de tela real, rede corporativa, banco real e validação por ADM no ambiente publicado. Não há antes/depois de correção porque esta entrega é a linha de base.

**Fronteira:** sem mudança; somente testes locais e documentação, sem alteração de sink, URL, regra ou escrita de aplicação.

**Dica:** não, esta entrega não adiciona comportamento visível. **Versões mantidas**, sem promoção, merge ou deploy.
