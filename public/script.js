/*
  HemoFlow Coletor v6.6
  - Corrigido bug na UI do scanner onde a mensagem de permissão não desaparecia.
  - Textos e mensagens de erro totalmente em Português do Brasil.
  - Mantém scanner de alta performance, persistência de estado e fluxo dinâmico.
*/
document.addEventListener('DOMContentLoaded', () => {

  const URL_BACKEND = "https://script.google.com/macros/s/AKfycbxrzqXbsqBtrqAqpzm901vz-Ro0XJyabgKsBtApi8IgVUZJ_JAwbJ2xSPfh8wZB5lnD/exec";
  const SESSION_STORAGE_KEY = 'hemoflow_current_session';

  let appState = {
    currentStepId: null, patientId: null, selectedSala: null, stepTimes: {}, timelineSteps: [],
  };

  let codeReader = null;
  let isScanning = false;
  let mediaStream = null;
  let animationFrameId = null;

  const videoElement = document.getElementById('video-preview');
  const canvasElement = document.getElementById('canvas-preview');
  const canvasContext = canvasElement.getContext('2d', { willReadFrequently: true });

  const STANDARD_TIMELINE_STEPS = [
    'Chegada na Hemodinâmica', 'Entrada na Sala', 'Início da Cobertura',
    'Término da Cobertura', 'Início do Procedimento', 'Término do Procedimento',
    'Saída da Sala', 'Início da Limpeza', 'Término da Limpeza'
  ];
  const SALA_3_PRE_PROCEDURE = { after: 'Término da Cobertura', steps: ['Início da Punção Anestesista', 'Início da Anestesia'] };
  const SALA_3_POST_PROCEDURE = { after: 'Término do Procedimento', steps: ['Acordar da Anestesia'] };

  const mainContainer = document.querySelector('main.app-container');

  function init() {
    if (!mainContainer) return;
    if (!restoreSession()) {
      appState.timelineSteps = [...STANDARD_TIMELINE_STEPS];
      generateTimelineStepsHTML(appState.timelineSteps);
      showStep('welcome');
    }
    setupEventListeners();
  }

  // --- LÓGICA DO SCANNER DE ALTA PERFORMANCE (CORRIGIDA) ---

  function processFrameAndDecode() {
      if (!isScanning || !codeReader) return;
      
      if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
          canvasElement.width = videoElement.videoWidth;
          canvasElement.height = videoElement.videoHeight;
          canvasContext.filter = 'grayscale(1) contrast(175%) brightness(110%)';
          canvasContext.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
          
          try {
              const result = codeReader.decodeFromCanvas(canvasElement);
              if (result) {
                  onScanSuccess(result.getText());
                  return; 
              }
          } catch (err) {
              if (!(err instanceof ZXing.NotFoundException)) {
                  console.error("Erro na decodificação do canvas:", err);
              }
          }
      }
      animationFrameId = requestAnimationFrame(processFrameAndDecode);
  }

  async function activateCamera() {
      if (isScanning) return;
      showStatus('Solicitando permissão para a câmera...', false);
      try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          videoElement.srcObject = mediaStream;
          
          // **CORREÇÃO:** O evento 'playing' garante que o vídeo está de fato sendo exibido
          // antes de mudarmos a UI e iniciarmos o scanner.
          videoElement.addEventListener('playing', () => {
              startScanner();
          }, { once: true });

      } catch (err) {
          console.error("Erro ao obter permissão da câmera:", err);
          let errorMessage = "Erro ao acessar a câmera.";
           if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
              errorMessage = "Permissão para a câmera negada. Por favor, autorize o acesso nas configurações do seu navegador e atualize a página.";
          } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
              errorMessage = "Nenhuma câmera traseira foi encontrada no seu dispositivo.";
          } else {
              errorMessage = `Erro: ${err.name}. Verifique as permissões e se a página está em um endereço seguro (HTTPS).`;
          }
          showStatus(errorMessage, true);
      }
  }

  function startScanner() {
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.DATA_MATRIX, ZXing.BarcodeFormat.QR_CODE]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    hints.set(ZXing.DecodeHintType.ALSO_INVERTED, true);

    codeReader = new ZXing.BrowserMultiFormatReader(hints);
    isScanning = true;
    hideStatus(); // Esconde a mensagem e mostra a interface de scan
    console.log("Scanner de alta performance ativo...");
    animationFrameId = requestAnimationFrame(processFrameAndDecode);
  }

  function stopScanner() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    isScanning = false;
    codeReader = null;
    const cameraContainer = document.getElementById('camera-container');
    if (cameraContainer) cameraContainer.classList.remove('scanning');
    showStatus('Toque no botão para ativar a câmera.', true);
  }

  function onScanSuccess(decodedText) {
      if (isScanning) {
          console.log("Código lido com sucesso:", decodedText);
          isScanning = false;
          if (navigator.vibrate) navigator.vibrate([150, 50, 150]);
          processPatientId(decodedText);
      }
  }
  
  // --- LÓGICA DA APLICAÇÃO (UI, ESTADO, ETC.) ---
  
  function generateTimelineStepsHTML(stepNames) {
    mainContainer.querySelectorAll('section[id^="step-timeline-"]').forEach(el => el.remove());
    stepNames.forEach((name, index) => {
      const stepHtml = `
      <section id="step-timeline-${index + 1}" class="step-container" style="display: none;">
        <div class="step-card">
          <div class="step-header">
            <div class="step-number">${index + 1}</div>
            <h2 class="step-title">${name}</h2>
            <p class="step-subtitle">Toque para registrar o horário exato.</p>
          </div>
          <div id="time-display-${index + 1}" class="time-display">Aguardando...</div>
          <button data-step-name="${name}" data-step-index="${index + 1}" class="btn-revolutionary btn-primary mark-step-btn">Registrar Tempo</button>
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
    safeAddEventListener('activate-camera-btn', 'click', activateCamera);

    const roomSelection = document.querySelector('#step-room-selection');
    if(roomSelection) {
        roomSelection.addEventListener('click', (e) => {
          if (e.target.classList.contains('btn-room')) {
            appState.selectedSala = e.target.dataset.sala;
            generateDynamicTimeline(appState.selectedSala);
            showStep('timeline-1');
          }
        });
    }

    mainContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('mark-step-btn')) {
        const stepIndex = parseInt(e.target.dataset.stepIndex, 10);
        const stepName = e.target.dataset.stepName;
        markTimelineStep(stepIndex, stepName, e.target);
      }
    });
  }

  function generateDynamicTimeline(sala) {
      let timelineNames = [...STANDARD_TIMELINE_STEPS];
      if (sala === 'Sala 3') {
          let insertIndex = timelineNames.indexOf(SALA_3_PRE_PROCEDURE.after) + 1;
          timelineNames.splice(insertIndex, 0, ...SALA_3_PRE_PROCEDURE.steps);
          insertIndex = timelineNames.indexOf(SALA_3_POST_PROCEDURE.after) + 1;
          timelineNames.splice(insertIndex, 0, ...SALA_3_POST_PROCEDURE.steps);
      }
      appState.timelineSteps = timelineNames;
      generateTimelineStepsHTML(timelineNames);
      saveState();
  }

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

  function showStep(stepId) {
    document.querySelectorAll('.step-container').forEach(el => el.style.display = 'none');
    const currentStepElement = document.getElementById(`step-${stepId}`);
    if (currentStepElement) {
      currentStepElement.style.display = 'flex';
      appState.currentStepId = stepId;
      saveState();
    }
    if (stepId !== 'scanner' && isScanning) stopScanner();
  }

  function nextStep() {
    const currentStepIndexStr = appState.currentStepId.replace('timeline-', '');
    const currentStepIndex = parseInt(currentStepIndexStr, 10);
    if (!isNaN(currentStepIndex) && currentStepIndex < appState.timelineSteps.length) {
      showStep(`timeline-${currentStepIndex + 1}`);
    } else {
      showStep('final');
    }
  }

  function submitManualId() {
    const patientIdInput = document.getElementById('patient-id-input');
    const patientId = patientIdInput.value.trim().toUpperCase();
    if (patientId) processPatientId(patientId);
  }

  function processPatientId(patientId) {
    appState.patientId = patientId;
    document.getElementById('patient-id-display').textContent = appState.patientId;
    showStep('room-selection');
  }

  function markTimelineStep(stepIndex, stepName, button) {
    const now = new Date();
    appState.stepTimes[stepName] = now.toISOString();
    button.disabled = true;
    button.classList.replace('btn-primary', 'btn-success');
    button.innerHTML = `✅ Marcado`;
    const timeDisplay = document.getElementById(`time-display-${stepIndex}`);
    if(timeDisplay) timeDisplay.innerHTML = `Registrado: <span class="font-bold">${now.toLocaleTimeString('pt-BR')}</span>`;
    saveState();
    setTimeout(() => nextStep(), 500);
  }
  
  function validateFinalForm() {
    const saveBtn = document.getElementById('save-btn');
    const destinoSelect = document.getElementById('destino-select');
    if(saveBtn && destinoSelect) saveBtn.disabled = !destinoSelect.value;
  }

  async function saveToGoogleSheets() {
    document.getElementById('loading-overlay').style.display = 'flex';
    const dataToSend = { ...appState };
    delete dataToSend.currentStepId;
    dataToSend.source = 'App';
    try {
      await fetch(URL_BACKEND, { method: 'POST', mode: 'no-cors', body: JSON.stringify(dataToSend) });
      showStep('success');
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.error('Falha ao enviar os dados:', error);
      alert('Falha ao enviar os dados. Verifique sua conexão e tente novamente.');
    } finally {
      document.getElementById('loading-overlay').style.display = 'none';
    }
  }

  function resetSystem() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    window.location.reload();
  }

  function saveState() {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(appState));
  }

  function restoreSession() {
      const savedState = localStorage.getItem(SESSION_STORAGE_KEY);
      if (savedState) {
          appState = JSON.parse(savedState);
          console.log("Sessão restaurada:", appState);
          document.getElementById('patient-id-display').textContent = appState.patientId || '--';
          generateTimelineStepsHTML(appState.timelineSteps);
          appState.timelineSteps.forEach((stepName, index) => {
              if (appState.stepTimes[stepName]) {
                  const stepIndex = index + 1;
                  const button = document.querySelector(`button[data-step-index='${stepIndex}']`);
                  const timeDisplay = document.getElementById(`time-display-${stepIndex}`);
                  const time = new Date(appState.stepTimes[stepName]);
                  if (button) {
                      button.disabled = true;
                      button.classList.replace('btn-primary', 'btn-success');
                      button.innerHTML = `✅ Marcado`;
                  }
                  if (timeDisplay) {
                      timeDisplay.innerHTML = `Registrado: <span class="font-bold">${time.toLocaleTimeString('pt-BR')}</span>`;
                  }
              }
          });
          showStep(appState.currentStepId);
          return true;
      }
      return false;
  }

  init();
});