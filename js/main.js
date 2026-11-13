/**
 * main.js — Punto de entrada
 *
 * Une Player, ReadView, VoiceManager y la memoria local con la interfaz.
 * Sin peticiones de red de ningún tipo.
 *
 * La hoja tiene dos modos:
 *   'edit' → se ve el área de texto.
 *   'read' → se ve la vista de lectura (leyendo o en pausa).
 *
 * Atajos (fuera de los campos de texto):
 *   Espacio → reproducir / pausar      ← → → oración anterior / siguiente
 *   Esc     → detener y volver a editar
 */

import { VoiceManager } from './voices.js';
import { ReadView }     from './reader.js';
import { Player }       from './player.js';
import { loadSession, saveSession, loadTheme, saveTheme } from './store.js';

const $ = (id) => document.getElementById(id);

// ── Soporte del navegador ─────────────────────────────────────
if (!('speechSynthesis' in window)) {
  document.querySelector('.app').innerHTML =
    '<p class="unsupported">Este navegador no puede leer texto en voz alta. ' +
    'Ábrelo en una versión reciente de Chrome, Edge, Safari o Firefox.</p>';
  throw new Error('Web Speech API no disponible');
}

// ── DOM ───────────────────────────────────────────────────────
const page      = $('page');
const textEl    = $('text');
const readEl    = $('read-view');
const editTools = $('edit-tools');
const statusEl  = $('status');
const counterEl = $('text-counter');
const fileInput = $('file-input');
const btnOpen   = $('btn-open');
const btnClear  = $('btn-clear');

const seekEl    = $('seek');
const posLabel  = $('pos-label');
const timeLeft  = $('time-left');
const btnReset  = $('btn-reset');
const btnPrev   = $('btn-prev');
const btnPlay   = $('btn-play');
const btnNext   = $('btn-next');
const btnStop   = $('btn-stop');
const playIcon  = $('play-icon');

const voiceSel  = $('voice-select');
const voiceNote = $('voice-note');
const speedEl   = $('speed');
const speedVal  = $('speed-value');

const btnTheme  = $('btn-theme');
const themeIcon = $('theme-icon');
const localNote = document.querySelector('.local-note');

// ── Estado ────────────────────────────────────────────────────
const SEEK_STEPS = Number(seekEl.max);
const BASE_CPS   = 14.5;   // caracteres por segundo a 1× (estimación inicial)
const number     = new Intl.NumberFormat('es-MX');

const session = loadSession();

/** @type {'edit'|'read'} */
let mode        = 'edit';
let voiceChoice = session.voice ?? null; // voz elegida a mano; null = automática
let scrubbing   = false;
let saveTimer   = null;
let wakeLock    = null;

// Ritmo real de lectura, medido mientras suena (afina el tiempo restante).
let paceStart   = null;   // { t, offset }
let paceLast    = 0;
let measuredCps = null;

const reader = new ReadView(readEl);
const player = new Player();

// ── Utilidades ────────────────────────────────────────────────

const rate = () => parseFloat(speedEl.value);

/** ¿El texto del área es el mismo que tiene cargado el reproductor? */
const isSynced = () => player.text !== '' && player.text === textEl.value;

const percent = (offset) =>
  player.text.length ? Math.round((offset / player.text.length) * 100) : 0;

function setStatus(message, kind = '') {
  statusEl.textContent  = message;
  statusEl.dataset.kind = kind;
}

function setFill(slider) {
  const min = Number(slider.min), max = Number(slider.max);
  slider.style.setProperty('--fill', `${((slider.value - min) / (max - min)) * 100}%`);
}

