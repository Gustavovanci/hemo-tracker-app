/*
  HemoFlow Coletor v6.9
  - Mantida a implementação do scanner 'html5-qrcode'.
  - Adicionada verificação para garantir que a biblioteca do scanner esteja carregada antes do uso,
    prevenindo o erro 'Html5Qrcode is not defined'.
*/
document.addEventListener('DOMContentLoaded', () => {

  const URL_BACKEND = "https://script.google.com/macros/s/AKfycbzkjkx9ZEwCluvUqiZxbxitoVzwoYE_CNXiOpnNBpFks4BNZ95xAhLmNrxteaZiCuNZ/exec";
  const SESSION_STORAGE_KEY = 'hemoflow_current_session';

  let appState = {
    currentStepId: null, patientId: null, selectedSala: null, stepTimes: {}, timelineSteps: [],
  };

  let html5QrCode = null;

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

  // --- LÓGICA DO SCANNER ---

  const onScanSuccess = (decodedText, decodedResult) => {
    stopScanner();
    console.log(`Código lido com sucesso: ${decodedText}`);
    if (navigator.vibrate) navigator.vibrate(200);
    processPatientId(decodedText);
  };

  const onScanFailure = (error) => {};

  function startScanner() {
    // **VERIFICAÇÃO DE SEGURANÇA**
    // Garante que a biblioteca foi carregada antes de tentar usá-la.
    if (typeof Html5Qrcode === 'undefined') {
        alert("Erro: A biblioteca do scanner não conseguiu carregar. Verifique sua conexão com a internet e atualize a página.");
        return;
    }

    if (html5QrCode && html5QrCode.isScanning) return;

    html5QrCode = new Html5Qrcode("reader");
    const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
    };

    html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
      .catch(err => {
        console.error("Não foi possível iniciar o scanner", err);
        alert("Erro ao iniciar a câmera. Verifique as permissões do navegador.");
      });
  }

  function stopScanner() {
      if (html5QrCode && html5QrCode.isScanning) {
          html5QrCode.stop().catch(err => console.error("Falha ao parar o scanner.", err));
      }
  }

  // --- LÓGICA DA APLICAÇÃO ---

  function showStep(stepId) {
    document.querySelectorAll('.step-container').forEach(el => el.style.display = 'none');
    const currentStepElement = document.getElementById(`step-${stepId}`);
    
    if (currentStepElement) {
      currentStepElement.style.display = 'flex';
      appState.currentStepId = stepId;
      saveState();
    }
    
    if (stepId === 'scanner') {
        startScanner();
    } else {
        stopScanner();
    }
  }
  
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