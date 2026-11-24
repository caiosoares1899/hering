#!/usr/bin/env python3
# Gerador do bloco kanban/cardume de database.rules.json (Concha, ex-Cardume). Fonte da verdade do bloco: edite AQUI e rode
#   python3 scripts/regras_cardume.py   (reescreve o bloco "cardume" antes de "agente_painel"; git diff deve mostrar só o que você quis)
# Depois: cd functions && node --test rules/__tests__/cardumeRules.test.js  e  firebase deploy --only database (Caio).
# Desenho: docs/ideias/cardume-v0-banco.md
import json,sys
G="auth != null && (auth.token.email.endsWith('@ciahering.com.br')&&auth.token.firebase.sign_in_provider=='google.com')"
ADM="(root.child('kanban/usuarios/' + auth.uid + '/role').val() === 'adm' || auth.token.email === 'caio.soares@ciahering.com.br')"
ID=r"/^[A-Za-z0-9_-]{1,64}$/"
GIF_RE=r"/^https:\/\/static[12]?\.klipy\.com\/[A-Za-z0-9\/_.-]{1,300}$/"
TEMA="$canal.matches(/^t-/)"
OFIC="!$canal.matches(/^t-/)"
def R(path): return f"root.child('kanban/cardume/{path}')"
def P(depth,path): return "newData"+".parent()"*depth+f".child('kanban/cardume/{path}')"
def cpath(sub): return f"canais/' + $canal + '/{sub}" if sub else "canais/' + $canal + '"
# helpers produce expressions where path strings concatenated
def S(base,path):  # base 'root' or ('post',depth)
  return R(path) if base=='root' else P(base[1],path)
MEM="root.child('kanban/cardume/membros/' + $canal + '/' + auth.uid).val() === true"
SR="root.child('kanban/usuarios/' + auth.uid + '/squads_roles/' + $canal).val()"
PO_SQ=f"({OFIC} && root.child('kanban/usuarios/' + auth.uid + '/squads/' + $canal).val() === true && ({SR} === 'po' || {SR} === 'organizador'))"
def GEST_TEMA(base):  # dono from base state, co-admin always from pre-state
  return f"({TEMA} && ({S(base,cpath('dono'))}.val() === auth.uid || root.child('kanban/cardume/admins/' + $canal + '/' + auth.uid).val() === true))"
def GEST(base): return f"({ADM} || {PO_SQ} || {GEST_TEMA(base)})"
def VENC(base): return f"({S(base,cpath('fim'))}.isNumber() && {S(base,cpath('fim'))}.val() <= now)"
def ATIVO(base): return f"!{VENC(base)}"
TS="newData.child('ts').isNumber() && newData.child('ts').val() <= now && newData.child('ts').val() > now - 60000"
same="newData.child('uid').val() === data.child('uid').val() && newData.child('ts').val() === data.child('ts').val()"
criar=f"(!data.exists() && newData.child('uid').val() === auth.uid && {TS} && (newData.hasChild('texto') || newData.hasChild('gif')) && !newData.hasChild('editado') && !newData.hasChild('apagada'))"
editar=f"(data.exists() && data.child('uid').val() === auth.uid && {same} && newData.hasChild('texto') && newData.child('editado').isNumber() && newData.child('editado').val() >= data.child('ts').val() && newData.child('editado').val() <= now && newData.child('editado').val() > now - 60000 && !newData.hasChild('apagada') && newData.hasChild('gif') === data.hasChild('gif') && newData.child('card').val() === data.child('card').val() && newData.child('cardSq').val() === data.child('cardSq').val())"
apagar=f"(data.exists() && (data.child('uid').val() === auth.uid || {ADM}) && {same} && newData.child('apagada').val() === true && !newData.hasChild('texto') && !newData.hasChild('gif') && !newData.hasChild('card') && !newData.hasChild('cardSq') && !newData.hasChild('editado'))"
JAN="newData.val() <= now && newData.val() > now - 60000"
ANO="31622400000"
NOME={".validate":"newData.isString() && newData.val().length >= 1 && newData.val().length <= 40"}
lock=lambda extra: f"(!data.exists() && {extra}) || (data.exists() && newData.val() === data.val())"
AB=lambda sub: P(4,"abertos/' + $canal + '"+sub)
NOVO_ATIVO="!(newData.child('fim').isNumber() && newData.child('fim').val() <= now)"
INV_AB=(f"((newData.child('acesso').val() === 'aberto' && {NOVO_ATIVO} && {AB('/nome')}.val() === newData.child('nome').val())"
  f" || (newData.child('acesso').val() === 'aberto' && !{NOVO_ATIVO} && (!{AB('')}.exists() || {AB('/nome')}.val() === newData.child('nome').val()))"
  f" || (newData.child('acesso').val() !== 'aberto' && !{AB('')}.exists()))")
