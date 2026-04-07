/**
 * player.js — Motor de síntesis de voz (Web Speech API)
 *
 * Mejoras vs versión anterior:
 *  - Síntesis por oraciones: evita el bug de Chrome que corta audios
 *    largos (~15 s). Cada oración se encola como utterance independiente.
 *  - Offset correcto: se calcula como absStart + e.charIndex, no a partir
 *    de slice.length (que era frágil en reinicios encadenados).
 *  - Resume robusto: polling con reintentos en lugar de setTimeout fijo.
 *  - Timers limpiados en stop() para evitar efectos secundarios.
 *
 * Ciclo de vida del offset:
 *   start()         → acepta offset externo (continuar / inicio).
 *   boundary event  → actualiza offset al carácter actual.
 *   stop()          → guarda offset (▶ Continuar lo usará).
 *   finish()        → texto terminado, resetea offset a 0.
 *   resetPosition() → ↺ del usuario, resetea a 0.
 */

/** @typedef {'idle'|'playing'|'paused'|'stopped'|'finished'} PlayerEvent */

export class Player {
  #synth = window.speechSynthesis;

  // Estado
  #state       = 'idle';  // 'idle' | 'playing' | 'paused'
  #fullText    = '';
  #sentences   = [];      // [{ text, start, end }]
  #sentIdx     = 0;       // índice de la oración actual
  #offset      = 0;       // carácter absoluto en #fullText
  #uttId       = 0;       // guard contra callbacks huérfanos
  #speedTimer  = null;
  #resumeTimer = null;

  // Callbacks — asignados desde main.js
  /** @type {((event: PlayerEvent) => void) | null} */
  onStateChange = null;
  /** @type {((charIndex: number) => void) | null} */
  onBoundary = null;
  /** @type {((error: string) => void) | null} */
  onError = null;

  // ── Getters ───────────────────────────────────────────────
  get state()  { return this.#state; }
  get offset() { return this.#offset; }
  get text()   { return this.#fullText; }

  // ── API pública ───────────────────────────────────────────

  /**
   * Inicia la síntesis desde `offset`.
   * Tokeniza el texto en oraciones antes de empezar.
   */
  start(fullText, offset, rate, voice) {
    this.#fullText  = fullText;
    this.#offset    = offset;
    this.#sentences = this.#tokenize(fullText);
    this.#uttId++;        // invalida callbacks pendientes antes de cancel()
    this.#synth.cancel();
    this.#startFromOffset(rate, voice);
  }

  pause() {
    if (this.#state !== 'playing') return;
    this.#setState('paused'); // estado primero → el guard de onend actúa correctamente
    this.#synth.pause();
  }

  /**
   * Reanuda con reintentos (fallback para bug de Chrome).
   * Intenta synth.resume() hasta 5 veces cada 100 ms;
   * si falla, cancela y relanza desde el offset actual.
   */
  resume(rate, voice) {
    if (this.#state !== 'paused') return;
    this.#synth.resume();

    let tries = 0;
    const check = () => {
      this.#resumeTimer = setTimeout(() => {
        if (!this.#synth.paused) {
          this.#setState('playing');
        } else if (++tries < 5) {
          check();
        } else {
          // Chrome no reanudó → forzar restart desde posición actual
          this.#synth.cancel();
          this.#startFromOffset(rate, voice);
        }
      }, 100);
    };
    check();
  }

  /** Cancela y guarda la posición para ▶ Continuar. */
  stop() {
    this.#clearTimers();
    this.#uttId++;        // invalida callbacks pendientes antes de cancel()
    this.#synth.cancel();
    this.#setState('stopped');
  }

  /** Resetea la posición a 0 (botón ↺). */
  resetPosition() {
    this.#offset = 0;
  }

  /**
   * Cambia la velocidad en tiempo real con debounce.
   * Relanza desde el offset actual con la nueva velocidad.
   */
  changeSpeed(rate, voice) {
    if (this.#state !== 'playing') return;
    clearTimeout(this.#speedTimer);
    this.#speedTimer = setTimeout(() => {
      this.#synth.cancel();
      this.#startFromOffset(rate, voice);
    }, 260);
  }

  // ── Internos ──────────────────────────────────────────────

  /**
   * Divide el texto en oraciones para evitar el límite de ~15 s de Chrome.
   * Conserva la puntuación con la oración a la que pertenece.
   */
  #tokenize(text) {
    const re = /[^.!?\n]+(?:[.!?\n]+)?/g;
    const result = [];
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[0].trim()) {
        result.push({ text: m[0], start: m.index, end: m.index + m[0].length });
      }
    }
    return result.length ? result : [{ text, start: 0, end: text.length }];
  }

  /** Localiza la oración que contiene #offset y arranca desde ahí. */
  #startFromOffset(rate, voice) {
    const idx = this.#sentences.findIndex(s => this.#offset < s.end);
    if (idx === -1) { this.#finish(); return; }
    this.#sentIdx = idx;
    this.#speakSentence(rate, voice);
  }

  /** Sintetiza la oración en #sentIdx y encadena con la siguiente al terminar. */
  #speakSentence(rate, voice) {
    if (this.#sentIdx >= this.#sentences.length) {
      this.#finish();
      return;
    }

    const myId    = ++this.#uttId;
    const sent    = this.#sentences[this.#sentIdx];
    // Si estamos a mitad de una oración (por stop/speed-change), empezar desde ahí
    const within  = Math.max(0, this.#offset - sent.start);
    const slice   = sent.text.substring(within);
    const absStart = sent.start + within;

    if (!slice.trim()) {
      this.#offset = sent.end;
      this.#sentIdx++;
      this.#speakSentence(rate, voice);
      return;
    }

    const utt  = new SpeechSynthesisUtterance(slice);
    utt.rate   = rate;
    utt.lang   = voice?.lang ?? 'es-ES';
    if (voice) utt.voice = voice;

    utt.onboundary = (e) => {
      if (myId !== this.#uttId || e.name !== 'word') return;
      if (this.#state !== 'playing') return; // Chrome a veces dispara boundary al pausar
      // absStart es el offset absoluto donde empieza slice → corrección exacta
      this.#offset = absStart + e.charIndex;
      this.onBoundary?.(this.#offset);
    };

    utt.onend = () => {
      if (myId !== this.#uttId) return;
      // Chrome dispara onend al llamar pause()/cancel() en lugar de onerror.
      // Si no estamos reproduciendo activamente, ignoramos este evento.
      if (this.#state !== 'playing') return;
      this.#offset = sent.end;
      this.#sentIdx++;
      this.#speakSentence(rate, voice);
    };

    utt.onerror = (e) => {
      if (myId !== this.#uttId) return;
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      this.#setState('idle');
      this.onError?.(e.error);
    };

    this.#synth.speak(utt);
    if (this.#state !== 'playing') this.#setState('playing');
  }

  #finish() {
    this.#offset    = 0;
    this.#sentences = [];
    this.#setState('finished');
  }

  #setState(newState) {
    this.#state = newState === 'finished' ? 'idle' : newState;
    this.onStateChange?.(newState);
  }

  #clearTimers() {
    clearTimeout(this.#speedTimer);
    clearTimeout(this.#resumeTimer);
  }
}
