/**
 * voices.js — Voces del sistema (Web Speech API)
 *
 * Las voces no viajan con la página: cada navegador expone las que tiene
 * instaladas el sistema operativo. Este módulo hace que la elección sea
 * predecible en cualquier equipo:
 *
 *  1. Si está la voz preferida (Sabina, es-MX), se usa siempre.
 *  2. Si no, la más cercana: otra voz de México, luego español de
 *     Latinoamérica, luego cualquier español.
 *  3. Las voces en la nube se descartan: enviarían el texto a un servidor.
 */

/** Voz preferida: "Microsoft Sabina - Spanish (Mexico)". */
const PREFERRED = 'sabina';

/** Nombres asociados a voces femeninas en español (desempate). */
const FEMALE_HINTS = [
  'helena', 'laura', 'sabina', 'paulina', 'elvira', 'monica', 'mónica',
  'conchita', 'lucia', 'maria', 'camila', 'valeria', 'lupe', 'marisol',
  'sofia', 'ximena', 'female', 'femenina', 'mujer', 'dalia', 'renata',
  'catalina', 'pilar', 'angelica', 'paloma',
];

/** Patrones que delatan una voz online aunque localService no lo diga. */
const CLOUD_HINTS = ['google', 'online', 'cloud', 'network', 'remote'];

/** Milisegundos de espera antes de dar por hecho que no hay voces. */
const EMPTY_TIMEOUT = 3000;

export class VoiceManager {
  #all = [];
  #onChange;

  /** @param {() => void} onChange se llama cada vez que cambia la lista */
  constructor(onChange) {
    this.#onChange = onChange;
    speechSynthesis.addEventListener('voiceschanged', () => this.#load());
    // Diferido: en Firefox y Safari las voces ya están listas aquí, y el
    // aviso llegaría antes de que quien nos crea termine de inicializarse.
    queueMicrotask(() => this.#load());
    // Algunos navegadores nunca disparan voiceschanged si no hay voces.
    setTimeout(() => { if (!this.#all.length) this.#onChange(); }, EMPTY_TIMEOUT);
  }

  /**
   * Voces utilizables, de mejor a peor.
   * Español local → cualquier voz local → todas (último recurso).
   */
  pool() {
    const local   = this.#all.filter(v => this.locality(v) !== 'cloud');
    const spanish = local.filter(v => langOf(v).startsWith('es'));
    const base    = spanish.length ? spanish : local.length ? local : this.#all;
    return [...base].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
  }

  byName(name) {
    return this.#all.find(v => v.name === name) ?? null;
  }

  isPreferred(voice) {
    return !!voice && voice.name.toLowerCase().includes(PREFERRED);
  }

  hasSpanish() {
    return this.pool().some(v => langOf(v).startsWith('es'));
  }

  /**
   * ¿La voz sintetiza en el equipo?
   *  - localService === false → online.
   *  - Nombre con CLOUD_HINTS → online (hay navegadores que no informan bien).
   *  - localService === true  → local.
   * @returns {'local'|'cloud'|'unknown'}
   */
  locality(voice) {
    const name = voice.name.toLowerCase();
    if (voice.localService === false)             return 'cloud';
    if (CLOUD_HINTS.some(h => name.includes(h))) return 'cloud';
    if (voice.localService === true)              return 'local';
    return 'unknown';
  }

  #load() {
    const list = speechSynthesis.getVoices();
    if (!list.length) return;
    this.#all = list;
    this.#onChange();
  }
}

function langOf(voice) {
  return (voice.lang || '').replace('_', '-').toLowerCase();
}

function score(voice) {
  const name = voice.name.toLowerCase();
  const lang = langOf(voice);
  let s = 0;

  if (name.includes(PREFERRED)) s += 1000;

  if (lang === 'es-mx')                           s += 300;
  else if (lang === 'es-us' || lang === 'es-419') s += 200;
  else if (lang.startsWith('es'))                 s += 100;

  if (FEMALE_HINTS.some(h => name.includes(h))) s += 20;
  if (voice.localService === true)              s += 5;
  if (voice.default)                            s += 1;
  return s;
}
