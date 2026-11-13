/**
 * text.js — División del texto en oraciones
 *
 * Cada oración se sintetiza como un utterance independiente: así la posición
 * se guarda con precisión y se pueden saltar oraciones.
 *
 * Reglas:
 *  - Una oración termina en . ! ? … solo si después hay espacio o fin de texto.
 *    "3.14" o "ejemplo.com" no se parten.
 *  - Un punto tras una abreviatura ("Sr.", "etc.") o una inicial ("J. R.")
 *    no corta. Unir dos oraciones es inofensivo: la voz respeta la puntuación.
 *  - Un salto de línea siempre corta.
 *  - Las oraciones muy largas se trocean en comas para no superar el límite
 *    de texto por utterance de algunos motores.
 */

const SENTENCE_END = /[.!?…]+["'”’»)\]]*(?=\s|$)|\n+/g;
const SPEAKABLE    = /[\p{L}\p{N}]/u;
const LAST_WORD    = /(\p{L}+)$/u;
const MAX_CHUNK    = 800;

const ABBREVIATIONS = new Set([
  'sr', 'sra', 'srta', 'dr', 'dra', 'lic', 'ing', 'arq', 'prof', 'profa',
  'mtro', 'mtra', 'ud', 'uds', 'vd', 'vds', 'av', 'avda', 'núm', 'num',
  'pág', 'págs', 'pag', 'art', 'cap', 'vol', 'tel', 'ej', 'vs', 'aprox',
  'etc', 'fig', 'ee', 'uu', 'dña', 'sto', 'sta', 'gral', 'cía',
]);

/**
 * @param {string} text
 * @returns {{ start: number, end: number }[]} rangos sin espacios en los bordes
 */
export function splitSentences(text) {
  const out = [];
  let from = 0;
  let m;

  SENTENCE_END.lastIndex = 0;
  while ((m = SENTENCE_END.exec(text)) !== null) {
    if (m[0] === '.' && endsWithAbbreviation(text, from, m.index)) continue;
    const end = m.index + m[0].length;
    pushRange(out, text, from, end);
    from = end;
  }
  pushRange(out, text, from, text.length);
  return out;
}

function endsWithAbbreviation(text, from, dotIndex) {
  const before = text.slice(Math.max(from, dotIndex - 12), dotIndex);
  const word   = before.match(LAST_WORD)?.[1];
  if (!word) return false;
  return word.length === 1 || ABBREVIATIONS.has(word.toLowerCase());
}

function isSpace(ch) {
  return ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r' || ch === ' ';
}

function pushRange(out, text, start, end) {
  while (start < end && isSpace(text[start])) start++;
  while (end > start && isSpace(text[end - 1])) end--;
  if (end <= start || !SPEAKABLE.test(text.slice(start, end))) return;

  while (end - start > MAX_CHUNK) {
    const windowText = text.slice(start, start + MAX_CHUNK);
    let cut = Math.max(
      windowText.lastIndexOf(', '),
      windowText.lastIndexOf('; '),
      windowText.lastIndexOf(': '),
    );
    if (cut < MAX_CHUNK * 0.4) cut = windowText.lastIndexOf(' ');
    if (cut <= 0) cut = MAX_CHUNK - 1;

    out.push({ start, end: start + cut + 1 });
    start += cut + 1;
    while (start < end && isSpace(text[start])) start++;
  }
  if (end > start) out.push({ start, end });
}
