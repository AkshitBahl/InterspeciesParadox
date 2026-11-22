/**
 * Animal sounds, made live in the browser with the Web Audio API.
 *
 * Nothing is downloaded and there are no licences to track: each species has a
 * small "recipe" of oscillators, noise and filters that imitates its real call.
 * The recipes are impressions, not field recordings, and the map says so.
 *
 * To use a real recording instead, put the file in `public/sounds/` and add it to
 * RECORDINGS below (for example `"red-fox": "/sounds/red-fox.mp3"`). Check its
 * licence first: many recordings online are CC BY-SA or non-commercial only.
 */

export const RECORDINGS: Partial<Record<string, string>> = {};

export interface AnimalSoundInfo {
  /** What the real animal sounds like, in a few words. */
  description: string;
  /** Button text. */
  action: string;
}

export const SOUND_INFO: Record<string, AnimalSoundInfo> = {
  "house-martin": { action: "Play", description: "A dry, rolling twitter in flight." },
  "peregrine-falcon": { action: "Play", description: "A harsh kek kek kek near the nest." },
  "common-pipistrelle": { action: "Play", description: "Too high for us. This is a bat detector." },
  "red-mason-bee": { action: "Play", description: "No voice, just a wing hum." },
  "european-hedgehog": { action: "Play", description: "Sniffs, snuffles and huffs." },
  "red-fox": { action: "Play", description: "Short, sharp barks." },
};

export function soundInfo(slug: string | null | undefined): AnimalSoundInfo {
  return (slug && SOUND_INFO[slug]) || { action: "Play", description: "A short call." };
}

// --- tiny synth toolkit -------------------------------------------------------------

type Ctx = BaseAudioContext;
/** A recipe schedules its sound from time t0 into `out` and returns its length in seconds. */
type Recipe = (ctx: Ctx, out: AudioNode, t0: number) => number;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

const noiseBuffers = new WeakMap<Ctx, AudioBuffer>();
function noise(ctx: Ctx): AudioBuffer {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

/** A gain node that fades in, holds and fades out (exponentially, so no clicks). */
function envelope(ctx: Ctx, out: AudioNode, t: number, attack: number, hold: number, release: number, peak: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  g.connect(out);
  return g;
}

function osc(ctx: Ctx, type: OscillatorType, out: AudioNode, t: number, dur: number, freqs: [number, number][]): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freqs[0][1], t);
  for (const [at, f] of freqs.slice(1)) o.frequency.linearRampToValueAtTime(f, t + at);
  o.connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

function noiseBurst(ctx: Ctx, out: AudioNode, t: number, dur: number, filter: BiquadFilterType, freq: number, q: number): void {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  src.connect(f).connect(out);
  src.start(t, rand(0, 1.5));
  src.stop(t + dur + 0.05);
}

function rasp(ctx: Ctx, amount: number): WaveShaperNode {
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount);
  }
  shaper.curve = curve;
  return shaper;
}

// --- one recipe per species -----------------------------------------------------------

/** House martin: rolling "prrrt" chirps (a fast trill inside each chirp). */
const houseMartin: Recipe = (ctx, out, t0) => {
  let t = t0;
  for (let i = 0; i < 6; i++) {
    const dur = rand(0.07, 0.1);
    const env = envelope(ctx, out, t, 0.006, dur * 0.5, dur * 0.5, 0.45);
    const trill = ctx.createGain();
    trill.gain.value = 0.55;
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = rand(45, 60);
    const depth = ctx.createGain();
    depth.gain.value = 0.45;
    lfo.connect(depth).connect(trill.gain);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
    trill.connect(env);
    const base = rand(3400, 3900);
    osc(ctx, "triangle", trill, t, dur, [[0, base], [dur * 0.35, base + 800], [dur, base - 500]]);
    t += dur + rand(0.06, 0.13);
  }
  return t - t0 + 0.1;
};

