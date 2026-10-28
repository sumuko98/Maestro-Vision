/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Web Audio Orchestral Synthesizer for Maestro Conductor
// Zero external dependencies, zero CORS restrictions, 100% reliable in any browser.

interface NoteEvent {
  melody: number[]; // Frequencies for lead violins
  harmony: number[]; // Frequencies for violas/horns
  bass: number[]; // Frequencies for cellos/double bass
  timpani?: number; // Timpani hit frequency
  duration: number; // in beats (1 beat = 1 quarter note)
}

// Beethoven's 5th Symphony (Allegro con brio) in C Minor
const NOTE_C2 = 65.41;
const NOTE_D2 = 73.42;
const NOTE_EB2 = 77.78;
const NOTE_F2 = 87.31;
const NOTE_G2 = 98.00;
const NOTE_AB2 = 103.83;
const NOTE_B2 = 123.47;

const NOTE_C3 = 130.81;
const NOTE_D3 = 146.83;
const NOTE_EB3 = 155.56;
const NOTE_F3 = 174.61;
const NOTE_G3 = 196.00;
const NOTE_AB3 = 207.65;
const NOTE_B3 = 246.94;

const NOTE_C4 = 261.63;
const NOTE_D4 = 293.66;
const NOTE_EB4 = 311.13;
const NOTE_F4 = 349.23;
const NOTE_G4 = 392.00;
const NOTE_AB4 = 415.30;
const NOTE_B4 = 493.88;

const NOTE_C5 = 523.25;
const NOTE_D5 = 587.33;
const NOTE_EB5 = 622.25;
const NOTE_F5 = 698.46;
const NOTE_G5 = 783.99;
const NOTE_AB5 = 830.61;

// Score arrangement for Beethoven's 5th Theme & Allegro
const BEETHOVEN_SCORE: NoteEvent[] = [
  // The iconic fate motive: Rest, G-G-G, Eb (Fermata)
  { melody: [0], harmony: [], bass: [0], duration: 0.5 },
  { melody: [NOTE_G4], harmony: [NOTE_G3], bass: [NOTE_G2], duration: 0.4 },
  { melody: [NOTE_G4], harmony: [NOTE_G3], bass: [NOTE_G2], duration: 0.4 },
  { melody: [NOTE_G4], harmony: [NOTE_G3], bass: [NOTE_G2], timpani: 98, duration: 0.4 },
  { melody: [NOTE_EB4, NOTE_EB5], harmony: [NOTE_C4, NOTE_G3], bass: [NOTE_EB2, NOTE_C2], timpani: 78, duration: 2.2 },

  // Second motive: Rest, F-F-F, D (Fermata)
  { melody: [0], harmony: [], bass: [0], duration: 0.5 },
  { melody: [NOTE_F4], harmony: [NOTE_F3], bass: [NOTE_F2], duration: 0.4 },
  { melody: [NOTE_F4], harmony: [NOTE_F3], bass: [NOTE_F2], duration: 0.4 },
  { melody: [NOTE_F4], harmony: [NOTE_F3], bass: [NOTE_F2], timpani: 87, duration: 0.4 },
  { melody: [NOTE_D4, NOTE_D5], harmony: [NOTE_B3, NOTE_G3], bass: [NOTE_D2, NOTE_G2], timpani: 73, duration: 2.4 },

  // Driving Allegro section (C Minor)
  { melody: [NOTE_C4, NOTE_EB4], harmony: [NOTE_G3], bass: [NOTE_C2], timpani: 65, duration: 0.5 },
  { melody: [NOTE_D4, NOTE_F4], harmony: [NOTE_B3], bass: [NOTE_D2], duration: 0.5 },
  { melody: [NOTE_EB4, NOTE_G4], harmony: [NOTE_C4], bass: [NOTE_EB2], duration: 0.5 },
  { melody: [NOTE_F4, NOTE_AB4], harmony: [NOTE_D4], bass: [NOTE_F2], timpani: 87, duration: 0.5 },

  { melody: [NOTE_G4, NOTE_C5], harmony: [NOTE_EB4], bass: [NOTE_G2], duration: 0.5 },
  { melody: [NOTE_AB4, NOTE_D5], harmony: [NOTE_F4], bass: [NOTE_AB2], duration: 0.5 },
  { melody: [NOTE_G4, NOTE_EB5], harmony: [NOTE_EB4, NOTE_C4], bass: [NOTE_C2], timpani: 65, duration: 0.75 },
  { melody: [NOTE_F4, NOTE_D5], harmony: [NOTE_D4, NOTE_B3], bass: [NOTE_G2], duration: 0.75 },

  // Triumphant orchestral climax
  { melody: [NOTE_EB4, NOTE_C5], harmony: [NOTE_G3, NOTE_EB3], bass: [NOTE_C2, NOTE_C3], timpani: 65, duration: 0.5 },
  { melody: [NOTE_G4, NOTE_EB5], harmony: [NOTE_C4, NOTE_G3], bass: [NOTE_C2, NOTE_EB2], duration: 0.5 },
  { melody: [NOTE_C5, NOTE_G5], harmony: [NOTE_EB4, NOTE_C4], bass: [NOTE_C2, NOTE_G2], timpani: 65, duration: 0.75 },
  { melody: [NOTE_B4, NOTE_F5], harmony: [NOTE_D4, NOTE_G3], bass: [NOTE_G2, NOTE_B2], duration: 0.75 },

  // Cadence resolution
  { melody: [NOTE_C5, NOTE_EB5], harmony: [NOTE_G4, NOTE_C4], bass: [NOTE_C2, NOTE_C3], timpani: 65, duration: 1.0 },
  { melody: [NOTE_G4, NOTE_D5], harmony: [NOTE_B3, NOTE_G3], bass: [NOTE_G2], duration: 0.5 },
  { melody: [NOTE_C5, NOTE_C4], harmony: [NOTE_G3, NOTE_EB3], bass: [NOTE_C2], timpani: 65, duration: 1.5 },
];

