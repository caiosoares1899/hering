// functions/rules/rulesSim.js
//
// Simulador das regras do Realtime Database (o projeto não tem emulador — firebase-tools/Java
// não rodam no ambiente de trabalho):  avalia as expressões REAIS do database.rules.json
// (a linguagem de regras é quase JS) com a cascata do Firebase — .read/.write liberam se QUALQUER
// nível do caminho liberar; `data`/`newData` são avaliados em cada nível.
const fs=require('fs');
class Snap{ constructor(v){this.v=(v===undefined)?null:v;} val(){return this.v;} exists(){return this.v!==null;}
  child(p){ return new Snap(getAt(this.v,String(p))); } isString(){return typeof this.v==='string';}
  hasChild(c){return this.v&&typeof this.v==='object'&&this.v[c]!==undefined;}
  // (2026-10-12) métodos usados pelos .validate das regras novas (Escala, Metas)
  isNumber(){return typeof this.v==='number';} isBoolean(){return typeof this.v==='boolean';}
  hasChildren(list){ if(!this.v||typeof this.v!=='object') return false; const ks=Object.keys(this.v).filter(k=>this.v[k]!==null&&this.v[k]!==undefined); return list?list.every(k=>ks.includes(k)):ks.length>0; }
  numChildren(){ return (this.v&&typeof this.v==='object')?Object.keys(this.v).filter(k=>this.v[k]!==null&&this.v[k]!==undefined).length:0; } }
// String.matches(regex) existe na linguagem de regras (não em JS): o simulador emula (a regex das regras já traz ^…$).
if(!String.prototype.matches) Object.defineProperty(String.prototype,'matches',{value:function(re){ return re.test(String(this)); },enumerable:false});
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
// `.validate` de uma ESCRITA: vale pro nó escrito e pra todos os descendentes (não pros ancestrais), com a cascata de wildcards — `$other:{".validate":false}` barra campo extra.
// Exclusão (null) não é validada. Devolve true/false.
function validate(rules, db, path, auth, newVal){
  if(newVal===null||newVal===undefined) return true;
  const dbAfter=setAt(db,path,newVal);
  let node=rules.rules, vars={}; const ks=segs(path), acc=[];
  for(const seg of ks){ let nxt=node[seg]; if(nxt===undefined||typeof nxt!=='object'){ const wk=Object.keys(node).find(k=>k.startsWith('$')); if(wk){ nxt=node[wk]; vars={...vars,[wk]:seg}; } else nxt=null; } if(!nxt) return true; acc.push(seg); node=nxt; }
  const walk=(n,v,p,vs)=>{
    if(v===null||v===undefined) return true;
    const e=n['.validate'];
    if(e===false) return false;
    if(e!==undefined&&e!==true){
      const names=Object.keys(vs); const fn=new Function('auth','root','data','newData','now',...names,'return ('+e+');');
      let r=false; try{ r=!!fn(auth,new Snap(db),new Snap(getAt(db,p)),new Snap(getAt(dbAfter,p)),Date.now(),...names.map(k=>vs[k])); }catch(err){ r=false; }
      if(!r) return false;
    }
    if(v&&typeof v==='object'){
      for(const k of Object.keys(v)){
        let c=n[k], nv=vs; if(c===undefined||typeof c!=='object'){ const wk=Object.keys(n).find(x=>x.startsWith('$')); if(wk){ c=n[wk]; nv={...vs,[wk]:k}; } else c=null; }
        if(c&&!walk(c,v[k],p+'/'+k,nv)) return false;
      }
    }
    return true;
  };
  return walk(node,newVal,acc.join('/'),vars);
}
module.exports={check,validate};
