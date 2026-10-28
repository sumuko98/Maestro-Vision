import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('audio: response, cached buffers, echo, stop and scheduler stall recovery', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('http://127.0.0.1:3000/', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Audio profile</body></html>' }));
  await page.goto('/');
  const report = await page.evaluate(async () => {
    const url = '/src/audio/TechnoEngine.ts';
    const { technoEngine: engine } = await import(url);
    await engine.start();
    const ctx = engine.ctx;
    let allocations = 0;
    const create = ctx.createBuffer.bind(ctx);
    ctx.createBuffer = (...args: any[]) => { allocations++; return create(...args); };
    const starts: { at: number; scheduled: number; preset: number }[] = [];
    const oldStep = engine.scheduleStepAtTime.bind(engine);
    engine.scheduleStepAtTime = (step: number, time: number) => {
      starts.push({ at: ctx.currentTime, scheduled: time, preset: engine.activeMelodyIndex });
      oldStep(step, time);
    };
    await new Promise(resolve => setTimeout(resolve, 1000));
    const changedAt = ctx.currentTime;
    engine.setMelodyPreset(1);
    await new Promise(resolve => setTimeout(resolve, 4000));
    const first = starts.find(s => s.preset === 1);
    engine.setEcho(true);
    await new Promise(resolve => setTimeout(resolve, 150));
    const echoOn = engine.delayGain.gain.value;
    engine.setEcho(false);
    await new Promise(resolve => setTimeout(resolve, 150));
    const echoOff = engine.delayGain.gain.value;
    const dataReused = engine.getAudioFrequencyData() === engine.getAudioFrequencyData();
    const normalSkipped = engine.getDiagnostics().skippedSteps;
    const stallStart = performance.now();
    while (performance.now() - stallStart < 450) { /* deliberate main-thread stall */ }
    const scheduledBeforeRecovery = starts.length;
    await new Promise(resolve => setTimeout(resolve, 150));
    const recovery = starts.slice(scheduledBeforeRecovery);
    const skippedAfterStall = engine.getDiagnostics().skippedSteps;
    engine.stop();
    await new Promise(resolve => setTimeout(resolve, 100));
    const stopped = engine.getDiagnostics();
    await engine.start(); engine.stop();
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      measuredPresetResponseMs: first ? (first.scheduled - changedAt) * 1000 : null,
      noiseBufferAllocationsIn5Seconds: allocations, echoOn, echoOff, dataReused,
      normalSkipped, skippedAfterStall, recoveryAllFuture: recovery.every(s => s.scheduled >= s.at),
      stoppedVoices: stopped.activeVoices, stoppedPlaying: stopped.playing,
      stoppedGain: engine.outputGate.gain.value, lookaheadMs: stopped.lookaheadMs,
      baseLatencyMs: stopped.baseLatencyMs, browser: navigator.userAgent,
      restartVoices: engine.getDiagnostics().activeVoices,
    };
  });
  await writeFile('reports/updated-audio.json', JSON.stringify({ ...report, errors }, null, 2));
  expect(errors).toEqual([]);
  expect(report.noiseBufferAllocationsIn5Seconds).toBe(0);
  expect(report.measuredPresetResponseMs).toBeLessThan(260);
  expect(report.echoOn).toBeGreaterThan(0.55);
  expect(report.echoOff).toBeLessThan(0.35);
  expect(report.dataReused).toBe(true);
  expect(report.skippedAfterStall).toBeGreaterThan(report.normalSkipped);
  expect(report.recoveryAllFuture).toBe(true);
  expect(report.stoppedVoices).toBe(0);
  expect(report.restartVoices).toBe(0);
  expect(report.stoppedPlaying).toBe(false);
  expect(report.stoppedGain).toBeLessThan(0.01);
});

test('real tracker initializes with synthetic camera, controls work and camera stops', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Drop the Beat (Start Prototype)' }).click();
  await expect(page.getByRole('status')).toHaveText('Camera live', { timeout: 45000 });
  await page.waitForTimeout(6000);
  await page.getByLabel('Tempo hand').selectOption('Left');
  await expect(page.getByText('Tempo (Left Hand)', { exact: true })).toBeVisible();
  await page.getByLabel('Audio buffer').selectOption('180');
  await page.getByTitle('Hold up 3 fingers to activate').click();
  const report = await page.evaluate(async () => {
    const metricsUrl = '/src/performance.ts', audioUrl = '/src/audio/TechnoEngine.ts';
    const { measurements } = await import(metricsUrl);
    const { technoEngine } = await import(audioUrl);
    const video = document.querySelector('video')!;
    return { measurements: measurements.snapshot(), audio: technoEngine.getDiagnostics(),
      camera: (video.srcObject as MediaStream).getVideoTracks()[0].getSettings() };
  });
  await writeFile('reports/updated-tracking.json', JSON.stringify({ ...report, errors }, null, 2));
  expect(report.measurements.inferenceMs.samples).toBeGreaterThan(5);
  expect(report.audio.lookaheadMs).toBe(180);
  await page.screenshot({ path: 'reports/updated.png', fullPage: true });
  await page.getByRole('button', { name: 'Turn camera off' }).click();
  await expect(page.getByRole('status')).toHaveText('Camera off');
  expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.srcObject)).toBeNull();
  await page.getByTitle('Pause Beat').click();
  await expect(page.getByTitle('Drop the Beat', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('camera denial is visible and audio remains usable', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Camera permission denied', 'NotAllowedError'); };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Drop the Beat (Start Prototype)' }).click();
  await expect(page.getByRole('alert')).toContainText('Camera permission denied', { timeout: 45000 });
  await page.getByTitle('Pause Beat').click();
  await expect(page.getByTitle('Drop the Beat', { exact: true })).toBeVisible();
});


