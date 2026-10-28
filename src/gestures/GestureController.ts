export type Hand = 'Left' | 'Right';
export type Point = { x: number; y: number; z?: number };
export type Observation = { landmarks: Point[]; hand: Hand };
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const smooth = (current: number, target: number, dt: number, tau: number) =>
  current + (target - current) * (1 - Math.exp(-Math.max(0, dt) / tau));

// Input is an unmirrored camera image; MediaPipe assumes a mirrored input.
export const physicalHand = (label: string): Hand => label === 'Left' ? 'Right' : 'Left';

export function countExtendedFingers(points: Point[]) {
  const wrist = points[0];
  const extended = [8, 12, 16, 20].map(tip =>
    Math.hypot(points[tip].x - wrist.x, points[tip].y - wrist.y) >
    Math.hypot(points[tip - 2].x - wrist.x, points[tip - 2].y - wrist.y) * 1.15);
  const count = extended.filter(Boolean).length;
  return { count, isFist: count === 0 };
}

export class GestureController {
  tempoHand: Hand = 'Right';
  tempo = 1;
  dynamics = 0.85;
  bass = false;
  echo = false;
  preset = 0;
  private previous: { y: number; time: number } | null = null;
  private lastUpdate = 0;
  private lastRight = -Infinity;
  private lastLeft = -Infinity;
  private candidate: number | null = null;
  private candidateSince = 0;

  setTempoHand(hand: Hand) {
    this.tempoHand = hand;
    this.previous = null;
    this.candidate = null;
  }

  update(observations: Observation[], now: number) {
    const dt = this.lastUpdate ? clamp(now - this.lastUpdate, 0, 100) : 33;
    this.lastUpdate = now;
    let melody: number | null = null;
    let sawTempo = false;
    for (const { landmarks: p, hand } of observations) {
      if (p.length < 21 || !p.every(v => Number.isFinite(v.x) && Number.isFinite(v.y))) continue;
      const fingers = countExtendedFingers(p);
      if (hand === 'Right') {
        this.lastRight = now;
        this.bass = fingers.isFist;
      }
      if (hand === 'Left') {
        this.lastLeft = now;
        // Palm-relative distance keeps pinch recognition less sensitive to camera distance.
        const palm = Math.max(0.01, Math.hypot(p[5].x - p[17].x, p[5].y - p[17].y));
        const pinch = Math.hypot(p[4].x - p[8].x, p[4].y - p[8].y) / palm;
        this.echo = !fingers.isFist && pinch < (this.echo ? 0.50 : 0.32);
      }
      // Pinching reserves the left hand for echo; a fist reserves the right for bass.
      const reserved = hand === 'Left' ? this.echo : fingers.isFist;
      if (hand === this.tempoHand) {
        sawTempo = true;
        if (!reserved && this.previous) {
          const elapsed = now - this.previous.time;
          if (elapsed > 0 && elapsed < 200) {
            const speed = Math.abs(p[0].y - this.previous.y) / (elapsed / 1000);
            this.tempo = smooth(this.tempo, clamp(0.9 + speed * 1.25, 0.85, 1.35), dt, 110);
          }
        }
        this.previous = reserved ? null : { y: p[0].y, time: now };
      } else if (!reserved) {
        this.dynamics = smooth(this.dynamics, clamp(1.28 - p[0].y * 1.2, 0.18, 1), dt, 70);
        if (fingers.count >= 1 && fingers.count <= 4) melody = fingers.count - 1;
      }
    }
    if (!sawTempo) this.previous = null;
    if (now - this.lastRight > 180) this.bass = false;
    if (now - this.lastLeft > 180) this.echo = false;
    if (melody !== this.candidate) {
      this.candidate = melody;
      this.candidateSince = now;
    } else if (melody !== null && now - this.candidateSince >= 180) {
      this.preset = melody;
    }
    return { tempo: this.tempo, dynamics: this.dynamics, bass: this.bass, echo: this.echo, preset: this.preset };
  }
}
