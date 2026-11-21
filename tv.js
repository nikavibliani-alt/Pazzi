// ფაციფუცობანა — ტვ გვერდი (აქედან უკრავს ყველა ხმა)
const S = { session: null, live: {}, players: {}, teams: {}, awarded: {}, answers: {}, curQ: null };
const app = $('#app');
let cfgReady = false;

const setSoundLogo = () => { const e = $('#soundLogo'); if (e) e.innerHTML = logoHtml(); };
setSoundLogo();
watchConfig(() => {
  cfgReady = true; document.title = gameName(); setSoundLogo();
  if (SFX.ctx) SFX.preload(CFG.sounds);
  lastHtml = null; render();
});
$('#soundBtn').onclick = () => {
  SFX.enable(); SFX.preload(CFG.sounds); SFX.preload(qSfx(S.live));
  $('#sound').remove();
  SFX.tone(880, 0, .12, 'triangle', .15);
};

// სიმღერის კლიპი
let clip = null;
function stopClip() { if (clip) { clip.pause(); clip = null; } }
async function playClip() {
  stopClip();
  const id = S.live.q && S.live.q.snd; if (!id) return;
  const data = (await db.ref('libdata/snd/' + id).once('value')).val(); if (!data) return;
  clip = new Audio(data); clip.play().catch(() => {});
}

// ხმა: სიგნალები წამყვანისგან და გადასვლები. გვერდის გახსნისას პირველ მდგომარეობას არ ვუკრავთ.
let seenSfx, seenAudio, prevLive = null;
const qSfx = l => (l && l.q && l.q.sfx) || null; // კითხვის საკუთარი ხმები
function handleSignals(l) {
  const sfx = l.sfx && l.sfx.n, au = l.audio && l.audio.n;
  if (seenSfx === undefined) seenSfx = sfx || 0;
  else if (sfx && sfx !== seenSfx) { seenSfx = sfx; SFX.play(l.sfx.kind === 'right' ? 'right' : 'wrong', qSfx(l)); }
  if (seenAudio === undefined) seenAudio = au || 0;
  else if (au && au !== seenAudio) { seenAudio = au; if (l.audio.cmd === 'play') playClip(); else stopClip(); }
  const p = prevLive;
  if (p) {
    if (l.mode === 'g1' && l.buzz && (!p.buzz || p.buzz.pid !== l.buzz.pid) && l.qid === p.qid) SFX.play('buzz', qSfx(l));
    if (l.mode === 'g2' && l.qid === p.qid && p.phase !== 'revealed' && l.phase === 'revealed') { SFX.play('reveal', qSfx(l)); maybeWrongFx(l); }
    if (l.mode === 'g2' && l.view === 'scoreboard' && p.view !== 'scoreboard') SFX.play('scoreboard', qSfx(l));
    if (l.mode === 'final' && p.mode === 'final' && (l.step || 0) > (p.step || 0)) SFX.play(finalSteps()[(l.step || 1) - 1] === 'loser' ? 'loser' : 'podium');
  }
  prevLive = JSON.parse(JSON.stringify(l));
}

