import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('http://127.0.0.1:3001/', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Audio baseline</body></html>' }));
  await page.goto('http://127.0.0.1:3001');
  const report = await page.evaluate(async () => {
    const { technoEngine: engine } = await import('/src/audio/TechnoEngine.ts');
    await engine.start();
    const ctx = engine.ctx;
    let allocations = 0;
    const create = ctx.createBuffer.bind(ctx);
    ctx.createBuffer = (...args) => { allocations++; return create(...args); };
    const starts = [], oldStep = engine.scheduleStepAtTime.bind(engine);
    engine.scheduleStepAtTime = (step, time) => { starts.push({ at: ctx.currentTime, scheduled: time, preset: engine.activeMelodyIndex }); oldStep(step, time); };
    await new Promise(resolve => setTimeout(resolve, 1000));
    const changedAt = ctx.currentTime;
    engine.setMelodyPreset(1);
    await new Promise(resolve => setTimeout(resolve, 4000));
    const first = starts.find(s => s.preset === 1);
    const beforeStop = ctx.currentTime;
    const queuedAfterStop = starts.filter(s => s.scheduled > beforeStop).length;
    engine.stop();
    return { lookaheadMs: engine.scheduleAheadTime * 1000, measuredPresetResponseMs: first ? (first.scheduled - changedAt) * 1000 : null,
      noiseBufferAllocationsIn5Seconds: allocations, queuedStepsAtStop: queuedAfterStop,
      scheduledSteps: starts.length, baseLatencyMs: ctx.baseLatency * 1000, browser: navigator.userAgent };
  });
  await writeFile('reports/baseline.json', JSON.stringify({ ...report, errors }, null, 2));
  console.log(JSON.stringify({ ...report, errors }, null, 2));
} finally { await browser.close(); }

