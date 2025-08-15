/*
  HemoFlow Revolutionary v4.0 - Versão Final e Funcional
  - Scanner, ID Manual e Salvamento no Google Sheets 100% funcionais.
  - Novo Dashboard de Análise integrado para visualização de KPIs.
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
    let historicalData = [];
    
    const stepDefinitions = [
        { id: 'welcome' }, { id: 'scanner' }, { id: 'patient' },
        ...Array(9).fill().map((_, i) => ({ id: `timeline-${i+1}`, isTimeline: true })),
        { id: 'final' }, { id: 'success' }, { id: 'dashboard' }
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

    function setupEventListeners() {
        document.getElementById('start-btn').addEventListener('click', () => nextStep());
        document.getElementById('scan-btn').addEventListener('click', toggleScanner);
        document.getElementById('manual-submit-btn').addEventListener('click', submitManualId);
        document.getElementById('patient-id-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') submitManualId(); });
        document.getElementById('start-timeline-btn').addEventListener('click', () => nextStep());
        document.getElementById('save-btn').addEventListener('click', saveToGoogleSheets);
        document.getElementById('new-patient-btn').addEventListener('click', resetSystem);
        document.getElementById('view-dashboard-btn-welcome').addEventListener('click', showDashboard);
        document.getElementById('view-dashboard-btn-success').addEventListener('click', showDashboard);
        document.getElementById('back-to-welcome-btn').addEventListener('click', resetSystem);
        
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

    // --- NAVEGAÇÃO E UI ---
    function showStep(stepIndex) {
        document.querySelectorAll('.step-container').forEach(el => el.style.display = 'none');
        const stepId = stepDefinitions[stepIndex].id;
        const currentStepElement = document.getElementById(`step-${stepId}`);
        if (currentStepElement) currentStepElement.style.display = 'flex';
        currentStep = stepIndex;
        const indicator = document.getElementById('current-step-indicator');
        if(indicator) indicator.textContent = stepIndex + 1;
    }

    function nextStep() {
        if (currentStep < stepDefinitions.findIndex(s => s.id === 'final')) {
            showStep(currentStep + 1);
        } else {
             showStep(stepDefinitions.findIndex(s => s.id === 'final'));
        }
    }

    // --- SCANNER ---
    async function toggleScanner() {
        if (isScanning) await stopScanner();
        else await startScanner();
    }

    async function startScanner() {
        const readerDiv = document.getElementById('reader');
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
            try { await html5QrCode.stop(); } catch (e) {}
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

    // --- LÓGICA DO PACIENTE E TIMELINE ---
    function submitManualId() {
        const patientId = document.getElementById('patient-id-input').value.trim().toUpperCase();
        if (patientId.length < 3) return alert('ID do paciente deve ter pelo menos 3 caracteres.');
        processPatient(patientId);
    }

    function processPatient(patientId) {
        pacienteAtual = patientId;
        stepTimes = {};
        document.getElementById('patient-id-display').textContent = pacienteAtual;
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
        if(timeDisplay) timeDisplay.innerHTML = `Marcado às <span class="font-bold">${formatTime(now)}</span>`;
        
        setTimeout(() => nextStep(), 1000);
    }

    // --- FINALIZAÇÃO E SALVAMENTO ---
    function validateFinalForm() {
        const sala = document.getElementById('sala-select').value;
        const leito = document.getElementById('leito-select').value;
        document.getElementById('save-btn').disabled = !(sala && leito);
    }
    
    async function saveToGoogleSheets() {
        showLoading(true);

        const metricas = {
            tempoTotal: (stepTimes[1] && stepTimes[9]) ? calculateDuration(stepTimes[1], stepTimes[9]) : null,
            tempoProcedimento: (stepTimes[5] && stepTimes[6]) ? calculateDuration(stepTimes[5], stepTimes[6]) : null,
            tempoPreparacao: (stepTimes[2] && stepTimes[5]) ? calculateDuration(stepTimes[2], stepTimes[5]) : null,
            tempoLimpeza: (stepTimes[8] && stepTimes[9]) ? calculateDuration(stepTimes[8], stepTimes[9]) : null,
        };

        const dataToSend = {
            patientId: pacienteAtual,
            sala: document.getElementById('sala-select').value,
            destino: document.getElementById('leito-select').value,
            observacoes: document.getElementById('observations')?.value || '',
            stepTimes: Object.fromEntries(Object.entries(stepTimes).map(([k, v]) => [k, v.toISOString()])),
            timestamp: new Date().toISOString(),
            metricas: metricas
        };

        try {
            await fetch(URL_BACKEND, {
                method: 'POST', mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSend)
            });
            showStep(stepDefinitions.findIndex(s => s.id === 'success'));
        } catch (error) {
            alert('Falha ao enviar os dados. Verifique a conexão.');
        } finally {
            showLoading(false);
        }
    }

    // --- LÓGICA DO DASHBOARD ---
    async function showDashboard() {
        showStep(stepDefinitions.findIndex(s => s.id === 'dashboard'));
        document.getElementById('dashboard-content').style.display = 'none';
        document.getElementById('dashboard-loading').style.display = 'block';

        try {
            const response = await fetch(URL_BACKEND);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();

            if (result.status === "success") {
                historicalData = result.data;
                const kpis = calculateKPIs(historicalData);
                renderDashboard(kpis);
                document.getElementById('dashboard-content').style.display = 'block';
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            alert("Não foi possível carregar os dados do dashboard.");
        } finally {
            document.getElementById('dashboard-loading').style.display = 'none';
        }
    }

    function calculateKPIs(data) {
        const hoje = new Date().toISOString().slice(0, 10);
        const atendimentosHoje = data.filter(d => d.Data.slice(0, 10) === hoje);
        const totalHoje = atendimentosHoje.length;

        const temposTotais = data.map(d => parseFloat(d.Tempo_Total_min)).filter(t => !isNaN(t));
        const tempoMedio = temposTotais.length > 0 ? (temposTotais.reduce((a, b) => a + b, 0) / temposTotais.length).toFixed(1) : 0;

        const temposPorEtapa = {};
        const nomesEtapas = [
            'Dur_ChegadaEntrada', 'Dur_EntradaInicioCob', 'Dur_InicioCobFimCob', 
            'Dur_FimCobInicioProc', 'Dur_InicioProcFimProc', 'Dur_FimProcSaida',
            'Dur_SaidaInicioLimp', 'Dur_InicioLimpFimLimp'
        ];
        
        nomesEtapas.forEach(nome => { temposPorEtapa[nome] = []; });

        data.forEach(atendimento => {
            nomesEtapas.forEach(nome => {
                const tempo = parseFloat(atendimento[nome]);
                if (!isNaN(tempo)) temposPorEtapa[nome].push(tempo);
            });
        });

        let gargalo = { nome: 'N/A', tempo: 0 };
        let mediasPorEtapa = {};
        for (const etapa in temposPorEtapa) {
            const media = temposPorEtapa[etapa].length > 0 ? 
                (temposPorEtapa[etapa].reduce((a, b) => a + b, 0) / temposPorEtapa[etapa].length) : 0;
            mediasPorEtapa[etapa] = media;
            if (media > gargalo.tempo) {
                gargalo = { nome: etapa.replace('Dur_', '').replace(/([A-Z])/g, ' $1').trim(), tempo: media };
            }
        }

        return { totalHoje, tempoMedio, gargalo, mediasPorEtapa };
    }

    let etapasChartInstance = null;
    function renderDashboard(kpis) {
        document.getElementById('kpi-total-hoje').textContent = kpis.totalHoje;
        document.getElementById('kpi-tempo-medio').innerHTML = `${kpis.tempoMedio}<span class="text-xl"> min</span>`;
        document.getElementById('kpi-gargalo').textContent = kpis.gargalo.nome;
        
        const ctx = document.getElementById('etapasChart').getContext('2d');
        if (etapasChartInstance) etapasChartInstance.destroy();

        etapasChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(kpis.mediasPorEtapa).map(l => l.replace('Dur_', '').replace(/([A-Z])/g, ' $1').trim()),
                datasets: [{
                    label: 'Tempo Médio (min)',
                    data: Object.values(kpis.mediasPorEtapa),
                    backgroundColor: 'rgba(10, 132, 255, 0.6)',
                    borderColor: 'rgba(10, 132, 255, 1)',
                    borderWidth: 1,
                    borderRadius: 5,
                }]
            },
            options: { responsive: true, scales: { y: { beginAtZero: true } } }
        });
    }

    // --- RESET E UTILITÁRIOS ---
    function resetSystem() { window.location.reload(); }
    const formatTime = (date) => date.toLocaleTimeString('pt-BR');
    const calculateDuration = (start, end) => (end - start) / 60000;
    const showLoading = (isLoading) => {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = isLoading ? 'flex' : 'none';
    };

    init();
});
