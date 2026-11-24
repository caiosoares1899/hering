# 🐟 Cardume v0 — nota de desenho do banco (etapa 1, 24/11/2026)

Plano geral em [`cardume.md`](cardume.md). Esta nota é o **R3**: o desenho vem antes das regras, que vêm com testes no simulador (`functions/rules/rulesSim.js`) e passam por 2 revisões de modelos diferentes antes do `firebase deploy --only database` do Caio.

## Decisões do Caio (23/11/2026)
| # | Decisão |
|---|---|
| 1 | Cada canal de squad é **privado**; o **ADM** pode acessar todos |
| 2 | Mensagem apagada vira **"mensagem apagada"**, com **5 s para desfazer** |
| 3 | Mensagens antigas são **apagadas de tempos em tempos** |
| 4 | **Sem Agente** por enquanto (comandos ficam para depois) |

## Achado que muda o desenho
`kanban/usuarios/{uid}/squads/{id}` **não serve** para privacidade: a regra deixa qualquer conta `@ciahering.com.br` gravar `true` em qualquer squad no próprio nó (é assim que a pessoa entra numa squad hoje). Canal "privado" por esse campo seria privado só de fachada.

**Então o Cardume tem a própria lista de membros**, mantida com a mesma regra de manutenção do Maré: ADM, ou PO/Organizador da squad (o papel não é self-service: só ADM ou PO atribuem): `kanban/cardume/membros/{squad}/{uid}`. No piloto o ADM adiciona as pessoas da `dados`; uma tela de gestão (ADM marca quem está em cada canal, partindo da lista da squad) entra na etapa 2.

**Conversa do card:** os comentários dos cards (`squads/{sq}/dados/card_comments`) já são legíveis por qualquer pessoa da Hering. O canal privado guarda só a **referência** ao card; a conversa do card segue a regra do card (aberta à empresa). Quem abre a conversa de um card no Cardume vê um aviso discreto: "a conversa do card é visível para quem vê o card".

## Nós
| Nó | Conteúdo | Lê | Escreve |
|---|---|---|---|
| `kanban/cardume/canais/{squad}` | `{nome}` — canais que existem | logado Hering | ADM |
| `kanban/cardume/membros/{squad}/{uid}` | `true` | membros do canal (para a @menção e a lista) · quem faz a manutenção | ADM, ou PO/Organizador **da squad** (decisão do Caio, 24/11): exige o papel **por squad** (`squads_roles`), sem cair no papel global. Brecha herdada do Maré: um PO global consegue gravar `squads_roles/{sq} = 'po'` no próprio cadastro — fechar isso é mudança do Maré inteiro (quem atribui papel por squad), decisão pendente |
| `kanban/cardume/msgs/{squad}/{msgId}` | `uid`, `texto` (1–4000), `ts` (servidor), `card?` (`^[A-Za-z0-9_-]{1,64}$`), `cardSq?` (idem), `editado?` (servidor), `apagada?` (`true`) | membro · ADM | ver abaixo |
| `kanban/cardume/ultima/{squad}` | `{ts, uid, id}` da última mensagem (para não lidas) | membro · ADM | membro, no **mesmo update** da mensagem: `id` aponta para uma mensagem dele, não apagada, com o mesmo `ts`; nunca volta no tempo; só o ADM apaga |
| `kanban/cardume/lidas/{uid}/{squad}` | `ts` do último lido | o próprio | o próprio |
| `kanban/cardume/config/retencao_dias` | número (padrão 90) | logado Hering | ADM |

**Sem nó `_dev`** (de propósito): o piloto no `cardume-dev.html` já é uso real, e a página de produção vai ler o mesmo nó, sem migração.

**Membro** = está em `membros/{squad}` **e** entrou com Google `@ciahering.com.br` (uma conta de fora posta na lista por engano continua barrada).

**Hora:** `ts`/`editado` vêm do `serverTimestamp()`; a regra aceita até 60 s antes de `now` (o simulador não congela o relógio) e nunca o futuro.

