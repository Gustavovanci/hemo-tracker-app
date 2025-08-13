/*
  ARQUIVO: script.js
  -------------------
  Versão Avançada e Completa - HemoFlow
  Sistema de tracking com timeline visual e integração Google Sheets
*/

document.addEventListener('DOMContentLoaded', () => {

    // --- SELETORES DE ELEMENTOS DO DOM ---
    const startScanBtn = document.getElementById('start-scan-btn');
    const readerDiv = document.getElementById('reader');
    const patientInfo = document.getElementById('patient-info');
    const patientIdSpan = document.getElementById('patient-id');
    const timelineSection = document.getElementById('timeline-section');
    const statsSection = document.getElementById('stats-section');
    const finalSection = document.getElementById('final-section');
    const nextStepBtn = document.getElementById('next-step-btn');
    const resetBtn = document.getElementById('reset-btn');
    const salaSelect = document.getElementById('sala-select');
    const leitoSelect = document.getElementById('leito-select');
    const checkoutBtn = document.getElementById('checkout-btn');

    // --- ESTADO DO APLICATIVO ---
    let html5QrCode;
    let pacienteAtual = null;
    let currentStep = 0;
    let stepTimes = {};
    
    // --- CONFIGURAÇÕES ---
    // !!! IMPORTANTE: COLE A URL DO SEU GOOGLE APPS SCRIPT AQUI !!!
    const URL_BACKEND = "https://script.google.com/macros/s/AKfycbx1td_hM7UmxKiZEgDq2Ms7ww0YAQufhmJ3GQZigiizrEgrwoX2rdPZbd2HoT7gLRs1/exec";

    // Nomes das etapas do processo
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
        console.log('🚀 HemoFlow iniciado!');
        
        // Event Listeners
        startScanBtn.addEventListener('click', iniciarScanner);
        nextStepBtn.addEventListener('click', proximaEtapa);
        resetBtn.addEventListener('click', resetarAplicativo);
        checkoutBtn.addEventListener('click', finalizarAtendimento);
        
        // Monitora selects para habilitar botão final
        [salaSelect, leitoSelect].forEach(select => {
            select.addEventListener('change', verificarBotaoFinalizar);
        });
    }

    // --- LÓGICA DO SCANNER ---
    function iniciarScanner() {
        console.log('📷 Iniciando scanner...');
        readerDiv.style.display = 'block';
        
        html5QrCode = new Html5QrCode("reader");
        const config = { 
            fps: 10, 
            qrbox: { width: 250, height: 150 },
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
        };
        
        html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanFailure
        ).catch(err => {
            console.error("Erro ao iniciar scanner:", err);
            alert("Erro ao acessar a câmera. Verifique as permissões.");
        });
    }

    function onScanSuccess(decodedText, decodedResult) {
        console.log(`✅ Código escaneado: ${decodedText}`);
        
        pacienteAtual = decodedText;
        patientIdSpan.textContent = pacienteAtual;
        
        // Mostra informações do paciente
        patientInfo.style.display = 'block';
        timelineSection.style.display = 'block';
        
        // Para o scanner
        pararScanner();
        
        // Atualiza interface
        startScanBtn.innerHTML = '✅ Paciente Escaneado';
        startScanBtn.disabled = true;
        nextStepBtn.disabled = false;
        
        // Ativa o primeiro step
        ativarEtapa(1);
    }

    function onScanFailure(error) {
        // Ignora erros frequentes de scan
    }

    function pararScanner() {
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop().then(() => {
                readerDiv.style.display = 'none';
                console.log('📷 Scanner parado');
            }).catch(err => {
                console.error("Erro ao parar scanner:", err);
            });
        }
    }

    // --- LÓGICA DA TIMELINE ---
    function ativarEtapa(numeroEtapa) {
        const stepIndicator = document.getElementById(`step${numeroEtapa}`);
        if (stepIndicator) {
            stepIndicator.classList.remove('pending');
            stepIndicator.classList.add('active');
            
            // Atualiza texto do botão
            if (numeroEtapa <= stepNames.length) {
                nextStepBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13L9 17L19 7" />
                    </svg>
                    ${stepNames[numeroEtapa - 1]}
                `;
            }
            
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
                        durationElement.textContent = `Duração: ${duracao}`;
                    }
                }
            }
            
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
                
                // Calcula estatísticas
                calcularEstatisticas();
                
                console.log('🎉 Todas as etapas concluídas!');
            }
        }
    }

    // --- CÁLCULOS E ESTATÍSTICAS ---
    function calcularEstatisticas() {
        console.log('📊 Calculando estatísticas...');
        
        if (Object.keys(stepTimes).length < 2) return;
        
        const tempos = Object.values(stepTimes);
        const primeiroTempo = tempos[0];
        const ultimoTempo = tempos[tempos.length - 1];
        
        // Tempo total (primeira etapa até última)
        const tempoTotal = calcularDuracao(primeiroTempo, ultimoTempo);
        document.getElementById('total-time').textContent = tempoTotal;
        
        // Tempo de procedimento (etapa 5 a 6)
        if (stepTimes[5] && stepTimes[6]) {
            const tempoProcedimento = calcularDuracao(stepTimes[5], stepTimes[6]);
            document.getElementById('procedure-time').textContent = tempoProcedimento;
        }
        
        // Tempo de preparação (etapa 2 a 5)
        if (stepTimes[2] && stepTimes[5]) {
            const tempoPreparacao = calcularDuracao(stepTimes[2], stepTimes[5]);
            document.getElementById('setup-time').textContent = tempoPreparacao;
        }
        
        // Tempo de limpeza (etapa 8 a 9)
        if (stepTimes[8] && stepTimes[9]) {
            const tempoLimpeza = calcularDuracao(stepTimes[8], stepTimes[9]);
            document.getElementById('cleaning-time').textContent = tempoLimpeza;
        }
        
        console.log('📊 Estatísticas calculadas:', {
            tempoTotal,
            stepTimes: Object.keys(stepTimes).length
        });
    }

    function calcularDuracao(inicio, fim) {
        const diff = fim - inicio;
        const minutos = Math.floor(diff / 60000);
        const segundos = Math.floor((diff % 60000) / 1000);
        return `${minutos}:${segundos.toString().padStart(2, '0')}`;
    }

    function formatarHorario(data) {
        return data.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    // --- FINALIZAÇÃO E ENVIO DE DADOS ---
    function verificarBotaoFinalizar() {
        const salaSelec = salaSelect.value !== '';
        const leitoSelec = leitoSelect.value !== '';
        const etapasCompletas = currentStep === stepNames.length;
        
        checkoutBtn.disabled = !(salaSelec && leitoSelec && etapasCompletas);
    }

    async function finalizarAtendimento() {
        if (!pacienteAtual || !salaSelect.value || !leitoSelect.value) {
            alert("Por favor, complete todas as informações.");
            return;
        }

        console.log('💾 Salvando dados...');
        
        // Desabilita botão e mostra loading
        checkoutBtn.disabled = true;
        checkoutBtn.innerHTML = '<div class="loading"></div> Salvando...';

        // Prepara dados para envio
        const dadosFinais = {
            patientId: pacienteAtual,
            sala: salaSelect.value,
            destino: leitoSelect.value,
            stepTimes: stepTimes,
            totalSteps: currentStep,
            timestamp: new Date().toISOString()
        };

        console.log('📤 Enviando dados:', dadosFinais);

        try {
            const response = await fetch(URL_BACKEND, {
                method: 'POST',
                mode: 'no-cors', // Necessário para Google Apps Script
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dadosFinais)
            });

            // Como usamos 'no-cors', assumimos sucesso se não houver erro
            console.log('✅ Dados enviados com sucesso!');
            
            checkoutBtn.innerHTML = '✅ Salvo com Sucesso!';
            checkoutBtn.classList.remove('primary');
            checkoutBtn.classList.add('success');
            
            // Mostra mensagem de sucesso
            alert(`✅ Dados do paciente ${pacienteAtual} salvos com sucesso!`);
            
            // Reset automático após 3 segundos
            setTimeout(() => {
                resetarAplicativo();
            }, 3000);

        } catch (error) {
            console.error('❌ Erro ao enviar dados:', error);
            
            checkoutBtn.innerHTML = '❌ Erro ao Salvar';
            checkoutBtn.disabled = false;
            
            alert('❌ Erro ao salvar dados. Tente novamente.');
        }
    }

    // --- RESET DA APLICAÇÃO ---
    function resetarAplicativo() {
        console.log('🔄 Resetando aplicativo...');
        
        // Reset do estado
        pacienteAtual = null;
        currentStep = 0;
        stepTimes = {};
        
        // Reset da interface
        patientInfo.style.display = 'none';
        timelineSection.style.display = 'none';
        statsSection.style.display = 'none';
        finalSection.style.display = 'none';
        
        // Reset do scanner
        startScanBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 7V5C3 3.89543 3.89543 3 5 3H7M17 3H19C20.1046 3 21 3.89543 21 5V7M21 17V19C21 20.1046 20.1046 21 19 21H17M7 21H5C3.89543 21 3 20.1046 3 19V17M12 8V16M8 12H16" />
            </svg>
            Escanear Pulseira do Paciente
        `;
        startScanBtn.disabled = false;
        
        // Reset dos botões
        nextStepBtn.disabled = true;
        nextStepBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13L9 17L19 7" />
            </svg>
            Próxima Etapa
        `;
        
        checkoutBtn.disabled = true;
        checkoutBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20 6L9 17L4 12" />
            </svg>
            Salvar no Google Sheets
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
        
        // Reset das estatísticas
        ['total-time', 'procedure-time', 'setup-time', 'cleaning-time'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = '--';
            }
        });
        
        console.log('✅ Reset concluído!');
    }

    // --- REGISTRO DO SERVICE WORKER (PWA) ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('SW registrado:', registration);
                })
                .catch(error => {
                    console.log('SW falhou:', error);
                });
        });
    }

    // --- INICIALIZAÇÃO DA APLICAÇÃO ---
    init();
});

// --- FUNÇÕES UTILITÁRIAS ---

// Função para debug (pode ser removida em produção)
function debugInfo() {
    console.log('🔍 Debug Info:', {
        pacienteAtual: window.pacienteAtual,
        currentStep: window.currentStep,
        stepTimes: window.stepTimes
    });
}

// Disponibiliza função de debug globalmente
window.debugInfo = debugInfo;