# 🤖 Agente Ágil no Painel — desenho (rascunho de 06/11/2026)

> **Status:** só desenho — **nada implementado**. Pedido do Caio: "agente ágil no painel também! me ajudar a gerir, ler os dados, fazer análises" e "esse agente precisa ler os dados do painel em si".
> **Para quem:** o Caio (as 4 decisões da §11 já foram tomadas) e, depois, quem implementar (Codex/Antigravity, pelo contrato do `docs/COORDENACAO_AGENTES.md` › *Contrato de tarefa (v2)*).
> **Mockup:** `docs/capturas/agente-agil-painel/mockup-gaveta.png` (fonte: `mockup-gaveta.html`; números fictícios).

## 1. O que é, em uma frase
Uma **gaveta de conversa** em todas as abas do Painel, onde o gestor pergunta sobre **o que está vendo** ("onde está o gargalo?", "o que merece atenção hoje?", "resumo para a reunião de gestão") e recebe resposta **com números conferidos, fonte e atalho para a aba/filtro certo**. Na primeira fase **só lê**; na segunda, **propõe** ações que a pessoa confirma com um clique.

## 2. Princípios (cada um vem de algo que já aprendemos aqui)
1. **O servidor relê os fatos; o navegador só diz onde a pessoa está.** `analiseDados.js` recebe o resumo pronto do navegador e confia nele — **não copiar** isso: aqui a aba/filtro/período vêm do cliente como *dica de contexto*, e todo número vem de ferramenta de leitura no servidor (Admin SDK).
2. **Número se calcula em código, o modelo só narra.** Mesma regra de `visao_board` e do "padrão → campanha" em `analisePO.js`. Comparações ("subiu de 2,1 para 4,3 dias", "vs semana passada") **também saem prontas da ferramenta** (valor, período de referência e texto já formatado em pt-BR). Uma **trava de conferência** depois da resposta normaliza os números do texto (vírgula/ponto, %, dias) e exige que cada um exista no resultado de alguma ferramenta; se não existir, a resposta sai marcada "⚠️ valor não conferido" (ou refaz uma vez). É guarda, não garantia.
3. **Só leitura primeiro** (`tools` de escrita ausentes), como `resumoMeuDia.js`: elimina a categoria inteira "agente escreveu algo errado" e limita o dano de injeção de prompt (§6).
4. **Conversa privada — e o caminho importa.** O chat do Radar (`kanban/okr/agente_chat`) é compartilhado; perguntas sobre desempenho de pessoas e squads **não** podem ser. **Atenção (conferido em `database.rules.json`): `kanban/painel` tem `.read` para qualquer @ciahering *e para os visualizadores externos* e `.write` para qualquer @ciahering — no Realtime Database a permissão de um nó pai vale para os filhos e não dá para retirá-la depois.** Por isso o chat **não pode** morar em `kanban/painel/…`. Nó próprio, irmão de `kanban/okr`, sem pai permissivo: `kanban/agente_painel/{uid}/{msgId}` (`kanban/` em si não tem regra de leitura).
5. **Mostre de onde veio e o que fazer:** cada resposta traz **fonte + hora da leitura** e **atalho** que troca de aba/filtro (`swPtab`, filtro de squad/gerência) — a gaveta não substitui o Painel, **leva** a ele.

## 3. O que ele lê — as abas do Painel viram ferramentas de leitura
Cada ferramenta devolve **JSON enxuto** (títulos ≤ 80 caracteres, contagens, datas; sem e-mail/telefone) e tem **teto de linhas**. Reaproveita o que já existe no servidor; cache de 60 s (agregados) / 5 min (cards), como `oceanoResumo`.