// ───────── მონაცემები ─────────
const imgCache = {}; let imgNode = null;
async function loadImg(id) {
  if (!id || imgCache[id] !== undefined) return;
  imgCache[id] = null;
  imgCache[id] = (await db.ref('libdata/img/' + id).once('value')).val() || '';
  lastHtml = null; render();
}
db.ref('session').on('value', s => { S.session = s.val(); render(); });
db.ref('players').on('value', s => { S.players = cleanPlayers(s.val()); render(); });
db.ref('teams').on('value', s => { S.teams = s.val() || {}; render(); });
db.ref('awarded').on('value', s => { S.awarded = s.val() || {}; render(); });
db.ref('library/sounds').on('value', s => { SFX.libMeta = s.val() || {}; });
let tvStreakQ = null, shownStreak = {};
db.ref('results').on('value', s => { S.results = s.val() || {}; tvStreakCheck(); });
function tvStreakCheck() {
  const res = S.results || {}, l = S.live || {};
  if (l.mode !== 'g2' || l.phase !== 'revealed' || !l.qid || !res[l.qid] || shownStreak[l.qid + (res[l.qid]._t || '')]) return;
  shownStreak[l.qid + (res[l.qid]._t || '')] = true;
  // „ტელეფონი და ტვ“ — ტვ აჩვენებს ყველაზე დიდ სერიას მოთამაშის სახელით
  const hits = Object.keys(S.players).map(pid => Object.assign({ pid }, streakHit(res, l.qid, pid) || {})).filter(h => h.step && h.step.where === 'both').sort((x, y) => y.n - x.n);
  if (hits[0]) setTimeout(() => playStep(hits[0].step, { caption: S.players[hits[0].pid].name + (hits[0].kind === 'correct' ? ` · ${hits[0].n} ზედიზედ სწორი!` : ` · ${hits[0].n} ზედიზედ შეცდომა`) }), 2600);
}
db.ref('live').on('value', s => {
  const l = S.live = s.val() || {};
  handleSignals(l);
  setTimeout(tvStreakCheck, 0);
  if (l.qid !== S.curQ) {
    stopClip();
    if (S.curQ) db.ref('answers/' + S.curQ).off();
    S.curQ = l.qid || null; S.answers = {};
    if (S.curQ) {
      db.ref('answers/' + S.curQ).on('value', a => { S.answers = a.val() || {}; render(); });
      if (l.q && l.q.img) loadImg(l.q.img);
      if (SFX.ctx && l.q && l.q.sfx) SFX.preload(l.q.sfx);
    }
  }
  render();
});

