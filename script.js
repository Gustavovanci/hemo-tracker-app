/*
  HemoFlow Coletor v6.0
  - Scanner de código de barras atualizado para ZXing-js para melhor performance e robustez.
*/
document.addEventListener('DOMContentLoaded', () => {

  // SUBSTITUA PELA URL DO SEU SCRIPT DO GOOGLE PUBLICADO
  const URL_BACKEND = "https://script.google.com/macros/s/AKfycbxrzqXbsqBtrqAqpzm901vz-Ro0XJyabgKsBtApi8IgVUZJ_JAwbJ2xSPfh8wZB5lnD/exec";

  // --- ESTADO DA APLICAÇÃO ---
  let appState = {
    currentStepId: null,
    patientId: null,
    selectedSala: null,
    stepTimes: {},
  };

  // --- NOVO: Variáveis para o controlo do scanner ---
  let codeReader = null;
  let isScanning = false;

  // --- DEFINIÇÕES E CONSTANTES ---
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

  // --- INICIALIZAÇÃO ---
  function init() {
    if (!mainContainer) {
        console.error("Erro Crítico: O container principal ('main.app-container') não foi encontrado no HTML.");
        return;
    }
    generateTimelineStepsHTML();
    setupEventListeners();
    showStep('welcome');
  }

  // Gera o HTML para os passos da timeline
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

  // Configura todos os "ouvintes" de eventos (cliques, etc.)
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

  /**
   * Inicia o scanner de código de barras usando a biblioteca ZXing.
   */
  async function startScanner() {
    if (isScanning) return;
    
    codeReader = new ZXing.BrowserMultiFormatReader();
    isScanning = true;

    try {
      // Pede permissão e lista as câmaras disponíveis
      const videoInputDevices = await codeReader.listVideoInputDevices();
      // Usa a câmara traseira por defeito, se disponível
      const selectedDeviceId = videoInputDevices.length > 1 
          ? videoInputDevices.find(device => device.label.toLowerCase().includes('back'))?.deviceId || videoInputDevices[0].deviceId
          : videoInputDevices[0].deviceId;

      console.log(`A iniciar scanner com o dispositivo: ${selectedDeviceId}`);
      
      // Começa a descodificar o vídeo da câmara
      codeReader.decodeFromVideoDevice(selectedDeviceId, 'video-preview', (result, err) => {
        if (result) {
          // Se um código for lido com sucesso
          console.log("Código de barras encontrado!", result);
          onScanSuccess(result.getText());
        }
        if (err && !(err instanceof ZXing.NotFoundException)) {
          // Se ocorrer um erro que não seja "código não encontrado"
          console.error("Erro no scanner:", err);
        }
      });
    } catch (err) {
      console.error("Erro ao obter permissão da câmara ou iniciar o scanner:", err);
      isScanning = false;
    }
  }

  /**
   * Para o scanner e liberta a câmara.
   */
  function stopScanner() {
    if (codeReader) {
      codeReader.reset(); // Para a câmara e o processo de scan
      codeReader = null;
      isScanning = false;
      console.log("Scanner parado.");
    }
  }

  /**
   * Chamado quando um código é lido com sucesso.
   * @param {string} decodedText O texto do código de barras.
   */
  function onScanSuccess(decodedText) {
    if (isScanning) {
      stopScanner();
      if (navigator.vibrate) navigator.vibrate(150);
      processPatientId(decodedText);
    }
  }

  // --- FLUXO DA APLICAÇÃO ---

  // Mostra um passo específico e esconde os outros
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

  // Avança para o próximo passo na sequência
  function nextStep() {
    const currentDef = STEP_DEFINITIONS.find(s => s.id === appState.currentStepId);
    if (currentDef) {
      const nextDef = STEP_DEFINITIONS.find(s => s.index === currentDef.index + 1);
      if (nextDef) showStep(nextDef.id);
    }
  }

  // Processa o ID inserido manualmente
  function submitManualId() {
    const patientIdInput = document.getElementById('patient-id-input');
    const patientId = patientIdInput.value.trim().toUpperCase();
    if (!patientId) return;
    processPatientId(patientId);
  }

  // Processa o ID do paciente (seja do scanner ou manual)
  function processPatientId(patientId) {
    appState.patientId = patientId;
    const displayElement = document.getElementById('patient-id-display');
    if(displayElement) displayElement.textContent = appState.patientId;
    showStep('room-selection');
  }

  // Marca o tempo de um passo da timeline
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

  // Valida o formulário final para ativar o botão de guardar
  function validateFinalForm() {
    const saveBtn = document.getElementById('save-btn');
    const destinoSelect = document.getElementById('destino-select');
    if(saveBtn && destinoSelect) saveBtn.disabled = !destinoSelect.value;
  }

  // Envia os dados para o Google Sheets
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

  // Reinicia a aplicação
  function resetSystem() {
    window.location.reload();
  }

  // Inicia a aplicação
  init();
});
