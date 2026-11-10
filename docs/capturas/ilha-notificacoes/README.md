# Ilha: paridade com o sino — 10/11/2026

A aba Notificações hospeda o nó original `#notif-panel`, sem clonar controles nem criar listeners novos. A lista completa, ações individuais, limpeza, feed da torre, som, push, Não Perturbe e modo insistente permanecem nos handlers do sino. Ao trocar aba, fechar ou desligar a Ilha, o painel e o menu voltam ao lugar original.

## Capturas com dados fictícios

| Cenário | Antes | Depois |
|---|---|---|
| 1280 px / escuro | [Antes](antes_1280_dark.png) | [Depois](depois_1280_dark.png) |
| 390 px / claro | [Antes](antes_390_light.png) | [Depois](depois_390_light.png) |

## Verificação

- `test_ilha_notificacoes.js`: 7 falhas contra a main anterior (`df1dff0d`), servida por interceptação; 51 verificações aprovadas na implementação. Desktop e celular com toque, três temas, 14 notificações, limpeza de IDs determinísticos sem recriação, preferências, menus, camadas, restauração de DOM e zero listeners novos.
- `test_ilha_mare.js`: 56 verificações aprovadas (timers, avisos, configurações e quatro temas).
- `test_seguranca_xss.js` com `PAGINAS=kanban-dev`: zero achados, 25 campos hostis vistos na tela.
- `npm test` em functions: 1196 aprovados, zero falhas, um pulado.
- Push testado com adaptadores de dispositivo simulados e Firebase falso: ativar/desativar/reativar no mesmo aparelho. Entrega real de push, prompts reais de permissão, Safari/iOS e leitor de tela não verificados.
- O controle de push consulta somente o registro do aparelho ao clicar; a navegação da Ilha não cria leituras ou listeners novos.

## Validação do ADM

No dev, abra ⏲ Timers → Ilha Dinâmica → Notificações. Confira marcar todas, remover um item, Limpar antigas, som, Não Perturbe e modo insistente. Em um aparelho de teste, valide push real e depois reative se tiver desativado. Troque de aba/feche/desligue a Ilha e confira o sino tradicional. Rode o script read-only `docs/arezzo/testes/console_ilha_notificacoes.js` enquanto a aba Notificações estiver aberta: cinco ✅.

Limpar antigas remove as lidas; não apaga indiscriminadamente as não lidas. O comportamento de feed e `noTTLDelete` é o mesmo do sino existente. Na lista longa o painel rola, para permitir acesso ao rodapé. Sem dica nova (restauração de recursos já conhecidos).
