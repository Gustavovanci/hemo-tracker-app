// HemoFlow Coletor v7.3 — funcional (Apps Script + no-cors)
document.addEventListener('DOMContentLoaded', () => {
  // TROQUE pela URL do deployment ATUAL (Deploy → Manage deployments → Web app)
  const URL_BACKEND = "https://script.google.com/macros/s/AKfycbwKIc_jEH58HYqoEbLzBruaQ4OSlI2FiHuQpgOM7A8nEs9TV6HzeQYQbS-9IPx30YZv/exec";
  const SESSION_STORAGE_KEY = 'hemoflow_current_session';

  const STANDARD_TIMELINE_STEPS = [
    'Chegada na Hemodinâmica','Entrada na Sala','Início da Cobertura','Término da Cobertura',
    'Início do Procedimento','Término do Procedimento','Saída da Sala','Início da Limpeza','Término da Limpeza'
  ];
  const SALA_3_PRE = { after: 'Término da Cobertura', steps: ['Início da Punção Anestesista','Início da Anestesia'] };
  const SALA_3_POST = { after: 'Término do Procedimento', steps: ['Acordar da Anestesia'] };

  const main = document.querySelector('main.app-container');
  let html5QrCode = null;

  let appState = {
    currentStepId: null,
    patientId: null,
    selectedSala: null,
    timelineSteps: [],
    stepTimes: {},
    destino: '',
    observacoes: ''
  };

  function init(){
    if(!restore()){
      appState.timelineSteps = [...STANDARD_TIMELINE_STEPS];
      buildTimeline(appState.timelineSteps);
      show('welcome');
    }
    bind();
  }

  // -------- Navegação --------
  function show(step){
    document.querySelectorAll('.step-container').forEach(el => el.style.display = 'none');
    const el = document.getElementById(`step-${step}`);
    if (el) {
      el.style.display = 'flex';
      appState.currentStepId = step;
      save();
    }
    if (step === 'scanner') startScanner(); else stopScanner();
  }

  function nextStep(){
    const idx = parseInt(String(appState.currentStepId).replace('timeline-',''), 10);
    if (!isNaN(idx) && idx < appState.timelineSteps.length) show(`timeline-${idx+1}`);
    else show('final');
  }

  // -------- Scanner --------
  function startScanner(){
    const help = document.getElementById('camera-help');
    help && (help.style.display = 'none');

    if (typeof Html5Qrcode === 'undefined') {
      alert('Erro ao carregar o leitor. Atualize a página.');
      return;
    }
    if (html5QrCode && html5QrCode.isScanning) return;

    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true, supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA] },
      (text) => { stopScanner(); if (navigator.vibrate) navigator.vibrate(150); processId(text); },
      () => {}
    ).catch(err => {
      console.error("Não foi possível iniciar o scanner", err);
      const help = document.getElementById('camera-help');
      help && (help.style.display = 'block'); // mostra dica p/ permitir câmera e tentar de novo
      alert('Permita o uso da câmera no navegador e clique em "Tentar novamente".');
    });
  }
  function stopScanner(){ if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().catch(()=>{}); }

  // -------- Estado / UI --------
  function processId(id){
    appState.patientId = String(id || '').trim().toUpperCase();
    document.getElementById('patient-id-display').textContent = appState.patientId || '--';
    save();
    show('room-selection');
  }

  function buildTimeline(stepNames){
    main.querySelectorAll('section[id^="step-timeline-"]').forEach(el => el.remove());
    stepNames.forEach((name, i) => {
      const idx = i+1;
      const html = `
        <section id="step-timeline-${idx}" class="step-container" style="display:none;">
          <div class="step-card">
            <div class="step-header">
              <div class="step-number">${idx}</div>
              <h2 class="step-title">${name}</h2>
              <p class="step-subtitle">Toque para registrar o horário exato.</p>
            </div>
            <div id="time-display-${idx}" class="time-display">Aguardando...</div>
            <button data-step-name="${name}" data-step-index="${idx}" class="btn-revolutionary btn-primary mark-step-btn">Registrar Tempo</button>
          </div>
        </section>`;
      main.insertAdjacentHTML('beforeend', html);
    });
  }

  function buildDynamicTimeline(sala){
    let names = [...STANDARD_TIMELINE_STEPS];
    if (sala === 'Sala 3') {
      let i = names.indexOf(SALA_3_PRE.after) + 1;
      names.splice(i, 0, ...SALA_3_PRE.steps);
      i = names.indexOf(SALA_3_POST.after) + 1;
      names.splice(i, 0, ...SALA_3_POST.steps);
    }
    appState.timelineSteps = names;
    buildTimeline(names);
    save();
  }

  function markStep(idx, name, btn){
    const now = new Date();
    appState.stepTimes[name] = now.toISOString();
    btn.disabled = true;
    btn.classList.replace('btn-primary','btn-success');
    btn.innerHTML = '✅ Marcado';
    const out = document.getElementById(`time-display-${idx}`);
    if (out) out.innerHTML = `Registrado: <span class="font-bold">${now.toLocaleTimeString('pt-BR')}</span>`;
    save();
    setTimeout(nextStep, 400);
  }

  function onFinalChanged(){
    const saveBtn = document.getElementById('save-btn');
    appState.destino = document.getElementById('destino-select')?.value || '';
    appState.observacoes = document.getElementById('observations')?.value?.trim() || '';
    save();
    if (saveBtn) saveBtn.disabled = !appState.destino;
  }

  // -------- Persistência local --------
  function save(){ localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(appState)); }
  function restore(){
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return false;
    appState = JSON.parse(raw);
    document.getElementById('patient-id-display').textContent = appState.patientId || '--';
    buildTimeline(appState.timelineSteps?.length ? appState.timelineSteps : STANDARD_TIMELINE_STEPS);

    (appState.timelineSteps||[]).forEach((name, i) => {
      if (appState.stepTimes[name]) {
        const idx = i+1, btn = document.querySelector(`button[data-step-index='${idx}']`);
        const out = document.getElementById(`time-display-${idx}`);
        const t = new Date(appState.stepTimes[name]);
        if (btn){ btn.disabled = true; btn.classList.replace('btn-primary','btn-success'); btn.innerHTML = '✅ Marcado'; }
        if (out){ out.innerHTML = `Registrado: <span class="font-bold">${t.toLocaleTimeString('pt-BR')}</span>`; }
      }
    });

    show(appState.currentStepId || 'welcome');
    return true;
  }

  function reset(){ localStorage.removeItem(SESSION_STORAGE_KEY); window.location.reload(); }

  // -------- Envio --------
  async function saveToGoogleSheets(){
    document.getElementById('loading-overlay').style.display = 'flex';

    const payload = {
      patientId: appState.patientId,
      sala: appState.selectedSala, // nome da aba
      destino: appState.destino || document.getElementById('destino-select')?.value || '',
      observacoes: appState.observacoes || document.getElementById('observations')?.value?.trim() || '',
      stepTimes: appState.stepTimes,
      source: 'App',
      timelineSteps: appState.timelineSteps
    };

    try {
      // *** Apps Script não atende preflight CORS: use no-cors e NÃO envie headers ***
      await fetch(URL_BACKEND, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(payload)
      });

      show('success');
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
      console.error('Falha ao enviar os dados:', e);
      alert('Falha ao enviar. Confira a internet e tente novamente.');
    } finally {
      document.getElementById('loading-overlay').style.display = 'none';
    }
  }

  // -------- Eventos --------
  function bind(){
    const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };

    on('start-btn','click', () => show('scanner'));
    on('retry-camera-btn','click', () => startScanner());

    on('manual-submit-btn','click', () => {
      const v = document.getElementById('patient-id-input')?.value || '';
      if (v.trim()) processId(v);
    });
    on('patient-id-input','keypress', (e) => { if (e.key === 'Enter') { const v = e.target.value || ''; if (v.trim()) processId(v); }});
    on('save-btn','click', saveToGoogleSheets);
    on('new-patient-btn','click', reset);
    on('destino-select','change', onFinalChanged);
    const obs = document.getElementById('observations'); if (obs) obs.addEventListener('input', onFinalChanged);

    const roomSel = document.querySelector('#step-room-selection');
    if (roomSel) {
      roomSel.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-room')) {
          appState.selectedSala = e.target.dataset.sala;
          buildDynamicTimeline(appState.selectedSala);
          show('timeline-1');
        }
      });
    }

    main.addEventListener('click', (e) => {
      if (e.target.classList.contains('mark-step-btn')) {
        const idx = parseInt(e.target.dataset.stepIndex, 10);
        const name = e.target.dataset.stepName;
        markStep(idx, name, e.target);
      }
    });
  }

  init();
});
