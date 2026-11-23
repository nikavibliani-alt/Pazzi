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
// დაკვრა / პაუზა (ადგილი რჩება) / გაგრძელება / გაჩერება (თავიდან); ტვ წამყვანს ატყობინებს, რა უკრავს
let clip = null, clipTok = 0, clipName = '';
const sndName = id => ((SFX.libMeta || {})[id] || {}).name || 'კლიპი';
function tvAudioState(kind, name, state) { db.ref('tvstate/audio').set(state === 'stopped' ? null : { kind, name: name || '', state, at: Date.now() }); }
function stopClip() { clipTok++; if (clip) { clip.pause(); clip.currentTime = 0; clip = null; tvAudioState('clip', clipName, 'stopped'); } }
async function playClip() {
  stopClip(); const tok = clipTok;
  const id = S.live.q && S.live.q.snd; if (!id) return;
  const data = (await db.ref('libdata/snd/' + id).once('value')).val(); if (!data || tok !== clipTok) return; // სანამ იტვირთებოდა, გააჩერეს
  clipName = sndName(id);
  const a = clip = new Audio(data);
  a.onplaying = () => { if (clip === a) tvAudioState('clip', clipName, 'playing'); };
  a.onpause = () => { if (clip === a && !a.ended) tvAudioState('clip', clipName, 'paused'); };
  a.onended = () => { if (clip === a) { clip = null; tvAudioState('clip', clipName, 'stopped'); } };
  a.play().catch(() => {});
}
function clipCmd(cmd) {
  if (cmd === 'play') return playClip();
  if (cmd === 'pause') { clipTok++; if (clip) clip.pause(); return; }
  if (cmd === 'resume') { if (clip) clip.play().catch(() => {}); else playClip(); return; }
  stopClip();
}
// ყველაფრის გაჩერება: კლიპი, YouTube, ეფექტების ხმები, ვიდეოები
function stopEverything() {
  stopClip();
  if (ytP && ytReady) { try { ytP.stopVideo(); } catch (e) {} }
  SFX.stopAll(); fxStopAll();
  document.querySelectorAll('video').forEach(v => { try { v.pause(); } catch (e) {} });
}
let seenStopAll;
db.ref('ctl/stopall').on('value', s => { const n = (s.val() || {}).n || 0; if (seenStopAll === undefined) seenStopAll = n; else if (n !== seenStopAll) { seenStopAll = n; stopEverything(); } });

