#!/usr/bin/env python3
"""Revalida as âncoras `nome — Lnnnn` / `nome (~Lnnnn)` do CODE_MAP.md contra as declarações reais.
Uso (da raiz do repo):  python3 .claude/skills/atualizarcodemap/revalidar_ancoras.py          # só relata
                         python3 .claude/skills/atualizarcodemap/revalidar_ancoras.py apply    # corrige as que só andaram de linha
Só mexe quando o nome tem UMA declaração no arquivo da seção (function X / const|let|var X / X = ...). Casos que ele
não consegue parear (vários nomes × números diferentes, nomes de CSS, números em linha seguinte) saem em `skip`/`miss`
e ficam pra revisão manual. A faixa de linhas do CODE_MAP -> arquivo está em fileFor(): AJUSTE quando as seções mudarem
(2026-10-10: kanban <2701 · painel 2701-2968 · okr-dev 2968-3519 · painel 3519-3746 · oceano 3746-3758 · apresentação 3758-3914).
Lições: confira SEMPRE 1 caso à mão antes de aceitar o relatório; um drift quase uniforme por seção é normal, um número que
anda MUITO diferente dos vizinhos merece olhar. Referências soltas (prosa, CSS) não são cobertas."""
import re,sys,json
import os
R=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..','..'))+'/'
lines=open(R+'CODE_MAP.md',encoding='utf-8').read().split('\n')
files={k:open(R+v,encoding='utf-8',errors='replace').read().split('\n') for k,v in {'k':'kanban-dev.html','p':'painel-dev.html','o':'okr-dev.html','oc':'oceano-dev.html','a':'okr-apresentacao.slide.html'}.items()}
# faixa -> arquivo (1-based linhas do CODE_MAP)
def fileFor(n):
    if n<2701: return 'k'
    if n<2968: return 'p'
    if n<3519: return 'o'
    if n<3746: return 'p'
    if n<3758: return 'oc'
    if n<3914: return 'a'
    return None
declcache={}
def find(fk,name):
    key=(fk,name)
    if key in declcache: return declcache[key]
    L=files[fk]
    pats=[re.compile(r'^\s*(async\s+)?function\s+'+re.escape(name)+r'\b'), re.compile(r'^\s*(const|let|var)\s+'+re.escape(name)+r'\b'), re.compile(r'^\s*(window\.)?'+re.escape(name)+r'\s*=\s*\S')]
    out=[]
    for pi,p in enumerate(pats):
        for i,l in enumerate(L):
            if p.search(l): out.append(i+1)
        if out: break
    declcache[key]=out; return out
entry=re.compile(r'((?:`[^`\n]+`\*{0,2}(?:\s*\([^)`]{0,30}\))?\s*(?:/|,|\+)?\s*)+)(?:\s*\(\s*|\s*[—–-]\s*|\s*,\s*)?(?:~|perto de |perto da |em |aprox\. )?L(\d+(?:\s*/\s*L?\d+)*)')
res={'ok':0,'drift':[],'miss':[],'amb':[],'skip':[]}
edits=[]
for idx,l0 in enumerate(lines,1):
    fk=fileFor(idx)
    if not fk: continue
    prev=lines[idx-2] if idx>1 else ''
    l=prev+' '+l0; off=len(prev)+1
    for m in entry.finditer(l):
        if m.start(2)<off: continue
        names=re.findall(r'`([^`]+)`',m.group(1))
        nums=[int(x) for x in re.findall(r'\d+',m.group(2))]
        idents=[]
        for n in names:
            mm=re.match(r'([A-Za-z_$][\w$.]*)',n)
            idents.append(mm.group(1).split('.')[-1] if mm else None)
        if len(idents)!=len(nums):
            res['skip'].append((idx,names,nums)); continue
        numpos=[(m.start(2)+q.start()-off, m.start(2)+q.end()-off) for q in re.finditer(r'\d+',m.group(2))]
        for (nm,num),pos in zip(zip(idents,nums),numpos):
            if not nm or len(nm)<4: res['skip'].append((idx,nm,num)); continue
            d=find(fk,nm)
            if not d: res['miss'].append((idx,nm,num)); continue
            if num in d: res['ok']+=1; continue
            if len(d)>1: res['amb'].append((idx,nm,num,d[:4])); continue
            res['drift'].append((idx,nm,num,d[0])); edits.append((idx,pos[0],pos[1],nm,num,d[0]))
print({k:(v if isinstance(v,int) else len(v)) for k,v in res.items()})

if len(sys.argv)>1 and sys.argv[1]=='apply':
    from collections import defaultdict
    by=defaultdict(list)
    for e in edits: by[e[0]].append(e)
    for idx,es in by.items():
        l=lines[idx-1]
        for e in sorted(es,key=lambda e:-e[1]):
            l=l[:e[1]]+str(e[5])+l[e[2]:]
        lines[idx-1]=l
    open(R+'CODE_MAP.md','w',encoding='utf-8').write('\n'.join(lines))
    print('aplicado',len(edits))
