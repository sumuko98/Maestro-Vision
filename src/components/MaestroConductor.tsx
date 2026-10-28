/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Results, HAND_CONNECTIONS } from '@mediapipe/hands';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { useHandTracking } from '../hooks/useHandTracking';
import { Disc3, Volume2, Gauge, Play, Pause, Zap, Flame, Radio, Activity, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GestureController, countExtendedFingers, physicalHand, Hand, Observation } from '../gestures/GestureController';
import { measurements } from '../performance';
import Diagnostics from './Diagnostics';
import { technoEngine, MELODY_PRESETS, MelodyPresetInfo } from '../audio/TechnoEngine';

const MaestroConductor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // UI display updates are throttled separately from music controls.
  const [isPlaying, setIsPlaying] = useState(false);
  const [displayBPM, setDisplayBPM] = useState(130);
  const [displayFilterPct, setDisplayFilterPct] = useState(85);
  const [isBassBoosted, setIsBassBoosted] = useState(false);
  const [activeMelody, setActiveMelody] = useState<MelodyPresetInfo>(MELODY_PRESETS[0]);
  const [melodyToast, setMelodyToast] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(true);

  const [trackingQuality, setTrackingQuality] = useState<0 | 1>(0);
  const [tempoHand, setTempoHand] = useState<Hand>('Right');
  const [echoActive, setEchoActive] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [bufferMs, setBufferMs] = useState(100);
  const controller = useRef(new GestureController());
  const latestResultsRef = useRef<Results | null>(null);
  const lastResultTime = useRef(0);
  const isPlayingRef = useRef(false);
  const playPending = useRef(false);
  const isBassBoostedRef = useRef(false);
  const currentTempoRef = useRef(1);
  const currentDynamicsRef = useRef(0.85);
  const activePresetIndexRef = useRef(0);
  const toastTimeoutRef = useRef<number | null>(null);
  const lastUiThrottleTime = useRef(0);
  const lastEcho = useRef(false);

  const applyControls = useCallback((observations: Observation[], now: number) => {
    const started = performance.now();
    const controls = controller.current.update(observations, now);
    currentTempoRef.current = controls.tempo;
    currentDynamicsRef.current = controls.dynamics;
    technoEngine.setTempo(controls.tempo);
    technoEngine.setDynamics(controls.dynamics);
    if (controls.bass !== isBassBoostedRef.current) {
      isBassBoostedRef.current = controls.bass;
      technoEngine.setBassBoost(controls.bass);
    }
    if (controls.echo !== lastEcho.current) {
      lastEcho.current = controls.echo;
      technoEngine.setEcho(controls.echo);
    }
    if (controls.preset !== activePresetIndexRef.current) {
      activePresetIndexRef.current = controls.preset;
      technoEngine.setMelodyPreset(controls.preset);
      const preset = MELODY_PRESETS[controls.preset];
      setActiveMelody(preset);
      setMelodyToast(preset.name);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = window.setTimeout(() => setMelodyToast(null), 2400);
    }
    if (now - lastUiThrottleTime.current > 95) {
      lastUiThrottleTime.current = now;
      setDisplayBPM(Math.round(130 * controls.tempo));
      setDisplayFilterPct(Math.round(controls.dynamics * 100));
      setIsBassBoosted(controls.bass);
      setEchoActive(controls.echo);
    }
    measurements.record('gestureControlMs', performance.now() - started);
  }, []);

  const onResults = useCallback((results: Results) => {
    latestResultsRef.current = results;
    lastResultTime.current = performance.now();
    const observations: Observation[] = [];
    (results.multiHandLandmarks ?? []).forEach((landmarks, i) => {
      const handedness = results.multiHandedness?.[i];
      if (handedness && handedness.score >= 0.6) {
        observations.push({ landmarks, hand: physicalHand(handedness.label) });
      }
    });
    applyControls(observations, lastResultTime.current);
  }, [applyControls]);

  const { videoRef, status, error } = useHandTracking({ onResults, enabled: cameraEnabled, options: { modelComplexity: trackingQuality } });

  useEffect(() => {
    const watchdog = window.setInterval(() => {
      if (performance.now() - lastResultTime.current > 200) {
        latestResultsRef.current = null;
        applyControls([], performance.now());
      }
    }, 50);
    return () => {
      clearInterval(watchdog);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      technoEngine.stop();
    };
  }, [applyControls]);

  // Dedicated 60 FPS RequestAnimationFrame Render Loop
  // Keeps canvas animations and video silky-smooth independent of React or MediaPipe
  useEffect(() => {
    let animId: number;
    let lastRender = 0;

    const renderFrame = () => {
      const renderStarted = performance.now();
      if (lastRender) measurements.record('renderIntervalMs', renderStarted - lastRender);
      lastRender = renderStarted;
      const canvas = canvasRef.current;
      const results = latestResultsRef.current;

      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // 1. Draw Mirrored Camera Feed with Dark Rave Overlay
          if (videoRef.current && videoRef.current.readyState >= 2) {
            ctx.save();
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.globalAlpha = 0.35;
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            ctx.restore();
          }

          // 2. Draw Real-time Techno Audio Waveforms
          const freqData = isPlayingRef.current ? technoEngine.getAudioFrequencyData() : null;
          if (freqData && isPlayingRef.current) {
            const numBars = 48;
            const barWidth = canvas.width / numBars;
            const centerY = canvas.height * 0.82;
            const isBoosted = isBassBoostedRef.current;

            for (let i = 0; i < numBars; i++) {
              const val = freqData[i * 2] || 0;
              const barHeight = (val / 255) * 125;
              const x = i * barWidth;

              const grad = ctx.createLinearGradient(0, centerY - barHeight, 0, centerY + barHeight);
              if (isBoosted && i < 16) {
                // Neon Red / Crimson for Heavy Sub-Bass
                grad.addColorStop(0, 'rgba(239, 68, 68, 0.95)');
                grad.addColorStop(0.5, 'rgba(244, 63, 94, 0.45)');
                grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
              } else {
                // Preset-reactive colors: Acid=Cyan, Euphoric=Purple, Industrial=Amber, Rave=Emerald
                const colors = [
                  ['rgba(6, 182, 212, 0.85)', 'rgba(168, 85, 247, 0.4)'],
                  ['rgba(168, 85, 247, 0.85)', 'rgba(236, 72, 153, 0.4)'],
                  ['rgba(245, 158, 11, 0.85)', 'rgba(239, 68, 68, 0.4)'],
                  ['rgba(16, 185, 129, 0.85)', 'rgba(6, 182, 212, 0.4)']
                ];
                const activeColor = colors[activePresetIndexRef.current] || colors[0];
                grad.addColorStop(0, activeColor[0]);
                grad.addColorStop(0.5, activeColor[1]);
                grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
              }

              ctx.fillStyle = grad;
              ctx.fillRect(x, centerY - barHeight, barWidth - 3, barHeight * 2);
            }
          }

          // 3. Draw Hand Skeletons, Finger Counts & Glow
          if (results && results.multiHandLandmarks) {
            results.multiHandLandmarks.forEach((rawLandmarks, idx) => {
              const landmarks = rawLandmarks.map(point => ({ ...point, x: 1 - point.x }));
              ctx.shadowBlur = 0;
              const handedness = results.multiHandedness[idx];
              if (!handedness || handedness.score < 0.6) return;
              const label = handedness.label;
              const isRightHand = label === 'Left';
              const isBoosted = isRightHand && isBassBoostedRef.current;
              const fingerInfo = countExtendedFingers(landmarks);

              const color = isRightHand 
                ? (isBoosted ? '#ef4444' : '#f59e0b') 
                : '#06b6d4';

              // Skeleton Lines
              drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
                color: isBoosted ? 'rgba(239, 68, 68, 0.7)' : 'rgba(255, 255, 255, 0.32)',
                lineWidth: 3
              });

              // Joints
              drawLandmarks(ctx, landmarks, {
                color: color,
                lineWidth: 2,
                radius: isBoosted ? 5 : 3.5
              });

              // Index Tip DJ Laser Spark
              const indexTip = landmarks[8];
              const screenX = indexTip.x * canvas.width;
              const screenY = indexTip.y * canvas.height;

              ctx.beginPath();
              ctx.arc(screenX, screenY, isBoosted ? 15 : 9, 0, Math.PI * 2);
              ctx.fillStyle = color;
              ctx.shadowColor = color;
              ctx.shadowBlur = isBoosted ? 30 : 15;
              ctx.fill();

              // Gesture Tag above Wrist
              const wrist = landmarks[0];
              const wx = wrist.x * canvas.width;
              const wy = Math.max(30, wrist.y * canvas.height - 35);

              ctx.save();
              ctx.font = 'bold 12px monospace';
              ctx.fillStyle = isBoosted ? '#ef4444' : (isRightHand ? '#f59e0b' : '#06b6d4');
              ctx.shadowColor = ctx.fillStyle;
              ctx.shadowBlur = 8;
              
              let tagText = '';
              if (isRightHand) {
                tagText = isBoosted ? 'FIST: BASS DROP' : (controller.current.tempoHand === 'Right' ? 'WAVE: TEMPO' : 'HEIGHT: FILTER');
              } else {
                tagText = lastEcho.current ? 'PINCH: ECHO' : (controller.current.tempoHand === 'Left' ? 'WAVE: TEMPO' : 'HEIGHT: FILTER / FINGERS: MELODY');
              }

              ctx.fillText(tagText, wx - 50, wy);
              ctx.restore();
            });
          }

          ctx.restore();
        }
      }

      measurements.record('renderMs', performance.now() - renderStarted);
      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, []);

  const togglePlay = async () => {
    if (playPending.current) return;
    playPending.current = true;
    setAudioError(null);
    try {
      if (isPlayingRef.current) technoEngine.stop();
      else await technoEngine.start();
      isPlayingRef.current = technoEngine.getDiagnostics().playing;
      setIsPlaying(isPlayingRef.current);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : String(err));
    } finally { playPending.current = false; }
  };

  const handleTestSound = async () => {
    try { await technoEngine.playTestDrop(); }
    catch (err) { setAudioError(err instanceof Error ? err.message : String(err)); }
  };

  const handleSelectPreset = (presetIndex: number) => {
    controller.current.preset = presetIndex;
    activePresetIndexRef.current = presetIndex;
    technoEngine.setMelodyPreset(presetIndex);
    const preset = MELODY_PRESETS[presetIndex];
    setActiveMelody(preset);

    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setMelodyToast(`${preset.fingers} Finger${preset.fingers > 1 ? 's' : ''}: ${preset.name}`);
    toastTimeoutRef.current = window.setTimeout(() => setMelodyToast(null), 2400);
  };

  return (
    <div className="relative w-full min-h-screen py-5 bg-[#050508] overflow-x-hidden flex flex-col items-center justify-center font-sans text-zinc-100 select-none">
      <video ref={videoRef} className="hidden" playsInline muted />

      {/* Cyberpunk Rave Club Lighting Ambience */}
      <div className="absolute inset-0 bg-radial-gradient from-cyan-500/10 via-purple-900/10 to-black pointer-events-none" />
      
      {/* Bass Pulse Neon Rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div 
          animate={{ 
            scale: isPlaying ? [1, 1 + (displayFilterPct / 100) * 0.35, 1] : 1, 
            opacity: isPlaying ? [0.2, 0.45 + (isBassBoosted ? 0.3 : 0), 0.2] : 0.08,
            borderColor: isBassBoosted ? '#ef4444' : '#06b6d4'
          }}
          transition={{ repeat: Infinity, duration: 60 / displayBPM, ease: "easeInOut" }}
          className="w-[560px] h-[560px] border-2 rounded-full shadow-[0_0_90px_rgba(6,182,212,0.25)]"
        />
        <motion.div 
          animate={{ 
            scale: isPlaying ? [0.85, 1.2, 0.85] : 0.85, 
            opacity: isBassBoosted ? 0.5 : 0.12,
            borderColor: isBassBoosted ? '#f43f5e' : '#a855f7'
          }}
          transition={{ repeat: Infinity, duration: (60 / displayBPM) * 2, ease: "easeInOut" }}
          className="absolute w-[800px] h-[800px] border rounded-full shadow-[0_0_120px_rgba(168,85,247,0.2)]"
        />
      </div>

      <div className="relative z-40 w-full max-w-6xl px-3 mb-3 flex gap-3 flex-wrap items-center text-xs">
        <label>Tempo hand <select aria-label="Tempo hand" className="bg-zinc-800 rounded p-2 ml-2" value={tempoHand}
          onChange={e => { const hand = e.target.value as Hand; controller.current.setTempoHand(hand); setTempoHand(hand); }}>
          <option>Right</option><option>Left</option>
        </select></label>
        <label>Audio buffer <select aria-label="Audio buffer" className="bg-zinc-800 rounded p-2 ml-2" value={bufferMs}
          onChange={e => { const ms = Number(e.target.value); setBufferMs(ms); technoEngine.setScheduleAhead(ms / 1000); }}>
          <option value={100}>Responsive (100 ms)</option><option value={180}>Balanced (180 ms)</option><option value={350}>Resilient (350 ms)</option>
        </select></label>
        <label>Tracking <select aria-label="Tracking quality" className="bg-zinc-800 rounded p-2 ml-2" value={trackingQuality}
          onChange={e => setTrackingQuality(Number(e.target.value) as 0 | 1)}>
          <option value={0}>Fast</option><option value={1}>Detailed</option>
        </select></label>
        <button className="bg-zinc-800 rounded px-3 py-2" onClick={() => setCameraEnabled(value => !value)}>
          {cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
        </button>
        <span role="status">{status}</span>
        <span className={echoActive ? 'text-purple-300' : 'text-zinc-400'}>{echoActive ? 'Echo active' : 'Left pinch: echo'}</span>
        {(error || audioError) && <p role="alert" className="w-full text-amber-300">{error || audioError} — Manual controls still work. Toggle the camera to retry.</p>}
      </div>
      {/* Main DJ Stage Viewport */}
      <div className="relative w-full max-w-6xl aspect-video bg-zinc-950/85 rounded-3xl border border-cyan-500/25 shadow-[0_0_120px_rgba(0,0,0,0.9)] overflow-hidden backdrop-blur-md">
        <canvas
          ref={canvasRef}
          width={960}
          height={540}
          className="w-full h-full object-cover"
        />

        {/* Floating Melody Switch Notification Toast */}
        <AnimatePresence>
          {melodyToast && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className="absolute top-24 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-extrabold px-6 py-2.5 rounded-full shadow-[0_0_40px_rgba(6,182,212,0.6)] flex items-center gap-2 border border-white/30 text-sm tracking-wider uppercase"
            >
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>MELODY SWITCHED: {melodyToast}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top HUD: DJ Telemetry & Master Controls */}
        <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-30">
          <div className="flex flex-col gap-3">
            
            {/* Track Status Badge & Melody Selector Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className={`px-3.5 py-1.5 rounded-full border backdrop-blur-xl flex items-center gap-2.5 ${
                isPlaying 
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300' 
                  : 'bg-zinc-800/80 border-white/10 text-zinc-400'
              }`}>
                <Radio className={`w-3.5 h-3.5 ${isPlaying ? 'text-cyan-400 animate-pulse' : 'text-zinc-500'}`} />
                <span className="text-xs font-bold tracking-wide uppercase">
                  {isPlaying ? 'Deck A (Live)' : 'Deck A: Standby'}
                </span>
              </div>

              {/* Instant Test Drop Button */}
              <button
                onClick={handleTestSound}
                className="px-3.5 py-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                title="Click to trigger instant 909 kick & acid drop"
              >
                <Zap className="w-3.5 h-3.5" />
                Test Drop
              </button>

              {/* 4 Interactive Melody Preset Pills (Can also be switched by fingers 1, 2, 3, 4) */}
              <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-xl border border-white/10 p-1 rounded-full">
                {MELODY_PRESETS.map((preset) => {
                  const isActive = activeMelody.id === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset.id)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                      title={`Hold up ${preset.fingers} finger${preset.fingers > 1 ? 's' : ''} to activate`}
                    >
                      <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                        {preset.fingers}
                      </span>
                      <span>{preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Telemetry Cards */}
            <div className="flex gap-3">
              {/* Tempo (BPM) Card */}
              <div className="bg-black/80 backdrop-blur-xl border border-cyan-500/20 p-3.5 rounded-2xl flex items-center gap-3.5 min-w-[170px] shadow-xl">
                <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-400">
                  <Gauge className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Tempo ({tempoHand} Hand)</p>
                  <p className="text-xl font-mono font-bold text-white">
                    {displayBPM} <span className="text-xs text-amber-400 font-sans font-semibold">BPM</span>
                  </p>
                </div>
              </div>

              {/* Left Hand: DJ Filter & Dynamics */}
              <div className="bg-black/80 backdrop-blur-xl border border-cyan-500/20 p-3.5 rounded-2xl flex items-center gap-3.5 min-w-[170px] shadow-xl">
                <div className="p-2.5 bg-cyan-500/20 rounded-xl text-cyan-400">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-baseline">
                    <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">DJ Filter ({tempoHand === 'Right' ? 'Left' : 'Right'} Hand)</p>
                    <span className="text-xs font-mono font-bold text-cyan-300">{displayFilterPct}%</span>
                  </div>
                  <div className="w-24 h-2 bg-zinc-800 rounded-full mt-1.5 overflow-hidden border border-white/5">
                    <motion.div 
                      animate={{ width: `${Math.max(5, displayFilterPct)}%` }}
                      className="h-full bg-cyan-400 rounded-full"
                    />
                  </div>
                </div>
              </div>

              {/* Current Active Melody Card */}
              <div className="bg-black/80 backdrop-blur-xl border border-purple-500/25 p-3.5 rounded-2xl flex items-center gap-3.5 min-w-[180px] shadow-xl">
                <div className="p-2.5 bg-purple-500/20 rounded-xl text-purple-400">
                  <Disc3 className="w-5 h-5 animate-spin" style={{ animationDuration: '8s' }} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-purple-300 tracking-wider">
                    {activeMelody.fingers} Finger{activeMelody.fingers > 1 ? 's' : ''} Gesture
                  </p>
                  <p className="text-sm font-extrabold text-white leading-tight">
                    {activeMelody.name}
                  </p>
                  <p className="text-[10px] text-zinc-400">{activeMelody.tag}</p>
                </div>
              </div>
            </div>

            {/* Bass Boost Fist Banner */}
            <AnimatePresence>
              {isBassBoosted && (
                <motion.div 
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="bg-red-950/90 backdrop-blur-xl border border-red-500/60 px-4 py-2.5 rounded-2xl flex items-center gap-3 w-fit shadow-[0_0_35px_rgba(239,68,68,0.5)]"
                >
                  <div className="p-1.5 bg-red-500/30 rounded-lg text-red-400 animate-pulse">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-red-400 tracking-widest">Sub-Bass Drop Active</p>
                    <p className="text-xs font-bold text-red-100">RIGHT FIST LOCKED • +18dB 909 Sub Rumble & Acid Squelch</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Master DJ Play/Pause Button */}
          <button 
            onClick={togglePlay}
            className={`group relative w-18 h-18 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 active:scale-95 cursor-pointer ${
              isPlaying 
                ? 'bg-gradient-to-tr from-cyan-500 to-purple-600 text-white shadow-cyan-500/40' 
                : 'bg-white text-black hover:bg-zinc-200 shadow-white/20'
            }`}
            title={isPlaying ? "Pause Beat" : "Drop the Beat"}
          >
            {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 ml-1 fill-current" />}
            <div className={`absolute inset-0 rounded-full border-2 ${isPlaying ? 'border-cyan-400 animate-ping opacity-40' : 'border-white/40'}`} />
          </button>
        </div>

        {/* Bottom DJ Gesture Guide */}
        <div className="absolute bottom-6 left-6 right-6 flex justify-between items-center z-30 pointer-events-none">
          <div className="flex gap-2.5 pointer-events-auto flex-wrap">
            <div className="flex items-center gap-2 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs">
              <div className="w-2.5 h-2.5 bg-amber-500 rounded-full shadow-[0_0_8px_#f59e0b]" />
              <span className="text-zinc-300"><strong className="text-amber-400">{tempoHand} Wave:</strong> BPM</span>
            </div>
            
            <div className={`flex items-center gap-2 backdrop-blur-md px-3 py-1.5 rounded-xl border text-xs transition-colors ${
              isBassBoosted 
                ? 'bg-red-950/90 border-red-500/70 shadow-[0_0_20px_rgba(239,68,68,0.5)]' 
                : 'bg-black/75 border-white/10'
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full ${isBassBoosted ? 'bg-red-500 animate-ping' : 'bg-red-500/80'}`} />
              <span className="text-zinc-300"><strong className="text-red-400">Right Fist:</strong> Bass Drop</span>
            </div>

            <div className="flex items-center gap-2 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs">
              <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full shadow-[0_0_8px_#06b6d4]" />
              <span className="text-zinc-300"><strong className="text-cyan-400">{tempoHand === 'Right' ? 'Left' : 'Right'} Height:</strong> DJ Filter</span>
            </div>

            <div className="flex items-center gap-2 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-xl border border-purple-500/30 text-xs">
              <div className="w-2.5 h-2.5 bg-purple-400 rounded-full shadow-[0_0_8px_#c084fc]" />
              <span className="text-zinc-300">
                <strong className="text-purple-400">{tempoHand === 'Right' ? 'Left' : 'Right'} fingers 1..4:</strong> Switch Melodies
              </span>
            </div>
          </div>

          {/* Quick Manual DJ Filter Slider Fallback */}
          <div className="bg-black/75 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 flex items-center gap-2.5 pointer-events-auto">
            <Disc3 className="w-4 h-4 text-cyan-400" />
            <input 
              type="range" 
              min="0.15" 
              max="1.0" 
              step="0.05"
              value={displayFilterPct / 100}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                controller.current.dynamics = val;
                currentDynamicsRef.current = val;
                technoEngine.setDynamics(val);
                setDisplayFilterPct(Math.round(val * 100));
              }}
              className="w-24 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              title="Manual DJ Filter Slider"
            />
          </div>
        </div>
      </div>

      {/* Intro Modal Overlay */}
      <AnimatePresence>
        {showIntro && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/92 backdrop-blur-lg flex items-center justify-center p-6"
          >
            <div className="max-w-xl text-center bg-zinc-900/85 border border-cyan-500/30 p-8 rounded-3xl shadow-[0_0_80px_rgba(6,182,212,0.25)]">
              <div className="inline-flex p-4 bg-cyan-500/15 rounded-3xl mb-6 text-cyan-400 border border-cyan-500/30">
                <Disc3 className="w-10 h-10 animate-spin" style={{ animationDuration: '6s' }} />
              </div>

              <h1 className="text-4xl font-extrabold mb-3 tracking-tight text-white">
                Maestro Techno Prototype
              </h1>
              <p className="text-zinc-400 text-sm mb-6 leading-relaxed max-w-md mx-auto">
                Shape a live techno set with your hands. Wave for tempo, hold 1–4 fingers on your filter hand to switch melodies, and pinch with your left hand for echo.
              </p>
              
              <div className="grid grid-cols-2 gap-3 mb-6 text-left">
                <div className="bg-zinc-950/80 p-3.5 rounded-2xl border border-purple-500/30 col-span-2">
                  <div className="flex items-center gap-2 mb-1.5 text-purple-400">
                    <Sparkles className="w-4 h-4" />
                    <h3 className="font-bold uppercase text-[11px] tracking-wider">Finger Number Gestures (Melody Switch)</h3>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 text-[10px] text-zinc-300 font-medium">
                    <div className="p-1.5 bg-white/5 rounded-lg border border-white/5 text-center">
                      <span className="font-bold text-cyan-400 block text-xs">1 Finger</span>
                      Cyber Acid
                    </div>
                    <div className="p-1.5 bg-white/5 rounded-lg border border-white/5 text-center">
                      <span className="font-bold text-purple-400 block text-xs">2 Fingers</span>
                      Euphoric Melodic
                    </div>
                    <div className="p-1.5 bg-white/5 rounded-lg border border-white/5 text-center">
                      <span className="font-bold text-amber-400 block text-xs">3 Fingers</span>
                      Dark Industrial
                    </div>
                    <div className="p-1.5 bg-white/5 rounded-lg border border-white/5 text-center">
                      <span className="font-bold text-emerald-400 block text-xs">4 Fingers</span>
                      Peak Rave
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-950/80 p-3 rounded-2xl border border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-1 text-cyan-400">
                    <Volume2 className="w-3.5 h-3.5" />
                    <h3 className="font-bold uppercase text-[10px] tracking-wider">Left Height: DJ Filter</h3>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-snug">
                    Raise hand to sweep club filter open for a huge rave build-up.
                  </p>
                </div>

                <div className="bg-zinc-950/80 p-3 rounded-2xl border border-red-500/30">
                  <div className="flex items-center gap-2 mb-1 text-red-400">
                    <Flame className="w-3.5 h-3.5" />
                    <h3 className="font-bold uppercase text-[10px] tracking-wider">Right Fist: Bass Drop</h3>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-snug">
                    Clench a fist for +18dB sub-bass and screaming acid squelch.
                  </p>
                </div>
              </div>

              <button 
                onClick={async () => {
                  setShowIntro(false);
                  setCameraEnabled(true);
                  await togglePlay();
                }}
                className="px-10 py-4 bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-500 hover:from-cyan-400 hover:to-pink-400 text-white font-extrabold rounded-full transition-all flex items-center gap-3 mx-auto shadow-lg shadow-cyan-500/30 active:scale-95 cursor-pointer text-base"
              >
                <Play className="w-5 h-5 fill-current" />
                Drop the Beat (Start Prototype)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Diagnostics />
      {/* Footer Tech Indicator */}
      <div className="mt-4 flex items-center gap-2 text-zinc-500 text-xs">
        <Activity className="w-3.5 h-3.5 text-cyan-400" />
        <span className="font-semibold uppercase tracking-[0.2em] text-[10px]">
          {bufferMs} ms audio buffer • Right fist: bass • Left pinch: echo
        </span>
      </div>
    </div>
  );
};

export default MaestroConductor;
