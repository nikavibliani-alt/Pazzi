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
    right() { [[392, 0, .16], [392, .18, .12], [392, .34, .12], [523, .52, 1.3], [659, .52, 1.3], [784, .52, 1.3], [1047, .52, 1.3]].forEach(([f, s, d]) => { SFX.tone(f, s, d, 'sawtooth', .09); SFX.tone(f, s, d, 'square', .05); }); },
    wrong() { SFX.bone(233, 0, .45, 222); SFX.bone(220, .55, .45, 208); SFX.bone(208, 1.1, .45, 196); SFX.bone(196, 1.65, 1.5, 150, true); },
    buzz() { SFX.tone(300, 0, .12, 'sine', .35, 720); SFX.tone(720, .12, .18, 'sine', .3, 240); SFX.tone(900, 0, .05, 'square', .06); },
    reveal() { for (let i = 0; i < 12; i++) SFX.tone(160 + i * 6, i * .06, .06, 'triangle', .25); [523, 659, 784].forEach(f => SFX.tone(f, .8, .6, 'square', .07)); },
    scoreboard() { [523, 659, 784, 1047].forEach((f, i) => SFX.tone(f, i * .09, .25, 'triangle', .22)); },
    podium() { SFX.tone(392, 0, .2, 'sawtooth', .1); SFX.tone(523, .22, 1, 'sawtooth', .1); SFX.tone(659, .22, 1, 'sawtooth', .08); SFX.tone(784, .22, 1, 'sawtooth', .08); },
    loser() { SFX.tone(1200, 0, .6, 'sine', .25, 200); SFX.bone(110, .65, .9, 80, true); }
  },
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
    if (choice === 'default') return this.defaults[event]();
    await this.loadLib(choice); this.playBuffer(choice);
  }
};
