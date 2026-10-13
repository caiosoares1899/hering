// Firebase SDK falso (em memória) servido no lugar do gstatic — roda o BOOT REAL da página.
// opts.oceano=true liga o redirecionamento "deslogado → Oceano" de Maré/Painel (test_login_oceano.js); nos demais testes ele fica desligado
// (a sessão da aba começa com mare_login_local=1), senão toda página que sobe deslogada antes do __authCb iria parar no Oceano.
exports.install = async function(context, seed, opts){
  if(!(opts&&opts.oceano)) await context.addInitScript(()=>{ try{ sessionStorage.setItem('mare_login_local','1'); }catch(e){} });
  const app=`export const initializeApp=()=>({});`;
  const dbm=`
const store = (window.__store = window.__store || {});
const clone=v=>v===undefined?null:JSON.parse(JSON.stringify(v));
const norm=p=>String(p||'').replace(/^\\/+|\\/+$/g,'');
const getv=p=>{p=norm(p); return p? p.split('/').reduce((a,k)=>(a==null?undefined:a[k]),store) : store;};
const setv=(p,v)=>{p=norm(p); const ks=p.split('/'); let o=store; ks.slice(0,-1).forEach(k=>{ if(o[k]==null||typeof o[k]!=='object') o[k]={}; o=o[k]; }); const last=ks[ks.length-1]; if(v===null||v===undefined) delete o[last]; else o[last]=clone(v); };
const lis=(window.__lis = window.__lis || []);
const snap=(p)=>({ val:()=>clone(getv(p)), key:norm(p).split('/').pop(), exists:()=>getv(p)!=null });
const fire=(p)=>{ p=norm(p); lis.forEach(l=>{ if(l.p===p||l.p.startsWith(p+'/')||p.startsWith(l.p+'/')||p===''||l.p==='') { if(window.__fireSync) l.cb(snap(l.p)); else Promise.resolve().then(()=>l.cb(snap(l.p))); } }); };
window.__log = window.__log || [];
export const getDatabase=()=>({});
export const ref=(db,p)=>({p:norm(p)});
export const onValue=(r,cb)=>{ window.__log.push(['onValue',r.p]); lis.push({p:r.p,cb}); const d=window.__onValueDelay&&window.__onValueDelay(r.p); if(d) setTimeout(()=>cb(snap(r.p)),d); else Promise.resolve().then(()=>cb(snap(r.p))); return ()=>{}; };   // __onValueDelay(path)→ms: 1ª entrega atrasada (rede lenta)
export const get=async(r)=>{ window.__log.push(['get',r.p]); if(window.__getDelay){ const d=window.__getDelay(r.p); if(d) await new Promise(x=>setTimeout(x,d)); } if(window.__denyGet && window.__denyGet(r.p)) throw new Error('PERMISSION_DENIED'); if(r.s!==undefined||r.e!==undefined){ const all=getv(r.p)||{}; const o={}; Object.keys(all).sort().forEach(k=>{ if((r.s===undefined||k>=r.s)&&(r.e===undefined||k<=r.e)) o[k]=all[k]; }); return { val:()=>clone(Object.keys(o).length?o:null), key:norm(r.p).split('/').pop(), exists:()=>Object.keys(o).length>0 }; } return snap(r.p); };
export const set=async(r,v)=>{ window.__log.push(['set',r.p]); if(window.__setDelay){ const d=window.__setDelay(r.p); if(d) await new Promise(x=>setTimeout(x,d)); } if(window.__denySet && window.__denySet(r.p,v)) { const e=new Error('PERMISSION_DENIED'); e.code='PERMISSION_DENIED'; throw e; } setv(r.p,v); fire(r.p); };
export const update=async(r,v)=>{ window.__log.push(['update',r.p]); if(window.__denySet && window.__denySet(r.p,v)) { const e=new Error('PERMISSION_DENIED'); e.code='PERMISSION_DENIED'; throw e; } if(window.__setDelay){ const d=window.__setDelay(r.p); if(d) await new Promise(x=>setTimeout(x,d)); } Object.entries(v).forEach(([k,x])=>setv((r.p?r.p+'/':'')+k,x)); fire(r.p); };
export const push=(r)=>{ const k='-N'+Math.random().toString(36).slice(2,10)+Date.now().toString(36); return {p:norm(r.p+'/'+k), key:k}; };
export const remove=async(r)=>{ window.__log.push(['remove',r.p]); setv(r.p,null); fire(r.p); };
export const runTransaction=async(r,fn)=>{ const cur=clone(getv(r.p)); const n=fn(cur); if(n===undefined) return {committed:false,snapshot:snap(r.p)}; setv(r.p,n); fire(r.p); return {committed:true,snapshot:snap(r.p)}; };
export const query=(r,...c)=>{ const o={p:r.p}; c.forEach(x=>{ if(x&&x.__s!==undefined) o.s=x.__s; if(x&&x.__e!==undefined) o.e=x.__e; }); return o; }; export const startAt=v=>({__s:v}); export const endAt=v=>({__e:v}); export const orderByChild=()=>0; export const orderByKey=()=>{ (window.__qlog=window.__qlog||[]).push('orderByKey'); return 0; }; export const limitToLast=(n)=>{ (window.__qlog=window.__qlog||[]).push('limitToLast:'+n); return 0; }; export const equalTo=()=>0; export const onChildAdded=()=>()=>{}; export const onChildChanged=()=>()=>{}; export const onChildRemoved=()=>()=>{}; export const increment=n=>n;
`;
  const auth=`
export const getAuth=()=>({});
export class GoogleAuthProvider{ setCustomParameters(){} addScope(){} static credential(t){ return {idToken:t}; } }
export class OAuthProvider{ constructor(id){this.id=id;} setCustomParameters(){} }
export const signInWithPopup=async()=>{ window.__popup=(window.__popup||0)+1; };
export const signInWithCredential=async(a,c)=>{ window.__cred=c; };
export const signInWithRedirect=async()=>{}; export const getRedirectResult=async()=>null; export const reload=async()=>{}; export const updateProfile=async()=>{};
export const signOut=async()=>{ window.__signedOut=(window.__signedOut||0)+1; if(window.__authCb) window.__authCb(null); };
export const onAuthStateChanged=(a,cb)=>{ window.__authCb=cb; Promise.resolve().then(()=>cb(null)); };
`;
  const fbHandler=route=>{
    const u=route.request().url(); const msg="export const isSupported=async()=>true; export const getMessaging=()=>({}); export const getToken=async()=>'tok-fake'; export const deleteToken=async()=>true; export const onMessage=()=>()=>{};"; const sto="export const getStorage=()=>({}); export const ref=()=>({}); export const uploadBytes=async()=>({}); export const getDownloadURL=async()=>''; export const deleteObject=async()=>{};"; const body=u.includes('firebase-storage')?sto:u.includes('firebase-messaging')?msg:u.includes('firebase-app')?app:u.includes('firebase-database')?dbm:u.includes('firebase-auth')?auth:'';
    route.fulfill({status:200,contentType:'text/javascript',body});
  };
  await context.route('https://www.gstatic.com/firebasejs/**',fbHandler);
  await context.route('**/vendor/firebase-*/**',fbHandler);   // o kanban carrega o SDK vendorizado (./vendor/firebase-10.14.1/), não o gstatic
  await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  if(seed) await context.addInitScript(s=>{ window.__store=JSON.parse(s); },JSON.stringify(seed));
};

// Escala: os chips de filtro vivem numa mini tela aberta por #b-filtros. Este gancho deixa o teste clicar nos chips (#f-sqs/#f-subs/#f-limpar/#f-fechar)
// sem se preocupar em abrir a mini tela, e fecha a mini tela sozinho antes de qualquer outro clique na página.
module.exports.hookFiltros=p=>{
  const orig=p.click.bind(p);
  p.click=async(sel,o)=>{
    const dentro=/^#f-(sqs|subs|limpar|fechar)/.test(sel), aberta=!!(await p.$('#f-sqs'));
    if(dentro&&!aberta){ await orig('#b-filtros'); await p.waitForSelector('#f-sqs'); }
    else if(!dentro&&aberta&&sel!=='#b-filtros'){ await p.keyboard.press('Escape'); await p.waitForTimeout(50); }
    return orig(sel,o);
  };
  p.abreFiltros=async()=>{ if(!(await p.$('#f-sqs'))){ await orig('#b-filtros'); await p.waitForSelector('#f-sqs'); } };
};
