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
`cardumeLimpeza` (`onSchedule`, 1×/dia, madrugada): para cada canal, remove `msgs` com `ts` anterior a `retencao_dias` (padrão **90 dias**, ajustável pelo ADM). **Desde as #tags (25/11):** remove também as entradas de `tags/{canal}/{tag}/{msgId}` das mensagens removidas (e `tags_ult/{canal}/{tag}` que ficar sem nenhuma entrada); senão o índice guarda órfãos para sempre. Deploy: `firebase deploy --only functions:cardumeLimpeza`.
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

**Risco R2:** nada de regra nova. Grava num nó que já existe (`kanban/squads/{sq}/dados/card_comments/{card}/{id}`, cujas regras só conferem `uid === auth.uid`) e lê um campo de card que a pessoa já pode ler. **Premissa medida no simulador (`cardumeCardRules.test.js`):** `kanban/squads/{sq}/dados` é lido e gravado por **toda conta Google `@ciahering.com.br`** (e pelo externo marcado na squad). O card é, portanto, lido pela **Hering inteira**, não só pela squad. **Decisão do Caio (24/11):** pode registrar **qualquer** mensagem do canal, não só as próprias, com o nome de cada autor e o aviso de quem vai poder ler.

### 1. Prévia do card colado (Cardume)
- Na mensagem, um link `https://caiosoares1899.github.io/hering/kanban(-dev).html?…squad=SQ…&card=ID` (os parâmetros em qualquer ordem, `SQ` e `ID` passando no `ID_RE`) vira um chip abaixo do texto: **🗂 título do card · Squad**, que abre o card no Maré.
- O título é lido uma vez por sessão por card (`get` de `kanban/squads/SQ/dados/cards/ID/title`, num cache). Se a leitura for negada, o chip mostra "card da squad X (sem acesso)". Se o card não existir, "card não encontrado". O texto entra só por `textContent`.

### 2. 📝 Registrar no card (Cardume)
- **Abrir:** ação "📝 Registrar no card" em qualquer mensagem, inclusive num canal temático já só de leitura. Abre um painel com essa mensagem marcada e caixas para marcar as vizinhas (das 50 carregadas; no máximo 20).
- **Destino:** os cards citados nas mensagens carregadas do canal, ou um campo para colar o link do card. Só grava se a leitura do título deu certo, ou seja, o card existe e a pessoa tem acesso a ele.
- **Aviso antes de gravar:** "Vai aparecer no card **X** (squad **Y**). Qualquer pessoa da Hering pode abrir esse card, e o comentário fica lá; o canal apaga em 90 dias." Num temático, a página dá um aviso a mais.
- **Comentário gravado** (o mesmo formato do Maré): `{id: 'c'+Date.now()+aleatório, uid, author, init, foto, ts: ISO, text, cardume: {c, m}}`.
  - `m` é a primeira mensagem marcada.
  - `text` começa com `🐟 Do Cardume · #canal` e traz uma linha por mensagem: `**Nome** (dd/mm hh:mm): texto`, na ordem da conversa, com no máximo 8000 caracteres.
  - `ts` é sempre ISO, por causa da Armadilha do `localeCompare`.
- **As menções são neutralizadas:** o `@` antes de um nome sai do texto copiado. O gatilho `agenteAgilMencao` dispara com "@agente agil" em comentários de `dev` e `dados` (`detectaMencao.js`), e um trecho colado não pode acionar o Agente nem parecer menção a alguém.
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


## GIF na 🐚 Concha — desenho de 24/11/2026 (R3)

> **Gerador das regras:** o bloco `kanban/cardume` de `database.rules.json` sai de `scripts/regras_cardume.py`. Mude **lá** e rode o script, sem editar o JSON à mão. **Validado no banco real em 24/11:** host de fora e host disfarçado recusados, GIF válido aceito. **Busca real validada pelo Caio em 24/11** (o primeiro erro foi a chave; resolvido refazendo o secret e republicando a função). O erro na tela agora mostra o código.

