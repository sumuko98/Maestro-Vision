import { useRef, useEffect, useState } from 'react';
import type { Results } from '@mediapipe/hands';
import { measurements } from '../performance';

export interface HandsOptions {
  maxNumHands?: number; modelComplexity?: 0 | 1;
  minDetectionConfidence?: number; minTrackingConfidence?: number; selfieMode?: boolean;
}
export interface HandTrackingHookProps {
  onResults: (results: Results) => void; options?: HandsOptions; enabled?: boolean;
}
export const useHandTracking = ({ onResults, options = {}, enabled = true }: HandTrackingHookProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const callback = useRef(onResults);
  callback.current = onResults;
  const [status, setStatus] = useState('Camera off');
  const [error, setError] = useState<string | null>(null);
  const { maxNumHands = 2, modelComplexity = 0, minDetectionConfidence = 0.6,
    minTrackingConfidence = 0.6, selfieMode = false } = options;
  useEffect(() => {
    if (!enabled) { setStatus('Camera off'); setError(null); return; }
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    let failed = false;
    let frame = 0;
    let stream: MediaStream | null = null;
    let worker: Worker | null = null;
    let processing = false;
    let lastStart = -Infinity;
    let lastVideoTime = -1;
    let lastResult = 0;
    let sentAt = 0;
    let startupTimer = 0;
    let frameTimer = 0;
    let rejectReady: ((error: Error) => void) | undefined;
    const stopStream = () => {
      stream?.getTracks().forEach(track => track.stop());
      if (video.srcObject === stream) video.srcObject = null;
    };
    const reportError = (err: unknown) => {
      if (cancelled || failed) return;
      failed = true;
      const message = err instanceof Error ? err.message : String(err);
      setError(message); setStatus('Camera unavailable');
      cancelAnimationFrame(frame);
      clearTimeout(startupTimer); clearTimeout(frameTimer);
      rejectReady?.(new Error(message));
      worker?.terminate();
      stopStream();
    };
    const tick = async (now: number) => {
      if (cancelled || failed) return;
      if (!processing && !document.hidden && video.readyState >= 2 &&
          video.currentTime !== lastVideoTime && now - lastStart >= 1000 / 30 - 1) {
        processing = true;
        lastStart = now;
        lastVideoTime = video.currentTime;
        sentAt = performance.now();
        try {
          const bitmap = await createImageBitmap(video);
          if (cancelled || failed) { bitmap.close(); return; }
          worker!.postMessage({ type: 'frame', bitmap }, [bitmap]);
          frameTimer = window.setTimeout(() => reportError(new Error('Tracking stopped responding. Toggle the camera to retry.')), 10000);
        } catch (err) { processing = false; reportError(err); return; }
      }
      if (!cancelled && !failed) frame = requestAnimationFrame(tick);
    };
    const setup = async () => {
      setError(null); setStatus('Loading hand tracker…');
      try {
        worker = new Worker(import.meta.env.BASE_URL + 'hand-tracker.js');
        const ready = new Promise<void>((resolve, reject) => {
          rejectReady = reject;
          worker!.onerror = event => reportError(new Error(event.message || 'Hand tracker failed to start'));
          worker!.onmessage = ({ data }) => {
            if (cancelled || failed) return;
            if (data.type === 'ready') {
              clearTimeout(startupTimer); resolve();
            } else if (data.type === 'error') {
              reportError(new Error(data.message));
            } else if (data.type === 'results') {
              clearTimeout(frameTimer);
              processing = false;
              const now = performance.now();
              measurements.record('inferenceMs', data.inferenceMs);
              measurements.record('trackingRoundTripMs', now - sentAt);
              if (lastResult) measurements.record('trackingIntervalMs', now - lastResult);
              lastResult = now;
              callback.current({ ...data.results, image: video });
            }
          };
          startupTimer = window.setTimeout(() => reportError(new Error('Hand tracker startup timed out. Toggle the camera to retry.')), 45000);
        });
        worker.postMessage({ type: 'init', options: { maxNumHands, modelComplexity,
          minDetectionConfidence, minTrackingConfidence, selfieMode } });
        await ready;
        if (cancelled || failed) return;
        setStatus('Waiting for camera permission…');
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
          width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 30, max: 30 }, facingMode: 'user',
        } });
        if (cancelled || failed) { stopStream(); return; }
        stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => reportError(new Error('Camera disconnected. Toggle the camera to retry.'))));
        video.srcObject = stream;
        await video.play();
        if (cancelled || failed) { stopStream(); return; }
        setStatus('Camera live');
        frame = requestAnimationFrame(tick);
      } catch (err) { reportError(err); }
    };
    void setup();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame); clearTimeout(startupTimer); clearTimeout(frameTimer);
      rejectReady?.(new Error('Camera stopped'));
      worker?.terminate();
      stopStream();
    };
  }, [enabled, maxNumHands, modelComplexity, minDetectionConfidence, minTrackingConfidence, selfieMode]);
  return { videoRef, status, error };
};

