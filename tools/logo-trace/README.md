# Logo tracer

Herramienta interna (no forma parte del sitio publicado) usada para convertir el logo oficial
de CONVIVE — provisto como JPEG con fondo blanco — a SVG vectorial fiel al original.

No usa librerías de terceros: implementa su propio trazado de contornos (boundary tracing sobre
una máscara binaria por color, simplificación con Douglas-Peucker y suavizado con el algoritmo de
Chaikin) en C#, compilado al vuelo con `Add-Type` de PowerShell.

## Cómo funciona

1. Clasifica cada píxel del JPEG original como fondo / navy / teal (por distancia de color a los
   tres tonos de referencia, medidos directamente del archivo fuente).
2. Traza los contornos (bordes entre clases) de cada color como loops cerrados.
3. Descarta loops microscópicos (ruido de compresión JPEG).
4. Simplifica cada contorno y lo suaviza con Chaikin para obtener curvas limpias.
5. Agrupa los loops por proximidad en X para separar automáticamente el wordmark del isotipo
   (el "ojo"), y exporta tres archivos: `logo-convive.svg`, `logo-convive-white.svg` (monocromático,
   para el footer oscuro) y `logo-icon.svg` (solo el isotipo, para el favicon).

## Re-ejecutar

```
powershell -ExecutionPolicy Bypass -File run-trace.ps1
```

Los colores de referencia (navy `#084878`, teal `#18A8A0`) están hardcodeados en
`LogoTracer.cs` (método `Run`) — se midieron por histograma de color sobre el JPEG original.
Si el cliente provee una versión distinta del logo, puede ser necesario volver a medir esos
valores.
