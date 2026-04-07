/**
 * voices.js — Gestión de voces del sistema (Web Speech API)
 *
 * - Detección local/cloud: combina localService con heurísticas por nombre.
 * - Filtrado por idioma: solo voces locales del idioma seleccionado.
 * - Selección femenina por idioma con hints específicos por lengua.
 */

/** Hints de voz femenina por código de idioma. */
const FEMALE_HINTS = {
  es: [
    'helena', 'laura', 'sabina', 'paulina', 'elvira', 'monica',
    'conchita', 'lucia', 'maria', 'camila', 'valeria', 'lupe',
    'marisol', 'sofia', 'ximena', 'female', 'femenina', 'mujer',
    'dalia', 'renata', 'catalina', 'pilar',
  ],
  en: [
    'samantha', 'victoria', 'karen', 'moira', 'fiona', 'kate',
    'zira', 'hazel', 'female', 'woman', 'alice', 'emily',
    'allison', 'ava', 'susan', 'siri',
  ],
  fr: [
    'amelie', 'aurelie', 'juliette', 'marie', 'female', 'femme',
    'elsa', 'claire', 'virginie',
  ],
  pt: [
    'luciana', 'joana', 'catarina', 'female', 'feminina', 'mulher',
    'francisca', 'vitoria',
  ],
  zh: [
    'tingting', 'meijia', 'yan', 'li', 'female', '女', 'sin-ji',
    'hanhan', 'xiaoxiao',
  ],
  ar: [
    'laila', 'fatima', 'hind', 'female', 'woman', 'نسرين',
  ],
};

/** Fallback genérico si el idioma no tiene hints definidos. */
const GENERIC_FEMALE = ['female', 'woman', 'girl', 'femenina', 'mujer', 'femme'];

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
   * Devuelve voces locales para el idioma indicado.
   * Excluye siempre voces cloud para garantizar privacidad total.
   * Fallbacks:
   *   1. Voces locales del idioma solicitado
   *   2. Cualquier voz local (si no hay para ese idioma)
   *   3. Lista vacía (sin voces locales disponibles)
   */
  getVoicesForLang(langCode) {
    return this.#all.filter(
      v => v.lang.startsWith(langCode) && this.locality(v) !== 'cloud'
    );
  }

  /**
   * Índice global de la mejor voz femenina en el pool dado.
   * @param {SpeechSynthesisVoice[]} pool
   * @param {string} lang  Código de idioma (ej. 'es', 'en')
   */
  bestFemaleIndex(pool, lang = 'es') {
    let bestIdx = -1, bestScore = -1;
    for (const v of pool) {
      const score = this.#femaleScore(v, lang);
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
   *  4. Sin info clara          → asumimos local.
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

  #femaleScore(voice, lang) {
    const hints = FEMALE_HINTS[lang] ?? GENERIC_FEMALE;
    const name  = voice.name.toLowerCase();
    return hints.some(h => name.includes(h)) ? 1 : 0;
  }
}
