import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const base = 'http://127.0.0.1:3000';
assert.equal((await (await fetch(base + '/__maestro_health')).json()).app, 'maestro-vision');
assert.equal((await fetch(base + '/mediapipe/hands_solution_simd_wasm_bin.wasm', { method: 'HEAD' })).headers.get('content-type'), 'application/wasm');
assert.equal((await fetch(base + '/src/components/MaestroConductor.tsx')).status, 404);
const browser = await chromium.launch({ channel:'chrome', headless:true,
  args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required','--mute-audio'] });
try {
  const page = await browser.newPage({ viewport:{width:1440,height:1000} });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  await page.getByRole('button',{name:'Drop the Beat (Start Prototype)'}).click();
  await page.getByRole('status').filter({hasText:'Camera live'}).waitFor({timeout:45000});
  console.log('Production build: Fast tracker and camera are live.');
  await page.waitForTimeout(1500);
  assert.ok(await page.locator('video').evaluate(video=> video.currentTime > 0));
  await page.getByLabel('Tempo hand').selectOption('Left');
  await page.getByText('Tempo (Left Hand)',{exact:true}).waitFor();
  await page.getByLabel('Tracking quality').selectOption('1');
  await page.getByRole('status').filter({hasText:'Camera live'}).waitFor({timeout:45000});
  console.log('Production build: Detailed tracker also initialized.');
  await page.waitForTimeout(1500);
  await page.getByRole('button',{name:'Turn camera off'}).click();
  await page.getByRole('status').filter({hasText:'Camera off'}).waitFor();
  assert.equal(await page.locator('video').evaluate(video=>video.srcObject), null);
  await page.getByTitle('Pause Beat').click();
  await page.getByTitle('Drop the Beat',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Turn camera on'}).click();
  await page.getByRole('button',{name:'Turn camera off'}).click();
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('video').evaluate(video=>video.srcObject), null);
  assert.deepEqual(errors, []);
  await page.screenshot({path:'reports/local-ready.png',fullPage:true});
  await writeFile('reports/production-smoke.json', JSON.stringify({passed:true,
    checks:['local server','WebAssembly MIME','source files not served','Fast tracking','Detailed tracking',
      'tempo hand selection','camera shutdown','pause','cancellation during startup'],
    errors, testedAt:new Date().toISOString()},null,2));
  console.log('Production launcher checks passed.');
} finally { await browser.close(); }