| Aba / fonte do Painel | Ferramenta | Nós do banco | Reaproveita |
|---|---|---|---|
| 👁 Visão (cards de todos os squads, WIP, prazos, bloqueios, quem está online) | `painel_visao` | `kanban/squads/{id}/dados/{cards,columns}`, `…/painel/presence` | `summarizeBoard` (`tools/visaoBoard.js`), `sinaisDoCard` (`resumoMeuDia.js`) |
| 🌊 Fluxo e 🛤️ Timeline (cycle/lead time, throughput, gargalo, itens com data) | `painel_fluxo` | cards (`flow`), `…/painel/grupos_campanha` | `agente-agil/flow.js`, `summarizeBoard` |
| 🧑‍🤝‍🧑 Pessoas (carga, papéis, squads; comunicados) | `painel_pessoas` | `kanban/usuarios_publicos`, cards por `owner` (índice já existe) | `cardsPorAgente.js`, `oceanoResumo` (`orderByChild('owner')`) |
| 🔋 Status (VTEX, GitHub, Firebase, backup, plantão, **Saúde dos cards/Guardião**) | `painel_status` | `kanban/cards_guardiao/*`, backup, status | `functions/oceano/resumo.js`, `backup/vigia.js` |
| 📊 Dados (Central de Dados, metas "O mar tá pra peixe") | `painel_dados` | `kanban/dados_diarios` (15 dias) + metas | — (nova; leitura simples) |
| 🎯 Radar (Objetivos, Marcos, atingimento) | `radar_resumo` | `kanban/okr/*` | `listar_objetivos`/`resumo_atingimentos` (`okr/agenteTools.js`) |
| 🤖 Agentes (histórico do que o agente fez) | `painel_agentes_log` | `kanban/squads/{id}/dados/agente_log` | `agenteLog.js` |
| 🐛 Monitor (erros do navegador) | `painel_erros` | `kanban/squads/{id}/dados/error_logs` | **só contagem e mensagem agrupada** (sem stack/URL com dado pessoal) |
| 🗓 Calendário de gestão, lembretes, campanhas | `painel_agenda` | `…/painel/cal_events`, `lembretes_gestao`, `grupos_campanha` | lógica de campanha de `analisePO.js` |
| Um card específico | `ler_card` (existe) | cards | `tools/lerCard.js` |
| Dúvida de como usar o Painel/Maré | `consultar_ajuda` (existe) | `conhecimento/*.json` | `tools/bibliotecaAgil.js` |

**Fora do alcance (lista de exclusão, vale para sempre):** `feedback` (pode identificar quem escreveu), `painel_viewers` (e-mails externos), notificações pessoais de outras pessoas, segredos/config de integrações, conteúdo de backup, `usuarios/*` privados (e-mail, tokens de push). O agente enxerga o que o **Painel já mostra a quem está logado**, nada além.

**Contexto enviado pelo navegador (só dica):** `{aba, filtro: {squad|gerencia}, periodo}`. Validado contra lista fechada de valores; nunca entra no prompt como fato.

### 3.1 Dev × prod — o agente precisa ler **o mesmo dado que a tela que está aberta**
O `painel-dev.html` lê nós irmãos `_dev` (`dados_diarios_dev`, `cal_events_dev`, `grupos_campanha_dev`, `lembretes_gestao_dev`, `config/gcal_*_dev`, `metas_*_dev`, `campanhas_log_dev`…), enquanto cards e squads são **compartilhados**. Uma ferramenta que lesse só os nomes de produção contradiria a tela no `-dev` — justo onde vamos validar. Desenho:
- **Duas funções, uma implementação** (mesmo padrão de `createMentionTrigger({squadId})`): `agenteAgilPainelChat` (prod, nó `kanban/agente_painel/{uid}`) e `agenteAgilPainelChatDev` (nó `kanban/agente_painel_dev/{uid}`). O `-dev` nunca grava no nó de produção e vice-versa.
- **Um único resolvedor** `nodeFor(env, nome)` que devolve `dados_diarios` ou `dados_diarios_dev` etc.; **nenhuma ferramenta escreve caminho na mão**. Teste: para cada ferramenta, `env='dev'` lê o `_dev` quando existe e o nó compartilhado quando não existe.
- A mesma regra vale para o nó de conversa e o `_processed` (`kanban/agente_painel_processed[_dev]/{uid}/{msgId}`, só Admin SDK escreve).

