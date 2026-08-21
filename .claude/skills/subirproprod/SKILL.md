---
name: subirproprod
description: Promove o conteúdo validado de kanban-dev.html pra produção (kanban.html), seguindo o "Release process" do CLAUDE.md, e entrega os três artefatos que sempre acompanham essa promoção — (1) o PR de prod em si (diff restrito às 2 linhas de ambiente + version bump + CHANGELOG), (2) rascunho de avisos (Mural em painel.html + texto de WhatsApp), e (3) log completo da promoção como comentário no card certo do Firebase (squad dados) — "Implementação Agente Ágil" (c1785199972010_nd0) se for sobre o Agente Ágil, "Melhorias Maré Digital" (c1783541085140) pra tudo mais. Use sempre que o usuário pedir "sobe pro prod", "sobe pra prod", "promove pra produção", "manda o kanban pra prod", "libera pra prod", "publica no prod", ou invocar /subirproprod diretamente — mesmo que a frase não peça os avisos/log explicitamente, eles são parte padrão do fluxo (só pule se o usuário disser algo como "sem avisos"/"não precisa de avisos").
---

# Subir pro Prod — Maré Digital

Codifica o fluxo de promoção dev → prod já descrito no `CLAUDE.md`
("Release process"), garantindo que os 3 artefatos que normalmente
acompanham uma promoção de `kanban.html` não fiquem pra trás: o PR de
prod, os avisos (Mural + WhatsApp) e o log no card do Firebase. Nasceu
de promoções manuais repetidas sessão após sessão do mesmo jeito — esta
skill existe pra não esquecer nenhum passo, e pra deixar claro QUANDO
pular algum (só quando pedido explicitamente).

## Pré-requisito — antes de rodar isso