canal_v=(f"$canal.matches({ID}) && newData.hasChildren(['nome']) && ("
  f"({OFIC} && !newData.hasChild('dono') && !newData.hasChild('tipo') && !newData.hasChild('acesso') && !newData.hasChild('criado') && !newData.hasChild('fim'))"
  f" || ({TEMA} && $canal.matches(/^t-[a-z0-9-]{{3,60}}$/) && newData.hasChildren(['nome','tipo','dono','acesso','criado'])))")
NC="newData.child('c').val()"
RC=lambda path: "root.child('kanban/cardume/" + path + "')"
MSGR="root.child('kanban/cardume/msgs/' + " + NC + " + '/' + newData.child('m').val())"
CANALR="root.child('kanban/cardume/canais/' + " + NC + ")"
MEN_CRIAR=(f"newData.child('de').val() === auth.uid && $uid !== auth.uid && newData.child('c').isString() && newData.child('m').isString()"
  f" && root.child('kanban/cardume/membros/' + {NC} + '/' + auth.uid).val() === true && root.child('kanban/cardume/membros/' + {NC} + '/' + $uid).val() === true"
  f" && (!{NC}.matches(/^t-/) || {CANALR}.exists()) && !({CANALR}.child('fim').isNumber() && {CANALR}.child('fim').val() <= now)"
  f" && {MSGR}.child('uid').val() === auth.uid && {MSGR}.child('apagada').val() !== true && {MSGR}.child('ts').isNumber() && {MSGR}.child('ts').val() > now - 60000"
  f" && newData.child('ts').isNumber() && newData.child('ts').val() <= now && newData.child('ts').val() > now - 60000 && !newData.hasChild('lida')")
