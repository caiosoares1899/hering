# Gantt no celular — auditoria de 13/11/2026

Baseline: main 6b01b323, boot real com fakefb, 1280×900 e 390×800, três temas. Dados sintéticos: título longo com emoji, ação de um dia, barra começada antes/terminada depois da janela, 50 ações simultâneas por fonte; Cards com período e um controle só com Prazo. Capturas em antes/. Nenhum dado real.

| Achado antes da correção | Classe | Evidência | Tratamento |
|---|---|---|---|
| Cards/Marca compactos: um dia tem 30 px menos margens; barras têm 22/24 px de altura | Design/acessibilidade | antes/medicoes_390.json; Marca 51/52 nomes truncados no Maré | Só no celular: dia compacto48px (44 úteis) e barras ≥44px; continua com 42 dias |
| Calendários comerciais mostram texto, mas ações curtas ou fora da área visível dependem de toast abaixo da régua/hover | Design | capturas Maré/Radar; teste de leitor persistente falha nas 33 combinações móveis da main | Leitor persistente a um toque, texto integral, datas e linha, fundo opaco e rolagem interna |
| Ação do card e destaque ADM precisam continuar disponíveis | Requisito de comportamento | clique original abre card/editor | Leitor móvel mantém ação Abrir card ou Destacar; desktop conserva clique original |
| Menos datas na régua alteraria interpretação da janela e navegação | Decisão de produto | contrato mantém6 semanas | Não implementado; decisão do Caio |

Baseline: teste novo terminou com33 falhas esperadas (leitor ausente); nenhum erro JS ou overflow da página nas 66 combinações de app/aba/tamanho/tema. As barras comerciais largas do Maré já tinham44px de altura; a compacta não. No Radar, mínimas de 24 px (Marca) e 28,19 px (comerciais).

Direção: preservar42 dias/±28 dias e desktop; ampliar apenas a geometria de toque no celular e tornar o texto acessível a 1 toque. Não alterar dados, filtros, permissões nem leituras do Firebase.


## Resultado e decisões

O leitor móvel permanece aberto, usa os tokens Marine Glass dos três temas e mostra o texto completo e as datas. O conteúdo longo rola dentro dele; Fechar continua alcançável. Cards mantêm **Abrir card**; a barra de calendário do ADM mantém **Destacar ação**. Não foi reduzida a janela de seis semanas nem alterado o desktop. Não houve animação nova.

Revisão técnica adicional encontrou e corrigiu a especificidade do min-height comercial no Radar e a prioridade de Esc quando o painel do dia está aberto. O teste também garante que redesenhar sem trocar de aba não fecha a leitura.

- Baseline main: **33 falhas esperadas** no teste novo (leitor persistente ausente).
- Branch: **0 falhas**, seis abas do Maré e cinco do Radar, três temas, toque real em barras longas e de um dia; verificação do texto de **todas** as barras, vazio, 50 ações simultâneas por calendário, Esc em camadas, redesenho, Hoje/Mês e De/Até no Maré.
- Alvos das barras e botões: **≥44×44 px**. Contraste mínimo medido no texto integral do leitor: **10,65:1**. Sem overflow da página e sem erros JS.
- Desktop: **zero pixels diferentes nas nove capturas comparadas**. Aleatoriedade fixada, animações pausadas e selo de versão oculto nos dois lados, para comparar o layout. Resultado em [comparacao_desktop.json](comparacao_desktop.json).
- Dez regressões do Gantt verdes; checar.js verde; functions: 1.248 passam, zero falhas, um ignorado. Resumo da saída em [TESTES.txt](TESTES.txt).

### Capturas para conferir

- Maré: [antes](antes/mare_marca_390_light.png) → [depois, barra de um dia](depois/mare_um_dia_390_light.png).
- Radar: [antes](antes/radar_marca_390_light.png) → [depois, barra de um dia](depois/radar_um_dia_390_light.png).
- Os nomes dos arquivos identificam app, aba, largura e tema. `antes/medicoes_390.json` e `depois/medicoes_390.json` guardam as medições móveis finais.

### Reprodução

Sirva a raiz do worktree e rode `BASE_URL=http://127.0.0.1:8954 node docs/arezzo/testes/test_gantt_celular.js`. Para repetir o teste contra a main auditada sem trocar arquivos no disco: `MAIN_BASELINE=1 PHASE=antes WIDTH=390 BASELINE_REF=6b01b323 BASE_URL=http://127.0.0.1:8954 node docs/arezzo/testes/test_gantt_celular.js` (falha esperada). O baseline é servido por page.route a partir de git show.

### Limites e validação do ADM

Não verificados: iPhone/Safari físico, Firebase real e execução nos aparelhos da equipe. Os dados e as atualizações de teste são sintéticos. O diagnóstico de console read-only está no início do teste novo.

No dev, abra o Gantt em 390 px, toque numa barra curta em cada aba e leia o nome/datas no painel. Confira Fechar/Esc e, nos Cards, Abrir card. No Radar e no Maré, abra um dia da Digital e depois uma barra: Esc fecha primeiro a leitura. Repita no tema claro e Vice.

**Fronteira:** sem mudança. São os mesmos textos já renderizados; o leitor usa textContent, sem HTML de banco, URL ou regra nova. **Dica:** não — instrução visível no Gantt e Ajuda atualizada; sem popup adicional.
