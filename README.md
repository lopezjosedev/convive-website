# CONVIVE — Sitio web institucional

Sitio de una sola página construido con **HTML5, CSS moderno y JavaScript ES6 puro** (sin
frameworks, sin WordPress, sin build tools). Pensado para producción: rápido, accesible,
responsive y fácil de mantener.

## Cómo abrirlo

No necesita servidor ni instalación: abrí `index.html` directamente en el navegador con doble
clic, o servilo con cualquier servidor estático si preferís probarlo por `http://`.

## Actualizar el sitio ya publicado (evitar problemas de caché)

Hostinger sirve `assets/css/*`, `assets/js/*` y `assets/img/*` con `Cache-Control: max-age=604800`
(7 días). El HTML no se cachea, pero esos archivos sí — así que si volvés a subir un CSS/JS/logo
con el mismo nombre, los navegadores de quienes ya visitaron el sitio van a seguir usando la
copia vieja guardada en su caché hasta que expire, aunque el servidor ya tenga el archivo nuevo.

Por eso todos los `<link>`/`<script>`/`<img>` que apuntan a `assets/` en `index.html` llevan un
parámetro `?v=2` al final. **Cada vez que edites un CSS, JS o el logo y vuelvas a subir el
proyecto, subí el número** (`?v=2` → `?v=3`, etc.) en todas las referencias de `index.html` —
eso le indica al navegador que es un recurso distinto y lo vuelve a descargar sin importar la
caché. Sin este paso, es normal que un cambio "no se vea" en producción aunque el archivo en el
servidor ya esté actualizado.

## Estructura del proyecto

```
CONVIVE/
├── index.html            → Toda la página (semántico, un único archivo de marcado)
├── robots.txt             → Directivas para crawlers
├── sitemap.xml            → Sitemap básico
├── tools/
│   └── logo-trace/        → Utilidad interna que vectorizó el logo oficial (ver más abajo)
└── assets/
    ├── css/
    │   ├── variables.css   → Tokens de diseño (color, tipografía, espaciado, sombras, radios)
    │   ├── reset.css        → Reset mínimo moderno
    │   ├── base.css         → Tipografía base, utilidades globales (.container, .section, etc.)
    │   ├── layout.css       → Navbar, menú móvil, footer
    │   ├── components.css   → Botones, cards, badges, formularios, accordion
    │   ├── animations.css   → Keyframes, scroll-reveal, microinteracciones
    │   └── sections.css     → Estilos específicos de cada sección de la página
    ├── js/
    │   ├── navbar.js        → Navbar transparente → sólida al scrollear + menú móvil
    │   ├── reveal.js        → Scroll-reveal genérico vía IntersectionObserver ([data-reveal])
    │   ├── counters.js      → Contadores animados ([data-counter])
    │   ├── flow.js          → Animación del diagrama "Cómo funciona"
    │   ├── accordion.js     → Acordeón de preguntas frecuentes
    │   ├── form.js          → Validación y envío (simulado) del formulario de demo
    │   └── main.js          → Punto de entrada, se carga al final
    ├── img/
    │   ├── logo-convive.svg       → Logo oficial a color (vector), para fondos claros (navbar, menú móvil)
    │   ├── logo-convive-white.svg → Logo oficial en blanco (vector), para el footer (fondo oscuro)
    │   ├── logo-icon.svg          → Isotipo ("ojo") en vector, usado como favicon
    │   ├── og-cover.png           → Imagen de vista previa para redes sociales
    │   └── icons/                → Carpeta reservada para íconos adicionales en archivo suelto
    └── fonts/               → Carpeta lista para alojar tipografías propias (ver abajo)
```

### Por qué el marcado y el JS no usan módulos ES6 (`import`/`export`)

El sitio usa sintaxis moderna (arrow functions, `const`/`let`, clases, template literals,
`IntersectionObserver`, etc.) pero cada archivo se carga como script clásico con `defer`, en vez
de `type="module"`. Así el archivo `index.html` funciona abriéndolo directamente desde el
explorador de archivos (`file://`), sin depender de un servidor local — algo que rompería con
módulos ES6 nativos por la política CORS de los navegadores.

### Tipografía

