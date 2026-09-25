/**
 * Audio architecture.
 *
 * Everything is synthesised with WebAudio so the game is fully functional with
 * zero audio files. If assets are added later, swap the private synth methods
 * for `this.scene.sound.play(...)` – the public API stays identical.
 *
 * The game must remain playable when audio is unavailable (autoplay policy,
 * missing API, user muted) – every method fails soft.
 */

type SfxName =
  | 'tap'
  | 'switchLight'
  | 'engine'
  | 'crash'
  | 'levelComplete'
  | 'perfect'
  | 'button'
  | 'rewarded';

interface AudioManagerOptions {
  isSoundOn: () => boolean;
  isMusicOn: () => boolean;
}

const VOLUME = {
  sfx: 0.5,
  music: 0.16,
};

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private musicNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private opts: AudioManagerOptions = { isSoundOn: () => true, isMusicOn: () => false };
  private failed = false;

  /** Call from a user gesture so iOS/Chrome unlock the context. */
  unlock(): void {
    if (this.failed) return;
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) {
          this.failed = true;
          return;
        }
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 1;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.failed = true;
    }
  }

  configure(opts: AudioManagerOptions): void {
    this.opts = opts;
    if (!opts.isSoundOn()) this.stopEngine();
    if (!opts.isMusicOn()) this.stopMusic();
    else this.startMusic();
  }

  private get soundOn(): boolean {
    try {
      return this.opts.isSoundOn();
    } catch {
      return false;
    }
  }

  private get musicOn(): boolean {
    try {
      return this.opts.isMusicOn();
    } catch {
      return false;
    }
  }

  // --- primitive tone ------------------------------------------------------
  private tone(
    freq: number,
    durationMs: number,
    opts: { type?: OscillatorType; volume?: number; delayMs?: number; glideTo?: number } = {},
  ): void {
    if (!this.soundOn || !this.ctx || !this.master) return;
    try {
      const t0 = this.ctx.currentTime + (opts.delayMs ?? 0) / 1000;
      const dur = durationMs / 1000;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = opts.type ?? 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, t0 + dur);
      const vol = opts.volume ?? 0.35;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      /* ignore */
    }
  }

  private noise(durationMs: number, volume = 0.4, lowpass = 900): void {
    if (!this.soundOn || !this.ctx || !this.master) return;
    try {
      const t0 = this.ctx.currentTime;
      const dur = durationMs / 1000;
      const frames = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = this.ctx.createGain();
      gain.gain.value = volume;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t0);
    } catch {
      /* ignore */
    }
  }

  // --- public sfx ----------------------------------------------------------
  play(name: SfxName): void {
    if (!this.soundOn) return;
    switch (name) {
      case 'tap':
        this.tone(720, 60, { type: 'triangle', volume: 0.22 });
        break;
      case 'switchLight':
        this.tone(880, 70, { type: 'square', volume: 0.16 });
        this.tone(1320, 70, { type: 'triangle', volume: 0.14, delayMs: 55 });
        break;
      case 'button':
        this.tone(520, 70, { type: 'triangle', volume: 0.2 });
        break;
      case 'crash':
        this.noise(420, 0.5, 700);
        this.tone(180, 350, { type: 'sawtooth', volume: 0.3, glideTo: 60 });
        break;
      case 'levelComplete':
        this.tone(523, 110, { type: 'triangle', volume: 0.3 });
        this.tone(659, 110, { type: 'triangle', volume: 0.3, delayMs: 110 });
        this.tone(784, 180, { type: 'triangle', volume: 0.32, delayMs: 220 });
        break;
      case 'perfect':
        this.tone(523, 100, { type: 'triangle', volume: 0.3 });
        this.tone(659, 100, { type: 'triangle', volume: 0.3, delayMs: 90 });
        this.tone(784, 100, { type: 'triangle', volume: 0.3, delayMs: 180 });
        this.tone(1046, 240, { type: 'triangle', volume: 0.34, delayMs: 270 });
        break;
      case 'rewarded':
        this.tone(660, 90, { type: 'triangle', volume: 0.28 });
        this.tone(990, 160, { type: 'triangle', volume: 0.28, delayMs: 90 });
        break;
      case 'engine':
        this.startEngine();
        break;
    }
  }

  /** Low traffic hum while a level runs. Very quiet, fails soft. */
  startEngine(): void {
    if (!this.soundOn || !this.ctx || !this.master || this.engineOsc) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc.type = 'sawtooth';
      osc.frequency.value = 52;
      filter.type = 'lowpass';
      filter.frequency.value = 220;
      gain.gain.value = 0.0001;
      gain.gain.linearRampToValueAtTime(0.035, this.ctx.currentTime + 0.8);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      osc.start();
      this.engineOsc = osc;
      this.engineGain = gain;
    } catch {
      /* ignore */
    }
  }

  stopEngine(): void {
    try {
      if (this.engineOsc && this.ctx) {
        const osc = this.engineOsc;
        const gain = this.engineGain;
        if (gain) {
          gain.gain.cancelScheduledValues(this.ctx.currentTime);
          gain.gain.setValueAtTime(gain.gain.value, this.ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.25);
        }
        setTimeout(() => {
          try {
            osc.stop();
          } catch {
            /* ignore */
          }
        }, 320);
      }
    } catch {
      /* ignore */
    }
    this.engineOsc = null;
    this.engineGain = null;
  }

  /** Gentle ambient pad – only when music is enabled. */
  startMusic(): void {
    if (!this.musicOn || !this.ctx || !this.master || this.musicNodes.length > 0) return;
    try {
      const chords = [
        [196.0, 246.94, 293.66],
        [174.61, 220.0, 261.63],
        [196.0, 246.94, 329.63],
      ];
      let step = 0;
      const playChord = () => {
        if (!this.ctx || !this.master || !this.musicOn) return;
        const chord = chords[step % chords.length];
        step++;
        chord.forEach((f, i) => {
          try {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();
            osc.type = 'sine';
            osc.frequency.value = f;
            const t0 = this.ctx!.currentTime;
            gain.gain.setValueAtTime(0.0001, t0);
            gain.gain.linearRampToValueAtTime(VOLUME.music / chord.length, t0 + 1.4);
            gain.gain.linearRampToValueAtTime(0.0001, t0 + 4.6);
            osc.connect(gain);
            gain.connect(this.master!);
            osc.start(t0);
            osc.stop(t0 + 4.8);
            osc.onended = () => {
              try {
                osc.disconnect();
                gain.disconnect();
              } catch {
                /* ignore */
              }
            };
          } catch {
            /* ignore */
          }
          void i;
        });
      };
      playChord();
      this.musicTimer = setInterval(playChord, 4200);
    } catch {
      /* ignore */
    }
  }

  stopMusic(): void {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.musicNodes = [];
  }

  /** Hard mute used when the sound toggle turns off. */
  applySettings(): void {
    if (!this.soundOn) {
      this.stopEngine();
      this.tone(0, 0);
    }
    if (this.musicOn) this.startMusic();
    else this.stopMusic();
  }
}

export const audio = new AudioManager();
