/* Classic worker: MediaPipe's pinned runtime uses importScripts internally. */
const nativeImportScripts = self.importScripts.bind(self);
// The legacy worker loader includes model data in its script list.
// Models are fetched by setOptions; only JavaScript belongs in importScripts.
self.importScripts = (...urls) => nativeImportScripts(...urls.filter(url => new URL(url, self.location.href).pathname.endsWith('.js')));
self.createMediapipeSolutionsPackedAssets = {
  locateFile: file => new URL('./mediapipe/' + file, self.location.href).href,
};
importScripts('./mediapipe/hands.js');
let hands;
let canvas;
let context;
let ready = false;
let processing = false;
let currentResults = {};
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      hands = new self.Hands({ locateFile: file => new URL('./mediapipe/' + file, self.location.href).href });
      hands.setOptions(data.options);
      hands.onResults(results => {
        currentResults = {
          multiHandLandmarks: results.multiHandLandmarks,
          multiHandWorldLandmarks: results.multiHandWorldLandmarks,
          multiHandedness: results.multiHandedness,
        };
      });
      await hands.initialize();
      canvas = new OffscreenCanvas(640, 360);
      context = canvas.getContext('2d');
      context.fillRect(0, 0, 640, 360);
      // Warm up shaders and the graph before exposing live results.
      await hands.send({ image: canvas });
      ready = true;
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'frame') {
      if (!ready || processing) { data.bitmap.close(); return; }
      processing = true;
      const started = performance.now();
      try {
        context.drawImage(data.bitmap, 0, 0, 640, 360);
        data.bitmap.close();
        await hands.send({ image: canvas });
        self.postMessage({ type: 'results', results: currentResults, inferenceMs: performance.now() - started });
      } finally { processing = false; }
    }
  } catch (error) { console.error(error.stack);
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};