Pedido do Caio. A pesquisa do Codex está no #1945. **Decisão do Caio:** a busca passa por uma **função no servidor**, e a chave da KLIPY fica num secret. API conferida em `docs.klipy.com/*.md`:
- **Busca:** `GET https://api.klipy.com/api/v1/{app_key}/gifs/search?q&page&per_page(8–50)&locale&content_filter(off|low|medium|high)&format_filter`.
- **Em alta:** `…/gifs/trending` (mesmos parâmetros, sem `q`).
- **Item:** `{id(número), slug, title, type, file:{hd|md|sm|xs:{gif|webp|jpg|mp4|webm:{url,width,height,size}}}}`. Um item com `type: "ad"` é anúncio.
- **Imagens:** vêm só de `static.klipy.com`, `static1.klipy.com` e `static2.klipy.com`.
- **Atribuição obrigatória:** o campo de busca diz **"Search KLIPY"**.
- **Opcionais:** `customer_id` e o aviso de compartilhamento (`share`). **Não usamos**, por privacidade.

### Função `conchaGifBusca` (`functions/oceano/conchaGif.js` + núcleo puro `conchaGifCore.js`)
- **Formato:** `onRequest` + `Authorization: Bearer <idToken>`, o padrão do projeto, como a `spotifyRadioSearch` (nenhuma página carrega o SDK de Functions). CORS fixo na origem do Pages. `// AUTH:` declarado.
- **Quem pode:** `contaDaEmpresa(decoded)` (domínio, e-mail verificado e Google) **e** ser membro de pelo menos um canal da Concha (`kanban/cardume/meus/{uid}` com algum `true`, a mesma régua de quem usa a página).
- **Entrada:** `q` (0–50 caracteres; vazio = em alta) e `pagina` (1–5). Nada mais da requisição chega à KLIPY.
- **Saída da KLIPY:** `content_filter=high`, `locale=br`, `format_filter=gif,webp`, `per_page=24`. Sem `customer_id`.
- **Resposta normalizada:** `[{id, t (título ≤ 100), p (prévia xs/sm), u (md), w, h}]`.
  - Descarta anúncio e qualquer item cujas URLs não passem em `^https://static[12]?\.klipy\.com/[A-Za-z0-9/_.-]{1,300}$`.
  - Números entre 1 e 4096.
- **Limites** (transação em `kanban/cardume/gif_uso`):
  - 60 buscas por pessoa por hora;
  - **teto da casa: 90 por hora** enquanto for a chave de teste, que aceita 100 por hora. Ao passar o teto, devolve 429 com mensagem clara.
  - O nó é **fechado** a leitura e escrita pelo navegador; só o Admin SDK grava.
- **Falha:** se a KLIPY cair ou estourar o tempo (6 s), devolve 502 e a página diz "GIF indisponível agora". **Nunca** devolve o erro cru da KLIPY nem a chave.

### Ajustes da revisão (advisor, antes do código)
- **Peso para quem vê:** cada membro baixa o GIF. Por isso, prefere-se **webp**, escolhe-se a versão mais leve com largura entre 200 e 400 px (pelo campo `size`) e itens acima de **2,5 MB** são descartados.
- **Movimento reduzido:** guardar `s` (o quadro parado em jpg, mesmo host). Com `prefers-reduced-motion`, a mensagem mostra o quadro parado e anima ao clicar.
- **Cota:**
  - cache **na memória da função** por `(q, página)`: 10 min para busca e 30 min para em alta. **Só busca nova conta** no teto da casa.
  - cache **por sessão na página**;
  - mínimo de **2 letras** para buscar.
- **Chave:** está no caminho da URL. Ela é montada num único ponto e **nunca** vai para log, erro ou resposta; um teste com `fetch` falso que lança erro contendo a URL garante isso.
- **Privacidade, nos dois sentidos:** a busca vai para a KLIPY **e** a CDN da KLIPY vê o IP de quem **vê** o GIF. O painel diz as duas coisas.
- **Rede:** o navegador de quem vê baixa de `static*.klipy.com`. O Caio confere na rede da empresa, com o FortiGate, antes do piloto.

### Contrato da mensagem (`kanban/cardume/msgs/{c}/{k}`)
- **Campo novo, opcional:** `gif: {u, s?, w, h, t?}`.
  - `u` (animado) e `s` (quadro parado) passam na mesma regex de host; `w` e `h` são números entre 1 e 4096; `t` é texto de até 100 caracteres.
  - Qualquer outro filho é recusado.
- **Criar:** a mensagem precisa de `texto` **ou** `gif` (GIF sem legenda vale).
- **Imutável:** o `gif` só entra na criação. Editar não pode pôr, tirar nem trocar o GIF; só a legenda (`texto`) muda.
- **Apagar:** o registro de apagada (`{uid, ts, apagada}`) **não** pode levar o `gif`.
- **A URL vai no banco, mas só de host fixo.** Guardar só o id exigiria uma consulta à KLIPY por mensagem exibida, para cada pessoa. O risco é o mesmo de guardar o id: em ambos os casos alguém pode apontar para qualquer mídia da KLIPY fora do filtro de conteúdo, e nada de fora da KLIPY passa.

