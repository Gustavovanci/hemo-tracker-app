// ============================================================================
// SERVICE WORKER - HEMOFLOW v3.0 ENHANCED
// ============================================================================
// Funcionalidades avançadas:
// - Cache inteligente estratificado
// - Sincronização em background
// - Notificações push inteligentes
// - Analytics offline
// - Backup automático de dados
// ============================================================================

const CACHE_VERSION = 'hemoflow-v3.0.1';
const CACHE_NAMES = {
  STATIC: `${CACHE_VERSION}-static`,
  DYNAMIC: `${CACHE_VERSION}-dynamic`,
  API: `${CACHE_VERSION}-api`,
  IMAGES: `${CACHE_VERSION}-images`,
  FONTS: `${CACHE_VERSION}-fonts`
};

// Arquivos essenciais (sempre em cache)
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/script.js',
  '/output.css',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

// Fontes e recursos externos
const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2'
];

// APIs que não devem ser cacheadas
const API_ENDPOINTS = [
  'https://script.google.com',
  'googleapis.com',
  'google.com/apis'
];

// Configurações avançadas
const CONFIG = {
  MAX_CACHE_SIZE: 50, // MB
  CACHE_EXPIRY_TIME: 7 * 24 * 60 * 60 * 1000, // 7 dias
  BACKGROUND_SYNC_TAG: 'hemoflow-sync',
  NOTIFICATION_TAG: 'hemoflow-notification',
  ANALYTICS_BATCH_SIZE: 10
};

// ===== INSTALL EVENT =====
self.addEventListener('install', event => {
  console.log('[SW] 🚀 Instalando HemoFlow Service Worker v3.0...');
  
  event.waitUntil(
    Promise.all([
      // Cache crítico
      caches.open(CACHE_NAMES.STATIC).then(cache => {
        console.log('[SW] 📦 Cacheando recursos críticos...');
        return cache.addAll(CRITICAL_ASSETS);
      }),
      
      // Cache de fontes
      caches.open(CACHE_NAMES.FONTS).then(cache => {
        console.log('[SW] 🔤 Cacheando fontes...');
        return cache.addAll(EXTERNAL_ASSETS);
      }),
      
      // Inicializar storage local para analytics
      initializeOfflineStorage()
    ]).then(() => {
      console.log('[SW] ✅ Instalação concluída');
      return self.skipWaiting();
    })
  );
});

// ===== ACTIVATE EVENT =====
self.addEventListener('activate', event => {
  console.log('[SW] 🔄 Ativando Service Worker v3.0...');
  
  event.waitUntil(
    Promise.all([
      // Limpar caches antigos
      cleanupOldCaches(),
      
      // Configurar background sync
      setupBackgroundSync(),
      
      // Configurar notificações
      setupNotifications()
    ]).then(() => {
      console.log('[SW] ✅ Ativação concluída');
      return self.clients.claim();
    })
  );
});

// ===== FETCH EVENT - ESTRATÉGIA INTELIGENTE =====
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requisições não-HTTP
  if (!request.url.startsWith('http')) {
    return;
  }

  // Estratégia baseada no tipo de recurso
  if (isApiRequest(request.url)) {
    event.respondWith(handleApiRequest(request));
  } else if (isImageRequest(request.url)) {
    event.respondWith(handleImageRequest(request));
  } else if (isFontRequest(request.url)) {
    event.respondWith(handleFontRequest(request));
  } else {
    event.respondWith(handleStaticRequest(request));
  }
});

// ===== BACKGROUND SYNC =====
self.addEventListener('sync', event => {
  console.log('[SW] 🔄 Background sync:', event.tag);
  
  if (event.tag === CONFIG.BACKGROUND_SYNC_TAG) {
    event.waitUntil(syncOfflineData());
  }
  
  if (event.tag === 'analytics-sync') {
    event.waitUntil(syncAnalyticsData());
  }
});

