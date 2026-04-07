/**
 * voices.js — Gestión de voces del sistema (Web Speech API)
 *
 * Mejoras vs versión anterior:
 *  - Detección local/cloud más precisa: combina localService (API estándar)
 *    con heurísticas por nombre para browsers que no reportan localService.
 *  - Puntuación femenina más amplia y legible.
 */

/** Nombres asociados a voces femeninas en español. */
const FEMALE_HINTS = [
  'helena', 'laura', 'sabina', 'paulina', 'elvira', 'monica',
  'conchita', 'lucia', 'maria', 'camila', 'valeria', 'lupe',
  'marisol', 'sofia', 'ximena', 'female', 'femenina', 'mujer',
  'dalia', 'renata', 'catalina', 'pilar',
];

/**
 * Nombres/patrones que indican una voz online aunque localService
 * no esté correctamente reportado por el navegador.
 */
const CLOUD_HINTS = ['google', 'online', 'cloud', 'network', 'remote'];

export class VoiceManager {
  #all   = [];
  #onLoad;

  constructor(onLoad) {
    this.#onLoad = onLoad;
    speechSynthesis.addEventListener('voiceschanged', () => this.#load());
    this.#load();
  }

  // ── Acceso ─────────────────────────────────────────────────

  get(index) {
    return this.#all[index] ?? null;
  }

  /**
   * Devuelve las voces en español del sistema.
   * Fallback: todas las voces si no hay ninguna en español.
   */
  getSpanishVoices() {
    const es = this.#all.filter(v => v.lang.startsWith('es'));
    return es.length ? es : this.#all;
  }

  /** Índice global de la mejor voz femenina en el pool dado. */
  bestFemaleIndex(pool) {
    let bestIdx = -1, bestScore = -1;
    for (const v of pool) {
      const score = this.#femaleScore(v);
      if (score > bestScore) {
        bestScore = score;
        bestIdx   = this.#all.indexOf(v);
      }
    }
    return bestIdx;
  }

  indexOf(voice) {
    return this.#all.indexOf(voice);
  }

  /**
   * Determina si una voz procesa audio localmente.
   *
   * Lógica (por orden de prioridad):
   *  1. localService === false  → definitivamente online.
   *  2. Nombre contiene CLOUD_HINTS → probablemente online.
   *  3. localService === true   → definitivamente local.
   *  4. Sin info clara          → marcada como "?" (asumimos local).
   *
   * @returns {'local'|'cloud'|'unknown'}
   */
  locality(voice) {
    const name = voice.name.toLowerCase();
    if (voice.localService === false)             return 'cloud';
    if (CLOUD_HINTS.some(h => name.includes(h))) return 'cloud';
    if (voice.localService === true)              return 'local';
    return 'unknown';
  }

  // ── Internos ───────────────────────────────────────────────

  #load() {
    const list = speechSynthesis.getVoices();
    if (!list.length) return;
    this.#all = list;
    this.#onLoad(this.#all);
  }

  #femaleScore(voice) {
    const name = voice.name.toLowerCase();
    return FEMALE_HINTS.some(h => name.includes(h)) ? 1 : 0;
  }
}
