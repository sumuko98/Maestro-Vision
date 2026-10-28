import http from 'node:http';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const server = http.createServer(async (req, res) => {
  const prefix = '/maestro-vision/';
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (!pathname.startsWith(prefix)) { res.writeHead(404).end(); return; }
  const relative = pathname.slice(prefix.length) || 'index.html';
  const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.wasm':'application/wasm' };
  try {
    const bytes = await readFile(path.join(root, relative));
    res.writeHead(200, { 'Content-Type': types[path.extname(relative)] || 'application/octet-stream' }).end(bytes);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const browser = await chromium.launch({ channel:'chrome', headless:true,
  args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required','--mute-audio'] });
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors = [], failedAssets=[];
  page.on('pageerror', e=>errors.push(e.message));
  page.on('response', response=>{if(response.status()>=400 && !response.url().endsWith('favicon.ico')) failedAssets.push(response.url());});
  await page.goto('http://127.0.0.1:'+address.port+'/maestro-vision/');
  await page.getByRole('heading',{name:'Maestro Techno Prototype',exact:true}).waitFor();
  await page.getByRole('button',{name:'Drop the Beat (Start Prototype)'}).click();
  await page.getByRole('status').filter({hasText:'Camera live'}).waitFor({timeout:45000});
  await page.waitForTimeout(1500);
  await page.getByRole('button',{name:'Turn camera off'}).click();
  await page.getByTitle('Pause Beat').click();
  assert.deepEqual(errors,[]);
  assert.deepEqual(failedAssets,[]);
  await page.screenshot({path:'reports/pages-preview.png',fullPage:true});
  await writeFile('reports/pages-check.json',JSON.stringify({passed:true,errors,failedAssets,checked:'pre-ship version, nested Pages URL, worker/models, camera startup, pause'},null,2));
  console.log('GitHub Pages subpath check passed: previous UI, real tracking worker, local model assets, camera and pause.');
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }

