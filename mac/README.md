# 🍎 Mini painel para Mac (barra de menu + widget)

App nativo pequeno que lê o mesmo JSON da página `minipainel.html` (função `oceanoResumo`) e mostra:
- **Barra de menu:** uma bolinha 🟢🟡🔴 (com o nº de cards atrasados, se houver). Ao clicar: VTEX, GitHub, Firebase, backup, alarmes de "card sumiu", plantão e os seus cards.
- **Widget de mesa** (pequeno e médio) com o mesmo resumo.

> ⚠️ **Escrito sem Xcode.** Este código foi escrito numa sessão Linux, sem compilador de Swift: **nunca foi compilado nem executado**. O contrato com a função (nomes dos campos) é conferido por teste (`functions/oceano/__tests__/contrato_mac.test.js`), mas a primeira compilação é sua. Se o Xcode reclamar de alguma linha, cole o erro para o Claude (com o Claude Code aberto neste repositório, no próprio Mac) que ele corrige.

## O que você precisa (uma vez)
1. **macOS 14 (Sonoma) ou mais novo** e **Xcode** (App Store). Abra o Xcode uma vez para aceitar a licença.
2. **XcodeGen** (gera o projeto a partir de `project.yml`, sem montar nada à mão): `brew install xcodegen`.
3. Uma **conta Apple** (a gratuita basta) logada em Xcode ▸ Settings ▸ Accounts.
4. A **chave** do mini painel (o conteúdo do `chave-oceano.txt`) e a função já publicada (`docs/MINIPAINEL.md`).

## Montar
```bash
cd mac
cp Local.xcconfig.exemplo Local.xcconfig     # abra e preencha OCEANO_CHAVE (e OCEANO_TEAM, se souber)
xcodegen generate                            # cria OceanoBar.xcodeproj
open OceanoBar.xcodeproj
```
No Xcode: escolha o esquema **OceanoBar** e o destino **My Mac**; em *Signing & Capabilities* de **cada** alvo (OceanoBar e OceanoWidget) escolha o seu *Team* (o pessoal serve); aperte **▶ Run**.
A bolinha aparece na barra de menu. Clique nela.

## Deixar instalado (sem o Xcode aberto)
Menu *Product ▸ Archive* → *Distribute App ▸ Copy App*, ou: `xcodebuild -project OceanoBar.xcodeproj -scheme OceanoBar -configuration Release build` e copie o `OceanoBar.app` (em `~/Library/Developer/Xcode/DerivedData/…/Build/Products/Release/`) para `/Applications`. Abra uma vez e marque **Abrir ao iniciar sessão** no menu do app.

## Widget
Com o app aberto pelo menos uma vez: clique com o botão direito na mesa ▸ *Editar Widgets…* ▸ procure **Oceano**. Se não aparecer, saia e abra o app de novo (o macOS só descobre o widget depois que o app foi assinado e aberto) e confira se os **dois alvos** têm o mesmo Team. O macOS decide quando atualizar o widget (algumas vezes por hora); o app da barra de menu atualiza a cada minuto.

## Segurança
- A chave vai para o `Info.plist` do **seu** app (gerado a partir de `Local.xcconfig`, que está no `.gitignore`). Ela não entra no Git. **Não distribua o `.app`** para outras pessoas: ele leva a sua chave.
- O app é *sandboxed* e só pede a permissão de rede de saída (`com.apple.security.network.client`).
- Vazou ou quer trocar? `docs/MINIPAINEL.md` (troca do secret) e depois repita *Montar* com a chave nova.

## Problemas comuns
| Sintoma | Causa provável |
|---|---|
| ⚪️ na barra e "Sem chave" | `OCEANO_CHAVE` vazio em `Local.xcconfig`; rode `xcodegen generate` de novo |
| "A função recusou a chave" | chave diferente do secret `OCEANO_RESUMO_KEY` |
| "Sem conexão com a função" | rede/VPN bloqueando `cloudfunctions.net`; teste a URL no navegador (`docs/MINIPAINEL.md`) |
| "A função respondeu com erro (HTTP 5xx)" | função não publicada, ou índice `owner` das regras ainda não implantado |
| Erro de assinatura | falta escolher o Team nos **dois** alvos |

## Estrutura
| Pasta | O que tem |
|---|---|
| `Shared/` | `Resumo.swift` (o JSON), `Cliente.swift` (a consulta), `Config.swift` (chave/host do Info.plist), `Apresentacao.swift` (cores, textos) — compilado nos dois alvos |
| `App/` | `OceanoBarApp.swift` (barra de menu), `Modelo.swift` (atualiza a cada minuto), `MenuView.swift` (a janela) |
| `Widget/` | `OceanoWidget.swift` (widget pequeno e médio) |
| `project.yml` | descrição do projeto (XcodeGen) |
| `Local.xcconfig.exemplo` | modelo do arquivo com a chave (o real fica fora do Git) |

Próximos passos possíveis (não feitos): notificação do macOS quando o estado piorar, widget grande, e trocar a chave por login Google em vez de `Local.xcconfig`.