### 3.2 Paridade com a tela — "o número do agente = o número da aba"
O `summarizeBoard` (`visaoBoard.js`) replica as fórmulas do **kanban.html**, não as do **Painel**. O Painel tem as suas (ex.: Fluxo mostra **mediana e P85** de cycle/lead time via `_collectFlowCards()`, `median()`, `percentile()`; WIP envelhecido em `renderAgingWip()`; vazão em `_squadThroughput14()`; os cartões de squad em `renderSquadCards()`; e o "Parado há mais tempo" foi **mudado de propósito** em 10/10). Se o agente disser 11 e a aba 9, o Caio para de confiar no primeiro dia. Regra:
- Cada ferramenta da §3 tem, no código, o comentário **"espelha `<função do painel-dev.html>`"** (mesmo estilo de `visaoBoard.js`) e a **primeira tarefa da fase 1a é o mapa de paridade** (ferramenta → função do Painel → fórmula), antes de qualquer prompt.
- **Teste de ouro de verdade:** renderizar o `painel-dev.html` com o Firebase falso (`fakefb.js`) numa semente, **ler o número do DOM** e comparar com a saída da ferramenta sobre a *mesma* semente. Divergência = teste vermelho.

## 4. Como a pessoa usa (UI, Marine Glass)
- **Entrada:** botão flutuante 🤖 (mesmo padrão dos de Anotações/ao vivo) abre uma **gaveta à direita (~450 px)** que não esconde a aba; no celular vira tela cheia. Atalho de teclado (a decidir; precisa evitar as combinações reservadas — ver "Atalhos" do Maré).
- **Cabeçalho:** "privado · só você vê" + **chips de contexto** (aba · escopo · período · "lido às HH:MM") — a pessoa sempre sabe **sobre o quê** o agente está falando.
- **Atalhos por aba** (3–4 chips que mudam com a aba: Visão → "O que merece atenção hoje?"; Fluxo → "Onde está o gargalo?"; Pessoas → "Quem está sobrecarregado?"; Status → "Algo preocupante na saúde do sistema?"; qualquer aba → "Resumo para a reunião de gestão").
- **Resposta:** texto curto → mini-tabela (quando comparar) → **atalhos "↗ Ver no Fluxo · Mídia Criativa"** → rodapé de fonte ("Fluxo + Visão · Digital · 15 dias · números conferidos").
- **Copiar para o Mural/WhatsApp:** botão que formata a resposta como texto de comunicado (a regra de avisos do `CLAUDE.md` já exige esse texto na promoção — o agente pode gerar o rascunho).
- **Estados:** vazio (chips), carregando ("lendo Fluxo…" — mostra qual ferramenta está rodando), erro, kill switch desligado ("o Agente Ágil está pausado pelo ADM"), cota do dia acabou, sem permissão.
- **Acessibilidade/motion:** foco volta ao campo, `aria-live` na resposta, nenhuma animação infinita (BUGS Armadilha 16 / guia 2.5 regra 4).

## 5. Arquitetura (reaproveita o orquestrador; nada de agente novo)
```
Painel (gaveta) ──grava──▶ kanban/agente_painel[_dev]/{uid}/{msgId}   (regra: só o PRÓPRIO uid escreve e lê; só @ciahering Google; viewers externos NÃO; sem pai permissivo)
                                   │ onValueCreated (função NOVA: agenteAgilPainelChat / …Dev)
                                   ▼
        anti-auto-disparo → idempotência (kanban/agente_painel_processed[_dev]/{uid}/{msgId})
        kill switch GERAL (kanban/config/agente_agil_orquestrador/enabled)  +  interruptor do Painel (…/painel_enabled)
        cota por pessoa/dia + rate limit · escolheClienteParaTarefa (haiku por padrão; sonnet p/ "analisar/resumo")
                                   ▼
        runLoop(MAX_ITERATIONS=8) com tools = só as de LEITURA da §3 (+ responder)   ──▶  resposta + blocos (tabela, atalhos, fonte) gravados no mesmo nó
                                   ▼
        trava de conferência de números → grava; notificação opcional (tipo novo em MareNotif.TIPOS, push só se pedir)
```
- **Por que gatilho no banco e não `onRequest`:** dá histórico, reabrir a conversa, funciona com a aba em segundo plano e é o padrão já validado em `okrAgenteChat`. Desvios propositais: **nó por `uid`** (privado) em vez de nó global, **fora de `kanban/painel`** e com par `_dev` (§3.1).
- **Regras do nó novo:** `$uid`: `.read`/`.write` só se `auth.uid === $uid` e @ciahering Google; `.validate` do formato da mensagem (campos fixos, texto ≤ 2000 caracteres, `role` só `user` vindo do cliente — a resposta do agente é gravada pelo Admin SDK, que ignora as regras).
- **Identidade de quem pergunta = o `uid` do caminho** (a regra do banco impede escrever no caminho de outro). A função **não aceita** `uid` no corpo da mensagem.
- **Escopo de squads (decisão de produto, não segurança):** hoje **qualquer @ciahering já lê os cards de qualquer squad** (a regra de `kanban/squads/{id}/dados` aceita o domínio *ou* a membership) e o Painel mostra todos. Então "só os squads da pessoa" seria uma **escolha**, como `analisePO.js` rotula a sua. Padrão do desenho: **o agente vê o que o Painel já mostra à pessoa logada** (todos os squads); a exceção candidata é a **carga individual por pessoa** (`painel_pessoas`), que pode ficar só para ADM/PO — ver §11. O agente hoje só atua em `dev`/`dados` (`squadScope.js`); para o Painel entra a constante própria `PAINEL_SQUADS`.
- **Backup:** o chat **não** entra em `NOS_GLOBAIS` (`backup/completo.js`) — é privado e efêmero de propósito; restaurar conversa alheia seria justamente o que a decisão 4 proíbe.
- **Retenção:** conversa some em 30 dias (limpeza agendada junto com outra rotina existente) — pergunta sobre desempenho não fica para sempre.
- **Custo e limites:** teto de mensagens por pessoa/dia, `MAX_ITERATIONS` 8, resultado de ferramenta truncado, 1 pergunta em voo por pessoa. **Medir no canário antes de abrir:** tokens por pergunta, ferramentas por pergunta e tempo (não estimar de cabeça).

