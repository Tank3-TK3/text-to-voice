# Text to Voice 🔒

Lector de texto en voz alta **100 % local**, en español. Usa la Web Speech API del navegador: sin servidores, sin dependencias y sin peticiones de red. El texto nunca sale de tu equipo.

Funciona en computadora y en teléfono.

**Demo en vivo:** [tank3-tk3.github.io/text-to-voice](https://tank3-tk3.github.io/text-to-voice)

---

## Características

- **Todo en tu equipo** — solo se usan voces locales; las voces en la nube se descartan
- **Voz preferida: Sabina (es-MX)** — se usa siempre que esté instalada; si no, la voz en español más parecida (ver [Voces](#voces))
- **Vista de lectura** — resalta la palabra que suena y destaca la oración actual
- **Toca una palabra** para leer desde ahí, o arrastra la barra de posición
- **Salto por oraciones** — anterior / siguiente, como en un reproductor de música
- **Velocidad de 0.5× a 5×**, ajustable mientras lee
- **Recuerda dónde te quedaste** — el texto, la posición, la velocidad y la voz se guardan en el navegador y vuelven al abrir la página
- **Tiempo estimado** de lectura y tiempo restante, afinado con el ritmo real de la voz
- **Archivos .txt y .md** — ábrelos o suéltalos sobre la hoja (también los guardados en ANSI/Windows-1252)
- **Tema claro y oscuro** — sigue al sistema y se puede cambiar a mano
- **Pantalla siempre encendida** mientras lee, en teléfonos que lo permiten
- **Atajos** — `Espacio` reproduce o pausa, `←` `→` cambian de oración, `Esc` detiene
- **Accesible** — controles con nombre, foco visible, respeta "reducir movimiento"

---

## Voces

La Web Speech API no trae voces propias: cada navegador ofrece las que tiene instaladas el sistema operativo. Por eso la lista cambia de un equipo a otro. La app lo resuelve con un orden de preferencia fijo:

1. **Microsoft Sabina — Spanish (Mexico)**, si está instalada
2. Otra voz local de español de México
3. Español de Latinoamérica (es-US, es-419)
4. Cualquier otra voz local en español

Si eliges otra voz a mano, se recuerda en ese navegador.

### Dónde existe Sabina

| Sistema | ¿Sabina? | Qué se usa |
|---------|----------|------------|
| Windows 10 / 11 | ✅ Sí (viene con el idioma Español de México) | Sabina, en Chrome, Edge y Firefox |
| macOS / iPhone / iPad | ❌ No existe | La voz es-MX del sistema (por ejemplo, Paulina) |
| Android | ❌ No existe | La voz en español del motor de voz del teléfono |
| Linux | ❌ No existe | Las voces instaladas (por ejemplo, eSpeak) |

### Instalar Sabina en Windows

1. Abre **Configuración → Hora e idioma → Voz**.
2. En **Administrar voces**, elige **Agregar voces** y busca **Español (México)**.
3. Cierra el navegador por completo y vuelve a abrir la página.

Cuando Sabina no está, la app lo avisa debajo del selector de voz.

---

## Uso

### Opción 1 — Demo online (GitHub Pages)

**[https://tank3-tk3.github.io/text-to-voice](https://tank3-tk3.github.io/text-to-voice)**

### Opción 2 — Servidor local

```bash
git clone https://github.com/Tank3-TK3/text-to-voice.git
cd text-to-voice

# Con Python 3
python -m http.server 8080

# Con Node.js
npx serve .
```

Luego abre `http://localhost:8080`.

> **Nota:** abrir `index.html` directamente con `file://` bloquea los módulos ES en la mayoría de navegadores. Usa un servidor local.

---

## Compatibilidad

| Navegador | Estado |
|-----------|--------|
| Chrome / Edge (escritorio) | ✅ Probado |
| Firefox (escritorio) | Compatible (misma API estándar) |
| Safari (macOS, iOS) | Compatible (misma API estándar) |
| Chrome (Android) | Compatible; el resaltado avanza por oración si el motor de voz no informa de cada palabra |

Pausar cancela el audio y recuerda la palabra; continuar retoma desde ahí. Así el comportamiento es el mismo en todos los navegadores, incluidos los que no implementan bien `speechSynthesis.pause()`.

---

## Estructura del proyecto

```
text-to-voice/
├── index.html          # Estructura e iconos SVG
├── assets/
│   ├── logo.svg        # Logo e icono de pestaña
│   └── logo.png
├── css/
│   └── style.css       # Estilos, temas claro/oscuro, móvil
└── js/
    ├── main.js         # Punto de entrada: interfaz, eventos, atajos
    ├── player.js       # Motor de lectura (Web Speech API)
    ├── reader.js       # Vista de lectura con resaltado
    ├── text.js         # División del texto en oraciones
    ├── voices.js       # Selección y orden de voces
    └── store.js        # Memoria entre visitas (localStorage)
```

| Archivo | Responsabilidad |
|---------|----------------|
| `main.js` | Une los módulos con la interfaz: modos editar/leer, controles, archivos, tema, atajos |
| `player.js` | Lee oración por oración, guarda la posición por palabra, pausa, saltos, cambio de voz y velocidad en caliente |
| `reader.js` | Construye la vista de lectura, resalta palabra y oración, mantiene la palabra a la vista |
| `text.js` | Corta el texto en oraciones sin romper decimales ("3.14"), abreviaturas ("Sr.") ni dominios |
| `voices.js` | Descarta voces en la nube y ordena las locales con Sabina primero |
| `store.js` | Guarda y recupera texto, posición, velocidad, voz y tema |

---

## Privacidad

La aplicación **no hace ninguna petición de red**. Solo se usan voces que el navegador marca como locales; las voces en la nube (Google, Microsoft Online, etc.) se filtran. Si un navegador no tuviera ninguna voz local y solo quedara una en línea, la app lo indica de forma visible.

El texto y la posición de lectura se guardan en el `localStorage` de tu navegador para poder continuar más tarde. No se envían a ningún sitio; **Borrar texto** los elimina.

---

## Licencia

[MIT](LICENSE)
