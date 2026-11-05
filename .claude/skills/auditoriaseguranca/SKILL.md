---
name: auditoriaseguranca
description: Auditoria de segurança por fronteira de confiança de UMA área do Oceano (Intake, Agente Ágil, backup, regras, uma página). Use em "audita a segurança de X", "/auditoriaseguranca".
---

# /auditoriaseguranca — segurança por fronteira, uma área por vez

Método em `docs/SEGURANCA_FRONTEIRAS.md` (adaptado do `cloudflare/security-audit-skill`, MIT). **Leia o doc antes de começar** e `docs/AUDITORIA_SEGURANCA_2026-10-18.md` (o que já foi achado/fechado — não refaça). Isto **não é** o `/monitorarbugs` (comportamento errado) nem uma auditoria completa do repo: é uma rodada **focada**, sem JSON nem relatório em arquivo.

## Entrada
Uma área: `intake`, `agente` (Agente Ágil + `okrAgenteChat`), `backup`, `regras`, `dom` (uma página `-dev`), `http` (os `onRequest`), ou um caminho. Sem área, **pergunte** — não varra o repo inteiro.

## Passos
1. **Reconhecimento curto (≤ 5 leituras):** quem escreve na área, quem lê, qual identidade executa (navegador logado, Admin SDK, LLM), onde estão as regras do banco que a cobrem. Escreva os principais da §2 do doc que se aplicam.
2. **Caça pelos mapas A–D** que tocam a área, partindo do **efeito colateral para trás** (escrita, envio, custo) até o principal de menor confiança. Compare os caminhos direto, em fila, retry e em lote do mesmo efeito: o gate mais forte tem que valer depois que os argumentos estão finais.
3. **Regra de entrada:** cada candidato precisa das 4 linhas (quem · fronteira · controle · resultado). Sem elas, descarte na hora. Modelo interno aceito (§1 do doc) não é achado.
4. **Verificador que refuta:** mande **todos** os candidatos restantes da rodada a **um** verificador de contexto limpo (Agent — só trechos e contratos, **sem** a sua explicação) com a missão de provar, candidato a candidato, que já existe barreira. Só segue o que sobrevive. Quem achou não valida. (Um por rodada, não um por candidato — custo de token.)
5. **Veredicto:** `confirmado` (trace + resultado observável em teste **local**: Firebase falso, `functions/rules/rulesSim.js`, Playwright em localhost) · `precisa_validar` (falta fato fora do repo: regra no Console, Google Cloud/Auth, cabeçalho do Pages — diga exatamente o que o Caio precisa olhar; sem severidade) · `rejeitado` (uma linha com o motivo).
6. **Corrija só o `confirmado`**, no `-dev`/`functions/`, com teste de regressão; siga o Release process (dev primeiro; `functions/`/regras → "Pendente de deploy", o Caio roda). Antes de dar por concluído algo em `functions/` ou regras, consulte o advisor.
7. **Registre** em `BUGS_E_CORRECOES.md` (`mare-cli.js log --type bug`): área, o que foi coberto e o que NÃO foi, e os veredictos. Armadilha nova entra em "Armadilhas Conhecidas".

## Limites (inegociáveis)
- Só código-fonte e teste local. **Nunca** sondar produção, o Console, contas reais ou dados de outras pessoas; nunca gastar cota paga para "provar".
- Nada de severidade para `precisa_validar`. Nada de relatório antes da verificação.
- Termine dizendo cobertura parcial: uma passada não esgota a área.
