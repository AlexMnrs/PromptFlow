# PromptFlow

PromptFlow es una PWA de teleprompter pensada para uso movil, especialmente en iPhone. Permite preparar guiones, leer con texto grande, usar la camara como referencia, grabar la toma y activar seguimiento por voz cuando el navegador lo soporte.

**App publicada:** https://alexmnrs.github.io/PromptFlow/

## Estado

La aplicacion esta en estado funcional/MVP. El flujo principal ya esta implementado:

- Crear, editar, duplicar, eliminar, importar y exportar guiones.
- Guardado local automatico en `localStorage`.
- Prompter con modo overlay y modo split.
- Cambio de orden en split: texto/camara o camara/texto.
- Cambio entre camara frontal y trasera cuando el dispositivo lo permite.
- Controles de lectura: play/pausa, reinicio, linea anterior/siguiente, tamano, velocidad, idioma y zoom.
- Camara con vista espejo y zoom por hardware cuando el navegador lo permita; si no, zoom de previsualizacion.
- Cuenta atras antes de grabar, grabacion con `MediaRecorder` y descarga de la toma.
- Revision rapida de la toma grabada con opcion de compartir cuando el navegador lo permite.
- Wake Lock opcional para mantener la pantalla despierta durante lectura o grabacion.
- Seguimiento por voz opcional con fallback manual.
- Manifest y service worker para uso instalable/offline.

## Requisitos y soporte

Camara, microfono, grabacion y reconocimiento de voz requieren contexto seguro. En produccion usa HTTPS. En desarrollo local puedes abrir la app en el equipo; para probar en un iPhone real conviene usar una URL HTTPS, por ejemplo mediante un tunel.

El soporte depende del navegador:

- `getUserMedia` es necesario para camara y microfono.
- `MediaRecorder` es necesario para grabar desde el navegador.
- `SpeechRecognition`/`webkitSpeechRecognition` es necesario para el seguimiento por voz.
- `Wake Lock` y `navigator.share` son opcionales; la app sigue funcionando sin ellos.

Si el seguimiento por voz no esta disponible, la app mantiene controles manuales grandes para avanzar, retroceder y pausar.

La grabacion guarda el stream de camara/microfono. El texto del prompter sirve como guia de lectura en pantalla y no se incrusta automaticamente en el video.

## Desarrollo

Requisitos recomendados:

- Node.js 24, igual que el workflow de CI.
- npm.

Instalacion y servidor local:

```bash
npm install
npm run dev
```

Verificaciones locales:

```bash
npm run lint
npm run build
```

Previsualizacion del build:

```bash
npm run preview
```

## Publicacion

El proyecto usa Vite con `base: './'`, por lo que el build generado en `dist/` es compatible con despliegues en subrutas como GitHub Pages.

El workflow `.github/workflows/ci.yml` ejecuta `npm ci`, `npm run lint` y `npm run build` en cada push o pull request contra `main`.

Para publicar la PWA con GitHub Pages, activa Pages con GitHub Actions o despliega el contenido de `dist/` desde el workflow que prefieras.

## Notas para repositorio publico

- `node_modules/`, `dist/`, `.tools/`, `.env*`, logs y archivos `*.tsbuildinfo` estan ignorados.
- No hay suite de tests automatizados mas alla de lint y build.
- El proyecto se publica bajo licencia MIT.
