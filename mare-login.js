/* mare-login.js — login Google "direto" (sem popup e sem o iframe do firebaseapp.com), pra quem abre o Oceano/Maré pelo ATALHO NA TELA INICIAL do iPhone/iPad.
   Por quê: nesse modo o popup do Firebase (signInWithPopup) abre numa janela que não consegue devolver o resultado pro app — a pessoa fica presa na tela do Google, sem erro
   (por isso o fallback "popup falhou 2×" do Maré nunca dispara). O redirect do Firebase também não serve no Safari/iOS recente (o resultado volta por um iframe de OUTRO
   domínio, que o Safari isola). Aqui a página inteira vai ao Google e volta com o id_token no #fragmento da PRÓPRIA página (mesma origem do app); a página entrega o token ao
   Firebase com signInWithCredential. Nada de popup, nada de storage de terceiros.
   Pré-requisito (Google Cloud Console → Credenciais → "Web client (auto created by Google Service)" → URIs de redirecionamento autorizados): a URL exata de cada página que usa
   este fluxo (…/oceano.html, …/oceano-dev.html, …/kanban.html, …/kanban-dev.html).
   Contrato com a página: carregar este script ANTES do <script type="module"> e expor  window._signInIdToken = idToken => signInWithCredential(auth, GoogleAuthProvider.credential(idToken)).
   Uso: no clique de "Entrar" →  if (MareLogin.usar()) return MareLogin.iniciar();  senão o popup de sempre.  Teste fora do iPhone: acrescente ?loginDireto=1 na URL. */
(function (root) {
  'use strict';
  const CLIENT_ID = '122502391131-pu097vfp9lpp1nrmnj5jrn4gtlh6egg3.apps.googleusercontent.com';   // cliente web do projeto Firebase (identificador público)
  const KEY = 'mare_oauth_direto', TTL = 10 * 60e3;
  const ls = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
    del: k => { try { localStorage.removeItem(k); } catch (e) {} },
  };
  const ios = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => (root.matchMedia && root.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  // Só onde o popup é sabidamente ruim (atalho do iPhone/iPad) — ou forçado por ?loginDireto=1 / localStorage mare_login_direto=1 (pra testar).
  function usar() { return (ios() && standalone()) || /[?&]loginDireto=1(&|$)/.test(location.search) || ls.get('mare_login_direto') === '1'; }
  const rnd = () => { const a = new Uint8Array(16); (root.crypto || {}).getRandomValues(a); return Array.from(a, x => x.toString(16).padStart(2, '0')).join(''); };
  function urlGoogle(nonce, state, redirect) {
    const p = { client_id: CLIENT_ID, redirect_uri: redirect, response_type: 'id_token', scope: 'openid email profile', nonce, state, prompt: 'select_account', hd: 'ciahering.com.br' };
    return 'https://accounts.google.com/o/oauth2/v2/auth?' + Object.keys(p).map(k => k + '=' + encodeURIComponent(p[k])).join('&');
  }
  // Vai pro Google. A volta é na MESMA página (sem query/hash); guardamos o caminho completo pra restaurar ?squad=… depois.
  function iniciar() {
    const nonce = rnd(), state = rnd();
    ls.set(KEY, JSON.stringify({ nonce, state, ts: Date.now(), ret: location.pathname + location.search }));
    location.assign(urlGoogle(nonce, state, location.origin + location.pathname));
  }
  function jwt(t) {
    const s = String(t || '').split('.')[1]; if (!s) return null;
    try { let b = s.replace(/-/g, '+').replace(/_/g, '/'); b += '==='.slice((b.length + 3) % 4); return JSON.parse(decodeURIComponent(Array.prototype.map.call(atob(b), c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''))); } catch (e) { return null; }
  }
  // Valida a volta do Google (função pura, testável): state e nonce batem com o que guardamos, o token é do nosso cliente, não venceu, e a tentativa é recente.
  function validar(hash, pend, agora) {
    const q = {}; String(hash || '').replace(/^#/, '').split('&').forEach(kv => { const i = kv.indexOf('='); if (i > 0) q[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); });
    if (q.error) return { erro: q.error === 'access_denied' ? 'Login cancelado. Toque em Entrar para tentar de novo.' : 'O Google recusou o login (' + q.error + (q.error_description ? ': ' + q.error_description : '') + ').' };
    if (!q.id_token) return { erro: 'O Google não devolveu o login. Toque em Entrar para tentar de novo.' };
    if (!pend || !pend.state || q.state !== pend.state) return { erro: 'Essa tentativa de login expirou ou veio de outro aparelho. Toque em Entrar para tentar de novo.' };
    if (!(agora - pend.ts < TTL)) return { erro: 'O login demorou demais. Toque em Entrar para tentar de novo.' };
    const c = jwt(q.id_token);
    if (!c || c.aud !== CLIENT_ID || (c.iss !== 'https://accounts.google.com' && c.iss !== 'accounts.google.com') || c.nonce !== pend.nonce || !(c.exp * 1000 > agora)) return { erro: 'Não deu pra confirmar o login. Toque em Entrar para tentar de novo.' };
    return { ok: true, token: q.id_token };
  }
  const aviso = msg => {
    if (root.MareLogin && typeof root.MareLogin.aoErro === 'function') { try { root.MareLogin.aoErro(msg); return; } catch (e) {} }
    const el = document.getElementById('login-err'); if (el) { el.textContent = msg; el.style.display = 'block'; } else console.warn('[MareLogin]', msg);
  };
  function entrar(token) {
    let n = 0; const t = setInterval(() => {
      if (typeof root._signInIdToken === 'function') { clearInterval(t); Promise.resolve().then(() => root._signInIdToken(token)).catch(e => aviso('Não deu pra entrar: ' + ((e && e.message) || e))); }
      else if (++n > 200) { clearInterval(t); aviso('O login demorou demais pra carregar. Toque em Entrar para tentar de novo.'); }
    }, 100);
  }
  // Ao carregar a página: voltou do Google? Limpa o #fragmento NA HORA (o token não fica na barra/histórico), valida e entrega pro Firebase.
  function retorno() {
    if (!/[#&](id_token|error)=/.test(location.hash)) return;
    let pend = null; try { pend = JSON.parse(ls.get(KEY) || 'null'); } catch (e) {}
    root.MareLogin.voltando = true;   // as páginas NÃO podem mandar a pessoa embora (ex.: login único → Oceano) enquanto o token está sendo entregue
    const hash = location.hash; ls.del(KEY);
    try { history.replaceState(null, '', (pend && pend.ret) || (location.pathname + location.search)); } catch (e) {}
    const r = validar(hash, pend, Date.now());
    if (r.ok) entrar(r.token); else setTimeout(() => aviso(r.erro), 0);
  }
  root.MareLogin = { CLIENT_ID, usar, iniciar, validar, urlGoogle, retorno };
  if (typeof module === 'object' && module.exports) module.exports = root.MareLogin;
  if (typeof document !== 'undefined') retorno();
})(typeof window !== 'undefined' ? window : globalThis);
