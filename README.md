# Maestro Vision

A browser-based hand-controlled techno prototype. This release preserves the neon interface and right-fist bass boost from the version before the alien-ship sound was added.

## Try it

Open the GitHub Pages website, click **Drop the Beat**, and allow camera access. Chrome or Edge is recommended. The first startup warms up the hand-tracking model and can take several seconds.

Video is processed locally in your browser. There is no microphone input, uploaded camera video, API key or AI Studio account requirement.

| Gesture | Control |
|---|---|
| Right fist | Bass boost |
| Wave the selected tempo hand | Tempo |
| Raise/lower the other hand | Filter |
| Hold 1–4 fingers on the filter hand | Melody preset (thumb excluded) |
| Left thumb/index pinch with other fingers extended | Echo |

The tempo hand, tracking quality and audio buffer can be changed using the controls above the camera. If tracking is unavailable, the manual melody buttons, filter slider and playback controls remain available.

## Run locally

Use Node.js 24.16.0 and npm 11.13.0. Dependency versions are locked in package-lock.json.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. To build and serve the production version:

```sh
npm run build
node scripts/serve.mjs
```

Windows users can double-click Start Maestro.cmd after building.

## Checks

```sh
npm run lint
npm test
npm run build
npm run test:browser
```

Browser tests use installed Chrome, a synthetic camera and muted audio. Real-hand recognition accuracy and physical output latency need a live trial.

## GitHub Pages

The deployment workflow builds the site from main, runs TypeScript and gesture checks, and publishes dist using GitHub Actions. In Settings → Pages, choose **GitHub Actions** as the publishing source. Relative asset paths support repository Pages URLs.

The hand-tracking runtime and models are copied from the locked MediaPipe package during install/build and served with the site. No CDN is required at runtime. The worker compatibility fix is validated in scripts/sync-model.mjs and must be reviewed before upgrading MediaPipe.

The original OrchestraEngine and VisionLab are retained reference components; the active screen uses TechnoEngine.

