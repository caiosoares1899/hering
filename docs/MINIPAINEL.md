# 🌊 Mini painel (minipainel.html + oceanoResumo)

Miniatura do Painel para o Caio **bater o olho**: VTEX, GitHub, Firebase, backup, plantão de bugs, alarmes de "card sumiu" e os cards dele (atrasados, vencem hoje, bloqueados).
Criado em 30/10/2026. É a base para o item da barra de menu e o widget do Mac (que lerão o mesmo JSON).

## Peças
| Peça | Onde | O que faz |
|---|---|---|
| `oceanoResumo` | `functions/oceano/resumo.js` | Função HTTP (GET com chave) que devolve UM JSON pequeno. Reaproveita o que já existe: nós `vtex_saude`/`github_saude`/`firebase_saude` (aba 🔋 Status do Painel), o vigia de backup (`backup/vigia.js`), as fichas do plantão e os sinais de card de `resumoMeuDia.js` (sem IA). |
| `minipainel.html` | raiz | Página estática (sem login, sem Firebase): lê o JSON a cada minuto e mostra 🟢🟡🔴 com texto. `?demo=1` mostra dados de exemplo sem chave. |
| índice por responsável | `database.rules.json` (`dados/cards/.indexOn: ["owner"]`) | Faz a consulta "meus cards" trazer só o resultado. **Sem o índice o Firebase baixa o nó inteiro de cada squad a cada consulta.** |

## Deploy (só o Caio; nesta ordem)
```
cd /d "C:\Users\caio.soares\.gemini\antigravity\scratch\hering"
git fetch origin main
git reset --hard origin/main
firebase deploy --only database
firebase functions:secrets:set OCEANO_RESUMO_KEY        (valor: texto aleatório longo)
firebase deploy --only functions:oceanoResumo
```
O deploy imprime a **Function URL**. A página usa `https://us-central1-hering-onboarding.cloudfunctions.net/oceanoResumo`; se a sua for outra (`…run.app`), cole em ⚙ na página.
Depois abra `https://caiosoares1899.github.io/hering/minipainel.html`, cole a chave e pronto.

## Segurança e limites
- A chave vai na URL (é o que um GET permite) e abre **só o resumo do dono** (`DONO_EMAIL` no código), com títulos de card (≤ 80 caracteres), prazos e contagens — nunca descrição, comentários ou dados de outra pessoa.
- Vazou? `firebase functions:secrets:set OCEANO_RESUMO_KEY` com um valor novo + `firebase deploy --only functions:oceanoResumo` + colar a chave nova na página.
- Teto de 600 consultas/hora (`kanban/_oceano_resumo_rate`, só a função escreve). Cache em memória: 60 s o todo, 5 min os cards, 15 min o backup.
- Os cards são os de que o dono é **responsável** (participante não entra: o Firebase não consegue consultar array), ativos, fora das colunas de fim, nos squads em que ele é membro.
- A chave fica no `localStorage` do navegador onde você colou. Em computador compartilhado, use ⚙ → trocar a chave ao sair.

## App do Mac (barra de menu + widget)
Em `mac/` (Swift/SwiftUI, projeto gerado por XcodeGen): lê o mesmo JSON. Escrito sem Xcode; **compilado e rodando no Mac do Caio desde 31/10/2026** (barra de menu + widget, instalado em *Aplicativos*) — passo a passo (inclusive para quem nunca usou o Terminal) e problemas comuns em `mac/README.md`. O teste `functions/oceano/__tests__/contrato_mac.test.js` garante que os campos que o Swift espera existem no JSON da função.

## Ícone na bandeja do Windows
Em `windows/` (`iniciar-oceano.cmd` → `oceano-bandeja.ps1`): mesma ideia da barra de menu do Mac, com aviso (balão) quando o estado piora. **Clicar no ícone abre uma janela nativa do Windows** (desenhada pelo próprio script, sem navegador e sem a página web), com o mesmo resumo. Roda pelo `cmd` com `-NoProfile`. Escrito sem Windows; o teste `functions/oceano/__tests__/contrato_windows.test.js` confere os campos lidos, o BOM UTF-8 do `.ps1` e o lançador. Passo a passo em `windows/README.md`.

## Testes
`cd functions && node --test oceano/__tests__/*.test.js` (16: função + contrato com o app do Mac e com o ícone do Windows) · `node docs/arezzo/testes/test_minipainel.js` (navegador, 3 temas × 2 tamanhos, XSS, chave errada, função fora do ar).
