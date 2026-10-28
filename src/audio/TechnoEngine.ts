import { measurements } from '../performance';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Production-Grade Web Audio Techno Synthesizer Engine
// Featuring Ultra-Smooth Lookahead Clock Scheduling & 4 Distinct Melody Variations:
// - Preset 0 (1 Finger): Cyber Acid Drive (Hypnotic 303 Rolling Acid)
// - Preset 1 (2 Fingers): Euphoric Melodic (Tale of Us / Afterlife Soaring Lead)
// - Preset 2 (3 Fingers): Dark Industrial (Heavy Syncopated Minor Stabs)
// - Preset 3 (4 Fingers): Peak-Time Rave (Blazing High-Energy Festival Arp)

export interface MelodyPresetInfo {
  id: number;
  fingers: number;
  name: string;
  tag: string;
  description: string;
}

export const MELODY_PRESETS: MelodyPresetInfo[] = [
  {
    id: 0,
    fingers: 1,
    name: "Cyber Acid",
    tag: "303 Underground",
    description: "Driving, hypnotic rolling 303 acid sequence"
  },
  {
    id: 1,
    fingers: 2,
    name: "Euphoric Melodic",
    tag: "Afterlife Anthem",
    description: "Spacious, cinematic soaring melodic techno"
  },
  {
    id: 2,
    fingers: 3,
    name: "Dark Industrial",
    tag: "Berlin Basement",
    description: "Punchy, aggressive syncopated warehouse stabs"
  },
  {
    id: 3,
    fingers: 4,
    name: "Peak-Time Rave",
    tag: "Mainstage Energy",
    description: "Fast-paced, blazing high-energy festival arpeggio"
  }
];

