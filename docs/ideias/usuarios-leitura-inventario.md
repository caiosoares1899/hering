# Inventário de leituras de `kanban/usuarios` no navegador

Base de código `1bcc9cec`. Este levantamento estático detalha o [achado escalado](../quadro/escalados.md#usuarios-leitura-ampla). Em [database.rules.json L1369](../../database.rules.json#L1369), a leitura do nó-pai é concedida a contas Google Hering e alcança todos os descendentes. A regra do próprio UID concede acesso ao dono, inclusive para contas que não passam pela regra do pai. As consultas `root.child('kanban/usuarios/'…)` nas regras de outros nós são avaliadas no servidor e independem de permissão `.read` do cliente sobre o caminho consultado.

## 1. Resumo

Cada ponto de leitura é contado uma vez, inclusive os que usam cache, rodam em loop ou são alternativas condicionais. `query` configura a leitura do listener e não soma um ponto. Transações que consultam o valor atual entram na conta porque dependem de leitura. O escopo (b) inclui alvos variáveis que podem ser outra pessoa. O escopo (c) inclui apenas caminhos limitados à sessão nas páginas dev. A coluna grep inclui comentários, escritas e `usuarios_publicos`.

| Arquivo | (a) Nó inteiro | (b) Outro UID possível | (c) Próprio UID | Linhas do grep literal |
|---|---:|---:|---:|---:|
| `kanban-dev.html` | 0 | 2 | 16 | 118 |
| `painel-dev.html` | 3 | 3 | 6 | 54 |
| `okr-dev.html` | 1 | 0 | 2 | 22 |
| `oceano-dev.html` | 0 | 0 | 2 | 9 |
| `escala-dev.html` | 0 | 0 | 0 | 2 |
| `intake-dev.html` | 0 | 0 | 0 | 2 |
| `travessia-dev.html` | 0 | 0 | 1 | 2 |
| `cardume-dev.html` | 0 | 0 | 1 | 6 |
| `mare-dicas-dev.js` | 0 | 0 | 2 | 4 |
| `mare-ferias-dev.js` | 0 | 0 | 0 | 0 |
| `mare-gcal-dev.js` | 0 | 0 | 2 | 5 |
| `mare-gxl-dev.js` | 0 | 0 | 0 | 0 |
| `mare-login-dev.js` | 0 | 0 | 0 | 0 |
| `mare-metas-dev.js` | 0 | 0 | 0 | 0 |
| `mare-notif-dev.js` | 0 | 0 | 5 | 22 |
| `mare-plantao-dev.js` | 0 | 0 | 0 | 1 |
| `mare-sonar-dev.js` | 0 | 0 | 0 | 0 |
| `mare-timer-dev.js` | 0 | 0 | 0 | 0 |
| **Total** | **4** | **5** | **37** | **247** |

As oito páginas e os dez módulos na tabela são a lista de fontes de navegador examinadas. As contagens ficam no arquivo que emite a operação. Um módulo compartilhado continua contando uma vez quando carregado por várias páginas.

## 2. Leituras do nó inteiro ou de outra pessoa

“Quem roda” descreve quem chega ao fluxo pelo código da página. Uma guarda na interface e a permissão efetiva no banco são coisas distintas. Painel e Radar selecionam `usuarios_publicos` em `_usuariosNode()` para o externo cadastrado em `painel_viewers`. As linhas do nó inteiro nesses dois arquivos descrevem o ramo interno.

| Arquivo e função | Escopo e operação | Para quê | Quem roda | Disponibilidade em `usuarios_publicos` |
|---|---|---|---|---|
| [painel-dev.html:6391](../../painel-dev.html#L6391) `_migrarSquadMidiaParaPrf` | (a) `_get` do cadastro inteiro | Migração manual de `squads/midia` e `squads_roles/midia` para `prf` no cadastro. | Só ADM pela guarda `_isAdmPainel()`. | Ambos os mapas existem no espelho. A rotina procura o estado da fonte e escreve só nela. Usar a cópia pode pular vínculos legados ou divergentes. |
| [painel-dev.html:11182](../../painel-dev.html#L11182) `_getUsuariosMap` | (a) `_get` via `_usuariosNode()` quando o cache não atende | Carga de membros e avatares de squad novo (`loadSquadData`), gestão dos papéis por squad (`loadPcfgUsers`), busca por e-mail para convidar (`addGuestByEmail`) e promoção/rebaixamento (`addAdmEmail`, `removeAdmEmail`). Atribui o resultado ao cache global, que tem os consumidores da linha seguinte. | Internos nos fluxos de configuração/novo squad, sem guarda de papel no helper. Promoção e rebaixamento têm guarda ADM. A escrita dos papéis segue as regras do banco. | Nome, foto, iniciais, e-mail, inscrição, `role`, `squads` e `squads_roles` têm escritores. Gestão precisa considerar cadastros sem cópia e usar a fonte para papéis e identidade quando a operação depende deles. |
| [painel-dev.html:11199](../../painel-dev.html#L11199) `loadGlobalUsers` | (a) `_get` via `_usuariosNode()` | Carga inicial, retorno à aba, abertura/refresh da gestão e releitura pós-escrita. Cache alimenta listas, avatares, resolução de papéis, destinatários de comunicados, totais, configuração de torre/diretoria/Gestor OKR e Central de Notificações. Nesta última, [L13526–L13545](../../painel-dev.html#L13526) usa `notif_prefs/dnd`, conta entradas com token em `fcm_tokens` e agrega `notificacoes` por tipo, data e leitura. | Qualquer conta interna admitida no Painel. Externo-viewer usa o diretório. A Central tem aba para internos e guarda ADM para ações de configuração. | Perfil, papéis, squads e diretoria têm espelho. Faltam `torre`, `gestorOkr` e dados de Central. A Central precisaria de fonte restrita com os indicadores que usa. |
| [okr-dev.html:2255](../../okr-dev.html#L2255) `loadGlobalUsers` | (a) `_get` via `_usuariosNode()` | Cache de responsáveis, participantes, menções, convites, avatares e nomes, papéis/squads para elegibilidade e `torre` e `gestorOkr` para escopo e controles do Radar. Recarrega no login, pós-cadastro, retorno à aba e renovação do cache. | Qualquer conta interna admitida no Radar. Externo-viewer usa o diretório. | Identidade, papéis, inscrição e squads têm espelho. Faltam `torre` e `gestorOkr`. O fluxo precisa preservar quem só tem cadastro básico no Radar ou Painel. |
| [kanban-dev.html:33041](../../kanban-dev.html#L33041) `createNotif` → `_criaSeAusente` | (b) `fbGet` de `{uid}/notificacoes/{id}` | Com ID determinístico, verifica existência antes do `set` para preservar o estado de leitura. Ramo usado se a função de transação estiver ausente. O módulo da página normalmente a instala. | Chamadores habilitados em cada fluxo do board, sem guarda de papel própria em `createNotif`. UID pode ser o próprio ou alheio. | Ausente. O dado necessário é existência do ID. |
| [kanban-dev.html:33045](../../kanban-dev.html#L33045) `createNotif` | (b) `_runTransaction` de `{uid}/notificacoes/{id}` | Com ID determinístico, lê o valor atual na transação e só cria na ausência, evitando que duas abas reabram um aviso lido. Em caso de recusa, o código só registra a falha. | Mesmos chamadores da linha anterior. Para outro UID, a transação depende das permissões de leitura **e** escrita. | Ausente. A decisão usa existência do ID. |
| [painel-dev.html:11538](../../painel-dev.html#L11538) `_guPreencherDigital` | (b) `_get` da raiz `{uid}` | Relê cada cadastro alvo para confirmar existência e diretoria ainda vazia antes do preenchimento em lote. | ADM com papel global no cadastro ou exceção do Caio. | Diretoria existe no espelho, mas a verificação requer a fonte atual e existência do cadastro. Espelho ausente ou desatualizado muda o resultado. |
| [painel-dev.html:11588](../../painel-dev.html#L11588) `_guCorrigirEspelho` | (b) `_get` de `{uid}/diretoria` | Relê a diretoria na fonte antes de reparar etiqueta divergente. A validação do espelho exige igualdade com a fonte. | ADM com papel global no cadastro ou exceção do Caio. | Diretoria existe no espelho. Este reparo depende do valor autoritativo. |
| [painel-dev.html:11606](../../painel-dev.html#L11606) `setGlobalUserDiretoria` | (b) `_get` da raiz `{uid}`, usa `.exists()` | Confere o cadastro antes de editar diretoria para evitar recriar um registro já excluído. | ADM com papel global no cadastro ou exceção do Caio. | O espelho pode existir sem o cadastro correspondente ou estar ausente. Sua existência não substitui a verificação da fonte. |

### Somente o próprio UID (c)

- **Maré** — cadastro/sincronização Auth ([L13631 e L13740](../../kanban-dev.html#L13631)), resolução de squad com preferências globais (L13184), onboarding (L13317), filtros, sugestões recusadas, temas (L17092, L17248, L17404), Spotify (L25000), preferências de board, atalhos, ordem da barra (L33270, L33378, L33404, L33539), preferências de notificação e token do aparelho (L33678, L33768), ouvinte com query do sino (ref L33877, leitura L33881) e indicador do Agente Ágil (L41760).
- **Painel** — acesso ao Agente (L3272) e criação/cura do cadastro (L10879). No sino, listener (ref L8251, leitura L8253), transações para marcar todas como lidas e limpar lidas (L8330, L8354). O pré-check de `_seedComunicadoRascunhos` (L8708) usa `window._currentUser.uid` do ADM que semeia os rascunhos.
- **Radar** — ouvinte com query do sino (L3747) e criação/cura do cadastro (ref L10525, leitura L10526).
- **Oceano** — `lerRamo(sub)` (L906) lê oito ramos próprios no login (L917): `nome`, `init`, `role`, `squads`, `apps`, `oceano`, `uid` e `squads_roles`. O helper `rd` também lê os links pessoais (L1297).
- **Travessia e Concha** — registro próprio na carga inicial (`G` em `travessia-dev.html:1136` e `get` em `cardume-dev.html:431`). Os diretórios de outras pessoas nessas páginas, na Escala (L431) e no Intake (L437) já são lidos de `usuarios_publicos`.
- **Módulos** — preferências de dicas (`mare-dicas-dev.js:220,236`, a segunda chamada recebe o usuário corrente do Painel); Gantt favorito e pré-check de pedido de atualização (`mare-gcal-dev.js:338,169`); torre, preferências de notificação, sino, links e apps (`mare-notif-dev.js:286,473,863,944,1069`). O pedido do Gantt tem ramo compartilhado que leria a notificação de terceiros fora de dev. Em [L91](../../mare-gcal-dev.js#L91) o sufixo vem do pathname e em [L160](../../mare-gcal-dev.js#L160) as páginas `-dev.html` restringem a leitura e a escrita ao solicitante.

**Escritas diretas em notificações de terceiros, sem leitura da notificação alvo** — `kanban-dev.html` 1 (L33047); `painel-dev.html` 2 (L9079, L11064); `okr-dev.html` 5 (L3234, L3928, L6288, L6546, L7945); `oceano-dev.html` 0; `escala-dev.html` 1 (L928); `intake-dev.html` 1 (L443); `travessia-dev.html` 1 (L922); `cardume-dev.html` 1 (L655, `update` multipath); `mare-plantao-dev.js` 1 (L437); demais módulos 0 em dev. São **13** pontos, sem multiplicar por destinatário. O Maré tem mais dois ramos de escrita condicionados à leitura em `createNotif` (L33042, L33045), já registrados na tabela.

## 3. O que mudaria para fechar

O [bloco `usuarios_publicos`](../../database.rules.json#L1393) hoje permite leitura a qualquer autenticado. A escrita é do próprio UID ou de conta Google Hering com papel global PO/ADM ou a exceção nominal do projeto. O ramo valida `diretoria` por igualdade com a fonte. Para os demais campos, a presença do espelho vem dos escritores do código. O Maré grava `nome`, `email`, `foto`, `init`, `role`, `inscrito`, `squads` e `squads_roles` ao [cadastrar ou entrar](../../kanban-dev.html#L13808) e grava `diretoria` em [update separado](../../kanban-dev.html#L13879). Também atualiza a cópia em alterações de perfil, iniciais e gestão de squad. O Painel espelha [papéis e vínculos por squad](../../painel-dev.html#L10528), [diretoria](../../painel-dev.html#L11570) e [alterações de gestão/exclusão](../../painel-dev.html#L11637). Promoção/rebaixamento via lista de ADMs do Painel e migração midia→prf têm escritas só na fonte. Painel, Radar e Oceano criam/corrigem cadastro básico próprio na fonte.

1. Considerar retirar a concessão ampla do pai, preservar a do próprio UID e reservar a leitura de cadastro de terceiros a rotinas administrativas justificadas. Se houver uma concessão ampla só para ADM, ela também alcançará as caixas e tokens de terceiros. Para manter a privacidade desses ramos inclusive frente a consultas administrativas de perfil, separar o índice de gestão dos dados pessoais ou servir uma projeção no servidor. Definir ADM com a mesma autoridade das regras e tratar explicitamente a diferença entre `adm_emails` da UI e papel global.
2. Mover a parte de diretório de Painel e Radar para `usuarios_publicos` com cobertura para quem só fez cadastro básico. Os escritores atuais desses cadastros (Painel, Radar e Oceano) ou uma sincronização no servidor teriam de manter os campos de identidade. Se o desenho decidir espelhar `torre`, os escritores atuais são a inscrição do Maré (L14071), a escolha no Radar (L7081) e o ADM pelo Painel (L11518). `gestorOkr` é gravado no Painel (L11620); para controles da própria pessoa, a fonte do próprio UID já é uma opção. Qualquer projeção nova exige decidir quem pode lê-la e preservar as validações de integridade. Papéis e e-mail do espelho atual são úteis para exibição, mas a escrita pelo próprio UID impede tratá-los como fonte de autorização ou prova de identidade.
3. Manter uma fonte autoritativa para migração, promoção/rebaixamento, gestão de papéis e reparo de diretoria. O Painel mistura esses fluxos com o cache de diretório. Uma projeção administrativa pode devolver apenas cadastro e papéis, com operação específica no servidor para editar/reparar quando precisar conferir existência e valor no momento da escrita. A Central de Notificações demanda desenho próprio: pode receber agregados por tipo/janela e, se necessário, indicadores restritos de push e de Não Perturbe. A tela usa a contagem de aparelhos, dispensando o token e o conteúdo das caixas.
4. Redesenhar a criação idempotente de `createNotif` antes do corte, por exemplo com uma operação no servidor que só cria IDs ausentes e mantém o estado de leitura. Isso também dá uma opção para o ramo de outros destinatários do Gantt fora das páginas dev. Escritas diretas de notificações com IDs novos podem continuar pelo fluxo de autorização de escrita existente, sujeito a testar cada fluxo após a mudança.

## 4. Dúvidas, limites e prova

- A revisão usou os arquivos locais, sem login, consultas a dados reais ou simulação das regras. Não confirma a versão implantada, a frequência de cada operação, quantos cadastros estão sem espelho nem o volume de divergências. A repetição de uma linha por UID, aba, retry ou ramo de configuração é possível.
- Vale confirmar com o dono do produto quem deve ver os indicadores por pessoa da Central, se a migração midia→prf ainda precisa ficar acessível e se o Radar precisa mostrar a torre alheia em todos os fluxos atuais. A tabela registra os acessos que a fonte permite identificar. A guarda de papel do fluxo e a autorização do Firebase podem divergir.
- A análise do cliente se limita às páginas e aos módulos dev listados. Arquivos de prod, outras páginas, apps nativos e chamadas do Admin SDK ficaram fora do inventário. O dado de Travessia citado no achado é alcançado pelos downloads do nó inteiro mesmo quando a tela só precisa de estatísticas.
- Além dos arquivos da tabela, foram consultados `database.rules.json`, `docs/quadro/escalados.md`, `docs/CODE_SYMBOLS.md`, `CODE_MAP_FAST.md` e os arquivos de contexto `CLAUDE.md`, `.claude/skills/seatualizar/SKILL.md`, `docs/QUADRO.md`, `docs/COORDENACAO_AGENTES.md`, `version.json`, `CHANGELOG.md` e `BUGS_E_CORRECOES.md`.

Comandos de busca executados, com a contagem literal por arquivo na tabela do resumo. As 202, 2 e 5 linhas das três buscas complementares se sobrepõem aos resultados anteriores ou incluem referências que não são leituras. O grep de regras retornou 58 linhas com referências ao cadastro.

```zsh
files=(kanban-dev.html painel-dev.html okr-dev.html oceano-dev.html escala-dev.html intake-dev.html travessia-dev.html cardume-dev.html mare-*-dev.js)
for f in $files; do
  grep -n 'kanban/usuarios' "$f"
  grep -c 'kanban/usuarios' "$f"
done
grep -nE 'kanban/usuarios([^_[:alnum:]]|$)|FB_USERS|_usuariosNode' $files | wc -l
grep -nE 'kanban\\/usuarios|child\([^)]*usuarios|FB_USERS' $files | wc -l
grep -nE "['\"]usuarios([/'\"]|$)|/usuarios/" $files | grep -v 'kanban/usuarios' | wc -l
grep -nE 'usuarios_publicos|"usuarios":' database.rules.json
grep -c "root.child('kanban/usuarios" database.rules.json
```

As buscas pelas funções, pelos aliases de referência e pelos chamadores foram cruzadas com os blocos de código. No Painel, `_GU_FIELD_RE` observa escritas e aciona `loadGlobalUsers`, cuja leitura já está na tabela. No Maré, `fbGet(path)` usa `fb(path)` e encaminha o caminho ao SDK sem trocar o prefixo. Os listeners de sino contam na linha de `onValue`, inclusive onde a referência e a query são montadas antes.
