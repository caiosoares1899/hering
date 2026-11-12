# Coordenação v2: propostas ainda não implementadas (11/11/2026)

Duas frentes do pedido de reorganização (PR `claude/coordenacao-v2`) ficaram só como proposta escrita: cada uma vai num PR próprio, depois da decisão do Caio. Os números abaixo foram medidos no git em 11/11/2026, de 05/11 a 11/11.

## F. Tirar do revisor o que a máquina confere (`scripts/checar.js`)

Hoje o revisor confere à mão, em todo PR, coisas que um script pega. Propostas de checagem nova na CI, todas só sobre o **PR** (o diff contra `origin/main` e o corpo do PR via variável de ambiente da Action):

| Checagem | Como | Falha quando |
|---|---|---|
| Trailer `Agent:` | `git log origin/main..HEAD --format=%B` | algum commit sem `Agent: claude/codex/antigravity` |
| Prefixo × trailer | nome da branch × trailers | branch `codex/…` só com `Agent: claude`, por exemplo (aviso, não falha: integração legítima existe) |
| Linha `Fronteira:` | corpo do PR | ausente |
| Linha `Dica:` | corpo do PR | ausente em PR que toca página `-dev` |
| Arquivo reservado | `docs/QUADRO.md` › *Em andamento* (arquivos entre crases) × `git diff --name-only` | o PR mexe em arquivo reservado por **outra** branch |

Cuidado: o corpo do PR é texto de terceiros na CI; a checagem só lê (regex), nunca executa nada dele (linha vermelha nº 2 do `AGENTS.md`). O formato fixo do `QUADRO.md` (arquivos entre crases, separados por vírgula) já foi escrito para esta checagem.

## G. Arquivos quentes (diagnóstico)

Edições (commits não-merge) e merges com resolução manual (diff combinado não vazio no `git show --cc`), de 05/11 a 11/11:

| Arquivo | Edições | Merges com resolução manual |
|---|---|---|
| `docs/MAPA_DO_REPOSITORIO.md` | 68 | 12 |
| `CHANGELOG.md` | 66 | 8 |
| `version.json` | 65 | 10 |
| `docs/COORDENACAO_AGENTES.md` | 56 | 6 |
| `BUGS_E_CORRECOES.md` | 46 | 7 |
| `CODE_MAP_FAST.md` | 38 | 3 |

Três saídas, para avaliar (nenhuma implementada):
1. **Fragmentos de changelog por PR** (`docs/changelog.d/<pr>.md`), compilados no `CHANGELOG.md`/`BUGS_E_CORRECOES.md` pela promoção. Tira 2 dos 3 arquivos mais quentes da maioria dos PRs. Custo: o `conhecimento` do Agente Ágil e a regra "SÓ DEV" (Armadilha 15) leem o CHANGELOG compilado; a compilação precisa rodar antes do `npm run conhecimento`.
2. **Arquivos gerados fora do PR de feature** (`MAPA_DO_REPOSITORIO.md`, `CODE_MAP_FAST.md`, `docs/CODE_SYMBOLS.md`): uma Action regenera na `main` depois do merge, ou só a promoção regenera. Custo: a CI hoje **reprova** mapa velho (o `checar.js` compara); a regra teria de virar "gerado na promoção".
3. **Bump de versão só no rebase final** (o último a entrar sobe a versão): reduz conflito em `version.json`, mas exige disciplina no rebase; o `mare-cli.js bump` já existe para isso.

Recomendação: começar pelo 2 (maior número de conflitos e zero valor de revisão humana), depois o 1.
