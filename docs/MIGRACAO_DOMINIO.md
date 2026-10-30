# Migração de domínio — o que depende do endereço atual

> **Para quê:** a internalização do Oceano foi aprovada (30/10/2026) e o endereço deve mudar de
> `https://caiosoares1899.github.io/hering/…` para algo como `oceano.hering…`. O plano técnico (linguagem,
> banco, hospedagem) ainda será desenhado pelo time de dev + infra. Este arquivo é só o **inventário** de tudo
> que hoje depende do endereço, medido no repositório em 30/10/2026 — para ninguém descobrir um item esquecido
> depois da virada. **Nada aqui foi alterado ainda.**
>
> Refaça a medição antes de começar de verdade (os comandos estão na seção 8).

## 0. Resumo em uma tela

| Camada | Quantos pontos | Quem precisa agir |
|---|---|---|
| Endereço escrito no código (JS, Cloud Functions, Mac, Windows) | ~20 arquivos | dev |
| Origem/URL escrita nas Cloud Functions (CORS e URL do push) | a mesma string repetida em 13 arquivos de `functions/` | dev + **deploy** |
| Login Google (cliente OAuth, *URIs de redirecionamento autorizados*) | 1 cliente web, 1 URI **por página** | infra (Google Cloud Console) |
| Firebase Auth (*domínios autorizados*) | 1 projeto (`hering-onboarding`) | infra (Firebase Console) |
| Dados que ficam **no navegador** de cada pessoa (por origem) | todas as páginas | **cada usuário**, sem como migrar |
| Links absolutos gravados **no banco** e em mensagens já enviadas | desconhecido (precisa varrer) | dev |
| Fora do repositório (WhatsApp, favoritos, convites, apps instalados) | — | comunicação |

## 1. Endereço escrito no código

O prefixo `/hering/` é do **GitHub Pages de projeto**; num domínio próprio o site costuma ficar na raiz
(`https://oceano.hering…/kanban.html`). Isso muda os caminhos, não só o host.

| Arquivo | O que tem | Observação |
|---|---|---|
| `firebase-messaging-sw.js` (`SITE_BASE_URL`) | URL base para abrir o app ao clicar na notificação | Service Worker — ver seção 5 |
| `functions/common/pushUrl.js` (`SITE_BASE_URL`) | URL que **a função** manda no push (`kanban.html`, `okr.html`, `escala.html`, `painel.html`…) | exige deploy de `sendPushOnNotification` e `sendPushOnMural` |
| `mare-notif.js` / `mare-notif-dev.js` (`SITE`) | base dos links do sino | módulo compartilhado: bump do `?v=` em **todas** as páginas |
| `onboarding.html`, `onboarding.slide.html` | links de download do slide e um `<iframe>` para `kanban-dev.html?squad=dev` | páginas independentes |
| `painel.html`, `painel-dev.html` | texto "domínio caiosoares1899.github.io/hering" na aba 🔋 Status; um Comunicado semeado com link do Oceano (`COMUNICADO_RASCUNHOS_SEED`) | o semeado já pode estar gravado no banco |
| `minipainel.html` — consumidores: `windows/oceano-bandeja.ps1` (`$PaginaWeb`), `mac/Shared/Config.swift` (`urlMiniPainel`) | endereço da página e das funções | rodam na máquina do Caio; reinstalar/atualizar |
| `docs/…`, `CLAUDE.md`, `README.md`, `ecossistema.html` | texto e exemplos | atualizar por último |

## 2. Cloud Functions: allowlists de origem (CORS)

Hoje cada função repete a origem `https://caiosoares1899.github.io`. Se a origem do site mudar e a função **não**
for republicada, o navegador bloqueia a chamada (erro de CORS) — o sintoma é "o botão não faz nada".

| Função (arquivo) | Como restringe |
|---|---|
| `oceanoResumo` (`oceano/resumo.js`) | `Access-Control-Allow-Origin: SITE_ORIGIN` |
| `intakeSubmit` (`intake/submit.js`) | `ALLOWED_ORIGIN` — **formulário público**, link já circula entre as pessoas |
| `backupCompletoApi` (`backup/restaurarApi.js`) | `cors: SITE_ORIGIN` |
| `agenteAgilAnalisePO` (`analisePO.js`), análise de dados (`analiseDados.js`), `resumoMeuDia.js` | `cors: SITE_ORIGIN` |
| Spotify: `syncNow`, `playback`, `radioSearch`, `radioSuggest`, `disconnect` | `cors: SITE_ORIGIN` |
| Spotify OAuth (`_shared.js` → `ALLOWED_RETURN_ORIGIN`) | valida o `returnUrl` (evita redirecionamento aberto) |

Dica para a virada: **durante a transição aceitar as duas origens** (a antiga e a nova) e só remover a antiga depois.
Hoje cada arquivo declara a sua própria `const` com a mesma string (13 ao todo, contando a `SITE_BASE_URL` do push); vira uma lista. Vale centralizar numa só (`functions/common/`) em vez de repetir 13 vezes.

Não dependem do domínio do site (ficam como estão, salvo troca de projeto/região): URLs
`https://us-central1-hering-onboarding.cloudfunctions.net/…` e os `REDIRECT_URI` do Spotify
(`spotifyOauthCallback`, `spotifyRadioOwnerCallback`) — a parte do Spotify aparece pausada na interface, mas as funções seguem publicadas.

## 3. Login Google (o item que mais costuma travar)