MEN_SO_LIDA="newData.child('c').val() === data.child('c').val() && newData.child('m').val() === data.child('m').val() && newData.child('de').val() === data.child('de').val() && newData.child('ts').val() === data.child('ts').val() && newData.child('n').val() === data.child('n').val()"
MEUS5=P(5,"meus/' + $uid + '/' + $canal + '")
block={
 "canais":{"$canal":{
   ".read": f"{G} && ({OFIC} || {R(cpath('acesso'))}.val() === 'aberto' || {MEM} || {GEST('root')})",
   ".write": f"{G} && (({OFIC} && {ADM}) || ({TEMA} && !data.exists() && newData.exists() && newData.child('dono').val() === auth.uid && !root.child('kanban/squads_meta/' + $canal).exists() && !root.child('kanban/cardume/membros/' + $canal).exists() && !root.child('kanban/cardume/msgs/' + $canal).exists() && !root.child('kanban/cardume/admins/' + $canal).exists() && {INV_AB}) || ({TEMA} && data.exists() && newData.exists() && {GEST('root')} && {INV_AB}))",
   ".validate": canal_v,
   "nome": NOME,
   "tipo": {".validate": lock("newData.val() === 'tema'")},
   "dono": {".validate": lock("newData.isString() && newData.val() === auth.uid")},
   "acesso": {".validate": "newData.isString() && newData.val().matches(/^(aberto|convite)$/)"},
   "criado": {".validate": lock(f"newData.isNumber() && {JAN}")},
   "fim": {".validate": f"newData.isNumber() && newData.val() > newData.parent().child('criado').val() && newData.val() <= newData.parent().child('criado').val() + {ANO}"},
   "$outro": {".validate": False}}},
 "admins":{"$canal":{
   ".read": f"{G} && ({GEST('root')} || {MEM})",
   "$uid":{".write": f"{G} && {TEMA} && ({ADM} || {P(5,cpath('dono'))}.val() === auth.uid)",
     ".validate": f"$uid.matches({ID}) && newData.val() === true"}}},
 "membros":{"$canal":{
   ".read": f"{G} && ({GEST('root')} || {MEM})",
   "$uid":{".write": f"{G} && ({GEST(('post',5))} || (auth.uid === $uid && !newData.exists()) || (auth.uid === $uid && newData.val() === true && {TEMA} && {R(cpath('acesso'))}.val() === 'aberto' && {ATIVO('root')})) && ({OFIC} || {P(5,cpath('dono'))}.val() !== $uid || auth.uid === $uid || {ADM}) && ((newData.exists() && {MEUS5}.val() === true) || (!newData.exists() && {MEUS5}.val() !== true))",
     ".validate": f"$canal.matches({ID}) && $uid.matches({ID}) && newData.val() === true"}}},
 "msgs":{"$canal":{
   ".read": f"{G} && ({ADM} || {MEM})", ".indexOn":["ts"],
   "$msgId":{
     ".write": f"{G} && (({ATIVO('root')} && ({OFIC} || root.child('kanban/cardume/canais/' + $canal).exists()) && ((!data.exists() && newData.exists() && {MEM}) || (data.exists() && newData.exists() && data.child('apagada').val() !== true && data.child('uid').val() === auth.uid && {MEM}))) || (data.exists() && newData.exists() && data.child('apagada').val() !== true && {ADM}) || (data.exists() && !newData.exists() && {ADM}))",
     ".validate": f"$canal.matches({ID}) && $msgId.matches({ID}) && newData.hasChildren(['uid','ts']) && newData.hasChild('card') === newData.hasChild('cardSq') && ({criar} || {editar} || {apagar})",
     "uid": {".validate": "(data.exists() && newData.val() === data.val()) || (!data.exists() && newData.isString() && newData.val() === auth.uid)"},
     "ts": {".validate": f"(data.exists() && newData.val() === data.val()) || (!data.exists() && newData.isNumber() && {JAN})"},
     "texto": {".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 4000 && newData.parent().child('apagada').val() !== true && (!data.parent().exists() || (newData.parent().child('editado').isNumber() && newData.parent().child('editado').val() <= now && newData.parent().child('editado').val() > now - 60000))"},
     "card": {".validate": f"newData.isString() && newData.val().matches({ID}) && (!data.parent().exists() || newData.val() === data.val())"},
     "cardSq": {".validate": f"newData.isString() && newData.val().matches({ID}) && (!data.parent().exists() || newData.val() === data.val())"},
     "editado": {".validate": f"newData.isNumber() && data.parent().exists() && {JAN} && newData.val() >= data.parent().child('ts').val()"},
     "gif": {".validate": "newData.hasChildren(['u','w','h']) && (!data.parent().exists() || (data.exists() && newData.child('s').exists() === data.child('s').exists() && newData.child('t').exists() === data.child('t').exists()))",
       "u": {".validate": f"newData.isString() && newData.val().matches({GIF_RE}) && (!data.parent().parent().exists() || newData.val() === data.val())"},
       "s": {".validate": f"newData.isString() && newData.val().matches({GIF_RE}) && (!data.parent().parent().exists() || newData.val() === data.val())"},
       "w": {".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 4096 && (!data.parent().parent().exists() || newData.val() === data.val())"},
       "h": {".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 4096 && (!data.parent().parent().exists() || newData.val() === data.val())"},
       "t": {".validate": "newData.isString() && newData.val().length <= 100 && (!data.parent().parent().exists() || newData.val() === data.val())"},
       "$outro": {".validate": False}},
     "apagada": {".validate": "newData.val() === true && !newData.parent().hasChild('texto') && !newData.parent().hasChild('gif') && !newData.parent().hasChild('card') && !newData.parent().hasChild('cardSq') && !newData.parent().hasChild('editado')"},
     "$outro": {".validate": False}}}},
 "ultima":{"$canal":{
   ".read": f"{G} && ({ADM} || {MEM})",
   ".write": None,
   ".validate": None,
   "ts": {".validate":"newData.isNumber()"}, "uid": {".validate":"newData.isString()"},
   "id": {".validate": f"newData.isString() && newData.val().matches({ID})"},
   "$outro": {".validate": False}}},
 "abertos":{".read": G, "$canal":{
   ".write": f"{G} && {TEMA} && ((newData.exists() && {P(4,cpath('acesso'))}.val() === 'aberto' && {P(4,cpath('nome'))}.val() === newData.child('nome').val() && {ATIVO(('post',4))}) || (!newData.exists() && ({P(4,cpath('acesso'))}.val() !== 'aberto' || {VENC(('post',4))} || {ADM})))",
   ".validate": "newData.hasChildren(['nome'])", "nome": NOME, "$outro": {".validate": False}}},
 "meus":{"$uid":{".read": f"{G} && auth.uid === $uid", ".validate": "newData.hasChildren()",
   "$canal":{".write": f"{G} && (auth.uid === $uid || {GEST(('post',5))}) && ((newData.val() === true && newData.parent().parent().parent().child('membros/' + $canal + '/' + $uid).val() === true) || (!newData.exists() && newData.parent().parent().parent().child('membros/' + $canal + '/' + $uid).val() !== true))",
     ".validate": f"$canal.matches({ID}) && newData.val() === true"}}},
 "mencoes":{"$uid":{".read": f"{G} && auth.uid === $uid", ".indexOn":["ts"],
   "$id":{
     ".write": f"{G} && ((!data.exists() && newData.exists() && {MEN_CRIAR}) || (data.exists() && newData.exists() && auth.uid === $uid && {MEN_SO_LIDA}) || (data.exists() && !newData.exists() && (auth.uid === $uid || {ADM})))",
     ".validate": f"$id.matches({ID}) && newData.hasChildren(['c','m','de','ts','n'])",
     "c": {".validate": f"newData.isString() && newData.val().matches({ID})"},
     "m": {".validate": f"newData.isString() && newData.val().matches({ID})"},
     "n": {".validate": f"newData.isString() && newData.val().matches({ID})"},
     "de": {".validate": "newData.isString()"},
     "ts": {".validate": "newData.isNumber()"},
     "lida": {".validate": "newData.isBoolean()"},
     "$outro": {".validate": False}}}},
 "lidas":{"$uid":{".read": f"{G} && auth.uid === $uid", ".write": f"{G} && auth.uid === $uid", ".validate":"newData.hasChildren()",
   "$canal":{".validate": f"$canal.matches({ID}) && newData.isNumber()"}}},
 "gif_uso":{".read": False, ".write": False},
 "config":{".read": G, ".write": f"{G} && {ADM}",
   "retencao_dias":{".validate":"newData.isNumber() && newData.val() >= 7 && newData.val() <= 3650"}, "$outro":{".validate":False}},
}
M="newData.parent().parent().child('msgs').child($canal).child(newData.child('id').val())"
inv=f"newData.child('uid').val() === auth.uid && newData.child('id').isString() && {M}.child('uid').val() === auth.uid && {M}.child('ts').val() === newData.child('ts').val() && {M}.child('apagada').val() !== true && (!data.exists() || newData.child('ts').val() >= data.child('ts').val())"
u=block['ultima']['$canal']
u['.write']=f"{G} && (({MEM} && {ATIVO('root')} && ({OFIC} || root.child('kanban/cardume/canais/' + $canal).exists()) && newData.exists() && {inv}) || ({ADM} && !newData.exists()))"
u['.validate']=f"$canal.matches({ID}) && newData.hasChildren(['ts','uid','id']) && newData.child('uid').val() === auth.uid && {TS}"
p='database.rules.json'; s=open(p).read()
txt=json.dumps({"cardume":block},ensure_ascii=False,indent=2)
inner="\n".join(("      "+l[2:]) if l.startswith("  ") else l for l in txt.split("\n")[1:-1]).rstrip()
lines=s.split("\n")
i=next(x for x,l in enumerate(lines) if l.startswith('      "cardume": {'))
j=next(x for x,l in enumerate(lines) if x>i and l.startswith('      "agente_painel": {'))
lines[i:j]=[inner+","]; out="\n".join(lines); json.loads(out); open(p,'w').write(out)
blk="\n".join(lines[i:i+1])
print('ok', inner.count('$squad'))