// ხმა: სიგნალები წამყვანისგან და გადასვლები. გვერდის გახსნისას პირველ მდგომარეობას არ ვუკრავთ.
let seenSfx, seenAudio, prevLive = null;
const qSfx = l => (l && l.q && l.q.sfx) || null; // კითხვის საკუთარი ხმები
function handleSignals(l) {
  const sfx = l.sfx && l.sfx.n, au = l.audio && l.audio.n;
  if (seenSfx === undefined) seenSfx = sfx || 0;
  else if (sfx && sfx !== seenSfx) { seenSfx = sfx; SFX.play(l.sfx.kind === 'right' ? 'right' : 'wrong', qSfx(l)); }
  if (seenAudio === undefined) seenAudio = au || 0;
  else if (au && au !== seenAudio) { seenAudio = au; clipCmd(l.audio.cmd); }
  const p = prevLive;
  if (p) {
    if (l.mode === 'g1' && l.buzz && (!p.buzz || p.buzz.pid !== l.buzz.pid) && l.qid === p.qid) SFX.play('buzz', qSfx(l));
    if (l.mode === 'g2' && l.qid === p.qid && p.phase !== 'revealed' && l.phase === 'revealed') { SFX.play('reveal', qSfx(l)); maybeWrongFx(l); }
    if (l.mode === 'g2' && l.view === 'scoreboard' && p.view !== 'scoreboard') SFX.play('scoreboard', qSfx(l));

  }
  // გუნდის ეფექტი: სწორი პასუხის შემდეგ ჯერ „სწორია!“ ბარათი ქრება, მერე ჩანს სვეტი
  if (p) Object.entries(l.tfx || {}).forEach(([team, f]) => { const o = (p.tfx || {})[team]; if (f && f.at && (!o || o.at !== f.at)) setTimeout(() => teamFx(Number(team), f), l.phase === 'right' ? 2700 : l.mark && Date.now() - l.mark.n < 2000 ? 2000 - (Date.now() - l.mark.n) + 150 : 60); });
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
db.ref('players').on('value', s => { S.players = cleanPlayers(s.val()); if (S.live && S.live.phase === 'answering') autoLock(S.players, S.answers); render(); });
db.ref('teams').on('value', s => { S.teams = s.val() || {}; render(); });
db.ref('tstreak').on('value', s => { S.tstreak = s.val() || {}; render(); });
db.ref('battles').on('value', s => { S.battles = s.val() || null; render(); });
db.ref('polls').on('value', s => { S.polls = s.val() || null; });
db.ref('yt').on('value', s => { S.yt = s.val() || null; applyYt(); });
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
let tvMode;
db.ref('live').on('value', s => {
  const l = S.live = s.val() || {};
  const scrKey = (l.mode || 'lobby') + '|' + (l.mode === 'intro' ? l.key : '');
  if (tvMode !== undefined && scrKey !== tvMode) { stopClip(); if (ytP && ytReady) { try { ytP.stopVideo(); } catch (e) {} } SFX.stopAll(); } // ეკრანის შეცვლა აჩერებს მუსიკას
  if (tvMode !== undefined && scrKey !== tvMode && (l.mode === 'intro' || l.mode === 'break')) setTimeout(() => SFX.play('intro'), 80); // შესავლის ხმა
  tvMode = scrKey;
  handleSignals(l);
  if (l.mode === 'pvote' && l.round !== S.pround) {
    if (S.pref) S.pref.off(); S.pround = l.round; S.pvotes = {};
    S.pref = db.ref('pvotes/' + l.round); S.pref.on('value', v => { S.pvotes = v.val() || {}; if (S.live.phase === 'voting') pollAutoLock(S.players, S.pvotes); render(); });
  }
  if (l.mode === 'battle' && l.round !== S.bround) {
    if (S.bref) S.bref.off(); S.bround = l.round; S.bvotes = {};
    S.bref = db.ref('bvotes/' + l.round); S.bref.on('value', v => { S.bvotes = v.val() || {}; if (S.live.phase === 'voting') battleAutoLock(S.players, S.live.perf, S.bvotes); render(); });
  }
  setTimeout(tvStreakCheck, 0);
  if (l.qid !== S.curQ) {
    stopClip();
    if (S.curQ) db.ref('answers/' + S.curQ).off();
    S.curQ = l.qid || null; S.answers = {};
    if (S.curQ) {
      db.ref('answers/' + S.curQ).on('value', a => { S.answers = a.val() || {}; if (S.live.phase === 'answering') autoLock(S.players, S.answers); render(); });
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
  if (mode === 'battle') return renderBattle();
  if (mode === 'pvote') return renderPvote();
  let h = '';
  if (mode === 'lobby') {
    const pl = Object.values(S.players);
    h = `<div class="scr">${logoHtml().replace('class="logo"', 'class="logo pop"')}<div class="sub">გახსენი ტელეფონზე: <b>${esc(joinInfo())}</b></div><div class="sub">თამაშის კოდი</div><div class="code pop">${esc(S.session ? S.session.code : '····')}</div><div class="chips">${pl.map(p => `<span class="chip pop"><span class="pic">${av(p.avatar)}</span>${esc(p.name)}</span>`).join('')}</div></div>`;
  } else if (mode === 'break') {
    { const it = introOf('break', S.battles); h = `<div class="scr"><div class="title pop">${esc(it.title)}</div>${it.text.split('\n').filter(x => x.trim()).map(x => `<div class="sub">${esc(x)}</div>`).join('')}${teamCols(null)}</div>`; }
  } else if (mode === 'intro') h = introScr(l);
  else if (mode === 'g1') h = g1();
  else if (mode === 'g2') h = g2();
  view(h, mode + '|' + (l.key || '') + '|' + (l.qid || '') + '|' + (l.phase || '') + '|' + (l.buzz ? l.buzz.pid : '') + '|' + ((l.media || {}).show || '') + '|' + (l.audio && (l.audio.cmd === 'play' || l.audio.cmd === 'resume') ? 'm' : '') + '|' + (l.mark && Date.now() - l.mark.n < 2000 ? l.mark.n : ''));
  placeVideo();
}

// შესავალი: თამაშის სახელი დიდად, წესების 1–2 ხაზი; ბლიცში — გუნდები თავიანთი ფერებით
function introScr(l) {
  const it = introOf(l.key, S.battles);
  const teams = l.key === 'g1' ? `<div class="introteams">${Array.from({ length: teamCount() }, (_, i) => `<span class="ttag pop" style="--t:${TEAM_HUES[i]};animation-delay:${.25 + i * .12}s">${esc(teamName(S.teams, i))}</span>`).join('')}</div>` : '';
  return `<div class="scr introscr"><div class="sub rise">მზად ხართ?</div><div class="title pop introtitle">${esc(it.title)}</div>${it.text.split('\n').filter(x => x.trim()).slice(0, 3).map((x, i) => `<div class="introline rise" style="animation-delay:${.15 + i * .12}s">${esc(x)}</div>`).join('')}${teams}</div>`;
}
let markT = null;
function g1() {
  const l = S.live, q = l.q || {}, show = (l.media || {}).show;
  if (l.qid && show && ((show === 'img' && q.img) || (show === 'video' && q.vid))) return mediaFull(q, show);
  let over = '';
  const mk = l.mark, mkOn = mk && Date.now() - mk.n < 2000;
  if (mkOn) { clearTimeout(markT); markT = setTimeout(render, 2000 - (Date.now() - mk.n) + 30); return `<div class="scr g1scr"><div class="markcard ${mk.kind === 'r' ? 'right' : 'wrong'} pop" style="--t:${TEAM_HUES[mk.team] || 'var(--bg)'}"><div class="mk-team">${esc(teamName(S.teams, mk.team))}</div><div class="mk-what">${mk.kind === 'r' ? 'სწორია!' : 'არასწორია!'}</div>${mk.pts ? `<div class="mk-pts">${mk.pts > 0 ? '+' : '−'}${fmtPts(Math.abs(mk.pts))}</div>` : ''}</div></div>`; }
  const b = l.buzz;
  if (b && l.phase !== 'right') over = `<div class="buzzcard ${l.phase === 'right' ? 'won' : ''}" style="${teamsOn() ? `background:${TEAM_HUES[b.team] || 'var(--bg)'}` : ''}"><div class="pic slam">${av(b.avatar)}</div><div class="nm slam">${esc(b.name)}</div>${teamsOn() ? `<div class="tn rise">${esc(teamName(S.teams, b.team))}</div>` : ''}${l.phase === 'right' ? `<div class="title pop" style="font-size:calc(var(--u)*6)">სწორია!</div>` : ''}</div>`;
  const music = l.qid && l.q && l.q.snd && l.audio && (l.audio.cmd === 'play' || l.audio.cmd === 'resume') ? `<span class="g1music pop">${ico('music')}</span>` : '';
  return `<div class="scr g1scr">${over}<div class="title pop" style="font-size:calc(var(--u)*3.6)">ბლიცი${music}</div>${l.phase === 'missed' ? '<div class="cnt">ამ კითხვაზე ღილაკი დაიკეტა</div>' : ''}${teamCols(l)}</div>`;
}
// გუნდების სვეტები: ქულა ზემოთ, სვეტი იზრდება ყოველ ქულაზე; სერიაზე ცეცხლი
function teamCols(l) {
  let cols;
  if (teamsOn()) cols = Array.from({ length: teamCount() }, (_, i) => ({ key: 't' + i, i, name: teamName(S.teams, i), score: teamScore(S.teams, i), hue: TEAM_HUES[i], fire: teamFireLevel(((S.tstreak || {})[i] || {}).c || 0) }));
  else cols = ranking(S.players, S.awarded).slice(0, 8).map(p => ({ key: 'p' + p.id, i: -1, name: p.name, score: p.score, hue: 'var(--pink-l)', fire: '' }));
  const max = Math.max(5, ...cols.map(c => c.score));
  return `<div class="cols3" style="--n:${Math.max(1, cols.length)}">${cols.map(c => `<div class="tcolv ${l && tried(l, c.key) ? 'out' : ''} ${c.fire ? 'fire-' + c.fire : ''}" data-team="${c.i}"><div class="tscore">${fmtPts(c.score)}<small>ქულა</small></div><div class="tbarwrap"><div class="tbar" style="height:${Math.max(4, Math.round(100 * Math.max(0, c.score) / max))}%;background:${c.hue}">${c.fire ? FLAMES : ''}</div></div><div class="tname"><span class="ttag" style="--t:${c.hue}">${esc(c.name)}</span></div></div>`).join('')}</div>`;
}
const FLAMES = '<svg class="flames" viewBox="0 0 100 70" preserveAspectRatio="none" aria-hidden="true"><path class="f1" d="M10 70 C 8 50 22 44 18 26 C 30 36 32 48 34 54 C 38 40 36 22 48 6 C 52 26 62 30 60 50 C 66 42 70 34 68 22 C 82 36 92 52 88 70 Z" fill="#FFB238"/><path class="f2" d="M22 70 C 22 56 32 52 30 40 C 40 48 40 56 42 60 C 46 50 46 38 54 28 C 58 42 64 48 62 60 C 68 54 72 48 72 40 C 80 50 82 60 78 70 Z" fill="#FF6A3D"/><path class="f3" d="M36 70 C 36 62 44 58 44 50 C 50 56 50 62 52 64 C 54 58 56 52 60 48 C 64 56 66 62 64 70 Z" fill="#FFE2A8"/></svg>';
// სვეტის ერთჯერადი ეფექტები (ცალკე ფენა — ხელახალი დახატვა არ შლის)
function teamFx(team, f) {
  const col = app.querySelector(`.tcolv[data-team="${team}"]`), cfg = teamStreakCfg();
  if (cfg.on === false) return;
  const step = f.kind === 'end' ? null : ((f.kind === 'c' ? cfg.correct : cfg.wrong) || {})[f.n];
  const eff = f.kind === 'end' ? 'smoke' : step && step.effect;
  if (step && step.sound) SFX.preview(step.sound, 'right');
  if (step && step.media && (step.media.url || step.media.id)) showMedia({ url: step.media.url, id: step.media.id, kind: step.media.type === 'video' ? 'video' : 'img' }, step.dur, teamName(S.teams, team));
  if (!eff) return;
  if (FX_LIST.some(x => x[0] === eff)) return runFx(eff, { text: step.text });
  if (!col) return;
  const r = col.querySelector('.tbar').getBoundingClientRect(), L = document.createElement('div');
  L.className = 'colfx colfx-' + eff; L.style.cssText = `left:${r.left}px;top:${Math.min(r.top, innerHeight * .7) - 40}px;width:${r.width}px;height:${Math.max(r.height, 120) + 40}px`;
  if (eff === 'sparks' || eff === 'colfireworks') L.innerHTML = Array.from({ length: eff === 'sparks' ? 14 : 34 }, () => `<i style="--x:${(Math.random() * 2 - 1).toFixed(2)};--y:${(-.4 - Math.random()).toFixed(2)};--c:${FX_COLORS[Math.floor(Math.random() * FX_COLORS.length)]};animation-delay:${(Math.random() * (eff === 'sparks' ? .2 : .9)).toFixed(2)}s"></i>`).join('');
  if (eff === 'smoke') L.innerHTML = Array.from({ length: 7 }, (_, k) => `<b style="--x:${(k - 3) * 12}%;animation-delay:${k * .05}s"></b>`).join('');
  if (eff === 'shiver') { col.classList.remove('shiver'); void col.offsetWidth; col.classList.add('shiver'); setTimeout(() => col.classList.remove('shiver'), 1600); }
  if (eff === 'flames' || eff === 'bigflames') L.innerHTML = Array.from({ length: 10 }, () => `<i style="--x:${(Math.random() * 2 - 1).toFixed(2)};--y:${(-.4 - Math.random()).toFixed(2)};--c:#FFB238"></i>`).join('');
  document.body.appendChild(L); setTimeout(() => L.remove(), eff === 'colfireworks' ? 2600 : 1600);
}
// სურათი ან ვიდეო მთელ ეკრანზე (წამყვანი აჭერს „ჩვენებას“)
function mediaFull(q, kind) {
  if (kind === 'img') { if (q.img) loadImg(q.img); return `<div class="scr mediafull"><div class="imgbox">${imgPh(q.img)}</div></div>`; }
  loadVid(q.vid); return `<div class="scr mediafull"><div class="imgbox"><div class="qvid-ph" data-id="${esc(q.vid)}"></div></div></div>`;
}
const vidCache = {}; let vidNode = null;
async function loadVid(id) {
  if (!id || vidCache[id] !== undefined) return;
  vidCache[id] = null; vidCache[id] = (await db.ref('libdata/vid/' + id).once('value')).val() || ''; lastHtml = null; render();
}
function placeVideo() {
  const ph = app.querySelector('.qvid-ph');
  if (!ph) { if (vidNode) { vidNode.pause(); vidNode = null; } return; }
  const id = ph.dataset.id, data = vidCache[id]; if (!data) return;
  if (!vidNode || vidNode.dataset.id !== id) { if (vidNode) vidNode.pause(); vidNode = document.createElement('video'); vidNode.className = 'qimg'; vidNode.dataset.id = id; vidNode.src = data; vidNode.playsInline = true; vidNode.play().catch(() => { vidNode.muted = true; vidNode.play().catch(() => {}); }); }
  ph.replaceWith(vidNode);
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
  else if (phase === 'locked') status = l.autoLocked ? `<div class="cnt ok">ყველამ უპასუხა!</div>` : `<div class="cnt">${ico('lock')} პასუხები დაიკეტა · ${answered}/${total}</div>`;
  else {
    const rightIds = Object.keys((l.reveal && l.reveal.right) || {}).filter(p => S.players[p]);
    const got = Object.keys(S.awarded[l.qid] || {}).filter(p => S.players[p] && Number(S.awarded[l.qid][p]) > 0);
    if (q.type === 'poll') status = `<div class="cnt">ხმა მისცა ${answered}-მა</div>`;
    else {
      const ansTxt = q.type === 'text' && l.reveal && l.reveal.answer ? `<div class="ansbox pop">${esc(l.reveal.answer)}</div>` : '';
      status = ansTxt + `<div class="cnt ok">სწორად უპასუხა ${rightIds.length}-მა${got.length && got.length <= 6 ? ' · ქულა: ' + got.map(p => esc(S.players[p].name) + ' +' + fmtPts(S.awarded[l.qid][p])).join(', ') : ''}</div>`;
    }
  }
  const show = (l.media || {}).show;
  if (show === 'video' && q.vid) return mediaFull(q, 'video');
  const pic = show === 'img' && q.img;
  return `<div class="scr ${pic ? 'hasimg' : ''}">${tvQCard(q)}${pic ? tvImgBox(imgPh(q.img)) : ''}${tvOptions(q, { phase, corr, votes })}${status}</div>`;
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
let finShown = 0, finTimer = null, finDrum = null;
const DRUM_MS = 2800;
function finalSource(game) { // თამაში 1 → გუნდები, თამაში 2 → მონაწილეები
  if (game === 1 && teamsOn()) return Array.from({ length: teamCount() }, (_, i) => ({ id: 't' + i, name: teamName(S.teams, i), score: teamScore(S.teams, i), hue: TEAM_HUES[i] })).sort((a, b) => b.score - a.score);
  return ranking(S.players, S.awarded);
}
function stepsFor(game) { return game === 1 ? finalSteps().filter(x => x !== 'loser').slice(-Math.min(3, teamsOn() ? teamCount() : 3)) : finalSteps(); }
function renderFinal() {
  const l = S.live, step = l.step || 0, game = l.game === 1 ? 1 : 2, steps = stepsFor(game);
  if (finKey !== 'final' + game) {
    finKey = 'final' + game; boardKey = null; lastHtml = null; lastKey = 'final'; enter(); finShown = step; clearTimeout(finTimer);
    const r = finalSource(game), places = steps.filter(x => x[0] === 'p').length;
    const face = p => p.avatar ? `<div class="pic">${av(p.avatar)}</div>` : `<div class="pic teampic" style="background:${p.hue}"></div>`;
    const slot = (i, cls, medal) => { if (i >= places) return ''; const p = r[i]; return p ? `<div class="pl ${cls}" data-i="${i}">${face(p)}<div class="nm">${esc(p.name)}</div><div class="nm" style="font-size:calc(var(--u)*2.2);color:var(--muted)">${fmtPts(p.score)} ქულა</div><div class="bar">${medal}</div></div>` : `<div class="pl ${cls}" data-i="${i}"></div>`; };
    const last = steps.includes('loser') ? r[r.length - 1] : null;
    swapScreen(app, `<div class="scr"><div class="title pop" style="font-size:calc(var(--u)*4.6)">${esc(game === 1 ? 'ბლიცის შედეგები' : pickText('podium_title', 'final'))}</div><div class="sub" id="drum">${ico('drum')} ${ico('drum')} ${ico('drum')}</div><div class="podium">${slot(1, 'b2', 2)}${slot(0, 'b1', 1)}${slot(2, 'b3', 3)}</div>` +
      (last ? `<div class="loserbox" id="loserbox"><div class="sub">და ბოლო ადგილს იკავებს...</div><div class="pic">${av(last.avatar)}</div><div class="nm title" style="-webkit-text-stroke:0;text-shadow:none;color:var(--ink)">${esc(last.name)}</div><div class="sub">${fmtPts(last.score)} ქულა</div><div class="tx">${esc(pickText('loser', 'loser' + last.name, last.name))}</div></div>` : '') + '</div>', 'slide');
  }
  if (step > finShown && !finTimer) { // დრამი → დარტყმა → სახელი
    const d = document.getElementById('drum'); if (d) { d.style.display = ''; d.classList.add('rolling'); }
    finDrum = SFX.playStoppable('drumroll');
    finTimer = setTimeout(() => {
      finTimer = null; finShown = S.live.step || 0; if (finDrum) finDrum.stop(); finDrum = null;
      SFX.crash(); SFX.play(stepsFor(game)[finShown - 1] === 'loser' ? 'loser' : 'podium');
      applyFinal(stepsFor(game)); renderFinal();
    }, DRUM_MS);
    return;
  }
  if (step < finShown) { finShown = step; clearTimeout(finTimer); finTimer = null; if (finDrum) finDrum.stop(); }
  if (!finTimer) applyFinal(steps);
}
function applyFinal(steps) {
  const shown = steps.slice(0, finShown);
  app.querySelectorAll('.pl').forEach(el => { el.classList.toggle('show', !!el.firstChild && shown.includes('p' + el.dataset.i)); });
  const d = document.getElementById('drum'); if (d) { d.classList.remove('rolling'); d.style.display = finShown >= 1 ? 'none' : ''; }
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


// ───────── „როცა ვინმე შეცდება“: სურათი / GIF / ვიდეო / ეფექტი ტვ-ზე პასუხის გახსნისას ─────────
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


// ───────── ბრძოლები (ხმის მიცემა) ─────────
const battlesAll = () => S.battles || DEFAULT_BATTLES;
let bresKey = null;
function renderBattle() {
  const l = S.live, b = battlesAll()[l.bid] || { name: 'ბრძოლა' }, perf = Object.keys(l.perf || {}).filter(id => S.players[id]);
  if (l.phase === 'result') return battleResult(l, b, perf);
  bresKey = null;
  const voters = Object.keys(S.players).filter(id => !(l.perf || {})[id]), voted = Object.keys(S.bvotes || {}).filter(id => voters.includes(id)).length;
  const status = l.phase === 'voting' ? `<div class="cnt">ხმა მისცა ${voted}/${voters.length}</div>` : `<div class="cnt ok">${l.autoLocked ? 'ყველამ მისცა ხმა!' : 'ხმის მიცემა დაიხურა'}</div>`;
  view(`<div class="scr battle"><div class="title pop">${esc(b.name)}</div><div class="bperf stag">${perf.map(id => `<div class="bcard"><div class="pic">${av(S.players[id].avatar)}</div><div class="nm">${esc(S.players[id].name)}</div></div>`).join('')}</div>${status}</div>`, 'battle|' + l.round + '|' + l.phase);
}
// შედეგი: მუსიკა ქრება → დრამი → ზოლები იზრდება → გამარჯვებული + ეფექტები → (ვიდეო)
function battleResult(l, b, perf) {
  const key = 'bres' + l.round; if (bresKey === key) return; bresKey = key; boardKey = null; finKey = null; lastHtml = null; lastKey = key;
  const { list, winners } = battleCount(l.perf, S.bvotes), max = Math.max(1, ...list.map(x => x.n));
  const names = winners.filter(id => S.players[id]).map(id => S.players[id].name).join(' და ');
  swapScreen(app, `<div class="scr battle"><div class="title pop">${esc(b.name)}</div><div class="sub" id="bdrum">${ico('drum')} ${ico('drum')} ${ico('drum')}</div>
    <div class="bbars hidden" id="bbars">${list.filter(x => S.players[x.pid]).map(x => `<div class="bbar ${winners.includes(x.pid) ? 'win' : ''}"><span class="pic">${av(S.players[x.pid].avatar)}</span><span class="nm">${esc(S.players[x.pid].name)}</span><span class="track"><span class="fill" style="--w:${Math.round(100 * x.n / max)}%"></span></span><b>${x.n}</b></div>`).join('')}</div>
    <div class="bwin hidden" id="bwin">${winners.length ? `<div class="bwpics">${winners.filter(id => S.players[id]).map(id => `<span class="pic">${av(S.players[id].avatar)}</span>`).join('')}</div><div class="bwname">${esc(names)}</div><div class="bwtext">${esc(pickText('battle_win', l.round, names))}</div>` : '<div class="bwname">ხმები არ არის</div>'}</div></div>`, 'slide');
  ytFade();
  setTimeout(() => {
    const d = document.getElementById('bdrum'); if (d) d.classList.add('rolling');
    const drum = SFX.playStoppable('drumroll');
    setTimeout(() => {
      drum.stop(); SFX.crash();
      const bb = document.getElementById('bbars'), dd = document.getElementById('bdrum'); if (dd) dd.remove(); if (bb) bb.classList.remove('hidden');
      setTimeout(() => {
        const w = document.getElementById('bwin'); if (w) w.classList.remove('hidden'); if (!winners.length) return;
        SFX.play('podium');
        const win = b.win || {};
        if (win.sound) SFX.preview(win.sound, 'podium');
        if (win.media && (win.media.url || win.media.id)) showMedia({ url: win.media.url, id: win.media.id, loop: win.media.loop, kind: win.media.kind || (win.media.type === 'video' ? 'video' : undefined) }, win.dur || 4, names);
        if (win.effect) runFx(win.effect, { text: names });
        if (win.video) setTimeout(() => playFullVideo(win.video), (Number(win.videoDelay) || 2) * 1000);
      }, 1400);
    }, DRUM_MS);
  }, ytPlaying() ? 1300 : 200);
}

// ───────── YouTube მუსიკა ტვ-დან (დამალული ფლეერი; „ვიდეოს ჩვენება“ — ეკრანზე) ─────────
let ytP = null, ytReady = false, ytVid = null, ytLoading = false;
function ytEnsure() {
  if (ytP || ytLoading) return; ytLoading = true;
  const box = document.createElement('div'); box.id = 'ytbox'; box.className = 'ytbox'; box.innerHTML = '<div id="ytplayer"></div>'; document.body.appendChild(box);
  const make = () => { ytP = new YT.Player('ytplayer', { width: '100%', height: '100%', playerVars: { autoplay: 0, controls: 0, playsinline: 1, rel: 0, modestbranding: 1 }, events: { onReady: () => { ytReady = true; applyYt(); }, onStateChange: e => { const t = (ytP.getVideoData && ytP.getVideoData().title) || 'YouTube'; tvAudioState('yt', t, e.data === 1 ? 'playing' : e.data === 2 ? 'paused' : e.data === 3 ? 'playing' : 'stopped'); } } }); };
  if (window.YT && YT.Player) make();
  else { window.onYouTubeIframeAPIReady = make; const sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(sc); }
}
const ytPlaying = () => !!(ytP && ytReady && ytP.getPlayerState && ytP.getPlayerState() === 1);
let ytSeen = null;
function applyYt() {
  const y = S.yt; if (!y || !y.vid) return;
  if (!ytP) return ytEnsure(); if (!ytReady) return;
  document.getElementById('ytbox').classList.toggle('show', !!y.show);
  const sig = y.n + y.cmd; if (sig === ytSeen) { ytP.setVolume(Number(y.vol == null ? 80 : y.vol)); return; } ytSeen = sig;
  if (y.cmd === 'play') { if (y.vid !== ytVid) { ytVid = y.vid; ytP.loadVideoById(y.vid); } else ytP.playVideo(); ytP.setVolume(Number(y.vol == null ? 80 : y.vol)); }
  else if (y.cmd === 'pause') ytP.pauseVideo();
  else if (y.cmd === 'resume') { ytP.playVideo(); ytP.setVolume(Number(y.vol == null ? 80 : y.vol)); }
  else if (y.cmd === 'stop') { ytP.stopVideo(); }
  else if (y.cmd === 'fade') ytFade();
}
function ytFade() {
  if (!ytPlaying()) return; const v0 = ytP.getVolume(); let k = 0;
  const t = setInterval(() => { k++; ytP.setVolume(Math.max(0, Math.round(v0 * (1 - k / 12)))); if (k >= 12) { clearInterval(t); ytP.pauseVideo(); ytP.setVolume(v0); } }, 100);
}


// ───────── მოთამაშეების ხმის მიცემა (MVP): ტვ-ზე მხოლოდ სათაური და რამდენმა მისცა ხმა ─────────
let pvKey = null;
const CROWN = '<svg class="crown" viewBox="0 0 64 50" aria-hidden="true"><path d="M5 40 L9 10 L23 25 L32 4 L41 25 L55 10 L59 40 Z" fill="#FFD15C" stroke="#3A0F2A" stroke-width="3" stroke-linejoin="round"/><rect x="5" y="40" width="54" height="7" rx="2" fill="#FFC23D" stroke="#3A0F2A" stroke-width="3"/><circle cx="32" cy="30" r="3.5" fill="#C2185B"/></svg>';
function renderPvote() {
  const l = S.live; if (l.phase === 'result') return pvoteResult(l);
  pvKey = null;
  const online = Object.values(S.players).filter(isOnline).length, voted = Object.keys(S.pvotes || {}).filter(id => S.players[id]).length;
  const status = l.phase === 'voting' ? `<div class="cnt">ხმა მისცა</div>` : `<div class="cnt ok">${l.autoLocked ? 'ყველამ მისცა ხმა!' : 'ხმის მიცემა დაიხურა'}</div>`;
  view(`<div class="scr battle pvote"><div class="sub">ხმის მიცემა</div><div class="title pop">${esc(l.title || '')}</div><div class="pvcount"><b>${voted}</b><span>/${Math.max(online, voted)}</span></div>${status}</div>`, 'pvote|' + l.round + '|' + l.phase);
}
// შედეგი: დრამი → მესამე, მეორე, პირველი ზოლებით → გამარჯვებული დიდად + ფეიერვერკი + გვირგვინი + მილოცვა
function pvoteResult(l) {
  const key = 'pv' + l.round; if (pvKey === key) return; pvKey = key; boardKey = null; finKey = null; lastHtml = null; lastKey = key;
  const p = (S.polls || DEFAULT_POLLS)[l.pv] || {}, { list, winners } = pollCount(S.players, S.pvotes);
  const top = list.filter(x => S.players[x.pid]).slice(0, 3), max = Math.max(1, ...top.map(x => x.n));
  const place = x => 1 + list.filter(y => y.n > x.n).length;
  const wins = winners.filter(id => S.players[id]), names = wins.map(id => S.players[id].name).join(' და ');
  swapScreen(app, `<div class="scr battle pvote"><div class="title pop">${esc(l.title || '')}</div><div class="sub" id="bdrum">${ico('drum')} ${ico('drum')} ${ico('drum')}</div>
    <div class="bbars" id="pvbars">${top.map((x, i) => `<div class="bbar pvrow ${wins.includes(x.pid) ? 'win' : ''}" data-i="${i}" style="visibility:hidden"><span class="place">${place(x)}</span><span class="pic">${av(S.players[x.pid].avatar)}</span><span class="nm">${esc(S.players[x.pid].name)}</span><span class="track"><span class="fill" style="--w:${Math.round(100 * x.n / max)}%"></span></span><b>${x.n}</b></div>`).join('')}</div>
    <div class="bwin hidden" id="bwin">${wins.length ? `<div class="bwpics">${wins.map(id => `<span class="pic crowned">${CROWN}${av(S.players[id].avatar)}</span>`).join('')}</div><div class="bwname">${esc(names)}</div><div class="bwtext">${esc(pickText('pvote_win', l.round, names))}</div>` : '<div class="bwname">ხმები არ არის</div>'}</div></div>`, 'slide');
  ytFade();
  setTimeout(() => {
    const d = document.getElementById('bdrum'); if (d) d.classList.add('rolling');
    const drum = SFX.playStoppable('drumroll');
    setTimeout(() => {
      drum.stop(); SFX.crash(); const dd = document.getElementById('bdrum'); if (dd) dd.remove();
      const rows = [...document.querySelectorAll('.pvrow')].reverse(); // მესამე → მეორე → პირველი
      rows.forEach((r, k) => setTimeout(() => { r.style.visibility = ''; r.classList.add('pvin'); SFX.play('partly'); }, k * 1100));
      setTimeout(() => {
        const bb = document.getElementById('pvbars'), w = document.getElementById('bwin'); if (bb) bb.classList.add('hidden'); if (w) w.classList.remove('hidden');
        if (!wins.length) return;
        SFX.play('podium'); runFx('fireworks', {});
        const win = p.win || {};
        if (win.sound) SFX.preview(win.sound, 'podium');
        if (win.media && (win.media.url || win.media.id)) setTimeout(() => showMedia({ url: win.media.url, id: win.media.id, loop: win.media.loop, kind: win.media.kind || (win.media.type === 'video' ? 'video' : undefined) }, win.dur || 4, names), 2600);
      }, rows.length * 1100 + 1500);
    }, DRUM_MS);
  }, ytPlaying() ? 1300 : 200);
}
