# 🌊 Oceano — a família de produtos (decisão de 2026-10-09)

O que antes era tudo "Maré Digital" passa a ser uma **família**, chamada **Oceano**. Só **nomes** mudam; arquivos, URLs, caminhos do banco (`kanban/...`, `kanban/okr/...`) e ids de código **não mudam**.

| Produto | O que é | Página / arquivo | Situação |
|---|---|---|---|
| **Maré Digital** | o kanban (gestão dos squads) | `kanban.html` | mantém o nome |
| **Painel** | gestão/diretoria, pessoas, comunicados | `painel.html` | mantém o nome (a ideia "Passadiço" foi descartada) |
| **Radar** 📡 | o OKR (Objetivos e Resultados-Chave) | `okr.html` | renomeado (fase 1 em dev) |
| **A Bordo** | onboarding | `onboarding.html` | a renomear (não mexido ainda) |
| **Travessia** | ciclo de performance/gente (avaliação, PDI, dia a dia, usa métricas do Radar e da Maré) | — | projeto futuro |

## Regras do que renomear (e do que NÃO)
- **Renomeia** onde "OKR" é o **nome da página/produto**: título da aba do navegador, cabeçalho, "Ajuda do Radar", "Mural do Radar", "Notificações do Radar", "Online no Radar", "Guia do Radar", links/abas nas outras páginas, textos de ajuda/inscrição, notificação "te mencionou nas anotações do Radar".
- **Mantém "OKR"** onde é a **metodologia, um papel ou um selo**: "🎯 Gestor OKR" (papel; mudar mexe no banco e no Global Users), o selo **OKR dos cards** do kanban ("Marcar como OKR", `isOKR`), "OKRs" no plural, eventos "Check-in OKR — Bloco 1/2" (dado já gravado).
- O texto de ajuda do Radar explica: "Radar é o nome do OKR dentro do Oceano".

## Fases
1. **Nomes visíveis** (em andamento): okr-dev v2.46, painel-dev v5.23, kanban-dev v8.30.804-dev.
   Ficam pra juntar na **promoção pra prod**, porque são compartilhados ou rodam fora das páginas: `guia-okr.html` (+ prints), `okr-apresentacao.slide.html`, `maredigital.html`, e os textos das **Cloud Functions** (prompt do Agente Ágil do OKR, push/notificações `okr_*`; exigem deploy).
2. **Menu entre produtos do Oceano** (hoje o menu de páginas já existe no cabeçalho do painel e lista "Radar").
3. **URLs/arquivos** só no fim, se valer a pena, com redirecionamento.

## Cuidados
- Travessia lida com dado sensível (avaliação/PDI): regras de acesso próprias, num trecho separado do banco, desenhadas antes do código.