// ===== PUSH NOTIFICATIONS =====
self.addEventListener('push', event => {
  console.log('[SW] 📱 Push notification recebida');
  
  let notificationData = {
    title: 'HemoFlow',
    body: 'Nova atualização disponível',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png'
  };

  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = { ...notificationData, ...pushData };
    } catch (error) {
      console.log('[SW] ⚠️ Erro ao processar dados do push:', error);
    }
  }

  const notificationOptions = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      timestamp: Date.now(),
      url: notificationData.url || '/'
    },
    actions: [
      {
        action: 'open',
        title: 'Abrir HemoFlow',
        icon: '/icons/icon-192x192.png'
      },
      {
        action: 'dismiss',
        title: 'Dispensar',
        icon: '/icons/icon-72x72.png'
      }
    ],
    tag: CONFIG.NOTIFICATION_TAG,
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationOptions)
  );
});

// ===== NOTIFICATION CLICK =====
self.addEventListener('notificationclick', event => {
  console.log('[SW] 🔔 Notificação clicada:', event.action);
  
  event.notification.close();

  const actionHandlers = {
    open: () => openApp(event.notification.data.url),
    dismiss: () => console.log('[SW] Notificação dispensada'),
    default: () => openApp()
  };

  const handler = actionHandlers[event.action] || actionHandlers.default;
  event.waitUntil(handler());
});

// ===== MESSAGE HANDLING =====
self.addEventListener('message', event => {
  console.log('[SW] 📨 Mensagem recebida:', event.data);
  
  const messageHandlers = {
    'SKIP_WAITING': () => self.skipWaiting(),
    'GET_VERSION': () => respondToClient(event, { version: CACHE_VERSION }),
    'CLEAR_CACHE': () => clearAllCaches(),
    'FORCE_SYNC': () => forceSyncData(),
    'GET_CACHE_STATUS': () => getCacheStatus().then(status => respondToClient(event, status))
  };

  const handler = messageHandlers[event.data?.type];
  if (handler) {
    event.waitUntil(handler());
  }
});

// ============================================================================
// FUNÇÕES DE MANIPULAÇÃO DE REQUESTS
// ============================================================================

async function handleApiRequest(request) {
  const cacheName = CACHE_NAMES.API;
  
  try {
    // Tenta buscar da rede primeiro
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Salva no cache apenas respostas válidas
      const cache = await caches.open(cacheName);
      await cache.put(request, networkResponse.clone());
      
      // Registra sucesso offline
      await logOfflineEvent('API_SUCCESS', request.url);
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('[SW] 📡 Rede indisponível, tentando cache...');
    
    // Fallback para cache
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Agenda sync em background
      await scheduleBackgroundSync();
      await logOfflineEvent('API_CACHED', request.url);
      return cachedResponse;
    }
    
    // Retorna resposta offline personalizada
    return createOfflineResponse(request);
  }
}

async function handleImageRequest(request) {
  const cache = await caches.open(CACHE_NAMES.IMAGES);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Retorna imagem placeholder
    return createPlaceholderImage();
  }
}

async function handleFontRequest(request) {
  const cache = await caches.open(CACHE_NAMES.FONTS);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] ⚠️ Fonte não disponível offline:', request.url);
    return new Response('', { status: 404 });
  }
}

async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAMES.STATIC);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Cache hit - verifica se precisa atualizar
    updateResourceInBackground(request);
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Salva no cache dinâmico
      const dynamicCache = await caches.open(CACHE_NAMES.DYNAMIC);
      await dynamicCache.put(request, networkResponse.clone());
      
      // Gerencia tamanho do cache
      await manageCacheSize(CACHE_NAMES.DYNAMIC);
    }
    
    return networkResponse;
    
  } catch (error) {
    // Fallback para página offline
    if (request.destination === 'document') {
      const cache = await caches.open(CACHE_NAMES.STATIC);
      return cache.match('/index.html');
    }
    
    return new Response('Recurso não disponível offline', { status: 404 });
  }
}

// ============================================================================
// FUNÇÕES DE BACKGROUND SYNC
// ============================================================================

