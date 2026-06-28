# PromptFlow

PromptFlow is a mobile-first teleprompter PWA for recording yourself while reading a script. It combines large readable text, camera preview, browser recording, and optional voice-following when the browser supports it.

**Live app:** [alexmnrs.github.io/PromptFlow](https://alexmnrs.github.io/PromptFlow/)

## Status

PromptFlow is currently a functional MVP. The main recording and reading workflow is already implemented, with graceful fallbacks for browser features that are not available everywhere.

## Features

- Create, edit, duplicate, delete, import, and export scripts.
- Automatic local saving with `localStorage`.
- Teleprompter view with overlay and split-screen layouts.
- Switch split-screen order between script-first and camera-first.
- Switch between front and rear cameras when the device allows it.
- Reading controls for play/pause, restart, previous/next line, font size, speed, language, and zoom.
- Mirrored camera preview and hardware zoom when supported, with preview zoom as a fallback.
- Recording countdown, in-browser recording with `MediaRecorder`, and local download.
- Quick review of the recorded take, plus native sharing when supported.
- Optional Wake Lock to keep the screen awake while reading or recording.
- Optional voice-following with large manual controls as a fallback.
- Installable/offline PWA support through the manifest and service worker.

## Browser Support

Camera, microphone, recording, and speech recognition require a secure context. Use HTTPS in production. For local development, `localhost` works; for testing on a real iPhone, an HTTPS tunnel is usually the easiest path.

PromptFlow uses these browser APIs:

- `getUserMedia` for camera and microphone access.
- `MediaRecorder` for recording in the browser.
- `SpeechRecognition` or `webkitSpeechRecognition` for voice-following.
- Wake Lock and `navigator.share` as optional enhancements.

If voice-following is not supported, the app still provides large manual controls to move through the script.

Recording captures the camera and microphone stream. The prompter text is used as an on-screen reading guide and is not burned into the exported video.

## Getting Started

Recommended requirements:

- Node.js 24, matching the CI workflow.
- npm.

Install dependencies and start the local development server:

```bash
npm install
npm run dev
```

Run local checks:

```bash
npm run lint
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Deployment

The project uses Vite with `base: './'`, so the generated `dist/` build works well on subpath deployments such as GitHub Pages.

The CI workflow in `.github/workflows/ci.yml` runs `npm ci`, `npm run lint`, and `npm run build` on every push or pull request targeting `main`.

To publish the PWA with GitHub Pages, enable Pages with GitHub Actions or deploy the contents of `dist/` from the workflow you prefer.

## Public Repository Notes

- `node_modules/`, `dist/`, `.tools/`, `.env*`, logs, and `*.tsbuildinfo` files are ignored.
- There is no automated test suite beyond linting and production builds.
- The project is released under the MIT License.

## License

[MIT](LICENSE)

<p align="center">Made with ❤️</p>
