# 🪟 Mini painel na bandeja do Windows

Um ícone perto do relógio com a cor do estado do ecossistema (🟢 tudo certo · 🟡 atenção · 🔴 fora do ar) e o nº de cards atrasados. Lê o mesmo JSON da página `minipainel.html` (função `oceanoResumo`) a cada minuto. Nada é instalado.

- **Passar o mouse:** resumo curto. **Clique:** VTEX, GitHub, Firebase, backup, alarmes de "card sumiu", plantão e os seus cards. **Duplo clique:** abre o mini painel no navegador.
- **Aviso (balão)** quando o estado **piora** (ex.: de OK para Fora do ar), com o motivo.
- **Iniciar com o Windows:** opção no próprio menu.

> ⚠️ **Escrito sem Windows.** Foi escrito numa sessão Linux: a leitura do JSON e os nomes dos campos são testados (`functions/oceano/__tests__/contrato_windows.test.js`), mas o ícone e o menu **nunca rodaram**. Se algo falhar, rode com `-Visivel` (abaixo) e cole a mensagem para o Claude.

## Rodar (no `cmd`, sem abrir o PowerShell)
Pré-requisitos: a função publicada e o arquivo **`%USERPROFILE%\chave-oceano.txt`** com a chave (o mesmo da página; ver `docs/MINIPAINEL.md`).

```
cd /d "C:\Users\caio.soares\.gemini\antigravity\scratch\hering"
windows\iniciar-oceano.cmd
```
Ou dê **duplo clique** em `windows\iniciar-oceano.cmd`. O arquivo chama o `powershell.exe` com `-NoProfile` (ignora o perfil do PowerShell, onde costumam estar os bugs) e escondido: você não precisa abrir o PowerShell nem colar nada.

O ícone pode ir para a **setinha ^** da bandeja; arraste-o para a barra para deixá-lo sempre à vista.

## Ver erros
```
windows\iniciar-oceano.cmd -Visivel
```
Mantém a janela aberta e escreve o erro, se houver.

## Parâmetros (opcionais)
`-ArquivoChave <caminho>` · `-Endereco <url da função>` · `-IntervaloSegundos 60` · `-Visivel`. Exemplo: `windows\iniciar-oceano.cmd -Endereco https://oceanoresumo-xxxx-uc.a.run.app`.

## Problemas comuns
| Sintoma | O que fazer |
|---|---|
| Nada acontece / o ícone não aparece | rode com `-Visivel`; confira a setinha ^ da bandeja; a política da empresa pode bloquear scripts (`-ExecutionPolicy Bypass` costuma passar, mas um bloqueio por GPO/AppLocker não) |
| Ícone cinza e "Sem chave" | falta o `chave-oceano.txt` em `%USERPROFILE%` (ou use `-ArquivoChave`) |
| "A função recusou a chave" | a chave do arquivo é diferente do secret `OCEANO_RESUMO_KEY` |
| "Sem conexão com a função" | rede/proxy bloqueando `cloudfunctions.net` (teste a URL no navegador) |
| Acentos estranhos nas mensagens | o `.ps1` precisa continuar salvo como **UTF-8 com BOM** (um teste confere isso) |
| Abrir duas vezes | não duplica: avisa que já está na bandeja |

## Segurança
A chave fica só no seu `chave-oceano.txt` (fora do repositório) e vai na consulta à função, como na página web. O script não grava nada além da entrada opcional de **Iniciar com o Windows** (`HKCU\...\Run`, valor `OceanoBandeja`).

## Se o PowerShell estiver bloqueado ou bugado
Use a **página como app**: no Edge, `⋯ → Aplicativos → Instalar este site como aplicativo` em `minipainel.html`, e fixe na barra de tarefas.
