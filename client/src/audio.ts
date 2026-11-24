import { settings } from "./settings.ts";
import { MUSIC, melodyNote, midiToHz, type MusicMode, type Surface } from "../../shared/src/index.ts";
import { makeRng } from "../../shared/src/math/rng.ts";

/**
 * All sound is synthesised with the Web Audio API: no audio files, so there is nothing to license or download.
 * Browsers only allow sound after a user gesture, so everything is silent until unlock() runs (App calls it on the first tap or key).
 */
export type SfxName = "click" | "jump" | "land" | "collect" | "orb" | "pickup" | "success" | "fanfare" | "correct" | "wrong" | "roundEnd" | "scare"
  | "alarm" | "blackout" | "special" | "whisper" | "cast" | "bite" | "catch" | "miss" | "pop" | "tick" | "thunder" | "crack";

type Wave = OscillatorType;
interface ToneOpt { type?: Wave; vol?: number; at?: number; slide?: number; attack?: number; dest?: AudioNode }
interface NoiseOpt { filter?: number; q?: number; vol?: number; at?: number; type?: BiquadFilterType; attack?: number; dest?: AudioNode }

class Engine {
  private ctx: AudioContext | null = null;
  private master!: GainNode; private sfxG!: GainNode; private ambG!: GainNode; private musG!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private active = 0;
  private wxKind = "clear";
  private ambMode = "off"; private musMode: MusicMode | "off" = "off";
  private ambTimer: number | null = null; private musTimer: number | null = null;
  private wind: { src: AudioBufferSourceNode; gain: GainNode; base: number } | null = null;
  private rain: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private nextNote = 0; private step = 0; private rnd = makeRng(Date.now() % 100000).next;