### Página (`cardume-dev.html`)
- **Botão GIF** ao lado do 😀. Ele abre um painel com:
  - o campo "Search KLIPY", com busca 400 ms depois da última tecla;
  - os GIFs em alta ao abrir;
  - a grade de prévias (`<img>` com `loading=lazy`, `referrerPolicy=no-referrer`, `alt` = título);
  - a marca "Powered by KLIPY".
- **Ao escolher:** o GIF fica no compositor com ✕. O Enviar grava `{uid, ts, texto?, gif}` + `ultima`, como hoje.
- **Pendências canceladas:** trocar de canal ou de conta limpa o GIF escolhido e descarta a busca em andamento.
- **Mensagem:** a imagem só aparece se `u` passar na regex. É montada por propriedades do DOM, sem `innerHTML`, com no máximo 240 px e com `alt`.
- **Usos do texto:**
  - 📝 Registrar no card escreve `[GIF: título]`;
  - o trecho da aba @ Menções mostra "GIF";
  - a @menção é lida só no `texto`.

### Testes
- **Regras** (`cardumeRules.test.js`), com sabotagem:
  - criar com GIF, com e sem legenda;
  - host de fora, `javascript:`, `w` de 0 ou 99999, campo extra;
  - pôr, trocar ou tirar o GIF ao editar;
  - apagar mantendo o GIF;
  - nem texto nem GIF.
- **Núcleo da função:** descarta anúncio e host ruim, codifica o `q`, usa os parâmetros fixos e aplica os dois limites por hora.
- **Página:** a busca é interceptada pelo Playwright. Cobre escolher e enviar (cada escrita conferida nas regras), a renderização segura, a troca de canal cancelando, a API fora do ar e o celular.

### Fronteira (checklist `docs/SEGURANCA_FRONTEIRAS.md`)
- **Função nova (`onRequest`):** autenticada, com dois limites, entrada mínima, chave em secret e saída normalizada.
- **Campo novo no banco:** validado por regex de host e imutável.
- **Mídia externa no DOM:** só de host fixo, por propriedade.
- **Privacidade:** a busca digitada vai para a KLIPY, de fora da empresa. O painel diz isso ("a busca vai para a KLIPY"). Nenhum id de pessoa sai.

### Para o Caio (antes do deploy)
1. **Criar o app** no `partner.klipy.com` e **desligar os anúncios** da chave em *Update App Details*.
2. `firebase functions:secrets:set KLIPY_API_KEY` no Mac.
3. **Deploy**, nesta ordem: regras primeiro (`--only database`), depois `--only functions:conchaGifBusca`.
4. **Antes de promover:** pedir a chave de produção (sem limite) e confirmar o preço do uso interno.


## ↩️ Responder — desenho de 24/11/2026 (R3)
Pedido do Caio: o resto da etapa 4. O escopo escolhido foi **Responder com aviso**; reações e o aviso de toda mensagem nova seguem no backlog.
- **Mensagem:** ganha `resp`, o id da original.
  - Só entra **na criação**, precisa ser **do mesmo canal** e **existir**, e não pode ser a própria mensagem.
  - É **imutável** na edição, e o registro de apagada não guarda o `resp`.
  - A citação é montada na tela a partir da original, nunca copiada para o banco. Se a original for apagada, aparece "(mensagem apagada)".
- **Aviso:** reusa o índice privado de menções com **`r: true`**.
  - As regras aceitam o registro só se a mensagem nova (do autor, recente) tem `resp` apontando para uma mensagem **da pessoa avisada**.
  - `r` é imutável.
  - A notificação é genérica: "🐚 {nome} respondeu você na Concha", sem trecho nem canal.
- **Push:** `cardumePush.mencaoConfere` ganha o ramo da resposta: a mensagem é resposta, a original é da pessoa, e quem responde é outra pessoa. O texto vem do servidor: "{nome} respondeu você". O tipo continua `cardume_mencao`, sem tipo novo.
- **Sem duplicar:** a resposta que também @menciona a pessoa gera um aviso só, o de menção. Responder a si mesmo não avisa.
- **Deploy:** `--only database` e depois `--only functions:sendPushOnNotification`.

## 😀 Reagir com emoji — desenho de 24/11/2026 (R3)