/** Peregrine falcon: harsh, repeated "kek" notes. */
const peregrine: Recipe = (ctx, out, t0) => {
  const shaper = rasp(ctx, 3);
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 2300;
  band.Q.value = 2.5;
  shaper.connect(band).connect(out);
  let t = t0;
  for (let i = 0; i < 8; i++) {
    const env = envelope(ctx, shaper, t, 0.005, 0.03, 0.05, 0.4);
    const f = rand(1750, 1950) - i * 12;
    osc(ctx, "sawtooth", env, t, 0.09, [[0, f], [0.03, f + 150], [0.08, f - 300]]);
    noiseBurst(ctx, envelope(ctx, out, t, 0.004, 0.02, 0.04, 0.06), t, 0.07, "bandpass", 3000, 3);
    t += rand(0.12, 0.14);
  }
  return t - t0 + 0.1;
};

/** Common pipistrelle, as heard through a bat detector: ticks that speed up into a buzz. */
const pipistrelle: Recipe = (ctx, out, t0) => {
  let t = t0;
  let gap = 0.11;
  while (t - t0 < 1.35) {
    const env = envelope(ctx, out, t, 0.001, 0.002, 0.008, 0.38);
    osc(ctx, "sine", env, t, 0.012, [[0, 4600], [0.009, 1500]]);
    t += gap;
    if (t - t0 > 0.55) gap = Math.max(0.011, gap * 0.82);
  }
  // Two small social squeaks after the catch.
  for (let i = 0; i < 2; i++) {
    const s = t + 0.12 + i * 0.12;
    osc(ctx, "sine", envelope(ctx, out, s, 0.005, 0.02, 0.04, 0.12), s, 0.07, [[0, 5200], [0.035, 6100], [0.065, 4800]]);
  }
  return t - t0 + 0.45;
};

/** Red mason bee: the hum of wings during a fly-by (louder, then softer, with a small Doppler drop). */
const masonBee: Recipe = (ctx, out, t0) => {
  const dur = 1.8;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 1500;
  lowpass.Q.value = 1.2;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.7);
  gain.gain.exponentialRampToValueAtTime(0.22, t0 + 1.1);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  lowpass.connect(gain).connect(out);
  const flutter = ctx.createGain();
  flutter.gain.value = 0.85;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 23;
  const depth = ctx.createGain();
  depth.gain.value = 0.15;
  lfo.connect(depth).connect(flutter.gain);
  lfo.start(t0);
  lfo.stop(t0 + dur + 0.05);
  flutter.connect(lowpass);
  const wobble = ctx.createOscillator();
  wobble.frequency.value = 6.5;
  const wobbleDepth = ctx.createGain();
  wobbleDepth.gain.value = 7;
  wobble.connect(wobbleDepth);
  wobble.start(t0);
  wobble.stop(t0 + dur + 0.05);
  for (const detune of [0, 3.5]) {
    const o = osc(ctx, "sawtooth", flutter, t0, dur, [[0, 238 + detune], [0.75, 236 + detune], [1.05, 212 + detune], [dur, 205 + detune]]);
    wobbleDepth.connect(o.frequency);
  }
  return dur + 0.1;
};

/** European hedgehog: quick sniffs, a huff, then more sniffing. */
const hedgehog: Recipe = (ctx, out, t0) => {
  let t = t0;
  const sniff = (count: number) => {
    for (let i = 0; i < count; i++) {
      const dur = rand(0.04, 0.08);
      noiseBurst(ctx, envelope(ctx, out, t, 0.008, dur * 0.3, dur * 0.7, 0.9), t, dur, "bandpass", rand(1100, 2100), 1.6);
      t += dur + rand(0.05, 0.12);
    }
  };
  sniff(6);
  t += 0.08;
  // The huff: a breathy, low snort with a little grunt in it.
  noiseBurst(ctx, envelope(ctx, out, t, 0.01, 0.06, 0.16, 1), t, 0.24, "lowpass", 650, 0.8);
  const grunt = ctx.createBiquadFilter();
  grunt.type = "lowpass";
  grunt.frequency.value = 500;
  grunt.connect(out);
  osc(ctx, "sawtooth", envelope(ctx, grunt, t, 0.01, 0.05, 0.1, 0.18), t, 0.17, [[0, 150], [0.16, 105]]);
  t += 0.32;
  sniff(4);
  return t - t0 + 0.1;
};

