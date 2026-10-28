import { mkdir, readdir, copyFile } from 'node:fs/promises';
const source = new URL('../node_modules/@mediapipe/hands/', import.meta.url);
const target = new URL('../public/mediapipe/', import.meta.url);
await mkdir(target, { recursive: true });
for (const file of await readdir(source)) {
  if (/\.(wasm|data|binarypb|tflite)$/.test(file) || (file.startsWith('hands_solution') || file === 'hands.js')) {
    await copyFile(new URL(file, source), new URL(file, target));
  }
}
console.log('Local hand-tracking assets ready.');

const { readFile, writeFile } = await import('node:fs/promises');
const runtime = new URL('hands.js', target);
const original = await readFile(runtime, 'utf8');
const workerContext = 'a.i.GL.makeContextCurrent(g);';
if (!original.includes(workerContext)) throw new Error('MediaPipe worker patch needs review after runtime upgrade.');
await writeFile(runtime, original.replace(workerContext,
  workerContext + 'a.K=a.m.getContext("webgl2")||a.m.getContext("webgl");'));
