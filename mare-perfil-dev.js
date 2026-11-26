/* ══════════════════════════════════════════════════════════════════════════
   mare-perfil-dev.js — 👤 Perfil da pessoa, o cartão do Oceano inteiro (módulo compartilhado, 26/11/2026)
   Abre ao tocar na foto ou no nome de alguém em Concha, Maré, Radar, Oceano e Sonar. A versão de produção, mare-perfil.js, nasce na promoção.
   Mesmo ciclo dev→prod dos outros mare-*: ?v=N nas páginas; bump em todas ao mudar o módulo.

   De onde vem cada coisa:
     - kanban/usuarios_publicos/{uid}: nome, foto, e-mail, squads, diretoria (o que já existia; a página costuma ter em memória);
     - kanban/perfis/{uid}: cargo, tel, niver (MM-DD), li (o <id> de linkedin.com/in/<id>) — a PRÓPRIA pessoa preenche em Oceano › ⚙ Meu perfil.
       Só a Hering (Google) lê e só a dona grava (database.rules.json; functions/rules/__tests__/perfisRules.test.js). 1 get por pessoa ao abrir,
       guardado em memória por 5 min — nada de escutar o nó inteiro.
   Texto de outra pessoa entra no DOM só por textContent. Os links são montados aqui, refiltrando o valor: tel/WhatsApp só dígitos, LinkedIn só o <id>,
   e-mail conferido, foto só https.

   Uso (cada página, depois do login):
     MarePerfil.iniciar({
       ler: caminho => Promise<valor>,          // a leitura da página (get + ref do SDK que ela já tem)
       user: () => user,                        // quem está logado (o próprio cartão ganha "Editar meu perfil")
       publico?: uid => objeto|null,            // usuarios_publicos/{uid} já em memória (senão o módulo lê)
       squadNome?: id => 'Dados',               // rótulo do squad (senão o id)
       editar?: () => {},                       // o Oceano abre o ⚙ Meu perfil; as outras páginas vão para editarUrl
       editarUrl?: 'oceano-dev.html?perfil=1',
     });
     MarePerfil.abrir(uid, elementoDeVolta?) · MarePerfil.fechar() · MarePerfil.esquecer(uid) (depois de salvar)
     MarePerfil.ligar(raiz) — qualquer elemento com data-perfil="<uid>" dentro de raiz abre o cartão (clique, Enter e Espaço)
     MarePerfil.lembrar() — pedido do Caio (26/11): quem ainda não preencheu NADA do cartão é convidado ao entrar/recarregar a página.
       "Agora" leva à edição; "Depois" adia até o próximo dia (neste aparelho); "Não mostrar mais" para de perguntar neste aparelho.
       Para de perguntar sozinho quando a pessoa preenche qualquer campo.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if(window.MarePerfil) return;

  const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;
  const TTL = 5 * 60 * 1000;
  const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const DIRETORIAS = { digital: '💻 Digital', rh: '🤝 RH', marca: '🎨 Marca', tecnologia: '🛠️ Tecnologia' };
  let cfg = null, ov = null, volta = null, vez = 0;
  const cache = {};   // uid → { em, pub, perfil }

  // ── formatos (iguais às regras do banco; o que não casar não aparece) ──
  const digitos = t => (typeof t === 'string' && /^\+?[0-9]{10,15}$/.test(t)) ? t.replace(/\D/g, '') : '';
  const comPais = d => (d.length === 10 || d.length === 11) ? '55' + d : d;   // número brasileiro sem o 55
  function telBonito(t){
    const d = comPais(digitos(t)); if(!d) return '';
    const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(d);
    return m ? '+55 ' + m[1] + ' ' + m[2] + '-' + m[3] : '+' + d;
  }
  const liOk = v => typeof v === 'string' && /^[A-Za-z0-9_-]{3,100}$/.test(v) ? v : '';
  const nivOk = v => { const m = typeof v === 'string' && /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.exec(v); return m ? { m: +m[1], d: +m[2] } : null; };
  const emailOk = e => typeof e === 'string' && e.length <= 200 && /^[^\s@<>"'()]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(e) ? e : '';
  const fotoOk = u => typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(u) && u.length <= 1000 ? u : '';
  const cargoOk = c => typeof c === 'string' && c.trim() ? c.trim().slice(0, 60) : '';
  // De um texto colado (URL inteira ou só o id) para o <id> do LinkedIn — usado na edição (Oceano)
  function linkedinDe(txt){
    const s = String(txt || '').trim(); if(!s) return '';
    const m = /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([^/?#\s]+)\/?(?:[?#].*)?$/i.exec(s);
    let id = m ? m[1] : s;
    try { id = decodeURIComponent(id); } catch(e) {}
    return liOk(id);
  }

  function el(tag, cls, txt){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; return e; }
  function link(rot, href, ic, novaAba){
    const a = el('a', 'mp-link'); a.href = href; if(novaAba){ a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    a.append(el('span', 'mp-ic', ic), el('span', '', rot)); a.setAttribute('aria-label', rot); return a;
  }

  function estilo(){
    if(document.getElementById('mare-perfil-css')) return;
    const s = document.createElement('style'); s.id = 'mare-perfil-css';
    s.textContent = [
      '.mp-ov{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,10,24,.55);backdrop-filter:blur(3px)}',
      '.mp-ov[hidden]{display:none}',
      '.mp-card{width:min(380px,100%);max-height:calc(100vh - 32px);overflow:auto;border-radius:18px;padding:20px;background:var(--glass-solid,var(--surface,#0d2238));color:var(--txt,#e8f1fb);border:1px solid var(--glass-b,rgba(126,200,227,.25));box-shadow:0 20px 60px rgba(0,0,0,.45);font:14px/1.45 var(--ff,system-ui,sans-serif)}',
      '[data-theme="light"] .mp-card,.light .mp-card{background:#fff;color:#0b2540}',
      '.mp-topo{display:flex;gap:14px;align-items:center;margin-bottom:12px}',
      '.mp-foto{width:64px;height:64px;border-radius:50%;object-fit:cover;flex:none;background:var(--glass,rgba(126,200,227,.15))}',
      '.mp-ini{width:64px;height:64px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:22px;background:var(--accent,#38b6ff);color:#fff}',
      '.mp-nome{font-size:18px;font-weight:700;margin:0;word-break:break-word}',
      '.mp-cargo{color:var(--txt2,#a9c1d9);margin:2px 0 0}',
      '.mp-sub{color:var(--txt3,#7d97b2);font-size:12.5px}',
      '.mp-linha{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}',
      '.mp-chip{font-size:12px;padding:3px 9px;border-radius:999px;border:1px solid var(--glass-b,rgba(126,200,227,.25));background:var(--glass,rgba(126,200,227,.08))}',
      '.mp-links{display:flex;flex-direction:column;gap:6px;margin-top:12px}',
      '.mp-link{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:10px;color:inherit;text-decoration:none;border:1px solid var(--glass-b,rgba(126,200,227,.25))}',
      '.mp-link:hover,.mp-link:focus-visible{background:var(--glass,rgba(126,200,227,.12));outline:2px solid var(--accent,#38b6ff);outline-offset:1px}',
      '.mp-ic{width:20px;text-align:center}',
      '.mp-niver{margin-top:10px}',
      '.mp-hoje{color:var(--cyan,#1de9b6);font-weight:600}',
      '.mp-dica{margin-top:12px;padding:10px;border-radius:10px;border:1px dashed var(--glass-b,rgba(126,200,227,.35));color:var(--txt2,#a9c1d9);font-size:13px}',
      '.mp-acoes{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}',
      '.mp-acoes button{font:inherit;padding:8px 14px;border-radius:10px;cursor:pointer;border:1px solid var(--glass-b,rgba(126,200,227,.3));background:transparent;color:inherit}',
      '.mp-acoes .mp-pri{background:var(--accent,#38b6ff);border-color:transparent;color:#fff;font-weight:600}',
      '[data-perfil]{cursor:pointer}',
    ].join('\n');
    document.head.appendChild(s);
  }

  async function dados(uid){
    const c = cache[uid];
    if(c && Date.now() - c.em < TTL) return c;
    const ler = p => cfg.ler(p).then(v => v == null ? null : v).catch(() => null);
    const pubMem = cfg.publico ? cfg.publico(uid) : null;
    const [pub, perfil] = await Promise.all([pubMem ? Promise.resolve(pubMem) : ler('kanban/usuarios_publicos/' + uid), ler('kanban/perfis/' + uid)]);
    const d = { em: Date.now(), pub: pub && typeof pub === 'object' ? pub : {}, perfil: perfil && typeof perfil === 'object' ? perfil : {} };
    cache[uid] = d; return d;
  }

  function fechar(){
    if(!ov || ov.hidden) return;
    ov.hidden = true; ov.replaceChildren(); vez++;
    const v = volta; volta = null;
    if(v && v.isConnected && typeof v.focus === 'function') v.focus();
  }

  function montar(uid, d){
    const p = d.pub, pf = d.perfil, u = cfg.user && cfg.user(), meu = !!(u && u.uid === uid);
    const nome = (typeof p.nome === 'string' && p.nome.trim()) || (typeof p.email === 'string' ? p.email.split('@')[0] : '') || 'Pessoa';
    const card = el('div', 'mp-card'); card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-labelledby', 'mp-nome');
    const topo = el('div', 'mp-topo'), foto = fotoOk(p.foto);
    if(foto){ const i = el('img', 'mp-foto'); i.alt = ''; i.referrerPolicy = 'no-referrer'; i.src = foto; i.onerror = () => { const ini = el('div', 'mp-ini', iniciais(nome, p.init)); i.replaceWith(ini); }; topo.append(i); }
    else topo.append(el('div', 'mp-ini', iniciais(nome, p.init)));
    const tt = el('div'); const h = el('h2', 'mp-nome', nome); h.id = 'mp-nome'; tt.append(h);
    const cargo = cargoOk(pf.cargo);
    if(cargo) tt.append(el('p', 'mp-cargo', cargo));
    else if(meu) tt.append(el('p', 'mp-sub', 'Cargo não informado'));
    topo.append(tt); card.append(topo);

    const chips = el('div', 'mp-linha');
    if(typeof p.diretoria === 'string' && DIRETORIAS[p.diretoria]) chips.append(el('span', 'mp-chip', '🏢 ' + DIRETORIAS[p.diretoria].replace(/^\S+\s/, '')));
    const sqs = p.squads && typeof p.squads === 'object' ? Object.keys(p.squads).filter(k => p.squads[k] === true && /^[a-z0-9_-]{1,40}$/i.test(k)) : [];
    sqs.forEach(sq => chips.append(el('span', 'mp-chip', (cfg.squadNome && cfg.squadNome(sq)) || sq)));
    if(chips.children.length) card.append(chips);

    const niv = nivOk(pf.niver);
    if(niv){
      const hoje = new Date(), eHoje = hoje.getDate() === niv.d && hoje.getMonth() + 1 === niv.m;
      card.append(el('p', 'mp-niver' + (eHoje ? ' mp-hoje' : ''), eHoje ? '🎂 Hoje é aniversário!' : '🎂 Aniversário: ' + niv.d + ' de ' + MESES[niv.m - 1]));
    }

    const links = el('div', 'mp-links');
    const email = emailOk(p.email);
    if(email) links.append(link(email, 'mailto:' + email, '✉️'));
    const tel = comPais(digitos(pf.tel));
    if(tel){
      links.append(link('WhatsApp · ' + telBonito(pf.tel), 'https://wa.me/' + tel, '💬', true));
      links.append(link('Ligar · ' + telBonito(pf.tel), 'tel:+' + tel, '📞'));
    }
    const li = liOk(pf.li);
    if(li) links.append(link('LinkedIn', 'https://www.linkedin.com/in/' + encodeURIComponent(li) + '/', '🔗', true));
    if(links.children.length) card.append(links);

    if(meu && (!cargo || !tel || !niv || !li)) card.append(el('p', 'mp-dica', 'Este é o seu cartão — é assim que as pessoas te veem no Oceano. Complete cargo, telefone, aniversário e LinkedIn em ⚙ Meu perfil (tudo opcional).'));

    const ac = el('div', 'mp-acoes');
    if(meu){
      const ed = el('button', 'mp-pri', '✏️ Editar meu perfil'); ed.type = 'button';
      ed.onclick = () => { fechar(); if(cfg.editar) cfg.editar(); else location.href = cfg.editarUrl || 'oceano-dev.html?perfil=1'; };
      ac.append(ed);
    }
    const x = el('button', '', 'Fechar'); x.type = 'button'; x.onclick = fechar; ac.append(x);
    card.append(ac);
    return card;
  }
  function iniciais(nome, init){
    if(typeof init === 'string' && /^[A-Za-z0-9]{1,4}$/.test(init)) return init.toUpperCase();
    return String(nome).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  }

  function prender(){   // clique fora e Esc fecham; Tab circula dentro do cartão
    ov.addEventListener('click', e => { if(e.target === ov) fechar(); });
    ov.addEventListener('keydown', e => {
      if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); fechar(); return; }
      if(e.key !== 'Tab') return;
      const fs = [...ov.querySelectorAll('a[href], button')]; if(!fs.length) return;
      const i = fs.indexOf(document.activeElement); e.preventDefault();
      fs[(i + (e.shiftKey ? -1 : 1) + fs.length) % fs.length].focus();
    });
  }
  async function abrir(uid, deVolta){
    if(!cfg || typeof uid !== 'string' || !UID_RE.test(uid)) return;
    estilo();
    if(!ov){ ov = el('div', 'mp-ov'); ov.hidden = true; document.body.append(ov); prender(); }
    volta = deVolta || document.activeElement;
    const minha = ++vez;
    ov.replaceChildren(el('div', 'mp-card', 'Carregando…')); ov.hidden = false;
    const d = await dados(uid);
    if(minha !== vez || ov.hidden) return;   // fechou ou abriu outra pessoa enquanto lia
    const card = montar(uid, d); ov.replaceChildren(card);
    const f = card.querySelector('.mp-acoes button'); if(f) f.focus();
  }

  // ── lembrete de preencher o cartão ──
  const chaveLembrete = uid => 'mare_perfil_lembrete_' + uid;
  const hojeTxt = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  const lsLer = k => { try { return localStorage.getItem(k); } catch(e) { return null; } };
  const lsGravar = (k, v) => { try { localStorage.setItem(k, v); } catch(e) {} };
  let lembrou = false, tentativas = 0;
  const outraJanela = () => [...document.querySelectorAll('[role="dialog"], [aria-modal="true"], .modal.open, .ov.open')].some(x => !(ov && ov.contains(x)) && x.getClientRects().length > 0);
  async function lembrar(){
    const u = cfg && cfg.user && cfg.user();
    if(lembrou || !u || !UID_RE.test(u.uid || '')) return;
    if(lsLer('mare_perfil_lembrete') === 'off') return;   // desligado neste aparelho (testes automatizados usam isto)
    const marca = lsLer(chaveLembrete(u.uid));
    if(marca === 'nunca' || marca === hojeTxt()) return;
    const d = await dados(u.uid);
    const pf = d.perfil;
    if(cargoOk(pf.cargo) || digitos(pf.tel) || nivOk(pf.niver) || liOk(pf.li)){ lembrou = true; return; }   // já preencheu algo: não pergunta mais
    if(document.hidden || (ov && !ov.hidden) || outraJanela()){   // outra janela na frente (aviso, dica, cartão): tenta de novo daqui a pouco
      if(++tentativas <= 6) setTimeout(lembrar, 20000); return;
    }
    lembrou = true;
    estilo();
    abrirLembrete(u);
  }
  function abrirLembrete(u){
    if(!ov){ ov = el('div', 'mp-ov'); ov.hidden = true; document.body.append(ov); prender(); }
    volta = document.activeElement; vez++;
    const card = el('div', 'mp-card'); card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-labelledby', 'mp-lem-t');
    const h = el('h2', 'mp-nome', '👤 Complete o seu cartão'); h.id = 'mp-lem-t'; card.append(h);
    card.append(el('p', 'mp-cargo', 'Agora, ao tocar na foto de alguém na Concha, no Maré, no Radar ou no Sonar, aparece o cartão da pessoa. Conte seu cargo e, se quiser, telefone/WhatsApp, aniversário e LinkedIn. Leva 1 minuto e tudo é opcional.'));
    card.append(el('p', 'mp-sub', 'Quem vê: toda a Hering (contas externas não).'));
    const ac = el('div', 'mp-acoes');
    const nunca = el('button', '', 'Não mostrar mais'); nunca.type = 'button';
    nunca.onclick = () => { lsGravar(chaveLembrete(u.uid), 'nunca'); fechar(); };
    const depois = el('button', '', 'Depois'); depois.type = 'button';
    depois.onclick = () => { lsGravar(chaveLembrete(u.uid), hojeTxt()); fechar(); };
    const agora = el('button', 'mp-pri', 'Preencher agora'); agora.type = 'button';
    agora.onclick = () => { lsGravar(chaveLembrete(u.uid), hojeTxt()); fechar(); if(cfg.editar) cfg.editar(); else location.href = cfg.editarUrl || 'oceano-dev.html#meu-cartao'; };
    ac.append(nunca, depois, agora); card.append(ac);
    ov.replaceChildren(card); ov.hidden = false; agora.focus();
  }

  function ligar(raiz){
    if(!raiz || raiz.__marePerfil) return; raiz.__marePerfil = true;
    const alvo = e => { const t = e.target && e.target.closest && e.target.closest('[data-perfil]'); return t && raiz.contains(t) ? t : null; };
    raiz.addEventListener('click', e => { const t = alvo(e); if(!t) return; e.preventDefault(); e.stopPropagation(); abrir(t.dataset.perfil, t); });
    raiz.addEventListener('keydown', e => { if(e.key !== 'Enter' && e.key !== ' ') return; const t = alvo(e); if(!t || /^(INPUT|TEXTAREA)$/.test(t.tagName)) return; e.preventDefault(); abrir(t.dataset.perfil, t); });
  }

  window.MarePerfil = {
    iniciar(o){ cfg = Object.assign({}, o || {}); estilo(); },
    abrir, fechar, ligar, lembrar,
    aberto: () => !!(ov && !ov.hidden),
    esquecer(uid){ if(uid) delete cache[uid]; else Object.keys(cache).forEach(k => delete cache[k]); },
    linkedinDe, telBonito,
  };
})();