`msgId` = chave do `push()`, mas a ordem **não confia na chave** (um membro pode escolher a chave): leitura por `orderByChild('ts').limitToLast(50)`, usando o índice de `ts` (achado do Codex na revisão). `ts` tem `.indexOn` para a limpeza.

### Regras de `msgs/{squad}/{msgId}`
- **Criar:** não existe ainda · autor é membro · `uid === auth.uid` · `ts` do servidor · `texto` string de 1 a 4000 · sem `apagada`/`editado`.
- **Editar o texto:** só o autor · `uid` e `ts` não mudam · `editado === now` · mensagem não apagada.
- **Apagar (tombstone):** o autor ou o ADM grava `{uid, ts, apagada: true}` **sem `texto` nem `card`** (o texto sai do banco de verdade). Apagada é final: nada mais muda nela.
- **Remover o nó** (`null`): só o ADM. A limpeza automática usa o Admin SDK (passa por fora das regras).
- **Desfazer em 5 s:** é só do navegador — ao apagar, a tela mostra "mensagem apagada · Desfazer" e **só grava o tombstone depois de 5 s**; desfazer cancela antes de gravar. Fechar a aba nesse meio-tempo = não apagou (lado seguro).

### ADM
`root.child('kanban/usuarios/'+auth.uid+'/role').val() === 'adm'` ou o e-mail do Caio — o mesmo critério das regras de hoje. O ADM lê todos os canais e pode apagar (moderação), mas só **escreve mensagem** em canal do qual é membro.

**Gravação direta num filho** (ex.: só `msgs/dados/m1/uid`) não pode furar o que a mensagem garante: `uid` e `ts` ficam travados no próprio filho, `texto` só muda com `editado` recente, `card` só nasce com a mensagem, `apagada` exige o nó sem texto; em `ultima`, as garantias estão no `.write` do `$squad` (avaliado com o nó inteiro mesmo em escrita de filho). Padrão do `uid` de `card_comments`; achado do advisor.

Campo desconhecido em qualquer nó (`$outro`) é recusado; o "tombstone sem texto" é checado no nível da mensagem (`!hasChild('texto')`), porque a regra de um filho ausente não roda.

## Limpeza e backup (PR separado, R3 de `functions/`)
`cardumeLimpeza` (`onSchedule`, 1×/dia, madrugada): para cada canal, remove `msgs` com `ts` anterior a `retencao_dias` (padrão **90 dias**, ajustável pelo ADM). Deploy: `firebase deploy --only functions:cardumeLimpeza`.
**Backup:** `cardume` entra em `NOS_GLOBAIS` (`functions/backup/completo.js`) **só no semanal**, como a Travessia — conversa privada; quem administra o projeto lê o bucket. A confirmar com o Caio no PR da limpeza.

## Testes no simulador (`functions/rules/__tests__/cardumeRules.test.js`, 9 testes)
Conferidos contra 5 regras sabotadas de propósito (leitura aberta, sem `$outro`, membro se adicionando, tombstone com texto, sem checar a hora): cada uma derruba um teste.
1. Membro lê e escreve no canal; não membro da Hering **não lê nem escreve**; ADM lê sem ser membro; forasteiro/Arezzo não lê.
2. Ninguém se adiciona em `membros`; só ADM.
3. Forjar `uid`, `ts` fora de `now`, texto vazio ou > 4000, `card` com caractere estranho → falha.
4. Editar mensagem alheia falha; editar a própria muda só `texto` + `editado`.
5. Tombstone: autor e ADM apagam; tombstone com `texto` falha; mexer em apagada falha; membro comum não remove o nó.
6. `ultima`: membro grava `{ts: now, uid: próprio}`; não membro não.
7. `lidas`: só o próprio lê e grava.

## Fronteira
Cria nós e regras novos (**fronteira: sim**). O texto de outra pessoa chega à tela → só `textContent` (já praticado no protótipo). Exige: estes testes, revisão do Codex + leitura de segurança do Antigravity, e validação do Caio antes do deploy.

---

# Canais temáticos e temporários (etapa 1b, 24/11/2026)

