# Quadro: detalhe do Backlog

> Texto completo de cada item do Backlog do [`QUADRO.md`](../QUADRO.md), movido sem edição de `docs/COORDENACAO_AGENTES.md` em 11/11/2026. No Quadro fica uma linha curta com o link para cá.

| Ideia | Dono | Onde está o desenho |
|---|---|---|

<a id="vidro-lapidado"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 🪟 **Acabamento "vidro lapidado"** (`--specular` por tema + curvas `--ease-*`, GUIA_UI_UX 2.4 e 2.5 regra 6): contrato pronto para o Antigravity (10/11/2026); depois, **diagrama `.arq` interativo + rodapé/mapa** nas abas institucionais do Oceano, junto com o O4 da consultoria | Antigravity (acabamento) · Claude (diagrama/rodapé, com o O4) | `docs/GUIA_UI_UX.md` §2.4, §2.5 e §6.2 |

<a id="ilha-dinamica"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 🏝️ **Ilha Dinâmica**: fase 0 (protótipo) e 1a (`mare-timer`) entregues; **1º teste real no Maré dev** (10/11/2026, aguardando o Caio testar); depois Oceano (lobby + host) | Claude | `docs/ideias/ilha-dinamica.md` · `docs/demo/ilha-dinamica-prototipo.html` |

| 📅 **Ilha · notificações do calendário à parte** (ideia do Caio, 13/11/2026): dentro da Ilha, os avisos de calendário (reunião, evento, prazo do Radar, 🔔 Gantt, 📣 Pedir atualização) ganham o próprio grupo, separados das outras notificações, como já é feito com os alertas de sistemas e o Guardião | Claude | a desenhar: quais tipos entram (`reuniao`, `okr_reuniao`, `okr_evento`, `gantt_cal`, `gantt_pedido`…), ordem do grupo e se o sino também separa |
| 🎨 **Tipos de notificação mais distintos** (ideia do Caio, 13/11/2026): diferenciar visualmente cada tipo além do emoji no começo da mensagem — ex.: faixa/cor lateral por família (pessoal, calendário, Radar, sistema), ícone em selo, rótulo curto do tipo | Claude | a desenhar com o `docs/GUIA_UI_UX.md` (Marine Glass, 3 temas; cor nunca como único sinal); vale para a Ilha e o sino (`mare-notif-dev.js`) |

<a id="consultoria"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 🧭 **Plano da consultoria** (Radar, Travessia e lobby em sprints): **guardado em 10/11/2026** a pedido do Caio. Feito: E1–E3, período padronizado (R0) e o Sonar (que substituiu o O2). Próximo, quando voltar: T4 (cartão "próxima ação" da Travessia); em aberto a pergunta do T8 (aba fechada nos 8 s) | Claude | `docs/ideias/consultoria-oceano-2026-11-09.md` · `docs/ideias/cronograma-oceano.html` |

<a id="camiseta-black-friday"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 👕 Camiseta Brasil que "ganha forma" conforme a meta da Black Friday (Oceano, enchimento + peças nos marcos de 20 %, modo telão) | Claude | `docs/ideias/camiseta-brasil-black-friday.md` — depende da arte oficial; Black Friday = 27/11 |

<a id="dossie-concorrencia"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 🔬 Dossiê de concorrência do Antigravity (34 ideias): triagem em 4 levas — Radar (🧊 deriva, notas→Próximo Passo), Escala→Kanban, Digest do Painel, fluxo do Maré; Meus Pedidos e sino com adiar ficam com o Claude | Caio escolhe a ordem; Claude/Antigravity conforme a triagem | `docs/ideias/dossie-concorrencia-2026-10.md` — **nada roda antes de 04/11** |

<a id="tema-claro-painel-radar"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 🎨 Tema claro do Painel e do Radar (toast invisível, abas/botões com cor fixa, aba ativa, dia de hoje do calendário) — combinado para 18/10, **sem PR que prove que foi feito** | Claude (ou Antigravity: 1 página por vez) | `docs/ideias/tema-claro-painel-radar-2026-10-17.md` · `docs/arezzo/testes/auditoria_temas.js` |

<a id="ferramentas-teste-visual"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 🧪 Ferramentas de teste visual: `perf_apresentacao.js` com `CENARIO=` (medir só um cenário; hoje cada rodada mede 5) e variantes em paralelo; caminho do Chrome de `~/hering-tools` como padrão nas suítes da apresentação (as antigas têm caminho de Linux fixo); **contact sheet** 3×2 (3 temas × desktop/celular numa imagem só) no harness do GUIA §12.3 | Claude | sessão de 09/11/2026 (rodada de movimento da apresentação levou ~30 min, 2/3 em medição) |

<a id="video-release"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 🎬 Gerador de vídeo/GIF de release em Marine Glass: um HTML local em `scripts/` com `window.seek(t)` (cada quadro é função do tempo) + JSON `{titulo, entregas, metricas}` + Playwright/FFmpeg → 9:16 (WhatsApp) e 16:9 (Mural/OKR). Fora das páginas publicadas. **Sem Remotion:** a licença gratuita é só para indivíduos e equipes de até 3 pessoas, então empresa precisa de licença paga; o `seek(t)` próprio + Playwright + FFmpeg basta. Números e entregas vêm do `CHANGELOG.md`/dados, nunca inventados, e passam por validação antes de renderizar. Revisão por contact sheet antes de enviar | Caio decide se vale | dossiê do Antigravity de 09/11 + artigo de @e1genqq lido na íntegra |

<a id="firebase-functions-v6"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 🔧 Atualizar `firebase-functions` (^5 → atual): o deploy de 18/10 avisou que a versão nova traz breaking changes — fazer com calma e com testes, sem prazo | Claude | aviso do `firebase deploy` de 18/10/2026 |

<a id="nota-codex-radar-uiux"></a>

> Rodada `codex/radar-uiux` (09/11) encerrada em 10/11: o Codex parou sem entregar (sem navegador nem git no sandbox, ~86 mil tokens; log em `~/hering-logs/delegacoes/2026-11-09-codex-radar-uiux.*`). O `prefers-reduced-motion` do Radar (linha abaixo) entra nos itens do Radar do plano da consultoria. Lição: não delegar ao Codex o que precisa de navegador.

<a id="minhas-preferencias-areas"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 🧩 **Minhas Preferências com áreas separadas** (ideia do Caio, 13/11/2026): marcar a passagem de uma área para outra no painel 👤 Minhas Preferências, no nosso estilo — clarear um pouco o fundo de cada bloco (vidro mais claro), para ficar claro onde uma área termina e a outra começa | Claude | a desenhar com o `docs/GUIA_UI_UX.md`; conferir os 3 temas e 390 px |

