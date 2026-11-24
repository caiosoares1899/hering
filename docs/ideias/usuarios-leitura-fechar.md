# 🔒 Fechar a leitura ampla de `kanban/usuarios` (desenho de 24/11/2026, R3)

**Problema** (`docs/quadro/escalados.md#usuarios-leitura-ampla`): `database.rules.json` dá `.read` no nó-pai `kanban/usuarios` a **qualquer conta Google @ciahering**, e a leitura desce em cascata. Toda a Hering lê, de todo mundo:
- `notificacoes`, que já expõe o `travessia_apoio`: "{nome} marcou que não está bem hoje";
- `fcm_tokens` e `notif_prefs`;
- papéis e squads.

**Inventário:** `docs/ideias/usuarios-leitura-inventario.md` (#1953). Fora o próprio usuário, são **4 leituras do nó inteiro** (Painel ×3, Radar ×1) e **5 de outro uid** (a transação de `createNotif` no Maré e 3 rotinas ADM do Painel).

## Decisões do Caio (24/11)
| # | Decisão |
|---|---|
| D1 | Depois da correção, **só ADM** lê o cadastro completo dos outros, incluindo notificações, tokens e Não Perturbe. A Central de Notificações do Painel continua com indicadores por pessoa, só para ADM. |
| D2 | **Torre** e **Gestor OKR** passam para o diretório público (`usuarios_publicos`), para o Radar continuar igual para todo mundo. |

## Regra final (fase C)
- **Nó-pai:** `kanban/usuarios` `.read` = Google @ciahering **e** ADM, pela mesma régua das outras regras: `role === 'adm'` no próprio cadastro ou o e-mail do Caio.
- **Cadastro próprio:** `$uid` `.read` continua sendo só o dono.
- **Regras de outros nós** que consultam `root.child('kanban/usuarios/…')` rodam no servidor e **não** dependem de `.read`, então nada muda nelas.
- **Funções:** usam Admin SDK, então nada muda.

## Sequência (a ordem importa: fechar a regra antes de mudar as páginas quebraria o Painel e o Radar)

**Fase A — diretório completo (regra + escritores + carga inicial), sem fechar nada ainda**
1. `usuarios_publicos/$uid` ganha `torre` e `gestorOkr`, validados **iguais à fonte** (`root.child('kanban/usuarios/'+$uid+'/torre')`), como já é feito com `diretoria`. O espelho público não pode mentir: o Radar usa o `gestorOkr` dos outros para mostrar controles, e o espelho é gravável pelo próprio usuário.
2. Escritores gravam fonte e espelho **no mesmo `update`**:
   - a torre na inscrição do Maré (`kanban-dev.html`, inventário L14071);
   - a escolha de torre no Radar (`okr-dev.html` L7081);
   - o ADM pelo Painel (`painel-dev.html` L11518);
   - o `gestorOkr` no Painel (L11620).
3. **Carga inicial:** script de console do ADM, que copia `torre` e `gestorOkr` de cada cadastro para o espelho e cria o espelho básico de quem não tem (`nome`, `foto`, `init`, `email`, `role`, `squads`, `squads_roles`). Escreve só onde falta ou diverge, e mostra o que fez.

**Fase B — as páginas param de ler o nó inteiro (sem fechar ainda; tudo continua funcionando com a regra atual)**
4. **Radar** `loadGlobalUsers`: lê `usuarios_publicos` para todo mundo. O cadastro completo continua sendo lido só para a **própria** pessoa (papel, torre e `gestorOkr` dela, para os próprios controles).
5. **Painel** `_getUsuariosMap` / `loadGlobalUsers`:
   - **quem não é ADM** lê `usuarios_publicos`;
   - **ADM** continua lendo o nó inteiro, para a gestão de papéis, a migração midia→prf, os reparos de diretoria e a Central de Notificações (D1).
   - A troca acontece no `_usuariosNode()`, que já escolhe o diretório para o externo.
6. **Maré** `createNotif` com id determinístico: sai a transação que **lê** a notificação do outro. Entra um `set` simples, e a regra recusa regravar.
   - A regra de `notificacoes/$notifId` hoje já exige `!data.exists()` para quem não é o dono, **exceto PO/ADM**. Esse ramo de PO/ADM passa a valer só para notificação nova ou para apagar, nunca para regravar uma existente, que reabriria um aviso lido.
   - A página trata `PERMISSION_DENIED` nesse `set` como "já existe".
   - Antes, conferir que nenhum fluxo de PO/ADM regrava a notificação de outra pessoa de propósito (grep de escritas em `notificacoes/` de outro uid).
7. **Gantt** (`mare-gcal-dev.js` L160): o ramo que leria a notificação de terceiros fora do dev segue o mesmo caminho do item 6.

**Fase C — fechar** (só depois de A e B no ar **e validados no prod**, porque as páginas de prod também leem o nó)
8. Regra do nó-pai só para ADM, com testes no simulador:
   - pessoa comum não lê o nó nem a caixa de outro;
   - ADM lê;
   - o dono lê a própria;
   - o externo não lê nada.

   Sabotagem e duas revisões (Codex + Antigravity).
9. Deploy: `firebase deploy --only database`, **depois** da promoção das páginas da fase B.

## Testes
- **Simulador:** espelho `torre`/`gestorOkr` igual à fonte, com sabotagem; leitura do nó-pai por papel; `createNotif` sem regravar.
- **Páginas:** Radar e Painel com um usuário comum lendo só `usuarios_publicos` (conferido no log do fakefb, sem nenhuma leitura de `kanban/usuarios` de outro uid); ADM continua com a gestão e a Central.

## Divisão
- **Claude:** regras (A1, C8), `createNotif` (B6) e a revisão de tudo.
- **Codex, por contrato:** escritores do espelho (A2), Radar (B4) e Painel (B5), um PR por página.
- **Script de carga (A3):** Claude escreve, o Caio roda.

**Fronteira:** quem lê o quê muda, e é exatamente o objetivo. Na fase A, o espelho público ganha dois campos, validados contra a fonte. Exige validação do Caio: a carga inicial e a fase C, que vem depois do prod validado.
