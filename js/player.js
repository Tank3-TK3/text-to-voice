/**
 * player.js — Motor de lectura (Web Speech API)
 *
 * Decisiones:
 *  - Una oración = un utterance. La posición se guarda por palabra
 *    (evento boundary) y, donde el motor no lo emite, por oración.
 *  - Pausar es cancelar y recordar la posición; continuar es volver a hablar
 *    desde ahí. speechSynthesis.pause()/resume() se comporta distinto en cada
 *    navegador (en Android no pausa, en Chrome a veces no reanuda); así el
 *    comportamiento es idéntico en todos.
 *  - Cada arranque tiene un "token". Los eventos de utterances anteriores
 *    llegan tarde tras cancel() y se descartan comparando el token.
 *
 * Estados: 'idle' (sin empezar o terminado) · 'playing' · 'paused'
 */

import { splitSentences } from './text.js';

/** @typedef {'idle'|'playing'|'paused'} PlayerState */

const SETTINGS_DEBOUNCE = 250; // ms — al arrastrar el control de velocidad
const SEEK_DELAY        = 60;  // ms — agrupa saltos rápidos de oración
const REWIND_THRESHOLD  = 30;  // caracteres — "anterior" reinicia o retrocede

export class Player {
  #synth = window.speechSynthesis;

  /** @type {PlayerState} */
  #state     = 'idle';
  #text      = '';
  #sentences = [];   // [{ start, end }]
  #offset    = 0;    // carácter absoluto en #text
  #rate      = 1;
  #voice     = null;
  #token     = 0;
  #timer     = null;
  #utterance = null; // referencia viva: Chrome pierde onend si el GC la recoge

  /** @type {((state: PlayerState) => void) | null} */
  onStateChange = null;
  /** @type {((offset: number) => void) | null} */
  onPosition = null;
  /** @type {(() => void) | null} llegó al final del texto */
  onEnd = null;
  /** @type {((error: string) => void) | null} */
  onError = null;

  get state()     { return this.#state; }
  get offset()    { return this.#offset; }
  get text()      { return this.#text; }
  get sentences() { return this.#sentences; }

  // ── API pública ───────────────────────────────────────────

  /** Carga un texto nuevo y vuelve al inicio. */
  load(text) {
    this.#halt();
    this.#text      = text;
    this.#sentences = splitSentences(text);
    this.#offset    = 0;
    this.#setState('idle');
  }

  /** Lee desde la posición actual. */
  play() {
    if (!this.#sentences.length) return;
    this.#halt();
    this.#speakFrom();
  }

  /** Detiene el audio y conserva la posición. */
  pause() {
    if (this.#state !== 'playing') return;
    this.#halt();
    this.#setState('paused');
  }

  /** Mueve la posición. Si está leyendo, sigue desde ahí. */
  seek(offset) {
    const text = this.#text;
    offset = Math.max(0, Math.min(Math.round(offset), text.length));
    // Retrocede al inicio de la palabra para no leerla a medias.
    while (offset > 0 && offset < text.length && !isSpace(text[offset]) && !isSpace(text[offset - 1])) {
      offset--;
    }

    const wasPlaying = this.#state === 'playing';
    if (wasPlaying) this.#halt();

    this.#offset = offset;
    this.onPosition?.(offset);

    if (wasPlaying) {
      this.#timer = setTimeout(() => this.#speakFrom(), SEEK_DELAY);
    }
  }

  /**
   * Salta de oración. Hacia atrás: vuelve al inicio de la actual; si ya
   * está al inicio, va a la anterior (como un reproductor de música).
   * @param {1|-1} direction
   */
  skip(direction) {
    const list = this.#sentences;
    if (!list.length) return;

    let i = list.findIndex(s => this.#offset < s.end);
    if (i === -1) i = list.length - 1;

    if (direction < 0) {
      if (this.#offset - list[i].start <= REWIND_THRESHOLD && i > 0) i--;
      this.seek(list[i].start);
    } else if (i < list.length - 1) {
      this.seek(list[i + 1].start);
    }
  }

  setRate(rate) {
    if (rate === this.#rate) return;
    this.#rate = rate;
    this.#applySettingsSoon();
  }

  setVoice(voice) {
    const changed = voice?.name !== this.#voice?.name;
    this.#voice = voice;
    if (changed) this.#applySettingsSoon();
  }

  // ── Internos ──────────────────────────────────────────────

  /** Corta el audio e invalida los eventos de lo que estuviera sonando. */
  #halt() {
    clearTimeout(this.#timer);
    this.#timer = null;
    this.#token++;
    this.#utterance = null;
    this.#synth.cancel();
  }

  /** Velocidad o voz nuevas: se aplican relanzando desde la palabra actual. */
  #applySettingsSoon() {
    if (this.#state !== 'playing') return;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#halt();
      this.#speakFrom();
    }, SETTINGS_DEBOUNCE);
  }

  #speakFrom() {
    const index = this.#sentences.findIndex(s => this.#offset < s.end);
    if (index === -1) { this.#finish(); return; }
    this.#speak(index);
  }

  #speak(index) {
    if (index >= this.#sentences.length) { this.#finish(); return; }

    const token    = this.#token;
    const sentence = this.#sentences[index];
    const from     = Math.max(sentence.start, this.#offset);
    const chunk    = this.#text.slice(from, sentence.end);

    if (!chunk.trim()) {
      this.#offset = sentence.end;
      this.#speak(index + 1);
      return;
    }

    const utt = new SpeechSynthesisUtterance(chunk);
    utt.rate  = this.#rate;
    utt.lang  = this.#voice?.lang ?? 'es-MX';
    if (this.#voice) utt.voice = this.#voice;

    utt.onboundary = (e) => {
      if (token !== this.#token) return;
      if (e.name && e.name !== 'word') return;
      this.#offset = from + e.charIndex;
      this.onPosition?.(this.#offset);
    };

    utt.onend = () => {
      if (token !== this.#token) return;
      this.#offset = sentence.end;
      this.#speak(index + 1);
    };

    utt.onerror = (e) => {
      if (token !== this.#token) return;
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      this.#halt();
      this.#setState('paused');
      this.onError?.(e.error);
    };

    this.#utterance = utt;
    this.#offset    = from;
    this.#synth.speak(utt);
    this.#setState('playing');
    // Los motores sin eventos de palabra avanzan al menos oración a oración.
    this.onPosition?.(from);
  }

  #finish() {
    this.#utterance = null;
    this.#offset    = 0;
    this.#setState('idle');
    this.onEnd?.();
  }

  #setState(next) {
    if (next === this.#state) return;
    this.#state = next;
    this.onStateChange?.(next);
  }
}

function isSpace(ch) {
  return ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r' || ch === ' ';
}
