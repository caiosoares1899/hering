# 🍎 Mini painel para Mac (barra de menu + widget)

App nativo pequeno que lê o mesmo JSON da página `minipainel.html` (função `oceanoResumo`) e mostra:
- **Barra de menu:** uma bolinha 🟢🟡🔴 (com o nº de cards atrasados, se houver). Ao clicar: VTEX, GitHub, Firebase, backup, alarmes de "card sumiu", plantão e os seus cards.
- **Widget de mesa** (pequeno e médio) com o mesmo resumo.

> ✅ **Compilado e rodando** no MacBook do Caio em 31/10/2026 (Xcode 27.2). Foi escrito numa sessão Linux, sem Swift; o 1º build apontou **um** erro (o id do widget não começava com o id do app — corrigido em `project.yml`) e depois passou. O contrato com a função (nomes dos campos) é conferido por teste (`functions/oceano/__tests__/contrato_mac.test.js`). Se o Xcode reclamar de alguma linha numa versão futura, cole o erro para o Claude (com o Claude Code aberto neste repositório, no próprio Mac).

## O que você precisa (uma vez)
1. **macOS 14 (Sonoma) ou mais novo** e **Xcode** (App Store). Abra o Xcode uma vez para aceitar a licença.
2. **XcodeGen** (gera o projeto a partir de `project.yml`, sem montar nada à mão): `brew install xcodegen`.
3. Uma **conta Apple** (a gratuita basta) logada em Xcode ▸ Settings ▸ Accounts.
4. A **chave** do mini painel (o conteúdo do `chave-oceano.txt`) e a função já publicada (`docs/MINIPAINEL.md`).

## Primeira vez no Mac, sem nunca ter usado o Terminal
Roteiro que funcionou (31/10/2026). Terminal = ⌘+Espaço, digite *Terminal*, Enter; cole **um bloco por vez** e espere voltar a linha com `%`.
1. **Homebrew** (se `brew --version` disser `command not found`): `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`. Pede a senha do Mac (ao digitar não aparece nada, é normal) e Enter; no fim mostra *Next steps* — cole essas 2–3 linhas, uma por vez.
2. `brew install xcodegen`
3. `git clone https://github.com/caiosoares1899/hering` (aceite instalar as *Command Line Tools* se o Mac pedir) e `cd hering/mac`
4. `cp Local.xcconfig.exemplo Local.xcconfig` e `open -e Local.xcconfig`: troque `cole-a-chave-aqui` pela chave (do `chave-oceano.txt` do Windows, levada por um canal só seu — **nunca** no chat nem no Git) e salve (⌘+S).
5. `xcodegen generate` e `open OceanoBar.xcodeproj`; Team nos dois alvos; ⌘+R (detalhes abaixo).
6. Para **atualizar** depois: `cd ~/hering/mac && git pull && xcodegen generate` (o `Local.xcconfig` não é apagado: está no `.gitignore`) e ⌘+R de novo.

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
**Não marque *Abrir ao iniciar sessão* enquanto o app roda pelo Xcode**: o macOS guarda o caminho da cópia de desenvolvimento (DerivedData), que pode mudar. Primeiro instale em *Aplicativos*, abra de lá e só então marque.
O menu **Product** fica na barra de menu **do Mac** (topo da tela), não dentro da janela do Xcode (se o Xcode estiver em tela cheia, leve o mouse à borda de cima). Pare o app (■) antes.
Menu *Product ▸ Archive* → *Distribute App ▸ Copy App* (não use App Store/Notarization: exigem conta paga) → salve → arraste o `OceanoBar.app` para *Aplicativos*. **Atalho sem Organizer:** `find ~/Library/Developer/Xcode/DerivedData -name "OceanoBar.app" -path "*Debug*" -maxdepth 6` e `open -R "<caminho>"` mostram no Finder o app já compilado. Se o Mac bloquear a abertura: *Ajustes do Sistema ▸ Privacidade e Segurança ▸ Abrir Mesmo Assim* (o app é seu, gerado no seu Mac). Pela linha de comando: `xcodebuild -project OceanoBar.xcodeproj -scheme OceanoBar -configuration Release build` e copie o `OceanoBar.app` (em `~/Library/Developer/Xcode/DerivedData/…/Build/Products/Release/`) para `/Applications`. Abra uma vez e marque **Abrir ao iniciar sessão** no menu do app.

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
| *Embedded binary's bundle identifier is not prefixed with the parent app's bundle identifier* | o id do widget precisa começar com o do app (`br.com.hering.oceano.OceanoBar.Widget`, já em `project.yml`; rode `git pull` e `xcodegen generate`) |
| Widget não aparece em *Editar Widgets…* | abra o app uma vez a partir de *Aplicativos* e confira o mesmo Team nos dois alvos |
| Dois ícones/cópias do app | uma cópia ainda roda pelo Xcode: *Sair* nela e deixe só a de *Aplicativos* (confira no Monitor de Atividade) |

## Estrutura
| Pasta | O que tem |
|---|---|
| `Shared/` | `Resumo.swift` (o JSON), `Cliente.swift` (a consulta), `Config.swift` (chave/host do Info.plist), `Apresentacao.swift` (cores, textos) — compilado nos dois alvos |
| `App/` | `OceanoBarApp.swift` (barra de menu), `Modelo.swift` (atualiza a cada minuto), `MenuView.swift` (a janela) |
| `Widget/` | `OceanoWidget.swift` (widget pequeno e médio) |
| `project.yml` | descrição do projeto (XcodeGen) |
| `Local.xcconfig.exemplo` | modelo do arquivo com a chave (o real fica fora do Git) |

Próximos passos possíveis (não feitos): notificação do macOS quando o estado piorar, widget grande, e trocar a chave por login Google em vez de `Local.xcconfig`.