## 6. Segurança — checklist de fronteira (regra 8 do `CLAUDE.md`; passa por `/auditoriaseguranca` antes do deploy)
| Fronteira nova | Risco | Controle desenhado |
|---|---|---|
| **Quem fala com o agente** | externo (visualizador do Painel) gastar cota ou ler dado | regra do nó exige `@ciahering` + Google; a função **recusa** quem não tem perfil de usuário interno; `painel_viewers` fica de fora de leitura **e** escrita |
| **Dado entre squads** | ver mais do que o Painel mostra à pessoa | o agente lê **o que o Painel já mostra** (modelo interno aceito: @ciahering lê todos os squads); restrição extra (ex.: carga por pessoa só para ADM/PO) é **decisão de produto** (§11) e, se adotada, conferida no servidor |
| **Injeção de prompt** (título/descrição/comentário de card, nome de campanha escritos por outras pessoas entram no contexto) | texto "faça X" dentro de um card manipula o agente | **fase 1 sem ferramenta de escrita** (pior caso = texto enganoso); resultado de ferramenta entra como dado delimitado; sistema instrui a nunca seguir instrução vinda de dado; sem busca de URL |
| **Saída → DOM** | XSS / link malicioso na resposta | resposta em blocos tipados (texto, tabela, atalho) — **não** HTML livre; texto por `esc()`; atalhos só para destinos internos (`swPtab` com aba da lista fechada); links externos só `https` (`safeUrl`) |
| **Vazamento por conversa** | resposta com dado de pessoa lida por outro | nó por `uid` **fora de `kanban/painel`** (pai `kanban/painel` liberaria leitura a todos os internos e aos visualizadores externos — herança de regra não se desfaz no filho); leitura só do dono; **ADM não lê conversa alheia** (decisão a confirmar) |
| **Dado pessoal** | e-mail/telefone/feedback no contexto | minimização + lista de exclusão da §3 |
| **Custo (negação por gasto)** | laço ou spam | cota/dia, rate limit, kill switch, `MAX_ITERATIONS`, 1 em voo |
| **Regras do banco** | nó novo sem regra = ninguém lê (ou todos escrevem); pai permissivo vaza | regras novas em `database.rules.json` + **provas em `functions/rules/rulesSim.js`**: outro `uid` **não** lê nem escreve; **visualizador externo** não lê nem escreve; sem login não lê; texto > 2000 caracteres é recusado; `role:'agente'` vindo do cliente é recusado. Deploy das regras **antes** da função |
Resultado esperado desta passada: **"fronteira: X checado, Y exige validação do Caio"** (a lista de regras do Console e o cabeçalho do Pages só o Caio vê).

