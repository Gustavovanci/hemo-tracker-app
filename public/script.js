/*
  HemoFlow Coletor v6.2
  - Lógica do scanner refeita para máxima compatibilidade móvel.
  - Adicionado feedback de estado visual para o utilizador (pedir permissão, erro, etc.).
  - Melhorada a seleção de câmara traseira.
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
    if (!mainContainer) {
        console.error("Erro Crítico: O container principal ('main.app-container') não foi encontrado.");
        return;
    }
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

  async function startScanner() {
    if (isScanning) return;

    const hints = new Map();
    const formats = [ZXing.BarcodeFormat.QR_CODE, ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.DATA_MATRIX];
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

    codeReader = new ZXing.BrowserMultiFormatReader(hints);
    isScanning = true;

    const videoElement = document.getElementById('video-preview');
    const statusElement = document.getElementById('camera-status');
    const statusMessage = statusElement.querySelector('p');

    const showStatus = (message) => {
        statusMessage.textContent = message;
        statusElement.style.display = 'flex';
        videoElement.style.opacity = 0;
    };

    const hideStatus = () => {
        statusElement.style.display = 'none';
        videoElement.style.opacity = 1;
    };

    showStatus('A pedir permissão para a câmara...');

    try {
        const videoInputDevices = await codeReader.listVideoInputDevices();
        if (videoInputDevices.length === 0) {
            throw new Error("Nenhuma câmara foi encontrada.");
        }

        let selectedDeviceId = null;
        const rearCamera = videoInputDevices.find(device => /back|traseira|rear/i.test(device.label));
        selectedDeviceId = rearCamera ? rearCamera.deviceId : videoInputDevices[videoInputDevices.length - 1].deviceId;
        
        console.log(`A iniciar scanner com o dispositivo: ${selectedDeviceId}`);
        showStatus('A iniciar câmara...');

        // Ouve o evento 'playing' para saber quando o vídeo realmente começou
        videoElement.addEventListener('playing', hideStatus, { once: true });

        codeReader.decodeFromVideoDevice(selectedDeviceId, 'video-preview', (result, err) => {
            if (result) {
                onScanSuccess(result.getText());
            }
            if (err && !(err instanceof ZXing.NotFoundException)) {
                console.error("Erro no scanner:", err);
            }
        });

    } catch (err) {
        console.error("Erro ao iniciar o scanner:", err);
        let errorMessage = "Erro ao aceder à câmara.";
        if (err.name === "NotAllowedError") {
            errorMessage = "Permissão para a câmara negada. Por favor, autorize o acesso nas configurações do seu navegador.";
        } else {
            errorMessage = `Erro: ${err.name}. Verifique as permissões e se está a usar HTTPS.`;
        }
        showStatus(errorMessage);
        isScanning = false;
    }
  }

  function stopScanner() {
    if (codeReader) {
        codeReader.reset();
        codeReader = null;
        isScanning = false;
        console.log("Scanner parado.");
        const videoElement = document.getElementById('video-preview');
        const statusElement = document.getElementById('camera-status');
        if (videoElement) videoElement.style.opacity = 0;
        if (statusElement) statusElement.style.display = 'none';
    }
  }

  function onScanSuccess(decodedText) {
    if (isScanning) {
        stopScanner();
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

    if (stepId === 'scanner') {
        startScanner();
    } else {
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
