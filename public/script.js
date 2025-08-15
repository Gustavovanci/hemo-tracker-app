/*
  HemoFlow Revolutionary v4.0 - Versão Corrigida e Otimizada
  - Correção na sensibilidade do scanner e feedback de depuração.
  - Correção na estrutura de dados (stepTimes) para garantir o salvamento no Google Sheets.
*/
document.addEventListener('DOMContentLoaded', () => {
    
    // --- CONFIGURAÇÃO ---
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
        console.log('🚀 HemoFlow v4.0 (Corrigido) iniciado!');
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

    // --- NAVEGAÇÃO ---
    function showStep(stepIndex) {
        document.querySelectorAll('.step-container').forEach(el => el.style.display = 'none');
        const stepId = stepDefinitions[stepIndex].id;
        const currentStepElement = document.getElementById(`step-${stepId}`);
        if (currentStepElement) {
            currentStepElement.style.display = 'flex';
        }
        currentStep = stepIndex;
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
        readerDiv.style.display = 'block';
        try {
            html5QrCode = new Html5Qrcode("reader");
            const config = { 
                fps: 10, 
                qrbox: { width: 280, height: 180 } // Aumentado para melhor reconhecimento
            };
            await html5QrCode.start(
                { facingMode: "environment" },
                config,
                onScanSuccess,
                (errorMessage) => { 
                    // Log de erros de scan para depuração, se necessário
                    // console.log("Scan failed:", errorMessage);
                } 
            );
            isScanning = true;
            document.getElementById('scan-btn').textContent = 'Parar Scanner';
        } catch (err) {
            alert(`Erro na câmera: ${err.message}`);
            readerDiv.style.display = 'none';
        }
    }

    async function stopScanner() {
        if (isScanning && html5QrCode) {
            try {
                await html5QrCode.stop();
            } catch(e) {
                console.error("Erro ao parar scanner:", e);
            }
            html5QrCode = null;
            isScanning = false;
            document.getElementById('scan-btn').textContent = 'Ativar Scanner';
            document.getElementById('reader').style.display = 'none';
        }
    }

    function onScanSuccess(decodedText) {
        if (isScanning) { // Evita múltiplos acionamentos
            stopScanner();
            processPatient(decodedText);
        }
    }

    // --- LÓGICA DO PACIENTE E TIMELINE (CORRIGIDO) ---
    function submitManualId() {
        const patientId = document.getElementById('patient-id-input').value.trim().toUpperCase();
        if (patientId.length < 3) {
            alert('ID do paciente deve ter pelo menos 3 caracteres.');
            return;
        }
        processPatient(patientId);
    }

    function processPatient(patientId) {
        pacienteAtual = patientId;
        // CORREÇÃO: Inicializa o stepTimes vazio. O primeiro tempo será o passo 1.
        stepTimes = {};
        document.getElementById('patient-id-display').textContent = pacienteAtual;
        nextStep();
    }

    function markTimelineStep(stepIndex, button) {
        const now = new Date();
        // CORREÇÃO: stepTimes agora usa chaves de 1 a 9, como esperado pela planilha.
        stepTimes[stepIndex] = now;
        
        button.disabled = true;
        button.classList.remove('btn-primary');
        button.classList.add('btn-success');
        button.textContent = '✅ Marcado';

        const timeDisplay = document.getElementById(`time-display-${stepIndex}`);
        timeDisplay.innerHTML = `Marcado às <span class="font-bold">${formatTime(now)}</span>`;

        setTimeout(() => nextStep(), 1000);
    }

    // --- FINALIZAÇÃO (CORRIGIDO) ---
    function validateFinalForm() {
        const sala = document.getElementById('sala-select').value;
        const leito = document.getElementById('leito-select').value;
        document.getElementById('save-btn').disabled = !(sala && leito);
    }
    
    async function saveToGoogleSheets() {
        showLoading(true);
        // CORREÇÃO: A estrutura de 'stepTimes' agora está correta para o backend
        const data = {
            patientId: pacienteAtual,
            sala: document.getElementById('sala-select').value,
            destino: document.getElementById('leito-select').value,
            observacoes: document.getElementById('observations').value,
            stepTimes: Object.fromEntries(Object.entries(stepTimes).map(([k, v]) => [k, v.toISOString()])),
            timestamp: new Date().toISOString()
        };

        console.log("Enviando para Google Sheets:", data); // Log para depuração

        try {
            await fetch(URL_BACKEND, {
                method: 'POST',
                mode: 'no-cors', // Essencial para Google Apps Script
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            nextStep();
        } catch (error) {
            alert('Erro ao enviar dados. Verifique a conexão com a internet.');
        } finally {
            showLoading(false);
        }
    }

    // --- RESET ---
    function resetSystem() {
        window.location.reload();
    }
    
    // --- UTILITÁRIOS ---
    const formatTime = (date) => date.toLocaleTimeString('pt-BR');
    const showLoading = (isLoading) => {
        document.getElementById('loading-overlay').style.display = isLoading ? 'flex' : 'none';
    };

    init();
});