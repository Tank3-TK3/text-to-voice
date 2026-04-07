/**
 * reader.js — Vista de lectura con resaltado de palabra activa
 *
 * Mejoras vs versión anterior:
 *  - Guarda el último índice resaltado (#lastIdx) para poder
 *    reaplicar el resaltado cuando la vista se hace visible (reapply()).
 *  - scrollIntoView solo si el span no está ya en el viewport del contenedor.
 */

export class ReadView {
  #container;
  #words   = [];   // [{ el: HTMLSpanElement, start: number, end: number }]
  #lastIdx = -1;   // índice del último span resaltado

  constructor(container) {
    this.#container = container;
  }

  /**
   * Construye los spans a partir del texto completo.
   * Llamar antes de iniciar la reproducción.
   */
  build(text) {
    this.#words   = [];
    this.#lastIdx = -1;
    const frag    = document.createDocumentFragment();
    const re      = /\S+/g;
    let m, lastPos = 0;

    while ((m = re.exec(text)) !== null) {
      if (m.index > lastPos) {
        frag.appendChild(document.createTextNode(text.slice(lastPos, m.index)));
      }
      const span       = document.createElement('span');
      span.className   = 'word';
      span.textContent = m[0];
      frag.appendChild(span);
      this.#words.push({ el: span, start: m.index, end: m.index + m[0].length });
      lastPos = m.index + m[0].length;
    }

    if (lastPos < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastPos)));
    }

    this.#container.innerHTML = '';
    this.#container.appendChild(frag);
    this.#container.scrollTop = 0;
  }

  /**
   * Resalta la palabra que contiene el carácter en posición `charIndex`.
   * Usa búsqueda binaria → O(log n).
   */
  highlight(charIndex) {
    const idx = this.#findWord(charIndex);
    if (idx === -1 || idx === this.#lastIdx) return;

    if (this.#lastIdx !== -1) {
      this.#words[this.#lastIdx].el.classList.remove('active');
    }
    this.#lastIdx = idx;
    const span = this.#words[idx].el;
    span.classList.add('active');
    this.#scrollIfNeeded(span);
  }

  /**
   * Reaplicar el último resaltado (útil cuando la vista se muestra
   * después de un Continuar desde posición guardada).
   */
  reapply() {
    if (this.#lastIdx === -1) return;
    const span = this.#words[this.#lastIdx].el;
    span.classList.add('active');
    this.#scrollIfNeeded(span);
  }

  clearHighlight() {
    if (this.#lastIdx !== -1) {
      this.#words[this.#lastIdx].el.classList.remove('active');
      this.#lastIdx = -1;
    }
  }

  show() { this.#container.classList.add('visible'); }
  hide() { this.#container.classList.remove('visible'); }

  // ── Internos ──────────────────────────────────────────────

  /** Búsqueda binaria por posición de carácter. Devuelve índice o -1. */
  #findWord(charIndex) {
    let lo = 0, hi = this.#words.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const { start, end } = this.#words[mid];
      if (charIndex < start)     { hi = mid - 1; }
      else if (charIndex >= end) { lo = mid + 1; }
      else                       { return mid; }
    }
    return -1;
  }

  /**
   * Hace scroll solo si el span está fuera del área visible del contenedor.
   * Evita saltos innecesarios cuando ya es visible.
   */
  #scrollIfNeeded(span) {
    const cRect = this.#container.getBoundingClientRect();
    const sRect = span.getBoundingClientRect();
    if (sRect.top < cRect.top || sRect.bottom > cRect.bottom) {
      span.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}
