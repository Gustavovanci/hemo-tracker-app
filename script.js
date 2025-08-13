document.addEventListener('DOMContentLoaded', () => {

    // --- SELETORES DE ELEMENTOS DO DOM ---
    const startScanBtn = document.getElementById('start-scan-btn');
    const readerDiv = document.getElementById('reader');
    const patientIdSpan = document.getElementById('patient-id');
    const cronometroDisplay = document.getElementById('cronometro-display');
    const startStopBtn = document.getElementById('start-stop-btn');
    const resetBtn = document.getElementById('reset-btn');
    const salaSelect = document.getElementById('sala-select');
    const leitoSelect = document.getElementById('leito-select');
    const checkoutBtn = document.getElementById('checkout-btn');

    // --- ESTADO DO APLICATIVO ---
    let html5QrCode;
    let cronometroInterval;
    let tempoEmSegundos = 0;
    let cronometroAtivo = false;
    let pacienteAtual = null;
    
    // --- CONFIGURAÇÕES ---
    const SALAS = ["Sala 1", "Sala 2", "Sala 3", "Sala 4", "Sala 5"];
    const LEITOS = ["Recuperação 1", "Recuperação 2", "UTI", "Apartamento", "Enfermaria", "Alta"];

    // --- INICIALIZAÇÃO ---
    function popularDropdowns() {
        SALAS.forEach(sala => {
            const option = document.createElement('option');
            option.value = sala;
            option.textContent = sala;
            salaSelect.appendChild(option);
        });
        LEITOS.forEach(leito => {
            const option = document.createElement('option');
            option.value = leito;
            option.textContent = leito;
            leitoSelect.appendChild(option);
        });
    }

    popularDropdowns();

    // --- LÓGICA DO SCANNER ---
    function onScanSuccess(decodedText, decodedResult) {
        pacienteAtual = decodedText;
        patientIdSpan.textContent = pacienteAtual;
        patientIdSpan.classList.add('active');
        
        // Para o scanner após sucesso
        pararScanner();
        checkoutBtn.disabled = false;
        startScanBtn.textContent = 'Ler Novo Paciente';
    }

    function pararScanner() {
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop()
                .then(() => {
                    console.log("Scanner parado com sucesso.");
                    readerDiv.style.display = 'none';
                })
                .catch(err => console.error("Falha ao parar o scanner.", err));
        }
    }

    startScanBtn.addEventListener('click', () => {
        readerDiv.style.display = 'block';
        html5QrCode = new Html5Qrcode("reader");
        
        const config = { fps: 10, qrbox: { width: 250, height: 150 } };
        
        html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
            .catch(err => {
                alert("Erro ao iniciar a câmera. Por favor, conceda a permissão e atualize a página.");
                console.error("Erro ao iniciar o scanner:", err);
            });
    });

    // --- LÓGICA DO CRONÔMETRO ---
    function formatarTempo(segundos) {
        const h = Math.floor(segundos / 3600).toString().padStart(2, '0');
        const m = Math.floor((segundos % 3600) / 60).toString().padStart(2, '0');
        const s = (segundos % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    startStopBtn.addEventListener('click', () => {
        if (cronometroAtivo) {
            // Pausar
            clearInterval(cronometroInterval);
            startStopBtn.innerHTML = '<svg.../> Iniciar'; // Ícone de Play
            startStopBtn.classList.replace('btn-danger', 'btn-success');
        } else {
            // Iniciar
            startStopBtn.innerHTML = '<svg.../> Pausar'; // Ícone de Pause
            startStopBtn.classList.replace('btn-success', 'btn-danger');
            cronometroInterval = setInterval(() => {
                tempoEmSegundos++;
                cronometroDisplay.textContent = formatarTempo(tempoEmSegundos);
            }, 1000);
        }
        cronometroAtivo = !cronometroAtivo;
    });

    resetBtn.addEventListener('click', () => {
        clearInterval(cronometroInterval);
        cronometroAtivo = false;
        tempoEmSegundos = 0;
        cronometroDisplay.textContent = '00:00:00';
        startStopBtn.innerHTML = '<svg.../> Iniciar'; // Ícone de Play
        startStopBtn.classList.replace('btn-danger', 'btn-success');
    });

    // --- LÓGICA DO CHECKOUT ---
    checkoutBtn.addEventListener('click', () => {
        if (!pacienteAtual || !salaSelect.value || !leitoSelect.value) {
            alert("Por favor, leia um código de barras e selecione a sala e o leito.");
            return;
        }

        const dadosFinais = {
            pacienteId: pacienteAtual,
            tempoProcedimento: cronometroDisplay.textContent,
            sala: salaSelect.value,
            leitoDestino: leitoSelect.value,
            timestampSaida: new Date().toISOString()
        };

        // **AQUI É ONDE VOCÊ ENVIARIA OS DADOS PARA UMA API OU GOOGLE APPS SCRIPT**
        // Exemplo:
        // fetch('URL_DO_SEU_APPS_SCRIPT', {
        //     method: 'POST',
        //     body: JSON.stringify(dadosFinais),
        //     headers: { 'Content-Type': 'application/json' }
        // }).then(...);

        console.log("DADOS FINAIS REGISTRADOS:", dadosFinais);
        alert(`Saída do paciente ${pacienteAtual} registrada com sucesso!`);

        // Reseta a interface para o próximo paciente
        resetarInterface();
    });

    function resetarInterface() {
        resetBtn.click(); // Reseta o cronômetro
        pacienteAtual = null;
        patientIdSpan.textContent = 'Nenhum';
        patientIdSpan.classList.remove('active');
        salaSelect.value = '';
        leitoSelect.value = '';
        checkoutBtn.disabled = true;
        startScanBtn.textContent = 'Ler Código de Barras do Paciente';
    }
    
    // --- REGISTRO DO SERVICE WORKER (PWA) ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('Service worker registrado:', reg))
                .catch(err => console.error('Erro no registro do service worker:', err));
        });
    }
});