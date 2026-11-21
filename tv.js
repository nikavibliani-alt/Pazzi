// ფაციფუცობანა — ტვ გვერდი (აქედან უკრავს ყველა ხმა)
const S = { session: null, live: {}, players: {}, teams: {}, awarded: {}, answers: {}, curQ: null };
const app = $('#app');

// ───────── ხმა ─────────
let ctx = null;
$('#soundBtn').onclick = () => {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  ctx.resume();
  $('#sound').remove();
  tone(880, 0, .12, 'triangle', .15); // მცირე სატესტო ბიპი
};
function tone(f, start, dur, type, vol, endF) {
  if (!ctx) return;
  const t0 = ctx.currentTime + start, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (endF) o.frequency.linearRampToValueAtTime(endF, t0 + dur);
  g.gain.setValueAtTime(.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + .02);
  g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + dur + .05);
}
// "ტამ ტა-ტა რააამ"
function fanfare() {
  [[392, 0, .16], [392, .18, .12], [392, .34, .12], [523, .52, 1.3], [659, .52, 1.3], [784, .52, 1.3], [1047, .52, 1.3]].forEach(([f, s, d]) => {
    tone(f, s, d, 'sawtooth', .09); tone(f, s, d, 'square', .05);
  });
}
// სევდიანი ტრომბონი "კუაა კუაა კუააა"
function bone(f, start, dur, endF, vib) {
  if (!ctx) return;
  const t0 = ctx.currentTime + start, o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t0);
  o.frequency.linearRampToValueAtTime(endF || f * .96, t0 + dur);
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t0); lp.frequency.linearRampToValueAtTime(1600, t0 + dur * .3); lp.frequency.linearRampToValueAtTime(600, t0 + dur);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.35, t0 + .06); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  if (vib) {
    const l = ctx.createOscillator(), lg = ctx.createGain();
    l.frequency.value = 6; lg.gain.value = 5; l.connect(lg).connect(o.frequency); l.start(t0); l.stop(t0 + dur + .05);
  }
  o.connect(lp).connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + dur + .05);
}
function sad() {
  bone(233, 0, .45, 222); bone(220, .55, .45, 208); bone(208, 1.1, .45, 196); bone(196, 1.65, 1.5, 150, true);
}

// სიმღერის კლიპი
let clip = null, clipFor = null;
function stopClip() { if (clip) { clip.pause(); clip = null; } }
async function playClip() {
  stopClip();
  const qid = S.live.qid; if (!qid) return;
  const snap = await db.ref('qaudio/' + qid).once('value');
  const data = snap.val(); if (!data) return;
  clip = new Audio(data); clip.play().catch(() => {});
}

// სიგნალები წამყვანისგან — პირველ მნიშვნელობას (გვერდის გახსნისას) არ ვუკრავთ
let seenSfx = undefined, seenAudio = undefined;
function handleSignals(l) {
  const sfx = l.sfx && l.sfx.n, au = l.audio && l.audio.n;
  if (seenSfx === undefined) seenSfx = sfx || 0;
  else if (sfx && sfx !== seenSfx) { seenSfx = sfx; if (l.sfx.kind === 'right') fanfare(); else sad(); }
  if (seenAudio === undefined) seenAudio = au || 0;
  else if (au && au !== seenAudio) { seenAudio = au; if (l.audio.cmd === 'play') playClip(); else stopClip(); }
}

// ───────── მონაცემები ─────────
const imgCache = {}; let imgNode = null;
async function loadImg(qid) {
  if (!qid || imgCache[qid] !== undefined) return;
  imgCache[qid] = null;
  const s = await db.ref('qimg/' + qid).once('value');
  imgCache[qid] = s.val() || '';
  render();
}
db.ref('session').on('value', s => { S.session = s.val(); render(); });
db.ref('players').on('value', s => { S.players = s.val() || {}; render(); });
db.ref('teams').on('value', s => { S.teams = s.val() || {}; render(); });
db.ref('awarded').on('value', s => { S.awarded = s.val() || {}; render(); });
db.ref('live').on('value', s => {
  const l = S.live = s.val() || {};
  handleSignals(l);
  if (l.qid !== S.curQ) {
    stopClip();
    if (S.curQ) db.ref('answers/' + S.curQ).off();
    S.curQ = l.qid || null; S.answers = {};
    if (S.curQ) {
      db.ref('answers/' + S.curQ).on('value', a => { S.answers = a.val() || {}; render(); });
      if (l.q && l.q.hasImg) loadImg(S.curQ);
    }
  }
  render();
});

