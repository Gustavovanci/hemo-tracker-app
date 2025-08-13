// Service Worker para HemoFlow
// Versão 2.0 - Cache avançado e sincronização

const CACHE_NAME = 'hemoflow-cache-v2.0';
const DATA_CACHE_NAME = 'hemoflow-data-cache-v2.0';

// Arquivos para cache (core da aplicação)
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/script.js',
  '/output.css',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://unpkg.com/html5-qrcode/html5-qrcode.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2'
];

// URLs da API (não fazer cache)
const API_URLS = [
  'https://script.google.com'
];

// Install - Faz cache dos arquivos essenciais
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker v2.0');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Fazendo cache dos arquivos principais');
        return cache.addAll(FILES_TO_CACHE);
      })
      .then(() => {
        // Força a ativação imediata
        return self.skipWaiting();
      })
  );
});

// Activate - Limpa caches antigos
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando Service Worker v2.0');
  
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
          console.log('[SW] Removendo cache antigo:', key);
          return caches.delete(key);
        }
      }));
    }).then(() => {
      // Assume controle imediatamente
      return self.clients.claim();
    })
  );
});

// Fetch - Estratégia de cache inteligente
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requisições não-HTTP
  if (!request.url.startsWith('http')) {
    return;
  }

  // Estratégia para APIs (sempre rede, fallback cache)
  if (isApiRequest(request.url)) {
    event.respondWith(
      caches.open(DATA_CACHE_NAME).then((cache) => {
        return fetch(request)
          .then((response) => {
            // Só faz cache de respostas válidas
            if (response.status === 200) {
              cache.put(request.url, response.clone());
            }
            return response;
          })
          .catch(() => {
            // Fallback para cache em caso de erro de rede
            return cache.match(request);
          });
      })
    );
    return;
  }

  // Estratégia para recursos estáticos (cache first)
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[SW] Servindo do cache:', request.url);
          return cachedResponse;
        }

        // Se não está no cache, busca da rede
        return fetch(request).then((response) => {
          // Só faz cache de respostas válidas
          if (response.status === 200 && shouldCache(request)) {
            console.log('[SW] Adicionando ao cache:', request.url);
            cache.put(request, response.clone());
          }
          return response;
        }).catch((error) => {
          console.log('[SW] Erro na rede:', error);
          // Fallback para página offline se disponível
          if (request.destination === 'document') {
            return cache.match('/index.html');
          }
        });
      });
    })
  );
});

// Background Sync - Para sincronizar dados quando voltar online
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'background-sync-hemoflow') {
    event.waitUntil(syncData());
  }
});

// Push Notifications - Para notificações futuras
self.addEventListener('push', (event) => {
  console.log('[SW] Push recebido:', event);
  
  const options = {
    body: event.data ? event.data.text() : 'Nova notificação do HemoFlow',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Abrir App',
        icon: '/icons/icon-192x192.png'
      },
      {
        action: 'close',
        title: 'Fechar',
        icon: '/icons/icon-192x192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('HemoFlow', options)
  );
});

// Click em notificação
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notificação clicada:', event);
  
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // Apenas fecha a notificação
  } else {
    // Click padrão na notificação
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Message - Comunicação com a página
self.addEventListener('message', (event) => {
  console.log('[SW] Mensagem recebida:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// ===== FUNÇÕES AUXILIARES =====

function isApiRequest(url) {
  return API_URLS.some(apiUrl => url.includes(apiUrl));
}

function shouldCache(request) {
  // Não faz cache de:
  // - Requisições POST/PUT/DELETE
  // - URLs com parâmetros de busca específicos
  // - Recursos muito grandes
  
  if (request.method !== 'GET') return false;
  
  const url = new URL(request.url);
  
  // Não faz cache de URLs com timestamp
  if (url.searchParams.has('_t') || url.searchParams.has('timestamp')) {
    return false;
  }
  
  return true;
}

async function syncData() {
  try {
    console.log('[SW] Sincronizando dados...');
    
    // Aqui você pode implementar lógica para:
    // - Enviar dados armazenados localmente
    // - Sincronizar com Google Sheets
    // - Reenviar falhas de upload
    
    const cache = await caches.open(DATA_CACHE_NAME);
    const requests = await cache.keys();
    
    console.log('[SW] Dados para sincronizar:', requests.length);
    
    // Implementar lógica de sincronização aqui
    
  } catch (error) {
    console.error('[SW] Erro na sincronização:', error);
  }
}

// Limpeza automática de cache antigo
setInterval(() => {
  caches.keys().then((cacheNames) => {
    cacheNames.forEach((cacheName) => {
      // Remove caches com mais de 7 dias
      if (cacheName.includes('hemoflow') && !cacheName.includes('v2.0')) {
        console.log('[SW] Removendo cache expirado:', cacheName);
        caches.delete(cacheName);
      }
    });
  });
}, 24 * 60 * 60 * 1000); // 24 horas

console.log('[SW] Service Worker HemoFlow v2.0 carregado');