Pedido do Caio: reagir a uma mensagem com emoji, "igual aos comentários do Maré". Decisões dele: **uma reação por pessoa** (escolher outro emoji troca, como no Maré) e **aviso no Sino, sem push**.

**Reaproveitado do Maré** (comentários, `kanban-dev.html` › `REACT_EMOJIS`/`toggleReaction`/`_renderReactions`): a lista de 5 emojis `👍 👀 ❤️ ✅ 🎉`, o chip "👍 3" com o seu em destaque e o toque no seu que tira. **Diferente do Maré:** lá as reações ficam dentro do comentário (`reactions: {uid: emoji}`, gravado inteiro por quem reage — qualquer membro reescreve a reação dos outros); aqui cada pessoa só escreve a sua folha.

### Banco
- `kanban/cardume/reacoes/{canal}/{msgId}/{uid}: "<emoji>"` — string idêntica a um item da lista fechada (o ❤️ é U+2764 + U+FE0F; um teste lê a lista da página e confere cada uma nas regras, e o ❤ sem o seletor falha).
- **Ler:** membro do canal ou ADM (como `msgs`). **Escrever** só na folha `$uid`:
  - criar/trocar: `auth.uid === $uid`, membro, canal ativo (oficial ou temático existente), mensagem existente e não apagada;
  - tirar a própria: sempre (inclusive depois de sair do canal ou da mensagem ser apagada);
  - ADM: só apagar.
- Não há `.write` em `{canal}` nem em `{msgId}`: ninguém grava o mapa inteiro (é o furo do Maré). A limpeza por retenção (etapa 6) roda no servidor (Admin SDK), então não precisa de apagar em bloco pelo navegador.
- Mensagem apagada: as reações ficam no banco (a tela não mostra) até a limpeza.

### Aviso (Sino, sem push)
- Tipo novo `cardume_reacao` em `MareNotif.TIPOS` (`pushPossivel:false`; fora do `PUSH_TYPES` do servidor → nunca vira push), resolvido para a Concha.
- **Genérico e sem emoji:** "🐚 Ana reagiu a uma mensagem sua na Concha" — a notificação ainda é lida pela empresa toda até a fase C de `usuarios-leitura-fechar.md` (por isso sem canal, trecho nem emoji; emoji também ficaria velho ao trocar). Abre a Concha.
- **Um aviso por mensagem e pessoa:** id fixo `rx_{msgId}_{uid}` com `noTTLDelete: true`; a regra atual das notificações só deixa outra pessoa CRIAR (não reescrever), e com `noTTLDelete` o "remover" do Sino marca como dispensado em vez de apagar — então reagir/tirar/reagir, mesmo em outra sessão, não repete o aviso. A reação é um `set` próprio e o aviso outro `set`, **só depois que o banco aceitou a reação** (num `update` único, a recusa do aviso repetido derrubaria a reação); na mesma sessão a página nem tenta de novo. (Revisão do Codex.) `noTTLDelete` deixa esses avisos fora da limpeza por idade (que roda no navegador); conferido que não pesa: o Sino unificado lê só as 80 mais recentes (`orderByChild('ts')` + `limitToLast(80)`), o Maré idem (`NOTIF_QUERY_LIMIT`) e nenhuma função varre o nó — o acúmulo é só de armazenamento.
- Não avisa quem reage à própria mensagem.

