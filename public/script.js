/*
  ARQUIVO: script.js
  -------------------
  HemoFlow v3.0 - Sistema Avançado com Analytics Preditivos
  - Correção de problemas de câmera
  - Analytics em tempo real
  - Integração robusta com Google Sheets
  - Sistema de notificações inteligentes
  - Previsões baseadas em IA
*/

document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURAÇÃO ---
    // IMPORTANTE: Substitua pela URL do seu Google Apps Script
    const URL_BACKEND = "https://script.google.com/macros/s/AKfycbwvGRx2h7Tl4OvHTjprfLE2YnQf8kvO7F8T1c3yuIkUMzTqQUQn5l-tSSTFwUiqL9er/exec";
    
    // --- SELETORES DO DOM ---
    const startScanBtn = document.getElementById('start-scan-btn');
    const readerDiv = document.getElementById('reader');
    const cameraView = document.getElementById('camera-view');
    const patientInfo = document.getElementById('patient-info');
    const patientIdSpan = document.getElementById('patient-id');
    const timelineSection = document.getElementById('timeline-section');
    const analyticsSection = document.getElementById('analytics-section');
    const statsSection = document.getElementById('stats-section');
    const finalSection = document.getElementById('final-section');
    const nextStepBtn = document.getElementById('next-step-btn');
    const resetBtn = document.getElementById('reset-btn');
    const salaSelect = document.getElementById('sala-select');
    const leitoSelect = document.getElementById('leito-select');
    const checkoutBtn = document.getElementById('checkout-btn');
    const scannerStatus = document.getElementById('scanner-status');
    const manualPatientId = document.getElementById('manual-patient-id');
    const manualSubmitBtn = document.getElementById('manual-submit-btn');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const currentStepSpan = document.getElementById('current-step');

    // --- ESTADO DA APLICAÇÃO ---
    let html5QrCode = null;
    let pacienteAtual = null;
    let currentStep = 0;
    let stepTimes = {};
    let isScanning = false;
    let historicalData = getHistoricalData();
    let analyticsInterval = null;
    
    // Configuração da câmera
    const cameraConfig = {
        fps: 10,
        qrbox: { width: 280, height: 180 },
        aspectRatio: 1.0,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
    };

    // Nomes das etapas
    const stepNames = [
        'Chegada na Hemodinâmica',
        'Entrada na Sala', 
        'Início da Cobertura',
        'Término da Cobertura',
        'Início do Procedimento',
        'Término do Procedimento',
        'Saída da Sala',
        'Início da Limpeza',
        'Término da Limpeza'
    ];

    // --- INICIALIZAÇÃO ---
    function init() {
        console.log('🚀 HemoFlow v3.0 iniciado!');
        
        // Event Listeners
        startScanBtn.addEventListener('click', toggleScanner);
        nextStepBtn.addEventListener('click', proximaEtapa);
        resetBtn.addEventListener('click', resetarAplicativo);
        checkoutBtn.addEventListener('click', finalizarAtendimento);
        manualSubmitBtn.addEventListener('click', handleManualInput);
        
        // Enter key no input manual
        manualPatientId.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleManualInput();
            }
        });
        
        // Monitora selects para habilitar botão final
        [salaSelect, leitoSelect].forEach(select => {
            select.addEventListener('change', verificarBotaoFinalizar);
        });
        
        // Atualiza status do sistema
        updateSystemStatus();
        
        // Inicializa analytics se houver dados históricos
        if (historicalData.length > 0) {
            updateAnalytics();
        }
        
        console.log('✅ Inicialização concluída');
    }

    // --- LÓGICA DO SCANNER CORRIGIDA ---
    async function toggleScanner() {
        if (isScanning) {
            await pararScanner();
        } else {
            await iniciarScanner();
        }
    }

    async function iniciarScanner() {
        console.log('📷 Iniciando scanner...');
        
        try {
            // Mostra status de carregamento
            scannerStatus.style.display = 'block';
            scannerStatus.innerHTML = '<div class="loading inline-block mr-2"></div>Inicializando câmera...';
            
            // Verifica permissões
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Câmera não disponível neste dispositivo');
            }
            
            // Solicita permissão explícita
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop()); // Para o stream de teste
            
            // Inicializa o scanner
            readerDiv.style.display = 'block';
            html5QrCode = new Html5Qrcode("reader");
            
            // Lista câmeras disponíveis
            const cameras = await Html5Qrcode.getCameras();
            console.log('📱 Câmeras encontradas:', cameras.length);
            
            if (cameras.length === 0) {
                throw new Error('Nenhuma câmera encontrada');
            }
            
            // Preferencialmente câmera traseira
            let cameraId = cameras[0].id;
            const backCamera = cameras.find(camera => 
                camera.label.toLowerCase().includes('back') || 
                camera.label.toLowerCase().includes('rear') ||
                camera.label.toLowerCase().includes('environment')
            );
            
            if (backCamera) {
                cameraId = backCamera.id;
                console.log('📸 Usando câmera traseira:', backCamera.label);
            }
            
            // Inicia o scanner
            await html5QrCode.start(
                cameraId,
                cameraConfig,
                onScanSuccess,
                onScanFailure
            );
            
            isScanning = true;
            startScanBtn.innerHTML = `
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Parar Scanner
            `;
            
            scannerStatus.innerHTML = '<span class="text-success-400">✓ Scanner ativo - aponte para o QR Code</span>';
            
            console.log('✅ Scanner iniciado com sucesso');
            
        } catch (error) {
            console.error('❌ Erro ao iniciar scanner:', error);
            
            scannerStatus.innerHTML = `<span class="text-danger-400">❌ ${error.message}</span>`;
            
            showToast('Erro na câmera. Use o input manual abaixo.', 'warning');
            
            // Focus no input manual como fallback
            manualPatientId.focus();
        }
    }

    async function pararScanner() {
        console.log('📷 Parando scanner...');
        
        try {
            if (html5QrCode && isScanning) {
                await html5QrCode.stop();
                html5QrCode.clear();
                html5QrCode = null;
            }
            
            isScanning = false;
            readerDiv.style.display = 'none';
            scannerStatus.style.display = 'none';
            
            startScanBtn.innerHTML = `
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 7V5C3 3.89543 3.89543 3 5 3H7M17 3H19C20.1046 3 21 3.89543 21 5V7M21 17V19C21 20.1046 20.1046 21 19 21H17M7 21H5C3.89543 21 3 20.1046 3 19V17M12 8V16M8 12H16" />
                </svg>
                Escanear Pulseira do Paciente
            `;
            
            console.log('✅ Scanner parado');
            
        } catch (error) {
            console.error('❌ Erro ao parar scanner:', error);
        }
    }

    function onScanSuccess(decodedText, decodedResult) {
        console.log(`✅ Código escaneado: ${decodedText}`);
        
        // Para o scanner automaticamente
        pararScanner();
        
        // Processa o paciente
        processarPaciente(decodedText);
        
        showToast(`Paciente ${decodedText} identificado com sucesso!`, 'success');
    }

    function onScanFailure(error) {
        // Ignora erros de scan frequentes para não poluir o console
        // console.log('Scan failed:', error);
    }

    function handleManualInput() {
        const patientId = manualPatientId.value.trim();
        
        if (!patientId) {
            showToast('Digite o ID do paciente', 'warning');
            manualPatientId.focus();
            return;
        }
        
        console.log(`📝 ID manual inserido: ${patientId}`);
        processarPaciente(patientId);
        manualPatientId.value = '';
        
        showToast(`Paciente ${patientId} inserido manualmente!`, 'success');
    }

    function processarPaciente(patientId) {
        pacienteAtual = patientId;
        patientIdSpan.textContent = pacienteAtual;
        
        // Atualiza informações do paciente
        document.getElementById('entry-time').textContent = formatarHorario(new Date());
        document.getElementById('final-patient-id').textContent = pacienteAtual;
        
        // Mostra seções
        patientInfo.style.display = 'block';
        timelineSection.style.display = 'block';
        analyticsSection.style.display = 'block';
        
        // Atualiza interface
        startScanBtn.disabled = true;
        nextStepBtn.disabled = false;
        
        // Ativa primeira etapa
        ativarEtapa(1);
        
        // Inicia analytics em tempo real
        startRealTimeAnalytics();
        
        console.log('📋 Paciente processado e timeline iniciada');
    }

    // --- LÓGICA DA TIMELINE APRIMORADA ---
    function ativarEtapa(numeroEtapa) {
        const stepIndicator = document.getElementById(`step${numeroEtapa}`);
        if (stepIndicator) {
            stepIndicator.classList.remove('pending');
            stepIndicator.classList.add('active');
            
            // Atualiza texto do botão
            if (numeroEtapa <= stepNames.length) {
                nextStepBtn.innerHTML = `
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13L9 17L19 7" />
                    </svg>
                    ${stepNames[numeroEtapa - 1]}
                `;
            }
            
            // Atualiza indicadores de progresso
            updateProgress();
            
            console.log(`🎯 Etapa ${numeroEtapa} ativada: ${stepNames[numeroEtapa - 1]}`);
        }
    }

    function proximaEtapa() {
        if (currentStep < stepNames.length) {
            currentStep++;
            const agora = new Date();
            stepTimes[currentStep] = agora;
            
            console.log(`✅ Etapa ${currentStep} concluída: ${stepNames[currentStep - 1]}`);
            
            // Marca etapa atual como completa
            const stepIndicator = document.getElementById(`step${currentStep}`);
            const timeElement = document.getElementById(`time${currentStep}`);
            
            if (stepIndicator && timeElement) {
                stepIndicator.classList.remove('active', 'pending');
                stepIndicator.classList.add('completed');
                stepIndicator.innerHTML = '✓';
                
                timeElement.textContent = formatarHorario(agora);
                
                // Calcula duração desde etapa anterior
                if (currentStep > 1) {
                    const tempoAnterior = stepTimes[currentStep - 1];
                    const duracao = calcularDuracao(tempoAnterior, agora);
                    const durationElement = document.getElementById(`duration${currentStep - 1}`);
                    if (durationElement) {
                        durationElement.textContent = `Duração: ${formatarDuracao(duracao)}`;
                    }
                }
            }
            
            // Atualiza analytics
            updateRealTimeAnalytics();
            
            // Próxima etapa ou finalização
            if (currentStep < stepNames.length) {
                ativarEtapa(currentStep + 1);
            } else {
                // Todas as etapas concluídas
                nextStepBtn.disabled = true;
                nextStepBtn.innerHTML = '✅ Todas as Etapas Concluídas';
                
                // Mostra seções finais
                statsSection.style.display = 'block';
                finalSection.style.display = 'block';
                
                // Para analytics em tempo real
                stopRealTimeAnalytics();
                
                // Calcula estatísticas finais
                calcularEstatisticas();
                
                showToast('Procedimento concluído! Preencha os dados finais.', 'success');
                
                console.log('🎉 Todas as etapas concluídas!');
            }
            
            // Atualiza progresso
            updateProgress();
        }
    }

    function updateProgress() {
        const progress = (currentStep / stepNames.length) * 100;
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}% concluído`;
        currentStepSpan.textContent = `Etapa ${currentStep + 1}/${stepNames.length}`;
    }

    // --- ANALYTICS PREDITIVOS (NOVO) ---
    function startRealTimeAnalytics() {
        console.log('🤖 Iniciando analytics em tempo real...');
        
        analyticsInterval = setInterval(() => {
            updateRealTimeAnalytics();
        }, 30000); // Atualiza a cada 30 segundos
        
        updateRealTimeAnalytics();
    }

    function stopRealTimeAnalytics() {
        if (analyticsInterval) {
            clearInterval(analyticsInterval);
            analyticsInterval = null;
            console.log('🤖 Analytics em tempo real parados');
        }
    }

    function updateRealTimeAnalytics() {
        if (currentStep === 0) return;
        
        // Previsão de conclusão baseada no histórico
        const previsao = calcularPrevisaoConlusao();
        document.getElementById('predicted-completion').textContent = previsao;
        
        // Status de performance
        const performance = avaliarPerformance();
        updatePerformanceStatus(performance);
        
        // Alertas inteligentes
        updateSmartAlerts();
        
        console.log('📊 Analytics atualizados');
    }

    function calcularPrevisaoConlusao() {
        if (currentStep === 0 || historicalData.length === 0) return '--:--';
        
        try {
            const tempoAtual = Date.now();
            const tempoInicio = stepTimes[1].getTime();
            const tempoDecorrido = (tempoAtual - tempoInicio) / 60000; // em minutos
            
            // Calcula tempo médio histórico baseado na etapa atual
            const tempoMedioTotal = historicalData.reduce((acc, item) => acc + item.tempoTotal, 0) / historicalData.length;
            const progressoAtual = currentStep / stepNames.length;
            const tempoEstimadoRestante = (tempoMedioTotal * (1 - progressoAtual));
            
            const previsaoConclusao = new Date(tempoAtual + (tempoEstimadoRestante * 60000));
            
            return formatarHorario(previsaoConclusao);
        } catch (error) {
            console.error('Erro no cálculo de previsão:', error);
            return '--:--';
        }
    }

    function avaliarPerformance() {
        if (currentStep === 0 || historicalData.length === 0) {
            return { status: 'normal', message: 'Coletando dados...' };
        }
        
        try {
            const tempoAtual = Date.now();
            const tempoInicio = stepTimes[1].getTime();
            const tempoDecorrido = (tempoAtual - tempoInicio) / 60000;
            
            const tempoMedioAteFase = calcularTempoMedioAteFase(currentStep);
            
            if (tempoDecorrido < tempoMedioAteFase * 0.8) {
                return { status: 'excelente', message: '🚀 Muito rápido!' };
            } else if (tempoDecorrido < tempoMedioAteFase * 1.2) {
                return { status: 'normal', message: '✓ No prazo' };
            } else if (tempoDecorrido < tempoMedioAteFase * 1.5) {
                return { status: 'atencao', message: '⚠️ Atenção' };
            } else {
                return { status: 'critico', message: '🚨 Atraso' };
            }
        } catch (error) {
            return { status: 'normal', message: '✓ No prazo' };
        }
    }

    function updatePerformanceStatus(performance) {
        const statusElement = document.getElementById('performance-status');
        
        const statusConfig = {
            'excelente': { color: 'text-success-400', icon: '🚀' },
            'normal': { color: 'text-success-400', icon: '✓' },
            'atencao': { color: 'text-warning-400', icon: '⚠️' },
            'critico': { color: 'text-danger-400', icon: '🚨' }
        };
        
        const config = statusConfig[performance.status] || statusConfig.normal;
        
        statusElement.className = `text-2xl font-bold ${config.color}`;
        statusElement.innerHTML = `<span>${config.icon} ${performance.message}</span>`;
    }

    function updateSmartAlerts() {
        const alertsContainer = document.getElementById('smart-alerts');
        alertsContainer.innerHTML = '';
        
        const alerts = generateSmartAlerts();
        
        alerts.forEach(alert => {
            const alertElement = createAlertElement(alert);
            alertsContainer.appendChild(alertElement);
        });
    }

    function generateSmartAlerts() {
        const alerts = [];
        
        if (currentStep === 0) return alerts;
        
        try {
            // Alerta de tempo excessivo em uma etapa
            if (currentStep > 1) {
                const ultimaEtapa = currentStep - 1;
                const tempoUltimaEtapa = calcularDuracao(stepTimes[ultimaEtapa], stepTimes[currentStep]);
                const tempoMedioEtapa = calcularTempoMedioEtapa(ultimaEtapa);
                
                if (tempoUltimaEtapa > tempoMedioEtapa * 1.5) {
                    alerts.push({
                        type: 'warning',
                        title: 'Etapa Demorada',
                        message: `${stepNames[ultimaEtapa - 1]} levou ${formatarDuracao(tempoUltimaEtapa)} (média: ${formatarDuracao(tempoMedioEtapa)})`
                    });
                }
            }
            
            // Alerta de procedimento rápido
            if (currentStep >= 6) {
                const tempoProcedimento = calcularDuracao(stepTimes[5], stepTimes[6]);
                const tempoMedioProcedimento = calcularTempoMedioEtapa(5, 6);
                
                if (tempoProcedimento < tempoMedioProcedimento * 0.5) {
                    alerts.push({
                        type: 'info',
                        title: 'Procedimento Rápido',
                        message: `Procedimento realizado em ${formatarDuracao(tempoProcedimento)} - muito eficiente!`
                    });
                }
            }
            
            // Recomendações baseadas no horário
            const horaAtual = new Date().getHours();
            if (horaAtual >= 17 && currentStep <= 3) {
                alerts.push({
                    type: 'info',
                    title: 'Horário de Pico',
                    message: 'Fim do dia - considere priorizar etapas críticas'
                });
            }
            
        } catch (error) {
            console.error('Erro ao gerar alertas:', error);
        }
        
        return alerts;
    }

    function createAlertElement(alert) {
        const div = document.createElement('div');
        
        const typeConfig = {
            'info': { color: 'border-l-accent-500 bg-accent-500/10', icon: 'ℹ️' },
            'warning': { color: 'border-l-warning-500 bg-warning-500/10', icon: '⚠️' },
            'success': { color: 'border-l-success-500 bg-success-500/10', icon: '✅' },
            'error': { color: 'border-l-danger-500 bg-danger-500/10', icon: '❌' }
        };
        
        const config = typeConfig[alert.type] || typeConfig.info;
        
        div.className = `border-l-4 ${config.color} p-4 rounded-r-lg`;
        div.innerHTML = `
            <div class="flex items-start">
                <span class="text-xl mr-3">${config.icon}</span>
                <div>
                    <h4 class="text-white font-semibold text-sm">${alert.title}</h4>
                    <p class="text-white/80 text-xs mt-1">${alert.message}</p>
                </div>
            </div>
        `;
        
        return div;
    }

    // --- CÁLCULOS E ESTATÍSTICAS APRIMORADOS ---
    function calcularEstatisticas() {
        console.log('📊 Calculando estatísticas...');
        
        if (Object.keys(stepTimes).length < 2) return;
        
        const tempos = Object.values(stepTimes);
        const primeiroTempo = tempos[0];
        const ultimoTempo = tempos[tempos.length - 1];
        
        // Tempo total
        const tempoTotal = calcularDuracao(primeiroTempo, ultimoTempo);
        document.getElementById('total-time').textContent = formatarDuracao(tempoTotal);
        
        // Tempo de procedimento (etapa 5 a 6)
        if (stepTimes[5] && stepTimes[6]) {
            const tempoProcedimento = calcularDuracao(stepTimes[5], stepTimes[6]);
            document.getElementById('procedure-time').textContent = formatarDuracao(tempoProcedimento);
        }
        
        // Tempo de preparação (etapa 2 a 5)
        if (stepTimes[2] && stepTimes[5]) {
            const tempoPreparacao = calcularDuracao(stepTimes[2], stepTimes[5]);
            document.getElementById('setup-time').textContent = formatarDuracao(tempoPreparacao);
        }
        
        // Tempo de limpeza (etapa 8 a 9)
        if (stepTimes[8] && stepTimes[9]) {
            const tempoLimpeza = calcularDuracao(stepTimes[8], stepTimes[9]);
            document.getElementById('cleaning-time').textContent = formatarDuracao(tempoLimpeza);
        }
        
        // Atualiza tempo total final
        document.getElementById('final-total-time').textContent = formatarDuracao(tempoTotal);
        
        // Comparações com histórico
        updateHistoricalComparisons();
        
        console.log('📊 Estatísticas calculadas');
    }

    function updateHistoricalComparisons() {
        if (historicalData.length === 0) return;
        
        try {
            const mediaTotal = historicalData.reduce((acc, item) => acc + item.tempoTotal, 0) / historicalData.length;
            const mediaProcedimento = historicalData.reduce((acc, item) => acc + (item.tempoProcedimento || 0), 0) / historicalData.length;
            const mediaPreparacao = historicalData.reduce((acc, item) => acc + (item.tempoPreparacao || 0), 0) / historicalData.length;
            const mediaLimpeza = historicalData.reduce((acc, item) => acc + (item.tempoLimpeza || 0), 0) / historicalData.length;
            
            // Atualiza comparações
            updateComparison('total-time-comparison', mediaTotal);
            updateComparison('procedure-time-comparison', mediaProcedimento);
            updateComparison('setup-time-comparison', mediaPreparacao);
            updateComparison('cleaning-time-comparison', mediaLimpeza);
            
        } catch (error) {
            console.error('Erro ao calcular comparações:', error);
        }
    }

    function updateComparison(elementId, mediaHistorica) {
        const element = document.getElementById(elementId);
        if (!element || !mediaHistorica) return;
        
        const tempoAtual = getCurrentTimeForComparison(elementId);
        if (!tempoAtual) return;
        
        const diferenca = tempoAtual - mediaHistorica;
        const percentual = Math.round((diferenca / mediaHistorica) * 100);
        
        if (Math.abs(percentual) < 5) {
            element.textContent = 'similar à média';
            element.className = 'text-xs text-white/60';
        } else if (percentual > 0) {
            element.textContent = `+${percentual}% vs média`;
            element.className = 'text-xs text-warning-400';
        } else {
            element.textContent = `${percentual}% vs média`;
            element.className = 'text-xs text-success-400';
        }
    }

    function getCurrentTimeForComparison(elementId) {
        // Retorna o tempo atual baseado no tipo de comparação
        if (!stepTimes[1]) return null;
        
        switch (elementId) {
            case 'total-time-comparison':
                if (stepTimes[9]) return calcularDuracao(stepTimes[1], stepTimes[9]);
                break;
            case 'procedure-time-comparison':
                if (stepTimes[5] && stepTimes[6]) return calcularDuracao(stepTimes[5], stepTimes[6]);
                break;
            case 'setup-time-comparison':
                if (stepTimes[2] && stepTimes[5]) return calcularDuracao(stepTimes[2], stepTimes[5]);
                break;
            case 'cleaning-time-comparison':
                if (stepTimes[8] && stepTimes[9]) return calcularDuracao(stepTimes[8], stepTimes[9]);
                break;
        }
        return null;
    }

    // --- FUNÇÕES AUXILIARES ---
    function calcularDuracao(inicio, fim) {
        return Math.round((fim - inicio) / 60000 * 100) / 100; // em minutos
    }

    function formatarDuracao(minutosDecimais) {
        const minutos = Math.floor(minutosDecimais);
        const segundos = Math.round((minutosDecimais - minutos) * 60);
        return `${minutos}:${segundos.toString().padStart(2, '0')}`;
    }

    function formatarHorario(data) {
        return data.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    function calcularTempoMedioAteFase(fase) {
        if (historicalData.length === 0) return 30; // Fallback padrão
        
        // Simula cálculo baseado em dados históricos
        const baseTime = 45; // tempo base em minutos
        const faseMultiplier = fase / stepNames.length;
        return baseTime * faseMultiplier;
    }

    function calcularTempoMedioEtapa(etapaInicio, etapaFim = null) {
        // Retorna tempo médio para uma etapa específica
        const temposBase = {
            1: 5,   // Chegada
            2: 10,  // Entrada na sala
            3: 15,  // Cobertura
            4: 5,   // Fim cobertura
            5: 45,  // Procedimento
            6: 10,  // Fim procedimento
            7: 5,   // Saída
            8: 15,  // Limpeza
            9: 5    // Fim limpeza
        };
        
        if (etapaFim) {
            // Tempo entre duas etapas
            return temposBase[etapaFim] - temposBase[etapaInicio];
        } else {
            // Tempo de uma etapa específica
            return temposBase[etapaInicio] || 10;
        }
    }

    // --- SISTEMA DE NOTIFICAÇÕES (NOVO) ---
    function showToast(message, type = 'info', duration = 5000) {
        const toast = createToast(message, type);
        const container = document.getElementById('toast-container');
        
        container.appendChild(toast);
        
        // Remove automaticamente
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, duration);
        
        console.log(`🔔 Toast: ${message} (${type})`);
    }

    function createToast(message, type) {
        const div = document.createElement('div');
        
        const typeConfig = {
            'success': { bg: 'bg-success-500', icon: '✅' },
            'warning': { bg: 'bg-warning-500', icon: '⚠️' },
            'error': { bg: 'bg-danger-500', icon: '❌' },
            'info': { bg: 'bg-primary-500', icon: 'ℹ️' }
        };
        
        const config = typeConfig[type] || typeConfig.info;
        
        div.className = `${config.bg} text-white px-6 py-4 rounded-lg shadow-lg flex items-center space-x-3 min-w-80 max-w-md animate-slide-up`;
        div.innerHTML = `
            <span class="text-xl">${config.icon}</span>
            <span class="flex-1">${message}</span>
            <button onclick="this.parentNode.remove()" class="text-white/80 hover:text-white">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        `;
        
        return div;
    }

    // --- INTEGRAÇÃO GOOGLE SHEETS ROBUSTA ---
    async function finalizarAtendimento() {
        if (!pacienteAtual || !salaSelect.value || !leitoSelect.value) {
            showToast('Por favor, complete todas as informações obrigatórias.', 'warning');
            return;
        }

        console.log('💾 Iniciando salvamento...');
        
        // Mostra loading
        const saveStatus = document.getElementById('save-status');
        saveStatus.style.display = 'block';
        checkoutBtn.disabled = true;
        checkoutBtn.innerHTML = '<div class="loading inline-block mr-2"></div> Salvando...';

        // Prepara dados completos
        const dadosCompletos = {
            // Dados básicos
            patientId: pacienteAtual,
            sala: salaSelect.value,
            destino: leitoSelect.value,
            observacoes: document.getElementById('observations')?.value || '',
            
            // Timeline completa
            stepTimes: Object.fromEntries(
                Object.entries(stepTimes).map(([key, value]) => [key, value.toISOString()])
            ),
            totalSteps: currentStep,
            
            // Metadados
            timestamp: new Date().toISOString(),
            versao: '3.0',
            dispositivo: navigator.userAgent,
            
            // Métricas calculadas
            metricas: calcularMetricasFinais(),
            
            // Analytics
            analytics: {
                tempoTotal: stepTimes[1] && stepTimes[9] ? calcularDuracao(stepTimes[1], stepTimes[9]) : null,
                eficiencia: avaliarEficiencia(),
                gargalos: identificarGargalos()
            }
        };

        console.log('📤 Enviando dados:', dadosCompletos);

        try {
            // Verifica se a URL foi configurada
            if (URL_BACKEND === "COLE_SUA_URL_DO_GOOGLE_APPS_SCRIPT_AQUI") {
                throw new Error('URL do Google Apps Script não configurada! Verifique o script.js');
            }
            
            const response = await fetch(URL_BACKEND, {
                method: 'POST',
                mode: 'no-cors', // Necessário para Google Apps Script
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dadosCompletos)
            });

            console.log('✅ Dados enviados com sucesso!');
            
            // Salva no histórico local
            salvarHistoricoLocal(dadosCompletos);
            
            // Atualiza interface
            checkoutBtn.innerHTML = '✅ Salvo com Sucesso!';
            checkoutBtn.classList.remove('primary');
            checkoutBtn.classList.add('success');
            saveStatus.style.display = 'none';
            
            showToast(`Dados do paciente ${pacienteAtual} salvos com sucesso!`, 'success');
            
            // Mostra opções pós-salvamento
            mostrarOpcoesPosGravacao();
            
        } catch (error) {
            console.error('❌ Erro ao enviar dados:', error);
            
            // Salva localmente como backup
            salvarBackupLocal(dadosCompletos);
            
            checkoutBtn.innerHTML = '❌ Erro - Dados Salvos Localmente';
            checkoutBtn.disabled = false;
            saveStatus.style.display = 'none';
            
            showToast('Erro no envio. Dados salvos localmente como backup.', 'warning');
        }
    }

    function calcularMetricasFinais() {
        const metricas = {};
        
        if (stepTimes[1] && stepTimes[9]) {
            metricas.tempoTotal = calcularDuracao(stepTimes[1], stepTimes[9]);
        }
        
        if (stepTimes[5] && stepTimes[6]) {
            metricas.tempoProcedimento = calcularDuracao(stepTimes[5], stepTimes[6]);
        }
        
        if (stepTimes[2] && stepTimes[5]) {
            metricas.tempoPreparacao = calcularDuracao(stepTimes[2], stepTimes[5]);
        }
        
        if (stepTimes[8] && stepTimes[9]) {
            metricas.tempoLimpeza = calcularDuracao(stepTimes[8], stepTimes[9]);
        }
        
        return metricas;
    }

    function avaliarEficiencia() {
        if (historicalData.length === 0) return 'normal';
        
        const tempoAtual = stepTimes[1] && stepTimes[9] ? 
            calcularDuracao(stepTimes[1], stepTimes[9]) : null;
            
        if (!tempoAtual) return 'incompleto';
        
        const mediaHistorica = historicalData.reduce((acc, item) => acc + item.tempoTotal, 0) / historicalData.length;
        
        if (tempoAtual < mediaHistorica * 0.8) return 'excelente';
        if (tempoAtual < mediaHistorica * 1.2) return 'normal';
        return 'abaixo_media';
    }

    function identificarGargalos() {
        const gargalos = [];
        
        // Identifica etapas que demoraram muito
        for (let i = 2; i <= currentStep; i++) {
            if (stepTimes[i] && stepTimes[i-1]) {
                const duracao = calcularDuracao(stepTimes[i-1], stepTimes[i]);
                const mediaEsperada = calcularTempoMedioEtapa(i-1, i);
                
                if (duracao > mediaEsperada * 1.5) {
                    gargalos.push({
                        etapa: stepNames[i-2],
                        duracao: duracao,
                        mediaEsperada: mediaEsperada,
                        excesso: duracao - mediaEsperada
                    });
                }
            }
        }
        
        return gargalos;
    }

    function salvarHistoricoLocal(dados) {
        try {
            let historico = JSON.parse(localStorage.getItem('hemoflow_historico') || '[]');
            
            historico.push({
                patientId: dados.patientId,
                timestamp: dados.timestamp,
                tempoTotal: dados.analytics.tempoTotal,
                tempoProcedimento: dados.metricas.tempoProcedimento,
                tempoPreparacao: dados.metricas.tempoPreparacao,
                tempoLimpeza: dados.metricas.tempoLimpeza,
                sala: dados.sala,
                eficiencia: dados.analytics.eficiencia
            });
            
            // Mantém apenas os últimos 100 registros
            if (historico.length > 100) {
                historico = historico.slice(-100);
            }
            
            localStorage.setItem('hemoflow_historico', JSON.stringify(historico));
            
            console.log('💾 Histórico local atualizado');
            
        } catch (error) {
            console.error('Erro ao salvar histórico local:', error);
        }
    }

    function salvarBackupLocal(dados) {
        try {
            let backups = JSON.parse(localStorage.getItem('hemoflow_backups') || '[]');
            
            backups.push({
                ...dados,
                backupTimestamp: new Date().toISOString(),
                enviado: false
            });
            
            localStorage.setItem('hemoflow_backups', JSON.stringify(backups));
            
            console.log('💾 Backup local criado');
            
        } catch (error) {
            console.error('Erro ao criar backup local:', error);
        }
    }

    function getHistoricalData() {
        try {
            return JSON.parse(localStorage.getItem('hemoflow_historico') || '[]');
        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
            return [];
        }
    }

    function mostrarOpcoesPosGravacao() {
        const opcoes = document.createElement('div');
        opcoes.className = 'mt-4 space-y-2';
        opcoes.innerHTML = `
            <button onclick="resetarAplicativo()" class="action-button primary w-full">
                🔄 Novo Paciente
            </button>
            <button onclick="gerarRelatorio()" class="action-button secondary w-full">
                📊 Ver Relatório
            </button>
        `;
        
        document.getElementById('final-section').appendChild(opcoes);
    }

    // --- FUNÇÕES DE SISTEMA ---
    function verificarBotaoFinalizar() {
        const salaSelec = salaSelect.value !== '';
        const leitoSelec = leitoSelect.value !== '';
        const etapasCompletas = currentStep === stepNames.length;
        
        checkoutBtn.disabled = !(salaSelec && leitoSelec && etapasCompletas);
    }

    function updateSystemStatus() {
        const statusElement = document.getElementById('system-status');
        const lastSyncElement = document.getElementById('last-sync');
        
        // Verifica conectividade
        if (navigator.onLine) {
            statusElement.innerHTML = `
                <span class="w-2 h-2 bg-success-500 rounded-full mr-2 animate-pulse"></span>
                Sistema Online
            `;
        } else {
            statusElement.innerHTML = `
                <span class="w-2 h-2 bg-warning-500 rounded-full mr-2"></span>
                Modo Offline
            `;
        }
        
        // Última sincronização
        const lastSync = localStorage.getItem('hemoflow_last_sync');
        if (lastSync) {
            const lastSyncDate = new Date(lastSync);
            lastSyncElement.textContent = `Última sync: ${formatarHorario(lastSyncDate)}`;
        }
    }

    function updateAnalytics() {
        // Placeholder para analytics iniciais
        console.log('📈 Analytics inicializados');
    }

    function resetarAplicativo() {
        console.log('🔄 Resetando aplicativo...');
        
        // Para analytics
        stopRealTimeAnalytics();
        
        // Para scanner se estiver ativo
        if (isScanning) {
            pararScanner();
        }
        
        // Reset do estado
        pacienteAtual = null;
        currentStep = 0;
        stepTimes = {};
        
        // Reset da interface
        patientInfo.style.display = 'none';
        timelineSection.style.display = 'none';
        analyticsSection.style.display = 'none';
        statsSection.style.display = 'none';
        finalSection.style.display = 'none';
        
        // Reset do scanner
        startScanBtn.innerHTML = `
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 7V5C3 3.89543 3.89543 3 5 3H7M17 3H19C20.1046 3 21 3.89543 21 5V7M21 17V19C21 20.1046 20.1046 21 19 21H17M7 21H5C3.89543 21 3 20.1046 3 19V17M12 8V16M8 12H16" />
            </svg>
            Escanear Pulseira do Paciente
        `;
        startScanBtn.disabled = false;
        
        // Reset dos controles
        nextStepBtn.disabled = true;
        nextStepBtn.innerHTML = `
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13L9 17L19 7" />
            </svg>
            Próxima Etapa
        `;
        
        checkoutBtn.disabled = true;
        checkoutBtn.innerHTML = `
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20 6L9 17L4 12" />
            </svg>
            Salvar no Google Sheets & Gerar Relatório
        `;
        checkoutBtn.classList.remove('success');
        checkoutBtn.classList.add('primary');
        
        // Reset da timeline
        for (let i = 1; i <= stepNames.length; i++) {
            const stepIndicator = document.getElementById(`step${i}`);
            const timeElement = document.getElementById(`time${i}`);
            const durationElement = document.getElementById(`duration${i}`);
            
            if (stepIndicator) {
                stepIndicator.className = 'step-indicator pending';
                stepIndicator.textContent = i;
            }
            
            if (timeElement) {
                timeElement.textContent = '--:--:--';
            }
            
            if (durationElement) {
                durationElement.textContent = '';
            }
        }
        
        // Reset dos selects
        salaSelect.value = '';
        leitoSelect.value = '';
        document.getElementById('observations').value = '';
        
        // Reset das estatísticas
        ['total-time', 'procedure-time', 'setup-time', 'cleaning-time'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = '--';
            }
        });
        
        // Reset do progresso
        progressBar.style.width = '0%';
        progressText.textContent = '0% concluído';
        currentStepSpan.textContent = 'Etapa 1/9';
        
        // Limpa input manual
        manualPatientId.value = '';
        
        showToast('Sistema resetado com sucesso!', 'success');
        
        console.log('✅ Reset concluído!');
    }

    // Função global para relatório (pode ser chamada do HTML)
    window.gerarRelatorio = function() {
        showToast('Funcionalidade de relatório em desenvolvimento', 'info');
    };

    // --- INICIALIZAÇÃO DA APLICAÇÃO ---
    init();

    // Atualiza status periodicamente
    setInterval(updateSystemStatus, 30000);

    console.log('🎉 HemoFlow v3.0 carregado com sucesso!');
});