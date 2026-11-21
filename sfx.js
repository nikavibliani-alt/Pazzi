// ფაციფუცობანა — ხმის მოტორი (ტვ და ადმინის მოსასმენი ღილაკები)
const SFX = {
  ctx: null, buffers: {},
  enable() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx.resume();
  },
  tone(f, start, dur, type, vol, endF) {
    const c = this.ctx; if (!c) return;
    const t0 = c.currentTime + start, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (endF) o.frequency.linearRampToValueAtTime(endF, t0 + dur);
    g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + .05);
  },
  bone(f, start, dur, endF, vib) {
    const c = this.ctx; if (!c) return;
    const t0 = c.currentTime + start, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t0); o.frequency.linearRampToValueAtTime(endF || f * .96, t0 + dur);
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t0); lp.frequency.linearRampToValueAtTime(1600, t0 + dur * .3); lp.frequency.linearRampToValueAtTime(600, t0 + dur);
    g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.35, t0 + .06); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 6; lg.gain.value = 5; l.connect(lg).connect(o.frequency); l.start(t0); l.stop(t0 + dur + .05); }
    o.connect(lp).connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + .05);
  },
  // ჩაშენებული ხმები (ნაგულისხმევი)
  defaults: {
    // სწორი: რბილი ზარის ორი ტონი (ზემოთ) — ვიდეოთამაშის გარეშე
    right() { [[880, 0], [1318.5, .14]].forEach(([f, s]) => { SFX.tone(f, s, .9, 'sine', .22); SFX.tone(f * 2, s, .5, 'sine', .05); SFX.tone(f * 3, s, .25, 'triangle', .025); }); },
    partly() { SFX.tone(660, 0, .5, 'sine', .14); SFX.tone(784, .1, .55, 'sine', .1); },
    wrong() { SFX.bone(233, 0, .45, 222); SFX.bone(220, .55, .45, 208); SFX.bone(208, 1.1, .45, 196); SFX.bone(196, 1.65, 1.5, 150, true); },
    buzz() { SFX.tone(300, 0, .12, 'sine', .35, 720); SFX.tone(720, .12, .18, 'sine', .3, 240); SFX.tone(900, 0, .05, 'square', .06); },
    reveal() { for (let i = 0; i < 12; i++) SFX.tone(160 + i * 6, i * .06, .06, 'triangle', .25); [523, 659, 784].forEach(f => SFX.tone(f, .8, .6, 'square', .07)); },
    scoreboard() { [523, 659, 784, 1047].forEach((f, i) => SFX.tone(f, i * .09, .25, 'triangle', .22)); },
    // დრამის დარტყმები (~2.6 წმ), ბოლოს ქინძისთავი — მხოლოდ თუ Mixkit-ის ხმა არ არის
    drumroll() { for (let i = 0; i < 40; i++) { const t = i * .065, v = .05 + .25 * (i / 40); SFX.noise(t, .06, v, 900 + i * 30); SFX.tone(110 + (i % 2) * 6, t, .05, 'triangle', v * .6); } },
    podium() { SFX.tone(392, 0, .2, 'sawtooth', .1); SFX.tone(523, .22, 1, 'sawtooth', .1); SFX.tone(659, .22, 1, 'sawtooth', .08); SFX.tone(784, .22, 1, 'sawtooth', .08); },
    loser() { SFX.tone(1200, 0, .6, 'sine', .25, 200); SFX.bone(110, .65, .9, 80, true); }
  },
  libMeta: {},
  noise(start, dur, vol, freq) {
    const c = this.ctx; if (!c) return;
    const n = Math.max(1, Math.floor(c.sampleRate * dur)), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t0 = c.currentTime + start;
    f.type = 'bandpass'; f.frequency.value = freq || 1200; f.Q.value = .8; g.gain.value = vol;
    s.buffer = b; s.connect(f).connect(g).connect(c.destination); s.start(t0);
  },
  // დარტყმა / ქინძისთავი სახელის გამოჩენისას
  crash() { const c = this.ctx; if (!c) return; this.noise(0, 1.6, .35, 6000); this.noise(0, .25, .5, 300); this.tone(60, 0, .4, 'sine', .4, 40); },
  // შეჩერებადი ხმა (დრამი): ბიბლიოთეკის ხმა ან ჩაშენებული
  playStoppable(event) {
    if (!this.ctx) return { stop() {} };
    const m = ((CFG && CFG.sounds) || {})[event] || 'default';
    if (m === 'none') return { stop() {} };
    const b = m !== 'default' && this.buffers[m];
    if (b) { const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); s.buffer = b; s.connect(g).connect(this.ctx.destination); s.start(); return { stop: () => { try { g.gain.setTargetAtTime(0, this.ctx.currentTime, .08); s.stop(this.ctx.currentTime + .4); } catch (e) {} } }; }
    this.defaults[event] && this.defaults[event](); return { stop() {} };
  },
  idOf(v) { if (!v || v === 'default' || v === 'none') return v; if (this.libMeta[v]) return v; const e = Object.entries(this.libMeta).find(([, m]) => m && m.name === v); return e ? e[0] : null; },
  async loadLib(id) {
    if (!this.ctx || this.buffers[id] !== undefined) return;
    this.buffers[id] = null;
    try {
      const d = (await db.ref('libdata/snd/' + id).once('value')).val(); if (!d) return;
      const ab = await (await fetch(d)).arrayBuffer();
      this.buffers[id] = await this.ctx.decodeAudioData(ab);
    } catch (e) { this.buffers[id] = null; }
  },
  preload(sounds) { Object.values(sounds || {}).forEach(v => { if (v && v !== 'default' && v !== 'none') this.loadLib(v); }); },
  playBuffer(id) {
    const b = this.buffers[id]; if (!b || !this.ctx) return false;
    const s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.ctx.destination); s.start(); return true;
  },
  // მოვლენის ხმა კონფიგურაციის მიხედვით
  // over = კითხვის საკუთარი ხმები ({ right: libId, ... }); თუ არ არის — თამაშის ნაგულისხმევი
  play(event, over) {
    if (!this.ctx) return;
    if (over && over[event] && this.playBuffer(over[event])) return;
    const m = ((CFG && CFG.sounds) || {})[event] || 'default';
    if (m === 'none') return;
    if (m !== 'default' && this.playBuffer(m)) return;
    this.defaults[event] && this.defaults[event]();
  },
  // ადმინი: კონკრეტული არჩევანის მოსმენა
  async preview(choice, event) {
    this.enable();
    if (choice === 'none') return;
    if (choice === 'default' || !choice) return this.defaults[event] && this.defaults[event]();
    const id = this.idOf(choice) || choice;
    await this.loadLib(id); if (!this.playBuffer(id) && this.defaults[event]) this.defaults[event]();
  }
};
