// Fake mínimo de Realtime Database pros testes de Sprint 3 (checklist_item,
// agent_status, mover_coluna, editar_campos e notificações) — precisam
// exercitar get()/update()/transaction() de verdade (não só chamar
// transform() isolado) porque boa parte da lógica nova mora no hook
// `after`, que só roda dentro de applyWritePlan(). Sem emulador, mesmo
// espírito dos outros testes deste diretório.

function makeFakeDb(initialData) {
  let data = JSON.parse(JSON.stringify(initialData || {}));
  let _pushSeq = 0;

  function getAt(path) {
    const parts = path.split('/').filter(Boolean);
    let cur = data;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  function setAt(path, value) {
    const parts = path.split('/').filter(Boolean);
    if (!parts.length) {
      data = value;
      return;
    }
    let cur = data;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (cur[p] == null || typeof cur[p] !== 'object') cur[p] = {};
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function ref(path) {
    return {
      key: path.split('/').filter(Boolean).pop() || null,
      async get() {
        const v = getAt(path);
        return { val: () => (v === undefined ? null : v), exists: () => v !== undefined && v !== null };
      },
      async update(patch) {
        const cur = getAt(path);
        const merged = { ...(cur && typeof cur === 'object' ? cur : {}), ...patch };
        setAt(path, merged);
      },
      async set(value) {
        setAt(path, value);
      },
      async transaction(transform) {
        const cur = getAt(path);
        const newVal = transform(cur === undefined ? null : cur);
        setAt(path, newVal);
        return { committed: true, snapshot: { val: () => newVal } };
      },
      // push(): key determinístico o bastante pra teste (sem colisão dentro
      // de uma mesma instância de fake db) — não precisa parecer um push-id
      // real do Firebase, só precisa ser único.
      push() {
        _pushSeq += 1;
        const key = 'fakepush' + _pushSeq;
        return ref(`${path}/${key}`);
      },
    };
  }

  return { ref, _data: () => data };
}

module.exports = { makeFakeDb };
