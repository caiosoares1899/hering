// Seed realista da apresentação do Radar: 14 Objetivos em 6 gerências (um com título enorme), Marcos em todos os status,
// riscos/indicadores longos, atingimento com histórico e tags — para auditar o deck de verdade (vazio × cheio × extremo).
const G = ['geral', 'comercial', 'performance', 'dadosia', 'cx', 'tech'];
const ST = ['nao_iniciado', 'no_prazo', 'risco', 'atrasado', 'concluido'];
const titulos = ['Fidelidade 2.0: dobrar a recompra em clientes ativos', 'Checkout em 3 passos', 'NPS acima de 70', 'Receita por canal com visão única de atribuição e margem por campanha em todas as marcas do grupo', 'Cobertura de testes', 'Base ativa no CRM', 'Reduzir tempo de resposta', 'Dashboard único de vendas', 'Migração de plataforma', 'CAC abaixo da meta', 'Automação de campanhas', 'Onboarding de lojistas', 'Qualidade dos dados', 'Plano de contingência'];
const txt = (n) => 'Item de exemplo com texto realista para medir quebra de linha e leitura na projeção número ' + n;
const objetivos = {}, marcos = {};
titulos.forEach((t, i) => {
  const id = 'o' + i;
  objetivos[id] = { id, titulo: t, areaId: G[i % G.length], torre: 'digital', trimestres: i % 4 === 0 ? ['2026-Q3', '2026-Q4'] : ['2026-Q4'], responsaveis: ['ana', 'bia', 'caio'].slice(0, 1 + (i % 3)),
    tagIds: i % 3 === 0 ? ['t1', 't2'] : (i % 3 === 1 ? ['t1'] : []), pilar: i % 2 ? 'Crescimento sustentável' : '', descricao: 'Descrição do Objetivo ' + (i + 1) + ': ' + txt(i).repeat(2),
    indicadores: [txt(1), 'Indicador curto', txt(3)], progressos: [txt(4), 'Concluímos a etapa 1'], proximosPassos: [txt(5)], riscos: i % 3 === 0 ? [txt(6), 'Dependência de fornecedor externo sem contrato fechado'] : [], planosAcao: [txt(7)], history: [],
    atingimento: i % 3 === 0 ? { tipo: 'porcentagem', inicial: 0, meta: 100, lancamentos: [{ id: 'l1', em: '2026-09-12', valor: 20 }, { id: 'l2', em: '2026-10-10', valor: 55 }, { id: 'l3', em: '2026-11-01', valor: 70 + i }] } : null };
  for (let k = 0; k < (i === 3 ? 14 : 4 + (i % 3)); k++) marcos['m' + i + '_' + k] = { id: 'm' + i + '_' + k, objetivoId: id, nome: k === 2 ? 'Marco com nome bem longo para testar quebra de linha na tabela da apresentação em tela cheia' : 'Marco ' + (k + 1), progresso: ST[(i + k) % 5], prazo: '1' + (k % 9) + '/12', descricao: k % 3 === 0 ? 'Descrição curta do marco' : '' };
});
const seed = () => ({ kanban: { okr: { objetivos, marcos, tags: { t1: { id: 't1', label: 'Estratégico', colorIdx: 0 }, t2: { id: 't2', label: 'Q4', colorIdx: 3 } }, reuniao_notas: {} },
  usuarios: { ana: { uid: 'ana', nome: 'Ana Souza', email: 'ana@ciahering.com.br', inscrito: true, init: 'AS' }, bia: { uid: 'bia', nome: 'Bia Lima', email: 'bia@ciahering.com.br', inscrito: true, init: 'BL' }, caio: { uid: 'caio', nome: 'Caio S', email: 'caio@ciahering.com.br', inscrito: true, init: 'CS' } },
  usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana Souza', init: 'AS' }, bia: { uid: 'bia', nome: 'Bia Lima', init: 'BL' }, caio: { uid: 'caio', nome: 'Caio S', init: 'CS' } }, config: { adm_emails: ['ana@ciahering.com.br'] } } });
module.exports = { seed, objetivos, marcos };
