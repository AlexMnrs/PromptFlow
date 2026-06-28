# Security Policy

PromptFlow runs entirely in the browser and uses local browser APIs for camera, microphone, recording, local storage, wake lock, sharing, and optional speech recognition.

The project should preserve a privacy-first model:

- Scripts are stored locally in the browser unless a user exports or shares them.
- Recording happens through browser APIs on the user's device.
- The app should not introduce server-side storage for scripts, recordings, camera streams, or microphone streams without a clear design discussion first.
- Changes that affect permissions, recording, local storage, or exported files should be reviewed carefully.

## Supported Versions

PromptFlow is currently a functional MVP. Security and privacy reports should target the `main` branch unless a release process is added later.

## Reporting a Security Issue

Please do not include sensitive personal data, private scripts, recordings, access tokens, or exploitable details in a public issue.

If GitHub private vulnerability reporting is available for this repository, use that first. If it is not available, open a minimal public issue that says you want to report a security or privacy issue privately, without posting reproduction details.

Useful report details include:

- Browser and device.
- Affected feature, such as camera, microphone, recording, local storage, sharing, or speech recognition.
- Whether the issue requires user interaction.
- Whether private script text, audio, video, or local files could be exposed.
- The smallest safe reproduction steps you can share.

## Security Expectations for Contributors

Before proposing changes that affect sensitive browser APIs:

- Keep browser permission prompts user-initiated and explainable.
- Avoid sending scripts, recordings, camera streams, or microphone streams to external services.
- Keep graceful fallbacks when a browser denies or lacks a feature.
- Avoid logging private script text, media stream details, or generated recording data.
- Document any new storage, export, sharing, or permission behavior in the README or pull request.
