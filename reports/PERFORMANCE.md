# Maestro Vision performance and validation

## Measured results

These are single-run development measurements from Chrome on this Windows PC, with synthetic camera input and muted audio. They are not physical hand-to-speaker latency measurements or guarantees for other devices.

| Audio-engine measurement | Original | Updated |
|---|---:|---:|
| Configured scheduling buffer | 350 ms | 100 ms |
| First scheduled note using a new melody | 371.8 ms | 157.8 ms |
| New percussion buffers allocated during a five-second window | 51 | 0 |
| Pause behavior | 3 future steps remained queued | 0 active voices after 100 ms |

The melody metric measures the audio-clock time of the first new-preset note minus the time of the command. Its value also depends on where the command lands in the sixteenth-note cycle. It excludes recognition, deliberate gesture dwell, and speaker latency.

During the updated synthetic-camera run, the audio scheduler interval was 24 ms median / 32 ms p95, with zero missed steps. Inference ran in the worker at 53.2 ms median / 75.7 ms p95; the frame round trip was 55.5 ms median / 76.1 ms p95. The synthetic camera delivered 20 fps at 640×360. These figures establish functionality under this test input; they do not measure recognition accuracy on real hands.

The original full-app camera startup stalled in an automated run, so the baseline audio engine was measured in isolation. Updated audio was also measured in isolation for comparison. A pre-worker diagnostic run showed a long initial inference stall and interrupted audio scheduling; model warm-up and ongoing inference now run outside the main thread.

## Changes and remaining limits

- Frames are spaced from processing start rather than adding 32 ms after completion. Only one frame is in flight; stale frames are not queued.
- Tracking runs in a worker, with locally bundled, locked MediaPipe assets and explicit startup/error states.
- Audio lookahead is selectable (100, 180, 350 ms). Shorter buffers improve responsiveness but tolerate shorter stalls.
- Tempo and filter smoothing use elapsed time. Filter and echo automation still ramp to avoid abrupt changes.
- Melody selection deliberately requires 180 ms of stable input. This dwell adds to audible response time.
- Bass and echo release after hand loss. The watchdog also handles stalled/disconnected tracking.
- Percussion buffers and analyser storage are reused. Finished voices disconnect; pause cancels queued sources and fades the output.
- After a deliberately injected 450 ms main-thread stall, the scheduler skipped overdue steps instead of firing them together. Such a stall can still cause a gap.
- The camera and skeleton use matching mirror coordinates.
- Right-fist bass, four melody presets and the original synth voices are preserved. Pinch echo and tempo-hand selection are added.
- Real hand recognition, gestures at extreme angles/occlusion, sound quality and physical output latency still need your live trial. No real-camera video or microphone input was recorded by the tests.

## Validation completed

- TypeScript check and production build passed.
- Seven gesture regression tests passed.
- Three browser tests passed: audio timing/lifecycle, real tracker with synthetic camera, and camera-permission failure.
- The packaged production server passed startup, MIME, source-file isolation, Fast and Detailed tracking, tempo-hand choice, camera shutdown, pause, and cancellation-during-startup checks.

Raw evidence: baseline.json, updated-audio.json, updated-tracking.json, production-smoke.json.
The double-click launcher uses the same production build tested by scripts/production-smoke.mjs.

## References

The scheduling approach follows [MDN's Web Audio scheduling example](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques).
Handedness conversion follows [MediaPipe's mirrored-input convention](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/hands.md?plain=1).

