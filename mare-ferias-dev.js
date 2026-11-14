/* mare-ferias-dev.js — 🏖️ Calendário geral de férias + Minhas férias (13/11/2026)
   ─────────────────────────────────────────────────────────────────────────────────────────
   Módulo compartilhado entre Maré Digital (kanban-dev.html) e Radar (okr-dev.html).
   Nó do banco: kanban/ferias(_dev)/{uid}/{id} = { ini, fim, obs?, em, por }.
   Regras (F1): leitura para todo login Google @ciahering.com.br; escrita por item para a
   própria pessoa (auth.uid === $uid) ou ADM (role === 'adm' ou caio.soares@ciahering.com.br).
   API pública (F3/F4 dependem dela):
     • MareFerias.ouvir(db, suf, cb)       → ouve kanban/ferias{suf} e devolve unsub()
     • MareFerias.ausente(quem, diaISO)    → { uid, ini, fim, obs } | null (aceita uid ou inicial)
     • MareFerias.periodoDe(quem)          → período atual ou próximo { uid, id, ini, fim, obs } | null
     • MareFerias.montar(root, opts)       → { destruir(), redesenhar() }
   v2 (revisão #1791): 🗑️ Excluir pede confirmação (uiConfirm da página).
   v3 (F4, 13/11): 🧳 Preparar minha saída — MareFerias.passagem(cfg): item a item, NADA pré-marcado, "Revisar" travado até
       tudo decidido, NADA gravado antes do ✅ final (quem grava é cfg.aplicar, da página); pronto(); sobrepoe(uid, ini, fim).
       Aviso fixo em Minhas férias: "não substitui o cadastro das férias no Senior" (pedido do Caio).
   v5 (monitorarbugs 13/11): mudança de férias de outra pessoa não redesenha o cadastro enquanto se digita (espera sair do campo).
*/
(function(){
  'use strict';

  const MES_L = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const MES_C = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const DOW = ['D','S','T','Q','Q','S','S'];
  const DIAS_PROXIMAS = 60;
  const AVISO_LONGO_DIAS = 45;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ehIso = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const pad2 = n => String(n).padStart(2, '0');
  const sufPadrao = () => /-dev\.html/.test(location.pathname) ? '_dev' : '';

  function hojeSP(){
    try{
      const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date());
      const g = k => (p.find(x => x.type === k) || {}).value || '';
      const s = g('year') + '-' + g('month') + '-' + g('day');
      if(ehIso(s)) return s;
    }catch(e){}
    const d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate());
  }

  function parseIso(s){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if(!m) return null;
    const dt = new Date(+m[1], +m[2]-1, +m[3], 12, 0, 0, 0);
    return (dt.getFullYear() === +m[1] && dt.getMonth() === +m[2]-1 && dt.getDate() === +m[3]) ? dt : null;
  }

  function addDias(s, n){
    const dt = parseIso(s); if(!dt) return '';
    dt.setDate(dt.getDate() + n);
    return dt.getFullYear() + '-' + pad2(dt.getMonth()+1) + '-' + pad2(dt.getDate());
  }

  function diasEntre(ini, fim){
    const a = parseIso(ini), b = parseIso(fim);
    if(!a || !b) return 0;
    return Math.round((b - a) / 864e5) + 1;
  }

  function br(s){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? m[3] + '/' + m[2] : '';
  }

  function brAno(s){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
  }

  function permitido(u){
    u = u || {};
    const email = String(u.email || '').toLowerCase();
    return email.endsWith('@ciahering.com.br') && (u.providerData || []).some(p => p && p.providerId === 'google.com');
  }

  function novoId(){
    return 'f_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }

  // ── Estado global compartilhado (para F2, F3 e F4) ──
  const ST = {
    dados: {},          // { [uid]: { [id]: { ini, fim, obs?, em, por } } }
    carregado: false,
    suf: null,
    db: null,
    unsubFb: null,
    subs: new Set(),
    uidDeInit: null,
  };

  function configurar(opts){
    if(opts && typeof opts.uidDeInit === 'function') ST.uidDeInit = opts.uidDeInit;
  }

  function resolverUid(quem){
    if(!quem) return '';
    const q = String(quem).trim();
    if(!q) return '';
    if(ST.dados[q]) return q;
    if(typeof ST.uidDeInit === 'function'){
      const u = ST.uidDeInit(q);
      if(u) return String(u);
    }
    return q;
  }

  function periodosDoUid(uid){
    const raw = (uid && ST.dados[uid]) || {};
    const out = [];
    for(const [id, p] of Object.entries(raw)){
      if(!p || !ehIso(p.ini) || !ehIso(p.fim) || p.fim < p.ini) continue;
      out.push({ uid, id, ini: p.ini, fim: p.fim, obs: p.obs ? String(p.obs) : '', em: p.em || 0, por: p.por || uid });
    }
    out.sort((a, b) => a.ini < b.ini ? -1 : a.ini > b.ini ? 1 : a.fim < b.fim ? -1 : 1);
    return out;
  }

  function ouvir(db, suf, cb){
    const s = (typeof suf === 'string') ? suf : sufPadrao();
    const d = db || window._db;
    if(typeof cb === 'function') ST.subs.add(cb);

    if(d && window._ref && window._onValue && (ST.db !== d || ST.suf !== s || !ST.unsubFb)){
      if(ST.unsubFb){ try{ ST.unsubFb(); }catch(e){} ST.unsubFb = null; }
      ST.db = d; ST.suf = s;
      const r = window._ref(d, 'kanban/ferias' + s);
      ST.unsubFb = window._onValue(r, snap => {
        ST.dados = (snap && typeof snap.val === 'function' ? snap.val() : snap) || {};
        ST.carregado = true;
        ST.subs.forEach(fn => { try{ fn(ST.dados); }catch(e){} });
      }, () => {
        ST.carregado = true;
        ST.subs.forEach(fn => { try{ fn(ST.dados); }catch(e){} });
      });
    } else if(ST.carregado && typeof cb === 'function'){
      try{ cb(ST.dados); }catch(e){}
    }

    return () => {
      if(typeof cb === 'function') ST.subs.delete(cb);
    };
  }

  function ausente(quem, diaISO){
    const uid = resolverUid(quem);
    if(!uid) return null;
    const dia = ehIso(diaISO) ? diaISO : hojeSP();
    const list = periodosDoUid(uid);
    const hit = list.find(p => p.ini <= dia && dia <= p.fim);
    return hit ? { uid: hit.uid, ini: hit.ini, fim: hit.fim, obs: hit.obs } : null;
  }

  function periodoDe(quem){
    const uid = resolverUid(quem);
    if(!uid) return null;
    const hoje = hojeSP();
    const list = periodosDoUid(uid).filter(p => p.fim >= hoje);
    if(!list.length) return null;
    const atual = list.find(p => p.ini <= hoje && hoje <= p.fim);
    const p = atual || list[0];
    return { uid: p.uid, id: p.id, ini: p.ini, fim: p.fim, obs: p.obs };
  }

  // ── CSS injetado uma única vez ──
  function injetarCss(){
    if(document.getElementById('mare-ferias-css')) return;
    const st = document.createElement('style');
    st.id = 'mare-ferias-css';
    st.textContent = `
.mfer{display:flex;flex-direction:column;gap:14px;color:var(--txt);font-family:inherit;min-width:0;}
.mfer *{box-sizing:border-box;}
.mfer-top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;background:var(--glass);border:1px solid var(--glass-b);border-radius:14px;padding:10px 12px;}
.mfer-nav{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.mfer-mes-lbl{font-size:14px;font-weight:700;min-width:130px;text-align:center;color:var(--txt);}
.mfer-filtros{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
.mfer-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:6px 11px;border-radius:9px;border:1px solid var(--glass-b);background:rgba(var(--ink-rgb),.06);color:var(--txt);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .15s,border-color .15s;}
.mfer-btn:hover:not(:disabled){border-color:var(--accent);background:rgba(var(--ink-rgb),.12);}
.mfer-btn.on,.mfer-btn.prim{background:var(--accent);border-color:var(--accent);color:#031c2e;}
.mfer-btn.danger{color:var(--danger);border-color:rgba(255,95,109,.35);}
.mfer-btn.danger:hover:not(:disabled){background:rgba(255,95,109,.15);border-color:var(--danger);}
.mfer-btn:disabled{opacity:.48;cursor:not-allowed;}
.mfer-inp,.mfer-sel{padding:6px 10px;border-radius:9px;border:1px solid var(--glass-b);background:rgba(var(--ink-rgb),.06);color:var(--txt);font-size:12px;font-family:inherit;outline:none;min-width:0;}
.mfer-inp:focus,.mfer-sel:focus{border-color:var(--accent);}
.mfer-grid-2{display:grid;grid-template-columns:1.6fr 1fr;gap:14px;align-items:start;}
.mfer-card{background:var(--glass);border:1px solid var(--glass-b);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px;min-width:0;}
.mfer-card-hd{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;}
.mfer-card-tt{font-size:13.5px;font-weight:700;color:var(--txt);margin:0;display:flex;align-items:center;gap:6px;}
.mfer-sub{font-size:11.5px;color:var(--txt3);margin:0;}
.mfer-strips{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.mfer-lista{display:flex;flex-direction:column;gap:6px;}
.mfer-item{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-radius:10px;background:rgba(var(--ink-rgb),.05);border:1px solid var(--glass-b);font-size:12px;min-width:0;}
.mfer-item-info{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;}
.mfer-item-nm{font-weight:700;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.mfer-item-dt{font-size:11.5px;color:var(--teal);font-weight:600;}
.mfer-item-obs{font-size:11px;color:var(--txt2);overflow-wrap:anywhere;}
.mfer-item-acts{display:flex;gap:4px;flex-shrink:0;}
.mfer-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--glass-b);border-radius:12px;background:rgba(var(--ink-rgb),.03);}
.mfer-canvas{min-width:740px;display:flex;flex-direction:column;}
.mfer-row{display:grid;grid-template-columns:170px 1fr;border-bottom:1px solid var(--glass-b);align-items:stretch;}
.mfer-row:last-child{border-bottom:0;}
.mfer-hd{background:rgba(var(--ink-rgb),.06);font-size:10.5px;font-weight:700;color:var(--txt2);}
.mfer-sticky{position:sticky;left:0;z-index:2;background:var(--glass);backdrop-filter:blur(8px);padding:6px 10px;border-right:1px solid var(--glass-b);display:flex;align-items:center;gap:6px;min-width:0;}
.mfer-sticky-nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600;}
.mfer-track{display:grid;position:relative;min-height:34px;}
.mfer-dhd{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4px 0;border-right:1px solid rgba(var(--ink-rgb),.06);font-size:10px;line-height:1.15;}
.mfer-dhd.is-wknd{background:rgba(var(--ink-rgb),.04);color:var(--txt3);}
.mfer-dhd.is-hoje{background:rgba(29,233,182,.16);color:var(--teal);font-weight:800;}
.mfer-cell{border-right:1px solid rgba(var(--ink-rgb),.04);min-height:34px;}
.mfer-cell.is-wknd{background:rgba(var(--ink-rgb),.03);}
.mfer-cell.is-hoje{background:rgba(29,233,182,.08);}
.mfer-bar{grid-row:1;align-self:center;z-index:1;margin:4px 2px;padding:3px 7px;border-radius:999px;background:linear-gradient(90deg,rgba(29,233,182,.26),rgba(56,182,255,.26));border:1px solid rgba(29,233,182,.55);color:var(--txt);font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;text-align:left;}
.mfer-bar:hover{border-color:var(--accent);filter:brightness(1.08);}
.mfer-bar.is-hoje{background:linear-gradient(90deg,rgba(29,233,182,.4),rgba(56,182,255,.35));border-color:var(--teal);}
.mfer-form{display:flex;flex-direction:column;gap:8px;}
.mfer-form-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.mfer-lbl{display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:600;color:var(--txt2);}
.mfer-msg{font-size:11.5px;padding:7px 10px;border-radius:8px;line-height:1.35;}
.mfer-msg.err{background:rgba(255,95,109,.15);border:1px solid rgba(255,95,109,.4);color:var(--danger);}
.mfer-msg.senior{background:rgba(255,209,102,.12);border:1px solid rgba(255,209,102,.45);color:var(--txt);}
.mfer-msg.warn{background:rgba(255,209,102,.15);border:1px solid rgba(255,209,102,.4);color:var(--warn);}
.mfer-msg.ok{background:rgba(29,233,182,.15);border:1px solid rgba(29,233,182,.4);color:var(--teal);}
.mfer-det{font-size:11.5px;color:var(--txt2);min-height:16px;}
.mfer-empty{font-size:12px;color:var(--txt3);padding:8px 2px;}
[data-theme="light"] .mfer-btn.on,[data-theme="light"] .mfer-btn.prim{color:#fff;}
[data-theme="light"] .mfer-bar{background:linear-gradient(90deg,rgba(5,95,89,.14),rgba(0,95,138,.14));border-color:rgba(5,95,89,.45);color:var(--txt);}
[data-theme="vice"] .mfer-btn.on,[data-theme="vice"] .mfer-btn.prim{color:#1a0b2e;}

.mfer-pass-ov{position:fixed;inset:0;z-index:99990;background:rgba(1,8,16,.72);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;}
.mfer-pass{width:min(680px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:rgb(var(--surface-rgb,var(--slate-rgb,10,30,55)));border:1px solid var(--glass-b);border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:12px;color:var(--txt);box-shadow:0 20px 60px rgba(0,0,0,.5);}
.mfer-pass-hd{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.mfer-pass-hd h3{margin:0;font-size:15px;font-weight:800;}
.mfer-pass-lista{display:flex;flex-direction:column;gap:6px;}
.mfer-pass-it{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border-radius:12px;border:1px solid var(--glass-b);background:rgba(var(--ink-rgb),.05);flex-wrap:wrap;}
.mfer-pass-it.ok{border-color:rgba(29,233,182,.45);}
.mfer-pass-acts{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
.mfer-pass-links{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
.mfer-pass-ft{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap;position:sticky;bottom:-16px;background:inherit;padding:8px 0 0;}
.mfer-pass-ft .mfer-sub{margin-right:auto;}
a.mfer-btn{text-decoration:none;}
@media (max-width:768px){ .mfer-pass-ov{padding:8px;align-items:flex-end;} .mfer-pass{max-height:calc(100dvh - 16px);border-radius:18px 18px 12px 12px;} .mfer-pass-acts{width:100%;} .mfer-pass-acts .mfer-sel{flex:1 1 100%;} }
@media (max-width:960px){
  .mfer-grid-2{grid-template-columns:1fr;}
  .mfer-strips{grid-template-columns:1fr;}
}
@media (max-width:768px){
  .mfer-btn,.mfer-inp,.mfer-sel{min-height:44px;font-size:13px;}
  .mfer-form-row{grid-template-columns:1fr;}
  .mfer-row{grid-template-columns:130px 1fr;}
}
`;
    document.head.appendChild(st);
  }

  // ── Montagem da UI compartilhada ──
  function montar(root, opts){
    if(!root) return { destruir(){}, redesenhar(){} };
    opts = opts || {};
    injetarCss();
    configurar(opts);

    const suf = typeof opts.suf === 'string' ? opts.suf : sufPadrao();
    const db = opts.db || window._db;
    const hojeInicial = hojeSP();
    const dtHoje = parseIso(hojeInicial) || new Date();

    const S = {
      ano: dtHoje.getFullYear(),
      mes: dtHoje.getMonth(), // 0..11
      filtroPessoa: '',
      filtroSquad: '',
      filtroPeriodo: 'todos', // todos | agora | proximas | mes
      todoDigital: opts.padraoTodasSquads !== undefined ? !!opts.padraoTodasSquads : true,
      editUid: '',
      editId: '',
      formIni: '',
      formFim: '',
      formObs: '',
      formAlvoUid: opts.uid || '',
      msg: null, // { tipo: 'err'|'warn'|'ok', txt }
      det: '',
      salvando: false,
    };

    const ehAdm = () => typeof opts.isAdm === 'function' ? !!opts.isAdm() : !!opts.isAdm;
    const nomeDe = uid => (typeof opts.nomeDe === 'function' ? opts.nomeDe(uid) : '') || uid;
    const squadsDe = uid => (typeof opts.squadsDe === 'function' ? opts.squadsDe(uid) : []) || [];
    const squadNome = id => (typeof opts.squadNome === 'function' ? opts.squadNome(id) : '') || id;
    const minhasSquads = () => (typeof opts.minhasSquads === 'function' ? opts.minhasSquads() : opts.minhasSquads) || [];

    async function salvarFirebase(uid, id, val){
      if(val === null){
        if(typeof opts.apagar === 'function') return opts.apagar(uid, id);
        return window._set(window._ref(db, 'kanban/ferias' + suf + '/' + uid + '/' + id), null);
      }
      if(typeof opts.gravar === 'function') return opts.gravar(uid, id, val);
      return window._set(window._ref(db, 'kanban/ferias' + suf + '/' + uid + '/' + id), val);
    }

    function todasPessoas(){
      const mapa = new Map();
      const lista = Array.isArray(opts.pessoas) ? opts.pessoas : [];
      lista.forEach(p => { if(p && p.uid) mapa.set(p.uid, { uid: p.uid, nome: p.nome || nomeDe(p.uid), squads: p.squads || squadsDe(p.uid) }); });
      Object.keys(ST.dados || {}).forEach(uid => {
        if(!mapa.has(uid)) mapa.set(uid, { uid, nome: nomeDe(uid), squads: squadsDe(uid) });
      });
      if(opts.uid && !mapa.has(opts.uid)) mapa.set(opts.uid, { uid: opts.uid, nome: nomeDe(opts.uid), squads: squadsDe(opts.uid) });
      return Array.from(mapa.values()).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    }

    function squadsDisponiveis(pessoas){
      const set = new Set();
      pessoas.forEach(p => (p.squads || []).forEach(s => set.add(s)));
      minhasSquads().forEach(s => set.add(s));
      return Array.from(set).sort((a, b) => String(squadNome(a)).localeCompare(String(squadNome(b)), 'pt-BR'));
    }

    function pessoaVisivel(p){
      if(S.filtroPessoa){
        const q = S.filtroPessoa.toLowerCase();
        if(!String(p.nome || '').toLowerCase().includes(q) && !String(p.uid).toLowerCase().includes(q)) return false;
      }
      if(S.filtroSquad){
        if(!(p.squads || []).includes(S.filtroSquad)) return false;
      } else if(!S.todoDigital){
        const min = minhasSquads();
        if(min.length && !(p.squads || []).some(s => min.includes(s)) && p.uid !== opts.uid) return false;
      }
      return true;
    }

    function periodoPassaFiltro(p, hoje, proxFim, mesIni, mesFim){
      if(S.filtroPeriodo === 'agora') return p.ini <= hoje && hoje <= p.fim;
      if(S.filtroPeriodo === 'proximas') return p.ini > hoje && p.ini <= proxFim;
      if(S.filtroPeriodo === 'mes') return p.ini <= mesFim && p.fim >= mesIni;
      return true;
    }

    function iniciarEdicao(uid, id){
      const p = periodosDoUid(uid).find(x => x.id === id);
      if(!p) return;
      S.editUid = uid;
      S.editId = id;
      S.formAlvoUid = uid;
      S.formIni = p.ini;
      S.formFim = p.fim;
      S.formObs = p.obs || '';
      S.msg = null;
      desenhar();
      const el = root.querySelector('.mfer-inp[data-f="ini"]');
      if(el) el.focus({ preventScroll: true });
    }

    function limparForm(){
      S.editUid = '';
      S.editId = '';
      S.formAlvoUid = opts.uid || '';
      S.formIni = '';
      S.formFim = '';
      S.formObs = '';
    }

    async function enviarForm(){
      if(S.salvando) return;
      const iniEl = root.querySelector('.mfer-inp[data-f="ini"]');
      const fimEl = root.querySelector('.mfer-inp[data-f="fim"]');
      const obsEl = root.querySelector('.mfer-inp[data-f="obs"]');
      const alvoEl = root.querySelector('.mfer-sel[data-f="alvo"]');
      S.formIni = (iniEl ? iniEl.value : S.formIni).trim();
      S.formFim = (fimEl ? fimEl.value : S.formFim).trim();
      S.formObs = (obsEl ? obsEl.value : S.formObs).trim();
      const alvoUid = ehAdm() && alvoEl && alvoEl.value ? alvoEl.value : (S.editUid || opts.uid);
      S.formAlvoUid = alvoUid;

      if(!alvoUid){
        S.msg = { tipo: 'err', txt: 'Selecione a pessoa.' };
        desenhar(); return;
      }
      if(alvoUid !== opts.uid && !ehAdm()){
        S.msg = { tipo: 'err', txt: 'Só você ou um ADM podem alterar estas férias.' };
        desenhar(); return;
      }
      if(!ehIso(S.formIni) || !ehIso(S.formFim)){
        S.msg = { tipo: 'err', txt: 'Informe as datas de início e fim.' };
        desenhar(); return;
      }
      if(S.formFim < S.formIni){
        S.msg = { tipo: 'err', txt: 'A data de fim não pode ser anterior à data de início.' };
        desenhar(); return;
      }
      if(S.formObs.length > 140){
        S.msg = { tipo: 'err', txt: 'Observação deve ter até 140 caracteres.' };
        desenhar(); return;
      }

      const dur = diasEntre(S.formIni, S.formFim);
      const avisoLongo = dur > AVISO_LONGO_DIAS;
      const id = (S.editId && S.editUid === alvoUid) ? S.editId : novoId();
      const payload = { ini: S.formIni, fim: S.formFim, em: Date.now(), por: opts.uid };
      if(S.formObs) payload.obs = S.formObs;

      S.salvando = true;
      S.msg = null;
      desenhar();
      try{
        await salvarFirebase(alvoUid, id, payload);
        if(!ST.dados[alvoUid]) ST.dados[alvoUid] = {};
        ST.dados[alvoUid][id] = payload;
        limparForm();
        S.msg = avisoLongo
          ? { tipo: 'warn', txt: 'Salvo! ⚠ Período com ' + dur + ' dias (acima de ' + AVISO_LONGO_DIAS + ' dias) — confira se as datas estão certas.' }
          : { tipo: 'ok', txt: 'Férias salvas!' };
      }catch(err){
        S.msg = { tipo: 'err', txt: 'Não foi possível salvar agora (' + (err && err.message ? err.message : 'erro') + ').' };
      }finally{
        S.salvando = false;
        desenhar();
      }
    }

    async function excluirPeriodo(uid, id){
      if(uid !== opts.uid && !ehAdm()) return;
      const p = periodosDoUid(uid).find(x => x.id === id);
      const quem = uid === opts.uid ? 'suas férias' : 'as férias de ' + nomeDe(uid);
      const msg = 'Excluir ' + quem + (p ? ' (' + brAno(p.ini) + ' a ' + brAno(p.fim) + ')' : '') + '?';
      // uiConfirm das páginas escapa a mensagem (nome é texto de outra pessoa); sem ele, o confirm nativo
      const ok = typeof window.uiConfirm === 'function' ? await window.uiConfirm(msg, { danger: true, okText: 'Excluir' }) : window.confirm(msg);
      if(!ok) return;
      try{
        await salvarFirebase(uid, id, null);
        if(ST.dados[uid]) delete ST.dados[uid][id];
        if(S.editUid === uid && S.editId === id) limparForm();
        S.msg = { tipo: 'ok', txt: 'Período excluído.' };
      }catch(err){
        S.msg = { tipo: 'err', txt: 'Não foi possível excluir (' + (err && err.message ? err.message : 'erro') + ').' };
      }
      desenhar();
    }

    function renderItemLista(p, mostrarNome){
      const pode = (p.uid === opts.uid) || ehAdm();
      const dur = diasEntre(p.ini, p.fim);
      return '<div class="mfer-item">'
        + '<div class="mfer-item-info">'
          + (mostrarNome ? '<div class="mfer-item-nm">' + esc(nomeDe(p.uid)) + '</div>' : '')
          + '<div class="mfer-item-dt">' + esc(brAno(p.ini) + ' – ' + brAno(p.fim)) + ' · ' + dur + 'd</div>'
          + (p.obs ? '<div class="mfer-item-obs">' + esc(p.obs) + '</div>' : '')
        + '</div>'
        + (pode ? '<div class="mfer-item-acts">'
            + '<button type="button" class="mfer-btn" data-act="edit" data-uid="' + esc(p.uid) + '" data-id="' + esc(p.id) + '" title="Editar período">✏️</button>'
            + '<button type="button" class="mfer-btn danger" data-act="del" data-uid="' + esc(p.uid) + '" data-id="' + esc(p.id) + '" title="Excluir período">🗑️</button>'
          + '</div>' : '')
      + '</div>';
    }

    function desenhar(){
      if(!root.isConnected) return;
      const hoje = hojeSP();
      const proxFim = addDias(hoje, DIAS_PROXIMAS);
      const diasMes = new Date(S.ano, S.mes + 1, 0).getDate();
      const mesIni = S.ano + '-' + pad2(S.mes + 1) + '-01';
      const mesFim = S.ano + '-' + pad2(S.mes + 1) + '-' + pad2(diasMes);

      const pessoas = todasPessoas();
      const sqList = squadsDisponiveis(pessoas);
      const visiveis = pessoas.filter(pessoaVisivel);

      const todosPeriodosVisiveis = [];
      visiveis.forEach(ps => {
        periodosDoUid(ps.uid).forEach(p => {
          if(periodoPassaFiltro(p, hoje, proxFim, mesIni, mesFim)) todosPeriodosVisiveis.push(p);
        });
      });

      const foraAgora = todosPeriodosVisiveis.filter(p => p.ini <= hoje && hoje <= p.fim);
      const proximas = todosPeriodosVisiveis.filter(p => p.ini > hoje && p.ini <= proxFim);

      // Pessoas que têm ao menos 1 período no mês selecionado (respeitando filtros)
      const linhasMes = [];
      visiveis.forEach(ps => {
        const doMes = periodosDoUid(ps.uid).filter(p => p.ini <= mesFim && p.fim >= mesIni && periodoPassaFiltro(p, hoje, proxFim, mesIni, mesFim));
        if(doMes.length) linhasMes.push({ pessoa: ps, periodos: doMes });
      });

      const dias = [];
      for(let d = 1; d <= diasMes; d++){
        const dt = new Date(S.ano, S.mes, d, 12);
        const ds = S.ano + '-' + pad2(S.mes + 1) + '-' + pad2(d);
        dias.push({ d, w: dt.getDay(), iso: ds });
      }

      const minhas = opts.uid ? periodosDoUid(opts.uid) : [];
      const adm = ehAdm();
      const temMinhasSquads = minhasSquads().length > 0;
      const scrollAntes = root.querySelector('.mfer-scroll')?.scrollLeft || 0;

      root.innerHTML =
        '<div class="mfer">'
          + '<div class="mfer-top">'
            + '<div class="mfer-nav">'
              + '<button type="button" class="mfer-btn" data-nav="-1" aria-label="Mês anterior">◀</button>'
              + '<div class="mfer-mes-lbl">' + esc(MES_L[S.mes] + ' ' + S.ano) + '</div>'
              + '<button type="button" class="mfer-btn" data-nav="1" aria-label="Próximo mês">▶</button>'
              + '<button type="button" class="mfer-btn" data-nav="0">Hoje</button>'
            + '</div>'
            + '<div class="mfer-filtros">'
              + '<input type="search" class="mfer-inp" data-filtro="pessoa" value="' + esc(S.filtroPessoa) + '" placeholder="🔍 Filtrar pessoa..." aria-label="Filtrar pessoa">'
              + (sqList.length ? '<select class="mfer-sel" data-filtro="squad" aria-label="Filtrar por squad"><option value="">Todas as squads</option>'
                  + sqList.map(sq => '<option value="' + esc(sq) + '"' + (S.filtroSquad === sq ? ' selected' : '') + '>' + esc(squadNome(sq)) + '</option>').join('')
                  + '</select>' : '')
              + '<select class="mfer-sel" data-filtro="periodo" aria-label="Filtrar por período">'
                  + '<option value="todos"' + (S.filtroPeriodo === 'todos' ? ' selected' : '') + '>Todos os períodos</option>'
                  + '<option value="agora"' + (S.filtroPeriodo === 'agora' ? ' selected' : '') + '>🏖️ Fora agora</option>'
                  + '<option value="proximas"' + (S.filtroPeriodo === 'proximas' ? ' selected' : '') + '>📆 Próximas (60d)</option>'
                  + '<option value="mes"' + (S.filtroPeriodo === 'mes' ? ' selected' : '') + '>📅 Neste mês</option>'
                + '</select>'
              + (temMinhasSquads ? '<button type="button" class="mfer-btn' + (S.todoDigital ? ' on' : '') + '" data-act="todo-digital" aria-pressed="' + S.todoDigital + '" title="Mostrar pessoas de todas as squads do Digital">🌐 Todo o Digital</button>' : '')
            + '</div>'
          + '</div>'

          + '<div class="mfer-grid-2">'
            + '<div style="display:flex;flex-direction:column;gap:14px;min-width:0;">'
              + '<div class="mfer-strips">'
                + '<div class="mfer-card">'
                  + '<div class="mfer-card-hd"><h3 class="mfer-card-tt">🏖️ Fora agora</h3><span class="mfer-sub">' + foraAgora.length + '</span></div>'
                  + (foraAgora.length ? '<div class="mfer-lista">' + foraAgora.map(p => renderItemLista(p, true)).join('') + '</div>'
                      : '<div class="mfer-empty">Ninguém de férias hoje (horário de São Paulo).</div>')
                + '</div>'
                + '<div class="mfer-card">'
                  + '<div class="mfer-card-hd"><h3 class="mfer-card-tt">📆 Próximas (60 dias)</h3><span class="mfer-sub">' + proximas.length + '</span></div>'
                  + (proximas.length ? '<div class="mfer-lista">' + proximas.map(p => renderItemLista(p, true)).join('') + '</div>'
                      : '<div class="mfer-empty">Nenhuma saída programada nos próximos 60 dias.</div>')
                + '</div>'
              + '</div>'

              + '<div class="mfer-card">'
                + '<div class="mfer-card-hd"><h3 class="mfer-card-tt">📅 Faixas do mês · ' + esc(MES_C[S.mes] + '/' + S.ano) + '</h3><span class="mfer-sub">' + linhasMes.length + ' pessoa(s)</span></div>'
                + (linhasMes.length
                  ? '<div class="mfer-scroll" tabindex="0" aria-label="Grade mensal de férias"><div class="mfer-canvas">'
                      + '<div class="mfer-row mfer-hd"><div class="mfer-sticky">Pessoa</div><div class="mfer-track" style="grid-template-columns:repeat(' + diasMes + ',minmax(20px,1fr));">'
                        + dias.map(x => '<div class="mfer-dhd' + (x.w === 0 || x.w === 6 ? ' is-wknd' : '') + (x.iso === hoje ? ' is-hoje' : '') + '"><span>' + DOW[x.w] + '</span><b>' + x.d + '</b></div>').join('')
                      + '</div></div>'
                      + linhasMes.map(row => {
                          return '<div class="mfer-row"><div class="mfer-sticky"><span class="mfer-sticky-nm" title="' + esc(row.pessoa.nome) + '">' + esc(row.pessoa.nome) + '</span></div>'
                            + '<div class="mfer-track" style="grid-template-columns:repeat(' + diasMes + ',minmax(20px,1fr));">'
                              + dias.map((x, idx) => '<div class="mfer-cell' + (x.w === 0 || x.w === 6 ? ' is-wknd' : '') + (x.iso === hoje ? ' is-hoje' : '') + '" style="grid-row:1;grid-column:' + (idx + 1) + ';"></div>').join('')
                              + row.periodos.map(p => {
                                  const iniClip = p.ini < mesIni ? mesIni : p.ini;
                                  const fimClip = p.fim > mesFim ? mesFim : p.fim;
                                  const cIni = parseInt(iniClip.slice(8, 10), 10);
                                  const cFim = parseInt(fimClip.slice(8, 10), 10);
                                  const lbl = br(p.ini) + '–' + br(p.fim) + (p.obs ? ' · ' + p.obs : '');
                                  const ehHoje = p.ini <= hoje && hoje <= p.fim;
                                  return '<button type="button" class="mfer-bar' + (ehHoje ? ' is-hoje' : '') + '" data-det="' + esc(row.pessoa.nome + ' · ' + brAno(p.ini) + ' a ' + brAno(p.fim) + (p.obs ? ' · ' + p.obs : '')) + '" style="grid-column:' + cIni + '/' + (cFim + 1) + ';" title="' + esc(lbl) + '">' + esc(lbl) + '</button>';
                                }).join('')
                            + '</div></div>';
                        }).join('')
                    + '</div></div>'
                  : '<div class="mfer-empty">Nenhuma férias registrada em ' + esc(MES_L[S.mes] + ' de ' + S.ano) + ' para os filtros atuais.</div>')
                + '<div class="mfer-det" role="status" aria-live="polite">' + esc(S.det) + '</div>'
              + '</div>'
            + '</div>'

            + '<div class="mfer-card">'
              + '<div class="mfer-card-hd">'
                + '<h3 class="mfer-card-tt">🧳 Minhas férias</h3>'
                + (function(){
                    const per = opts.uid ? periodoDe(opts.uid) : null;
                    const pode = typeof opts.prepararSaida === 'function';
                    if(!pode) return '';
                    return per
                      ? '<button type="button" class="mfer-btn prim" data-act="saida" title="Decida, item a item, o que passar para outra pessoa antes das suas férias (' + esc(brAno(per.ini) + ' a ' + brAno(per.fim)) + ')">🧳 Preparar minha saída</button>'
                      : '<button type="button" class="mfer-btn" disabled title="Cadastre suas férias abaixo para preparar a saída">🧳 Preparar minha saída</button>';
                  })()
              + '</div>'
              + '<p class="mfer-sub">' + (adm ? 'Você é ADM: pode cadastrar, editar ou excluir férias de qualquer pessoa.' : 'Cadastre, edite ou exclua seus períodos de férias.') + '</p>'
              // ⚠️ pedido do Caio (13/11): este cadastro é só para o time se organizar — NÃO é a solicitação oficial de férias
              + '<div class="mfer-msg senior mfer-senior" role="note">⚠️ <b>Este cadastro não substitui o das férias no Senior.</b> Ele serve só para o time se organizar; a solicitação oficial continua sendo feita no Senior.</div>'
              + '<div class="mfer-form">'
                + (adm ? '<label class="mfer-lbl">Pessoa<select class="mfer-sel" data-f="alvo">'
                    + pessoas.map(p => '<option value="' + esc(p.uid) + '"' + ((S.formAlvoUid || opts.uid) === p.uid ? ' selected' : '') + '>' + esc(p.nome) + (p.uid === opts.uid ? ' (você)' : '') + '</option>').join('')
                  + '</select></label>' : '')
                + '<div class="mfer-form-row">'
                  + '<label class="mfer-lbl">Início<input type="date" class="mfer-inp" data-f="ini" value="' + esc(S.formIni) + '"></label>'
                  + '<label class="mfer-lbl">Fim<input type="date" class="mfer-inp" data-f="fim" value="' + esc(S.formFim) + '"></label>'
                + '</div>'
                + '<label class="mfer-lbl">Observação (opcional, até 140)<input type="text" class="mfer-inp" data-f="obs" maxlength="140" value="' + esc(S.formObs) + '" placeholder="ex.: cobertura: Ana, meio período"></label>'
                + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
                  + '<button type="button" class="mfer-btn prim" data-act="salvar"' + (S.salvando ? ' disabled' : '') + '>' + (S.editId ? '💾 Salvar edição' : '➕ Adicionar férias') + '</button>'
                  + (S.editId ? '<button type="button" class="mfer-btn" data-act="cancelar">Cancelar</button>' : '')
                + '</div>'
                + (S.msg ? '<div class="mfer-msg ' + S.msg.tipo + '" role="alert">' + esc(S.msg.txt) + '</div>' : '')
              + '</div>'
              + '<div class="mfer-card-hd" style="margin-top:4px;"><h4 class="mfer-card-tt" style="font-size:12.5px;">Meus períodos</h4><span class="mfer-sub">' + minhas.length + '</span></div>'
              + (minhas.length ? '<div class="mfer-lista">' + minhas.map(p => renderItemLista(p, false)).join('') + '</div>'
                  : '<div class="mfer-empty">Você ainda não tem férias cadastradas.</div>')
            + '</div>'
          + '</div>'
        + '</div>';

      const sc = root.querySelector('.mfer-scroll');
      if(sc && scrollAntes) sc.scrollLeft = scrollAntes;
    }

    function onClick(ev){
      const t = ev.target.closest('button');
      if(!t || !root.contains(t)) return;
      if(t.dataset.nav != null){
        const n = +t.dataset.nav;
        if(n === 0){
          const d = parseIso(hojeSP()) || new Date();
          S.ano = d.getFullYear(); S.mes = d.getMonth();
        } else {
          const d = new Date(S.ano, S.mes + n, 1);
          S.ano = d.getFullYear(); S.mes = d.getMonth();
        }
        S.det = '';
        desenhar();
        return;
      }
      if(t.dataset.det){ S.det = t.dataset.det; const d = root.querySelector('.mfer-det'); if(d) d.textContent = S.det; return; }
      const act = t.dataset.act;
      if(act === 'todo-digital'){ S.todoDigital = !S.todoDigital; desenhar(); return; }
      if(act === 'salvar'){ enviarForm(); return; }
      if(act === 'cancelar'){ limparForm(); S.msg = null; desenhar(); return; }
      if(act === 'edit'){ iniciarEdicao(t.dataset.uid, t.dataset.id); return; }
      if(act === 'del'){ excluirPeriodo(t.dataset.uid, t.dataset.id); return; }
      if(act === 'saida'){ if(typeof opts.prepararSaida === 'function') opts.prepararSaida(); return; }
    }

    function onInput(ev){
      const t = ev.target;
      if(t.dataset.filtro === 'pessoa'){
        S.filtroPessoa = t.value;
        const pos = t.selectionStart;
        desenhar();
        const inp = root.querySelector('.mfer-inp[data-filtro="pessoa"]');
        if(inp){ inp.focus({ preventScroll: true }); try{ inp.setSelectionRange(pos, pos); }catch(e){} }
      }
      if(t.dataset.f === 'ini') S.formIni = t.value;
      if(t.dataset.f === 'fim') S.formFim = t.value;
      if(t.dataset.f === 'obs') S.formObs = t.value;
    }

    function onChange(ev){
      const t = ev.target;
      if(t.dataset.filtro === 'squad'){ S.filtroSquad = t.value; desenhar(); }
      else if(t.dataset.filtro === 'periodo'){ S.filtroPeriodo = t.value; desenhar(); }
      else if(t.dataset.f === 'alvo'){ S.formAlvoUid = t.value; }
    }

    // Mudança nas férias de OUTRA pessoa chegando enquanto se digita no cadastro: redesenhar trocaria o campo (perde foco/cursor).
    // Espera sair do campo e então redesenha (monitorarbugs 13/11).
    let redesenhoPendente = false;
    const digitando = () => { const a = document.activeElement; return !!(a && root.contains(a) && a.closest('.mfer-form') && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)); };
    function aoMudarDados(){ if(digitando()){ redesenhoPendente = true; return; } desenhar(); }
    function onFocusOut(){ setTimeout(() => { if(redesenhoPendente && !digitando()){ redesenhoPendente = false; desenhar(); } }, 0); }
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    root.addEventListener('focusout', onFocusOut);
    const unsub = ouvir(db, suf, aoMudarDados);
    desenhar();

    return {
      redesenhar: () => desenhar(),
      destruir: () => {
        unsub();
        root.removeEventListener('click', onClick);
        root.removeEventListener('input', onInput);
        root.removeEventListener('change', onChange);
        root.removeEventListener('focusout', onFocusOut);
        root.innerHTML = '';
      },
    };
  }

  // ── 🧳 Preparar minha saída (F4) ───────────────────────────────────────────────────────────────────────────────────
  // A tela é do módulo; QUEM GRAVA é a página (cfg.aplicar), que conhece o formato dos seus dados (card × Objetivo/Marco).
  // cfg = { titulo, periodo:{ini,fim}, itens:[{key,titulo,sub}], pessoas:[{id,nome,uid}], vazio, links:[{texto,href}],
  //         nota, aplicar: async (decisoes:[{key,acao:'passar'|'manter',para}]) => [{key, ok, erro}] }
  // Regras de tela: nenhum item pré-marcado; "Revisar" só com tudo decidido (e cada "passar" com pessoa); "Manter todos
  // os restantes" só PREENCHE escolhas; fechar/cancelar não grava nada; só o "✅ Confirmar e aplicar" chama cfg.aplicar.
  function sobrepoe(uid, ini, fim){
    if(!uid || !ehIso(ini) || !ehIso(fim)) return null;
    return periodosDoUid(uid).find(p => p.ini <= fim && p.fim >= ini) || null;
  }
  const hrefSeguro = h => typeof h === 'string' && /^\/?([\w.-]+\/)*[\w.-]+\.html(\?[\w=&%.\-]*)?$|^\?[\w=&%.\-]*$/.test(h);

  function passagem(cfg){
    cfg = cfg || {};
    injetarCss();
    document.getElementById('mfer-pass-ov')?.remove();
    const itens = Array.isArray(cfg.itens) ? cfg.itens.filter(x => x && x.key) : [];
    const pessoas = (Array.isArray(cfg.pessoas) ? cfg.pessoas : []).filter(x => x && x.id);
    const per = cfg.periodo || {};
    const dec = {};   // key → { acao:'manter'|'passar', para }
    let etapa = 'lista', resultado = [];
    const origemFoco = document.activeElement;
    const ov = document.createElement('div');
    ov.id = 'mfer-pass-ov'; ov.className = 'mfer-pass-ov';
    ov.innerHTML = '<div class="mfer-pass" role="dialog" aria-modal="true" aria-labelledby="mfer-pass-tt"></div>';
    const box = ov.firstChild;
    const nomeP = id => (pessoas.find(x => x.id === id) || {}).nome || id;
    const decidido = k => { const d = dec[k]; return !!d && (d.acao === 'manter' || (d.acao === 'passar' && !!d.para)); };
    const nDec = () => itens.filter(x => decidido(x.key)).length;
    const linksHtml = () => (cfg.links || []).filter(l => l && hrefSeguro(l.href)).map(l => '<a class="mfer-btn" href="' + esc(l.href) + '">' + esc(l.texto) + '</a>').join('');
    function opcoesPessoa(sel){
      return '<option value="">Escolha a pessoa…</option>' + pessoas.map(ps => {
        const fora = (per.ini && ps.uid) ? sobrepoe(ps.uid, per.ini, per.fim) : null;
        return '<option value="' + esc(ps.id) + '"' + (sel === ps.id ? ' selected' : '') + '>' + esc(ps.nome) + (fora ? ' 🏖️ (também fora ' + esc(br(fora.ini) + '–' + br(fora.fim)) + ')' : '') + '</option>';
      }).join('');
    }
    function desenhar(){
      const cab = '<div class="mfer-pass-hd"><h3 id="mfer-pass-tt">' + esc(cfg.titulo || '🧳 Preparar minha saída') + '</h3>'
        + (etapa === 'aplicando' ? '' : '<button type="button" class="mfer-btn" data-pa="fechar" aria-label="Fechar">✕</button>') + '</div>'
        + (per.ini ? '<p class="mfer-sub">Suas férias: ' + esc(brAno(per.ini) + ' a ' + brAno(per.fim)) + '. Nada muda até você confirmar no final.</p>' : '')
        + '<p class="mfer-sub mfer-senior">⚠️ Lembrete: isto não substitui o cadastro das férias no Senior.</p>';
      if(!itens.length){
        box.innerHTML = cab + '<div class="mfer-empty">' + esc(cfg.vazio || 'Nenhum item seu para passar aqui.') + '</div>'
          + (cfg.links && cfg.links.length ? '<div class="mfer-pass-links">' + linksHtml() + '</div>' : '')
          + '<div class="mfer-pass-ft"><button type="button" class="mfer-btn" data-pa="fechar">Fechar</button></div>';
        return;
      }
      if(etapa === 'lista'){
        const n = nDec(), tudo = n === itens.length;
        box.innerHTML = cab
          + '<div class="mfer-pass-lista">' + itens.map(it => {
              const d = dec[it.key] || {};
              return '<div class="mfer-pass-it' + (decidido(it.key) ? ' ok' : '') + '" data-key="' + esc(it.key) + '">'
                + '<div class="mfer-item-info"><div class="mfer-item-nm" title="' + esc(it.titulo) + '">' + esc(it.titulo) + '</div>' + (it.sub ? '<div class="mfer-item-obs">' + esc(it.sub) + '</div>' : '') + '</div>'
                + '<div class="mfer-pass-acts" role="group" aria-label="O que fazer com este item">'
                  + '<button type="button" class="mfer-btn' + (d.acao === 'manter' ? ' on' : '') + '" data-pa="manter" aria-pressed="' + (d.acao === 'manter') + '">✋ Manter</button>'
                  + '<button type="button" class="mfer-btn' + (d.acao === 'passar' ? ' on' : '') + '" data-pa="passar" aria-pressed="' + (d.acao === 'passar') + '">➡️ Passar</button>'
                  + (d.acao === 'passar' ? '<select class="mfer-sel" data-pa="para" aria-label="Passar para">' + opcoesPessoa(d.para || '') + '</select>' : '')
                + '</div></div>';
            }).join('') + '</div>'
          + (cfg.links && cfg.links.length ? '<div class="mfer-pass-links"><span class="mfer-sub">' + esc(cfg.nota || 'Também pode passar em:') + '</span>' + linksHtml() + '</div>' : '')
          + '<div class="mfer-pass-ft"><span class="mfer-sub" role="status">' + n + ' de ' + itens.length + ' decididos</span>'
            + (itens.some(it => !dec[it.key]) ? '<button type="button" class="mfer-btn" data-pa="manter-resto">✋ Manter todos os restantes</button>' : '')
            + '<button type="button" class="mfer-btn prim" data-pa="revisar"' + (tudo ? '' : ' disabled title="Decida cada item (e escolha a pessoa de cada ➡️ Passar)"') + '>Revisar ›</button></div>';
        return;
      }
      if(etapa === 'revisao' || etapa === 'aplicando'){
        const passar = itens.filter(it => dec[it.key].acao === 'passar'), manter = itens.filter(it => dec[it.key].acao === 'manter');
        box.innerHTML = cab
          + '<div class="mfer-pass-lista">'
            + (passar.length ? '<h4 class="mfer-card-tt">➡️ Passar (' + passar.length + ')</h4>' + passar.map(it => '<div class="mfer-pass-it ok"><div class="mfer-item-info"><div class="mfer-item-nm">' + esc(it.titulo) + '</div><div class="mfer-item-dt">→ ' + esc(nomeP(dec[it.key].para)) + '</div></div></div>').join('') : '')
            + (manter.length ? '<h4 class="mfer-card-tt">✋ Ficam com você (' + manter.length + ')</h4>' + manter.map(it => '<div class="mfer-pass-it"><div class="mfer-item-info"><div class="mfer-item-nm">' + esc(it.titulo) + '</div></div></div>').join('') : '')
          + '</div>'
          + '<div class="mfer-pass-ft">'
            + (etapa === 'aplicando' ? '<span class="mfer-sub" role="status">⏳ Aplicando…</span>'
              : '<button type="button" class="mfer-btn" data-pa="voltar">‹ Voltar</button><button type="button" class="mfer-btn prim" data-pa="aplicar">' + (passar.length ? '✅ Confirmar e passar ' + passar.length : '✅ Confirmar') + '</button>')
          + '</div>';
        return;
      }
      // fim
      const ok = resultado.filter(r => r && r.ok), err = resultado.filter(r => r && !r.ok);
      const tit = k => (itens.find(x => x.key === k) || {}).titulo || k;
      box.innerHTML = cab
        + (resultado.length ? '' : '<div class="mfer-msg ok">Tudo decidido: os itens ficam com você.</div>')
        + (ok.length ? '<div class="mfer-msg ok" role="status">✅ ' + ok.length + ' item(ns) passado(s). Quem recebeu foi avisado no sino.</div>' : '')
        + (err.length ? '<div class="mfer-msg err" role="alert">❌ ' + err.length + ' não deu certo:<br>' + err.map(r => esc(tit(r.key)) + (r.erro ? ' — ' + esc(r.erro) : '')).join('<br>') + '</div>' : '')
        + (cfg.links && cfg.links.length ? '<div class="mfer-pass-links"><span class="mfer-sub">' + esc(cfg.nota || 'Também pode passar em:') + '</span>' + linksHtml() + '</div>' : '')
        + '<div class="mfer-pass-ft"><button type="button" class="mfer-btn prim" data-pa="fechar">Fechar</button></div>';
    }
    function fechar(){
      if(etapa === 'aplicando') return;
      ov.remove(); document.removeEventListener('keydown', tecla, true);
      try{ if(origemFoco && origemFoco.isConnected) origemFoco.focus({ preventScroll: true }); }catch(e){}
      if(typeof cfg.aoFechar === 'function'){ try{ cfg.aoFechar(etapa === 'fim'); }catch(e){} }
    }
    function tecla(e){ if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); fechar(); } }
    async function aplicar(){
      etapa = 'aplicando'; desenhar();
      const decisoes = itens.map(it => ({ key: it.key, acao: dec[it.key].acao, para: dec[it.key].acao === 'passar' ? dec[it.key].para : '' }));
      try{
        const passar = decisoes.filter(d => d.acao === 'passar');
        resultado = passar.length && typeof cfg.aplicar === 'function' ? ((await cfg.aplicar(decisoes)) || []) : [];
      }catch(err){
        resultado = decisoes.filter(d => d.acao === 'passar').map(d => ({ key: d.key, ok: false, erro: (err && err.message) || 'erro' }));
      }
      etapa = 'fim'; desenhar();
      box.querySelector('[data-pa="fechar"]')?.focus({ preventScroll: true });
    }
    box.addEventListener('click', ev => {
      const t = ev.target.closest('[data-pa]'); if(!t || t.tagName === 'SELECT') return;
      const a = t.dataset.pa, row = t.closest('[data-key]'), k = row && row.dataset.key;
      if(a === 'fechar') return fechar();
      if(a === 'manter' && k){ dec[k] = { acao: 'manter', para: '' }; desenhar(); box.querySelector('[data-key="' + CSS.escape(k) + '"] [data-pa="manter"]')?.focus({ preventScroll: true }); return; }
      if(a === 'passar' && k){ dec[k] = { acao: 'passar', para: (dec[k] && dec[k].para) || '' }; desenhar(); box.querySelector('[data-key="' + CSS.escape(k) + '"] select')?.focus({ preventScroll: true }); return; }
      // só itens SEM escolha nenhuma; um "➡️ Passar" ainda sem pessoa continua pendente (não desfaz a intenção de passar)
      if(a === 'manter-resto'){ itens.forEach(it => { if(!dec[it.key]) dec[it.key] = { acao: 'manter', para: '' }; }); desenhar(); return; }
      if(a === 'revisar'){ if(nDec() === itens.length){ etapa = 'revisao'; desenhar(); box.querySelector('[data-pa="aplicar"]')?.focus({ preventScroll: true }); } return; }
      if(a === 'voltar'){ etapa = 'lista'; desenhar(); return; }
      if(a === 'aplicar'){ aplicar(); return; }
    });
    box.addEventListener('change', ev => {
      const t = ev.target; if(t.dataset.pa !== 'para') return;
      const k = t.closest('[data-key]')?.dataset.key; if(!k) return;
      dec[k] = { acao: 'passar', para: t.value }; desenhar();
      box.querySelector('[data-key="' + CSS.escape(k) + '"] select')?.focus({ preventScroll: true });
    });
    ov.addEventListener('click', ev => { if(ev.target === ov) fechar(); });
    document.addEventListener('keydown', tecla, true);
    document.body.appendChild(ov);
    desenhar();
    (box.querySelector('[data-pa="manter"],[data-pa="fechar"]'))?.focus({ preventScroll: true });
    return { fechar, estado: () => ({ etapa, dec: JSON.parse(JSON.stringify(dec)) }) };
  }

  window.MareFerias = {
    ouvir,
    ausente,
    periodoDe,
    montar,
    configurar,
    hojeSP,
    permitido,
    passagem,
    sobrepoe,
    pronto: () => ST.carregado,
    v: 5,
  };
})();
