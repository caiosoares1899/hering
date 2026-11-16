# Diretoria de origem por pessoa — primeira etapa

Pedido do Caio em 16/11/2026: voltar a classificar pessoas por diretoria para a expansão do Maré Digital a boards de RH e CRM. Diretorias iniciais: Digital, RH, Marca e Tecnologia (Tecnologia acrescentada explicitamente pelo Caio). CRM é o board ligado à diretoria Marca, não uma diretoria adicional.

## Decisão de escopo

Implementar um atributo próprio `diretoria`, independente de `torre`. O campo antigo `kanban/usuarios/{uid}/torre` participa de permissões, filtros e público de avisos do Radar. Não deve ser reaproveitado, migrado nem reinterpretado para este pedido. Manter `MARE_SO_HERING` e o comportamento atual do Radar.

A classificação identifica a origem da pessoa. Nesta etapa ela não concede/revoga acesso a boards e não escolhe squad automaticamente. A organização futura do Maré por diretoria terá desenho próprio. Não criar boards nem cadastrar pessoas reais nesta entrega.

## Proposta de implementação para o Claude

- Armazenar `kanban/usuarios/{uid}/diretoria`: `digital`, `rh`, `marca` ou `tecnologia`.
- No Painel dev → Usuários, acrescentar seletor por pessoa e filtro de diretoria, usando o padrão já existente dos filtros e do seletor de torre, mas sem depender de `MARE_SO_HERING`.
- Proposta inicial: classificação pelo ADM, sem novo passo obrigatório de login. Essa forma de preenchimento é escolha de implementação proposta, não decisão explícita do Caio.
- Cadastro sem campo aparece como “Não informada”; não atribuir Digital silenciosamente nem derivar diretoria de e-mail, squad, CRM ou torre. Permitir filtrar não informadas para classificar o cadastro atual.
- Não publicar o campo em `usuarios_publicos` nesta etapa: o diretório é legível por qualquer autenticado e a tela administrativa já usa `usuarios`. Quando o Maré precisar consumir a classificação, revisar consumidores e público do campo antes de criar espelho.
- Escrita pontual: atualizar só o campo, sem regravar o cadastro inteiro e sem recriar usuário removido durante a edição. Mostrar sucesso só após confirmação; falha precisa restaurar o valor exibido. Preservar o campo nos escritores de cadastro existentes.

## Fronteira e portões (R3)

Dado novo no banco exige autoria do Claude conforme `docs/COORDENACAO_AGENTES.md`, tabela R3. A UI de ADM não basta: conferir `.write` herdada de `usuarios/$uid` e validar no servidor quem pode mudar a diretoria, inclusive criação, atualização e exclusão. O titular/PO/externo não deve conseguir modificar o campo por chamada direta se a proposta de gestão só por ADM for adotada. Atenção: `.validate` não executa na exclusão; uma validação por filho sozinha não garante restrição de remoção quando existe `.write` mais acima. Decidir a regra completa antes do código; se exigir endurecer o cadastro além do escopo, apresentar a decisão ao Caio.

Não alterar regras do Radar ou religar Microsoft/Arezzo. Não copiar o snapshot antigo de regras com Arezzo por cima das regras atuais.

## Aceite e provas esperadas

1. ADM classifica uma pessoa em cada uma das quatro opções e o valor persiste após recarga; filtro encontra cada grupo e não informadas.
2. Dado ausente ou desconhecido não vira Digital; cadastro antigo continua funcionando.
3. Trocar diretoria preserva `torre`, papel, squads, notificações e demais campos. Nenhum leitor do Radar ou roteador de avisos passa a usar `diretoria`.
4. Testes de regras com usuário fictício: ADM autorizado; membro, PO e externo recusados para edição indevida, incluindo exclusão e operações no pai. Cadastro e edição de outros campos não regridem.
5. Falha de escrita não mostra sucesso; usuário apagado não reaparece. Rever todos os escritores de `usuarios`/`usuarios_publicos` para garantir preservação do campo.
6. Teste de UI real no Painel dev, 1280/390 px e três temas; teste de console só leitura para ADM; `node scripts/checar.js` e `cd functions && npm test`.
7. Dev primeiro, bump pelo CLI, feature registrada como SÓ DEV pelo CLI, avaliação de Ajuda/dica. Regras precisam de simulador, duas revisões de modelos diferentes e advisor; se alteradas, registrar comando de deploy e resync para o Caio.

## Referências já verificadas no código

- `painel-dev.html`: `renderGlobalUsers`, `_guFiltersHtml`, `_guSetFilter`, `setGlobalUserTorre` e `GU_TORRES` são os precedentes de UI; o seletor antigo é oculto por `MARE_SO_HERING`.
- `okr-dev.html`: `_okrCheckTorrePrompt` e `_okrDefinirMinhaTorre` são da classificação antiga, não devem ser religados neste pedido.
- `kanban-dev.html`: `mostrarInscricao`/`confirmarInscricao` ainda guardam o campo de torre; não reaproveitar seu vínculo com o Radar.
- `docs/arezzo/MARE_SO_HERING.md`: inventário do desligamento, útil como histórico; conferir código atual antes de seguir instruções antigas de promoção/regras.

## Decisões do Caio e implementação (16/11/2026, Claude)

- **A própria pessoa escolhe no 1º acesso** (quem é novo: na inscrição; quem já tem cadastro: janela própria, com "Agora não" que pergunta de novo na próxima sessão). Só contas Google @ciahering; convidado/visualizador/externo não são perguntados.
- **Todo mundo que já usa começa como Digital** (pedido do Caio, mesmo dia): botão do ADM no Painel preenche quem é da Hering e está sem diretoria (externos fora; quem já tem não muda). Com isso a janela de 1º acesso só aparece pra quem ficar sem (ex.: cadastro novo que fechou a inscrição sem escolher).
- **O ADM edita no Painel → 👥 Usuários** (seletor + filtro "Não informada"). O seletor só habilita para quem as regras aceitam: `role === 'adm'` gravado ou o e-mail do Caio (a lista de e-mails de ADM do Painel não basta).
- **Etiqueta na 👥 Equipe do Maré**, de contorno neutro (diferente das pílulas de subtime) — por isso existe o espelho `usuarios_publicos/{uid}/diretoria`, que as regras só aceitam igual à fonte e que o login regrava num `update` à parte.
- Correção do desenho: `kanban/usuarios` já é legível por qualquer conta Google @ciahering; o motivo de usar um espelho é a 👥 Equipe ler `usuarios_publicos`, não privacidade.
- Resíduo aceito (teste em `functions/rules/__tests__/diretoriaRules.test.js`): o titular/PO conseguem **apagar** o campo (o `.validate` não roda na exclusão) — volta a "Não informada" e a pessoa escolhe de novo. Sem escalada enquanto a diretoria não der acesso.

Estado: implementado no dev (kanban-dev, painel-dev, `database.rules.json`); regras exigem `firebase deploy --only database`. As quatro opções e a independência do Radar foram confirmadas pelo Caio; o restante é proposta técnica para implementação/revisão do Claude.
