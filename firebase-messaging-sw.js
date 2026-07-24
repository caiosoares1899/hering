// firebase-messaging-sw.js
// Precisa ficar na RAIZ do domínio (mesmo nível de kanban.html), porque o
// escopo padrão de um Service Worker é a pasta onde o arquivo está — se ele
// ficar numa subpasta, só cobre páginas dentro dela.
//
// Este arquivo roda em background (fora da aba), então usa a versão
// "compat" do SDK do Firebase via importScripts — Service Workers não
// suportam import ES modules da mesma forma que o kanban.html.
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
// Mesma config pública já usada no kanban.html — esses valores não são
// segredo (são enviados pro navegador de qualquer forma), a segurança real
// está nas Regras do Realtime Database, não aqui.
firebase.initializeApp({
  apiKey: 'AIzaSyBzCOFtPCpaxUcLqX5Sq1GxYL2yAWnDAWU',
  authDomain: 'hering-onboarding.firebaseapp.com',
  databaseURL: 'https://hering-onboarding-default-rtdb.firebaseio.com',
  projectId: 'hering-onboarding',
  storageBucket: 'hering-onboarding.firebasestorage.app',
  messagingSenderId: '122502391131',
  appId: '1:122502391131:web:0a31bed5ed2494e16ba67e',
});
const messaging = firebase.messaging();

// ═══════════════════════════════════════════════════════════════════
// CACHE OFFLINE (movido pra cá — antes era um segundo Service Worker,
// registrado via blob: no kanban.html, disputando o MESMO escopo (raiz do
// domínio) que este arquivo. Dois SWs no mesmo escopo é uma causa clássica
// de push "sumir" no Chrome: o navegador pode entregar o evento de push pro
// worker errado (o de cache, que não tem handler nenhum pra isso), e nada
// acontece — mesmo com o token válido e a Cloud Function disparando normal.
// Unificar num arquivo só elimina essa disputa. Mesma lógica de antes:
// stale-while-revalidate, pulando chamadas de API (Firebase/Google/Workers).
// ═══════════════════════════════════════════════════════════════════
const CACHE = 'kanban-hering-v2'; // bump: purga cache antigo com a estratégia stale-first pra HTML/version.json
self.addEventListener('install', (e) => {
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Cache.put() só aceita esquemas http/https — sem esse filtro, requisições de
  // extensões do Chrome (chrome-extension://...) ou outras origens não-http que passam
  // pelo fetch do navegador quebram o cache.put() com TypeError.
  if (!e.request.url.startsWith('http')) return;
  if (
    e.request.url.includes('firebaseio.com') ||
    e.request.url.includes('googleapis.com') ||
    e.request.url.includes('workers.dev')
  )
    return;

  // version.json e as páginas HTML (navegação) alimentam o mecanismo de
  // auto-update do kanban/painel: a página compara a versão que carregou
  // contra version.json e recarrega se estiver desatualizada. Servir essas
  // duas coisas "stale-first" (cache antes da rede, como o resto abaixo)
  // quebra esse mecanismo — o board podia abrir com o HTML antigo do
  // cache E comparar contra um version.json TAMBÉM antigo (do mesmo
  // cache), sem detectar divergência nenhuma, até uma leitura POSTERIOR
  // (já com o cache atualizado em segundo plano) finalmente pegar a
  // diferença — dava a sensação de "abriu na versão velha, atualizei nada
  // mudou, atualizei de novo e aí sim veio a nova". Por isso essas duas
  // coisas vão network-first (cache só como fallback se a rede falhar, pra
  // continuar funcionando offline); o resto (imagens, libs de terceiros
  // etc., que não participam do check de versão) continua como antes.
  const isVersionCheck = /version\.json(\?|$)/.test(e.request.url);
  const isNavigation = e.request.mode === 'navigate' || e.request.destination === 'document';
  if (isVersionCheck || isNavigation) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fresh = fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});

// Dispara quando chega um push com a aba FECHADA ou em background.
// (Com a aba em primeiro plano, quem trata é o onMessage() no kanban.html —
// isso evita notificação duplicada quando a pessoa já está olhando o board.)
// A Cloud Function manda só "data" (não "notification") de propósito — se
// mandasse os dois juntos, alguns navegadores (Safari/iOS em especial) já
// exibem a notificação sozinhos automaticamente ANTES deste código rodar,
// e então isso aqui mostrava de novo por cima, duplicando o aviso.
messaging.onBackgroundMessage((payload) => {
  const title = payload.data?.title || 'Maré Digital';
  const options = {
    body: payload.data?.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.data?.tag || 'mare-digital-notif', // evita empilhar notificações repetidas
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});
// Clique na notificação → abre (ou foca) o board, opcionalmente já no card certo
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/kanban.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('kanban') && 'focus' in client) {
          if (event.notification.data?.url) client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
