# Text to Voice 🔒

Conversor de texto a voz **100% local** que utiliza la Web Speech API nativa del navegador. Sin peticiones externas, sin servidores, sin dependencias. Solo se usan voces locales del sistema — ningún texto sale de tu equipo.

**Demo en vivo:** [tank3-tk3.github.io/text-to-voice](https://tank3-tk3.github.io/text-to-voice)

---

## Características

- **Sin conexión a internet** — todo el procesamiento ocurre en tu equipo
- **Solo voces locales (🔒)** — se excluyen automáticamente las voces cloud que envían datos a servidores externos
- **Selección automática de voz** — elige la mejor voz femenina en español disponible
- **Carga de archivos .txt** — abre un archivo o arrástralo al área de texto
- **Control de velocidad** — de 1× a 5× en pasos de 0.25×
- **Vista de lectura** — resalta la palabra que se está leyendo en tiempo real
- **Continuar donde lo dejaste** — al detener guarda la posición; puedes reanudar más tarde
- **Síntesis por oraciones** — evita el bug de Chrome que corta audios largos (~15 s)
- **Atajos de teclado** — `Space` para play/pausa, `Esc` para detener
- **Accesible** — atributos ARIA, `aria-live`, roles y etiquetas en todos los controles

---

## Uso

### Opción 1 — Demo online (GitHub Pages)

Abre directamente en el navegador sin instalar nada:

**[https://tank3-tk3.github.io/text-to-voice](https://tank3-tk3.github.io/text-to-voice)**

### Opción 2 — Servidor local

```bash
# Clona el repositorio
git clone https://github.com/Tank3-TK3/text-to-voice.git
cd text-to-voice

# Con Python 3
python3 -m http.server 8080

# Con Node.js
npx serve .
```

Luego abre `http://localhost:8080`.

> **Nota:** Abrir `index.html` directamente con `file://` puede bloquear los ES Modules en algunos navegadores. Usa un servidor local si la app no carga.

---

## Compatibilidad

| Navegador | Versión mínima | Estado |
|-----------|---------------|--------|
| Chrome / Chromium | 33+ | ✅ Recomendado |
| Edge | 14+ | ✅ Funciona |
| Safari | 7+ | ✅ Funciona |
| Firefox | — | ⚠️ Soporte parcial de Web Speech API |

---

## Estructura del proyecto

```
text-to-voice/
├── index.html          # Estructura HTML y punto de entrada
├── css/
│   └── style.css       # Estilos de la aplicación
└── js/
    ├── main.js         # Punto de entrada: une módulos y gestiona UI
    ├── player.js       # Motor de síntesis (Web Speech API)
    ├── reader.js       # Vista de lectura con resaltado de palabra
    └── voices.js       # Gestión y clasificación de voces del sistema
```

### Descripción de módulos

| Archivo | Responsabilidad |
|---------|----------------|
| `main.js` | Inicialización, eventos DOM, carga de .txt, atajos de teclado, coordinación entre módulos |
| `player.js` | Tokenización en oraciones, síntesis, pausa/reanudación, cambio de velocidad en tiempo real |
| `reader.js` | Construcción de spans por palabra, resaltado con búsqueda binaria, scroll inteligente |
| `voices.js` | Carga de voces, filtrado de voces cloud, selección automática de voz femenina local |

---

## Privacidad

Esta aplicación **no hace ninguna petición de red**. Solo se exponen voces marcadas como locales por el navegador — las voces cloud (Google, Microsoft online, etc.) se filtran automáticamente antes de mostrarse en el selector.

El texto que escribes, pegas o cargas desde un archivo nunca abandona tu navegador.

---

## Licencia

[MIT](LICENSE)
