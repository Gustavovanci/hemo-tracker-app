// ============================================================================
// SERVICE WORKER - HEMOFLOW v3.1 ROBUST
// - Adicionado suporte a notificações interativas para ações em background.
// - Lógica de cache e sync mantida.
// ============================================================================

const CACHE_VERSION = 'hemoflow-v3.1.0';
const CACHE_NAMES = {
  STATIC: `${CACHE_VERSION}-static`,
  DYNAMIC: `${CACHE_VERSION}-dynamic`,
  API: `${CACHE_VERSION}-api`,
  IMAGES: `${CACHE_VERSION}-images`,
  FONTS: `${CACHE_VERSION}-fonts`
};

const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/script.js',
  '/output.css',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://unpkg.com/@zxing/library@latest/umd/zxing.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAMES.STATIC).then(cache => {
      console.log('[SW] Cacheando recursos críticos...');
      return cache.addAll(CRITICAL_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAMES.STATIC)
                  .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Estratégia Cache-First para assets estáticos
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request).then(networkResponse => {
        // Cacheia dinamicamente novos recursos
        return caches.open(CACHE_NAMES.DYNAMIC).then(cache => {
          cache.put(event.request.url, networkResponse.clone());
          return networkResponse;
        });
      });
    })
  );
});


// ============================================================================
// NOVA LÓGICA DE NOTIFICAÇÕES E MENSAGENS
// ============================================================================

self.addEventListener('message', event => {
  console.log('[SW] Mensagem recebida:', event.data);
  
  const messageHandlers = {
    'SCHEDULE_PROCEDURE_NOTIFICATION': (data) => scheduleProcedureNotification(data)
  };

  const handler = messageHandlers[event.data?.type];
  if (handler) {
    event.waitUntil(handler(event.data.payload));
  }
});

function scheduleProcedureNotification(payload) {
    console.log('[SW] Agendando notificação para:', payload.stepName);
    const options = {
        body: `Procedimento "${payload.stepName}" iniciado. Toque para registrar o término.`,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        vibrate: [200, 100, 200],
        requireInteraction: true, // Mantém a notificação até ser dispensada
        data: {
            nextStepName: payload.nextStepName
        },
        actions: [
            { action: 'end_step', title: `Registrar "${payload.nextStepName}"` },
            { action: 'open_app', title: 'Abrir App' }
        ]
    };
    return self.registration.showNotification('HemoFlow - Procedimento Ativo', options);
}


self.addEventListener('notificationclick', event => {
    const nextStepName = event.notification.data.nextStepName;
    event.notification.close();

    async function handleAction() {
        if (event.action === 'end_step') {
            console.log(`[SW] Ação de notificação: Registrar "${nextStepName}"`);
            
            // A melhor prática é comunicar os clientes abertos para que eles atualizem o estado.
            const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
            clients.forEach(client => {
                client.postMessage({ type: 'MARK_STEP_FROM_SW', payload: { stepName: nextStepName } });
            });
            
        } else { // 'open_app' ou clique no corpo da notificação
            const clients = await self.clients.matchAll({ type: 'window' });
            if (clients.length > 0) {
                await clients[0].focus();
            } else {
                await self.clients.openWindow('/');
            }
        }
    }
    
    event.waitUntil(handleAction());
});