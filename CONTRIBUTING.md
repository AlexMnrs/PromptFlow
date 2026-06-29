# Contributing to PromptFlow

Thanks for considering a contribution to PromptFlow.

PromptFlow is a mobile-first teleprompter PWA. The project values focused changes that make the app easier to use, easier to run, or easier to understand.

## Good First Areas

Useful contribution areas include:

- README clarity and screenshots.
- Browser compatibility notes.
- Mobile layout fixes.
- Accessibility improvements for controls and status messages.
- Lightweight checks around script parsing, prompt navigation, or recording workflow helpers.
- Small UI refinements that keep the main recording flow simple.

## Local Setup

Requirements:

- Node.js 24, matching the current CI workflow.
- npm.

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Preview a production build locally:

```bash
npm run preview
```

## Checks Before Opening a PR

Run these commands before proposing a change:

```bash
npm run lint
npm test
npm run build
```

The pure prompter helper logic has focused unit tests. If your change affects browser APIs such as camera, microphone, recording, wake lock, sharing, or speech recognition, include the browsers and devices you tested manually.

If your change affects privacy-sensitive behavior, also read [SECURITY.md](SECURITY.md) before opening a PR.

## Pull Request Guidelines

Please keep pull requests small and easy to review.

A good PR description should include:

- What changed.
- Why the change helps.
- How you verified it.
- Any browser or device limitations you noticed.

For UI changes, screenshots or a short GIF are very helpful.

## Browser Feature Notes

PromptFlow relies on browser APIs that vary by browser and device:

- `getUserMedia` for camera and microphone access.
- `MediaRecorder` for in-browser recording.
- `SpeechRecognition` or `webkitSpeechRecognition` for voice-following.
- Wake Lock and native sharing as optional enhancements.

Changes should keep graceful fallbacks intact when a browser does not support one of these APIs.
