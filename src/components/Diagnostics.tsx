import { useEffect, useState } from 'react';
import { measurements } from '../performance';
import { technoEngine } from '../audio/TechnoEngine';

export default function Diagnostics() {
  const [snapshot, setSnapshot] = useState(measurements.snapshot());
  const [audio, setAudio] = useState(technoEngine.getDiagnostics());
  useEffect(() => {
    const timer = window.setInterval(() => {
      setSnapshot(measurements.snapshot());
      setAudio(technoEngine.getDiagnostics());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  const ms = (key: string) => snapshot[key] ? snapshot[key].p95.toFixed(1) + ' ms' : '—';
  return <details className="relative z-30 mt-3 px-4 py-2 max-w-6xl w-full text-xs text-zinc-400">
    <summary className="cursor-pointer">Performance · tracker {ms('inferenceMs')} · missed steps {audio.skippedSteps}</summary>
    <div className="flex flex-wrap gap-4 py-3">
      <span>Tracking interval p95: {ms('trackingIntervalMs')}</span>
      <span>Gesture processing p95: {ms('gestureControlMs')}</span>
      <span>Canvas draw p95: {ms('renderMs')}</span>
      <span>Audio timer p95: {ms('schedulerIntervalMs')}</span>
      <span>Browser audio latency: {audio.baseLatencyMs?.toFixed(1) ?? '—'} ms</span>
      <button className="underline text-cyan-300" onClick={() => {
        const blob = new Blob([JSON.stringify({ recordedAt: new Date().toISOString(),
          userAgent: navigator.userAgent, measurements: snapshot, audio }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = 'maestro-performance.json'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>Save performance report</button>
    </div>
    <p>Timings cover the latest 300 samples. These are software timings, not total hand-to-speaker latency. A larger audio buffer may help if missed steps increase.</p>
  </details>;
}

