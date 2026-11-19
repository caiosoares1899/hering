// common/__tests__/admsDestino.test.js — quem recebe os alarmes "só para ADMs" (/monitorarbugs de 19/11/2026, semana da Black Friday).
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { uidsDosAdms } = require('../admsDestino');
const { alertarAdms } = require('../../backup/vigia');

const contas = { 'rafa@ciahering.com.br': 'rafa', 'caio@ciahering.com.br': 'caio' };
const auth = { getUserByEmail: async (e) => { if (!contas[e]) { const x = new Error('no user'); x.code = 'auth/user-not-found'; throw x; } return { uid: contas[e] }; } };
const seed = () => makeFakeDb({ kanban: {
  config: { adm_emails: ['caio@ciahering.com.br', 'rafa@ciahering.com.br', 'sem-conta@ciahering.com.br'] },
  usuarios_publicos: {
    caio: { role: 'adm', email: 'caio@ciahering.com.br' },
    rafa: { role: 'membro', email: 'rafa@ciahering.com.br' },               // ADM só pela lista de e-mails
    esperto: { role: 'membro', email: 'caio@ciahering.com.br' },            // copiou o e-mail de um ADM na própria cópia pública
    po: { role: 'po', email: 'po@ciahering.com.br' },
  },
} });

test('ADM por role ou por adm_emails recebe; quem só copiou o e-mail na cópia pública, não', async () => {
  assert.deepEqual((await uidsDosAdms(seed(), { auth })).sort(), ['caio', 'rafa']);
});

test('sem Auth disponível, cai só no role (nunca no e-mail da cópia pública)', async () => {
  assert.deepEqual(await uidsDosAdms(seed(), { auth: null }), ['caio']);
});

test('vigia do backup avisa também o ADM que é ADM só pela lista de e-mails', async () => {
  const d = seed();
  const r = await alertarAdms({ db: d, auth, problemas: [{ codigo: 'x', texto: 'teste' }], hoje: '2026-11-19', agora: new Date('2026-11-19T12:00:00Z') });
  assert.equal(r.enviados, 2);
  const u = d._data().kanban.usuarios || {};
  assert.ok(u.rafa && u.rafa.notificacoes && u.rafa.notificacoes['backup_2026-11-19'], 'rafa recebeu');
  assert.equal(u.esperto, undefined, 'esperto não recebeu');
});