// ───────── გამოსახვა ─────────
let lastHtml = '';
function view(html) {
  if (html !== lastHtml) {
    app.innerHTML = html; lastHtml = html;
    const ph = $('.qimg-ph');
    if (ph) {
      const qid = ph.dataset.q, data = imgCache[qid];
      if (data) {
        if (!imgNode || imgNode.dataset.q !== qid) { imgNode = new Image(); imgNode.className = 'qimg'; imgNode.dataset.q = qid; imgNode.src = data; }
        ph.replaceWith(imgNode);
      }
    }
  }
}
function teamsStrip(big, wrong) {
  return `<div class="teams ${big ? 'big' : ''}">${[0, 1, 2, 3].map(i => `<div class="tm ${wrong && wrong[i] ? 'out' : ''}" style="background:${TEAM_COLORS[i]}"><div class="n">${TEAM_EMOJI[i]} ${esc(teamName(S.teams, i))}</div><div class="s">${teamScore(S.teams, i)}</div></div>`).join('')}</div>`;
}
function qBlock(q) {
  return `<div class="q">${esc(q.text)}</div>` + (q.hasImg ? `<div class="imgbox"><div class="qimg-ph" data-q="${esc(S.live.qid)}"></div></div>` : '');
}
function joinInfo() {
  const base = location.href.replace(/tv\.html.*$/, '');
  return base.replace(/^https?:\/\//, '');
}

function render() {
  const l = S.live || {}, mode = l.mode || 'lobby';
  let h = '';
  if (mode === 'lobby') {
    const pl = Object.values(S.players);
    h = `<div class="scr"><div class="title">🎉 ფაციფუცობანა 🎉</div><div class="sub">გახსენი ტელეფონზე: <b>${esc(joinInfo())}</b></div><div class="sub">თამაშის კოდი:</div><div class="code">${esc(S.session ? S.session.code : '····')}</div><div class="chips">${pl.map(p => `<span class="chip">${esc(p.avatar)} ${esc(p.name)}</span>`).join('')}</div></div>`;
  } else if (mode === 'break') {
    h = `<div class="scr"><div class="title">☕ შესვენება 🍰</div><div class="sub">სასმელი, საჭმელი, ქირქილი!</div>${teamsStrip(true)}</div>`;
  } else if (mode === 'g1') h = g1();
  else if (mode === 'g2') h = g2();
  else if (mode === 'final') h = final();
  view(h);
}

function g1() {
  const l = S.live, q = l.q;
  if (!l.qid || !q) return `<div class="scr"><div class="title">⚡ ბლიც კითხვები ⚡</div>${teamsStrip(true)}</div>`;
  let over = '';
  const b = l.buzz;
  if (b) {
    over = `<div class="buzzcard"><div class="av">${esc(b.avatar)}</div><div class="nm">${esc(b.name)}</div><div class="tn" style="background:${TEAM_COLORS[b.team]}">${TEAM_EMOJI[b.team]} ${esc(teamName(S.teams, b.team))}</div>${l.phase === 'right' ? '<div class="title" style="font-size:8vw">✅ სწორია!</div>' : '<div class="sub">🔔 პირველმა დააჭირა!</div>'}${l.phase === 'right' && l.reveal ? `<div class="ans">${esc(l.reveal.answer)}</div>` : ''}</div>`;
  }
  const ansBox = (!b && l.reveal) ? `<div class="ansbox">✅ ${esc(l.reveal.answer)}</div>` : '';
  return `<div class="scr">${over}${qBlock(q)}${q.hasAudio ? '<div class="sub">🎵 გამოიცანი სიმღერა!</div>' : ''}${ansBox}<div style="flex:${q.hasImg ? 0 : 1}"></div>${teamsStrip(false, l.wrongTeams)}</div>`;
}

function g2() {
  const l = S.live, q = l.q;
  if (!l.qid || !q) return `<div class="scr"><div class="title">🤔 ფაცი თუ ფუცი? 🤔</div><div class="sub">მოემზადეთ!</div></div>`;
  if (l.view === 'scoreboard') return scoreboard();
  const opts = arr(q.options), phase = l.phase;
  const total = Object.keys(S.players).length;
  const answered = Object.keys(S.answers).filter(p => S.players[p]).length;
  const corr = phase === 'revealed' ? arr((l.reveal || {}).correct).map(Number) : [];
  const votes = opts.map((_, i) => Object.values(S.answers).filter(a => q.type === 'multi' ? arr(a.a).includes(i) : Number(a.a) === i).length);
  let body = '';
  if (q.type !== 'text') {
    body = `<div class="opts" style="${q.type === 'poll' ? 'grid-template-columns:1fr 1fr' : ''}">${opts.map((o, i) => {
      const cls = phase === 'revealed' && q.type !== 'poll' ? (corr.includes(i) ? 'good' : 'dim') : '';
      const showCt = phase === 'revealed' && q.type === 'poll';
      const pct = showCt && answered ? Math.round(100 * votes[i] / answered) : 0;
      return `<div class="op ${cls}" style="background:${OPT_COLORS[i]}">${showCt ? `<div class="bar-in" style="width:${pct}%"></div>` : ''}<span class="lt">${LETTERS[i]}</span><span>${esc(o)}</span>${showCt ? `<span class="ct">${votes[i]}</span>` : ''}</div>`;
    }).join('')}</div>`;
  }
  let status;
  if (phase === 'answering') status = `<div class="cnt">✍️ ${answered}/${total} უპასუხა</div>`;
  else if (phase === 'locked') status = `<div class="cnt">🔒 პასუხები დაკეტილია — ${answered}/${total}</div>`;
  else {
    const got = Object.keys(S.awarded[l.qid] || {}).filter(p => S.players[p]);
    if (q.type === 'poll') status = `<div class="cnt">🗳️ ხმა მისცა ${answered}-მა</div>`;
    else {
      const ansTxt = q.type === 'text' && l.reveal && l.reveal.answer ? `<div class="ansbox">✅ ${esc(l.reveal.answer)}</div>` : '';
      status = ansTxt + `<div class="cnt" style="background:#b8f2e6">🎉 სწორად უპასუხა ${got.length}-მა${got.length && got.length <= 8 ? ': ' + got.map(p => esc(S.players[p].avatar) + ' ' + esc(S.players[p].name)).join(', ') : ''}</div>`;
    }
  }
  return `<div class="scr">${qBlock(q)}${body}${status}</div>`;
}

function scoreboard() {
  const r = ranking(S.players, S.awarded);
  return `<div class="scr"><div class="title" style="font-size:5vw">🏆 ქულები 🏆</div><div class="rank">${r.map((p, i) => `<div class="rk ${i === 0 ? 'first' : ''}"><span class="pos">${i + 1}</span><span>${esc(p.avatar)}</span><span class="nm">${esc(p.name)}</span><span class="pt">${p.score}</span></div>`).join('')}</div></div>`;
}

const LOSER_LINES = [
  'ფუცის მეფე-დედოფალი! 👑 გვიყვარხარ, ოღონდ ცოტა მეტი ფაცი გვინდოდა 😄',
  'ბოლო ადგილიც ადგილია — იქიდან ყველაზე კარგად ჩანს ყველა! 🔭',
  'დღეს ფუცმა გაიმარჯვა, ფაცმა — არა! 🥔 მაგრამ გულით ჩემპიონი ხარ 💖',
  'ეს ადგილი შენ არავის დაგითმია — მიგიღია პატივით! 🛋️',
  'საპატიო ბოლო ადგილი! 🐢 ნელა წასვლა შორს მიდის... ალბათ 😂'
];
function final() {
  const l = S.live, step = l.step || 0, r = ranking(S.players, S.awarded);
  const slot = (i, cls, medal) => {
    const p = r[i];
    if (!p || step < (i === 2 ? 1 : i === 1 ? 2 : 3)) return `<div class="pl ${cls} empty"><div class="av">·</div><div class="bar"></div></div>`;
    return `<div class="pl ${cls}"><div class="av">${esc(p.avatar)}</div><div class="nm">${esc(p.name)}</div><div class="nm">${p.score} ქულა</div><div class="bar">${medal}</div></div>`;
  };
  let h = `<div class="scr"><div class="title" style="font-size:5vw">🏁 ფინალი 🏁</div>`;
  if (step === 0) h += `<div class="sub" style="font-size:5vw;margin-top:10vh">დრამის ბგერა... 🥁🥁🥁<br>ვინ აღმოჩნდება პოდიუმზე?</div>`;
  else if (step < 4) h += `<div class="podium">${slot(1, 'b2', '🥈')}${slot(0, 'b1', '🥇')}${slot(2, 'b3', '🥉')}</div>`;
  else {
    const p = r[r.length - 1];
    if (p) {
      const line = LOSER_LINES[(p.name || '').length % LOSER_LINES.length];
      h += `<div class="sub" style="font-size:4vw">და ბოლო ადგილს იკავებს...</div><div class="loser"><div class="av">${esc(p.avatar)}</div><div class="nm">🥔 ${esc(p.name)} 🥔</div><div class="nm" style="font-size:4vw">${p.score} ქულა</div><div class="tx">${line}</div></div>`;
    }
  }
  h += '</div>';
  if (step >= 3) confetti();
  return h;
}
let lastConf = 0;
function confetti() {
  const key = (S.live.step || 0);
  if (lastConf === key) return; lastConf = key;
  const em = key >= 4 ? ['🥔', '😂', '💖', '🎈'] : ['🎉', '✨', '🎊', '⭐', '💖'];
  for (let i = 0; i < 30; i++) {
    const d = document.createElement('div'); d.className = 'fall'; d.textContent = em[i % em.length];
    d.style.left = Math.random() * 100 + 'vw'; d.style.animationDuration = (3 + Math.random() * 3) + 's'; d.style.animationDelay = (Math.random() * 1.5) + 's';
    document.body.appendChild(d); setTimeout(() => d.remove(), 8000);
  }
}
render();