async function syncOfflineData() {
  console.log('[SW] 🔄 Sincronizando dados offline...');
  
  try {
    const offlineData = await getOfflineData();
    
    if (offlineData.length === 0) {
      console.log('[SW] ✅ Nenhum dado para sincronizar');
      return;
    }
    
    for (const item of offlineData) {
      try {
        await sendDataToServer(item);
        await markDataAsSynced(item.id);
        console.log('[SW] ✅ Item sincronizado:', item.id);
      } catch (error) {
        console.log('[SW] ❌ Erro ao sincronizar item:', item.id, error);
      }
    }
    
    // Notifica sucesso
    await showSyncNotification(offlineData.length);
    
  } catch (error) {
    console.error('[SW] ❌ Erro na sincronização:', error);
  }
}

async function syncAnalyticsData() {
  console.log('[SW] 📊 Sincronizando analytics...');
  
  try {
    const analyticsData = await getAnalyticsData();
    
    if (analyticsData.length > 0) {
      // Envia em lotes
      const batches = createBatches(analyticsData, CONFIG.ANALYTICS_BATCH_SIZE);
      
      for (const batch of batches) {
        await sendAnalyticsBatch(batch);
      }
      
      await clearAnalyticsData();
      console.log('[SW] ✅ Analytics sincronizados');
    }
    
  } catch (error) {
    console.error('[SW] ❌ Erro na sincronização de analytics:', error);
  }
}

// ============================================================================
// FUNÇÕES DE CACHE MANAGEMENT
// ============================================================================

async function cleanupOldCaches() {
  console.log('[SW] 🧹 Limpando caches antigos...');
  
  const cacheNames = await caches.keys();
  const currentCacheNames = Object.values(CACHE_NAMES);
  
  const deletePromises = cacheNames
    .filter(cacheName => !currentCacheNames.includes(cacheName))
    .map(cacheName => {
      console.log('[SW] 🗑️ Removendo cache:', cacheName);
      return caches.delete(cacheName);
    });
    
  await Promise.all(deletePromises);
  console.log('[SW] ✅ Limpeza de cache concluída');
}

async function manageCacheSize(cacheName) {
  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  
  if (requests.length > 100) { // Limite de itens
    // Remove os 20 mais antigos
    const itemsToDelete = requests.slice(0, 20);
    await Promise.all(itemsToDelete.map(request => cache.delete(request)));
    
    console.log('[SW] 🧹 Cache reduzido:', cacheName);
  }
}

async function getCacheStatus() {
  const cacheNames = await caches.keys();
  const status = {};
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    status[cacheName] = {
      itemCount: keys.length,
      lastModified: Date.now() // Simulado
    };
  }
  
  return {
    version: CACHE_VERSION,
    caches: status,
    totalCaches: cacheNames.length
  };
}

// ============================================================================
// FUNÇÕES DE STORAGE E DADOS
// ============================================================================

async function initializeOfflineStorage() {
  // Inicializa IndexedDB para dados offline
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('HemoFlowDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      
      // Store para dados não sincronizados
      if (!db.objectStoreNames.contains('offlineData')) {
        const offlineStore = db.createObjectStore('offlineData', { keyPath: 'id', autoIncrement: true });
        offlineStore.createIndex('timestamp', 'timestamp', { unique: false });
        offlineStore.createIndex('synced', 'synced', { unique: false });
      }
      
      // Store para analytics
      if (!db.objectStoreNames.contains('analytics')) {
        const analyticsStore = db.createObjectStore('analytics', { keyPath: 'id', autoIncrement: true });
        analyticsStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // Store para logs
      if (!db.objectStoreNames.contains('logs')) {
        const logsStore = db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
        logsStore.createIndex('timestamp', 'timestamp', { unique: false });
        logsStore.createIndex('type', 'type', { unique: false });
      }
    };
  });
}

async function getOfflineData() {
  const db = await initializeOfflineStorage();
  const transaction = db.transaction(['offlineData'], 'readonly');
  const store = transaction.objectStore('offlineData');
  const index = store.index('synced');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(false); // não sincronizados
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function logOfflineEvent(type, url, data = {}) {
  try {
    const db = await initializeOfflineStorage();
    const transaction = db.transaction(['logs'], 'readwrite');
    const store = transaction.objectStore('logs');
    
    const logEntry = {
      type,
      url,
      data,
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };
    
    store.add(logEntry);
  } catch (error) {
    console.error('[SW] Erro ao registrar log:', error);
  }
}

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

function isApiRequest(url) {
  return API_ENDPOINTS.some(endpoint => url.includes(endpoint));
}

function isImageRequest(url) {
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url) || url.includes('/icons/');
}

