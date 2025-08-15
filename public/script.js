/*
  HemoFlow v5.0 "Foco Clínico"
  - Lógica Otimizada com Cache de DOM e Delegação de Eventos
  - Interface Progressiva com Gerenciamento Dinâmico de Conteúdo
  - Foco em Performance e Usabilidade
*/
document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURAÇÃO ---
    const URL_BACKEND = "https://script.google.com/macros/s/AKfycbwvGRx2h7Tl4OvHTjprfLE2YnQf8kvO7F8T1c3yuIkUMzTqQUQn5l-tSSTFwUiqL9er/exec";

    // --- ESTADO DA APLICAÇÃO ---
    let currentStepIndex = 0;
    let previousStepIndex = -1;
    let pacienteAtual = null;
    let stepTimes = {};
    let html5QrCode = null;
    let isScanning = false;

    // --- MAPEAMENTO DE ETAPAS ---
    const STEPS = [
        'welcome', 'scanner', 'patient', 'timeline', 'final', 'success'
    ];
    
    const TIMELINE_STEPS = [
        'Chegada na Hemodinâmica', 'Entrada na Sala', 'Início da Cobertura',
        'Término da Cobertura', 'Início do Procedimento', 'Término do Procedimento',
        'Saída da Sala', 'Início da Limpeza', 'Término da Limpeza'
    ];

    // --- CACHE DE ELEMENTOS DOM (PERFORMANCE) ---
    const DOM = {};
    const cacheDOMElements = () => {
        DOM.sections = {};
        STEPS.forEach(step => DOM.sections[step] = document.getElementById(`step-${step}`));

        DOM.buttons = {
            start: document.getElementById('start-btn'),
            scan: document.getElementById('scan-btn'),
            manualSubmit: document.getElementById('manual-submit-btn'),
            startTimeline: document.getElementById('start-timeline-btn'),
            markStep: document.getElementById('mark-step-btn'),
            continue: document.getElementById('continue-btn'),
            save: document.getElementById('save-btn'),
            newPatient: document.getElementById('new-patient-btn'),
        };
        
        DOM.inputs = {
            manualPatientId: document.getElementById('manual-patient-id'),
            salaSelect: document.getElementById('sala-select'),
            leitoSelect: document.getElementById('leito-select'),
        };

        DOM.displays = {
            reader: document.getElementById('reader'),
            scannerStatus: document.getElementById('scanner-status'),
            patientId: document.getElementById('patient-id-display'),
            timelineTitle: document.getElementById('timeline-title'),
            timelineSubtitle: document.getElementById('timeline-subtitle'),
            timelineContent: document.getElementById('timeline-content'),
            saveBtnText: document.getElementById('save-btn-text'),
            saveSpinner: document.getElementById('save-spinner'),
        };
    };

    // --- INICIALIZAÇÃO ---
    const init = () => {
        console.log('🚀 HemoFlow v5.0 "Foco Clínico"');
        cacheDOMElements();
        setupEventListeners();
        showStep(0);
    };

    // --- GERENCIAMENTO DE EVENTOS ---
    const setupEventListeners = () => {
        DOM.buttons.start.addEventListener('click', nextStep);
        DOM.buttons.scan.addEventListener('click', toggleScanner);
        DOM.buttons.manualSubmit.addEventListener('click', submitManualId);
        DOM.inputs.manualPatientId.addEventListener('keypress', e => { if (e.key === 'Enter') submitManualId(); });
        DOM.buttons.startTimeline.addEventListener('click', nextStep);
        DOM.buttons.markStep.addEventListener('click', markTimelineStep);
        DOM.buttons.continue.addEventListener('click', nextStep);
        DOM.buttons.save.addEventListener('click', saveToGoogleSheets);
        DOM.buttons.newPatient.addEventListener('click', resetSystem);
        [DOM.inputs.salaSelect, DOM.inputs.leitoSelect].forEach(el => el.addEventListener('change', validateFinalForm));
    };

    // --- NAVEGAÇÃO E UI ---
    const showStep = (stepIndex) => {
        currentStepIndex = stepIndex;
        
        if (previousStepIndex !== -1) {
            DOM.sections[STEPS[previousStepIndex]].style.display = 'none';
        }
        DOM.sections[STEPS[stepIndex]].style.display = 'flex';
        
        previousStepIndex = stepIndex;
        
        // Configurações específicas de cada etapa
        if (STEPS[stepIndex] === 'timeline') {
            renderTimelineStep();
        }
    };

    const nextStep = () => {
        if (currentStepIndex < STEPS.length - 1) {
            showStep(currentStepIndex + 1);
        }
    };
    
    // --- LÓGICA DO SCANNER ---
    const toggleScanner = async () => {
        if (isScanning) await stopScanner();
        else await startScanner();
    };

    const startScanner = async () => {
        DOM.displays.reader.style.display = 'block';
        DOM.displays.scannerStatus.textContent = 'Inicializando câmera...';
        DOM.displays.scannerStatus.style.display = 'block';

        try {
            html5QrCode = new Html5Qrcode("reader");
            const cameras = await Html5Qrcode.getCameras();
            if (cameras.length === 0) throw new Error('Nenhuma câmera encontrada.');
            
            const cameraId = (cameras.find(c => c.label.toLowerCase().includes('back')) || cameras[0]).id;
            
            await html5QrCode.start(
                cameraId, { fps: 10, qrbox: { width: 250, height: 150 } },
                (decodedText) => {
                    stopScanner();
                    processPatient(decodedText);
                },
                (errorMessage) => {} // Ignora erros contínuos
            );
            isScanning = true;
            DOM.buttons.scan.textContent = 'Parar Scanner';
            DOM.displays.scannerStatus.textContent = 'Aponte para o QR Code.';
        } catch (err) {
            DOM.displays.scannerStatus.textContent = `Erro: ${err.message}`;
        }
    };

    const stopScanner = async () => {
        if (html5QrCode && isScanning) {
            try { await html5QrCode.stop(); } catch (err) {}
            isScanning = false;
            DOM.buttons.scan.textContent = 'Escanear Pulseira';
            DOM.displays.reader.style.display = 'none';
            DOM.displays.scannerStatus.style.display = 'none';
        }
    };
    
    // --- PROCESSAMENTO DO PACIENTE ---
    const submitManualId = () => {
        const patientId = DOM.inputs.manualPatientId.value.trim().toUpperCase();
        if (patientId && patientId.length >= 3) {
            processPatient(patientId);
        } else {
            alert('ID do paciente inválido.');
        }
    };

    const processPatient = (patientId) => {
        pacienteAtual = patientId;
        DOM.displays.patientId.textContent = pacienteAtual;
        stepTimes[0] = new Date(); // Marca o tempo de chegada
        nextStep();
    };

    // --- LÓGICA DA TIMELINE (DINÂMICA) ---
    const getCurrentTimelineStep = () => Object.keys(stepTimes).length -1;

    const renderTimelineStep = () => {
        const timelineStepIndex = getCurrentTimelineStep();
        if (timelineStepIndex >= TIMELINE_STEPS.length) {
            nextStep(); // Vai para a etapa final se a timeline acabou
            return;
        }

        DOM.displays.timelineTitle.textContent = TIMELINE_STEPS[timelineStepIndex];
        DOM.displays.timelineSubtitle.textContent = `Passo ${timelineStepIndex + 1} de ${TIMELINE_STEPS.length}`;
        DOM.displays.timelineContent.innerHTML = `
            <div class="text-6xl mb-4">⏱️</div>
            <p class="text-white/60">Aguardando marcação...</p>
        `;
        DOM.buttons.markStep.style.display = 'flex';
        DOM.buttons.continue.style.display = 'none';
        DOM.buttons.markStep.disabled = false;
    };
    
    const markTimelineStep = () => {
        const now = new Date();
        const timelineStepIndex = getCurrentTimelineStep();
        const timeIndex = timelineStepIndex + 1;
        stepTimes[timeIndex] = now;
        
        const previousTime = stepTimes[timeIndex - 1];
        const duration = calculateDuration(previousTime, now);

        DOM.displays.timelineContent.innerHTML = `
            <div class="text-6xl mb-4">✅</div>
            <p class="text-2xl font-bold">${formatTime(now)}</p>
            <p class="text-accent text-lg">Duração da etapa: ${formatDuration(duration)}</p>
        `;
        
        DOM.buttons.markStep.style.display = 'none';
        DOM.buttons.continue.style.display = 'flex';
    };

    // --- FINALIZAÇÃO E SALVAMENTO ---
    const validateFinalForm = () => {
        DOM.buttons.save.disabled = !(DOM.inputs.salaSelect.value && DOM.inputs.leitoSelect.value);
    };

    const saveToGoogleSheets = async () => {
        DOM.buttons.save.disabled = true;
        DOM.displays.saveBtnText.style.display = 'none';
        DOM.displays.saveSpinner.style.display = 'block';

        try {
            const data = {
                patientId: pacienteAtual,
                sala: DOM.inputs.salaSelect.value,
                destino: DOM.inputs.leitoSelect.value,
                stepTimes: Object.fromEntries(Object.entries(stepTimes).map(([k, v]) => [k, v.toISOString()])),
                timestamp: new Date().toISOString(),
                version: 'v5.0'
            };

            await fetch(URL_BACKEND, {
                method: 'POST', mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            nextStep();
        } catch (error) {
            alert(`Erro ao salvar: ${error.message}. Os dados não foram perdidos.`);
        } finally {
            DOM.buttons.save.disabled = false;
            DOM.displays.saveBtnText.style.display = 'inline';
            DOM.displays.saveSpinner.style.display = 'none';
        }
    };
    
    // --- RESET DO SISTEMA ---
    const resetSystem = () => {
        if (isScanning) stopScanner();
        
        currentStepIndex = 0;
        previousStepIndex = -1;
        pacienteAtual = null;
        stepTimes = {};
        
        // Limpa formulários
        DOM.inputs.manualPatientId.value = '';
        DOM.inputs.salaSelect.value = '';
        DOM.inputs.leitoSelect.value = '';

        showStep(0);
    };

    // --- FUNÇÕES UTILITÁRIAS ---
    const formatTime = (date) => date.toLocaleTimeString('pt-BR');
    const calculateDuration = (start, end) => (end - start) / 60000; // em minutos
    const formatDuration = (minutes) => {
        const mins = Math.floor(minutes);
        const secs = Math.round((minutes - mins) * 60);
        return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    };

    // --- INICIA A APLICAÇÃO ---
    init();
});