## 7. Escrever (fase 3) — só como **proposta com confirmação**
O agente nunca escreve sozinho no Painel. Quando a ação faz sentido ("avisa o PO"), devolve um **cartão de proposta** (mockup: bloco amarelo com *Enviar / Editar texto / Cancelar*) mostrando **exatamente** o que será feito; o clique executa **no navegador, com a permissão da própria pessoa** (mesmo caminho que ela usaria à mão). Candidatas, da menos para a mais arriscada: notificar alguém · criar lembrete de gestão · comentar num card · mover card. Cada ação nova repete o checklist da §6.

## 8. Fases e quem faz o quê (`COORDENACAO_AGENTES.md` › *Roteamento por risco*)
| Fase | Entrega | Quem | Onde sobe |
|---|---|---|---|
| **0** | este desenho + decisões da §11 | Claude + Caio | PR de docs |
| **1a** | regras do banco + `agenteAgilPainelChat` (esqueleto, kill switch, cota) + 3 ferramentas (`painel_visao`, `painel_fluxo`, `painel_status`) com testes sobre banco falso | **Codex** (ferramentas puras com teste que falha antes/passa depois) · **Claude** (regras, segurança, prompt, revisão) | Pendente de deploy (Caio): regras → função |
| **1b** | gaveta no `painel-dev.html` (UI, contexto, atalhos, fonte, estados) + teste Playwright 1280/390 | **Claude** (design) · Antigravity (copy, Ajuda, dica, capturas) | `-dev`; promoção em lote |
| **1c** | demais ferramentas (`pessoas`, `dados`, `radar`, `agentes_log`, `erros`, `agenda`) | Codex | idem |
| **2** | "Analisar esta aba" (um clique), atalhos que trocam de aba/filtro, "copiar para o Mural" | Claude + Antigravity | `-dev` |
| **3** | propostas com confirmação (§7), uma ação por vez | Claude (segurança) | `-dev` + deploy |
| **4** *(opcional)* | **Briefing diário** proativo ("o que merece atenção"), agendado, opt-in | Claude | só depois de medir custo |

## 9. Como saber que está bom (testes antes de abrir para o time)
- **Ferramentas:** cada uma com banco falso e **saída esperada fixa** (golden). Mesmos números que a aba mostra para o mesmo dado — esse é o teste de "ler os dados do painel em si".
- **Conjunto de perguntas (evals), ~20:** respostas conferidas por regra (número presente, escopo certo, não vaza squad alheio, recusa o que está na lista de exclusão, não obedece instrução plantada num título de card).
- **Regras (obrigatório, antes de qualquer função):** as provas do `rulesSim.js` da §6 — em especial "visualizador externo não lê `kanban/agente_painel/{uid}`".
- **Paridade:** teste de ouro DOM × ferramenta da §3.2, por ferramenta, em `env` prod e dev (§3.1).
- **Segurança:** usuário de outro squad (só se a decisão §11 restringir), usuário externo, mensagem no caminho de outro `uid`, card com instrução embutida, resposta com `<img onerror>`.
- **Canário:** 1 semana só com o Caio (ADM), medindo custo/pergunta e erros, antes de abrir a gestores.

## 10. O que **não** vai nesta rodada
Agente decidindo sozinho e escrevendo; ler `feedback`/dado pessoal; gerar relatório HTML; acesso de visualizadores externos; histórico compartilhado; qualquer coisa fora do que o Painel já mostra.

## 11. Decisões do Caio (tomadas em 06/11/2026)
1. **Escrita:** fase 1 **só leitura**; propostas com confirmação só na fase 3.
2. **Conversa:** **privada por pessoa**, no nó `kanban/agente_painel[_dev]/{uid}` (fora de `kanban/painel`).
3. **Quem usa:** **só o Caio (ADM) por 1 semana** (canário medindo custo e erros) e depois gestores/POs, vendo **o mesmo que o Painel já mostra**; a **carga individual por pessoa** ("quem está sobrecarregado") fica **só para ADM/PO**.
4. **ADM lê conversa de outra pessoa?** **Não** — só o dono. Se um dia precisar, vira auditoria explícita e registrada.

> Consequências para a implementação: `painel_pessoas` precisa de checagem de papel **no servidor** (ADM/PO) para a carga individual; as provas de regras da §6 incluem "ADM **não** lê o nó de outra pessoa"; o interruptor `painel_enabled` nasce **desligado** e o Caio o liga para o canário.