**Decisões do Caio (24/11):** qualquer pessoa da Hering cria · quem cria escolhe **Aberto** (aparece na lista e qualquer um entra sozinho) ou **Só convidados** · com data de fim, o canal **vira só leitura** e some na limpeza 90 dias depois · nos oficiais, manutenção só por ADM ou PO/Org **da** squad.

## Dois tipos de canal, uma estrutura
O `$squad` das regras vira `$canal`. Todos os nós (`membros`, `msgs`, `ultima`, `lidas`) continuam iguais; muda quem é **gestor** e quem **entra**.

| | Oficial | Temático |
|---|---|---|
| id | o id da squad (`dados`) | `t-<slug>` (`^t-[a-z0-9-]{3,60}$`), e não pode coincidir com squad existente (`squads_meta`) |
| `canais/{id}` | `{nome}` (ADM cria) | `{nome, tipo:'tema', dono, acesso:'aberto'\|'convite', criado, fim?}` — qualquer pessoa da Hering cria, sendo a `dono` |
| gestor (põe/tira membros) | ADM, ou PO/Org da squad (só se o canal **não** tem `dono` nem começa com `t-`) | ADM, a `dono`, ou co-admins em `admins/{id}/{uid}` (a dono e o ADM indicam) |
| entrar sozinho | não | só se `acesso === 'aberto'` e não venceu |
| sair sozinho | sim (tirar o próprio uid) | sim |
| quem vê o canal | toda a Hering vê o nome | aberto: toda a Hering · convite: só membros, gestores e ADM |
| escrever | membro | membro **e** (`fim` ausente **ou** `now < fim`) |

**Mudar o canal temático:** gestor muda `nome`, `acesso` e `fim` (arquivar = pôr `fim` no passado recente); `dono`, `tipo` e `criado` nunca mudam. `fim` entre `criado` e `criado + 365 dias`. Só o ADM apaga o nó do canal (a limpeza cuida das mensagens).

## Listas sem vazar canal privado
O RTDB não filtra uma leitura de lista: quem lê `canais` lê tudo. Por isso a leitura desce para `canais/{id}` e a página monta a lista por dois **espelhos** que as regras mantêm honestos:
- `kanban/cardume/abertos/{id}` = `{nome}` — lista pública dos temáticos abertos (lida por toda a Hering). Só pode existir se `canais/{id}` é tema **aberto** com o mesmo `nome`; quando deixa de ser, qualquer um pode remover a entrada.
- `kanban/cardume/meus/{uid}/{id}` = `true` — "meus canais", lido só pelo próprio. Só pode ser `true` se, depois da escrita, `membros/{id}/{uid}` é `true`; só pode ser removido se não é mais. Quem mexe em `membros` grava o espelho no mesmo `update()`.
- Oficiais entram na lista pelas squads da pessoa (`usuarios/{uid}/squads`) + `meus`.

Criar um temático = um `update()` só: `canais/{id}`, `membros/{id}/{eu}`, `meus/{eu}/{id}` e, se aberto, `abertos/{id}`. As regras que dependem do canal recém-criado olham o **estado depois da escrita** (`newData`), não o `root`.

## Testes novos (no mesmo `cardumeRules.test.js`)
Criar temático (aberto e convite) · id sem `t-` ou de squad existente falha · `dono` forjado falha · entrar sozinho só no aberto e não vencido · sair sozinho · gestor do temático (dono, co-admin, ADM) põe/tira; PO de squad **não** vira gestor de temático com o mesmo nome · canal vencido recusa mensagem e `ultima` · convite invisível para quem não é membro; aberto visível · espelhos `abertos`/`meus` não mentem · `dono`/`tipo`/`criado` imutáveis · `fim` fora da faixa falha.

