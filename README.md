# Text to Voice 🔒

Conversor de texto a voz **100% local** que utiliza la Web Speech API nativa del navegador. Sin peticiones externas, sin servidores, sin dependencias.

---

## Características

- **Sin conexión a internet** — todo el procesamiento ocurre en tu equipo
- **Voces del sistema** — usa las voces instaladas en tu SO (marcadas con 🔒 si son locales, con ☁ si son cloud)
- **Selección automática de voz** — elige la mejor voz femenina en español disponible
- **Control de velocidad** — de 1× a 5× en pasos de 0.25×
- **Vista de lectura** — resalta la palabra que se está leyendo en tiempo real
- **Continuar donde lo dejaste** — al detener guarda la posición; puedes reanudar más tarde
- **Síntesis por oraciones** — evita el bug de Chrome que corta audios largos (~15 s)
- **Atajos de teclado** — `Space` para play/pausa, `Esc` para detener
- **Accesible** — atributos ARIA, `aria-live`, roles y etiquetas en todos los controles

---

## Uso

### Opción 1 — Abrir directamente en el navegador

```bash
# Clona el repositorio
git clone https://github.com/Tank3-TK3/text-to-voice.git
cd text-to-voice

# Abre index.html en tu navegador
# En Linux/Mac:
open index.html
# En Windows:
start index.html
```

> **Nota:** Algunos navegadores bloquean ES Modules (`type="module"`) cuando el archivo se abre con `file://`. Si la app no carga, usa la opción 2.

### Opción 2 — Servidor local (recomendado)

```bash
# Con Python 3
python3 -m http.server 8080

# Con Node.js (npx)
npx serve .

# Con PHP
php -S localhost:8080
```

Luego abre `http://localhost:8080` en tu navegador.

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
| `main.js` | Inicialización, eventos DOM, atajos de teclado, coordinación entre módulos |
| `player.js` | Tokenización en oraciones, síntesis, pausa/reanudación, cambio de velocidad en tiempo real |
| `reader.js` | Construcción de spans por palabra, resaltado con búsqueda binaria, scroll inteligente |
| `voices.js` | Carga de voces, detección local/cloud, selección automática de voz femenina |

---

## Privacidad

Las voces marcadas con **🔒** procesan el audio completamente en tu equipo.  
Las voces marcadas con **☁** pueden enviar el texto a servidores del proveedor (Google, Microsoft, etc.).  
La aplicación en sí **nunca** hace peticiones de red de ningún tipo.

---

## Licencia

[MIT](LICENSE)
