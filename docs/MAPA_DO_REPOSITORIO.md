# 🗺️ Mapa do repositório — como as peças se encaixam

> **Para quem chega de fora** (TI, auditoria, uma pessoa nova): em 10 minutos dá para entender *o que existe*, *como as partes conversam* e *por onde começar*. A **Biblioteca** ([`docs/BIBLIOTECA.md`](BIBLIOTECA.md)) diz *onde mora cada arquivo*; este mapa mostra **as relações**. Detalhe técnico e de governança: [`ecossistema.html`](https://caiosoares1899.github.io/hering/ecossistema.html) (também o botão "Abrir o repositório" nele).
>
> Repositório: <https://github.com/caiosoares1899/hering> · Site publicado: <https://caiosoares1899.github.io/hering/>
>
> **Conserto automático:** as tabelas do bloco ["O que o código diz"](#o-que-o-código-diz-gerado-automaticamente) são geradas por `node scripts/mapa.js` e **conferidas pela CI** (`scripts/checar.js`) — não envelhecem. A tabela por pasta abaixo também é conferida (todo caminho citado tem que existir).

## 1. Em uma figura

```mermaid
flowchart TB
  P["👤 Pessoas do time\n(navegador / PWA no celular)"]
  subgraph Pages["📄 Páginas estáticas na raiz — GitHub Pages, sem build"]
    direction LR
    MARE["🐟 Maré Digital\nkanban.html"]
    PAINEL["🧭 Painel\npainel.html"]
    RADAR["📡 Radar (OKR)\nokr.html"]
    OCEANO["🌊 Oceano\noceano.html"]
    ESCALA["📅 Escala"]
    INTAKE["📥 Intake"]
    TRAV["⛵ Travessia\ntravessia.html"]
    MINI["🖥️ Mini painel\nminipainel.html + mac/ · windows/"]
  end
  MODS["🧩 Módulos compartilhados\nmare-notif · mare-dicas · mare-metas\nmare-login · mare-plantao\n+ firebase-messaging-sw.js"]
  subgraph FB["☁️ Firebase — projeto Google corporativo"]
    direction LR
    AUTH["Auth\n(Google, @ciahering)"]
    RTDB["Realtime Database\nkanban/…  + regras testadas"]
    FCM["Cloud Messaging\n(push)"]
    STG["Cloud Storage\n(backups, anexos)"]
  end
  CF["⚙️ Cloud Functions (Node 22)\nfunctions/ — deploy manual"]
  EXT["🌐 Serviços externos\nAPI da Anthropic (Agente Ágil:\nMaré, Radar e Painel)\nGoogle Calendar · Looker Studio\nstatus: VTEX · GitHub · Firebase"]

  P --> Pages
  Pages --> MODS
  Pages -->|"lê/grava ao vivo"| RTDB
  Pages -->|"login"| AUTH
  RTDB -->|"gatilho: nó novo"| CF
  CF -->|"escreve resultado, avisos"| RTDB
  CF -->|"push"| FCM
  CF --> STG
  CF --> EXT
  FCM -->|"service worker"| P
```

**Como ler:** as páginas são HTML puro (sem servidor de aplicação) e falam **direto com o Firebase** (o que cada pessoa pode ler/gravar é decidido pelas **regras do banco**, não pela tela). O que precisa rodar sem navegador aberto — push, backups, lembretes, o Agente Ágil, monitores de status — são **Cloud Functions**, disparadas por escritas no banco, por horário ou por HTTP.

## 2. O caminho de uma mudança (dev → prod)

```mermaid
flowchart LR
  A["Pedido / bug / ideia"] --> B["Branch\nclaude/… · antigravity/… · codex/…"]
  B --> C["Muda só o arquivo -dev\n(+ version.json, registro em\nCHANGELOG ou BUGS)"]
  C --> D["Pull Request\n+ CI: checar.js + testes de functions/"]
  D --> E{{"Merge humano\n(ninguém aprova o próprio PR)"}}
  E --> F["GitHub Pages publica\n*-dev.html"]
  F --> G["Validação explícita\nde quem pediu"]
  G --> H["/subirproprod\npromover.js: 12 pares"]
  H --> I["PR de promoção → merge\n→ prod + tag de release"]
  C -. "mudou functions/ ou regras?" .-> J["Deploy manual do Caio\nfirebase deploy --only …"]
```

Quem faz o quê (Claude como maestro, Antigravity e Codex), o quadro de "em andamento" e as regras de ouro: [`docs/COORDENACAO_AGENTES.md`](COORDENACAO_AGENTES.md), `CLAUDE.md` e `AGENTS.md`.

## 3. Por pasta (conferido pela CI: todo caminho existe)

<!-- mapa:caminhos:inicio -->
| Caminho | O que é |
|---|---|
| `kanban.html` · `kanban-dev.html` | 🐟 Maré Digital — o board das squads (prod · dev) |
| `painel.html` · `painel-dev.html` | 🧭 Painel de administração (diverge do dev de propósito) |
| `okr.html` · `okr-dev.html` | 📡 Radar (OKR) |
| `okr-apresentacao.slide.html` | 🎙️ Apresentação ao vivo do Radar (sem `-dev`) |
| `oceano.html` · `oceano-dev.html` | 🌊 Lobby da família: login único, Mural, Meta Global, sino |
| `travessia.html` · `travessia-dev.html` | ⛵ Travessia: Baú, faróis do 1:1, humor, avaliação |
| `minipainel.html` · `mac/` · `windows/` | 🖥️ Mini painel (página + apps da barra do Mac e da bandeja do Windows), lê `oceanoResumo` |
| `escala.html` · `intake.html` | 📅 Escala · 📥 Pedidos (cada um com `-dev`) |
| `ecossistema.html` · `maredigital.html` | Documentação técnica navegável (para a TI · funcional) |
| `mare-notif.js` | Sino único, menu de produtos, tipos de notificação (há um `-dev`) |
| `mare-dicas.js` · `mare-metas.js` · `mare-login.js` · `mare-plantao.js` | Dicas · metas · login Google direto · plantão de bugs (todos com `-dev`) |
| `firebase-messaging-sw.js` | Service Worker (cache + push) — fica na raiz do domínio |
| `version.json` | Versão de cada página (auto-atualização) |
| `functions/` | ⚙️ Cloud Functions + testes (o único projeto Node) |
| `functions/agente-agil-orquestrador/` | O Agente Ágil (Claude) e seu conhecimento gerado |
| `functions/agente-agil-orquestrador/painel/` | 🤖 Agente Ágil no Painel: chat privado, só leitura, ferramentas que espelham as abas |
| `functions/cards/` | 🛡️ Guardião dos cards (espelho, restauração, pulso de saúde) |
| `functions/oceano/` | Resumo do ecossistema para o Mini painel (`oceanoResumo`) |
| `functions/plantao/` | Plantão de bugs — **desligado desde 02/11/2026** (exports comentados; código e testes guardados) |
| `functions/rules/` | Testes das regras do banco |
| `database.rules.json` | Regras de segurança do Realtime Database |
| `storage.rules` | Regras do Cloud Storage |
| `scripts/` | `checar.js` (CI), `mare-cli.js` (versão/log/mapa), `mapa.js` (este mapa), `delegar.sh` (o maestro entrega um contrato ao Codex) |
| `docs/` | Documentação de apoio — ver a Biblioteca |
| `docs/arezzo/testes/` | Testes de navegador (Playwright + Firebase falso) |
| `.claude/skills/` | Skills dos agentes (promoção, auditorias, documentação…) |
| `.agents/` | Regras do Antigravity |
| `AGENTS.md` | Ponto de entrada do Codex e do Antigravity |
| `.github/workflows/` | CI (`checks.yml`) e publicação (`pages.yml`) |
| `vendor/firebase-10.14.1/` | SDK do Firebase servido localmente (firewall corporativo) |
<!-- mapa:caminhos:fim -->

## 4. Como os dados fluem (exemplos reais)

- **Uma notificação vira push:** a página grava em `kanban/usuarios/{uid}/notificacoes/{id}` → a função `sendPushOnNotification` confere o tipo (`PUSH_TYPES`), o interruptor do tipo (🔔 Painel) e o Não Perturbe → manda pelo FCM → o service worker mostra no celular.
- **Um card que some volta sozinho:** cada card gravado é espelhado por `cardsEspelhar` em `kanban/cards_espelho/{squad}/{id}` (nó só do servidor) → se o card desaparece sem ninguém excluir, `cardsGuardiao` restaura do espelho em segundos e registra o episódio em `kanban/cards_guardiao/{squad}/incidentes` (sino + push aos ADMs/POs) → o ADM vê em Painel › Status › Saúde dos cards e marca como resolvido; `guardiaoStatus` grava um pulso a cada 5 min.
- **O Painel responde uma pergunta:** a pessoa escreve na gaveta 🤖 → mensagem em `kanban/agente_painel_dev/{uid}/{id}` (só o dono lê/grava) → `agenteAgilPainelChatDev` confere interruptor, acesso e cota, lê os mesmos dados das abas e grava a resposta em `{id}_r` com fonte, hora e o que não bateu.
- **Um bug vira correção (plantão, desligado desde 02–03/11/2026):** era ficha em `kanban/plantao/{id}` → PR de dev pelo Antigravity → validação do ADM; o código está guardado em `functions/plantao/`.
- **O Agente Ágil responde:** @menção num card → função do orquestrador → ferramentas do board (ler, mover, comentar…) + biblioteca de ajuda gerada do código → a resposta volta como comentário no card.
- **Um backup existe:** funções agendadas copiam o banco (completo semanal + global diário) para o Cloud Storage privado; um vigia avisa os ADMs se falhar.

## O que o código diz (gerado automaticamente)

> Não edite à mão: `node scripts/mapa.js` reescreve este bloco; a CI reprova se estiver velho.

<!-- mapa:auto:inicio -->
### Páginas × módulos compartilhados (lido do HTML)

| Produto | Prod (versão) | Dev (versão) | Módulos que a página carrega (`?v=` no dev) |
|---|---|---|---|
| Maré Digital | `kanban.html` v8.30.973 | `kanban-dev.html` v8.30.980-dev | `mare-login` v3 · `mare-notif` v43 · `mare-metas` v19 · `mare-dicas` v17 · `mare-sonar` v8 · `mare-timer` v1 · `mare-gcal` v7 · `mare-ferias` v1 ⚠️ prod difere |
| Painel | `painel.html` v5.113 · painel | `painel-dev.html` v5.115 · painel-dev | `mare-notif` v43 · `mare-metas` v19 · `mare-plantao` v5 · `mare-dicas` v17 · `mare-gxl` v2 |
| Radar | `okr.html` v2.121 · okr | `okr-dev.html` v2.128 · okr-dev | `mare-notif` v43 · `mare-dicas` v17 · `mare-sonar` v8 |
| Oceano | `oceano.html` v1.82 · oceano | `oceano-dev.html` v1.85 · oceano-dev | `mare-login` v3 · `mare-notif` v43 · `mare-plantao` v5 · `mare-dicas` v17 · `mare-metas` v19 · `mare-sonar` v8 |
| Escala | `escala.html` v1.11 · escala | `escala-dev.html` v1.11 · escala-dev | `mare-login` v3 |
| Intake | `intake.html` — | `intake-dev.html` — | `mare-login` v3 |
| Travessia | `travessia.html` — | `travessia-dev.html` — | `mare-login` v3 |

Sem módulos compartilhados: `okr-apresentacao.slide.html`, `onboarding.html` (e as páginas avulsas — ver a Biblioteca).

### Cloud Functions por pasta (41 exports em `functions/index.js`)

| Pasta (`functions/…`) | Exports |
|---|---|
| `agente-agil-orquestrador/` | `agenteAgilMencao` · `agenteAgilMencaoDados` · `agenteAgilDueOverdueScan` · `agenteAgilResumoMeuDia` · `agenteAgilIntake` · `agenteAgilAnaliseDados` · `agenteAgilAnalisePO` · `agenteAgilPainelChat` · `agenteAgilPainelChatDev` |
| `spotify/` | `spotifyOauthCallback` · `spotifyDisconnect` · `spotifySyncNow` · `spotifyPlayback` · `spotifyRadioOwnerCallback` · `spotifyRadioSearch` · `spotifyRadioSuggest` |
| `backup/` | `weeklyBackup` · `backupCompletoSemanal` · `backupGlobalDiario` · `backupVigia` · `backupCompletoApi` |
| `cards/` | `cardsEspelhar` · `cardsGuardiao` · `cardsEspelhoVarredura` · `guardiaoStatus` |
| `okr/` | `sendPushOnMural` · `okrDailyScan` · `okrWeeklySnapshot` · `okrAgenteChat` |
| `gantt/` | `ganttAvisoMudanca` · `ganttAvisoMudancaDev` |
| `agente-agil/` | `agenteAgil` |
| `comentarios/` | `contarComentarios` |
| `firebase/` | `firebaseStatus` |
| `github/` | `githubStatus` |
| `index.js (definidas no próprio arquivo)` | `sendPushOnNotification` |
| `intake/` | `intakeSubmit` |
| `metas/` | `metasLembretes` |
| `oceano/` | `oceanoResumo` |
| `timers/` | `timersVigia` |
| `vtex/` | `vtexStatus` |

### Nós de primeiro nível em `kanban/` nas regras do banco (59)

`campanhas` · `campanhas_log` · `gantt_marcos_globais` · `gantt_marcos_globais_dev` · `calendarios_gantt` · `calendarios_gantt_dev` · `gantt_destaques` · `gantt_destaques_dev` · `calendarios_gantt_hist` · `calendarios_gantt_snap` · `calendarios_gantt_hist_dev` · `ferias` · `ferias_dev` · `gantt_inscritos` · `gantt_inscritos_dev` · `calendarios_gantt_snap_dev` · `campanhas_log_dev` · `dados_diarios` · `dados_diarios_dev` · `comunicados` · `feedback` · `squads_meta` · `squads` · `metas_digital` · `metas_squads` · `metas_log` · `metas_digital_dev` · `metas_squads_dev` · `metas_log_dev` · `escala` · `painel` · `okr` · `travessia` · `plantao_status` · `plantao` · `timers_ativos` · `agente_painel` · `agente_painel_dev` · `agente_painel_processed` · `agente_painel_processed_dev` · `agente_painel_uso` · `agente_painel_uso_dev` · `cards_guardiao` · `notif_feed` · `notif_feed_seen` · `vtex_saude` · `github_saude` · `firebase_saude` · `notif_config` · `painel_viewers` · `config` · `spotify_secrets` · `spotify_radio_owner_secret` · `oauth_pending` · `usuarios` · `usuarios_publicos` · `init_registry` · `presence` · `global`

_Nó novo no banco = regra nova em `database.rules.json` (+ teste em `functions/rules/__tests__/`) e, se for dado que importa, entrada em `NOS_GLOBAIS` de `functions/backup/completo.js`._
<!-- mapa:auto:fim -->

## 5. Por onde começar

| Quero… | Comece por |
|---|---|
| Entender o que existe e por quê | este mapa → `ecossistema.html` |
| Achar um arquivo | [`BIBLIOTECA.md`](BIBLIOTECA.md) |
| Mexer numa tela | `CODE_MAP_FAST.md` (linha de cada função) → `kanban-dev.html`/… |
| Entender as regras do jogo | `CLAUDE.md` → `docs/COORDENACAO_AGENTES.md` |
| Rodar as checagens | `node scripts/checar.js` e `cd functions && npm test` |
| Ver a segurança | `database.rules.json` + `functions/rules/__tests__/` |