  /** Call from a user gesture. Safe to call many times. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const c = (this.ctx = new AC());
      this.master = c.createGain(); this.sfxG = c.createGain(); this.ambG = c.createGain(); this.musG = c.createGain();
      const comp = c.createDynamicsCompressor(); // keeps layered sounds from clipping
      this.sfxG.connect(comp); this.ambG.connect(comp); this.musG.connect(comp); comp.connect(this.master); this.master.connect(c.destination);
      const n = c.sampleRate * 2, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.apply();
    this.ambience(this.ambMode); this.music(this.musMode);
  }

  /** Re-read volumes and mute from settings. */
  apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, v = settings.volume, m = settings.muted ? 0 : 1;
    this.master.gain.setTargetAtTime(m * v.master * 0.8, t, 0.03);
    this.sfxG.gain.setTargetAtTime(v.sfx, t, 0.03); this.ambG.gain.setTargetAtTime(v.ambient, t, 0.03); this.musG.gain.setTargetAtTime(v.music, t, 0.03);
  }

  /* ---------- building blocks ---------- */
  private tone(freq: number, dur: number, o: ToneOpt = {}) {
    const c = this.ctx; if (!c || this.active > 28) return;
    const t = c.currentTime + (o.at ?? 0), osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type ?? "sine"; osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.vol ?? 0.2, t + (o.attack ?? 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.dest ?? this.sfxG);
    this.active++; osc.onended = () => { this.active--; g.disconnect(); };
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  private noise(dur: number, o: NoiseOpt = {}) {
    const c = this.ctx; if (!c || !this.noiseBuf || this.active > 28) return;
    const t = c.currentTime + (o.at ?? 0), src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noiseBuf; f.type = o.type ?? "lowpass"; f.frequency.value = o.filter ?? 1000; f.Q.value = o.q ?? 0.7;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.vol ?? 0.1, t + (o.attack ?? 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.dest ?? this.sfxG);
    this.active++; src.onended = () => { this.active--; g.disconnect(); };
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  private arp(freqs: number[], gap: number, o: ToneOpt & { dur?: number } = {}) { freqs.forEach((f, i) => this.tone(f, o.dur ?? 0.18, { ...o, at: i * gap })); }

  /* ---------- sound effects ---------- */
  sfx(name: SfxName) {
    if (!this.ctx || settings.muted) return;
    switch (name) {
      case "click": return this.tone(880, 0.05, { type: "square", vol: 0.06 });
      case "jump": return this.tone(330, 0.14, { type: "triangle", vol: 0.14, slide: 700 });
      case "land": return this.noise(0.09, { filter: 400, vol: 0.18 });
      case "collect": return this.arp([880, 1320], 0.07, { dur: 0.12, vol: 0.16 });
      case "orb": return this.arp([988, 1319], 0.05, { dur: 0.09, vol: 0.12 });
      case "pickup": return this.tone(440, 0.15, { type: "triangle", vol: 0.15, slide: 700 });
      case "success": return this.arp([523, 659, 784, 1047], 0.09, { dur: 0.2, type: "triangle", vol: 0.16 });
      case "fanfare": this.arp([523, 659, 784, 1047, 1319], 0.12, { dur: 0.35, type: "triangle", vol: 0.16 }); return this.tone(262, 0.9, { type: "sine", vol: 0.12 });
      case "correct": return this.arp([659, 880], 0.1, { dur: 0.2, vol: 0.16 });
      case "wrong": return this.tone(220, 0.28, { type: "sawtooth", vol: 0.1, slide: 150 });
      case "roundEnd": return this.arp([784, 659, 523], 0.14, { dur: 0.3, type: "triangle", vol: 0.15 });
      case "scare": this.noise(0.4, { filter: 1800, vol: 0.2, type: "bandpass", q: 1.2 }); this.tone(220, 0.4, { type: "sawtooth", vol: 0.14, slide: 70 }); return this.tone(1300, 0.3, { vol: 0.07, slide: 600 });
      case "alarm": return this.arp([660, 660, 660], 0.22, { dur: 0.12, type: "square", vol: 0.08 });
      case "blackout": this.tone(200, 0.9, { vol: 0.22, slide: 45 }); return this.noise(0.8, { filter: 300, vol: 0.12 });
      case "special": return this.arp([1047, 1319, 1568, 2093], 0.16, { dur: 0.5, vol: 0.1 });
      case "whisper": return this.noise(1.3, { filter: 3200, q: 2, vol: 0.07, type: "bandpass", attack: 0.5 });
      case "cast": this.noise(0.25, { filter: 2500, vol: 0.1, type: "highpass" }); return this.tone(600, 0.25, { vol: 0.1, slide: 300 });
      case "bite": this.tone(300, 0.12, { vol: 0.18, slide: 520 }); return this.tone(1200, 0.1, { vol: 0.1, at: 0.1 });
      case "catch": return this.arp([880, 1175, 1568], 0.08, { dur: 0.2, vol: 0.15 });
      case "miss": return this.tone(300, 0.22, { type: "triangle", vol: 0.12, slide: 200 });
      case "pop": return this.tone(600, 0.09, { vol: 0.12, slide: 900 });
      case "tick": return this.tone(1000, 0.04, { type: "square", vol: 0.07 });
      case "crack": return this.noise(0.25, { filter: 2500, vol: 0.28, type: "highpass" });
      case "thunder": this.noise(2.2, { filter: 160, vol: 0.4, attack: 0.15 }); return this.tone(55, 1.8, { vol: 0.22, slide: 38, attack: 0.1 });
    }
  }

  /** One footstep on the given surface (slightly random pitch so it does not sound mechanical). */
  step_(surface: Surface) {
    if (!this.ctx || settings.muted) return;
    const j = 0.92 + Math.random() * 0.16;
    switch (surface) {
      case "grass": return this.noise(0.07, { filter: 1500 * j, q: 0.8, vol: 0.05, type: "bandpass" });
      case "dirt": this.noise(0.06, { filter: 900 * j, vol: 0.08 }); return this.tone(140 * j, 0.04, { vol: 0.06 });
      case "stone": this.tone(180 * j, 0.05, { type: "triangle", vol: 0.1 }); return this.noise(0.03, { filter: 3000, vol: 0.05, type: "highpass" });
      case "wood": this.tone(220 * j, 0.06, { type: "triangle", vol: 0.12, slide: 160 }); return this.noise(0.04, { filter: 800, vol: 0.05, type: "bandpass" });
      case "field": return this.noise(0.1, { filter: 600 * j, q: 1.2, vol: 0.07, type: "bandpass" });
    }
  }

  /* ---------- ambience ---------- */
  ambience(mode: "day" | "night" | "off" | string) {
    this.ambMode = mode;
    const c = this.ctx; if (!c) return;
    if (this.ambTimer !== null) { clearInterval(this.ambTimer); this.ambTimer = null; }
    if (this.wind) { try { this.wind.src.stop(); } catch { /* already stopped */ } this.wind.gain.disconnect(); this.wind = null; }
    if (mode === "off") return;
    // wind: looping filtered noise
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noiseBuf; src.loop = true; f.type = "lowpass"; f.frequency.value = mode === "night" ? 350 : 550; g.gain.value = mode === "night" ? 0.05 : 0.04;
    src.connect(f); f.connect(g); g.connect(this.ambG); src.start();
    this.wind = { src, gain: g, base: g.gain.value };
    this.ambTimer = window.setInterval(() => {
      if (settings.muted) return;
      if (this.wxKind === "rain" || this.wxKind === "storm") return; // birds and crickets stay quiet in the rain
      if (mode === "day") { // birds
        if (Math.random() < 0.3) { const base = 2500 + Math.random() * 1200; for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) this.tone(base, 0.09, { vol: 0.03, slide: base * (1.2 + Math.random() * 0.4), at: i * 0.13, dest: this.ambG }); }
      } else { // crickets, an occasional owl
        if (Math.random() < 0.7) for (let i = 0; i < 4; i++) this.tone(4300, 0.05, { vol: 0.018, at: i * 0.09, dest: this.ambG });
        if (Math.random() < 0.04) { this.tone(330, 0.6, { vol: 0.06, attack: 0.1, dest: this.ambG }); this.tone(280, 0.7, { vol: 0.06, attack: 0.1, at: 0.7, dest: this.ambG }); }
      }
    }, 800);
    this.weather(this.wxKind);
  }

  /** Weather layer on top of the ambience: rain loop (louder in a storm), stronger wind, a hush in fog. */
  weather(kind: string) {
    this.wxKind = kind;
    const c = this.ctx; if (!c) return;
    if (this.rain) { try { this.rain.src.stop(); } catch { /* already stopped */ } this.rain.gain.disconnect(); this.rain = null; }
    if (this.wind) this.wind.gain.gain.setTargetAtTime(this.wind.base * (kind === "wind" ? 3 : kind === "storm" ? 2 : kind === "fog" ? 0.5 : 1), c.currentTime, 0.5);
    if (kind === "rain" || kind === "storm") {
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = this.noiseBuf; src.loop = true; f.type = "highpass"; f.frequency.value = 1400; g.gain.value = kind === "storm" ? 0.09 : 0.055;
      src.connect(f); f.connect(g); g.connect(this.ambG); src.start();
      this.rain = { src, gain: g };
    }
  }

  /* ---------- music: generative, scheduled slightly ahead so it never stutters ---------- */
  music(mode: MusicMode | "off") {
    this.musMode = mode;
    const c = this.ctx; if (!c) return;
    if (this.musTimer !== null) { clearInterval(this.musTimer); this.musTimer = null; }
    if (mode === "off") return;
    this.nextNote = c.currentTime + 0.1; this.step = 0;
    const m = MUSIC[mode], beat = 60 / m.bpm;
    this.musTimer = window.setInterval(() => {
      if (!this.ctx || settings.muted) { if (this.ctx) this.nextNote = this.ctx.currentTime + 0.1; return; }
      while (this.nextNote < this.ctx.currentTime + 0.4) {
        const n = melodyNote(mode, this.step, this.rnd), at = this.nextNote - this.ctx.currentTime;
        if (!n.rest) this.tone(midiToHz(n.midi), Math.max(0.25, n.beats * beat * 1.4), { type: m.wave, vol: m.vol, at, attack: m.wave === "sine" ? 0.05 : 0.01, dest: this.musG });
        if (m.droneEvery && this.step % m.droneEvery === 0) this.tone(midiToHz(m.low - 12), beat * m.droneEvery * 0.9, { type: "sine", vol: m.vol * 0.8, at, attack: 0.4, dest: this.musG });
        if (mode === "party" && this.step % 2 === 0) this.noise(0.04, { filter: 5000, type: "highpass", vol: 0.04, at, dest: this.musG }); // light ticking beat
        this.nextNote += n.beats * beat; this.step++;
      }
    }, 120);
  }
}

export const audio = new Engine();
/** Footstep helper under a friendlier name. */
export const footstep = (s: Surface) => audio.step_(s);