O que está sendo promovido já deve estar validado em dev por quem pediu
o fix/feature (CLAUDE.md passo 2: "Wait for explicit validation... Don't
promote on your own judgement that 'it looks right'"). Se não houver
confirmação explícita disso na conversa, pergunte antes de prosseguir.
Se o pedido for ambíguo sobre qual lote de mudanças acumuladas em dev
deve ir pra prod, confirme o escopo também.

## Passo 1 — Promover kanban-dev.html → kanban.html

1. `diff kanban.html kanban-dev.html` primeiro, pra ver exatamente o que
   vai mudar — só devem aparecer as mudanças esperadas + as 2 linhas de
   ambiente já divergentes (versão e `VERSION_KEY`).
2. `cp kanban-dev.html kanban.html`.
3. Restaura SÓ 2 linhas no `kanban.html` recém-copiado:
   - `<div class="version">vX.Y.Z-dev</div>` → `<div class="version">vX.Y.Z</div>`
     (nova versão de prod, sem sufixo `-dev`)
   - `const VERSION_KEY = 'kanban_dev';` → `const VERSION_KEY = 'kanban';`
4. Confirma com `diff kanban.html kanban-dev.html` que só essas 2 linhas
   diferem entre os dois arquivos agora.
5. Bump da chave `kanban` em `version.json` pra nova versão de prod.
6. Nova entrada em `CHANGELOG.md`, sob `## kanban.html (produção)`,
   resumindo pro público de prod o que já estava documentado na(s)
   entrada(s) de dev sendo promovida(s) — não precisa repetir o diff
   interno, só o resultado.
7. Checks de rotina: extrai o maior bloco `<script>` e roda
   `node --check`; confere balanço de chaves/parênteses do arquivo
   inteiro contra o baseline conhecido (historicamente: braces -1,
   parens 0 — se divergir do último baseline usado na sessão, investigue
   antes de seguir).
8. **Confere se o `CODE_MAP.md` precisa de atualização.** Ele só é útil
   se continuar refletindo o código de verdade — não é opcional manter
   em dia. Usa o diff acumulado que está sendo promovido (o mesmo do
   passo 1) pra checar:
   - alguma função/const que o `CODE_MAP.md` indexa foi **renomeada,
     removida ou movida** de área? Atualiza a entrada correspondente.
   - a promoção introduziu uma **área funcional nova** (não só um ajuste
     dentro de uma função já existente) que ainda não tem seção no mapa?
     Adiciona uma entrada nova, no mesmo padrão das existentes (nome da
     função/const + linha + descrição de uma linha).
   Não precisa re-conferir o arquivo inteiro nem revalidar todos os
   números de linha já existentes a cada promoção — isso é
   responsabilidade de quem for *usar* o mapa depois (sempre re-`grep`
   antes de confiar numa linha, conforme o próprio `CODE_MAP.md` e o
   `CLAUDE.md` já deixam explícito). Aqui o objetivo é só não deixar
   nenhum anchor morto ou uma área nova invisível. Se nada relevante
   mudou, segue sem tocar no arquivo. Se o `CODE_MAP.md` for editado,
   entra no mesmo commit/PR da promoção.
9. Commit → `git fetch origin main -q && git rebase origin/main -q` →
   push → PR → merge (squash, nunca self-merge sem checar CI) → rebase +
   push final na branch de trabalho. Mesmo fluxo de qualquer outro PR
   neste repo.
10. Tenta criar e empurrar as tags de release (`kanban-vX.Y.Z` no commit
    de merge) — ver nota sobre 403 abaixo se falhar.

## Passo 2 — Avisos (Mural + WhatsApp)

Pule este passo SÓ se o usuário disser explicitamente pra pular (ex.:
"sem avisos", "não precisa de avisos"). Por padrão, sempre gere os dois:

**Mural** (`painel.html`): adiciona uma entrada nova em
`COMUNICADO_RASCUNHOS_SEED` (perto da linha ~5984 — usa as entradas
`seed_*` já existentes como referência de tom/formato) com:
- `id`: novo e estável, ex. `seed_<slug-da-mudanca>_2026_MM_DD`
- `titulo`: chamativo, com emoji
- `corpo`: HTML (`<p>`, `<b>`) resumindo em termos de USUÁRIO o que
  mudou — nunca em termos técnicos/internos (arquitetura, nomes de
  função, números de PR não interessam a quem lê o Mural)
- `tipo: 'novidade'`, `squad: '*'`

Isso fica como rascunho (`rascunho:true`, `ativo:false`, gravado só
quando o ADM autenticado abre o painel — ver `_seedComunicadoRascunhos`)
até alguém revisar e publicar manualmente; não é publicado sozinho.

**WhatsApp**: texto corrido, mais curto, mesmo conteúdo em tom mais
informal, pronto pra copiar e colar num grupo. Entregue SEMPRE como
bloco de texto visível na resposta do chat — nunca só num arquivo —
porque quem for usar copia daqui direto. (Isso já foi reclamação
explícita numa sessão anterior — "vc ta falhando toda vez ao mandar o
texto do whatsapp" — não repetir.)

## Passo 3 — Log completo no card do Firebase

Sempre faça isso — inclusive quando os avisos do Passo 2 forem pulados.
Qual card usar (squad `dados` nos dois casos, regra do `CLAUDE.md`):
- **`c1785199972010_nd0`** ("Implementação Agente Ágil") — se a promoção
  for sobre o Agente Ágil (client-side ou orquestrador).
- **`c1783541085140`** ("Melhorias Maré Digital") — qualquer outra coisa.

Caminho: `kanban/squads/dados/dados/card_comments/{cardId}/{commentId}`.

Formato do comentário:
```js
const user = window._currentUser; // NÃO existe uma variável global `user` solta no console — ver nota abaixo
{
  id: 'c' + Date.now() + Math.random().toString(36).slice(2, 5),
  uid: user.uid,
  author: user.displayName || user.email || '?',
  init: window._currentUserInit || '?',
  foto: user.photoURL || '',
  text: `...`,
  ts: new Date().toISOString(), // NUNCA Date.now() — ver nota abaixo
}
```

O `text` deve ser completo o suficiente pra reconstruir o que aconteceu
sem precisar abrir o histórico de commits: contexto/motivação, o que
mudou tecnicamente (com números/achados reais quando houver), número(s)
de PR, resultado dos checks de rotina, e qualquer limitação conhecida do
ambiente (ex.: push de tag com 403). Entregue SEMPRE como bloco de
código JS completo e visível na resposta do chat, pronto pra colar no
console do navegador (painel ou kanban, já logado) — mesma regra de
entrega do WhatsApp acima; salvar só num arquivo não conta como
entregue.

## Coisas que já causaram problema (não repetir)

- **`user.uid` sem definir `user`** — o console do painel/kanban não tem
  uma variável global `user` solta; o usuário logado vive em
  `window._currentUser`. Sempre abrir o script do log do card com
  `const user = window._currentUser;` antes de usar `user.uid`/
  `user.displayName`/`user.photoURL` — sem isso dá
  `ReferenceError: user is not defined` na hora de colar (já aconteceu
  2x na mesma sessão, com scripts diferentes).
- **`ts: Date.now()` em vez de string ISO** — quebra silenciosamente
  `loadComments()` pra TODA a lista de comentários daquele card (o sort
  usa `a.ts.localeCompare(b.ts)`, que não existe em number). Sempre
  `new Date().toISOString()`.
- **Push de tags** (`kanban-vX.Y.Z`, `kanban_dev-vX.Y.Z-dev`) falha com
  `HTTP 403` neste ambiente com alguma frequência — tenta, mas se falhar
  não insiste nem trata como bloqueante; documenta no log do card (Passo
  3) e segue.
- **Nunca só salvar o script num arquivo** — tanto o texto de WhatsApp
  quanto o script do log do card precisam aparecer como conteúdo
  completo e visível na resposta, não só como caminho de arquivo.
- **Não promove sem validação explícita** de quem pediu que o dev já foi
  testado/aprovado — se não tiver certeza, pergunta antes de tocar em
  `kanban.html`.
- **`CODE_MAP.md` esquecido em promoções passadas** — antes dele existir,
  `CLAUDE.md` já tinha ficado semanas descrevendo `functions/index.js`
  como "a única Cloud Function" mesmo depois de várias outras terem sido
  adicionadas (Spotify, intake, backup semanal) — um achado incidental
  numa promoção chegou a sinalizar isso como TODO e ainda assim ficou
  parado. O passo 8 acima existe pra não deixar o mapa sofrer o mesmo
  esquecimento agora que ele existe.