## Como ficou (implementado em 24/11/2026)
- **Tipo pelo id:** `t-…` = temático; o resto = oficial. O ramo "PO/Org da squad" só vale para oficial, então uma squad chamada `t-x` nunca dá poder sobre um temático (e criar `t-x` com id de squad existente é recusado).
- **A leitura saiu de `canais` (pai) e desceu para `canais/{id}`**: com leitura no pai, o RTDB entregaria todos os filhos (inclusive os só convidados).
- **Vencido no `.write`** de `msgs`, `ultima` e da entrada sozinho em `membros`: vale também para escrita direta em filho. O ADM continua moderando. A dona reabre adiando o `fim`.
- **Espelhos no `.write`** (`abertos`, `meus`): o `.validate` não roda em exclusão.
- **Simulador:** `rulesSim.update()` aplica um `update()` multi-caminho num único estado-depois (como o RTDB), para testar criar/entrar/sair e os espelhos. A confirmação final é a primeira escrita real na etapa 2.
- **Prova:** 19 testes no `cardumeRules.test.js`; 10 regras sabotadas de propósito, cada uma derruba ao menos um teste (inclusive "membros olhando `root` em vez do estado-depois", "PO de squad mandando em temático" e "dona trocando o dono").
- **Achados do Codex (#1924), corrigidos:** (P1) o canal temático **não é apagado pelas regras** — nem pelo ADM, que arquiva pondo `fim`; quem apaga é a limpeza, levando canal, membros, co-admins e mensagens juntos. Temático sem `canais/{id}` não aceita mensagem nem não lidas, e recriar um id com restos é recusado. (P2) `abertos` e `meus` são exigidos **no mesmo `update()`** de quem muda o canal ou os membros (o `.write` de `canais` e de `membros` confere o estado-depois do espelho). (P2) o `rulesSim.update()` passou a avaliar o `.validate` dos **ancestrais** e a tratar objeto vazio como inexistente, como o RTDB.
- **Sem limite de criação** no piloto: qualquer pessoa cria quantos canais quiser e convida quem quiser num só convidados; o caminho é a moderação do ADM (vê e apaga qualquer canal). Se virar problema, entra um limite por pessoa.

## Contratos para as próximas etapas (24/11/2026)
**Etapa 2 — a página grava sempre em pares, num `update()` só** (metade sem a outra = `PERMISSION_DENIED`):
| Ação | Caminhos no mesmo `update()` |
|---|---|
| enviar mensagem | `msgs/{c}/{id}` + `ultima/{c}` (`{ts, uid, id}`, mesmo `ts` = `serverTimestamp()`) |
| pôr/tirar alguém (ou entrar/sair) | `membros/{c}/{uid}` + `meus/{uid}/{c}` |
| criar temático | `canais/{c}` + `membros/{c}/{eu}` + `meus/{eu}/{c}` (+ `abertos/{c}` se aberto) |
| renomear ou mudar `acesso`/`fim` | `canais/{c}/…` + `abertos/{c}` (pôr, atualizar o nome ou tirar, conforme o estado final) |

**Etapa 6 — `cardumeLimpeza` é o único jeito de um temático sumir.** Ao apagar um temático (vencido há mais de `retencao_dias`), remove **junto**: `canais/{c}`, `membros/{c}`, `admins/{c}`, `msgs/{c}`, `ultima/{c}`, `abertos/{c}` e, para cada membro, `meus/{uid}/{c}` e `lidas/{uid}/{c}`. Só bloquear escrita não basta: membros que sobram ainda leriam mensagens que sobram. **Apagar à mão no Console segue a mesma lista.**

## Auditoria do Antigravity (#1924, commit 73692bbb) — respostas
- **(média) Oráculo de membros em `meus`:** quem era de fora gravava `meus/{outra}/{canal}` e, pela resposta, descobria se ela era membro de um canal privado. → `meus/{uid}/{canal}` só é gravado pela **própria pessoa** ou por quem **administra** o canal.
- **(baixa) Co-admin tirava a dona:** → nos temáticos, só a própria dona (saindo) ou o ADM tiram a dona.
- **(baixa, simulador):** `update()` recusa caminho + descendente no mesmo `mapa` (o RTDB recusa) e usa um `now` único por operação.
- **Aceito (registrado):** tentar **criar** um id `t-…` que já existe falha, então dá para "testar" se um id existe (nunca o nome nem os membros). A página gera ids com sufixo aleatório (`t-black-friday-k3f9`), o que torna isso inútil na prática.
- **A confirmar na etapa 2:** o `newData.parent()…` até a raiz num `update()` real (o primeiro envio confere).

---

# Etapa 4 — menções e push (24/11/2026, desenho revisto depois da revisão do Codex)

**Confirmado no 1º teste real do Caio (24/11):** o `update()` de envio grava `msgs` + `ultima` com o **mesmo** `serverTimestamp`, e o `newData.parent()…` até a raiz funciona no RTDB — os dois "precisa_validar" das auditorias estão fechados.

**Por que o desenho mudou (#1931 fechada sem merge):** `kanban/usuarios` é legível por **toda conta Hering** (`.read` no nó-pai — escalado no Quadro). Então a notificação **não pode levar nada do canal**: nem trecho, nem nome, nem id (o id de um temático carrega o *slug* do nome).

## Índice privado de menções — `kanban/cardume/mencoes/{uid}/{id}`
| Campo | Valor |
|---|---|
| `c`, `m` | canal e mensagem |
| `de` | quem mencionou (`auth.uid`) |
| `ts` | servidor |
| `n` | id da notificação genérica que acompanha (prova de origem para o push) |
| `lida` | só a dona muda |

- **Lê:** só a própria pessoa (`auth.uid === $uid`).
- **Cria** (tudo no `.write`, para valer também em escrita de filho; tudo contra o `root`): `de === auth.uid` e `$uid !== auth.uid`; quem menciona **e** quem é mencionado são membros de `c`; o canal existe (temático) e não venceu; `msgs/c/m` existe, é de `auth.uid`, não está apagada e tem `ts` de até 60 s atrás (não dá para "repontar" mensagem velha). Checar que a pessoa mencionada é membro não cria oráculo novo: membro já lê `membros/c`.
- **Muda:** só a dona, e só `lida`. **Apaga:** a dona ou o ADM (e a limpeza, junto com a mensagem). `$outro` recusado.

## Notificação genérica (no nó legível pela empresa)
`{ id, type: 'cardume_mencao', title: '🐟 {primeiro nome} te mencionou no Cardume', sub: 'Toque para abrir a conversa', cardumeRef: <id do índice>, dev, read, ts }` — **sem canal, sem trecho, sem id de canal**. Fica visível à empresa só que *fulano mencionou alguém no Cardume* — decisão consciente (é o mesmo nível de um "💬 menção" do Maré hoje).

## Escrita (dois `update()` por envio)
1. O envio continua atômico: `msgs` + `ultima`.
2. Depois, um `update()` de "melhor esforço" com, para cada pessoa mencionada, `cardume/mencoes/{uid}/{id}` + `usuarios/{uid}/notificacoes/{n}`. (Se as menções fossem no mesmo `update` da mensagem, alguém tirado do canal no mesmo segundo derrubaria a mensagem inteira.)
- As pessoas mencionadas saem do **mesmo parser** que destaca as menções na tela (nome mais longo, fora de código, sem repetir) e da lista de membros **do canal da mensagem**, capturada antes de qualquer `await`. As regras conferem de novo.

## Push com prova de origem
`sendPushOnNotification`, para `cardume_mencao`: lê `cardume/mencoes/{uid}/{cardumeRef}` (Admin SDK) e só manda se o registro existe **e** `n === notifId`. Como as notificações são legíveis por todos, alguém poderia copiar um `cardumeRef` real para uma notificação falsa; amarrar ao id exato da notificação impede (a regra de `notificacoes` não deixa outra pessoa regravar um id que já existe). Helper puro em `functions/common/cardumePush.js`, com teste.

## Links
Push e sino: `cardume(-dev).html?mencao=<ref>`; a página resolve no índice privado. Ref que não resolve (forjada no sino, apagada, sem acesso) → "Menção não encontrada". **Aceito:** dá para forjar um item no **sino** (a regra de `notificacoes` aceita qualquer tipo), mas ele não abre nada nem gera push.

## Página
- **@ Menções** lê `cardume/mencoes/{uid}`; o trecho vem da própria mensagem (acesso de membro; "sem acesso" se a pessoa saiu do canal); `lida` fica no registro.
- Alvo fora das últimas 50 mensagens: busca a mensagem pelo id e mostra numa faixa acima da conversa.
- **Limpeza (etapa 6):** `mencoes` entra no contrato da limpeza (apagar junto com a mensagem/canal).
- **Silenciar canal:** continua fora (só @menção gera aviso, e menção avisa mesmo em canal silenciado).

**Deploy:** regras primeiro, depois a função: `firebase deploy --only database` e `firebase deploy --only functions:sendPushOnNotification`.

## Etapa 3 — Card ↔ conversa (desenho de 24/11/2026)

**Risco R2:** nada de regra nova. Grava num nó que já existe (`kanban/squads/{sq}/dados/card_comments/{card}/{id}`, cujas regras só conferem `uid === auth.uid` e o acesso à squad) e lê um campo de card que a pessoa já pode ler. **Decisão do Caio (24/11):** pode registrar **qualquer** mensagem do canal, não só as próprias, com o nome de cada autor e o aviso de quem vai poder ler.

### 1. Prévia do card colado (Cardume)
- Na mensagem, um link `https://caiosoares1899.github.io/hering/kanban(-dev).html?…squad=SQ…&card=ID` (os parâmetros em qualquer ordem, `SQ` e `ID` passando no `ID_RE`) vira um chip abaixo do texto: **🗂 título do card · Squad**, que abre o card no Maré.
- O título é lido uma vez por sessão por card (`get` de `kanban/squads/SQ/dados/cards/ID/title`, num cache). Se a leitura for negada, o chip mostra "card da squad X (sem acesso)". Se o card não existir, "card não encontrado". O texto entra só por `textContent`.

### 2. 📝 Registrar no card (Cardume)
- **Abrir:** ação "📝 Registrar no card" em qualquer mensagem, inclusive num canal temático já só de leitura. Abre um painel com essa mensagem marcada e caixas para marcar as vizinhas (das 50 carregadas; no máximo 20).
- **Destino:** os cards citados nas mensagens carregadas do canal, ou um campo para colar o link do card. Só grava se a leitura do título deu certo, ou seja, o card existe e a pessoa tem acesso a ele.
- **Aviso antes de gravar:** "Vai aparecer no card **X** para toda a squad **Y** e os ADMs, e fica lá (o canal apaga em 90 dias)." Num temático, aviso a mais: "Quem lê o card pode não estar neste canal."
- **Comentário gravado** (o mesmo formato do Maré): `{id: 'c'+Date.now()+aleatório, uid, author, init, foto, ts: ISO, text, cardume: {c, m}}`.
  - `m` é a primeira mensagem marcada.
  - `text` começa com `🐟 Do Cardume · #canal` e traz uma linha por mensagem: `**Nome** (dd/mm hh:mm): texto`, na ordem da conversa, com no máximo 8000 caracteres.
  - `ts` é sempre ISO, por causa da Armadilha do `localeCompare`.
- O `card_comments_count` é atualizado pela `contarComentarios`, sem nada da página.

### 3. Ver conversa no Cardume (Maré, Codex)
- No `renderCommentList` do `kanban-dev.html`, o comentário com `cardume.c` e `cardume.m` válidos (`ID_RE`) ganha o link **🐟 Ver conversa no Cardume** → `cardume-dev.html?c=…&m=…` (o `?c=&m=` já existe no Cardume).
- Só nas páginas dev enquanto não houver `cardume.html`.
- Quem não é membro do canal cai no "sem acesso" do Cardume. O canal é privado, o card não o abre.

### Fronteira
- **`cardume.{c,m}` escrito por outra pessoa chega a um `href` no Maré:** os dois ids são validados por regex e o destino é fixo, montado com `encodeURIComponent`.
- **O título do card**, escrito por outra pessoa, chega ao Cardume só por `textContent`.
- **O link do card colado:** só esta origem; `squad` e `card` validados pelo `ID_RE` antes de qualquer leitura.
- **Texto do canal privado indo para um público maior:** só por ação explícita, com o aviso de quem lê (decisão do Caio). O `text` passa pelo `renderMd` do Maré, o mesmo caminho de qualquer comentário.
