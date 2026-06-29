# PromptFlow

PromptFlow is a mobile-first teleprompter PWA for recording yourself while reading a script. It combines large readable text, camera preview, browser recording, local script storage, and optional voice-following when the browser supports it.

**Live app:** [alexmnrs.github.io/PromptFlow](https://alexmnrs.github.io/PromptFlow/)

## Screenshots

![PromptFlow script library](docs/images/promptflow-library.png)

![PromptFlow teleprompter view](docs/images/promptflow-prompter.png)

## Why It Exists

Recording a clear take from a phone or laptop is harder than it should be: the script is usually in one place, the camera in another, and rerecording breaks concentration. PromptFlow keeps the script, camera preview, recording controls, and review flow together in one browser-based workspace.

Use it for:

- Short tutorials and product walkthroughs.
- Social video scripts.
- Course intros and lesson recordings.
- Internal updates where reading cleanly matters.
- Rehearsing talks without installing heavy desktop software.

## Status

PromptFlow is a functional MVP. The main reading and recording workflow is implemented, the app is installable as a PWA, and unsupported browser features degrade to manual controls instead of blocking the session.

The project is currently focused on reliability, mobile usability, browser compatibility, and clearer documentation.

## Quick Start

Try the hosted version first:

1. Open [alexmnrs.github.io/PromptFlow](https://alexmnrs.github.io/PromptFlow/).
2. Create or paste a script.
3. Allow camera and microphone access when prompted.
4. Choose overlay or split-screen mode.
5. Start reading, record a take, review it, and download the result.

Run locally:

```bash
npm install
npm run dev
```

Run checks before opening a pull request:

```bash
npm run lint
npm test
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Features

- Create, edit, duplicate, delete, import scripts, export plain text, and export JSON backups.
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

PromptFlow works best in a modern mobile or desktop browser served from a secure context. Use HTTPS in production. For local development, `localhost` works; for testing on a real phone, an HTTPS tunnel is usually the easiest path.

PromptFlow uses progressive enhancement for browser APIs:

| Feature | Browser API | Requirement | Fallback |
| --- | --- | --- | --- |
| Camera and microphone preview | `navigator.mediaDevices.getUserMedia` | HTTPS, `localhost`, or another secure context, plus user permission | The script library and manual prompter still work. If only one device is available, PromptFlow tries to continue with partial media access. |
| In-browser recording | `MediaRecorder` | A supported browser and an active camera or microphone stream | Users can still rehearse and read scripts, but recording and download are unavailable. |
| Voice-following | `SpeechRecognition` or `webkitSpeechRecognition` | Browser support, microphone permission, and a working speech recognition service | Users can move through the script with large manual controls. |
| Keep screen awake | Screen Wake Lock | Browser support and permission from the platform | The app remains usable, but the device may dim or lock according to system settings. |
| Native sharing | `navigator.share` | Browser and platform support, usually triggered from a user action | Users can download the recorded take instead. |

Browser behavior can vary by device, operating system, and installed browser version. When reporting compatibility issues, include the browser, operating system, device, whether the app was served over HTTPS or `localhost`, and which feature was being tested.

Recording captures the camera and microphone stream. The prompter text is used as an on-screen reading guide and is not burned into the exported video.

## Project Roadmap

Near-term improvements:

- Improve mobile layout testing across common viewport sizes.
- Add a lightweight smoke test for the main script and recording workflow.
- Expand browser compatibility notes with tested browser/device combinations.

Later ideas:

- Script templates for common recording formats.
- Better keyboard shortcuts for desktop recording.
- Optional backup bundles for full script collections.
- More polished recording review and retake management.

## Deployment

The project uses Vite with `base: './'`, so the generated `dist/` build works well on subpath deployments such as GitHub Pages.

The CI workflow in `.github/workflows/ci.yml` runs `npm ci`, `npm run lint`, `npm test`, and `npm run build` on every push or pull request targeting `main`.

To publish the PWA with GitHub Pages, enable Pages with GitHub Actions or deploy the contents of `dist/` from the workflow you prefer.

## Public Repository Notes

- `node_modules/`, `dist/`, `.tools/`, `.env*`, logs, and `*.tsbuildinfo` files are ignored.
- The pure prompter helper logic is covered by a small Vitest suite.
- The project is released under the MIT License.
- Security and privacy guidance is documented in [SECURITY.md](SECURITY.md).

## Contributing

Small, focused improvements are welcome. Good first areas include documentation clarity, browser compatibility notes, mobile layout fixes, and lightweight tests around the main user workflow.

Issues labeled `good first issue` or `help wanted` are good places to start.

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, pull request guidelines, and browser testing notes.

Before proposing a change, please run:

```bash
npm run lint
npm test
npm run build
```

## License

[MIT](LICENSE)
