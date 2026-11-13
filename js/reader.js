/**
 * reader.js — Vista de lectura
 *
 * Muestra el texto palabra a palabra. La oración que se está leyendo queda
 * en tinta plena y el resto atenuado; la palabra actual lleva el resaltado.
 * Las búsquedas por posición son binarias (O(log n)).
 */

export class ReadView {
  #container;
  #text      = null;
  #words     = [];              // [{ el, start, end }]
  #sentences = [];              // [{ start, end }]
  #indexOf   = new WeakMap();   // span → índice en #words
  #active    = -1;              // palabra resaltada
  #lit       = null;            // [desde, hasta) palabras de la oración actual
  #reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  constructor(container) {
    this.#container = container;
  }

  /** Texto con el que se construyó la vista (null si está vacía). */
  get text() { return this.#text; }

  build(text, sentences) {
    this.#text      = text;
    this.#sentences = sentences;
    this.#words     = [];
    this.#indexOf   = new WeakMap();
    this.#active    = -1;
    this.#lit       = null;

    const frag = document.createDocumentFragment();
    const re   = /\S+/g;
    let m, last = 0;

    while ((m = re.exec(text)) !== null) {
      if (m.index > last) frag.append(text.slice(last, m.index));
      const span = document.createElement('span');
      span.className   = 'word';
      span.textContent = m[0];
      frag.append(span);
      this.#indexOf.set(span, this.#words.length);
      this.#words.push({ el: span, start: m.index, end: m.index + m[0].length });
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.append(text.slice(last));

    this.#container.replaceChildren(frag);
    this.#container.scrollTop = 0;
  }

  clear() {
    this.#text      = null;
    this.#words     = [];
    this.#sentences = [];
    this.#active    = -1;
    this.#lit       = null;
    this.#container.replaceChildren();
  }

  /** Resalta la palabra en `charIndex` (o la siguiente, si cae en un espacio). */
  highlight(charIndex) {
    if (!this.#words.length) return;
    const idx = Math.min(this.#firstWordEndingAfter(charIndex), this.#words.length - 1);
    if (idx === this.#active) return;

    if (this.#active !== -1) this.#words[this.#active].el.classList.remove('active');
    this.#active = idx;
    const word = this.#words[idx];
    word.el.classList.add('active');

    this.#lightSentence(word.start);
    this.#keepInView(word.el, true);
  }

  /** Lleva la palabra activa a la vista sin animación (al mostrar la vista). */
  reveal() {
    if (this.#active !== -1) this.#keepInView(this.#words[this.#active].el, false);
  }

  /** Posición de inicio de la palabra de un span, o -1. */
  startOf(span) {
    const idx = this.#indexOf.get(span);
    return idx === undefined ? -1 : this.#words[idx].start;
  }

  // ── Internos ──────────────────────────────────────────────

  /** Índice de la primera palabra cuyo final está después de `charIndex`. */
  #firstWordEndingAfter(charIndex) {
    let lo = 0, hi = this.#words.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.#words[mid].end > charIndex) hi = mid; else lo = mid + 1;
    }
    return lo;
  }

  /** Índice de la primera palabra que empieza en `charIndex` o después. */
  #firstWordStartingAt(charIndex) {
    let lo = 0, hi = this.#words.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.#words[mid].start >= charIndex) hi = mid; else lo = mid + 1;
    }
    return lo;
  }

  #lightSentence(charIndex) {
    let lo = 0, hi = this.#sentences.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.#sentences[mid].end > charIndex) hi = mid; else lo = mid + 1;
    }
    const sentence = this.#sentences[lo];
    if (!sentence) return;

    const from = this.#firstWordStartingAt(sentence.start);
    const to   = this.#firstWordStartingAt(sentence.end);
    if (this.#lit && this.#lit[0] === from && this.#lit[1] === to) return;

    if (this.#lit) {
      for (let i = this.#lit[0]; i < this.#lit[1]; i++) this.#words[i].el.classList.remove('lit');
    }
    for (let i = from; i < to; i++) this.#words[i].el.classList.add('lit');
    this.#lit = [from, to];
  }

  /**
   * Mantiene la palabra en la franja cómoda de lectura. Solo se desplaza
   * cuando sale de ella, y entonces la coloca en el tercio superior.
   */
  #keepInView(span, animate) {
    const box    = this.#container;
    const height = box.clientHeight;
    if (!height) return; // vista oculta

    const top = span.offsetTop - box.scrollTop;
    if (top >= height * 0.1 && top + span.offsetHeight <= height * 0.72) return;

    box.scrollTo({
      top: span.offsetTop - height * 0.3,
      behavior: animate && !this.#reducedMotion.matches ? 'smooth' : 'auto',
    });
  }
}
