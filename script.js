/* ARQUIVO: script.js
  -------------------
  Versão atualizada com a lógica para enviar os dados para o Google Sheets
  através do Google Apps Script.
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
        startScanBtn.innerHTML = '<svg.../> Ler Novo Paciente';
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
            startStopBtn.innerHTML = '<svg.../> Retomar';
            startStopBtn.classList.replace('btn-danger', 'btn-success');
        } else {
            startStopBtn.innerHTML = '<svg.../> Pausar';
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
        startStopBtn.innerHTML = '<svg.../> Iniciar';
        startStopBtn.classList.replace('btn-danger', 'btn-success');
    });

    // --- LÓGICA DO CHECKOUT (COM ENVIO DE DADOS) ---
    checkoutBtn.addEventListener('click', async () => {
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

        // Mostra um feedback visual de que está a enviar
        checkoutBtn.textContent = "A registar...";
        checkoutBtn.disabled = true;

        try {
            const response = await fetch(URL_BACKEND, {
                method: 'POST',
                mode: 'no-cors', // Importante para Apps Script
                cache: 'no-cache',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosFinais),
                redirect: 'follow'
            });
            
            // Como o modo 'no-cors' não permite ler a resposta,
            // assumimos sucesso e damos feedback ao utilizador.
            alert(`Saída do paciente ${pacienteAtual} registada com sucesso!`);
            resetarInterface();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            alert("Ocorreu um erro ao registar os dados. Tente novamente.");
        } finally {
            // Restaura o botão
            checkoutBtn.innerHTML = '<svg.../> Finalizar Atendimento';
            checkoutBtn.disabled = false;
        }
    });

    function resetarInterface() {
        resetBtn.click();
        pacienteAtual = null;
        patientIdSpan.textContent = 'Nenhum';
        patientIdSpan.classList.remove('active');
        salaSelect.value = '';
        leitoSelect.value = '';
        checkoutBtn.disabled = true;
        startScanBtn.innerHTML = '<svg.../> Ler Código de Barras do Paciente';
    }
    
    // --- REGISTRO DO SERVICE WORKER (PWA) ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js');
        });
    }
});
