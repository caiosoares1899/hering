// functions/rules/rulesSim.js
//
// Simulador das regras do Realtime Database (o projeto não tem emulador — firebase-tools/Java
// não rodam no ambiente de trabalho):  avalia as expressões REAIS do database.rules.json
// (a linguagem de regras é quase JS) com a cascata do Firebase — .read/.write liberam se QUALQUER
// nível do caminho liberar; `data`/`newData` são avaliados em cada nível.
const fs=require('fs');
class Snap{ constructor(v){this.v=(v===undefined)?null:v;} val(){return this.v;} exists(){return this.v!==null;}
  child(p){ return new Snap(getAt(this.v,String(p))); } isString(){return typeof this.v==='string';}
  hasChild(c){return this.v&&typeof this.v==='object'&&this.v[c]!==undefined;} }
const segs=p=>String(p).split('/').filter(Boolean);
function getAt(o,p){ let c=o; for(const s of segs(p)){ if(c==null||typeof c!=='object') return null; c=c[s]; if(c===undefined) return null; } return c===undefined?null:c; }
function setAt(o,p,v){ const ks=segs(p); if(!ks.length) return v; const r=JSON.parse(JSON.stringify(o||{})); let c=r; ks.slice(0,-1).forEach(k=>{ if(c[k]==null||typeof c[k]!=='object') c[k]={}; c=c[k]; }); if(v===null) delete c[ks[ks.length-1]]; else c[ks[ks.length-1]]=v; return r; }
function check(rules, db, op, path, auth, newVal){
  const dbAfter = op==='write' ? setAt(db,path,newVal===undefined?null:newVal) : db;
  let node=rules.rules, trail=[], vars={}; trail.push({node,p:''});
  const ks=segs(path); let acc=[];
  for(const seg of ks){
    let nxt=node[seg]; if(nxt===undefined||typeof nxt!=='object'){ const wk=Object.keys(node).find(k=>k.startsWith('$')); if(wk){ nxt=node[wk]; vars[wk]=seg; } else nxt=null; }
    if(!nxt) break; acc.push(seg); node=nxt; trail.push({node,p:acc.join('/')});
  }
  for(const {node:n,p} of trail){
    const e=n['.'+op]; if(e===undefined) continue;
    if(e===true||e==='true'){ return true; }
    const names=Object.keys(vars);
    const fn=new Function('auth','root','data','newData','now',...names,'return ('+e+');');
    let r=false; try{ r=!!fn(auth,new Snap(db),new Snap(getAt(db,p)),new Snap(getAt(dbAfter,p)),Date.now(),...names.map(k=>vars[k])); }catch(err){ r=false; }
    if(r) return true;
  } return false;
}
module.exports={check};