function isFontRequest(url) {
  return /\.(woff|woff2|ttf|eot)$/i.test(url) || url.includes('fonts.');
}

async function scheduleBackgroundSync() {
  try {
    await self.registration.sync.register(CONFIG.BACKGROUND_SYNC_TAG);
    console.log('[SW] 📅 Background sync agendado');
  } catch (error) {
    console.log('[SW] ⚠️ Background sync não disponível:', error);
  }
}

async function openApp(url = '/') {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  
  for (const client of clients) {
    if (client.url.includes(self.location.origin)) {
      await client.focus();
      if (url !== '/') {
        client.navigate(url);
      }
      return;
    }
  }
  
  // Abre nova janela se não encontrou uma existente
  await self.clients.openWindow(url);
}

function respondToClient(event, data) {
  if (event.ports && event.ports[0]) {
    event.ports[0].postMessage(data);
  }
}

function createOfflineResponse(request) {
  if (request.destination === 'document') {
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>HemoFlow - Offline</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              display: flex; align-items: center; justify-content: center;
              min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea, #764ba2);
              color: white; text-align: center;
            }
            .container { max-width: 400px; padding: 2rem; }
            .icon { font-size: 4rem; margin-bottom: 1rem; }
            h1 { margin: 0 0 1rem 0; }
            p { opacity: 0.8; line-height: 1.5; }
            button { 
              background: rgba(255,255,255,0.2); border: none; color: white;
              padding: 0.75rem 1.5rem; border-radius: 0.5rem; margin-top: 1rem;
              cursor: pointer; font-size: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">📱</div>
            <h1>HemoFlow</h1>
            <p>Você está offline. O aplicativo continuará funcionando com os dados em cache.</p>
            <button onclick="location.reload()">Tentar Novamente</button>
          </div>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  return new Response(JSON.stringify({
    error: 'Offline',
    message: 'Este recurso não está disponível offline',
    timestamp: new Date().toISOString()
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

function createPlaceholderImage() {
  // SVG placeholder simples
  const svg = `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#9ca3af">
        Imagem não disponível offline
      </text>
    </svg>
  `;
  
  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml' }
  });
}

async function updateResourceInBackground(request) {
  // Atualiza recursos em background sem bloquear a resposta
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAMES.STATIC);
      await cache.put(request, networkResponse);
    }
  } catch (error) {
    // Silenciosamente falha - usuário já tem a versão em cache
  }
}

function createBatches(array, batchSize) {
  const batches = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

async function setupBackgroundSync() {
  // Configura background sync se disponível
  if ('sync' in self.registration) {
    console.log('[SW] ✅ Background Sync disponível');
  } else {
    console.log('[SW] ⚠️ Background Sync não disponível');
  }
}

async function setupNotifications() {
  // Configura notificações se disponível
  if ('showNotification' in self.registration) {
    console.log('[SW] ✅ Notificações disponíveis');
  } else {
    console.log('[SW] ⚠️ Notificações não disponíveis');
  }
}

// Funções stub para implementação futura
async function sendDataToServer(data) { /* Implementar */ }
async function markDataAsSynced(id) { /* Implementar */ }
async function showSyncNotification(count) { /* Implementar */ }
async function getAnalyticsData() { return []; }
async function sendAnalyticsBatch(batch) { /* Implementar */ }
async function clearAnalyticsData() { /* Implementar */ }
async function clearAllCaches() { /* Implementar */ }
async function forceSyncData() { /* Implementar */ }

// ============================================================================
// LOG DE INICIALIZAÇÃO
// ============================================================================

console.log(`
🚀 HemoFlow Service Worker v3.0 Carregado!
📅 ${new Date().toISOString()}
🔧 Recursos: Cache Inteligente, Background Sync, Push Notifications
💾 Cache Version: ${CACHE_VERSION}
`);