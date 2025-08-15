/*
  HemoFlow Revolutionary v4.0
  Interface Step-by-Step Progressiva
  Cada etapa só aparece após completar a anterior
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
    
    // Steps do sistema
    const steps = [
        'welcome',
        'scanner', 
        'patient',
        'timeline-1', 'timeline-2', 'timeline-3', 'timeline-4', 
        'timeline-5', 'timeline-6', 'timeline-7', 'timeline-8', 'timeline-9',
        'final',
        'success'
    ];
    
    const stepNames = [
        'Bem-vindo',
        'Scanner',
        'Paciente',
        'Chegada na Hemodinâmica',
        'Entrada na Sala',
        'Início da Cobertura', 
        'Término da Cobertura',
        'Início do Procedimento',
        'Término do Procedimento',
        'Saída da Sala',
        'Início da Limpeza',
        'Término da Limpeza',
        'Finalização',
        'Sucesso'
    ];

    // --- INICIALIZAÇÃO ---
    function init() {
        console.log('🚀 HemoFlow Revolutionary v4.0 iniciado!');
        
        setupEventListeners();
        updateSystemStatus();
        showStep(0); // Mostrar welcome
        
        console.log('✅ Sistema step-by-step pronto!');
    }

    // --- CONFIGURAÇÃO DE EVENTOS ---
    function setupEventListeners() {
        // Welcome
        document.getElementById('start-btn').addEventListener('click', () => nextStep());
        
        // Scanner
        document.getElementById('scan-btn').addEventListener('click', toggleScanner);
        document.getElementById('manual-submit-btn').addEventListener('click', submitManualId);
        document.getElementById('patient-id-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submitManualId();
        });
        
        // Patient
        document.getElementById('start-timeline-btn').addEventListener('click', () => nextStep());
        
        // Timeline steps
        for (let i = 1; i <= 9; i++) {
            const btn = document.getElementById(`mark-step-${i}`);
            if (btn) {
                btn.addEventListener('click', () => markTimelineStep(i));
            }
        }
        
        // Final
        document.getElementById('sala-select').addEventListener('change', validateFinalForm);
        document.getElementById('leito-select').addEventListener('change', validateFinalForm);
        document.getElementById('save-btn').addEventListener('click', saveToGoogleSheets);
        
        // Success
        document.getElementById('new-patient-btn').addEventListener('click', resetSystem);
    }

    // --- NAVEGAÇÃO STEP-BY-STEP ---
    function showStep(stepIndex) {
        // Esconde todos os steps
        steps.forEach((step, index) => {
            const element = document.getElementById(`step-${step}`);
            if (element) {
                element.style.display = index === stepIndex ? 'flex' : 'none';
            }
        });
        
        // Atualiza indicador de progresso
        updateProgressIndicator(stepIndex);
        
        // Scroll to top suave
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Vibração para feedback
        if (navigator.vibrate && stepIndex > 0) {
            navigator.vibrate(100);
        }
        
        console.log(`📍 Mostrando step ${stepIndex}: ${steps[stepIndex]}`);
    }

    function nextStep() {
        if (currentStep < steps.length - 1) {
            currentStep++;
            showStep(currentStep);
        }
    }

    function updateProgressIndicator(stepIndex) {
        const indicator = document.getElementById('current-step-indicator');
        if (indicator) {
            indicator.textContent = stepIndex + 1;
        }
    }

    // --- SCANNER FUNCTIONALITY ---
    async function toggleScanner() {
        if (isScanning) {
            await stopScanner();
        } else {
            await startScanner();
        }
    }

    async function startScanner() {
        console.log('📷 Iniciando scanner revolucionário...');
        
        try {
            showScannerStatus('Inicializando câmera traseira...');
            
            // Verifica suporte
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Câmera não disponível neste navegador');
            }
            
            // Testa permissão
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "environment" } 
            });
            stream.getTracks().forEach(track => track.stop());
            
            // Inicializa scanner
            const readerDiv = document.getElementById('reader');
            readerDiv.style.display = 'block';
            html5QrCode = new Html5Qrcode("reader");
            
            // Lista câmeras
            const cameras = await Html5Qrcode.getCameras();
            console.log('📱 Câmeras encontradas:', cameras.length);
            
            if (cameras.length === 0) {
                throw new Error('Nenhuma câmera encontrada');
            }
            
            // Seleciona câmera traseira
            let selectedCamera = cameras.find(camera => {
                const label = camera.label.toLowerCase();
                return ['back', 'rear', 'environment', 'facing back'].some(keyword => 
                    label.includes(keyword)
                );
            }) || cameras[cameras.length - 1];
            
            console.log('📸 Câmera selecionada:', selectedCamera.label);
            
            // Inicia scanner
            await html5QrCode.start(
                selectedCamera.id,
                {
                    fps: 10,
                    qrbox: { width: 300, height: 200 },
                    aspectRatio: 1.0,
                    videoConstraints: {
                        facingMode: { ideal: "environment" },
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                },
                onScanSuccess,
                onScanFailure
            );
            
            isScanning = true;
            
            // Atualiza interface
            const scanBtn = document.getElementById('scan-btn');
            scanBtn.innerHTML = `
                <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Parar Scanner
            `;
            scanBtn.classList.remove('btn-primary');
            scanBtn.classList.add('btn-danger');
            
            showScannerStatus('Scanner ativo - aponte para o QR Code', 'success');
            
            // Vibração de sucesso
            if (navigator.vibrate) {
                navigator.vibrate(200);
            }
            
        } catch (error) {
            console.error('❌ Erro no scanner:', error);
            showScannerStatus(`Erro: ${error.message}`, 'error');
            
            // Focus no input manual
            document.getElementById('patient-id-input').focus();
        }
    }

    async function stopScanner() {
        console.log('📷 Parando scanner...');
        
        try {
            if (html5QrCode && isScanning) {
                await html5QrCode.stop();
                html5QrCode.clear();
                html5QrCode = null;
            }
            
            isScanning = false;
            document.getElementById('reader').style.display = 'none';
            hideScannerStatus();
            
            // Restaura botão
            const scanBtn = document.getElementById('scan-btn');
            scanBtn.innerHTML = `
                <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 7V5C3 3.89543 3.89543 3 5 3H7M17 3H19C20.1046 3 21 3.89543 21 5V7M21 17V19C21 20.1046 20.1046 21 19 21H17M7 21H5C3.89543 21 3 20.1046 3 19V17M12 8V16M8 12H16" />
                </svg>
                Ativar Scanner
            `;
            scanBtn.classList.remove('btn-danger');
            scanBtn.classList.add('btn-primary');
            
        } catch (error) {
            console.error('❌ Erro ao parar scanner:', error);
        }
    }

    function onScanSuccess(decodedText, decodedResult) {
        console.log(`✅ QR Code escaneado: ${decodedText}`);
        
        // Para scanner
        stopScanner();
        
        // Processa paciente
        processPatient(decodedText);
        
        // Feedback haptic
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }
    }

    function onScanFailure(error) {
        // Ignora erros frequentes
    }

    function showScannerStatus(message, type = 'info') {
        const status = document.getElementById('scanner-status');
        const icons = {
            info: '📷',
            success: '✅', 
            error: '❌'
        };
        
        status.querySelector('.status-icon').textContent = icons[type] || icons.info;
        status.querySelector('.status-text').textContent = message;
        status.style.display = 'block';
    }

    function hideScannerStatus() {
        document.getElementById('scanner-status').style.display = 'none';
    }

    // --- PATIENT PROCESSING ---
    function submitManualId() {
        const input = document.getElementById('patient-id-input');
        const patientId = input.value.trim().toUpperCase();
        
        if (!patientId) {
            showAlert('Digite o ID do paciente', 'warning');
            input.focus();
            return;
        }
        
        if (patientId.length < 3) {
            showAlert('ID deve ter pelo menos 3 caracteres', 'warning');
            input.focus();
            return;
        }
        
        processPatient(patientId);
    }

    function processPatient(patientId) {
        pacienteAtual = patientId;
        
        // Atualiza display
        document.getElementById('patient-id-display').textContent = pacienteAtual;
        document.getElementById('entry-time').textContent = formatTime(new Date());
        
        // Marca primeiro tempo
        stepTimes[0] = new Date();
        
        showAlert(`Paciente ${pacienteAtual} identificado!`, 'success');
        
        // Avança para próximo step
        nextStep();
        
        console.log('👤 Paciente processado:', pacienteAtual);
    }

    // --- TIMELINE MANAGEMENT ---
    function markTimelineStep(stepNumber) {
        const now = new Date();
        const timeIndex = stepNumber; // 1-9
        
        // Salva o tempo
        stepTimes[timeIndex] = now;
        
        // Atualiza display do tempo
        const timeElement = document.getElementById(`time-${stepNumber}`);
        if (timeElement) {
            timeElement.textContent = `✅ Marcado às ${formatTime(now)}`;
            timeElement.style.color = '#30D158';
        }
        
        // Calcula duração se não for o primeiro
        if (stepNumber > 1 && stepTimes[stepNumber - 1]) {
            const duration = calculateDuration(stepTimes[stepNumber - 1], now);
            const durationText = ` (Duração: ${formatDuration(duration)})`;
            timeElement.textContent += durationText;
        }
        
        // Desabilita o botão
        const button = document.getElementById(`mark-step-${stepNumber}`);
        button.disabled = true;
        button.innerHTML = '✅ Marcado';
        button.classList.remove('btn-success');
        button.classList.add('btn-primary');
        
        // Feedback
        showAlert(`${stepNames[stepNumber + 2]} marcado!`, 'success');
        
        // Vibração
        if (navigator.vibrate) {
            navigator.vibrate(300);
        }
        
        // Auto-avança para próximo step após 2 segundos
        setTimeout(() => {
            nextStep();
        }, 2000);
        
        console.log(`⏰ Step ${stepNumber} marcado:`, formatTime(now));
    }

    // --- FINAL FORM ---
    function validateFinalForm() {
        const sala = document.getElementById('sala-select').value;
        const leito = document.getElementById('leito-select').value;
        const saveBtn = document.getElementById('save-btn');
        
        saveBtn.disabled = !(sala && leito);
        
        if (sala && leito) {
            updateFinalSummary();
        }
    }

    function updateFinalSummary() {
        document.getElementById('final-patient-id').textContent = pacienteAtual || '--';
        
        if (stepTimes[0] && stepTimes[9]) {
            const totalDuration = calculateDuration(stepTimes[0], stepTimes[9]);
            document.getElementById('final-total-time').textContent = formatDuration(totalDuration);
            document.getElementById('final-start-time').textContent = formatTime(stepTimes[0]);
            document.getElementById('final-end-time').textContent = formatTime(stepTimes[9]);
        }
    }

    async function saveToGoogleSheets() {
        showLoading(true);
        
        try {
            const data = {
                patientId: pacienteAtual,
                sala: document.getElementById('sala-select').value,
                destino: document.getElementById('leito-select').value,
                observacoes: document.getElementById('observations').value,
                stepTimes: Object.fromEntries(
                    Object.entries(stepTimes).map(([key, value]) => [key, value.toISOString()])
                ),
                timestamp: new Date().toISOString(),
                versao: 'Revolutionary v4.0'
            };
            
            console.log('💾 Enviando dados:', data);
            
            if (URL_BACKEND.includes("SEU_SCRIPT_ID_AQUI")) {
                throw new Error('Configure a URL do Google Apps Script!');
            }
            
            await fetch(URL_BACKEND, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            // Salva backup local
            saveLocalBackup(data);
            
            showLoading(false);
            showAlert('Dados salvos com sucesso!', 'success');
            
            // Avança para sucesso
            nextStep();
            
        } catch (error) {
            console.error('❌ Erro ao salvar:', error);
            showLoading(false);
            showAlert(`Erro: ${error.message}`, 'error');
        }
    }

    function saveLocalBackup(data) {
        try {
            let history = JSON.parse(localStorage.getItem('hemoflow_history') || '[]');
            history.push(data);
            
            // Mantém apenas os últimos 50
            if (history.length > 50) {
                history = history.slice(-50);
            }
            
            localStorage.setItem('hemoflow_history', JSON.stringify(history));
            localStorage.setItem('hemoflow_last_sync', new Date().toISOString());
            
            console.log('💾 Backup local salvo');
        } catch (error) {
            console.error('Erro no backup local:', error);
        }
    }

    // --- SYSTEM RESET ---
    function resetSystem() {
        console.log('🔄 Resetando sistema...');
        
        // Para scanner se ativo
        if (isScanning) {
            stopScanner();
        }
        
        // Reset estado
        currentStep = 0;
        pacienteAtual = null;
        stepTimes = {};
        
        // Reset formulários
        document.getElementById('patient-id-input').value = '';
        document.getElementById('sala-select').value = '';
        document.getElementById('leito-select').value = '';
        document.getElementById('observations').value = '';
        
        // Reset botões timeline
        for (let i = 1; i <= 9; i++) {
            const button = document.getElementById(`mark-step-${i}`);
            const timeElement = document.getElementById(`time-${i}`);
            
            if (button) {
                button.disabled = false;
                button.innerHTML = `
                    <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Marcar ${stepNames[i + 2]}
                `;
                button.classList.remove('btn-primary');
                button.classList.add('btn-success');
            }
            
            if (timeElement) {
                timeElement.textContent = 'Aguardando marcação...';
                timeElement.style.color = '';
            }
        }
        
        // Volta para welcome
        showStep(0);
        
        showAlert('Sistema resetado!', 'success');
    }

    // --- UTILITY FUNCTIONS ---
    function formatTime(date) {
        return date.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    function formatDuration(minutes) {
        const hrs = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        const secs = Math.floor((minutes % 1) * 60);
        
        if (hrs > 0) {
            return `${hrs}h ${mins}m ${secs}s`;
        } else {
            return `${mins}m ${secs}s`;
        }
    }

    function calculateDuration(start, end) {
        return (end - start) / 60000; // minutos
    }

    function showAlert(message, type = 'info') {
        // Cria toast notification
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✅',
            warning: '⚠️',
            error: '❌',
            info: 'ℹ️'
        };
        
        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">${message}</div>
            <div class="toast-close" onclick="this.parentNode.remove()">×</div>
        `;
        
        // Adiciona ao container
        const container = document.getElementById('toast-container');
        if (container) {
            container.appendChild(toast);
            
            // Remove automaticamente
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 5000);
        }
        
        console.log(`🔔 ${type.toUpperCase()}: ${message}`);
    }

    function showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        overlay.style.display = show ? 'flex' : 'none';
    }

    function updateSystemStatus() {
        const statusIcon = document.getElementById('system-status-icon');
        const statusText = document.getElementById('system-status-text');
        
        if (statusIcon && statusText) {
            if (navigator.onLine) {
                statusIcon.textContent = '🟢';
                statusText.textContent = 'Sistema Online e Pronto';
            } else {
                statusIcon.textContent = '🔴';
                statusText.textContent = 'Modo Offline - Dados serão salvos localmente';
            }
        }
    }

    // --- INICIALIZAÇÃO ---
    init();
    
    // Atualiza status periodicamente
    setInterval(updateSystemStatus, 30000);
    
    console.log('🎉 HemoFlow Revolutionary v4.0 carregado!');
});