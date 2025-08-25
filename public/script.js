/*
  HemoFlow Coletor v5.2
  - Focado exclusivamente na coleta de tempos.
  - Envia dados para o Google Apps Script (com 'source: "App"').
  - CORREÇÃO: Adicionada verificação de existência de elementos para evitar erros.
  - MELHORIA: Enviando o campo 'source' e 'Source' para garantir compatibilidade com o backend (Google Apps Script).
*/
document.addEventListener('DOMContentLoaded', () => {

  // SUBSTITUA PELA URL DO SEU SCRIPT DO GOOGLE PUBLICADO
  const URL_BACKEND = "https://script.google.com/macros/s/AKfycbxrzqXbsqBtrqAqpzm901vz-Ro0XJyabgKsBtApi8IgVUZJ_JAwbJ2xSPfh8wZB5lnD/exec";

  let appState = {
    currentStepId: null,
    patientId: null,
    selectedSala: null,
    stepTimes: {},
  };

  let html5QrCode = null;

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
        console.error("Erro Crítico: O container principal ('main.app-container') não foi encontrado no HTML.");
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
            <p class="step-subtitle">Toque para registrar o horário exato.</p>
          </div>
          <div id="time-display-${index + 1}" class="time-display">Aguardando...</div>
          <button data-step-index="${index + 1}" class="btn-revolutionary btn-primary mark-step-btn">Registrar Tempo</button>
        </div>
      </section>`;
      mainContainer.insertAdjacentHTML('beforeend', stepHtml);
    });
  }

  function setupEventListeners() {
    const safeAddEventListener = (id, event, handler) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`Elemento com id '${id}' não foi encontrado para adicionar um evento.`);
        }
    };
    
    const safeQuerySelector = (selector, event, handler) => {
        const element = document.querySelector(selector);
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`Elemento com seletor '${selector}' não foi encontrado.`);
        }
    };

    safeAddEventListener('start-btn', 'click', () => showStep('scanner'));
    safeAddEventListener('manual-submit-btn', 'click', submitManualId);
    safeAddEventListener('patient-id-input', 'keypress', (e) => { if (e.key === 'Enter') submitManualId(); });
    safeAddEventListener('save-btn', 'click', saveToGoogleSheets);
    safeAddEventListener('new-patient-btn', 'click', resetSystem);
    safeAddEventListener('destino-select', 'change', validateFinalForm);

    safeQuerySelector('#step-room-selection', 'click', (e) => {
      if (e.target.classList.contains('btn-room')) {
        appState.selectedSala = e.target.dataset.sala;
        const firstTimelineStep = STEP_DEFINITIONS.find(s => s.isTimeline);
        if (firstTimelineStep) {
            showStep(firstTimelineStep.id);
        }
      }
    });

    mainContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('mark-step-btn')) {
        const stepIndex = parseInt(e.target.dataset.stepIndex, 10);
        markTimelineStep(stepIndex, e.target);
      }
    });
  }

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
      if (nextDef) {
        showStep(nextDef.id);
      }
    }
  }

  async function startScanner() {
    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }
    if (html5QrCode && html5QrCode.isScanning) {
        return;
    }
    try {
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        onScanSuccess,
        () => {}
      );
    } catch (err) {
      console.error("Erro ao iniciar o scanner:", err);
    }
  }

  async function stopScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
      try {
        await html5QrCode.stop();
      } catch (e) {
        console.warn("Não foi possível parar o scanner de forma limpa.", e);
      }
    }
  }

  function onScanSuccess(decodedText) {
    if (html5QrCode.isScanning) {
      stopScanner();
      if (navigator.vibrate) {
          navigator.vibrate(150);
      }
      processPatientId(decodedText);
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
    if(displayElement) {
        displayElement.textContent = appState.patientId;
    }
    showStep('room-selection');
  }

  function markTimelineStep(stepIndex, button) {
    const now = new Date();
    appState.stepTimes[stepIndex] = now.toISOString();

    button.disabled = true;
    button.classList.replace('btn-primary', 'btn-success');
    button.innerHTML = `✅ Marcado`;

    const timeDisplay = document.getElementById(`time-display-${stepIndex}`);
    if(timeDisplay) {
        timeDisplay.innerHTML = `Registrado: <span class="font-bold">${now.toLocaleTimeString('pt-BR')}</span>`;
    }

    setTimeout(() => nextStep(), 500);
  }

  function validateFinalForm() {
    const saveBtn = document.getElementById('save-btn');
    const destinoSelect = document.getElementById('destino-select');
    if(saveBtn && destinoSelect) {
        saveBtn.disabled = !destinoSelect.value;
    }
  }

  async function saveToGoogleSheets() {
    const loadingOverlay = document.getElementById('loading-overlay');
    const showLoading = (isLoading) => {
        if(loadingOverlay) {
            loadingOverlay.style.display = isLoading ? 'flex' : 'none';
        }
    };
    showLoading(true);

    const destinoSelect = document.getElementById('destino-select');
    const observations = document.getElementById('observations');

    // ===== ALTERAÇÃO AQUI =====
    // Adicionamos 'Source' com 'S' maiúsculo para garantir a compatibilidade.
    const dataToSend = {
      patientId: appState.patientId,
      sala: appState.selectedSala,
      destino: destinoSelect ? destinoSelect.value : '',
      observacoes: observations ? observations.value : '',
      stepTimes: appState.stepTimes,
      source: 'App', // Versão com 's' minúsculo
      Source: 'App'  // Versão com 'S' maiúsculo
    };
    // ==========================

    try {
      await fetch(URL_BACKEND, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(dataToSend)
      });
      showStep('success');
    } catch (error) {
      console.error('Falha ao enviar os dados:', error);
      alert('Falha ao enviar os dados. Verifique sua conexão e tente novamente.');
    } finally {
      showLoading(false);
    }
  }

  function resetSystem() {
    window.location.reload();
  }

  init();
});
