/**
 * store.js — Memoria entre visitas (localStorage)
 *
 * Guarda el texto, la posición, la velocidad y la voz elegida en este
 * navegador. Nada sale del equipo. Si el almacenamiento está bloqueado
 * (modo privado, cuota llena), la app funciona igual sin recordar.
 */

const SESSION_KEY = 'ttv:session';
const THEME_KEY   = 'ttv:theme';

/** @returns {{ text?: string, offset?: number, rate?: number, voice?: string|null }} */
export function loadSession() {
  try {
    const data = JSON.parse(localStorage.getItem(SESSION_KEY));
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

export function saveSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Texto demasiado grande para la cuota: conserva al menos los ajustes.
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ rate: session.rate, voice: session.voice }));
    } catch { /* sin almacenamiento */ }
  }
}

/** @returns {'light'|'dark'|null} null = seguir al sistema */
export function loadTheme() {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    return theme === 'light' || theme === 'dark' ? theme : null;
  } catch {
    return null;
  }
}

export function saveTheme(theme) {
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* sin almacenamiento */ }
}