### Página (`cardume-dev.html`)
- **Uma escuta por mensagem exibida** (`reacoes/{canal}/{msgId}`, redesenho agrupado num quadro), parada ao trocar de canal, ao abrir @ Menções e ao sair da conta. (Antes: faixa `orderByKey + startAt + limitToLast(150)` — a auditoria do Antigravity na #1963 confirmou que chaves forjadas no padrão do `ID_RE`, como `z000`, ficam acima de todo `push()` e ocupavam a faixa, escondendo as reações do canal; a revisão do Codex já tinha trocado as "últimas 60" pela menor chave exibida, por causa de mensagem enviada offline. Por mensagem, as duas coisas somem.)
- Depois de reagir, o foco vai ao chip escolhido (ou volta ao 😀 se a reação saiu); se o banco recusar, o seletor fecha e o aviso não sai.
- Chips embaixo da mensagem (`aria-pressed` no seu; `title`/`aria-label` com quem reagiu); na mensagem **tocada** (celular/iPad), uma linha com os nomes — `title` não existe no toque.
- "😀 Reagir" na pílula: troca os ícones da pílula pelos 5 emojis no mesmo lugar (não abre nada por cima de texto); no toque, a fileira de ações vira a de emojis. Vão reservado à direita recalculado para 5 ícones.
- Nomes e emojis entram por `textContent`; o emoji lido do banco só é mostrado se estiver na lista.

### Testes
- `cardumeRules.test.js`: criar/trocar/tirar a própria; não membro, outra pessoa, mensagem apagada ou inexistente, canal vencido, emoji fora da lista (e ❤ sem seletor), valor não-string, gravar o mapa em `{msgId}`; tirar a própria depois de sair do canal; ADM só apaga. Cada barreira com sabotagem.
- `test_concha_reacoes.js` (navegador): chips, troca, tirar, aviso (1 por mensagem e pessoa, nunca para si), nomes no toque, escuta parada, CADA escrita nas regras reais; `test_concha_ui.js` com 5 ações (vão).

### Fronteira
Nó novo com leitura própria; tipo de notificação novo cujo título é escrito pelo navegador de outra pessoa (falsificável como toda notificação de cliente — sem push, sem link montado do conteúdo); o Sino desenha o título por `textContent` (conferir). Deploy: só `firebase deploy --only database`.

## #️⃣ #tags nas mensagens — desenho de 25/11/2026 (R3)

Pedido do Caio: dividir os assuntos por `#`, como no Slack, e achar pelas pesquisas. **Decisões (25/11):** `#tag` escrita no meio do texto (não sub-assuntos nem seções); o Sonar da Concha acha canais, pessoas e #tags (texto livre das mensagens fica de fora); nada da Concha no Sonar dos outros apps por ora. **PR 1 (este):** índice, regras, etiqueta clicável e a tela da #tag. **PR 2:** Sonar na Concha, que lê `tags_ult`.

### O que é uma #tag
`#` no início ou depois de espaço/parêntese, seguido de 2 a 32 letras, números, `_` ou `-`, **com pelo menos uma letra** (`#1966`, `#1` e números de PR não viram tag) e terminando em algo que não seja letra/número. Fora de blocos e trechos de código; `https://…#ancora` não vira tag (o link é lido antes). A **chave** é a tag em minúsculas como foi escrita (`#Promoção` → `promoção`): assim a regra confere que o texto tem mesmo a tag. Buscar sem acento é trabalho do Sonar (`norm()`). No máximo **10 tags por mensagem** (a tela corta).

### Banco
| Nó | Valor | Lê | Escreve |
|---|---|---|---|
| `kanban/cardume/tags/{canal}/{tag}/{msgId}` | `ts` da mensagem (número) | membro do canal ou ADM | o autor da mensagem, no mesmo update dela |
| `kanban/cardume/tags_ult/{canal}/{tag}` | `serverTimestamp` do último uso | membro do canal ou ADM | membro, no mesmo update de uma entrada da tag |

- **Criar/pôr a entrada** (regra): membro do canal ativo (sem `fim` vencido; temático existente); a mensagem (no estado final da escrita) é de `auth.uid`, não está apagada, o `texto` em minúsculas **contém** `#` + a chave, e o valor é igual ao `ts` dela. Como em `ultima`, a mensagem nova e a entrada vão no mesmo `update()` com o mesmo `serverTimestamp`.
- **Tirar a entrada:** o autor da mensagem ou o ADM (a mensagem apagada guarda o `uid`).
- **`tags_ult`:** número entre `now − 60 s` e `now` (ou seja, `serverTimestamp`), só se a tag tem alguma entrada no estado final. Fica para o Sonar listar as tags de um canal sem baixar o índice inteiro (o SDK não tem leitura rasa). Entrada velha (tag que ninguém usa mais) é inofensiva: a tela da tag diz "nenhuma mensagem".
- `.indexOn: ".value"` em `tags/{canal}/{tag}`: a tela da tag lê `orderByValue().limitToLast(30)` por canal.
- Chave: sem `.`, `$`, `#`, `[`, `]`, `/` nem espaço, 1–32 caracteres e já em minúsculas (`$tag === $tag.toLowerCase()`).

### Escritas (todas num `update()` da raiz)
- **Enviar:** mensagem + `ultima` + `tags/{c}/{t}/{k}: ts` + `tags_ult/{c}/{t}: ts` de cada tag.
- **Editar:** `texto` + `editado` + diferença das tags (nova: `= m.ts`; que saiu: `null`) + `tags_ult` das novas.
- **Apagar (depois dos 5 s):** o resto `{uid, ts, apagada}` + `null` nas entradas das tags do texto.
- **Limpeza** (`cardumeLimpeza`, ainda por fazer): ver *Limpeza e backup*.

### Tela
- A `#tag` no texto vira etiqueta (botão, `textContent`); clicar abre a **tela da #tag**: as mensagens com ela em todos os canais em que a pessoa está (até 30 por canal, as 50 mais novas no total), com canal, autor, hora e trecho; clicar leva à mensagem. A tela usa a mesma saída do canal que a de @ Menções (uma função só, `soltarCanal()`).
- Abuso: só dá para indexar as próprias mensagens, com tags que estão no texto delas.

### Fronteira
Nó novo (`tags`, `tags_ult`) e texto de outra pessoa (a tag) chegando ao DOM: só por `textContent`/`createElement`. As chaves vêm do banco e passam por `TAG_RE` antes de virar leitura ou tela. Leitura só de membro, como `msgs`.

## 🔔 Avisos de mensagem nova, estilo WhatsApp — desenho de 25/11/2026 (R3)

Ideia do backlog (24/11) + pedido do Caio (25/11): vem ligado para todas as mensagens, a pessoa personaliza por canal, e #tags seguidas avisam. **Decisões (25/11):** 3 níveis por canal (🔔 Todas, padrão · 🔕 Só @menções e #tags que sigo · 🚫 Nada, nem menção), com prazo de 8 h, 1 semana ou sempre; #tag seguida avisa **mesmo com o canal em 🔕**; o push diz **nome + canal + #tag**, sem trecho (temático só de convidados vira "num canal privado"). Já decidido em 24/11: respeita o Não Perturbe, não avisa quem está com a conversa aberta, junta as mensagens seguidas do mesmo canal, push direto pela função **sem gravar no Sino** (o nó de notificações é legível pela empresa).

### Banco (tudo privado da pessoa, só ela lê e grava)
| Nó | Valor |
|---|---|
| `kanban/cardume/avisos/{uid}/{canal}` | `{nivel: 'mencoes'|'nada', ate?}` — sem nó (ou `ate` vencido) = 🔔 todas; `ate` no futuro, até ~1 ano; sem `ate` = sempre |
| `kanban/cardume/seguidas/{uid}/{tag}` | número (quando passou a seguir); mesma chave das `tags`; a tela limita a 30 |
| `kanban/cardume/vendo/{uid}/{canal}` | `serverTimestamp` a cada 30 s com a conversa visível; **um por canal** (duas abas em canais diferentes não se atrapalham); some ao trocar de canal, ao abrir uma lista, com a aba escondida e ao cair (`onDisconnect`) |
| `kanban/cardume/aviso_env/{uid}/{canal}` | trava da função (último push de "todas"); **fechado** nas regras, como `gif_uso` |

### Função `conchaAvisoMsg` (`functions/oceano/conchaAvisos.js`, gatilho em `msgs/{canal}/{msgId}` criada)
Ninguém recebe: mensagem apagada, com mais de **2 min** (a restauração do 🛟 backup recria mensagens velhas), canal vencido, autor fora do canal, ADM desligou o tipo `cardume_msg` na Central de Notificações (sem botão no Painel por ora). Para cada membro, na ordem: autor → **mencionado ou respondido** (já tem o push da menção; mesmo leitor do `cardumePush`) → 🚫 nada → 🔕 sem #tag seguida → **vendo** (< 70 s) → Não Perturbe → **conta de fora da empresa** (e-mail do Firebase Auth; `membros` não confere domínio) → **trava**: 1 push de "todas" por canal a cada 2 min (o iPhone não junta pela tag). #tag seguida não espera a trava. Push só `data`, tag `concha-{canal}`, link `cardume-dev.html?c=&m=`; poda tokens mortos.
**🚫 Nada também cala o push da @menção:** `cardumePush.mencaoValida` lê `avisos/{uid}/{canal}`. O Sino genérico da menção continua (quem menciona grava e não enxerga a preferência).

### Limites (ditos ao Caio)
- Editar uma mensagem para pôr uma #tag seguida não avisa (o gatilho é só na criação).
- Mensagem só com GIF avisa como "🐚 Ana em # Dados".
- O nível é da pessoa: vale igual em todos os aparelhos dela.

### Deploy
Regras **antes** do merge (a tela nova grava `avisos`/`seguidas`/`vendo`); depois `firebase deploy --only functions:conchaAvisoMsg,functions:sendPushOnNotification`.
