/*
  HemoFlow Coletor v6.3
  - Adicionado botão de ativação explícito para a câmara para máxima compatibilidade móvel.
  - O pedido de permissão agora é acionado por uma ação direta do utilizador.
*/
document.addEventListener('DOMContentLoaded', () => {

  const URL_BACKEND = "https://script.google.com/macros/s/AKfycbxrzqXbsqBtrqAqpzm901vz-Ro0XJyabgKsBtApi8IgVUZJ_JAwbJ2xSPfh8wZB5lnD/exec";

  let appState = {
    currentStepId: null,
    patientId: null,
    selectedSala: null,
    stepTimes: {},
  };

  let codeReader = null;
  let isScanning = false;
  let mediaStream = null; // Para guardar a referência do stream da câmara

  const STEP_DEFINITIONS = [
    { id: 'welcome', index: 0 },
    { id: 'scanner', index: 1 },
    { id: 'room-selection', index: 2 },
    ...Array(9).fill().map((_, i) => ({ id: `timeline-${i+1}`, index: 3 + i, isTimeline: true })),
    { id: 'final', index: 12 },
    { id: 'success', index: 13 },
  ];

  const TIMELINE_STEP_NAMES = [
    'Chegada na Hemodinâmica', 'Entrada na Sala', 'Início da Cobertura', 
    'Término da Cobertura', 'Início do Procedimento', 'Término do Procedimento',
    'Saída da Sala', 'Início da Limpeza', 'Término da Limpeza'
  ];

  const mainContainer = document.querySelector('main.app-container');

  function init() {
    if (!mainContainer) return;
    generateTimelineStepsHTML();
    setupEventListeners();
    showStep('welcome');
  }

  function generateTimelineStepsHTML() {
    TIMELINE_STEP_NAMES.forEach((name, index) => {
      const stepHtml = `
      <section id="step-timeline-${index + 1}" class="step-container" style="display: none;">
        <div class="step-card">
          <div class="step-header">
            <div class="step-number">${index + 1}</div>
            <h2 class="step-title">${name}</h2>
            <p class="step-subtitle">Toque para registar o horário exato.</p>
          </div>
          <div id="time-display-${index + 1}" class="time-display">Aguardando...</div>
          <button data-step-index="${index + 1}" class="btn-revolutionary btn-primary mark-step-btn">Registar Tempo</button>
        </div>
      </section>`;
      mainContainer.insertAdjacentHTML('beforeend', stepHtml);
    });
  }

  function setupEventListeners() {
    const safeAddEventListener = (id, event, handler) => {
        const element = document.getElementById(id);
        if (element) element.addEventListener(event, handler);
    };
    
    safeAddEventListener('start-btn', 'click', () => showStep('scanner'));
    safeAddEventListener('manual-submit-btn', 'click', submitManualId);
    safeAddEventListener('patient-id-input', 'keypress', (e) => { if (e.key === 'Enter') submitManualId(); });
    safeAddEventListener('save-btn', 'click', saveToGoogleSheets);
    safeAddEventListener('new-patient-btn', 'click', resetSystem);
    safeAddEventListener('destino-select', 'change', validateFinalForm);
    safeAddEventListener('activate-camera-btn', 'click', activateCamera); // Listener para o novo botão

    const roomSelection = document.querySelector('#step-room-selection');
    if(roomSelection) {
        roomSelection.addEventListener('click', (e) => {
          if (e.target.classList.contains('btn-room')) {
            appState.selectedSala = e.target.dataset.sala;
            const firstTimelineStep = STEP_DEFINITIONS.find(s => s.isTimeline);
            if (firstTimelineStep) showStep(firstTimelineStep.id);
          }
        });
    }

    mainContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('mark-step-btn')) {
        const stepIndex = parseInt(e.target.dataset.stepIndex, 10);
        markTimelineStep(stepIndex, e.target);
      }
    });
  }

  // --- CONTROLO DO SCANNER (LÓGICA ATUALIZADA) ---

  function showStatus(message, showButton = false) {
    const statusElement = document.getElementById('camera-status');
    const statusMessage = document.getElementById('camera-status-message');
    const activateBtn = document.getElementById('activate-camera-btn');
    
    if (statusElement && statusMessage && activateBtn) {
        statusMessage.textContent = message;
        activateBtn.style.display = showButton ? 'block' : 'none';
        statusElement.style.display = 'flex';
    }
  }

  function hideStatus() {
    const statusElement = document.getElementById('camera-status');
    const cameraContainer = document.getElementById('camera-container');
    if (statusElement) statusElement.style.display = 'none';
    if (cameraContainer) cameraContainer.classList.add('scanning');
  }

  async function activateCamera() {
      if (isScanning) return;

      showStatus('A pedir permissão para a câmara...', false);

      try {
          // Pede acesso à câmara traseira diretamente
          mediaStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'environment' }
          });

          const videoElement = document.getElementById('video-preview');
          videoElement.srcObject = mediaStream;
          
          // Ouve o evento 'loadedmetadata' para garantir que o vídeo tem dimensões
          videoElement.addEventListener('loadedmetadata', () => {
              startScanner(videoElement);
          }, { once: true });

      } catch (err) {
          console.error("Erro ao obter permissão da câmara:", err);
          let errorMessage = "Erro ao aceder à câmara.";
          if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
              errorMessage = "Permissão para a câmara negada. Por favor, autorize o acesso nas configurações do seu navegador.";
          } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
              errorMessage = "Nenhuma câmara traseira foi encontrada no seu dispositivo.";
          } else {
              errorMessage = `Erro: ${err.name}. Verifique as permissões e se está a usar HTTPS.`;
          }
          showStatus(errorMessage, true); // Mostra o erro e o botão para tentar novamente
      }
  }

  function startScanner(videoElement) {
    const hints = new Map();
    const formats = [ZXing.BarcodeFormat.QR_CODE, ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.DATA_MATRIX];
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

    codeReader = new ZXing.BrowserMultiFormatReader(hints);
    isScanning = true;
    hideStatus();
    console.log("Câmara ativa. A procurar por códigos...");

    codeReader.decodeFromVideoElement(videoElement, (result, err) => {
        if (result) {
            onScanSuccess(result.getText());
        }
        if (err && !(err instanceof ZXing.NotFoundException)) {
            console.error("Erro no scanner:", err);
        }
    });
  }

  function stopScanner() {
    if (codeReader) {
        codeReader.reset();
        codeReader = null;
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop()); // Desliga a câmara
        mediaStream = null;
    }
    isScanning = false;
    console.log("Scanner parado.");
    
    // Repõe o estado inicial do ecrã do scanner
    const cameraContainer = document.getElementById('camera-container');
    if (cameraContainer) cameraContainer.classList.remove('scanning');
    showStatus('Toque no botão para ativar a câmara.', true);
  }

  function onScanSuccess(decodedText) {
    if (isScanning) {
        // Não paramos o stream aqui, apenas o leitor. O stream será parado ao sair do passo.
        if (codeReader) codeReader.reset();
        isScanning = false;
        if (navigator.vibrate) navigator.vibrate(150);
        processPatientId(decodedText);
    }
  }

  // --- FLUXO DA APLICAÇÃO ---

  function showStep(stepId) {
    document.querySelectorAll('.step-container').forEach(el => el.style.display = 'none');
    const currentStepElement = document.getElementById(`step-${stepId}`);
    if (currentStepElement) {
      currentStepElement.style.display = 'flex';
      appState.currentStepId = stepId;
    }

    // A câmara só é ativada pelo botão, mas paramos ao sair do passo
    if (stepId !== 'scanner') {
        stopScanner();
    } else {
        // Garante que o scanner está no estado inicial ao entrar no passo
        stopScanner(); 
    }
  }

  function nextStep() {
    const currentDef = STEP_DEFINITIONS.find(s => s.id === appState.currentStepId);
    if (currentDef) {
      const nextDef = STEP_DEFINITIONS.find(s => s.index === currentDef.index + 1);
      if (nextDef) showStep(nextDef.id);
    }
  }

  function submitManualId() {
    const patientIdInput = document.getElementById('patient-id-input');
    const patientId = patientIdInput.value.trim().toUpperCase();
    if (!patientId) return;
    processPatientId(patientId);
  }

  function processPatientId(patientId) {
    appState.patientId = patientId;
    const displayElement = document.getElementById('patient-id-display');
    if(displayElement) displayElement.textContent = appState.patientId;
    showStep('room-selection');
  }

  function markTimelineStep(stepIndex, button) {
    const now = new Date();
    appState.stepTimes[stepIndex] = now.toISOString();

    button.disabled = true;
    button.classList.replace('btn-primary', 'btn-success');
    button.innerHTML = `✅ Marcado`;

    const timeDisplay = document.getElementById(`time-display-${stepIndex}`);
    if(timeDisplay) timeDisplay.innerHTML = `Registado: <span class="font-bold">${now.toLocaleTimeString('pt-BR')}</span>`;

    setTimeout(() => nextStep(), 500);
  }

  function validateFinalForm() {
    const saveBtn = document.getElementById('save-btn');
    const destinoSelect = document.getElementById('destino-select');
    if(saveBtn && destinoSelect) saveBtn.disabled = !destinoSelect.value;
  }

  async function saveToGoogleSheets() {
    const loadingOverlay = document.getElementById('loading-overlay');
    const showLoading = (isLoading) => {
        if(loadingOverlay) loadingOverlay.style.display = isLoading ? 'flex' : 'none';
    };
    showLoading(true);

    const destinoSelect = document.getElementById('destino-select');
    const observations = document.getElementById('observations');

    const dataToSend = {
      patientId: appState.patientId,
      sala: appState.selectedSala,
      destino: destinoSelect ? destinoSelect.value : '',
      observacoes: observations ? observations.value : '',
      stepTimes: appState.stepTimes,
      source: 'App',
      Source: 'App'
    };

    try {
      await fetch(URL_BACKEND, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(dataToSend)
      });
      showStep('success');
    } catch (error) {
      console.error('Falha ao enviar os dados:', error);
      alert('Falha ao enviar os dados. Verifique a sua conexão e tente novamente.');
    } finally {
      showLoading(false);
    }
  }

  function resetSystem() {
    window.location.reload();
  }

  init();
});
