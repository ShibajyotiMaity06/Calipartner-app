/**
 * Sound effects utility for UI micro-interactions.
 * Uses Web Audio API when running on web / React Native Web.
 * Safe across all platforms: deterministic, zero external audio assets, zero latency.
 */

interface WebAudioNode {
  connect(destination: unknown): void;
}

interface WebAudioOscillator extends WebAudioNode {
  type: string;
  frequency: {
    setValueAtTime(value: number, time: number): void;
    exponentialRampToValueAtTime(value: number, time: number): void;
  };
  start(time?: number): void;
  stop(time?: number): void;
}

interface WebAudioGain extends WebAudioNode {
  gain: {
    setValueAtTime(value: number, time: number): void;
    exponentialRampToValueAtTime(value: number, time: number): void;
  };
}

interface WebAudioContext {
  state: string;
  currentTime: number;
  destination: unknown;
  createOscillator(): WebAudioOscillator;
  createGain(): WebAudioGain;
  resume(): Promise<void>;
}

class SoundManager {
  private ctx: WebAudioContext | null = null;

  private getContext(): WebAudioContext | null {
    try {
      const g = globalThis as unknown as {
        AudioContext?: new () => WebAudioContext;
        webkitAudioContext?: new () => WebAudioContext;
        window?: {
          AudioContext?: new () => WebAudioContext;
          webkitAudioContext?: new () => WebAudioContext;
        };
      };

      const AudioContextClass =
        g.AudioContext ||
        g.webkitAudioContext ||
        g.window?.AudioContext ||
        g.window?.webkitAudioContext;

      if (!this.ctx && AudioContextClass) {
        this.ctx = new AudioContextClass();
      }

      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * Tactile button click / tap sound.
   * Soft, subtle mechanical switch pop (40ms, 650Hz -> 180Hz).
   */
  playClick(): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const now = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.038);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.038);
    } catch {
      // Audio playback fails gracefully if blocked by platform policy
    }
  }

  /**
   * Interactive selector / toggle sound.
   * Slightly higher crisp tick (30ms, 850Hz -> 300Hz).
   */
  playToggle(): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const now = ctx.currentTime;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(850, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.03);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.03);
    } catch {
      // Audio fails gracefully
    }
  }

  /**
   * Completion / save success chime.
   * Warm ascending chime chord.
   */
  playSuccess(): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + index * 0.08;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.08, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.16);
      });
    } catch {
      // Audio fails gracefully
    }
  }
}

export const soundManager = new SoundManager();

export function playClickSound(): void {
  soundManager.playClick();
}

export function playToggleSound(): void {
  soundManager.playToggle();
}

export function playSuccessSound(): void {
  soundManager.playSuccess();
}