Se usa un stack de fuentes de sistema (San Francisco / Segoe UI Variable / Roboto según el SO)
en vez de una fuente descargada. Esto elimina el parpadeo de carga de fuentes (FOUT/FOIT) y
requests externos, ayudando directamente al puntaje de PageSpeed. Si más adelante querés una
tipografía de marca (por ejemplo Inter o Manrope):

1. Descargá los archivos `.woff2` de la fuente elegida.
2. Colocalos en `assets/fonts/`.
3. Agregá las reglas `@font-face` correspondientes al inicio de `assets/css/variables.css` y
   sumá el nombre de la fuente al principio de `--font-sans` / `--font-display`.

### Íconos e ilustraciones

Todos los íconos son SVG propios (sin librerías externas), definidos como `<symbol>` dentro de
un sprite oculto al principio de `<body>` en `index.html`, y reutilizados en todo el sitio con
`<svg><use href="#icon-nombre"/></svg>`. Para agregar un ícono nuevo: sumá un `<symbol>` al
sprite y reusalo donde haga falta — no se repite código SVG.

La ilustración del dashboard en el Hero también es un SVG hecho a mano (sin imágenes rasterizadas),
lo que la hace liviana y fácil de animar con CSS.

### Logo oficial

El isotipo/wordmark de CONVIVE es el logo oficial provisto por el cliente (un JPEG con fondo
blanco). Se vectorizó a SVG con una herramienta de trazado de contornos propia (ver
`tools/logo-trace/`) que traza matemáticamente las formas reales del archivo original — no es un
redibujo manual — preservando proporciones, curvas, espaciado y los colores exactos medidos del
archivo fuente (navy `#084878`, teal `#18A8A0`):

- `logo-convive.svg` — color completo, usado en navbar y menú móvil (fondos claros).
- `logo-convive-white.svg` — versión monocromática blanca, usada en el footer (fondo oscuro),
  ya que el wordmark navy sobre un fondo casi negro perdía legibilidad.
- `logo-icon.svg` — solo el isotipo del "ojo" (sin el wordmark), usado como favicon.

Al ser vectores vale la pena preferirlos siempre sobre un raster: se ven nítidos a cualquier
tamaño (retina incluido) y pesan una fracción de lo que pesaría el equivalente en PNG. Si el
cliente en algún momento provee el archivo fuente en un formato vectorial nativo (AI/EPS/SVG),
se puede reemplazar esto por esa versión directamente.

### Contenido

Todo el contenido (historia de Equipo ABA, metodología SOCI, los cinco módulos del ecosistema,
las métricas de resultados y los insights de datos) proviene de la presentación institucional
provista. Las preguntas frecuentes fueron redactadas para completar la experiencia y pueden
ajustarse libremente en `index.html` (sección `#faq`).

### Formulario de demostración

El formulario (`#demo-form`) valida los campos en el cliente y simula el envío
(`assets/js/form.js`, función `submitDemoRequest`). Para producción, reemplazá esa función por
la integración real: un `fetch` a un backend propio, un servicio de formularios, o tu CRM.

## Rendimiento y SEO

- Cero dependencias externas (sin CDNs, sin fuentes de Google, sin frameworks CSS/JS).
- CSS y JS modularizados en archivos pequeños y cacheables.
- Imágenes e íconos en SVG (livianos, nítidos en cualquier resolución).
- HTML semántico (`header`, `nav`, `main`, `section`, `footer`), un solo `<h1>`, jerarquía de
  encabezados consistente.
- Metadatos completos: `description`, Open Graph, Twitter Card, `canonical`, datos estructurados
  JSON-LD (`Organization` y `SoftwareApplication`).
- `robots.txt` y `sitemap.xml` incluidos.
- Animaciones desactivadas automáticamente si el usuario tiene activado
  "reducir movimiento" (`prefers-reduced-motion`).

## Antes de publicar

- Reemplazar los dominios de ejemplo (`convive.edu.ar`, links de LinkedIn/Instagram/WhatsApp,
  email de contacto) por los reales.
- Conectar el formulario de demo a un backend o servicio de envío real.
- Si el cliente provee el logo en un formato vectorial nativo (AI/EPS/SVG), reemplazar los SVG
  en `assets/img/` (ver sección "Logo oficial" más arriba) por esa versión.
