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

**Então o Cardume tem a própria lista de membros**, que só o ADM edita: `kanban/cardume/membros/{squad}/{uid}`. No piloto o ADM adiciona as pessoas da `dados`; uma tela de gestão (ADM marca quem está em cada canal, partindo da lista da squad) entra na etapa 2.

**Conversa do card:** os comentários dos cards (`squads/{sq}/dados/card_comments`) já são legíveis por qualquer pessoa da Hering. O canal privado guarda só a **referência** ao card; a conversa do card segue a regra do card (aberta à empresa). Quem abre a conversa de um card no Cardume vê um aviso discreto: "a conversa do card é visível para quem vê o card".

## Nós
| Nó | Conteúdo | Lê | Escreve |
|---|---|---|---|
| `kanban/cardume/canais/{squad}` | `{nome}` — canais que existem | logado Hering | ADM |
| `kanban/cardume/membros/{squad}/{uid}` | `true` | membros do canal (para a @menção e a lista) · ADM | ADM |
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
