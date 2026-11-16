# Tema claro do Painel e do Radar — auditoria de 17/10/2026 (fazer em 18/10)

**Status (16/11): revalidado na main `3f067720` e corrigido em Painel dev v5.118 / Radar dev v2.137. 2956 ocorrências abaixo do mínimo no claro/Vice antes; zero falhas sem justificativa depois, com 10 exceções nominadas. Escuro: 36/36 sem mudança visual (33 exatas; três diferenças mínimas de rasterização). Aguarda revisão/validação ADM e promoção. Provas: [tema_claro](../capturas/tema_claro/README.md).**

**Pedido do Caio:** "tá bem ruim esse tema claro no painel e no radar" — corrigir amanhã (18/10), só nos `-dev` (`painel-dev.html`, `okr-dev.html`), e depois promover na rotina de sempre.

**Como foi medido:** `node docs/arezzo/testes/auditoria_temas.js` (servidor estático na raiz, porta 8941): Radar (6 telas) + Painel (9 abas) × escuro/claro/Vice City × 1280 e 390 px, Firebase falso. Mede contraste de texto (WCAG, fundo composto estimado), cores fixas e rolagem lateral, e salva prints em `/tmp/auditoria`. **0 erro de JS e 0 rolagem lateral** em todas as combinações; o problema é legibilidade, quase todo no claro (907 textos abaixo do mínimo só no claro × 154 no Vice).

## 🔴 Claro (Lençóis)
1. **Toast invisível** (Painel e Radar): fundo escuro fixo `rgba(6,26,46,.97)` + `color:var(--txt)` (escuro no claro) → 1,07:1. `painel-dev.html:509`, `okr-dev.html:1094`.
2. **Painel sem passada de tema claro:** só 4 regras `[data-theme="light"]` (o Vice tem 15 e overrides em `painel-dev.html` ~L140–160). Abas "Radar ↗" `#ffd700` e "Escala ↗" `#ffb86b` fixas; "Monitor" `var(--danger)`; 💾 Backup `var(--teal)`; ⚙ Novo board `var(--warn)`; ~31 textos `color:var(--teal)` inline.
3. **Cores de status como texto:** `--teal` #33D6D0 e `--warn` #F6B73C = 1,0:1 sobre o vidro; `--danger` #F15B6C = 1,8:1 (KPIs, "Saudável", selos "Verificando…"/"Todos os 6 serviços…", "WIP 3/2", "Resolver todos", "▲ +1" do Histórico). O Oceano já usa teal #0a8f86 no claro.
4. **Texto direto sobre o fundo azul:** `--txt` sobre `#0F87C4` = 4,0:1; `--txt2` (72 %) = 2,8:1; aba/botão ativo em `--accent` #0077AD = 1,25–2,8:1 (abas do Radar, "14d", "Mês", chips "Todos", "Online no Radar", versão).
5. **Selo ao lado do título** ("Oceano" no Radar, `okr-dev.html:1603`; "Painel" no Painel) = `color:var(--teal)` inline, some no claro.
6. **Radar › Calendário:** número do dia de hoje azul sobre azul.

## 🟡 Vice City
- `--danger` #C5615F como texto sobre o vinho: 2,4–2,6:1.
- `--teal` #9c6f8a / `--cyan` #B36B6E como texto: 2,2–3,6:1 (selos do Painel › Status, "📈 Erros por dia", "6.5", botão "＋ Cadastrar primeiro painel" do Data Studio).
- "Radar ↗" / "Escala ↗" continuam em amarelo/laranja fixos (legíveis, fora da paleta).

## ⚪ Qualquer tema (pré-existente)
- Painel › Dados: estado vazio das metas ("Crie a **meta global** e os **desafios**") renderiza com letras gigantes, uma por linha (CSS do `<b>`).
- Textos auxiliares (`--txt3`, "Atualizado às…") ~3:1 nos três temas.

## Plano de correção (ordem)
1. Toast legível nos dois temas claros.
2. Passada do claro no Painel com o método do override do Vice (seletor por atributo para `var(--teal)`/`--warn`/`--danger` e cores fixas inline).
3. Tokens de **texto** para status no claro (valores testados contra o vidro claro: `--danger` #B3202F ≈ 3,7:1 · `--warn` #7a4f00 ≈ 4,0:1 · `--accent` #00527a ≈ 4,7:1; o teal não passa de 2,9:1 mesmo escurecido → no claro, teal só em preenchimento/borda e texto em `--txt`).
4. Aba/botão ativo (texto `--txt` + sublinhado/realce `--accent`), `--txt2` do claro mais forte (.72 → ~.85), selos de título, dia de hoje do calendário.
5. Vice: `--danger`/`--teal`/`--cyan` como texto mais claros; abas "Radar ↗/Escala ↗" na paleta.
6. Rodar o `auditoria_temas.js` de novo e transformar em teste de regressão (falha se um texto novo ficar abaixo do mínimo no claro/Vice). Bump de `painel_dev`/`okr_dev`, entrada em `BUGS_E_CORRECOES.md`, teste de console em português, avaliar dica (não — é correção).

## Revalidação de 16/11/2026

A declaração de 18/10 acima foi substituída pela prova do estado atual; esta auditoria não reconstrói retroativamente o que estava publicado em outubro. O código já tinha tokens mais escuros e toast legível: o toast foi medido e mantido. Restavam falhas em textos auxiliares, placeholders, filtros/selos, status e números do calendário.

Lençóis usa leitura mais escura, estados ativos com texto legível e correções localizadas nos usos de status sem contraste. Vice mantém o degradê/paleta, com uma camada estática do token de superfície sobre o fundo, tokens de texto mais claros e fundo legível nos cards próprios. Links Radar/Escala seguem a paleta. Foram alterados apenas cor/fundo/opacidade, sem layout nem JavaScript das páginas.

As únicas exceções no claro/Vice são o selo `ligado` do módulo compartilhado de Plantão (reservado) e os dois botões de envio desabilitados (WCAG 1.4.3; estados habilitados passam). Cada combinação, razão e motivo está na [prova completa](../capturas/tema_claro/README.md). Os contrastes preexistentes do escuro são catalogados e preservados; suas capturas passam na comparação. O auditor agora retorna código não zero para regressão nova.

Fronteira: sem mudança. Dica: não, correção.
