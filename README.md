# PromptFlow

PromptFlow es una PWA de teleprompter pensada para iPhone. Permite preparar guiones, leer con texto grande, usar la camara como referencia, grabar la toma y activar seguimiento por voz cuando el navegador lo soporte.

## Funciones

- Biblioteca local de guiones con crear, duplicar, eliminar, importar y exportar texto.
- Editor con autoguardado en `localStorage` y estimacion de duracion.
- Prompter con modo overlay y modo split.
- Cambio rapido de orden en split: texto/camara o camara/texto.
- Cambio entre camara frontal y trasera cuando el dispositivo lo permite.
- Controles de lectura: play/pausa, reinicio, linea anterior/siguiente, tamano, velocidad, idioma y zoom.
- Camara con vista espejo y zoom por hardware cuando el navegador lo permita; si no, zoom de previsualizacion.
- Cuenta atras antes de grabar, grabacion con `MediaRecorder` y descarga de la toma.
- Revision rapida de la toma grabada con opcion de compartir cuando el navegador lo permite.
- Wake Lock opcional para mantener la pantalla despierta durante lectura o grabacion.
- Seguimiento por voz opcional con fallback manual.
- Manifest y service worker para uso instalable/offline.

## Requisitos de iPhone

Camara, microfono, grabacion y reconocimiento de voz requieren contexto seguro. En produccion usa HTTPS. En desarrollo local, abre la app desde el equipo o mediante un tunel HTTPS si pruebas en el iPhone real.

El soporte de voz depende del navegador. Si `SpeechRecognition` no esta disponible, la app mantiene controles manuales grandes para avanzar, retroceder y pausar.

La grabacion guarda el stream de camara/microfono. El texto del prompter sirve como guia de lectura en pantalla.

## Desarrollo

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## GitHub

El workflow `.github/workflows/ci.yml` verifica lint y build en cada push a `main`.

Para publicar la PWA con GitHub Pages, el repositorio debe admitir Pages. En repositorios privados puede requerir un plan compatible; en un repositorio publico se puede activar Pages con GitHub Actions y publicar `dist/`.
