# Plantão de Bugs (férias do Caio, 16/10 → 03/11/2026)

> Runbook vivo. Cada PR do plantão atualiza a seção **Status**. Regras de conduta dos agentes: `AGENTS.md` ("Linhas vermelhas"); divisão de trabalho: `docs/COORDENACAO_AGENTES.md`.

## O problema e as restrições

Com o Caio fora, bugs reportados no Oceano (Assistente Férias) precisam ser analisados, corrigidos e validados **sem TI** (não libera nada), **com o mínimo de gente do time** e **documentado**. Decisões do Caio: o Antigravity roda no PC dele (fica ligado); acesso ao Firebase só pelo que as regras permitirem; o Claude fica livre para trabalho grande e só o Agente Ágil (API barata) entra no fluxo.

## Fluxo-alvo (3 PRs)

```
Pessoa (Oceano) ─► kanban/feedback/{id}  +  card na squad Dados › 🐛 Bugs     (dados da pessoa ficam SÓ aqui)
                         │
                Agente Ágil (Cloud Function): triagem, junta duplicados, grava o PACOTE ANÔNIMO em
                         ▼                     kanban/plantao/fila/{id}   e avisa os ADMs
      Antigravity (PC do Caio, MCP, token de 1h com claim `agente`): lê só o pacote; devolve estado,
                         ▼                     resumo, PR de dev e **script de teste (obrigatório)**
      ADM (André ou Alisson): roda o script no console de dev ─► registra resultado ─► ✅ Validei / ❌ Reprovei (máx. 3 tentativas)
                         ▼
      PR de prod só depois do ✅ ─► webhook assinado do GitHub ─► Cloud Function grava a resolução no card ─► sino da pessoa
```

Quem valida é **sempre um ADM** (papel `adm` no Oceano + colaborador do repositório) — nunca quem reportou. O ADM só aprova com o script de teste na mão.

## Status

| PR | Conteúdo | Situação |
|---|---|---|
| 1 — Contenção | Removidos o workflow `ferias-bug-bot.yml`, o `ferias-daemon.js` e o `.bat`; Oceano deixa de abrir Issue pública e de ler a API do GitHub; pacote anônimo; linhas vermelhas no `AGENTS.md`; a CI reprova workflow que reage a issue/comentário | **este PR** |
| 2 — Servidor | Regras de `kanban/plantao/fila/{id}`, token do agente, triagem/vigia do Agente Ágil, avisos aos ADMs, webhook do GitHub, campos de validação (`scriptTeste`, `resultadoTeste`, só ADM), chave `kanban/config/plantao_ativo` | pendente (exige deploy de functions + database) |
| 3 — Ferramenta | Servidor MCP (3 ferramentas: `proximo_bug`, `registrar_resultado`, `abrir_pr`), tela de validação do ADM no Oceano, instrução "sem script, bug não é entregue" | pendente |

**Enquanto os PRs 2–3 não entram, o plantão é manual:** o bug chega no card da squad Dados (🐛 Bugs); o ADM abre o card, copia o **pacote anônimo** (botão no Oceano / bloco "🤖 PACOTE ANÔNIMO" na descrição) e roda o `/monitorarbugs` no Antigravity, **com aprovação humana dos comandos** (ver abaixo).

## O que mudou no PR 1 (e por quê)

| Antes | Problema | Agora |
|---|---|---|
| Botão "Abrir Issue no GitHub" com nome + e-mail de quem reportou | Repositório público: o dado pessoal ficava exposto (a issue #1445 ainda precisa ser editada/apagada pelo Caio) | Nada vai ao GitHub; o relato fica no Firebase |
| Workflow disparava em `issues`/`issue_comment` com permissão de escrita e promovia a prod com "aprovado" | Qualquer pessoa na internet podia acionar o robô e promover | Workflow removido; a CI reprova qualquer um com esse tipo de gatilho |
| `ferias-daemon.js` apertava o "Run" do Antigravity | Contornava o controle corporativo de aprovação de terminal | Removido; regra nº 1 do `AGENTS.md` |
| Página lia comentários públicos da Issue e aceitava `FERIAS_STATUS` de qualquer autor | Qualquer pessoa mudava o status do chamado; estourava o limite de 60 req/h do GitHub | Removido; status vem do Firebase, escrito por quem tem permissão |
| Prompt do `/monitorarbugs` com o nome do autor, link e print | Dado pessoal indo para o agente e para logs | **Pacote anônimo** (`feriasMontarPacoteAnonimo`): app, arquivo, impacto, descrição e trecho de console sanitizados (e-mail, link, telefone, CPF e chaves viram `[…]`) |

## Passos manuais do Caio (não dá para o Claude fazer)

1. **Desativar o workflow antigo** (se ainda aparecer): GitHub → Actions → "Plantão de Férias" → ⋯ → *Disable workflow*. (Depois do merge deste PR ele some do repositório.)
2. **Editar/apagar a issue #1445** (tem o seu nome e e-mail em repositório público).
3. **Confirmar André e Alisson**: papel `adm` no Oceano e acesso de escrita ao repositório.
4. **Teste de 2 minutos do Antigravity** (antes do PR 3): pedir que ele rode um comando de terminal inofensivo e ver se a empresa exige aprovação a cada comando; se exigir, o plantão depende de alguém aprovar — **não se contorna** (regra nº 1).

## Parâmetros a confirmar

- Custo do Agente Ágil por bug (estimativa US$ 0,01–0,03): conferir no console da Anthropic e definir um teto mensal.
- Se o Antigravity consegue rodar tarefa agendada sem ninguém na frente, e se o PC dorme durante as férias.