export class OrchestraEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bassGain: GainNode | null = null;
  private bassFilter: BiquadFilterNode | null = null;
  private stringsGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  private isRunning: boolean = false;
  private currentStep: number = 0;
  private timeoutId: number | null = null;
  
  // Real-time params
  private baseBPM: number = 108;
  private tempoMultiplier: number = 1.0;
  private targetVolume: number = 0.8;
  private isBassBoosted: boolean = false;

  constructor() {
    // Lazy creation on user gesture
  }

  public async init(): Promise<void> {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master output chain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.targetVolume, this.ctx.currentTime);

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.8;

      // Bass section with dedicated low-shelf EQ + boost node
      this.bassFilter = this.ctx.createBiquadFilter();
      this.bassFilter.type = 'lowshelf';
      this.bassFilter.frequency.setValueAtTime(180, this.ctx.currentTime);
      this.bassFilter.gain.setValueAtTime(0, this.ctx.currentTime);

      this.bassGain = this.ctx.createGain();
      this.bassGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

      // Strings section
      this.stringsGain = this.ctx.createGain();
      this.stringsGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

      // Connect: Strings -> Master -> Analyser -> Destination
      this.stringsGain.connect(this.masterGain);
      // Connect: Bass -> BassFilter -> BassGain -> Master
      this.bassFilter.connect(this.bassGain);
      this.bassGain.connect(this.masterGain);

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  public async start(): Promise<void> {
    await this.init();
    if (this.isRunning) return;
    this.isRunning = true;
    this.currentStep = 0;
    this.scheduleNextNote();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  public setTempo(multiplier: number): void {
    // Clamp multiplier between 0.5 (slow largo) and 2.0 (presto)
    this.tempoMultiplier = Math.max(0.5, Math.min(2.2, multiplier));
  }

  public setVolume(vol: number): void {
    this.targetVolume = Math.max(0.05, Math.min(1.0, vol));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.targetVolume, this.ctx.currentTime, 0.08);
    }
  }

  public setBassBoost(enabled: boolean): void {
    if (this.isBassBoosted === enabled) return;
    this.isBassBoosted = enabled;

    if (this.ctx && this.bassFilter && this.bassGain) {
      const now = this.ctx.currentTime;
      if (enabled) {
        // Boost low frequencies by +16 dB and increase bass volume
        this.bassFilter.gain.setTargetAtTime(16, now, 0.08);
        this.bassGain.gain.setTargetAtTime(2.2, now, 0.08);
      } else {
        this.bassFilter.gain.setTargetAtTime(0, now, 0.12);
        this.bassGain.gain.setTargetAtTime(1.0, now, 0.12);
      }
    }
  }

  /**
   * Immediate sound test: Plays a triumphant C-minor orchestral flourish
   */
  public async playTestChord(): Promise<void> {
    await this.init();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    // Play full orchestral chord: C2, G2, C3, Eb3, G3, C4, Eb4, G4, C5
    const notes = [NOTE_C2, NOTE_G2, NOTE_C3, NOTE_EB3, NOTE_G3, NOTE_C4, NOTE_EB4, NOTE_G4, NOTE_C5];
    notes.forEach((freq, idx) => {
      this.playViolinVoice(freq, now, 2.0, idx < 3 ? 'bass' : 'strings');
    });
    this.playTimpaniVoice(65, now);
  }

  private scheduleNextNote(): void {
    if (!this.isRunning || !this.ctx) return;

    const event = BEETHOVEN_SCORE[this.currentStep];
    const effectiveBPM = this.baseBPM * this.tempoMultiplier;
    const secondsPerBeat = 60 / effectiveBPM;
    const noteDuration = event.duration * secondsPerBeat;
    const now = this.ctx.currentTime;

    // 1. Play melody (Violins)
    event.melody.forEach(freq => {
      if (freq > 0) {
        this.playViolinVoice(freq, now, noteDuration * 0.95, 'strings');
      }
    });

    // 2. Play harmony (Violas / Horns)
    event.harmony.forEach(freq => {
      if (freq > 0) {
        this.playViolinVoice(freq, now, noteDuration * 0.9, 'strings');
      }
    });

    // 3. Play bass (Cellos / Contrabass)
    event.bass.forEach(freq => {
      if (freq > 0) {
        this.playBassVoice(freq, now, noteDuration * 0.95);
      }
    });

    // 4. Play timpani if present
    if (event.timpani) {
      this.playTimpaniVoice(event.timpani, now);
    }

    // Extra bass reinforcement if fist is active
    if (this.isBassBoosted && event.bass.length > 0 && event.bass[0] > 0) {
      // Sub-octave reinforcement
      this.playSubBassVoice(event.bass[0] * 0.5, now, noteDuration);
      if (Math.random() > 0.4) {
        this.playTimpaniVoice(event.bass[0] * 0.8, now);
      }
    }

    // Advance step
    this.currentStep = (this.currentStep + 1) % BEETHOVEN_SCORE.length;

    // Schedule next beat
    const nextIntervalMs = Math.max(50, noteDuration * 1000);
    this.timeoutId = window.setTimeout(() => {
      this.scheduleNextNote();
    }, nextIntervalMs);
  }

  // Orchestral Strings Voice (Multi-oscillator warm detuned ensemble)
  private playViolinVoice(freq: number, startTime: number, duration: number, section: 'strings' | 'bass'): void {
    if (!this.ctx) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gainNode = this.ctx.createGain();

    // Detuned sawtooth + triangle for rich ensemble bowing
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, startTime);
    osc1.detune.setValueAtTime(-5, startTime);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq, startTime);
    osc2.detune.setValueAtTime(6, startTime);

    // Warm string filter
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, startTime);
    filter.frequency.exponentialRampToValueAtTime(1400, startTime + duration);

    // ADSR Envelope
    const attack = 0.05;
    const release = Math.min(0.25, duration * 0.3);
    const maxGain = section === 'bass' ? 0.35 : 0.22;

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.linearRampToValueAtTime(maxGain, startTime + attack);
    gainNode.gain.setValueAtTime(maxGain * 0.85, startTime + duration - release);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);

    if (section === 'bass') {
      gainNode.connect(this.bassFilter!);
    } else {
      gainNode.connect(this.stringsGain!);
    }

    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + duration + 0.05);
    osc2.stop(startTime + duration + 0.05);
  }

  // Deep Cello / Contrabass voice
  private playBassVoice(freq: number, startTime: number, duration: number): void {
    if (!this.ctx || !this.bassFilter) return;

    const osc = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gainNode = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, startTime);

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(freq * 0.5, startTime); // sub-octave

    filter.type = 'lowpass';
    const cutoff = this.isBassBoosted ? 700 : 350;
    filter.frequency.setValueAtTime(cutoff, startTime);

    const attack = 0.04;
    const release = 0.2;
    const bassVol = this.isBassBoosted ? 0.45 : 0.28;

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.linearRampToValueAtTime(bassVol, startTime + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.bassFilter);

    osc.start(startTime);
    subOsc.start(startTime);
    osc.stop(startTime + duration + 0.05);
    subOsc.stop(startTime + duration + 0.05);
  }

  // Sub-Bass rumble activated during Right Hand Fist
  private playSubBassVoice(freq: number, startTime: number, duration: number): void {
    if (!this.ctx || !this.bassGain) return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(Math.max(35, freq), startTime);

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.linearRampToValueAtTime(0.4, startTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gainNode);
    gainNode.connect(this.bassGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  // Timpani orchestral kettle drum
  private playTimpaniVoice(freq: number, startTime: number): void {
    if (!this.ctx || !this.bassGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // Pitch drop creates the classic timpani boom
    osc.frequency.setValueAtTime(freq * 1.5, startTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.7, startTime + 0.35);

    const duration = 0.6;
    const timpaniVol = this.isBassBoosted ? 0.5 : 0.25;

    gain.gain.setValueAtTime(timpaniVol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.bassGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  public getAudioFrequencyData(): Uint8Array | null {
    if (!this.analyser) return null;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  public getIsPlaying(): boolean {
    return this.isRunning;
  }

  public getBPM(): number {
    return Math.round(this.baseBPM * this.tempoMultiplier);
  }
}

// Global singleton instance
export const orchestraEngine = new OrchestraEngine();
