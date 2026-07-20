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