export class TechnoEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;
  private bassGain: GainNode | null = null;
  private bassFilter: BiquadFilterNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Real-time lookahead scheduler
  private isRunning: boolean = false;
  private schedulerIntervalId: number | null = null;
  private current16thStep: number = 0;
  private nextStepTime: number = 0;
  
  // Short lookahead for responsiveness; a larger buffer remains selectable.
  private scheduleAheadTime: number = 0.10;
  private readonly lookaheadInterval: number = 25; // check every 25ms

  // Real-time parameters
  private baseBPM: number = 130;
  private tempoMultiplier: number = 1.0;
  private dynamicsLevel: number = 0.85; // controlled by Left Hand
  private isBassBoosted: boolean = false; // controlled by Right Hand Fist
  private activeMelodyIndex: number = 0; // 0..3

  // --- 4 DISTINCT MELODY VARIATIONS (Frequencies in Hz) ---
  
  // Melody 0 (1 Finger): Cyber Acid (303 rolling in D Minor)
  private readonly melodyAcid: number[] = [
    146.83, 174.61, 220.00, 293.66, // D3, F3, A3, D4
    261.63, 220.00, 174.61, 196.00, // C4, A3, F3, G3
    220.00, 261.63, 293.66, 349.23, // A3, C4, D4, F4
    329.63, 293.66, 261.63, 220.00  // E4, D4, C4, A3
  ];

  // Melody 1 (2 Fingers): Euphoric Melodic (Soaring Afterlife arpeggios with octave jumps)
  private readonly melodyEuphoric: number[] = [
    293.66, 440.00, 349.23, 587.33, // D4, A4, F4, D5
    523.25, 440.00, 392.00, 329.63, // C5, A4, G4, E4
    349.23, 440.00, 523.25, 659.25, // F4, A4, C5, E5
    587.33, 523.25, 440.00, 392.00  // D5, C5, A4, G4
  ];

  // Melody 2 (3 Fingers): Dark Industrial Stabs (Syncopated punchy chord roots)
  private readonly melodyIndustrial: number[] = [
    146.83, 146.83, 220.00, 146.83, // D3, D3, A3, D3
    174.61, 146.83, 261.63, 146.83, // F3, D3, C4, D3
    233.08, 233.08, 174.61, 233.08, // Bb3, Bb3, F3, Bb3
    220.00, 196.00, 174.61, 164.81  // A3, G3, F3, E3
  ];

  // Melody 3 (4 Fingers): Peak-Time Rave Fury (Fast blistering 16th energy)
  private readonly melodyRave: number[] = [
    349.23, 392.00, 440.00, 523.25, // F4, G4, A4, C5
    587.33, 523.25, 440.00, 349.23, // D5, C5, A4, F4
    392.00, 440.00, 587.33, 659.25, // G4, A4, D5, E5
    698.46, 659.25, 587.33, 523.25  // F5, E5, D5, C5
  ];

  // 16-step rolling acid bassline pattern in D Minor
  private readonly bassNotes: number[] = [
    36.71, 36.71, 43.65, 36.71, // D1, D1, F1, D1
    55.00, 36.71, 65.41, 36.71, // A1, D1, C2, D1
    36.71, 43.65, 49.00, 55.00, // D1, F1, G1, A1
    58.27, 55.00, 49.00, 43.65  // Bb1, A1, G1, F1
  ];

  private frequencyData: Uint8Array<ArrayBuffer> | null = null;
  private noiseBuffers = new Map<number, AudioBuffer>();
  private voices = new Set<AudioScheduledSourceNode>();
  private outputGate: GainNode | null = null;
  private echoActive = false;
  private startGeneration = 0;
  private skippedSteps = 0;
  private lastSchedulerTime = 0;

  public setScheduleAhead(seconds: number) {
    if (Number.isFinite(seconds)) this.scheduleAheadTime = Math.max(0.08, Math.min(0.35, seconds));
  }

  public getDiagnostics() {
    return { lookaheadMs: this.scheduleAheadTime * 1000, skippedSteps: this.skippedSteps,
      activeVoices: this.voices.size, playing: this.isRunning,
      baseLatencyMs: this.ctx ? this.ctx.baseLatency * 1000 : null,
      outputLatencyMs: this.ctx && 'outputLatency' in this.ctx ? this.ctx.outputLatency * 1000 : null };
  }

  public setEcho(active: boolean) {
    this.echoActive = active;
    if (this.ctx && this.delayGain) {
      this.delayGain.gain.setTargetAtTime(active ? 0.58 : 0.32, this.ctx.currentTime, 0.025);
    }
  }

  private noiseBuffer(duration: number): AudioBuffer {
    let buffer = this.noiseBuffers.get(duration);
    if (!buffer) {
      buffer = this.ctx!.createBuffer(1, Math.floor(this.ctx!.sampleRate * duration), this.ctx!.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffers.set(duration, buffer);
    }
    return buffer;
  }

  private trackVoice(sources: AudioScheduledSourceNode[], nodes: AudioNode[]) {
    let remaining = sources.length;
    sources.forEach(source => {
      this.voices.add(source);
      source.onended = () => {
        this.voices.delete(source);
        source.disconnect();
        if (--remaining === 0) nodes.forEach(node => node.disconnect());
      };
    });
  }

  constructor() {
    // AudioContext is initialized on user gesture
  }

  public async init(): Promise<void> {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx({ latencyHint: 'interactive' });

      // Master DJ Club Filter (Left Hand controls cutoff sweep 400Hz - 14,000Hz)
      this.masterFilter = this.ctx.createBiquadFilter();
      this.masterFilter.type = 'lowpass';
      this.masterFilter.frequency.setValueAtTime(450 + this.dynamicsLevel ** 2 * 13500, this.ctx.currentTime);
      this.masterFilter.Q.setValueAtTime(2.2, this.ctx.currentTime);

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.35 + this.dynamicsLevel * 0.65, this.ctx.currentTime);

      // Stereo Delay / Echo for lush space
      this.delayNode = this.ctx.createDelay();
      this.delayNode.delayTime.setValueAtTime(0.23, this.ctx.currentTime); // 3/16th note delay
      this.delayGain = this.ctx.createGain();
      this.delayGain.gain.setValueAtTime(this.echoActive ? 0.58 : 0.32, this.ctx.currentTime);
      this.delayNode.connect(this.delayGain);
      this.delayGain.connect(this.delayNode); // feedback
      this.delayGain.connect(this.masterFilter);

      // Analyser for real-time visualizer
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.82;

      // Bass Sub-Chain with Dedicated Low-Shelf EQ Boost (+18dB on fist)
      this.bassFilter = this.ctx.createBiquadFilter();
      this.bassFilter.type = 'lowshelf';
      this.bassFilter.frequency.setValueAtTime(160, this.ctx.currentTime);
      this.bassFilter.gain.setValueAtTime(this.isBassBoosted ? 18 : 0, this.ctx.currentTime);

      this.bassGain = this.ctx.createGain();
      this.bassGain.gain.setValueAtTime(this.isBassBoosted ? 2.6 : 1, this.ctx.currentTime);

      // Connect: Bass -> BassFilter -> BassGain -> MasterFilter
      this.bassFilter.connect(this.bassGain);
      this.bassGain.connect(this.masterFilter);

      // Connect: MasterFilter -> MasterGain -> Analyser -> Output
      this.masterFilter.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.outputGate = this.ctx.createGain();
      this.outputGate.gain.value = 0;
      this.analyser.connect(this.outputGate);
      this.outputGate.connect(this.ctx.destination);
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      [0.16, 0.035, 0.14].forEach(duration => this.noiseBuffer(duration));
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  public async start(): Promise<void> {
    const generation = ++this.startGeneration;
    await this.init();
    if (generation !== this.startGeneration || this.isRunning || !this.ctx) return;

    this.isRunning = true;
    this.outputGate!.gain.cancelScheduledValues(this.ctx.currentTime);
    this.outputGate!.gain.setTargetAtTime(1, this.ctx.currentTime, 0.008);
    this.lastSchedulerTime = this.ctx.currentTime;
    this.current16thStep = 0;
    this.nextStepTime = this.ctx.currentTime + 0.05;

    this.runScheduler();
    // Schedule against the audio clock.
    this.schedulerIntervalId = window.setInterval(() => {
      this.runScheduler();
    }, this.lookaheadInterval);
  }

  public stop(): void {
    this.isRunning = false;
    ++this.startGeneration;
    if (this.ctx) {
      this.outputGate?.gain.cancelScheduledValues(this.ctx.currentTime);
      this.outputGate?.gain.setTargetAtTime(0, this.ctx.currentTime, 0.005);
      this.voices.forEach(source => { try { source.stop(this.ctx!.currentTime + 0.015); } catch {} });
    }
    if (this.schedulerIntervalId !== null) {
      window.clearInterval(this.schedulerIntervalId);
      this.schedulerIntervalId = null;
    }
  }

  /**
   * Lookahead Web Audio Scheduler:
   * Schedules ahead on the audio clock. Long main-thread stalls can still underrun.
   * Skip missed beats instead of firing overdue notes together.
   */
  private runScheduler(): void {
    if (!this.isRunning || !this.ctx) return;

    const now = this.ctx.currentTime;
    measurements.record('schedulerIntervalMs', (now - this.lastSchedulerTime) * 1000);
    this.lastSchedulerTime = now;
    if (this.nextStepTime < now) {
      const duration = 60 / (this.baseBPM * this.tempoMultiplier) / 4;
      const skipped = Math.ceil((now + 0.005 - this.nextStepTime) / duration);
      this.nextStepTime += skipped * duration;
      this.current16thStep = (this.current16thStep + skipped) % 16;
      this.skippedSteps += skipped;
    }
    while (this.nextStepTime < now + this.scheduleAheadTime) {
      this.scheduleStepAtTime(this.current16thStep, this.nextStepTime);
      this.advanceStep();
    }
  }

  private advanceStep(): void {
    const currentBPM = this.baseBPM * this.tempoMultiplier;
    const secondsPer16th = 60 / currentBPM / 4;
    this.nextStepTime += secondsPer16th;
    this.current16thStep = (this.current16thStep + 1) % 16;
  }

  private scheduleStepAtTime(step: number, time: number): void {
    if (!this.ctx) return;

    const currentBPM = this.baseBPM * this.tempoMultiplier;
    const stepDuration = 60 / currentBPM / 4;
    const isBoosted = this.isBassBoosted;

    // 1. Kick Drum: 4-on-the-floor on steps 0, 4, 8, 12
    if (step % 4 === 0) {
      this.triggerKick(time, isBoosted);
    }

    // 2. Techno Rumble Sub-Bass on offbeat 16ths
    const bassFreq = this.bassNotes[step % this.bassNotes.length];
    this.triggerBass(bassFreq, time, stepDuration * 0.95, isBoosted);

    // 3. Open Hi-Hat on offbeats (2, 6, 10, 14) + closed 16th groove
    if (step % 4 === 2) {
      this.triggerHat(time, true);
    } else {
      this.triggerHat(time, false);
    }

    // 4. Snappy Techno Clap on beats 2 and 4 (steps 4 and 12)
    if (step === 4 || step === 12) {
      this.triggerClap(time);
    }

    // 5. Active Melody Variation (switched seamlessly via Finger Count)
    const melodyArray = this.getActiveMelodyArray();
    const leadFreq = melodyArray[step % melodyArray.length];
    this.triggerLead(leadFreq, time, stepDuration * 0.9);
  }

  private getActiveMelodyArray(): number[] {
    switch (this.activeMelodyIndex) {
      case 1:
        return this.melodyEuphoric;
      case 2:
        return this.melodyIndustrial;
      case 3:
        return this.melodyRave;
      case 0:
      default:
        return this.melodyAcid;
    }
  }

  /**
   * Switch melody preset (0: Acid, 1: Euphoric, 2: Industrial, 3: Rave)
   */
  public setMelodyPreset(presetIndex: number): void {
    if (!Number.isFinite(presetIndex)) return;
    const clamped = Math.round(Math.max(0, Math.min(3, presetIndex)));
    if (this.activeMelodyIndex === clamped) return;
    this.activeMelodyIndex = clamped;
  }

  public getMelodyPreset(): number {
    return this.activeMelodyIndex;
  }

  public getMelodyInfo(): MelodyPresetInfo {
    return MELODY_PRESETS[this.activeMelodyIndex] || MELODY_PRESETS[0];
  }

  public setTempo(multiplier: number): void {
    if (!Number.isFinite(multiplier)) return;
    this.tempoMultiplier = Math.max(0.82, Math.min(1.42, multiplier));
  }

  public setDynamics(level: number): void {
    if (!Number.isFinite(level)) return;
    this.dynamicsLevel = Math.max(0.15, Math.min(1.0, level));
    if (this.ctx && this.masterFilter && this.masterGain) {
      const now = this.ctx.currentTime;
      // Exponential sweep from 450Hz to 14,000Hz
      const targetCutoff = 450 + Math.pow(this.dynamicsLevel, 2) * 13500;
      this.masterFilter.frequency.setTargetAtTime(targetCutoff, now, 0.04);

      const targetGain = 0.35 + this.dynamicsLevel * 0.65;
      this.masterGain.gain.setTargetAtTime(targetGain, now, 0.04);
    }
  }

  public setBassBoost(enabled: boolean): void {
    if (this.isBassBoosted === enabled) return;
    this.isBassBoosted = enabled;

    if (this.ctx && this.bassFilter && this.bassGain) {
      const now = this.ctx.currentTime;
      if (enabled) {
        // Dramatic Sub-Bass Drop: +18dB low-shelf EQ boost & 2.6x sub volume
        this.bassFilter.gain.setTargetAtTime(18, now, 0.04);
        this.bassGain.gain.setTargetAtTime(2.6, now, 0.04);
      } else {
        this.bassFilter.gain.setTargetAtTime(0, now, 0.08);
        this.bassGain.gain.setTargetAtTime(1.0, now, 0.08);
      }
    }
  }

  /**
   * Sound Test Drop: Plays an immediate heavy drop with 909 kick, sub rumble, and lead stab
   */
  public async playTestDrop(): Promise<void> {
    await this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime + 0.01;
    this.outputGate!.gain.cancelScheduledValues(this.ctx.currentTime);
    this.outputGate!.gain.setTargetAtTime(1, this.ctx.currentTime, 0.008);
    if (!this.isRunning) this.outputGate!.gain.setTargetAtTime(0, now + 1.5, 0.03);
    this.triggerKick(now, true);
    this.triggerBass(36.71, now, 0.45, true);
    this.triggerLead(293.66, now, 0.5);
    this.triggerHat(now, true);
    this.triggerClap(now + 0.05);
  }

  // 909-Style Club Techno Kick Drum
  private triggerKick(time: number, isBoosted: boolean): void {
    if (!this.ctx || !this.masterFilter) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const startFreq = isBoosted ? 180 : 155;
    const endFreq = isBoosted ? 38 : 44;
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.075);

    const kickVolume = isBoosted ? 1.05 : 0.8;
    gain.gain.setValueAtTime(kickVolume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

    osc.connect(gain);
    gain.connect(this.masterFilter);

    osc.start(time);
    osc.stop(time + 0.38);
    this.trackVoice([osc], [gain]);

    // Click transient
    const click = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(800, time);
    click.frequency.exponentialRampToValueAtTime(80, time + 0.012);

    clickGain.gain.setValueAtTime(0.35, time);
    clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.015);

    click.connect(clickGain);
    clickGain.connect(this.masterFilter);

    click.start(time);
    click.stop(time + 0.02);
    this.trackVoice([click], [clickGain]);

    // Sub-bass thump on fist boost
    if (isBoosted) {
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(48, time);
      sub.frequency.exponentialRampToValueAtTime(32, time + 0.28);

      subGain.gain.setValueAtTime(0.75, time);
      subGain.gain.exponentialRampToValueAtTime(0.001, time + 0.42);

      sub.connect(subGain);
      subGain.connect(this.masterFilter);

      sub.start(time);
      sub.stop(time + 0.45);
      this.trackVoice([sub], [subGain]);
    }
  }

  // Rolling Acid & Rumble Sub-Bass Voice
  private triggerBass(freq: number, time: number, duration: number, isBoosted: boolean): void {
    if (!this.ctx || !this.bassFilter) return;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = isBoosted ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    const cutoffStart = isBoosted ? 1500 : 380;
    const cutoffEnd = isBoosted ? 260 : 90;
    filter.frequency.setValueAtTime(cutoffStart, time);
    filter.frequency.exponentialRampToValueAtTime(cutoffEnd, time + duration);
    filter.Q.setValueAtTime(isBoosted ? 7.0 : 2.5, time);

    const bassVol = isBoosted ? 0.45 : 0.25;
    gain.gain.setValueAtTime(0.01, time);
    gain.gain.linearRampToValueAtTime(bassVol, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bassFilter);

    osc.start(time);
    osc.stop(time + duration + 0.04);
    this.trackVoice([osc], [filter, gain]);

    // Sub-drone octave when fist is active
    if (isBoosted) {
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(freq * 0.5, time);
      subGain.gain.setValueAtTime(0.38, time);
      subGain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      sub.connect(subGain);
      subGain.connect(this.bassFilter);
      sub.start(time);
      sub.stop(time + duration + 0.04);
      this.trackVoice([sub], [subGain]);
    }
  }

  // Melodic Techno Lead Voice (changes with active melody preset)
  private triggerLead(freq: number, time: number, duration: number): void {
    if (!this.ctx || !this.masterFilter) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Sound character adapts subtly to the melody preset
    if (this.activeMelodyIndex === 2) {
      // Industrial stabs: square + sawtooth punch
      osc1.type = 'square';
      osc2.type = 'sawtooth';
    } else {
      // Acid / Melodic / Rave: detuned dual saw
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
    }

    osc1.frequency.setValueAtTime(freq, time);
    osc1.detune.setValueAtTime(-7, time);

    osc2.frequency.setValueAtTime(freq, time);
    osc2.detune.setValueAtTime(7, time);

    const leadVol = this.activeMelodyIndex === 1 ? 0.20 : 0.16;
    gain.gain.setValueAtTime(0.005, time);
    gain.gain.linearRampToValueAtTime(leadVol, time + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterFilter);

    // Route to stereo ping-pong delay line for spacious depth
    if (this.delayNode) {
      gain.connect(this.delayNode);
    }

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + duration + 0.03);
    osc2.stop(time + duration + 0.03);
    this.trackVoice([osc1, osc2], [gain]);
  }

  // 909 Hi-Hats
  private triggerHat(time: number, isOpen: boolean): void {
    if (!this.ctx || !this.masterFilter) return;

    const buffer = this.noiseBuffer(isOpen ? 0.16 : 0.035);

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(isOpen ? 6500 : 8000, time);

    const gain = this.ctx.createGain();
    const vol = isOpen ? 0.22 : 0.08;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (isOpen ? 0.15 : 0.03));

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterFilter);

    noise.start(time);
    noise.stop(time + (isOpen ? 0.18 : 0.04));
    this.trackVoice([noise], [filter, gain]);
  }

  // 909 Clap
  private triggerClap(time: number): void {
    if (!this.ctx || !this.masterFilter) return;

    const buffer = this.noiseBuffer(0.14);

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1250, time);
    filter.Q.setValueAtTime(2.2, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterFilter);

    noise.start(time);
    noise.stop(time + 0.15);
    this.trackVoice([noise], [filter, gain]);
  }

  public getAudioFrequencyData(): Uint8Array | null {
    if (!this.analyser) return null;
    const dataArray = this.frequencyData!;
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  public getBPM(): number {
    return Math.round(this.baseBPM * this.tempoMultiplier);
  }
}

// Global singleton instance
export const technoEngine = new TechnoEngine();
