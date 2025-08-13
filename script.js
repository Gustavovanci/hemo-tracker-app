/*
  ARQUIVO: script.js
  -------------------
  Versão Final e Completa
  Esta é a lógica principal do seu aplicativo. Controla o scanner, o cronómetro,
  a interação do utilizador e o registo dos dados na sua planilha Google.
*/

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
    // !!! IMPORTANTE: COLE A URL DO SEU GOOGLE APPS SCRIPT AQUI !!!
    const URL_BACKEND = "https://script.google.com/macros/s/AKfycby14YB3un5ChITcRU6OED1ccnuCAUoZwpyjbJneQIeUm5BoiNJM4X5WODuGq_eNeP5v3w/exec";

    const SALAS = ["", "Sala 1", "Sala 2", "Sala 3", "Sala 4", "Sala 5"];
    const LEITOS = ["", "Recuperação 1", "Recuperação 2", "UTI", "Apartamento", "Enfermaria", "Alta"];

    // --- INICIALIZAÇÃO ---
    function popularDropdowns() {
        SALAS.forEach(sala => {
            const option = document.createElement('option');
            option.value = sala;
            option.textContent = sala || "Selecione...";
            salaSelect.appendChild(option);
        });
        LEITOS.forEach(leito => {
            const option = document.createElement('option');
            option.value = leito;
            option.textContent = leito || "Selecione...";
            leitoSelect.appendChild(option);
        });
    }

    popularDropdowns();

    // --- LÓGICA DO SCANNER ---
    function onScanSuccess(decodedText, decodedResult) {
        pacienteAtual = decodedText;
        patientIdSpan.textContent = pacienteAtual;
        patientIdSpan.classList.add('active');
        pararScanner();
        checkoutBtn.disabled = false;
        startScanBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h5M20 20v-5h-5" /><path stroke-linecap="round" stroke-linejoin="round" d="M4 9a9 9 0 0114.53-2.828A8.973 8.973 0 0120 12m-4.53 2.828A9 9 0 015.47 14.828 8.973 8.973 0 014 12" /></svg> Ler Novo Paciente';
    }

    function pararScanner() {
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop().catch(err => console.error("Falha ao parar o scanner.", err));
            readerDiv.style.display = 'none';
        }
    }

    startScanBtn.addEventListener('click', () => {
        readerDiv.style.display = 'block';
        html5QrCode = new Html5QrCode("reader");
        const config = { fps: 10, qrbox: { width: 250, height: 150 } };
        html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
            .catch(err => alert("Erro ao iniciar a câmera. Por favor, conceda a permissão."));
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
            clearInterval(cronometroInterval);
            startStopBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg> Retomar';
            startStopBtn.classList.replace('btn-danger', 'btn-success');
        } else {
            startStopBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Pausar';
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
        startStopBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg> Iniciar';
        startStopBtn.classList.replace('btn-danger', 'btn-success');
    });

    // --- LÓGICA DO CHECKOUT (COM ENVIO DE DADOS) ---
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

        checkoutBtn.textContent = "A registar...";
        checkoutBtn.disabled = true;

        fetch(URL_BACKEND, {
            method: 'POST',
            mode: 'no-cors', // 'no-cors' é a forma mais simples de evitar erros de CORS com o Google Apps Script
            body: JSON.stringify(dadosFinais),
            headers: { 'Content-Type': 'application/json' }
        })
        .then(() => {
            // Como o 'no-cors' não nos deixa ler a resposta, assumimos sucesso
            alert(`Saída do paciente ${pacienteAtual} registada com sucesso! Verifique a planilha.`);
            resetarInterface();
        })
        .catch(error => {
            console.error("Erro ao enviar dados:", error);
            alert("Ocorreu um erro ao registar os dados. Tente novamente.");
        })
        .finally(() => {
            // Restaura o botão para o estado inicial
            checkoutBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Finalizar Atendimento';
            // O botão só será reativado quando um novo paciente for lido
        });
    });

    function resetarInterface() {
        resetBtn.click();
        pacienteAtual = null;
        patientIdSpan.textContent = 'Nenhum';
        patientIdSpan.classList.remove('active');
        salaSelect.value = '';
        leitoSelect.value = '';
        checkoutBtn.disabled = true;
        startScanBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg> Ler Código de Barras do Paciente';
    }
    
    // --- REGISTRO DO SERVICE WORKER (PWA) ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js');
        });
    }
});
