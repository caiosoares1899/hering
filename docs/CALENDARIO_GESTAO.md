# 📅 Calendário de gestão do Digital (Radar)

> **Estado em 04/11/2026.** Tudo abaixo está **em produção** (`okr.html` v2.103, PR #1588) e o OKR do próprio calendário foi criado no Radar (Objetivo "Calendário de gestão do Digital", script `docs/arezzo/okr_calendario_gestao.js`). O texto das seções 3 a 11 foi escrito quando só existia em dev: onde disser "só em DEV" ou "pendente de promoção", leia como já promovido; o que ainda falta está na seção 11 e nos Marcos a fazer do OKR.

## 1. O que é e por que existe

O **Rafael** (gestão) pediu ao Caio um calendário com as **cerimônias e as entregas da gestão do Digital** — os eventos gerais do Digital. A decisão foi construí-lo **dentro do 📅 Calendário do Radar** (e não numa ferramenta nova), porque são **pilares estratégicos**: o Radar já tem agenda global, recorrência, lembretes, pauta sugerida e o Agente Ágil.

Além de mostrar datas, o calendário precisa **cobrar**: o objetivo do **subagente de agenda** é ser o *orquestrador* — marcar as reuniões, cobrar os envolvidos, organizar prazos e entregas. Resultado, em três camadas que se apoiam:

| Camada | O que faz | Onde |
|---|---|---|
| 1. Calendário | 📦 **Entrega** (prazo + responsáveis + situação), **macro** (PLAN/CHECK/DO/ENGAJAMENTO), **Cadência do Digital** (gera o que o rascunho pede) | `okr-dev.html` |
| 2. Cobrança automática | Todo dia útil, às 7h: avisa quem deve, escala o atraso, resumo da gestão na segunda | `functions/okr/cobranca.js` |
| 3. Subagente de agenda | Conversa com o Agente Ágil: propõe criar/remarcar/excluir/cobrar; a pessoa confirma com 1 clique | `functions/okr/agendaAgente.js` + cartão no chat |

## 2. O rascunho do Rafael (a fonte do desenho)

Planilha "Rascunho Calendário", transcrita (o PDF não está no repositório):

| Macro | Momento de pico | Itens |
|---|---|---|
| **PLAN** | 3º trimestre (anual) | Estratégia de Crescimento do Digital · Planejamento Estratégico Anual com Alavancas de Crescimento (números + iniciativas) · Plano Financeiro (Orçamento de Vendas, Orçamento de Despesas) |
| **PLAN** | todo trimestre | **Plano Tático do Trimestre** (foco em resultado, não transformação; versão simplificada do planejamento da Black) com 7 planos: Comercial, Calendário, Mídia, CX, Operacional/Logístico, Estoque, Faturamento |
| **PLAN** | todo trimestre | **Plano de Compras** (Out, Inv, Ver, AV) |
| **CHECK** | todo trimestre | All Hands (plano tático + iniciativas) |
| **CHECK** | semanal | Reunião de Resultados do E-commerce |
| **CHECK** | quinzenal / semanal | Iniciativas do Digital |
| **DO** | — | Rituais ágeis (squads, entre squads, gestores) · Showroom de Compra · Data de lançamento das coleções |
| **ENGAJAMENTO** | — | Big Review · Encontro dos Fritos · Weeklyzona · Pulso dos Times / Travessia |

### Decisões do Caio sobre o rascunho (03/11/2026)
- **Rituais ágeis**: **não entram** — o time já se organiza.
- **Big Review, Encontro dos Fritos, Weeklyzona**: **não entram** — já estão organizados no Google Agenda (na agenda do Caio, compartilhada com todos).
- **Pulso dos Times / Travessia**: só como **lembrete**.
- **Showroom de Compra e Lançamento das Coleções**: **têm uma data por coleção** (Out, Inv, Ver, AV); o Caio cadastra as datas e indica **as pessoas que o agente vai cobrar**.
- **Iniciativas do Digital** = **o mesmo ritual do bloco quinzenal** (Check-in OKR Bloco 1/2) que já existe no Radar — por isso não é criado de novo.
- **Plano de Compras**: **cada trimestre fecha uma coleção só**; o dono de cada plano pode editar depois.
- **Cobrança**: régua padrão; quem recebe o escalonamento: Caio **e Rafael** (os dois são ADMs); resumo semanal pelo **sino e push**.
- **Subagente**: começa **propondo** (nunca grava direto); a pessoa confirma.

## 3. O que existe hoje (PRs mergeadas, todas em dev)

| PR | Entrega |
|---|---|
| **#1575** | Tipo 📦 Entrega, campo macro, filtro, botão 📋 Cadência do Digital, ajuda do Radar |
| **#1576** | Plano pai conclui com as filhas; excluir plano com filhas pergunta; aviso "📦 Prazo amanhã"; Plano de Compras de 1 coleção/trimestre; "Iniciativas" saiu do gerador |
| **#1577** | Cobrança automática (`cobranca.js`), tipo de notificação `okr_cobranca`, regras `cobranca_config` e `cobrancas_log` |
| **#1578** | Subagente de agenda (`agendaAgente.js`), cartão ✅/✖ no chat, `listar_agenda` enriquecida, regra `agenda_propostas` |

### 3.1 📦 Entrega (o modelo de dados)
Evento do calendário (`kanban/okr/calendario/eventos/{id}`) com `tipo:'entrega'`. Campos **novos**:

| Campo | Para quê |
|---|---|
| `macro` | `'plan' \| 'check' \| 'do' \| 'engajamento' \| ''` — selo e filtro; vale para **qualquer** tipo |
| `status` | `'a_fazer' \| 'andamento' \| 'entregue'` — só entrega |
| `paiId` | id de uma entrega-plano maior (1 nível: o Plano Tático é pai dos 7 planos) |
| `convidados` | **na entrega são os responsáveis** (quem entrega e quem é cobrado) |
| `statusPor`, `statusEm` | quem mudou a situação e quando |
| `cadencia` | chave do item gerado pela Cadência (idempotência) |

Regras do tipo: a **data é o prazo**, é **dia inteiro**, **não repete** (cada trimestre/coleção ganha a sua entrega, com situação própria); passou do prazo sem estar entregue → selo **Atrasada** (texto, não só cor). Quem muda a situação: **o responsável** ou quem edita o evento (ADM, PO/Organizador/Gestor OKR da torre). **Entregue não lembra mais** (`functions/okr/calendario.js › lembretesDe`).

**Plano pai ↔ filhas:** o pai mostra o andamento (`3/7`); quando **todas** as filhas estão entregues o pai é **concluído sozinho** (gravado, para o servidor parar de lembrar) e **reabre** se uma filha volta atrás (`_okrCalPaiPatch`). Excluir um plano com filhas pergunta: só o plano (filhas ficam avulsas) ou o plano e as filhas.

### 3.2 Macro
Selo de texto (sem emoji novo) `PLAN · CHECK · DO · ENGAJAMENTO` em qualquer item, com **filtro "Todas as macros"** na barra do calendário. O bloco quinzenal importado ganha `macro:'check'`.

### 3.3 📋 Cadência do Digital (botão só do ADM)
Gera **de uma vez e sem duplicar** (id fixo `cad_<chave>`; aplicar de novo não cria nada repetido) o que o rascunho pede. Você escolhe o **trimestre** (os próximos 4); cada trimestre gera:

- **Plano Tático — Nº tri AAAA** (pai) + **7 planos filhos** (Comercial, Calendário, Mídia, CX, Operacional/Logístico, Estoque, Faturamento);
- **Plano de Compras de _Coleção_ — Nº tri AAAA** — **uma coleção só por trimestre** (provisório: Q1 Inv · Q2 Ver · Q3 AV · Q4 Out; é só o título, o dono edita se for outra);
- **All Hands — Nº tri AAAA** (reunião);
- no **3º trimestre**, também os 5 planos anuais: Estratégia de Crescimento, Planejamento Estratégico Anual, Plano Financeiro (pai) com Orçamento de Vendas e de Despesas;
- **fixos (uma vez, repetem):** Reunião de Resultados do E-commerce (semanal) e lembrete do Pulso dos Times / Travessia (mensal).

Prazo dos planos: **15 dias antes do início do trimestre**, em dia útil (os anuais, no fim do 3º tri). **Tudo nasce provisório** (dia inteiro, sem responsável): o ADM ajusta datas e escolhe os responsáveis. **As reuniões (All Hands, Resultados) e o lembrete nascem com os lembretes DESLIGADOS**: uma reunião sem recorte cobre a torre inteira e, com o banco compartilhado entre dev e produção, um lembrete ligado avisaria todos os donos de OKR do Digital de uma data chutada. Ligue em ✏️ Editar → 🔔 Avisos depois de confirmar data e participantes. **Showroom e Lançamento das Coleções ficam de fora** — a data é de cada coleção; cadastre como **Entrega, macro DO**, com os responsáveis. "Iniciativas do Digital" **não** é gerada: é o bloco quinzenal (banner "📥 Importar bloco quinzenal").

## 4. 🔔 Cobrança automática (`functions/okr/cobranca.js`)

Roda **dentro do `okrDailyScan`** (todo dia às 7h, Brasília) — **sem IA**, por data: previsível, não inventa prazo nem pessoa. **A contagem é em DIAS ÚTEIS** (sábado e domingo não contam; revisão do Antigravity, 03/11): em dias corridos, o prazo de sexta pulava o "atrasou 1 dia" e escalava na segunda, e o prazo de terça nunca recebia o preventivo. Alvo da cobrança = os **responsáveis (`convidados`)** da entrega **aberta**; **plano pai com filhas não é cobrado** (as filhas são); entrega **sem responsável** não tem a quem cobrar e aparece só no resumo.

| Estágio | Quando | Quem recebe |
|---|---|---|
| preventivo | faltam 2 ou 3 **dias úteis** | responsáveis |
| véspera | falta 1 dia útil (prazo de segunda avisa na **sexta**, nunca no domingo); respeita `lembrar.vespera` | responsáveis |
| dia | vence hoje (prazo em fim de semana avisa na sexta); respeita `lembrar.dia` | responsáveis |
| atraso-1 | 1 ou 2 dias úteis depois do prazo | responsáveis |
| atraso-3 | 3 dias úteis ou mais (1×) | responsáveis **+ escalonamento**: gestores e quem criou a entrega |
| semanal | toda **segunda**, enquanto atrasada (depois do atraso-3) | responsáveis |
| **resumo da gestão** | toda segunda | só os **gestores**: *N atrasadas · M vencem esta semana · K sem responsável* |

**Gestores** = `kanban/okr/cobranca_config/gestores` (mapa `{uid:true}`); **sem lista, os ADMs** (e-mails de `kanban/config/adm_emails`, com o padrão do código — **Caio e Rafael**). Hoje **não há tela** para editar a lista (só ADM escreve esse nó, regra do banco).

**Anti-spam:** 1 notificação **por pessoa por dia** (várias entregas viram um resumo); **nada em sábado/domingo**; **entregue encerra**; cada aviso é **carimbado** em `kanban/okr/cobrancas_log/{eventoId}/{estágio}` com a **data do prazo** (mudou o prazo, a régua recomeça; o mesmo aviso nunca sai 2×; carimbo de entrega apagada é limpo). Tipo da notificação: **`okr_cobranca`** (sino + push; o ADM liga/desliga na 🔔 Central de Notificações do Painel). **Véspera e dia das entregas saem daqui** (e não do gatilho 3 do `dailyScan`, que ignora `tipo:'entrega'`): assim valem fim de semana, 1 notificação por pessoa e o tipo `okr_cobranca` (desligar esse tipo na Central desliga todos os avisos de entrega). Textos: "📦 Vence amanhã/hoje: …", "📦 Entrega atrasada: …".

## 5. 🗓️ Subagente de agenda (`functions/okr/agendaAgente.js`)

O **Agente Ágil do Radar** (chat do botão 🤖, função `okrAgenteChat`) ganhou duas ferramentas e uma leitura melhor.

**Regra de ouro: ele nunca grava no calendário.** Cada ferramenta só **prepara uma proposta** (`kanban/okr/agenda_propostas/{id}`, status `pendente`); a pessoa confirma com **✅ Confirmar** (ou ✖ Descartar) num **cartão** que aparece sob a resposta dele. Motivo: uma data alucinada numa reunião recorrente dispararia notificação para dezenas de pessoas na hora.

- **`propor_agenda_evento`** — `acao`: `criar` · `editar` · `excluir` · `mudar_situacao` (reunião, evento, lembrete ou entrega; macro, plano pai, responsáveis por nome, repetição…).
- **`propor_cobranca`** — cobrar agora os responsáveis de uma entrega (sino + push, tipo `okr_cobranca`); **1 cobrança manual por entrega a cada 48 h**.
- **`listar_agenda`** (leitura) agora devolve **macro, situação, plano pai e responsáveis (nomes)** e filtra por `tipo`, `macro`, `situacao`, `so_atrasadas` (com `dias_atraso`) e `sem_responsavel`. Responde "o que está atrasado na gestão do Digital?" (chip pronto no chat).

**Trava de segurança no próprio agente:** não chuta data, hora nem responsável (falta algo → pergunta; **nome ambíguo** — "Ana" — ou desconhecido volta como erro); data no passado, hora ausente em reunião, link sem `https://`, entrega que repete, plano pai inválido → recusa. **Permissão** espelha a da tela: criar/editar/excluir = ADM, ou PO/Organizador/🎯 Gestor OKR da torre (agenda global só ADM); mudar situação = isso **ou** o responsável.

**A confirmação** (`_okrAgendaConfirmar` em `okr-dev.html`) aplica **pelos mesmos caminhos da tela**, com as mesmas permissões e os mesmos avisos no sino. Só confirma **quem pediu** (ou um ADM); os demais veem "Aguardando fulano confirmar". Proposta de **edição com base velha** (o evento mudou depois) **não grava** — o cartão vira "Não foi aplicada: …". Excluir pelo agente **solta** as filhas (a escolha de levar junto só existe na tela). Propostas com mais de 30 dias são limpas; só são baixadas quando há uma no chat.

## 6. Permissões, segurança e limites (o que é honesto saber)

- **Regras do banco (`database.rules.json`):** `kanban/okr/calendario` **continua aberto a qualquer conta `@ciahering`** (como todo o Radar). As travas de "quem cria/edita" estão **na tela e na confirmação**, não no banco. Endurecer exige espelhar permissão por torre/organizador/responsável nas regras e testar no simulador (`functions/rules/`) — **PR à parte, ainda não feita**. `agenda_propostas` também é aberto à empresa (o cartão só mostra botões a quem pediu/ADM).
- **Só o ADM** escreve `kanban/okr/cobranca_config`; **só o servidor** escreve `cobrancas_log`.
- O agente **não tem acesso a agenda pessoal de ninguém** — só ao calendário do Radar.
- Dado novo no banco → **backup**: `kanban/okr` já entra no backup completo (nenhum nó novo na raiz).

## 7. Como funciona por dentro (âncoras — sempre re-`grep` antes de confiar em linha)

| Peça | Onde |
|---|---|
| Tipos/macros/situação, selos, filtro | `okr-dev.html`: `OKR_CAL_TIPOS`, `OKR_CAL_MACROS`, `OKR_CAL_STATUS`, `_okrCalSelos`, `_okrCalSetMacro` |
| Entrega no formulário/detalhe | `renderOkrEventoEditor`, `_okrEvTipo`, `saveOkrEvento`, `_okrEvdEntregaHtml`, `_okrEvStatus`, `_okrCalPodeStatus` |
| Pai ↔ filhas | `_okrCalFilhos`, `_okrCalProgresso`, `_okrCalPaiPatch`, `_okrEvExcluir` |
| Cadência | `_okrCadenciaItens`, `_okrCadenciaFixos`, `_okrCadenciaMontar`, `_okrCadenciaAbrir`, `OKR_CAD_COMPRAS` |
| Cartões do agente | `_okrAgendaCartoes`, `_okrAgendaConfirmar`, `_okrAgendaAplicar`, `_okrAgendaPropLiga` |
| Cobrança | `functions/okr/cobranca.js` (`runCobrancaEntregas`, `estagiosDe`, `gestoresDe`), chamada em `functions/okr/dailyScan.js` |
| Lembretes | `functions/okr/calendario.js › lembretesDe` (entregue = sem lembrete) |
| Subagente | `functions/okr/agendaAgente.js`, ferramentas registradas em `agenteTools.js` (`buildOkrTools`), prompt em `agentePrompt.js` |
| Notificação | `okr_cobranca` em `PUSH_TYPES` (`functions/index.js`) e em `MareNotif.TIPOS` (`mare-notif-dev.js`) |
| Regras | `database.rules.json`: `cobranca_config`, `cobrancas_log`, `agenda_propostas`; testes em `functions/rules/__tests__/okrRules.test.js` |

## 8. Testes

`functions/okr/__tests__/cobranca.test.js` (14) · `agendaAgente.test.js` (10) · `calendario.test.js` · `functions/rules/__tests__/okrRules.test.js` · navegador: `docs/arezzo/testes/test_calendario_gestao.js`, `test_radar_agenda_agente.js`, `test_calendario.js`. Roda tudo: `cd functions && npm test` + os `node docs/arezzo/testes/…` com `python3 -m http.server 8941`.

## 9. Deploy (só o Caio) e promoção

| O quê | Comando (no Mac, `cd ~/hering && git pull`, projeto `hering-onboarding`) | Estado |
|---|---|---|
| Regras (`cobranca_config`, `cobrancas_log`, `agenda_propostas`) | `firebase deploy --only database --project hering-onboarding` | informado como feito em 03/11 |
| Cobrança + véspera/dia/atraso das entregas (dias úteis) | `firebase deploy --only functions:okrDailyScan,functions:sendPushOnNotification --project hering-onboarding` | #1577 feito; **a correção de dias úteis precisa de novo deploy de `okrDailyScan`** |
| Subagente (e o aviso de filhas no cartão de exclusão) | `firebase deploy --only functions:okrAgenteChat --project hering-onboarding` | informado como feito em 03/11 — **confirmar; refazer após a correção de dias úteis** |

**Promoção para produção (pendente):** `okr.html` + `mare-notif.js` (`?v=38` em kanban/painel/okr/oceano) via `/subirproprod` (as páginas dev à frente de prod hoje: Radar v2.102, Maré dev, Painel, Oceano). Como o agente **lê a Ajuda de produção**, a promoção também **regenera o conhecimento** (`cd functions && npm run conhecimento`) e **republica as funções do agente** (`agenteAgilMencao`, `agenteAgilMencaoDados`, `agenteAgilIntake`, `agenteAgilAnalisePO`, `okrAgenteChat`). Avisos (Mural/WhatsApp): decidir na promoção.

## 10. Como validar no dev (roteiro curto — Caio e Rafael)

1. Radar dev → 📅 Calendário → **📋 Cadência do Digital** → escolher o próximo trimestre. Conferir: Plano Tático com 7 filhas, Plano de Compras de 1 coleção, All Hands, Resultados do E-commerce, Pulso. Aplicar de novo: **nada duplica**.
2. Abrir uma entrega → colocar **responsável** e **prazo real**; marcar filhas como entregues e ver o **pai concluir** (`7/7`) e reabrir.
3. Cadastrar **Showroom** de uma coleção como **Entrega, macro DO**, com responsáveis.
4. Chat do 🤖: *"o que está atrasado na gestão do Digital?"*, *"cria a entrega X pra dia 15 com a Fulana"* → aparece o **cartão ✅/✖**; confirmar e ver no calendário; testar um nome repetido.
5. Cobrança: uma entrega com prazo **daqui a 3 dias** e responsável → no scan das 7h (ou teste controlado pedido ao Claude) chega o "📦 Vence em 3 dias". Segunda de manhã: **resumo da gestão** para Caio e Rafael.
6. Conferir no celular (390 px) e nos 3 temas (Abrolhos, Lençóis, Vice City).

## 11. O que ficou de fora / próximos passos

1. **Endurecer as regras do banco do calendário** (permissão por torre/organizador/responsável) — PR própria, com o simulador de regras.
2. **Ponte com o Google Agenda** (só **leitura**): espelhar no Radar os eventos de **uma agenda secundária compartilhada "Gestão Digital"** (hoje Big Review/Fritos/Weeklyzona vivem na agenda pessoal do Caio, compartilhada). Princípios (da revisão do Antigravity, com os quais o Claude concorda): **nada de sincronização nos dois sentidos**; **nunca ler agenda pessoal**; só a agenda de serviço; compartilhar essa agenda com a **service account** do Firebase pode evitar delegação de domínio (**confirmar com a TI**). Criar reunião com Meet a partir do Radar é opcional e exige escopo OAuth de escrita.
3. **Tela para a lista de gestores** da cobrança (hoje só pelo banco).
4. Ajuda do Radar já descreve o recurso; **guia-okr.html** e o **conhecimento do Agente** só mudam na promoção.
5. **Gemini Enterprise / Antigravity**: Antigravity entra em ajustes pequenos e documentação (ver `docs/COORDENACAO_AGENTES.md`); Claude segue em cobrança, agente e regras. Decidir onde o Gemini entra só depois de o desenho estar validado no dev.
6. Cobrança por **Google Chat/e-mail** (descartado por ora: sino e push, por decisão do Caio); WhatsApp automático **não recomendado** (API paga/aprovada).

## 12. Histórico de decisões e revisões

- **03/11/2026** — pedido do Rafael → desenho no Radar; rascunho transcrito; respostas do Caio (seção 2); **revisão do Antigravity** apontou 4 achados reais, todos corrigidos na #1576: plano pai "Atrasada" com 7/7 filhas entregues, filhas órfãs ao excluir o pai, texto de aviso de entrega ("convidado" → "responsável"), `update` atômico do status. Apontou também (não implementado): regras do banco abertas e uso de agenda compartilhada do Google.
- **2ª rodada do Antigravity (03/11, leitura do código):** 4 riscos reais, todos corrigidos — (1) contagem em dias corridos × fim de semana pulado (sexta escalava na segunda; terça sem preventivo) → **dias úteis**; (2) reuniões da Cadência avisariam a torre inteira com data provisória → **lembretes desligados**; (3) véspera/dia das entregas saíam do gatilho 3 (domingo, sem agrupar, tipo `okr_reuniao`, pai com responsável) → **movidos para `cobranca.js`**; (4) cartão de exclusão de plano não avisava que as filhas ficam avulsas → **aviso no cartão**.
- Erros factuais do relatório do Antigravity (conferidos no código, **não** vale seguir): o agente do Radar usa **Claude** (não Gemini); `okr_users`, `kanban/painel/config/admins` e o deep link `?cal=` **não existem**.
- Registro técnico: `CHANGELOG.md` (4 entradas "SÓ DEV" de 03/11/2026) e `BUGS_E_CORRECOES.md` (achados pós-revisão).