/** Red fox: three short, rising-then-falling barks ("wow-wow-wow"). */
const redFox: Recipe = (ctx, out, t0) => {
  const shaper = rasp(ctx, 2.2);
  const formants = ctx.createGain();
  formants.gain.value = 1;
  for (const [freq, q, level] of [[850, 4, 1], [1750, 6, 0.6], [2900, 8, 0.3]] as const) {
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = freq;
    band.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = level;
    shaper.connect(band).connect(g).connect(formants);
  }
  formants.connect(out);
  let t = t0;
  const barks = Math.random() < 0.5 ? 3 : 4;
  for (let i = 0; i < barks; i++) {
    const f = rand(390, 440);
    const env = envelope(ctx, shaper, t, 0.012, 0.05, 0.14, 0.55);
    osc(ctx, "sawtooth", env, t, 0.22, [[0, f], [0.045, f + 330], [0.2, f + 20]]);
    noiseBurst(ctx, envelope(ctx, out, t, 0.01, 0.04, 0.12, 0.05), t, 0.18, "bandpass", 1600, 1.2);
    t += rand(0.36, 0.44);
  }
  return t - t0 + 0.1;
};

/** Anything else (an animal added by a user): a friendly two-note chirp. */
const generic: Recipe = (ctx, out, t0) => {
  osc(ctx, "triangle", envelope(ctx, out, t0, 0.01, 0.06, 0.1, 0.3), t0, 0.18, [[0, 1800], [0.15, 2400]]);
  osc(ctx, "triangle", envelope(ctx, out, t0 + 0.22, 0.01, 0.06, 0.12, 0.3), t0 + 0.22, 0.2, [[0, 2400], [0.17, 1900]]);
  return 0.55;
};

export const RECIPES: Record<string, Recipe> = {
  "house-martin": houseMartin,
  "peregrine-falcon": peregrine,
  "common-pipistrelle": pipistrelle,
  "red-mason-bee": masonBee,
  "european-hedgehog": hedgehog,
  "red-fox": redFox,
};

// --- playback ---------------------------------------------------------------------

let context: AudioContext | null = null;
let master: GainNode | null = null;
let current: { stop: () => void } | null = null;

function audio(): { ctx: AudioContext; master: GainNode } | null {
  if (!context) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.ratio.value = 4;
    master = context.createGain();
    master.gain.value = 0.8;
    master.connect(compressor).connect(context.destination);
  }
  return { ctx: context, master: master! };
}

/** Renders a recipe into the given context; used by playback and by tests. */
export function scheduleSound(ctx: BaseAudioContext, out: AudioNode, slug: string | null | undefined, t0: number): number {
  return (slug && RECIPES[slug] ? RECIPES[slug] : generic)(ctx, out, t0);
}

/** Stops whatever animal sound is playing. */
export function stopAnimalSound(): void {
  current?.stop();
  current = null;
}

/**
 * Plays the call of a species. Call it from a click (browsers only allow sound after
 * a user gesture). Returns how long it lasts in milliseconds (0 if sound is unavailable).
 */
export function playAnimalSound(slug: string | null | undefined): number {
  stopAnimalSound();

  const recording = slug ? RECORDINGS[slug] : undefined;
  if (recording) {
    const element = new Audio(recording);
    void element.play().catch(() => undefined);
    current = { stop: () => element.pause() };
    return 2500;
  }

  const a = audio();
  if (!a) return 0;
  if (a.ctx.state === "suspended") void a.ctx.resume();
  const bus = a.ctx.createGain();
  bus.connect(a.master);
  const t0 = a.ctx.currentTime + 0.03;
  const seconds = scheduleSound(a.ctx, bus, slug, t0);
  const timer = window.setTimeout(() => bus.disconnect(), (seconds + 0.3) * 1000);
  current = {
    stop: () => {
      window.clearTimeout(timer);
      bus.gain.setTargetAtTime(0, a.ctx.currentTime, 0.02);
      window.setTimeout(() => bus.disconnect(), 150);
    },
  };
  return Math.round(seconds * 1000);
}
