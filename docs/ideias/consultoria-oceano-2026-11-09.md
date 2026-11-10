# Oceano — consultoria de produto: Radar, Travessia e lobby

9 de nov. de 2026 · @caio

> Original: [artifact da consultoria](https://claude.ai/artifact/P4AH1hEuDkdW2dPpDaAvhC). Cronograma de execução: [linha do tempo](https://claude.ai/artifact/1ToXAwyibMPL4sVNLkkAnD) e card "Oceano · Radar, Travessia e lobby em 8 sprints" (squad dados).
> Decisão do Caio (10/11/2026): todos os itens aprovados, menos **R7** e **R8** (backlog). O cronograma em sprints é **sugestão**, não ordem fixa: a execução se ajusta no caminho.

## 1. Como eu li o ecossistema

O Oceano já tem o que os concorrentes cobram caro: os dados ligados entre si. O que falta é cada produto dizer à pessoa o que fazer agora, em vez de esperar que ela venha cadastrar e consultar.

Li `oceano-dev.html`, `okr-dev.html`, `travessia-dev.html`, as regras de `kanban/travessia` e `kanban/okr` em `database.rules.json`, `docs/OCEANO.md`, `docs/ideias/travessia-2026-10-22.md`, `CLAUDE.md` e os trechos do `CODE_MAP.md` de cada página. Não rodei as telas no navegador: tudo abaixo vem da leitura do código, então trate afirmações visuais (densidade, alinhamento) como hipóteses a conferir na tela.

A lógica, em uma frase por produto:

- **Maré** é onde o trabalho acontece (cards).
- **Radar** é para onde o trabalho aponta: Objetivo, com Marcos e uma meta medida (o atingimento).
- **Travessia** é o que o trabalho faz pela pessoa: Baú, 1:1, avaliação.
- **Oceano** é a porta: login único, Mural, Meta Global, menu de produtos e host em iframe.
- **Painel** é a visão de quem coordena.

**A tese.** Hoje os três produtos que analisei são sistemas de registro. O Radar depende de alguém lembrar de mudar um status. A Travessia registra a data do 1:1, mas não a conversa. O lobby mostra os produtos, mas não o meu dia. O salto de patamar é virar sistema de ritual, com três movimentos:

1. **O Radar passa a calcular.** Ritmo esperado contra realizado, status sugerido e um check-in guiado de 2 minutos.
2. **A Travessia ganha o miolo que o nome promete.** 1:1 com pauta e ações, e o PDI como rota. Hoje nenhum dos dois existe no código.
3. **O lobby vira o meu dia.** Uma faixa que junta o que pede a minha atenção nos três produtos e abre cada um já no lugar certo.

Nada disso exige mudar a arquitetura (página única, sem build, Firebase). Das 21 propostas, 17 não tocam em regra do banco nem em função.

## 2. Todas as propostas, para você marcar

A coluna "Sua decisão" diz o que o prompt da seção 8 executa: só o que estiver com **sim**.

**Legenda.** Esforço **P** = um PR pequeno, numa sessão curta. **M** = uma sessão inteira, um PR. **G** = vários PRs. "Deploy seu" = precisa de `firebase deploy` na sua máquina (regra do banco ou função); o resto publica sozinho pelo Pages.

| ID | Proposta | Impacto | Esforço | Deploy seu | Minha recomendação | Sua decisão |
|---|---|---|---|---|---|---|
| R1 | Radar: ritmo esperado contra realizado | Alto | M | Não | Fazer primeiro | sim |
| R2 | Radar: check-in guiado de 2 minutos | Alto | M | Não | Fazer | sim |
| R3 | Radar: faixa "Pra você" no topo | Alto | P | Não | Fazer | sim |
| R4 | Radar: status sugerido pelo sistema | Médio | P | Não | Fazer depois do R1 | sim |
| R5 | Radar: confiança no check-in | Médio | P | Não | Opcional | sim |
| R6 | Radar: cartão do Objetivo mais enxuto | Médio | P | Não | Fazer | sim |
| R7 | Radar: vários resultados-chave por Objetivo | Alto | G | Função | Só se o time pedir | depois (backlog) |
| R8 | Radar: evidência dos cards no Objetivo | Médio | M | Não | Depois | depois (backlog) |
| T1 | Travessia: 1:1 com pauta, notas e ações | Alto | P + M | Regra (etapa B) | Fazer; etapa A já | sim |
| T2 | Travessia: PDI como rota | Alto | G | Regra | Fazer; é o miolo | sim |
| T3 | Travessia: início como rota visual | Médio | M | Não | Fazer junto do T2 | sim |
| T4 | Travessia: cartão "próxima ação" | Alto | P | Não | Fazer primeiro | sim |
| T5 | Travessia: Baú oferecido na hora da conclusão | Médio | P | Não | Fazer | sim |
| T6 | Travessia: Frota como fila de atenção | Alto | M | Não | Fazer | sim |
| T7 | Travessia: avaliação com rascunho e progresso | Médio | P | Não | Fazer | sim |
| T8 | Travessia: humor com aviso antes e desfazer | Médio | P | Não | Fazer | sim |
| O1 | Oceano: faixa "Hoje" com o meu dia | Alto | P + G | Função e regra (fase 2) | Fazer a fase 1 | sim |
| O2 | Oceano: paleta de comando | Médio | M | Não | Depois | sim |
| O3 | Oceano: abrir a porta da Travessia por vínculo | Médio | P | Não | Decisão sua | sim |
| O4 | Oceano: abas de "venda" fora da navegação diária | Baixo | P | Não | Fazer | sim |
| O5 | Família: um vocabulário de estado só | Médio | P | Não | Fazer | sim |

## 3. Radar

O Radar é o produto mais maduro dos três, e o problema dele é um só: quase tudo que ele mostra foi digitado por alguém. O status do Objetivo é o pior status manual entre os Marcos (`_okrObjStatus`). A barra é o último valor lançado (`_okrAtingPctObj`). Ninguém compara isso com o tempo que já passou do trimestre.

### R1. Ritmo esperado contra realizado

**Hoje.** Um Objetivo com 40% de atingimento aparece igual no dia 10 e no dia 80 do trimestre. O gráfico (`_okrAtingChartHtml`) só tem a linha da meta. O módulo de Metas já tem Projeção de Fechamento; o Radar não.

**Proposta.** Calcular, para todo Objetivo com meta numérica, o quanto deveria estar feito hoje (linear entre o início e o fim do período) e classificar em quatro faixas: adiantado, no ritmo, atrás, muito atrás. Mostrar também onde fecha se mantiver o ritmo.

**Na tela.**
- No cartão: um traço vertical na barra marcando o esperado de hoje, e um rótulo curto ("8 pontos atrás").
- No gráfico: uma diagonal pontilhada do valor inicial até a meta.
- Na faixa de resumo: um chip "N atrás do ritmo", clicável como filtro, igual ao de parados.

**Custo e risco.** Só `okr-dev.html`, função pura, sem banco. O ponto delicado é descobrir as datas do período a partir de `trimestres[]`; o desenho está na seção 6.1. Não se aplica a metas dos tipos binário, data, perene, manter acima e manter abaixo.

### R2. Check-in guiado de 2 minutos

**Hoje.** Atualizar um Objetivo é abrir o modal, achar a seção, lançar, salvar, fechar, e repetir para o próximo. Existe o lançamento rápido (`_okrAtingQuickOpen`), mas ele cobre só o valor e um Objetivo por vez. O selo de 14 dias sem atualização (`_okrObjParadoDias`) acusa o problema, mas não ajuda a resolver.

**Proposta.** Um botão "Fazer meu check-in" que abre uma fila só com os Objetivos em que sou responsável, um por tela, com quatro perguntas fixas: valor de hoje, status de cada Marco ativo, próximo passo, algum risco novo. Enter avança, "pular" existe, e o final mostra um resumo do que foi gravado.

**Na tela.** Um modal estreito com "2 de 5" no topo. Cada tela mostra o valor anterior e o ritmo (R1) como contexto. Na véspera do bloco quinzenal, a notificação que já existe passa a abrir direto na fila.

**Custo e risco.** Reaproveita `_okrAtingQuickSalvar` e `_okrTx` (escrita por transação), então não cria um caminho de escrita novo. Precisa respeitar a trava de edição (`_okrLockInfo`): Objetivo travado por outra pessoa é pulado com aviso. Desenho na seção 6.2.

### R3. Faixa "Pra você" no topo

**Hoje.** A entrada é a escolha de torre (`_okrRenderHome`) ou, no modo só Hering, a lista inteira. Para ver só o meu é preciso abrir "Mais filtros" e escolher a pessoa. O cartão já recebe a classe `okr-mine`, mas isso é só um destaque.

**Proposta.** Uma faixa acima da lista com até quatro números meus, cada um clicável: meus Objetivos, parados, atrás do ritmo, Marcos que vencem em 14 dias. Quem não é responsável por nada não vê a faixa.

**Custo e risco.** Tudo sai dos dados já carregados e do filtro `__eu` que já existe. Zero leitura nova. É a proposta de melhor relação impacto por esforço do Radar.

### R4. Status sugerido pelo sistema

**Hoje.** Um Marco com prazo vencido continua "no prazo" até alguém mudar.

**Proposta.** O sistema não sobrescreve nada; ele mostra a divergência. Marco vencido e não concluído ganha a sugestão "atrasado". Objetivo muito atrás do ritmo (R1) ganha a sugestão "risco". Um clique aceita a sugestão, e o aceite entra no histórico como qualquer edição.

**Custo e risco.** Pequeno, mas depende do R1. O risco é de tom: a sugestão precisa parecer ajuda, não cobrança. Texto sugerido: "O prazo passou em 03/11. Marcar como atrasado?".

### R5. Confiança no check-in

**Hoje.** Status diz como está; ninguém registra o quanto acredita que vai bater a meta.

**Proposta.** Uma pergunta a mais no check-in: "Vai bater?" com três respostas (sim, talvez, difícil). O Dashboard mostra quantos mudaram de resposta na semana. É o sinal que costuma antecipar o atraso em algumas semanas.

**Custo e risco.** Campo novo no Objetivo. As regras de `kanban/okr/objetivos` não validam campo por campo, então não há deploy. Só vale a pena se o R2 existir. Opcional: é mais um campo para preencher.

### R6. Cartão do Objetivo mais enxuto

**Hoje.** O cartão (`_okrObjCardHtml`) carrega, na mesma hierarquia: setas de reordenar, botão de prévia, chip de trava, título, torre, status, trimestres, pilar, selo de parado, selo de fora da apresentação, tags, chip do calendário, avatares, ícone do tipo de meta, percentual, contagem de Marcos e barra. E falta a informação mais útil: qual é o próximo Marco e quando vence.

**Proposta.** Três níveis. Primeiro: título e estado (status e ritmo). Segundo: a barra com percentual. Terceiro: uma linha "Próximo: nome do Marco, em 6 dias" e os avatares. Reordenar e prévia aparecem só ao passar o mouse (já estão no menu de botão direito). Trimestre, pilar e tags viram uma linha discreta, cortada com "+2".

**Custo e risco.** Só HTML e CSS do cartão. No toque não existe hover: ali os controles ficam no menu de contexto por toque longo, que já existe. Conferir nos três temas.

### R7. Vários resultados-chave por Objetivo

**Hoje.** Cada Objetivo tem um único atingimento. `indicadores[]` são frases, não medidas. Na prática o Radar é "Objetivo e Marcos", não "Objetivo e Resultados-Chave".

**Proposta.** `krs: [{id, titulo, peso, atingimento}]`, com o percentual do Objetivo como média ponderada. O atingimento atual vira o primeiro resultado-chave, sem migração destrutiva: quem não tem `krs` continua lendo `atingimento`.

**Custo e risco.** É a maior mudança do documento. Toca o motor de atingimento (que tem uma cópia em `okr-apresentacao.slide.html`), o snapshot semanal (`functions/okr/weeklySnapshot.js`), as ferramentas do Agente Ágil e a Ajuda. Recomendo só se os gestores estiverem pedindo mais de uma métrica por Objetivo; hoje eles podem estar resolvendo isso criando dois Objetivos, e aí o ganho é pequeno. Pergunta para você levar ao time antes de decidir.

### R8. Evidência dos cards no Objetivo

**Hoje.** A aba Cards lista os cards com selo OKR e o vínculo existe, mas o cartão do Objetivo não conta nada sobre eles. A promessa do lobby ("o Radar enxerga o que o Maré entrega") está escondida numa aba.

**Proposta.** No modal do Objetivo, uma linha "7 cards vinculados, 4 concluídos, 1 bloqueado", com o bloqueado em destaque. No cartão, só um selo quando houver card bloqueado.

**Custo e risco.** O cuidado é banda: a carga de cards por squad (`_okrSquadOkrCards`) é sob demanda de propósito. A contagem deve aparecer só depois que a pessoa abrir o modal ou a aba Cards, nunca no carregamento da lista. Conferir antes se o vínculo é por Objetivo ou por Marco.

## 4. Travessia

A Travessia tem a base mais difícil pronta (regras de quem lê o quê, com testes) e o miolo ainda por fazer. O desenho de 22/10 fala em rota, portos, PDI e pauta de 1:1. O que está no código é: Baú, Diário, humor, faróis de cadência, avaliação em texto, Frota e administração. O 1:1 é um registro de data. O PDI não existe. A metáfora da viagem aparece só num emoji de barco no topo.

Isso tem uma consequência de produto: hoje a pessoa abre a Travessia para ser medida (humor, farol, avaliação) e para guardar coisas, mas não para crescer. As propostas T1 e T2 corrigem isso.

### T1. 1:1 com pauta, notas e ações

**Hoje.** O formulário é data e tipo, com o botão "Registrei um 1:1". As regras já aceitam um campo `nota` de até 280 caracteres em `encontros/{uid}/{id}`, mas a tela não usa. O farol mede se a conversa aconteceu, não se serviu para algo.

**Proposta em duas etapas.**
- **Etapa A, sem deploy.** Um campo "O que combinamos" no registro, gravado em `nota`. Aparece na lista de registros dos dois lados. Em um PR pequeno o 1:1 deixa de ser só um carimbo.
- **Etapa B, com regra nova.** Pauta compartilhada (os dois adicionam itens antes da conversa) e ações com dono e prazo. Item de pauta não marcado como conversado e ação não concluída passam sozinhos para o próximo encontro, com um selo "herdado".

**Na tela.** No Início, o bloco do 1:1 passa a ter três partes: o farol, "Para a próxima conversa" (pauta) e "Combinados em aberto" (ações). O líder vê o mesmo bloco ao abrir a pessoa na Frota.

**Custo e risco.** A etapa B cria dois nós e portanto uma fronteira de confiança nova: regras e testes de regras antes da tela. Modelo e regras desenhados na seção 6.3. Notas privadas do líder ficam de fora desta proposta de propósito: são outro nó, com outra conversa de backup (seção 12.3 do desenho de 22/10).

### T2. PDI como rota

**Hoje.** Não existe. É o item central do pedido original e o que dá nome ao produto.

**Proposta.** Um plano curto por ciclo, com 2 a 4 focos. Cada foco tem uma competência, um porquê e ações de três tipos (na prática, com pessoas, estudo). Cada ação pode apontar para um card do Maré ou um Marco do Radar. O líder lê e comenta; quem escreve é a pessoa. O agente fica para uma segunda etapa: primeiro o PDI manual precisa ser usado.

**Na tela.** Uma aba "Rota" entre Início e Baú. Cada foco é um cartão com anel de progresso e as ações como lista de marcar. Um item do Baú pode ser anexado a um foco como evidência, o que fecha o ciclo: Baú alimenta PDI, PDI alimenta autoavaliação.

**Custo e risco.** Regra nova e, por ser dado de desenvolvimento individual, entra na mesma conversa de LGPD já aberta com o DPO. Três PRs: regras e testes, tela da pessoa, visão do líder. Modelo na seção 6.3. Limite de 4 focos é regra de produto, não detalhe: PDI com 9 focos não é executado.

### T3. Início como rota visual

**Hoje.** O topo é uma saudação com um barco decorativo. Abaixo, seis blocos empilhados com o mesmo peso.

**Proposta.** Trocar o topo por uma linha do tempo do ciclo atual: uma faixa horizontal com o início e o fim do ciclo, um ponto para cada 1:1 realizado, um para cada item guardado no Baú, as fases da avaliação como trechos, e o barco na data de hoje. Com o T2, os focos do PDI viram os portos.

**Custo e risco.** Usa só o que o Início já carrega (encontros, Baú, ciclos): zero leitura nova. Função de desenho na seção 6.4. No celular a faixa rola na horizontal ou mostra só as últimas 8 semanas. Respeitar `prefers-reduced-motion`, como o barco atual já faz.

### T4. Cartão "próxima ação"

**Hoje.** A pessoa precisa ler a página toda para descobrir o que está pendente: humor, fechamento do dia, pares a indicar, autoavaliação, 1:1 atrasado, devolutiva liberada para ciência.

**Proposta.** Um único cartão no topo, escolhido por prioridade, com um verbo e um botão. Exemplos: "Sua devolutiva foi liberada. Ler agora"; "Faltam 2 respostas na sua autoavaliação"; "Bia pediu seu feedback"; "Seu último 1:1 foi há 19 dias". Quando não há nada, o cartão some.

**Custo e risco.** Função pura sobre o que já está em memória. Pequeno e de efeito imediato. Ordem de prioridade na seção 6.5.

### T5. Baú oferecido na hora da conclusão

**Hoje.** O Baú depende de a pessoa lembrar de clicar no botão de guardar em cada card ou Marco. Quem não lembra chega à avaliação com o Baú vazio, que é justamente o viés de recência que ele deveria evitar.

**Proposta.** Quando eu concluo um card meu no Maré, ou um Marco em que sou responsável no Radar, o aviso de sucesso ganha um botão "Guardar no Baú". Um clique, sem formulário. No máximo uma oferta por card.

**Custo e risco.** Não lê nada: a oferta acontece no momento em que o dado já está na mão. Toca `kanban-dev.html` e `okr-dev.html`, não a Travessia. Conferir antes se o gancho do Meu Dia já faz algo parecido; o que encontrei no Radar é só o botão manual (`_okrMarcoParaTravessia`). Evitei de propósito a alternativa "sugestões da semana", que exigiria ler cards de vários squads.

### T6. Frota como fila de atenção

**Hoje.** A Frota é uma grade de cartões em ordem alfabética. O detalhe da pessoa é montado depois de todas as grades (`viewDetalhe` no fim de `viewFrota`), então num time de 8 ele fica longe do cartão clicado.

**Proposta.**
- Ordenar por urgência: aviso de apoio, farol vermelho, amarelo, sem cadência, verde.
- Uma frase de resumo no topo: "3 pessoas pedem atenção esta semana".
- Detalhe num painel lateral no desktop e em tela cheia no celular, em vez de no rodapé.
- Em cada cartão, uma faixa de 12 quadradinhos (uma por semana) mostrando em quais houve 1:1. O farol diz como está hoje; a faixa diz se é um padrão.

**Custo e risco.** Só `travessia-dev.html`, com os encontros que já são lidos. Função da faixa na seção 6.6. A faixa é um sinal para o líder se organizar; não deve virar ranking entre líderes na visão do gerente.

### T7. Avaliação com rascunho e progresso

**Hoje.** São até 4 caixas de 2.500 caracteres com um botão Salvar. O `render()` preserva o texto entre redesenhos, mas só em memória: fechar a aba ou a atualização automática de versão perde o que não foi salvo.

**Proposta.** Rascunho automático no aparelho a cada pausa de digitação, com "rascunho guardado neste aparelho" ao lado do botão. Contador "2 de 4 respondidas". Aviso ao sair com texto não salvo. O rascunho local é apagado ao salvar e ao sair da conta.

**Custo e risco.** Pequeno. A chave do rascunho leva o uid, para não vazar entre contas no mesmo navegador. Texto de avaliação em `localStorage` é aceitável num aparelho pessoal; por isso a limpeza no logout.

### T8. Humor com aviso antes e desfazer

**Hoje.** Um toque na carinha grava em `humor` e `humor_comp` e, se for "mal" ou "muito mal", chama `alertaApoio`, que notifica o líder na hora. A explicação de quem vê fica num parágrafo pequeno abaixo das carinhas. Um toque errado no celular avisa o líder de algo que a pessoa não quis dizer.

**Proposta.** Subir a frase "Seu líder vê esta resposta" para cima das carinhas, curta. Após o toque, mostrar "Registrado. Desfazer" por 8 segundos e só então disparar o aviso de apoio. Trocar a resposta no mesmo dia continua permitido.

**Custo e risco.** Pequeno e reduz o risco que vocês mesmos anotaram para o DPO (dado de bem-estar enviado ao gestor sem opção de recusa). Não muda a decisão de 31/10; só evita o envio por engano. A mesma lógica vale para o bloco de humor do Meu Dia no Maré.

## 5. Oceano (lobby) e a família

O lobby resolve bem a entrada (login único, Mural, Meta Global, host em iframe). O que ele ainda não faz é responder à pergunta que traz a pessoa de volta todo dia: o que precisa de mim hoje? Como vocês já mandam todo mundo para o Oceano na primeira abertura do dia (`_oceanoDoDia`), esse é o lugar mais visto da família e o que menos informação pessoal mostra.

### O1. Faixa "Hoje" com o meu dia

**Hoje.** A tela inicial tem os tiles dos produtos, a Meta Global, o Mural e os links. Tudo igual para todo mundo, fora o nome na saudação.

**Proposta.** Uma faixa logo abaixo da saudação com 3 a 5 itens pessoais, cada um abrindo o produto já no lugar certo.
- **Fase 1, só no navegador.** O que é barato de ler: notificações não lidas (o sino já carrega), o estado da Travessia (farol do meu 1:1, avaliação aberta, pedido de feedback: três leituras pequenas do meu próprio uid) e "continuar em" com o último produto (`prefs.ultimo` já existe).
- **Fase 2, com função.** Cards meus atrasados ou bloqueados no Maré e Objetivos meus parados ou atrás do ritmo no Radar. O navegador não deve ler cards de todos os squads para isso. Uma função agendada grava um resumo por pessoa, e o lobby lê um nó pequeno. O `oceanoResumo` do Mini painel já agrega "cards do dono" para você: é generalizar isso.

**Na tela.** Uma linha de chips de vidro: "3 cards pedem atenção", "2 Objetivos parados", "1:1 há 16 dias", "Autoavaliação aberta". Sem nada pendente, a faixa vira uma frase só ("Tudo em dia"). Os tiles ganham o mesmo número como selo.

**Custo e risco.** Fase 1 é pequena. A fase 2 cria nó, regra e função, e passa pelo checklist de fronteira. O risco de produto é a faixa virar mais um painel de cobrança: no máximo 5 itens e nenhuma cor de alerta para o que não está atrasado. Desenho na seção 6.7.

### O2. Paleta de comando

**Hoje.** Dá para abrir produtos com as teclas 1 a 9 e a ajuda com "?". O Maré tem Ctrl+K; o lobby não.

**Proposta.** Ctrl+K (ou Cmd+K) abre uma busca única sobre o que o lobby já tem em memória: produtos, meus squads, atalhos do Radar, links da Hering, meus links, tópicos da ajuda. Enter abre no host.

**Custo e risco.** Médio, sem leitura nova. Buscar Objetivos e cards pelo nome fica para depois: exigiria um índice. Vale mais para quem usa o app instalado no desktop, como você.

### O3. Abrir a porta da Travessia por vínculo

**Hoje.** A Travessia está em produção desde 31/10, mas o tile está como `futuro: true`, sem endereço, e `visivel()` só trata o Painel. A entrada é pelo Baú no Maré e no Radar.

**Proposta.** Mostrar o tile só para quem já está no organograma da Travessia (tem `vinculos/{uid}` ou lidera alguém). O piloto da squad Dados ganha a porta sem anúncio geral, e cada pessoa que o RH cadastra passa a ver.

**Custo e risco.** Uma leitura pequena no início da sessão, e a mesma regra em `appsVisivel()` do `mare-notif-dev.js` (com o aumento do `?v=` nas páginas). É decisão de produto sua: se a porta discreta é intencional até a conversa com o DPO, deixe como está.

### O4. Abas de "venda" fora da navegação diária

**Hoje.** A navegação principal tem três abas: Meus produtos, Conheça o Oceano, Por baixo do casco. Duas das três são conteúdo de apresentação, lido uma vez.

**Proposta.** Para quem já abriu o Oceano mais de 5 vezes, a navegação some e as duas abas viram links no rodapé e na Ajuda. O espaço do topo fica para a faixa "Hoje". Os endereços `#conheca` e `#tecnica` continuam funcionando.

**Custo e risco.** Pequeno. Mantém o material de venda acessível para quem você mostra o Oceano pela primeira vez.

### O5. Um vocabulário de estado para a família

**Hoje.** Cada produto fala de estado do seu jeito. O Radar tem cinco status e o selo de parado. A Travessia tem o farol de quatro cores. O Maré tem atrasado e bloqueado. Para quem transita entre os três, "amarelo" quer dizer coisas diferentes.

**Proposta.** Quatro palavras para a família inteira, com cor, ícone e texto fixos: em dia, atenção, atrasado, parado. Um componente único de chip de estado descrito no `MARINE_GLASS.md`. Os status próprios de cada produto continuam existindo por baixo; o que se unifica é como aparecem.

**Custo e risco.** O trabalho é de documento e CSS, e pode ser aplicado tela a tela conforme as outras propostas mexerem nelas. É pré-requisito informal do O1: a faixa "Hoje" mistura os três produtos e fica incoerente sem isso.

## 6. Partes difíceis, já desenhadas

São os trechos em que o executor mais erraria sozinho: lógica de negócio, regras do banco e funções de desenho. As funções de 6.1, 6.4, 6.5 e 6.6 eu rodei em Node com dados de exemplo e os resultados bateram; as de 6.2 e 6.7 são esqueletos que dependem de funções da página, e as regras de 6.3 são JSON válido mas não passaram pelo emulador. Todas seguem o estilo do arquivo de destino.

### 6.1 Ritmo do Objetivo (R1 e R4)

O ponto frágil é o formato do rótulo em `trimestres[]`, que não consegui confirmar no código. O leitor abaixo aceita as grafias comuns; o executor deve conferir com os valores reais e ajustar. Colar depois de `_okrObjProgressoPct`.

```js
const _okrIso = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
// Rótulo de trimestre -> datas. Aceita "2026-Q4", "Q4 2026", "Q4/26", "4T26", "T4 2026", "4º tri 2026".
function _okrTrimPeriodo(rot){
  const s = String(rot||'').toUpperCase();
  const mq = s.match(/Q\s*([1-4])/) || s.match(/([1-4])\s*[º°O]?\s*T/) || s.match(/T\s*([1-4])/);
  if(!mq) return null;
  const resto = s.replace(mq[0], ' ');
  const ma = resto.match(/(20\d{2})/) || resto.match(/(\d{2})/);
  if(!ma) return null;
  const q = +mq[1], ano = ma[1].length===2 ? 2000 + +ma[1] : +ma[1];
  return { ini:_okrIso(new Date(ano,(q-1)*3,1)), fim:_okrIso(new Date(ano,q*3,0)) };
}
// Objetivo multi-trimestre: do início do primeiro ao fim do último.
function _okrObjPeriodo(o){
  const ps = _okrTrimestresOf(o).map(_okrTrimPeriodo).filter(Boolean);
  if(!ps.length) return null;
  return { ini: ps.map(p=>p.ini).sort()[0], fim: ps.map(p=>p.fim).sort().pop() };
}
const OKR_RITMO = { adiantado:{ico:'▲',label:'Adiantado'}, no_ritmo:{ico:'●',label:'No ritmo'},
                    atras:{ico:'▼',label:'Atrás do ritmo'}, muito_atras:{ico:'▼▼',label:'Muito atrás'} };
// null = não se aplica (sem meta numérica, período ilegível, já em 100% ou trimestre no comecinho).
function _okrRitmo(o, hoje){
  const at = o && o.atingimento;
  if(!_okrAtingConfigurado(at) || !['financeira','porcentagem','numero'].includes(at.tipo)) return null;
  const p = _okrObjPeriodo(o); if(!p) return null;
  const dias = (a,b)=>Math.round((Date.parse(b+'T12:00:00')-Date.parse(a+'T12:00:00'))/86400000);
  hoje = hoje || _okrIso(new Date());
  const total = dias(p.ini,p.fim)+1, passado = Math.max(0, Math.min(total, dias(p.ini,hoje)+1));
  const real = _okrAtingPctObj(o) || 0;
  if(real>=100) return null;
  const esperado = Math.round(passado/total*100);
  if(esperado<10) return null;                     // primeiros ~9 dias: cedo demais pra julgar
  const delta = real - esperado;                   // pontos percentuais
  const faixa = delta>=5 ? 'adiantado' : delta>=-10 ? 'no_ritmo' : delta>=-25 ? 'atras' : 'muito_atras';
  const projecao = Math.min(200, Math.round(real/passado*total));   // onde fecha mantendo o ritmo médio
  return { esperado, real, delta, faixa, projecao, diasRestantes: total-passado, fim: p.fim };
}
```

**Teste que fiz:** Objetivo do 4º trimestre de 2026, hoje 09/11. Esperado 43%. Com 40% realizado sai "no ritmo" e projeção de 92%; com 10% sai "muito atrás" e projeção de 23%; com 60% sai "adiantado".

Três decisões embutidas que você pode querer mudar: as faixas (+5, -10 e -25 pontos), o silêncio nos primeiros 10% do período, e o esperado linear. Meta sazonal (Black Friday concentra o trimestre em novembro) fica injustiçada pelo linear. Se isso pesar, o caminho é reaproveitar a curva diária que o `mare-metas.js` já tem, numa segunda etapa.

No cartão, o marcador é uma linha dentro da trilha existente:

```js
// dentro de _okrObjCardHtml, no lugar da trilha atual
const rt = _okrRitmo(o);
`<div class="okr-progress-track" style="position:relative;">
   <div class="okr-progress-fill" style="width:${pct}%;background:${okrStatusInfo(status).dot};"></div>
   ${rt?`<i class="okr-ritmo-mk" style="left:${rt.esperado}%" title="Esperado hoje: ${rt.esperado}%"></i>`:''}
 </div>
 ${rt && rt.faixa!=='no_ritmo' ? `<div class="okr-ritmo okr-ritmo-${rt.faixa}">${OKR_RITMO[rt.faixa].ico} ${Math.abs(rt.delta)} pontos ${rt.delta>0?'à frente':'atrás'} · fecha em ~${rt.projecao}%</div>` : ''}`
/* .okr-ritmo-mk{position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--txt);opacity:.75;border-radius:1px} */
```

A cópia do motor em `okr-apresentacao.slide.html` não precisa do ritmo na primeira versão. Se entrar lá depois, copiar a função inteira, como já se faz com `atingPct`.

### 6.2 Fila do check-in (R2 e R5)

O desenho que evita bug: o check-in não inventa escrita. Cada resposta chama o mesmo caminho que a tela já usa para aquele dado, por transação no nó, e nunca regrava o Objetivo inteiro.

```js
let _okrCk = null;   // { fila:[objId], i:0, feitos:[], pulados:[] }

function _okrCheckinFila(){
  const peso = o => _okrObjParadoDias(o)!==null ? 0 : ({muito_atras:1, atras:2}[(_okrRitmo(o)||{}).faixa] ?? 3);
  return Object.values(okrObjetivos)
    .filter(o => o && !o.arquivado && _okrIsResponsavel(o) && _okrObjStatus(o.id)!=='concluido')
    .sort((a,b) => peso(a)-peso(b) || String(a.titulo).localeCompare(String(b.titulo)))
    .map(o => o.id);
}

function openOkrCheckin(){
  const fila = _okrCheckinFila();
  if(!fila.length){ showToast('Você não é responsável por nenhum Objetivo ativo.'); return; }
  _okrCk = { fila, i:0, feitos:[], pulados:[] };
  _okrCheckinRender();
}

// r = { valor, nota, marcos:{[marcoId]:status}, passo, risco, confianca }  (tudo opcional)
async function _okrCheckinGravar(objId, r){
  if(_okrLockInfo(objId)){ _okrCk.pulados.push(objId); return 'travado'; }      // outra pessoa está editando
  const eu = window._currentUser, agora = new Date().toISOString();
  const ok = await _okrTx('kanban/okr/objetivos/'+objId, n => {
    let mudou = false;
    const v = _okrParseNum(r.valor);
    if(isFinite(v) && _okrAtingConfigurado(n.atingimento)){
      // MESMO formato de _okrAtingQuickSalvar: conferir lá o id e os campos antes de copiar
      (n.atingimento.lancamentos = n.atingimento.lancamentos||[]).push(
        { id:'l'+Date.now().toString(36), em:_okrIso(new Date()), valor:v, nota:String(r.nota||'').slice(0,200),
          por:eu.displayName||'', uid:eu.uid, criadoEm:agora });
      mudou = true;
    }
    const add = (campo, txt) => { txt = String(txt||'').trim().slice(0, OKR_CHAR_LIMITS[campo]||90);
      if(txt && !(n[campo]||[]).includes(txt)){ (n[campo] = n[campo]||[]).push(txt); mudou = true; } };
    add('proximosPassos', r.passo); add('riscos', r.risco);
    if(['sim','talvez','dificil'].includes(r.confianca) && n.confianca!==r.confianca){
      n.confianca = r.confianca; n.confiancaEm = agora; mudou = true; }
    if(!mudou) return false;                      // nada a gravar: aborta a transação
    n.atualizadoEm = agora;
    // + a entrada de Histórico que o Salvar do modal grava (mesmo helper, mesmo OKR_HIST_CAP)
  });
  for(const [mid, st] of Object.entries(r.marcos||{})){
    await _okrTx('kanban/okr/marcos/'+mid, m => { if((m.progresso||'nao_iniciado')===st) return false; m.progresso = st; m.atualizadoEm = agora; });
    // preferir chamar o que _okrCtxMarcoStatus já chama: ele cuida do histórico e da notificação de Marco concluído
  }
  _okrCk.feitos.push(objId);
  return ok ? 'gravado' : 'sem_mudanca';
}
```

Regras de tela: Enter grava e avança; "Pular" avança sem gravar; Esc fecha e mantém o que já foi gravado; a última tela lista "gravados", "sem mudança" e "pulados (travados)". Um Objetivo que recebe check-in sai do selo de parado sem código extra, porque `_okrObjUltimaAtividade` já lê `criadoEm` dos lançamentos e `atualizadoEm`.

### 6.3 Regras do banco da Travessia (T1 etapa B e T2)

Quatro nós novos em `kanban/travessia/`. Para caber na página uso três apelidos; no arquivo eles são escritos por extenso, como nas regras atuais:

- `HERING` = `auth != null && (auth.token.email.endsWith('@ciahering.com.br') && auth.token.firebase.sign_in_provider=='google.com')`
- `LIDER` = `root.child('kanban/travessia/vinculos/' + $uid + '/liderUid').val() === auth.uid`
- `GERENTE` = o mesmo com `gerenteUid`

```json
{
 "pauta": { "$uid": {
   ".read": "HERING && (auth.uid === $uid || LIDER)",
   "$itemId": {
     ".write": "HERING && (auth.uid === $uid || LIDER) && (!data.exists() ? newData.child('por').val() === auth.uid : (newData.exists() ? newData.child('por').val() === data.child('por').val() : data.child('por').val() === auth.uid))",
     ".validate": "newData.hasChildren(['texto','por','ts'])",
     "texto": { ".validate": "newData.isString() && newData.val().length <= 280" },
     "por": { ".validate": "newData.isString() && newData.val().length <= 64" },
     "ts": { ".validate": "newData.isNumber()" },
     "feito": { ".validate": "newData.isBoolean()" },
     "feitoEm": { ".validate": "newData.isNumber()" },
     "$other": { ".validate": false } } } },

 "acoes": { "$uid": {
   ".read": "HERING && (auth.uid === $uid || LIDER)",
   "$acaoId": {
     ".write": "(a mesma expressão de pauta)",
     ".validate": "newData.hasChildren(['texto','dono','por','ts'])",
     "texto": { ".validate": "newData.isString() && newData.val().length <= 200" },
     "dono": { ".validate": "newData.val() === $uid || newData.val() === root.child('kanban/travessia/vinculos/' + $uid + '/liderUid').val()" },
     "prazo": { ".validate": "newData.isString() && newData.val().matches(/^20[0-9][0-9]-[01][0-9]-[0-3][0-9]$/)" },
     "feito": { ".validate": "newData.isBoolean()" },
     "feitoEm": { ".validate": "newData.isNumber()" },
     "origem": { ".validate": "newData.val() === 'um' || newData.val() === 'pdi'" },
     "ref": { ".validate": "newData.isString() && newData.val().length <= 200" },
     "por": { ".validate": "newData.isString() && newData.val().length <= 64" },
     "ts": { ".validate": "newData.isNumber()" },
     "$other": { ".validate": false } } } },

 "pdi": { "$uid": {
   ".read": "HERING && (auth.uid === $uid || LIDER || GERENTE)",
   "$focoId": {
     ".write": "HERING && auth.uid === $uid",
     ".validate": "newData.hasChildren(['titulo','status','ts'])",
     "titulo": { ".validate": "newData.isString() && newData.val().length <= 120" },
     "comp": { ".validate": "newData.isString() && newData.val().length <= 60" },
     "porque": { ".validate": "newData.isString() && newData.val().length <= 400" },
     "ciclo": { ".validate": "newData.isString() && newData.val().length <= 40" },
     "status": { ".validate": "newData.val() === 'ativo' || newData.val() === 'pausado' || newData.val() === 'concluido'" },
     "ts": { ".validate": "newData.isNumber()" },
     "acoes": { "$aid": {
       ".validate": "newData.hasChildren(['texto','tipo'])",
       "texto": { ".validate": "newData.isString() && newData.val().length <= 200" },
       "tipo": { ".validate": "newData.val() === 'pratica' || newData.val() === 'pessoas' || newData.val() === 'estudo'" },
       "feito": { ".validate": "newData.isBoolean()" },
       "prazo": { ".validate": "(mesma expressão de data)" },
       "ref": { ".validate": "newData.isString() && newData.val().length <= 200" },
       "link": { ".validate": "newData.isString() && newData.val().length <= 300" },
       "$other": { ".validate": false } } },
     "evidencias": { "$bauId": { ".validate": "newData.val() === true" } },
     "$other": { ".validate": false } } } },

 "pdi_coment": { "$uid": {
   ".read": "HERING && (auth.uid === $uid || LIDER || GERENTE)",
   "$focoId": { "$cid": {
     ".write": "HERING && (auth.uid === $uid || LIDER) && (newData.exists() ? (!data.exists() && newData.child('por').val() === auth.uid) : data.child('por').val() === auth.uid)",
     ".validate": "newData.hasChildren(['texto','por','ts'])",
     "texto": { ".validate": "newData.isString() && newData.val().length <= 600" },
     "por": { ".validate": "newData.isString() && newData.val().length <= 64" },
     "ts": { ".validate": "newData.isNumber()" },
     "$other": { ".validate": false } } } } }
}
```

O que cada escolha significa, para você validar:

| Decisão embutida | Por quê | Alternativa |
|---|---|---|
| Pauta e ações: só a pessoa e o líder direto leem; o gerente não | É o conteúdo da conversa, igual ao humor | Incluir `GERENTE` no `.read`, como no Baú |
| Qualquer um dos dois marca um item como conversado; só o autor apaga | Evita sumiço de item do outro | Deixar os dois apagarem |
| O dono de uma ação é a pessoa ou o líder dela, mais ninguém | A ação nasce do 1:1 | Liberar qualquer uid |
| PDI: só a pessoa escreve; líder e gerente leem | "Pessoa no centro", princípio 1 do seu desenho | Líder também edita |
| Comentário de PDI não se edita, só se apaga | Simples e auditável | Permitir edição pelo autor |
| RH e ADM não leem nenhum dos quatro | Mantém a linha das regras atuais | Nenhuma que eu recomende |

O "herdado" do 1:1 não precisa de cópia nem de campo: um item de pauta sem `feito`, ou uma ação sem `feito`, com `ts` anterior à data do último encontro, é herdado. É um cálculo na tela.

O limite de 4 focos não dá para garantir nas regras do Realtime Database sem um contador; fica na tela, e está tudo bem, porque não é uma fronteira de segurança.

Testes de regras mínimos, no mesmo arquivo dos 11 atuais: a pessoa lê e escreve a própria pauta; o líder lê e adiciona; o gerente não lê pauta; um colega não lê nada; ninguém troca o `por` de um item; o líder não escreve no PDI; o gerente lê o PDI; RH e ADM não leem; campo extra é recusado. Os nós novos também precisam entrar na decisão de backup (hoje `kanban/travessia` vai inteiro no semanal).

### 6.4 Rota em SVG (T3)

Função pura; recebe o que `viewInicio` já tem. O texto alternativo resume a rota para leitor de tela.

```js
// marcos = [{ em:'AAAA-MM-DD', tipo:'um'|'bau'|'fase'|'pdi', titulo }]
function viewRota({ ini, fim, hoje, marcos }) {
  const W = 1000, H = 120, pl = 30, pr = 30, y = 70; const total = Math.max(1, diasEntre(ini, fim));
  const X = iso => pl + (W - pl - pr) * Math.max(0, Math.min(1, diasEntre(ini, iso) / total));
  const COR = { um: 'var(--teal)', bau: 'var(--accent)', fase: 'var(--warn)', pdi: 'var(--ok)' }; const R = { um: 5, bau: 4, fase: 7, pdi: 8 };
  const pts = (marcos || []).filter(m => m.em >= ini && m.em <= fim).sort((a, b) => a.em.localeCompare(b.em));
  const xh = X(hoje < ini ? ini : hoje > fim ? fim : hoje);
  const n = t => pts.filter(m => m.tipo === t).length;
  return `<div class="rota"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Rota do ciclo, de ${brFull(ini)} a ${brFull(fim)}: ${n('um')} conversas de 1:1 e ${n('bau')} itens no Baú até agora">
    <path d="M${pl} ${y}H${W - pr}" stroke="var(--line2)" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 9"/>
    <path d="M${pl} ${y}H${xh.toFixed(1)}" stroke="var(--teal)" stroke-width="3" stroke-linecap="round"/>
    ${pts.map(m => `<circle cx="${X(m.em).toFixed(1)}" cy="${m.tipo === 'bau' ? y - 16 : y}" r="${R[m.tipo] || 4}" fill="${COR[m.tipo] || 'var(--txt3)'}"><title>${esc(brDe(m.em) + ' · ' + m.titulo)}</title></circle>`).join('')}
    <text x="${xh.toFixed(1)}" y="${y - 26}" text-anchor="middle" font-size="26" aria-hidden="true">⛵</text>
    <text x="${pl}" y="${H - 8}" font-size="13" fill="var(--txt2)">${esc(brDe(ini))}</text>
    <text x="${W - pr}" y="${H - 8}" text-anchor="end" font-size="13" fill="var(--txt2)">${esc(brDe(fim))}</text></svg></div>`;
}
/* .rota{overflow-x:auto} .rota svg{display:block;min-width:560px;width:100%;height:auto} */
```

De onde vêm `ini` e `fim`: o ciclo guarda `prazos` (as regras já aceitam), mas a tela de administração ainda não preenche. Enquanto isso, usar o trimestre corrente. Pontos de fase precisam dessas datas; sem elas, a rota mostra só 1:1 e Baú. Cor nunca sozinha: o tipo também muda o tamanho e a altura do ponto, e há uma legenda de uma linha abaixo.

### 6.5 Próxima ação (T4)

Uma função, uma resposta. A ordem é a decisão de produto: o que tem outra pessoa esperando vem antes do que é só meu.

```js
// avals = { [cid]: carregaAval(cid, me) } · respPar = { [cid+':'+avaliado]: resposta salva ou null }
function proximaAcao({ me, ciclos, avals, pedidos, respPar, um, bau, hoje }) {
  const ativos = Object.entries(ciclos || {}).filter(([, c]) => c && c.status !== 'encerrado' && c.participantes && c.participantes[me]);
  for (const [cid, c] of Object.entries(ciclos || {})) { const a = (avals || {})[cid];
    if (a && a.devol && a.devol.liberada === true && !a.ciente) return { ic: '🔓', txt: 'Sua devolutiva de ' + c.nome + ' foi liberada.', btn: 'Ler agora', tab: 'aval' }; }
  for (const p of (pedidos || [])) { const c = (ciclos || {})[p.cid];
    if (c && c.status === 'coleta' && !(respPar || {})[p.cid + ':' + p.avaliado]) return { ic: '🤝', txt: nomeDe(p.avaliado) + ' conta com o seu feedback.', btn: 'Responder', tab: 'aval' }; }
  for (const [cid, c] of ativos) { const a = (avals || {})[cid] || {};
    if (c.status === 'coleta') { const qs = Object.keys(perguntasDe(c, 'auto')); const feitas = qs.filter(q => a.auto && a.auto[q]).length;
      if (feitas < qs.length) return { ic: '📝', txt: feitas ? 'Faltam ' + (qs.length - feitas) + ' respostas na sua autoavaliação.' : 'Sua autoavaliação está aberta.', btn: feitas ? 'Continuar' : 'Começar', tab: 'aval' }; }
    if (c.status === 'preparacao' && Object.keys(a.pares || {}).length < 2) return { ic: '🤝', txt: 'Indique de 2 a 4 pares para ' + c.nome + '.', btn: 'Indicar', tab: 'aval' }; }
  const f = um && um.farol;
  if (f && (f.cor === 'vermelho' || f.cor === 'amarelo')) return { ic: f.ic, txt: 'Seu último 1:1 foi há ' + f.dias + ' dias.', btn: 'Registrar ou combinar', foco: 'enc-d' };
  const ult = Math.max(0, ...Object.values(bau || {}).map(b => b.ts || 0));
  if (!ult || diasEntre(isoDe(new Date(ult)), hoje) >= 21) return { ic: '📦', txt: ult ? 'Faz 3 semanas que nada entra no seu Baú.' : 'Seu Baú está vazio.', btn: 'Guardar uma conquista', tab: 'bau' };
  return null;
}
```

Deixei o humor fora da fila de propósito. O bloco de humor já está à vista, e um cartão diário "registre seu humor" transforma um gesto opcional em cobrança. Com T1 e T2, entram mais duas linhas antes do Baú: ação minha vencida e foco de PDI sem movimento há 21 dias.

### 6.6 Faixa de aderência e ordem da Frota (T6)

```js
// 12 semanas (segunda a domingo); ok = houve 1:1 naquela semana
function aderencia(enc, hoje, semanas = 12) {
  const seg = iso => { const d = new Date(Date.parse(iso + 'T12:00:00')); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoDe(d); };
  const com = new Set(Object.values(enc || {}).map(e => e && e.data).filter(Boolean).map(seg));
  const out = []; const base = new Date(Date.parse(seg(hoje) + 'T12:00:00'));
  for (let i = semanas - 1; i >= 0; i--) { const d = new Date(base); d.setDate(base.getDate() - i * 7); const k = isoDe(d); out.push({ k, ok: com.has(k) }); }
  return out;
}
const viewAderencia = (enc, hoje) => { const a = aderencia(enc, hoje); const n = a.filter(x => x.ok).length;
  return `<div class="ader" role="img" aria-label="1:1 em ${n} das últimas ${a.length} semanas">${a.map(x => `<i class="${x.ok ? 'ok' : ''}" title="Semana de ${brDe(x.k)}: ${x.ok ? 'teve 1:1' : 'sem 1:1'}"></i>`).join('')}</div>`; };
/* .ader{display:flex;gap:3px;margin-top:8px} .ader i{flex:1;height:10px;border-radius:3px;background:var(--line2)} .ader i.ok{background:var(--teal)} */

// menor = primeiro na Frota
const pesoFrota = (farolCor, temApoio) => temApoio ? 0 : ({ vermelho: 1, amarelo: 2, cinza: 3, verde: 4 }[farolCor] ?? 3);
```

A faixa não desconta folgas nem conhece a cadência: para quem tem 1:1 mensal, 3 quadrados cheios em 12 é o esperado. Por isso ela é um desenho de apoio ao farol, que continua sendo o veredito. Se quiser, os quadrados de quem é mensal podem ser agrupados de 4 em 4.

O painel lateral do detalhe: em `viewFrota`, tirar `viewDetalhe` do fim da pilha e renderizá-lo num `<aside>` fixo à direita a partir de 980 px (a grade passa de 3 para 2 colunas enquanto ele está aberto) e em tela cheia abaixo disso, com o foco indo para o título ao abrir e voltando ao cartão ao fechar.

### 6.7 Faixa "Hoje" do lobby (O1)

**Fase 1**, no `oceano-dev.html`, dentro do módulo Firebase. São leituras do próprio uid, uma vez por sessão, depois de `iniciarSessao()`:

```js
async function hojeItens(uid){
  const T = 'kanban/travessia/'; const ler = async p => { try { return (await get(ref(db, p))).val(); } catch(e){ return null; } };
  const [vinc, serie, enc, pedidos] = await Promise.all([ler(T+'vinculos/'+uid), ler(T+'serie/'+uid), ler(T+'encontros/'+uid), ler(T+'pedidos_par/'+uid)]);
  const itens = [];
  if(vinc && serie && serie.cad){                       // só quem já está na Travessia
    const ult = Object.values(enc||{}).map(e=>e&&e.data).filter(Boolean).sort().pop();
    const lim = {semanal:7, quinzenal:14, mensal:30, trimestral:90}[serie.cad];
    const dias = ult ? Math.round((Date.now()-Date.parse(ult+'T12:00:00'))/86400000) : null;
    if(dias!=null && dias > lim+1) itens.push({ app:'travessia', estado: dias > lim*1.5 ? 'atrasado' : 'atencao', txt:'1:1 há '+dias+' dias' });
  }
  const nPed = Object.keys(pedidos||{}).length;
  if(nPed) itens.push({ app:'travessia', estado:'atencao', txt: nPed===1 ? '1 pedido de feedback' : nPed+' pedidos de feedback', url:'travessia.html?tab=aval' });
  const naoLidas = (window.MareNotif && MareNotif.items ? MareNotif.items().filter(n=>!n.lida).length : 0);   // conferir o nome do campo no módulo
  if(naoLidas) itens.push({ app:'sino', estado:'atencao', txt: naoLidas+' não lidas' });
  return itens.slice(0, 5);
}
```

Esse farol é uma versão reduzida do `farol()` da Travessia (não desconta folgas). Para não ter duas regras, o melhor é mover `farol()` para um módulo compartilhado quando a faixa for para produção; na primeira versão, um comentário apontando para a função original basta.

**Fase 2**, formato do nó e regra:

```js
{ "resumo_pessoal": { "$uid": { ".read": "HERING && auth.uid === $uid", ".write": false } } }
// kanban/resumo_pessoal/{uid}, escrito só pela função agendada (admin)
{ ts: 1794250000000,
  mare:  { atrasados: 2, bloqueados: 1, squads: { dados: 3 } },
  radar: { meus: 4, parados: 1, atras: 2, marcos14d: 1 } }
```

A função: generalizar `montarResumo()` de `functions/oceano/resumo.js`, que já conta os cards do dono, para todas as pessoas com sessão nos últimos 7 dias, uma vez por hora em horário comercial. Só contagens, nunca títulos de card: assim o nó não vira um segundo lugar com conteúdo de squads que a pessoa talvez não devesse ver. O lobby mostra "atualizado há N min" a partir de `ts` e esconde o item se o resumo tiver mais de 3 horas.

## 7. Ordem que eu seguiria

Se você aceitar tudo que recomendo, esta ordem entrega valor visível logo e deixa por último o que depende de deploy e do DPO.

1. **Vitórias rápidas, sem deploy:** T4, T1 etapa A, T8, T7, R3, O4. Seis PRs pequenos; as três telas já mudam de cara.
2. **O Radar calcula:** R1, depois R4 e R6 juntos, com o vocabulário do O5 aplicado no cartão.
3. **O Radar vira ritual:** R2 e, se você quiser, R5.
4. **A Frota e a rota:** T6, T3, T5.
5. **O miolo da Travessia:** T1 etapa B e T2. Regras e testes primeiro, deploy seu, e a conversa com o DPO fechada antes de ir para produção.
6. **O lobby:** O1 fase 1 e O3; depois O1 fase 2 e O2.
7. **Em espera até o time pedir:** R7 e R8.

O passo 2 vem antes do 3 porque o check-in fica muito melhor mostrando o ritmo. O passo 5 pode andar em paralelo com 2 a 4 se você delegar: não toca nos mesmos arquivos.

## 8. Prompt de execução para o Opus

Antes de usar: preencha a coluna "Sua decisão" da seção 2, exporte este documento em Markdown e salve no repositório como `docs/ideias/consultoria-oceano-2026-11-09.md`. O prompt lê esse arquivo, então o que você editar aqui (faixas do ritmo, quem lê a pauta, textos) já vale como instrução.

```text
Você vai implementar, no repositório hering, as propostas aprovadas da consultoria de produto do Oceano.

## Antes de qualquer edição
1. Rode /seatualizar e leia CLAUDE.md e docs/COORDENACAO_AGENTES.md.
2. Leia inteiro docs/ideias/consultoria-oceano-2026-11-09.md.
3. Na tabela da seção 2, considere APENAS as linhas em que a coluna "Sua decisão" diz "sim". Me devolva a lista
   dessas linhas e a ordem em que vai fazer (use a seção 7 como base) e espere meu ok. Se nenhuma linha estiver
   marcada, pare e pergunte.

## Como trabalhar cada item
- Um PR por item (ou por etapa, quando o item tem etapas A/B ou fases). Branch claude/<assunto>, trailer
  "Agent: claude". Não dê merge no próprio PR.
- Só arquivos -dev (okr-dev.html, travessia-dev.html, oceano-dev.html, kanban-dev.html, mare-*-dev.js). Nunca
  toque em produção e nunca rode firebase deploy. Siga o Release process do CLAUDE.md para versão, version.json,
  CHANGELOG e CODE_MAP.
- Antes de editar: CODE_MAP_FAST.md, depois grep do nome, depois leia a função alvo de ponta a ponta e todos os
  pontos que escrevem no mesmo nó (docs/GUIA_DE_CODIGO.md). Não confie em número de linha do documento.
- O código da seção 6 é o desenho de partida, não texto sagrado. Adapte ao estilo e aos helpers do arquivo. Onde a
  seção 6 e o código real discordarem, vale o código real, e você me diz o que mudou.
- Confira estas suposições, que a consultoria não conseguiu verificar, ANTES de codar o item correspondente:
  a) R1: o formato real dos rótulos em objetivo.trimestres (ajuste _okrTrimPeriodo e escreva um teste com os
     valores reais).
  b) R2: o formato exato do lançamento e o helper de Histórico usados por _okrAtingQuickSalvar e
     _okrCtxMarcoStatus; reutilize-os em vez de escrever direto.
  c) R8: se o vínculo de cards é por Objetivo ou por Marco.
  d) T5: se o gancho do Meu Dia no kanban-dev já oferece guardar no Baú na conclusão do card.
  e) O1: o nome do campo de "lida" em MareNotif.items() e o parâmetro de aba da Travessia na URL.
  Se alguma suposição falhar de um jeito que muda o desenho, pare e me pergunte.
- Zero leitura nova do Firebase além das que o documento descreve. Se precisar de outra, pare e me diga o custo.

## Interface
- Leia docs/GUIA_UI_UX.md e MARINE_GLASS.md antes de desenhar. Tokens, nunca cor crua. Estado nunca só pela cor.
- Verifique cada tela alterada em 1280 px e 390 px, nos três temas, com dados vazios, normais e extremos.
  Na Travessia, atualize demoDados() para que ?demo=1 mostre o recurso novo, e me passe a URL de teste.
- Desenhe todos os estados: carregando, vazio, erro, sem permissão. Teclado e leitor de tela funcionando;
  toque com alvo de pelo menos 44 px; respeite prefers-reduced-motion.
- Texto de interface em português do Brasil, curto, no tom das telas atuais. Sugestão do sistema soa como ajuda,
  não como cobrança.

## Banco e funções (só T1 etapa B, T2, O1 fase 2, R7)
- Regras e testes de regras ANTES da tela, num PR próprio. Escreva as regras por extenso, no estilo das atuais
  de kanban/travessia. Inclua os testes listados na seção 6.3 e os que você julgar necessários.
- Passe o checklist de docs/SEGURANCA_FRONTEIRAS.md e diga o resultado.
- Consulte o advisor antes de fechar o plano e antes de dar a tarefa por concluída.
- Acrescente a linha em "Pendente de deploy" de docs/COORDENACAO_AGENTES.md e me entregue o resync seguido do
  comando de deploy. A tela só entra depois que eu confirmar o deploy.

## O que me entregar em cada PR
- O que mudou, em linguagem de usuário, em até 5 linhas.
- Como testar: URL do -dev (com ?demo=1 quando existir) e o passo a passo.
- "dica: sim/não" e "fronteira: ...", como manda o CLAUDE.md.
- O que ficou esperando decisão ou deploy meu.
- Ajuda atualizada (/atualizarhelpcontent) quando o recurso for visível.

## Quando parar e perguntar
- Uma suposição da lista falhou.
- O item exige mexer em produção, em login, em regras fora do que está na seção 6, ou em dado de outra pessoa.
- Há mais de uma leitura razoável de uma decisão de produto (quem vê, o que notifica, o que é obrigatório).
- O mesmo teste falhou duas vezes seguidas.

Não implemente nada que não esteja marcado com "sim". Não aproveite o PR para refatorar o que está em volta.
Se preferir rodar um item só, troque o passo 3 por "Implemente apenas o item R1" e mantenha o resto.
```
