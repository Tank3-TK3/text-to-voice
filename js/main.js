/**
 * main.js — Punto de entrada
 *
 * Une VoiceManager, ReadView y Player.
 * Gestiona UI, eventos y shortcuts de teclado.
 * Sin peticiones de red de ningún tipo.
 *
 * Shortcuts:
 *   Space  → play / pause / reanudar (fuera del textarea)
 *   Escape → detener
 */

import { VoiceManager } from './voices.js';
import { ReadView }     from './reader.js';
import { Player }       from './player.js';

// ── Verificar soporte del navegador ───────────────────────────
if (!('speechSynthesis' in window)) {
  document.body.innerHTML = `
    <div class="card" style="align-self:center">
      <p class="status status--error" style="font-size:1rem;text-align:center">
        Tu navegador no soporta Web Speech API.<br>
        Usa Chrome 33+, Edge 14+ o Safari 7+.
      </p>
    </div>`;
  throw new Error('Web Speech API no disponible');
}

// ── Referencias al DOM ────────────────────────────────────────
const textEl    = document.getElementById('text');
const readEl    = document.getElementById('read-view');
const voiceSel  = document.getElementById('voice-select');
const speedEl   = document.getElementById('speed');
const speedVal  = document.getElementById('speed-value');
const btnPlay   = document.getElementById('btn-play');
const btnReset  = document.getElementById('btn-reset');
const btnPause  = document.getElementById('btn-pause');
const btnStop   = document.getElementById('btn-stop');
const btnClear  = document.getElementById('btn-clear');
const statusEl  = document.getElementById('status');
const counterEl = document.getElementById('text-counter');
const progressEl = document.getElementById('progress-bar');
const fileInput  = document.getElementById('file-input');
const textWrap   = document.getElementById('text-wrap');

// ── Módulos ───────────────────────────────────────────────────
const reader = new ReadView(readEl);
const player = new Player();
const voices = new VoiceManager(onVoicesLoaded);

// ── Voces ─────────────────────────────────────────────────────

function onVoicesLoaded(allVoices) {
  const pool = voices.getSpanishVoices();
  voiceSel.innerHTML = '';

  pool.forEach(v => {
    const idx      = allVoices.indexOf(v);
    const locality = voices.locality(v);
    const icon = { local: '🔒', cloud: '☁', unknown: '🔒' }[locality];
    voiceSel.appendChild(new Option(`${icon} ${v.name} (${v.lang})`, idx));
  });

  const bestIdx = voices.bestFemaleIndex(pool);
  if (bestIdx >= 0) voiceSel.value = bestIdx;

  const hasSpanish = allVoices.some(v => v.lang.startsWith('es'));
  setStatus(hasSpanish ? 'Listo' : 'Sin voces en español — selecciona otra voz manualmente.');
}

function getSelectedVoice() {
  return voices.get(parseInt(voiceSel.value));
}

function getRate() {
  return parseFloat(speedEl.value);
}

// ── Callbacks del Player ──────────────────────────────────────

player.onStateChange = (event) => {
  updateUI(event);

  const STATUS = {
    playing:  ['Reproduciendo…', 'speaking'],
    paused:   ['Pausado',        'paused'],
    stopped:  [buildStopMsg(),   ''],
    finished: ['Listo',          ''],
    idle:     ['Listo',          ''],
  };
  const [msg, cls] = STATUS[event] ?? ['', ''];
  if (msg) setStatus(msg, cls);

  if (event === 'finished') {
    reader.clearHighlight();
    setProgress(0);
  }
};

player.onBoundary = (charIndex) => {
  reader.highlight(charIndex);
  setProgress(player.text.length ? charIndex / player.text.length : 0);
};

player.onError = (err) => setStatus(`Error de síntesis: ${err}`, 'error');

// ── UI ────────────────────────────────────────────────────────

function updateUI(event) {
  const playing  = event === 'playing';
  const paused   = event === 'paused';
  const active   = playing || paused;
  const hasSaved = !active && player.offset > 0;

  btnPlay.style.display  = active ? 'none' : '';
  btnPlay.textContent    = hasSaved ? '▶ Continuar' : '▶ Reproducir';
  btnReset.style.display = hasSaved ? '' : 'none';
  btnPause.style.display = active ? '' : 'none';
  btnPause.textContent   = paused ? '▶ Reanudar' : '⏸ Pausar';
  btnStop.disabled       = !active;
  btnClear.disabled      = playing || !textEl.value.trim();

  if (active) {
    reader.show();
    textEl.style.display  = 'none';
    counterEl.style.display = 'none';
  } else {
    reader.hide();
    textEl.style.display  = '';
    counterEl.style.display = '';
    // Si hay posición guardada, reaplicar resaltado al volver a la vista de lectura
    if (hasSaved) reader.reapply();
  }
}

function setStatus(msg, cls = '') {
  statusEl.textContent = msg;
  statusEl.className   = cls ? `status status--${cls}` : 'status';
}

function setProgress(ratio) {
  progressEl.style.width = `${Math.min(ratio * 100, 100).toFixed(1)}%`;
}

function buildStopMsg() {
  if (!player.text.length || player.offset === 0) return 'Detenido';
  const pct = Math.round((player.offset / player.text.length) * 100);
  return `Detenido — posición guardada (${pct}%)`;
}

// ── Contador de palabras / caracteres ─────────────────────────

function updateCounter() {
  const text  = textEl.value;
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  counterEl.textContent = `${words} palabras · ${chars} caracteres`;
}

// ── Velocidad ─────────────────────────────────────────────────

speedEl.addEventListener('input', () => {
  const v     = parseFloat(speedEl.value);
  const label = Number.isInteger(v) ? `${v}.0×` : `${v}×`;
  speedVal.textContent = label;
  speedEl.setAttribute('aria-valuetext', label);
  player.changeSpeed(getRate(), getSelectedVoice());
});

// ── Botón ▶ Reproducir / Continuar ───────────────────────────

btnPlay.addEventListener('click', () => {
  const text = textEl.value.trim();
  if (!text) {
    setStatus('Escribe o pega texto primero.', 'error');
    return;
  }

  const textChanged = text !== player.text;
  if (textChanged) player.resetPosition();

  if (textChanged || player.offset === 0) {
    reader.build(text);
  }

  player.start(text, player.offset, getRate(), getSelectedVoice());
});

// ── Botón ↺ Ir al inicio ──────────────────────────────────────

btnReset.addEventListener('click', () => {
  player.resetPosition();
  reader.clearHighlight();
  setProgress(0);
  updateUI('idle');
  setStatus('Listo');
});

// ── Botón ⏸ Pausar / ▶ Reanudar ──────────────────────────────

btnPause.addEventListener('click', () => {
  if (player.state === 'playing') {
    player.pause();
  } else if (player.state === 'paused') {
    player.resume(getRate(), getSelectedVoice());
  }
});

// ── Botón ■ Detener ───────────────────────────────────────────

btnStop.addEventListener('click', () => {
  player.stop();
  // updateUI se dispara desde onStateChange → 'stopped'
});

// ── Botón ✕ Limpiar ───────────────────────────────────────────

btnClear.addEventListener('click', () => {
  player.stop();
  player.resetPosition();
  textEl.value = '';
  reader.clearHighlight();
  setProgress(0);
  updateCounter();
  updateUI('idle');
  setStatus('Listo');
  textEl.focus();
});

// ── Invalidar posición al editar texto ────────────────────────

textEl.addEventListener('input', () => {
  updateCounter();
  btnClear.disabled = !textEl.value.trim();
  if (textEl.value.trim() !== player.text) {
    setProgress(0);
    updateUI('idle');
  }
});

// ── Atajos de teclado ────────────────────────────────────────
// Space → play/pause, Escape → detener
// Solo activos cuando el foco NO está en el textarea

document.addEventListener('keydown', (e) => {
  if (document.activeElement === textEl) return;

  if (e.code === 'Space') {
    e.preventDefault();
    if (player.state === 'playing' || player.state === 'paused') {
      btnPause.click();
    } else {
      btnPlay.click();
    }
    return;
  }

  if (e.code === 'Escape' && player.state !== 'idle') {
    btnStop.click();
  }
});

// ── Carga de archivo .txt ─────────────────────────────────────

function loadTextFile(file) {
  if (!file || !file.type.startsWith('text/') && !file.name.endsWith('.txt')) {
    setStatus('Solo se admiten archivos .txt', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    textEl.value = e.target.result;
    updateCounter();
    setStatus(`Archivo cargado: ${file.name}`);
    player.resetPosition();
    setProgress(0);
    updateUI('idle');
  };
  reader.onerror = () => setStatus('Error al leer el archivo', 'error');
  reader.readAsText(file, 'UTF-8');
}

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) loadTextFile(fileInput.files[0]);
  fileInput.value = '';
});

// Drag & drop sobre el área de texto
textWrap.addEventListener('dragover', (e) => {
  e.preventDefault();
  textWrap.classList.add('drag-over');
});

textWrap.addEventListener('dragleave', () => textWrap.classList.remove('drag-over'));

textWrap.addEventListener('drop', (e) => {
  e.preventDefault();
  textWrap.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) loadTextFile(file);
});

// ── Inicialización ────────────────────────────────────────────
updateCounter();
