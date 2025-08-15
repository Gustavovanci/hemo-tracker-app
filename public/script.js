/*
  HemoFlow Revolutionary v4.0 - Versão Final e Corrigida
  - Corrigidos todos os erros de 'TypeError: Cannot set properties of null'.
  - Funcionalidade do Scanner e do botão 'Confirmar ID Manual' restaurada.
  - Integração com Google Planilhas 100% funcional, com a estrutura de dados correta.
*/
document.addEventListener('DOMContentLoaded', () => {
    
    // --- CONFIGURAÇÃO ---
    // Insira a URL do seu script do Google Apps aqui.
    const URL_BACKEND = "https://script.google.com/macros/s/AKfycbwvGRx2h7Tl4OvHTjprfLE2YnQf8kvO7F8T1c3yuIkUMzTqQUQn5l-tSSTFwUiqL9er/exec";
    
    // --- ESTADO DA APLICAÇÃO ---
    let currentStep = 0;
    let pacienteAtual = null;
    let stepTimes = {};
    let html5QrCode = null;
    let isScanning = false;
    
    // Definição de todas as etapas do fluxo
    const stepDefinitions = [
        { id: 'welcome' },
        { id: 'scanner' },
        { id: 'patient' },
        ...Array(9).fill().map((_, i) => ({ id: `timeline-${i+1}`, isTimeline: true })),
        { id: 'final' },
        { id: 'success' }
    ];
    
    const timelineStepNames = [
        'Chegada na Hemodinâmica', 'Entrada na Sala', 'Início da Cobertura', 
        'Término da Cobertura', 'Início do Procedimento', 'Término do Procedimento',
        'Saída da Sala', 'Início da Limpeza', 'Término da Limpeza'
    ];

    const mainContainer = document.querySelector('main.app-container');

    // --- INICIALIZAÇÃO ---
    function init() {
        console.log('🚀 HemoFlow v4.0 (FINAL) iniciado!');
        generateTimelineStepsHTML();
        setupEventListeners();
        showStep(0);
    }

    // --- GERAÇÃO DINÂMICA DE HTML ---
    function generateTimelineStepsHTML() {
        timelineStepNames.forEach((name, index) => {
            const stepHtml = `
            <section id="step-timeline-${index + 1}" class="step-container" style="display: none;">
                <div class="step-card">
                    <div class="step-header">
                        <div class="step-number">${index + 1}</div>
                        <h2 class="step-title">${name}</h2>
                        <p class="step-subtitle">Pressione o botão para marcar o tempo.</p>
                    </div>
                    <div id="time-display-${index + 1}" class="text-center text-2xl my-8 text-white/70">Aguardando marcação...</div>
                    <button data-step-index="${index + 1}" class="btn-revolutionary btn-primary mark-step-btn">Marcar Tempo</button>
                </div>
            </section>`;
            mainContainer.insertAdjacentHTML('beforeend', stepHtml);
        });
    }

    // --- GERENCIAMENTO DE EVENTOS ---
    function setupEventListeners() {
        document.getElementById('start-btn').addEventListener('click', () => nextStep());
        document.getElementById('scan-btn').addEventListener('click', toggleScanner);
        document.getElementById('manual-submit-btn').addEventListener('click', submitManualId);
        document.getElementById('patient-id-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submitManualId();
        });
        document.getElementById('start-timeline-btn').addEventListener('click', () => nextStep());
        document.getElementById('save-btn').addEventListener('click', saveToGoogleSheets);
        document.getElementById('new-patient-btn').addEventListener('click', resetSystem);
        
        mainContainer.addEventListener('click', (e) => {
            const markButton = e.target.closest('.mark-step-btn');
            if (markButton) {
                const stepIndex = parseInt(markButton.dataset.stepIndex, 10);
                markTimelineStep(stepIndex, markButton);
            }
        });

        ['sala-select', 'leito-select'].forEach(id => {
            document.getElementById(id).addEventListener('change', validateFinalForm);
        });
    }

    // --- NAVEGAÇÃO E UI (CORRIGIDO) ---
    function showStep(stepIndex) {
        document.querySelectorAll('.step-container').forEach(el => el.style.display = 'none');
        const stepId = stepDefinitions[stepIndex].id;
        const currentStepElement = document.getElementById(`step-${stepId}`);
        if (currentStepElement) {
            currentStepElement.style.display = 'flex';
        }
        currentStep = stepIndex;
        // CORREÇÃO: O ID do indicador de progresso foi corrigido.
        const indicator = document.getElementById('current-step-indicator');
        if(indicator) {
            indicator.textContent = stepIndex + 1;
        }
    }

    function nextStep() {
        if (currentStep < stepDefinitions.length - 1) {
            showStep(currentStep + 1);
        }
    }

    // --- SCANNER (CORRIGIDO) ---
    async function toggleScanner() {
        if (isScanning) await stopScanner();
        else await startScanner();
    }

    async function startScanner() {
        const readerDiv = document.getElementById('reader');
        // CORREÇÃO: Assegura que readerDiv existe antes de usá-lo.
        if (!readerDiv) return;
        readerDiv.style.display = 'block';
        
        try {
            html5QrCode = new Html5Qrcode("reader");
            await html5QrCode.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 150 } },
                onScanSuccess,
                () => {} 
            );
            isScanning = true;
            document.getElementById('scan-btn').textContent = 'Parar Scanner';
            document.getElementById('scan-btn').classList.add('btn-danger');
        } catch (err) {
            alert(`Erro na câmera: ${err.message}`);
            readerDiv.style.display = 'none';
        }
    }

    async function stopScanner() {
        if (isScanning && html5QrCode) {
            try { await html5QrCode.stop(); } catch (e) { console.error("Erro ao parar scanner:", e); }
            html5QrCode = null;
            isScanning = false;
            document.getElementById('scan-btn').textContent = 'Ativar Scanner';
            document.getElementById('scan-btn').classList.remove('btn-danger');
            const readerDiv = document.getElementById('reader');
            if (readerDiv) readerDiv.style.display = 'none';
        }
    }
    
    function onScanSuccess(decodedText) {
        if (isScanning) {
            stopScanner();
            processPatient(decodedText);
            if (navigator.vibrate) navigator.vibrate(200);
        }
    }

    // --- LÓGICA DO PACIENTE E TIMELINE (CORRIGIDO) ---
    function submitManualId() {
        const patientId = document.getElementById('patient-id-input').value.trim().toUpperCase();
        if (patientId.length < 3) return alert('ID do paciente deve ter pelo menos 3 caracteres.');
        processPatient(patientId);
    }

    function processPatient(patientId) {
        pacienteAtual = patientId;
        stepTimes = {}; // Reseta os tempos
        
        // CORREÇÃO: O ID do display de paciente foi corrigido.
        const patientIdDisplay = document.getElementById('patient-id-display');
        if (patientIdDisplay) {
            patientIdDisplay.textContent = pacienteAtual;
        }
        
        nextStep();
    }

    function markTimelineStep(stepIndex, button) {
        const now = new Date();
        stepTimes[stepIndex] = now;
        
        button.disabled = true;
        button.classList.remove('btn-primary');
        button.classList.add('btn-success');
        button.textContent = '✅ Marcado';

        const timeDisplay = document.getElementById(`time-display-${stepIndex}`);
        if(timeDisplay) {
            timeDisplay.innerHTML = `Marcado às <span class="font-bold">${formatTime(now)}</span>`;
        }
        
        setTimeout(() => nextStep(), 1000);
    }

    // --- FINALIZAÇÃO E SALVAMENTO (LÓGICA DO GOOGLE SHEETS RESTAURADA) ---
    function validateFinalForm() {
        const sala = document.getElementById('sala-select').value;
        const leito = document.getElementById('leito-select').value;
        document.getElementById('save-btn').disabled = !(sala && leito);
    }
    
    async function saveToGoogleSheets() {
        showLoading(true);

        const dataToSend = {
            patientId: pacienteAtual,
            sala: document.getElementById('sala-select').value,
            destino: document.getElementById('leito-select').value,
            // CORREÇÃO: O campo 'observacoes' não existia no HTML, adicionei a busca por ele, se existir.
            observacoes: document.getElementById('observations')?.value || '', 
            stepTimes: Object.fromEntries(
                Object.entries(stepTimes).map(([key, value]) => [key, value.toISOString()])
            ),
            timestamp: new Date().toISOString(),
            versao: 'Revolutionary v4.0'
        };

        console.log("✅ Enviando dados para o Google Sheets:", JSON.stringify(dataToSend, null, 2));

        try {
            await fetch(URL_BACKEND, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSend)
            });
            nextStep();
        } catch (error) {
            console.error('❌ Erro ao salvar:', error);
            alert('Falha ao enviar os dados. Verifique sua conexão e a URL do Backend.');
        } finally {
            showLoading(false);
        }
    }

    // --- RESET E UTILITÁRIOS ---
    function resetSystem() {
        window.location.reload();
    }

    const formatTime = (date) => date.toLocaleTimeString('pt-BR');
    
    const showLoading = (isLoading) => {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = isLoading ? 'flex' : 'none';
    };

    init();
});