- **`mare-login.js` / `mare-login-dev.js`** (iPhone/iPad e `?loginDireto=1`) montam o `redirect_uri` com
  `location.origin + location.pathname` — ou seja, a URL **de cada página** precisa estar cadastrada em
  *Google Cloud Console → Credenciais → cliente web `122502391131-…` → URIs de redirecionamento autorizados*.
  Páginas sem URI própria (Escala, Intake) usam `{hub:true}` e voltam pelo Oceano.
  **Cadastrar, no domínio novo:** `oceano.html`, `kanban.html`, os `-dev` equivalentes e qualquer página nova que use o login direto.
  Os URIs do domínio antigo podem ficar até o fim da transição.
- **Firebase Auth → Configurações → Domínios autorizados:** adicionar o domínio novo (sem isso o `signInWithPopup` falha com
  `auth/unauthorized-domain`). O `authDomain` das páginas (`hering-onboarding.firebaseapp.com`) é do projeto Firebase, não do site.
- O login restringe por `hd=ciahering.com.br` e as regras do banco pelo e-mail terminado em `@ciahering.com.br`. Se o time de
  infra trocar de **projeto Firebase** ou de **provedor de identidade** (SSO corporativo), isso muda de natureza: ver seção 7.

## 4. PWA do Oceano

`oceano.webmanifest` / `oceano-dev.webmanifest` usam `start_url` e `scope` **relativos** (`./oceano.html`), então acompanham
o novo endereço sozinhos — mas um app **instalado** na tela inicial é amarrado à origem antiga: cada pessoa precisa
reinstalar no domínio novo. Planejar um aviso ("o Oceano mudou de endereço, reinstale") e, na origem antiga, uma página que
redirecione para a nova.

## 5. Dados do navegador são por origem — não migram

Ao mudar o domínio, o navegador trata como outro site. Cada pessoa perde, **na primeira abertura**:

- sessão de login (precisa entrar de novo);
- **permissão e token de notificação push** (o token FCM nasce do Service Worker daquela origem): todos precisam reativar o 🔔
  em cada aparelho; enquanto isso, ninguém recebe push no domínio novo;
- cache de cards (IndexedDB), preferências locais (tema, "Meus links" no aparelho, atalhos de teclado, dicas já vistas
  quando guardadas em `localStorage`), Service Worker e cache offline;
- o cache `ext_ok_…` do gate de convidados, tokens do Google Calendar (`gcal_token`).

O que **está no banco** (Não Perturbe, preferências por pessoa em `kanban/usuarios/{uid}/…`, links pessoais, dicas) acompanha a
pessoa. Vale conferir, antes, quais preferências ainda moram só no `localStorage`.

## 6. Links absolutos que já estão gravados

Não dá para achar só olhando o código — é preciso varrer o **banco** e os arquivos publicados:

- Comunicados/Mural do Oceano (HTML do aviso, com links), `kanban/config/links_hering`, `kanban/usuarios/{uid}/links`;
- notificações já gravadas (`link`/`url`), comentários e descrições de card que colam o link do Maré;
- o formulário público de intake (link distribuído ao pessoal de fora da squad), páginas compartilhadas por WhatsApp/e-mail;
- `ecossistema.html`, `maredigital.html` e os slides (`*.slide.html`) que apontam para URLs absolutas.

Sugestão: um script **somente leitura** que conta, por nó do banco, quantos valores contêm `caiosoares1899.github.io`
(posso escrever quando o plano avançar), e decidir entre reescrever e manter um redirecionamento permanente na origem antiga.

## 7. O que muda se o back-end trocar (Node + banco mais robusto)

O front-end fala **direto** com o Firebase Realtime Database; as regras de `database.rules.json` fazem o papel de back-end
(autorização por e-mail, papel por squad, validações). Trocar o banco implica reescrever essa camada, não só o endereço.
Pontos a inventariar quando o desenho existir (o `docs/MAPA_DO_REPOSITORIO.md` já lista quem lê/escreve cada nó):

- autenticação (hoje Firebase Auth + Google) e como o token chega às funções;
- tempo real (`onValue`/`onChildAdded` nos cards, presença, sino único) — sem equivalente imediato num banco relacional;
- push (FCM), backups (`weeklyBackup`/`backupCompletoSemanal`/`backupGlobalDiario`), Storage;
- as 37 exportações de `functions/index.js` (Node) são o trecho mais portável; os monitores e o Agente Ágil dependem do Admin SDK.

## 8. Como refazer esta medição

```bash
# endereço escrito no código/documentos
grep -rIl "caiosoares1899.github.io" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=vendor .
# allowlists de origem nas funções
grep -rIn "SITE_ORIGIN\|ALLOWED_ORIGIN\|ALLOWED_RETURN_ORIGIN\|cors:" functions --include=*.js --exclude-dir=node_modules
# redirecionamentos do login direto (usa location.origin + location.pathname)
grep -n "redirect_uri\|hubDe" mare-login.js
# caminhos absolutos com o prefixo do GitHub Pages
grep -rIn "[\"'(]/hering/" --include=*.html --include=*.js --exclude-dir=node_modules --exclude-dir=vendor .
```

## 9. Checklist sugerido para o dia da virada (rascunho, a rever com a infra)

1. Domínio e certificado prontos; site publicado na origem nova **em paralelo** com a antiga.
2. Google Cloud Console: URIs de redirecionamento do cliente web + Firebase Auth: domínio autorizado.
3. Funções: origem nova **além** da antiga (CORS e `SITE_BASE_URL`), deploy, teste do push e do formulário de intake.
4. Páginas: trocar `SITE`/`SITE_BASE_URL`/links (bump de `?v=` do `mare-notif`), promover dev → prod pelo fluxo normal.
5. Comunicar: Mural + WhatsApp ("novo endereço, entre de novo, reative o 🔔, reinstale o app").
6. Origem antiga: redirecionamento para a nova por um período; depois retirar as origens antigas das allowlists.
7. Atualizar `CLAUDE.md`, `README.md`, `ecossistema.html`, mini painel (Windows/Mac) e este documento.
