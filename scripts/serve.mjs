import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const port = Number(process.env.PORT || 3000);
const url = 'http://127.0.0.1:' + port;
const openBrowser = () => {
  if (process.platform === 'win32') {
    const child = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { detached: true, windowsHide: true, stdio: 'ignore' });
    child.on('error', () => console.log('Open ' + url + ' in Chrome or Edge.'));
    child.unref();
  }
};
try { await stat(path.join(root, 'index.html')); }
catch { console.error('The built app is missing. Run npm.cmd ci and npm.cmd run build first.'); process.exit(1); }
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.wasm':'application/wasm', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon' };
const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  if (req.url === '/__maestro_health') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ app: 'maestro-vision', version: '0.1.0' }));
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, url).pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) {
      res.writeHead(403).end(); return;
    }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404).end('Not found'); }
});
server.on('error', async error => {
  if (error.code === 'EADDRINUSE') {
    try {
      const response = await fetch(url + '/__maestro_health');
      if ((await response.json()).app === 'maestro-vision') {
        console.log('Maestro Vision is already running at ' + url);
        if (process.argv.includes('--open')) openBrowser();
        process.exit(0);
      }
    } catch {}
    console.error('Port ' + port + ' is in use. Close the other local server and try again.');
  } else console.error(error.message);
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => {
  console.log('Maestro Vision is ready: ' + url);
  console.log('Keep this window open. Press Ctrl+C to stop.');
  if (process.argv.includes('--open')) openBrowser();
});