/** "unos 12 min", "menos de 1 min", "1 h 5 min" */
function approxDuration(chars) {
  const seconds = chars / (measuredCps ?? BASE_CPS * rate());
  if (seconds < 45) return 'menos de 1 min';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `unos ${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function trackPace(offset) {
  const now = performance.now();
  if (!paceStart || offset < paceLast || offset - paceLast > 250) {
    paceStart = { t: now, offset };          // arranque o salto: vuelve a medir
  } else if (now - paceStart.t > 4000) {
    measuredCps = (offset - paceStart.offset) / ((now - paceStart.t) / 1000);
  }
  paceLast = offset;
}

// ── Pintado ───────────────────────────────────────────────────

function showPosition(offset) {
  const length = player.text.length;
  if (!scrubbing) {
    seekEl.value = length ? Math.round((offset / length) * SEEK_STEPS) : 0;
    setFill(seekEl);
  }
  posLabel.textContent = `${percent(offset)} %`;

  // Tiempo: el total antes de empezar; lo que queda una vez en marcha.
  const remaining = (isSynced() ? length : textEl.value.length) - offset;
  if (!textEl.value.trim() || remaining <= 0) {
    timeLeft.textContent = '';
  } else if (offset > 0) {
    timeLeft.textContent = `quedan ${approxDuration(remaining)}`.replace('quedan menos', 'queda menos');
  } else {
    timeLeft.textContent = approxDuration(remaining);
  }
}

function render() {
  const playing = player.state === 'playing';
  const synced  = isSynced();
  const offset  = synced ? player.offset : 0;

  page.dataset.mode = mode;
  editTools.hidden  = mode === 'read';

  const playLabel = playing ? 'Pausar' : offset > 0 ? 'Continuar' : 'Reproducir';
  playIcon.setAttribute('href', playing ? '#i-pause' : '#i-play');
  btnPlay.setAttribute('aria-label', playLabel);
  btnPlay.title = `${playLabel} (Espacio)`;

  btnStop.disabled  = mode !== 'read';
  btnReset.disabled = !synced || offset === 0;
  btnPrev.disabled  = btnNext.disabled = seekEl.disabled = !synced;
  btnClear.disabled = !textEl.value;

  showPosition(offset);
}

function updateCounter() {
  const text  = textEl.value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  counterEl.textContent = `${number.format(words)} ${words === 1 ? 'palabra' : 'palabras'}`;
}

function syncSpeedLabel() {
  const label = `${rate()}×`;
  speedVal.textContent = label;
  speedEl.setAttribute('aria-valuetext', label);
  setFill(speedEl);
}

// ── Memoria ───────────────────────────────────────────────────

function persist() {
  clearTimeout(saveTimer);
  saveTimer = null;
  saveSession({
    text:   textEl.value,
    offset: isSynced() ? player.offset : 0,
    rate:   rate(),
    voice:  voiceChoice,
  });
}

function persistSoon() {
  if (!saveTimer) saveTimer = setTimeout(persist, 800);
}

// ── Pantalla encendida mientras lee (móvil) ───────────────────

async function holdScreen(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
    }
  } catch { /* sin permiso o sin soporte: no es crítico */ }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && player.state === 'playing') holdScreen(true);
});

// ── Reproductor → interfaz ────────────────────────────────────

player.onStateChange = (state) => {
  if (state !== 'playing') paceStart = null;
  holdScreen(state === 'playing');
  render();
  if (state === 'playing')                      setStatus('Leyendo…', 'playing');
  else if (state === 'paused' && mode === 'read') setStatus('En pausa');
  persist();
};

player.onPosition = (offset) => {
  if (player.state === 'playing') trackPace(offset);
  showPosition(offset);
  if (reader.text === player.text) reader.highlight(offset);
  persistSoon();
};

player.onEnd = () => {
  mode = 'edit';
  render();
  setStatus('Lectura terminada');
};

player.onError = (error) => {
  const message = error === 'not-allowed'
    ? 'El navegador bloqueó el audio. Pulsa reproducir otra vez.'
    : `La voz no pudo leer el texto (${error}). Prueba con otra voz.`;
  setStatus(message, 'error');
};

// ── Acciones ──────────────────────────────────────────────────

function enterReadMode() {
  if (reader.text !== player.text) reader.build(player.text, player.sentences);
  mode = 'read';
  render();
  reader.highlight(player.offset);
  reader.reveal();
}

function togglePlay() {
  if (player.state === 'playing') { player.pause(); return; }

  const text = textEl.value;
  if (!text.trim()) {
    setStatus('Escribe o pega un texto para leerlo.', 'error');
    textEl.focus();
    return;
  }
  if (text !== player.text) player.load(text);
  enterReadMode();
  player.play();
}

function stop() {
  if (mode !== 'read') return;
  mode = 'edit';
  player.pause();
  render();
  setStatus(isSynced() && player.offset > 0
    ? `Detenido en ${percent(player.offset)} %. Reproduce para continuar.`
    : 'Listo');
}

function restart() {
  if (!isSynced()) return;
  player.seek(0);
  render();
}

function skip(direction) {
  if (!isSynced()) return;
  player.skip(direction);
  render();
}

function onTextEdited() {
  updateCounter();
  render();
  persistSoon();
}

function clearText() {
  mode = 'edit';
  player.load('');
  reader.clear();
  textEl.value = '';
  onTextEdited();
  setStatus('Listo');
  textEl.focus();
}

// ── Voces ─────────────────────────────────────────────────────

const voices = new VoiceManager(onVoicesChanged);

function onVoicesChanged() {
  const pool = voices.pool();

  if (!pool.length) {
    voiceSel.replaceChildren(new Option('Sin voces disponibles', ''));
    voiceSel.disabled = true;
    player.setVoice(null);
    showVoiceNote(null);
    return;
  }

  // Conserva la voz actual o la elegida a mano; si no, la mejor disponible
  // (Sabina cuando está instalada).
  const wanted = voiceSel.value || voiceChoice;
  const chosen = pool.find(v => v.name === wanted) ?? pool[0];

  voiceSel.disabled = false;
  voiceSel.replaceChildren(...pool.map(v => new Option(voiceLabel(v), v.name)));
  voiceSel.value = chosen.name;
  player.setVoice(chosen);
  showVoiceNote(chosen);
}

/** Nombre de la voz; añade el idioma solo si el nombre no lo dice ya. */
function voiceLabel(voice) {
  return voice.name.includes('(') ? voice.name : `${voice.name} (${voice.lang.replace('_', '-')})`;
}

/** Explica qué voz se usa cuando no es la preferida, y cómo conseguirla. */
function showVoiceNote(voice) {
  voiceNote.replaceChildren();

  const cloud = !!voice && voices.locality(voice) === 'cloud';
  localNote.classList.toggle('local-note--cloud', cloud);
  localNote.querySelector('span').textContent = cloud ? 'Voz en línea' : 'Todo ocurre en tu equipo';

  if (!voice) {
    voiceNote.append('Este navegador no tiene voces instaladas. Instala una voz en español en los ajustes del sistema y vuelve a abrir la página.');
  } else if (cloud) {
    voiceNote.append('Esta voz se genera en un servidor: el texto sale de tu equipo mientras la uses. No hay voces locales en este navegador.');
  } else if (!voices.hasSpanish()) {
    voiceNote.append('No hay voces en español en este equipo. Instala una en los ajustes del sistema para que el texto suene bien.');
  } else if (!voices.pool().some(v => voices.isPreferred(v))) {
    const onWindows = /win/i.test(navigator.userAgentData?.platform ?? navigator.platform ?? '');
    if (onWindows) {
      voiceNote.append('Sabina (español de México) no está instalada en este equipo; se usa la voz más parecida.');
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'Cómo instalar Sabina';
      const steps = document.createElement('ol');
      for (const step of [
        'Abre Configuración de Windows y entra en Hora e idioma, luego en Voz.',
        'En Administrar voces, elige Agregar voces y busca Español (México).',
        'Cierra el navegador por completo y vuelve a abrir esta página.',
      ]) {
        const li = document.createElement('li');
        li.textContent = step;
        steps.append(li);
      }
      details.append(summary, steps);
      voiceNote.append(details);
    } else {
      voiceNote.append('Sabina es una voz de Windows y no existe en este sistema; se usa la voz en español más parecida que tiene tu equipo.');
    }
  }

  voiceNote.hidden = !voiceNote.hasChildNodes();
}

voiceSel.addEventListener('change', () => {
  const voice = voices.byName(voiceSel.value);
  voiceChoice = voice?.name ?? null;
  player.setVoice(voice);
  showVoiceNote(voice);
  persist();
});

// ── Controles ─────────────────────────────────────────────────

btnPlay.addEventListener('click', togglePlay);
btnStop.addEventListener('click', stop);
btnReset.addEventListener('click', restart);
btnPrev.addEventListener('click', () => skip(-1));
btnNext.addEventListener('click', () => skip(1));
btnClear.addEventListener('click', clearText);
textEl.addEventListener('input', onTextEdited);

speedEl.addEventListener('input', () => {
  measuredCps = null;
  paceStart   = null;
  syncSpeedLabel();
  player.setRate(rate());
  showPosition(isSynced() ? player.offset : 0);
  persistSoon();
});

// Barra de posición: mientras se arrastra solo se mueve la vista;
// al soltar, la lectura salta ahí.
const seekOffset = () => (seekEl.value / SEEK_STEPS) * player.text.length;

seekEl.addEventListener('input', () => {
  scrubbing = true;
  setFill(seekEl);
  const offset = seekOffset();
  posLabel.textContent = `${percent(offset)} %`;
  if (reader.text === player.text) reader.highlight(offset);
});

seekEl.addEventListener('change', () => {
  scrubbing = false;
  player.seek(seekOffset());
  render();
});

// Tocar una palabra: leer desde ahí.
readEl.addEventListener('click', (e) => {
  const span = e.target.closest('.word');
  if (!span) return;
  const offset = reader.startOf(span);
  if (offset < 0) return;
  player.seek(offset);
  if (player.state !== 'playing') player.play();
});

// ── Teclado ───────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const target = e.target;

  // En campos de texto y controles, las teclas son del control.
  if (target.closest('textarea, input, select')) return;

  if (e.key === 'Escape') { stop(); return; }

  // Con el foco en un botón, Espacio activa ese botón (comportamiento nativo).
  if (e.code === 'Space' && !target.closest('button, summary')) {
    e.preventDefault();
    togglePlay();
  } else if (e.key === 'ArrowLeft') {
    skip(-1);
  } else if (e.key === 'ArrowRight') {
    skip(1);
  }
});

// ── Archivos ──────────────────────────────────────────────────

const TEXT_FILE = /\.(txt|text|md|markdown)$/i;

async function openFile(file) {
  if (!file) return;
  if (!file.type.startsWith('text/') && !TEXT_FILE.test(file.name)) {
    setStatus('Ese archivo no es de texto. Abre un .txt o un .md.', 'error');
    return;
  }

  let content;
  try {
    const bytes = await file.arrayBuffer();
    content = new TextDecoder('utf-8').decode(bytes);
    // Archivos antiguos de Windows (ANSI): los acentos llegan rotos en UTF-8.
    if (content.includes('�')) content = new TextDecoder('windows-1252').decode(bytes);
  } catch {
    setStatus('No se pudo leer el archivo.', 'error');
    return;
  }

  stop();
  textEl.value = content;
  onTextEdited();
  setStatus(`Archivo cargado: ${file.name}`);
}

btnOpen.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  openFile(fileInput.files[0]);
  fileInput.value = '';
});

// Soltar un archivo sobre la hoja (arrastrar texto sigue funcionando normal).
const draggingFile = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files');

page.addEventListener('dragover', (e) => {
  if (!draggingFile(e)) return;
  e.preventDefault();
  page.classList.add('drag-over');
});

page.addEventListener('dragleave', (e) => {
  if (!page.contains(e.relatedTarget)) page.classList.remove('drag-over');
});

page.addEventListener('drop', (e) => {
  if (!draggingFile(e)) return;
  e.preventDefault();
  page.classList.remove('drag-over');
  openFile(e.dataTransfer.files[0]);
});

// ── Tema ──────────────────────────────────────────────────────

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function currentTheme() {
  return loadTheme() ?? (systemDark.matches ? 'dark' : 'light');
}

function syncThemeButton() {
  const dark = currentTheme() === 'dark';
  themeIcon.setAttribute('href', dark ? '#i-sun' : '#i-moon');
  btnTheme.setAttribute('aria-label', dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
  btnTheme.title = btnTheme.getAttribute('aria-label');
}

btnTheme.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  saveTheme(next);
  syncThemeButton();
});

systemDark.addEventListener('change', syncThemeButton);

// ── Cierre de la página ───────────────────────────────────────
// Guarda la posición y corta el audio: algunos navegadores siguen hablando
// tras recargar si no se cancela.
window.addEventListener('pagehide', () => {
  persist();
  speechSynthesis.cancel();
});

// ── Arranque ──────────────────────────────────────────────────

speechSynthesis.cancel(); // limpia restos de una carga anterior

if (typeof session.rate === 'number' && session.rate >= Number(speedEl.min) && session.rate <= Number(speedEl.max)) {
  speedEl.value = session.rate;
}
syncSpeedLabel();
player.setRate(rate());
syncThemeButton();

if (typeof session.text === 'string' && session.text) {
  textEl.value = session.text;
  player.load(session.text);
  if (session.offset > 0) {
    player.seek(session.offset);
    setStatus(`Texto recuperado de tu última visita, en ${percent(player.offset)} %. Reproduce para continuar.`);
  }
}

updateCounter();
render();