// ───────── გამოსახვა ─────────
let lastHtml = null, lastKey = '', enterT = null, boardKey = null, finKey = null;
function enter() { app.classList.add('enter'); clearTimeout(enterT); enterT = setTimeout(() => app.classList.remove('enter'), 1400); }
// ეკრანის „ტიპი“ (რეჟიმი + კითხვა): მისი შეცვლისას ძველი გადის, ახალი შემოდის
const screenOf = k => (k || '').split('|').slice(0, 2).join('|');
function view(html, key) {
  boardKey = null; finKey = null;
  if (html === lastHtml) return;
  let kind = null;
  if (key !== lastKey) { kind = lastKey && screenOf(key) !== screenOf(lastKey) ? 'slide' : null; enter(); lastKey = key; }
  swapScreen(app, html, kind); lastHtml = html;
  const ph = app.querySelector('.qimg-ph');
  if (ph) {
    const id = ph.dataset.id, data = imgCache[id];
    if (data) {
      if (!imgNode || imgNode.dataset.id !== id) { imgNode = new Image(); imgNode.className = 'qimg'; imgNode.dataset.id = id; imgNode.src = data; }
      ph.replaceWith(imgNode);
    }
  }
}
const imgPh = id => `<div class="qimg-ph" data-id="${esc(id)}"></div>`;
const tmStyle = i => `background:${TEAM_COLORS[i]};color:${TEAM_TEXT[i]}`;
// ვინ სცადა უკვე ამ კითხვაზე (გამკრთალებისთვის)
function tried(l, key) { const r = (l && l.q && l.q.rules) || {}; return r.afterWrong === 'all' ? (!r.sameTeamTwice && l.lastWrong === key) : !!(l && l.wrong && l.wrong[key]); }
function teamsStrip(big, l) {
  if (!teamsOn()) { // ყველა თავისთვის: საუკეთესო მოთამაშეები
    const r = ranking(S.players, S.awarded).slice(0, big ? 8 : 6);
    return `<div class="teams ${big ? 'big' : ''} stag" style="--n:${big ? Math.min(4, Math.max(2, r.length)) : Math.max(1, r.length)}">${r.map(p => `<div class="tm ${l && tried(l, 'p' + p.id) ? 'out' : ''}"><div class="n">${esc(p.name)}</div><div class="s">${fmtPts(p.score)}</div><div class="sl">ქულა</div></div>`).join('')}</div>`;
  }
  const n = teamCount();
  return `<div class="teams ${big ? 'big' : ''} stag" style="--n:${big ? (n > 4 ? 3 : 2) : n}">${Array.from({ length: n }, (_, i) => `<div class="tm ${l && tried(l, 't' + i) ? 'out' : ''}"><div class="n">${ttag(i, teamName(S.teams, i))}</div><div class="s">${fmtPts(teamScore(S.teams, i))}</div><div class="sl">ქულა</div></div>`).join('')}</div>`;
}
function joinInfo() { return location.href.replace(/tv\.html.*$/, '').replace(/^https?:\/\//, ''); }

function render() {
  if (!cfgReady) return;
  const l = S.live || {}, mode = l.mode || 'lobby';
  if (mode === 'g2' && l.view === 'scoreboard') return renderBoard();
  if (mode === 'final') return renderFinal();
  let h = '';
  if (mode === 'lobby') {
    const pl = Object.values(S.players);
    h = `<div class="scr">${logoHtml().replace('class="logo"', 'class="logo pop"')}<div class="sub">გახსენი ტელეფონზე: <b>${esc(joinInfo())}</b></div><div class="sub">თამაშის კოდი</div><div class="code pop">${esc(S.session ? S.session.code : '····')}</div><div class="chips">${pl.map(p => `<span class="chip pop"><span class="pic">${av(p.avatar)}</span>${esc(p.name)}</span>`).join('')}</div></div>`;
  } else if (mode === 'break') {
    h = `<div class="scr"><div class="title pop">შესვენება</div><div class="sub">სასმელი, საჭმელი, ქირქილი!</div>${teamsStrip(true)}</div>`;
  } else if (mode === 'g1') h = g1();
  else if (mode === 'g2') h = g2();
  view(h, mode + '|' + (l.qid || '') + '|' + (l.phase || '') + '|' + (l.buzz ? l.buzz.pid : ''));
}

function g1() {
  const l = S.live, q = l.q;
  if (!l.qid || !q) return `<div class="scr"><div class="title pop">ბლიც კითხვები</div>${teamsStrip(true)}</div>`;
  let over = '';
  const b = l.buzz;
  if (b) {
    over = `<div class="buzzcard"><div class="pic slam">${av(b.avatar)}</div><div class="nm slam">${esc(b.name)}</div>${teamsOn() ? `<div class="tn rise" style="background:${TEAM_HUES[b.team]}">${esc(teamName(S.teams, b.team))}</div>` : ''}${l.phase === 'right' ? `<div class="title pop" style="font-size:calc(var(--u)*6)">სწორია!</div>` : ''}${l.phase === 'right' && l.reveal ? `<div class="ans rise">${esc(l.reveal.answer)}</div>` : ''}</div>`;
  }
  const ansBox = (!b && l.reveal) ? `<div class="ansbox pop">${esc(l.reveal.answer)}</div>` : '';
  return `<div class="scr ${q.img ? 'hasimg' : ''}">${over}${tvQCard(q)}${q.img ? tvImgBox(imgPh(q.img)) : ''}${q.snd ? `<div class="sub">${ico('music')} გამოიცანი სიმღერა!</div>` : ''}${ansBox}${l.phase === 'missed' ? '<div class="cnt">ამ კითხვაზე ღილაკი დაიკეტა</div>' : ''}<div style="flex:${q.img ? 0 : 1}"></div>${teamsStrip(false, l)}</div>`;
}

function g2() {
  const l = S.live, q = l.q;
  if (!l.qid || !q) return `<div class="scr"><div class="title pop">ფაცი თუ ფუცი?</div><div class="sub">მოემზადეთ!</div></div>`;
  const opts = arr(q.options), phase = l.phase;
  const total = Object.keys(S.players).length;
  const answered = Object.keys(S.answers).filter(p => S.players[p]).length;
  const corr = phase === 'revealed' ? arr((l.reveal || {}).correct).map(Number) : [];
  const votes = opts.map((_, i) => Object.values(S.answers).filter(a => q.type === 'multi' ? arr(a.a).includes(i) : Number(a.a) === i).length);
  let status;
  if (phase === 'answering') status = `<div class="cnt">უპასუხა ${answered}/${total}</div>`;
  else if (phase === 'locked') status = `<div class="cnt">${ico('lock')} პასუხები დაიკეტა · ${answered}/${total}</div>`;
  else {
    const rightIds = Object.keys((l.reveal && l.reveal.right) || {}).filter(p => S.players[p]);
    const got = Object.keys(S.awarded[l.qid] || {}).filter(p => S.players[p] && Number(S.awarded[l.qid][p]) > 0);
    if (q.type === 'poll') status = `<div class="cnt">ხმა მისცა ${answered}-მა</div>`;
    else {
      const ansTxt = q.type === 'text' && l.reveal && l.reveal.answer ? `<div class="ansbox pop">${esc(l.reveal.answer)}</div>` : '';
      status = ansTxt + `<div class="cnt ok">სწორად უპასუხა ${rightIds.length}-მა${got.length && got.length <= 6 ? ' · ქულა: ' + got.map(p => esc(S.players[p].name) + ' +' + fmtPts(S.awarded[l.qid][p])).join(', ') : ''}</div>`;
    }
  }
  return `<div class="scr ${q.img ? 'hasimg' : ''}">${tvQCard(q)}${q.img ? tvImgBox(imgPh(q.img)) : ''}${tvOptions(q, { phase, corr, votes })}${status}</div>`;
}

// ქულების ცხრილი: რიგები გადაადგილდებიან ახალ ადგილზე
function renderBoard() {
  const l = S.live, key = 'sb:' + l.qid;
  if (boardKey === key) return;
  boardKey = key; finKey = null; lastHtml = null; lastKey = key; enter();
  const cur = ranking(S.players, S.awarded), pa = Object.assign({}, S.awarded); delete pa[l.qid];
  const prev = ranking(S.players, pa), prevIdx = {}, prevSc = {}, curIdx = {};
  prev.forEach((p, i) => { prevIdx[p.id] = i; prevSc[p.id] = p.score; });
  cur.forEach((p, i) => { curIdx[p.id] = i; });
  const n = cur.length || 1, rh = Math.min(8.4, 62 / n);
  const y = i => `translateY(calc(var(--v) * ${(rh * i).toFixed(2)}))`;
  const rows = cur.map(p => `<div class="sbrow ${prevIdx[p.id] === 0 ? 'first' : ''}" data-id="${p.id}" style="height:calc(var(--v) * ${(rh - 1).toFixed(2)});transform:${y(prevIdx[p.id] || 0)}"><span class="pos">${(prevIdx[p.id] || 0) + 1}</span><span class="pic">${av(p.avatar)}</span><span class="nm">${esc(p.name)}</span><span class="pt">${fmtPts(prevSc[p.id] || 0)}</span><span class="ptl">ქულა</span></div>`).join('');
  swapScreen(app, `<div class="scr"><div class="title pop" style="font-size:calc(var(--u)*4.6)">${esc(pickText('board_title', l.qid))}</div><div class="sb" style="height:calc(var(--v) * ${(rh * n).toFixed(2)})">${rows}</div></div>`, 'slide');
  setTimeout(() => {
    cur.forEach((p, i) => {
      const el = app.querySelector(`.sbrow[data-id="${p.id}"]`); if (!el) return;
      const from = prevSc[p.id] || 0, gain = Math.round((p.score - from) * 100) / 100;
      el.style.transform = y(i); $('.pos', el).textContent = i + 1;
      el.classList.toggle('first', i === 0);
      if (gain > 0) { el.classList.add('gain'); $('.nm', el).insertAdjacentHTML('beforeend', `<span class="plus">+${fmtPts(gain)}</span>`); }
      countUp($('.pt', el), from, p.score, 900);
    });
  }, 900);
}

// ქულის თვლა ზემოთ (0.67 → 1.67)
function countUp(el, a, b, ms) {
  if (!el) return; if (a === b) { el.textContent = fmtPts(b); return; }
  const t0 = performance.now();
  (function f(now) { const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmtPts(a + (b - a) * e); if (k < 1) requestAnimationFrame(f); })(t0);
}
const LOSER_FALLBACK = 'ბოლო ადგილიც ადგილია!';
function renderFinal() {
  const l = S.live, step = l.step || 0, steps = finalSteps();
  if (finKey !== 'final') {
    finKey = 'final'; boardKey = null; lastHtml = null; lastKey = 'final'; enter();
    const r = ranking(S.players, S.awarded), places = steps.filter(x => x[0] === 'p').length;
    const slot = (i, cls, medal) => { if (i >= places) return ''; const p = r[i]; return p ? `<div class="pl ${cls}" data-i="${i}"><div class="pic">${av(p.avatar)}</div><div class="nm">${esc(p.name)}</div><div class="nm" style="font-size:calc(var(--u)*2.2);color:var(--muted)">${fmtPts(p.score)} ქულა</div><div class="bar">${medal}</div></div>` : `<div class="pl ${cls}" data-i="${i}"></div>`; };
    const last = steps.includes('loser') ? r[r.length - 1] : null;
    swapScreen(app, `<div class="scr"><div class="title pop" style="font-size:calc(var(--u)*4.6)">${esc(pickText('podium_title', 'final'))}</div><div class="sub" id="drum">${ico('drum')} ${ico('drum')} ${ico('drum')}</div><div class="podium">${slot(1, 'b2', 2)}${slot(0, 'b1', 1)}${slot(2, 'b3', 3)}</div>` +
      (last ? `<div class="loserbox" id="loserbox"><div class="sub">და ბოლო ადგილს იკავებს...</div><div class="pic">${av(last.avatar)}</div><div class="nm title" style="-webkit-text-stroke:0;text-shadow:none;color:var(--ink)">${esc(last.name)}</div><div class="sub">${fmtPts(last.score)} ქულა</div><div class="tx">${esc(pickText('loser', 'loser' + last.name, last.name))}</div></div>` : '') + '</div>', 'slide');
  }
  const shown = steps.slice(0, step);
  app.querySelectorAll('.pl').forEach(el => { el.classList.toggle('show', !!el.firstChild && shown.includes('p' + el.dataset.i)); });
  const d = document.getElementById('drum'); if (d) d.style.display = step >= 1 ? 'none' : '';
  const lb = document.getElementById('loserbox'); if (lb) lb.classList.toggle('show', shown.includes('loser'));
}
function confetti(loser) {
  return; // დეკორაციის გარეშე

  const em = ['·'];
  for (let i = 0; i < 30; i++) {
    const d = document.createElement('div'); d.className = 'fall'; d.textContent = em[i % em.length];
    d.style.left = Math.random() * 100 + 'vw'; d.style.animationDuration = (3 + Math.random() * 3) + 's'; d.style.animationDelay = (Math.random() * 1.5) + 's';
    document.body.appendChild(d); setTimeout(() => d.remove(), 8000);
  }
}
render();


// ───────── „როცა ვინმე შეცდება“: სურათი / GIF / ვიდეო / ეფექტი ტვ-ზე გამოაშკარავებისას ─────────
function maybeWrongFx(l) {
  const fx = l.q && l.q.wrongFx; if (!fx || l.q.type === 'poll') return;
  const right = (l.reveal && l.reveal.right) || {};
  const someoneWrong = Object.keys(S.answers).some(p => S.players[p] && !right[p]);
  if (someoneWrong) setTimeout(() => playWrongFx(fx), 700);
}
async function playWrongFx(fx) {
  let box = document.getElementById('fx'); if (box) box.remove();
  box = document.createElement('div'); box.id = 'fx'; box.className = 'fxbox';
  document.body.appendChild(box);
  const done = ms => setTimeout(() => { box.classList.add('fxout'); setTimeout(() => box.remove(), 400); }, ms);
  if (fx.type === 'img' && fx.id) {
    const d = (await db.ref('libdata/img/' + fx.id).once('value')).val(); if (!d) return box.remove();
    box.innerHTML = `<img class="fxmedia" src="${d}" alt="">`; done(3800);
  } else if (fx.type === 'video' && fx.id) {
    const d = (await db.ref('libdata/vid/' + fx.id).once('value')).val(); if (!d) return box.remove();
    box.innerHTML = `<video class="fxmedia" src="${d}" autoplay playsinline></video>`;
    const v = box.querySelector('video'); v.muted = !SFX.ctx; v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
    v.onended = () => done(0); done(11000);
  } else if (fx.type === 'effect' && fx.name) {
    box.remove(); runFx(fx.name, { text: fx.name === 'stamp' ? 'შეცდომა!' : '' });
  } else box.remove();
}
