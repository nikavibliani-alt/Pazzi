// ფაციფუცობანა — წამყვანის გვერდი
const PIN = '5813';
const S = { session: null, live: {}, players: {}, teams: {}, awarded: {}, questions: {}, answers: {}, curQ: null, tab: 'control', loaded: {} };
const view = $('#view');

// ───────── PIN ─────────
function tryPin() {
  if ($('#pin').value === PIN) { try { sessionStorage.setItem('pz_host', '1'); } catch (e) {} start(); }
  else { $('#pinErr').textContent = 'PIN არასწორია 🙈'; $('#pin').value = ''; }
}
$('#pinBtn').onclick = tryPin;
$('#pin').addEventListener('keydown', e => { if (e.key === 'Enter') tryPin(); });
let unlocked = false; try { unlocked = sessionStorage.getItem('pz_host') === '1'; } catch (e) {}
if (unlocked) start();

let started = false;
function start() {
  if (started) return; started = true;
  $('#gate').hidden = true; $('#app').hidden = false;
  const on = (path, key, fn) => db.ref(path).on('value', s => { S[key] = s.val() || (key === 'session' ? null : {}); S.loaded[key] = true; if (fn) fn(); render(); });
  on('session', 'session', ensureInit);
  on('teams', 'teams', ensureInit);
  on('players', 'players');
  on('awarded', 'awarded');
  on('questions', 'questions');
  db.ref('live').on('value', s => {
    const l = S.live = s.val() || {};
    if (l.qid !== S.curQ) {
      if (S.curQ) db.ref('answers/' + S.curQ).off();
      S.curQ = l.qid || null; S.answers = {};
      if (S.curQ) db.ref('answers/' + S.curQ).on('value', a => { S.answers = a.val() || {}; render(); });
    }
    render();
  });
  $$('.tabs button').forEach(b => b.onclick = () => { S.tab = b.dataset.tab; render(true); });
}
function ensureInit() {
  if (!S.loaded.session || !S.loaded.teams) return;
  if (!S.session || !S.session.code) db.ref('session').update({ code: String(Math.floor(1000 + Math.random() * 9000)), nextTeam: 0 });
  if (!S.teams[0]) { const t = {}; for (let i = 0; i < 4; i++) t[i] = { name: 'გუნდი ' + (i + 1), score: 0 }; db.ref('teams').set(t); }
}

// ───────── დამხმარე ─────────
function listQ(game) {
  return Object.entries(S.questions).filter(([, q]) => q.game === game).map(([id, q]) => Object.assign({ id }, q)).sort((a, b) => (a.order || 0) - (b.order || 0));
}
function qComplete(q) {
  if (!q.text) return false;
  if (q.type === 'single') return arr(q.options).length >= 2 && arr(q.options).every(o => o) && arr(q.correct).length === 1;
  if (q.type === 'multi') return arr(q.options).every(o => o) && arr(q.correct).length >= 1;
  if (q.type === 'poll') return arr(q.options).length === 2 && arr(q.options).every(o => o);
  if (q.type === 'text' || q.type === 'buzz') return !!q.answer;
  return true;
}
const TYPE_NAMES = { buzz: 'ბლიც', single: 'ერთი სწორი', multi: 'რამდენიმე სწორი', poll: 'გამოკითხვა', text: 'ჩაწერითი' };
function validAnswers() {
  const lk = S.live.lockedAt;
  return Object.entries(S.answers).filter(([pid, a]) => S.players[pid] && (!lk || !a.t || a.t <= lk));
}

// ───────── გამოსახვა ─────────
// ბმის დაჭერისას ეკრანს არ ვანახლებთ, რომ დაწკაპუნება არ დაიკარგოს
let pressing = false, pendingRender = false;
document.addEventListener('mousedown', () => { pressing = true; });
document.addEventListener('mouseup', () => setTimeout(() => { pressing = false; if (pendingRender) { pendingRender = false; render(); } }, 0));
function render(force) {
  if (pressing && !force) { pendingRender = true; return; }
  $('#codeBadge').textContent = '🔑 კოდი: ' + (S.session ? S.session.code : '…');
  $('#plBadge').textContent = '👥 ' + Object.keys(S.players).length;
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
  if (S.tab !== 'control') lastCtl = '';
  if (S.tab === 'questions') return renderEditor(force);
  if (S.tab === 'players') {
    if (!force && document.activeElement && document.activeElement.tagName === 'INPUT') return;
    return renderPlayers();
  }
  renderControl();
}

function renderControl() {
  const l = S.live, mode = l.mode || 'lobby';
  const modes = [['lobby', '🏠 შესვლის ეკრანი'], ['g1', '⚡ თამაში 1: ბლიცი'], ['break', '☕ შესვენება'], ['g2', '🤔 თამაში 2: ფაცი თუ ფუცი'], ['final', '🏁 ფინალი']];
  let h = `<div class="modes">${modes.map(([m, t]) => `<button class="btn ${mode === m ? 'cur' : ''}" data-act="mode" data-id="${m}">${t}</button>`).join('')}</div>`;
  if (mode === 'lobby') h += lobbyPanel();
  else if (mode === 'break') h += `<div class="card"><div class="big">☕ შესვენებაა</div><p>ტვ-ზე ჩანს გუნდების ქულები. როცა მზად ხართ, დააჭირე „თამაში 2“-ს.</p></div>`;
  else if (mode === 'g1') h += g1Panel();
  else if (mode === 'g2') h += g2Panel();
  else if (mode === 'final') h += finalPanel();
  if (h !== lastCtl) { view.innerHTML = h; lastCtl = h; }
}
let lastCtl = '';

function lobbyPanel() {
  const pl = Object.entries(S.players);
  return `<div class="card"><div class="big">თამაშის კოდი: <b>${esc(S.session ? S.session.code : '')}</b></div>
  <p>მოთამაშეები შემოსულია: <b>${pl.length}</b></p>
  <div class="who">${pl.map(([id, p]) => `<span>${esc(p.avatar)} ${esc(p.name)}</span>`).join('')}</div>
  <p>ხმის შემოწმება ტვ-ზე (ტესტი): <button class="tinyb" data-act="sfx" data-id="right">🎺 სწორი</button> <button class="tinyb" data-act="sfx" data-id="wrong">😢 არასწორი</button></p>
  <hr><button class="btn small red" data-act="reset">🗑 ახალი თამაში (მოთამაშეებისა და ქულების განულება)</button></div>`;
}

// ───────── თამაში 1 ─────────
function g1Panel() {
  const l = S.live, qs = listQ(1), q = l.qid && S.questions[l.qid];
  const list = qs.map((x, i) => `<div class="qrow ${x.id === l.qid ? 'cur' : ''}"><span class="no">${i + 1}</span><div class="tx"><b>${esc(x.text || '(ცარიელი)')} ${x.hasImg ? '🖼️' : ''}${x.hasAudio ? '🎵' : ''}</b><small>✅ ${esc(x.answer || '—')}</small></div><button class="tinyb on" data-act="g1show" data-id="${x.id}">▶</button></div>`).join('') || '<p>კითხვები არ არის. დაამატე „კითხვები“ ჩანართში.</p>';
  let cur = '';
  if (q) {
    const b = l.buzz;
    cur = `<h3>ახლა: ${esc(q.text)}</h3><div class="ans">✅ პასუხი: <b>${esc(q.answer)}</b></div>
    <div class="card" style="background:${b ? TEAM_COLORS[b.team] : '#fff'};color:${b ? '#fff' : 'inherit'};font-size:24px;text-align:center">${b ? `🔔 ${esc(b.avatar)} <b>${esc(b.name)}</b> — ${esc(teamName(S.teams, b.team))}${l.phase === 'right' ? ' ✅' : ''}` : (l.phase === 'open' ? '⏳ ვინმე დააჭერს…' : '')}</div>
    <div class="acts"><button class="btn mint" data-act="right" ${l.phase === 'buzzed' ? '' : 'disabled'}>✅ სწორია (+1)</button><button class="btn red" data-act="wrong" ${l.phase === 'buzzed' ? '' : 'disabled'}>❌ არასწორია</button></div>
    <div class="acts"><button class="btn lemon" data-act="g1next">⏭ შემდეგი კითხვა</button><button class="btn lav" data-act="showans">👁 პასუხის ჩვენება ტვ-ზე</button></div>
    ${q.hasAudio ? `<div class="acts"><button class="btn sky" data-act="audio" data-id="play">▶ სიმღერის დაკვრა</button><button class="btn peach" data-act="audio" data-id="stop">⏹ გაჩერება</button></div>` : ''}`;
  } else cur = '<p class="card">აირჩიე კითხვა მარცხნიდან ▶-ით.</p>';
  const teams = [0, 1, 2, 3].map(i => `<div class="scorepick"><div class="tn" style="background:${TEAM_COLORS[i]}">${TEAM_EMOJI[i]} ${esc(teamName(S.teams, i))}: <b>${teamScore(S.teams, i)}</b></div><button class="tinyb" data-act="tscore" data-id="${i}" data-d="-1">−1</button><button class="tinyb on" data-act="tscore" data-id="${i}" data-d="1">+1</button></div>`).join('');
  return `<div class="cols"><div><h3>⚡ კითხვები</h3>${list}</div><div>${cur}<h3>ქულების ხელით შეცვლა</h3>${teams}</div></div>`;
}

// ───────── თამაში 2 ─────────
function g2Panel() {
  const l = S.live, qs = listQ(2), q = l.qid && S.questions[l.qid];
  const list = qs.map((x, i) => `<div class="qrow ${x.id === l.qid ? 'cur' : ''} ${qComplete(x) ? '' : 'warn'}"><span class="no">${i + 1}</span><div class="tx"><b>${esc(x.text || '(ცარიელი)')} ${x.hasImg ? '🖼️' : ''}</b><small>${TYPE_NAMES[x.type] || ''}${S.awarded[x.id] || (x.id === l.qid && l.phase === 'revealed') ? ' • ✔ ნათამაშებია' : ''}${qComplete(x) ? '' : ' • ⚠ არასრულია'}</small></div><button class="tinyb on" data-act="g2show" data-id="${x.id}">▶</button></div>`).join('') || '<p>კითხვები არ არის.</p>';
  let cur = '';
  if (q) {
    const opts = arr(q.options), corr = arr(q.correct).map(Number);
    const players = Object.entries(S.players), va = validAnswers();
    const answeredIds = new Set(va.map(([p]) => p));
    const votes = opts.map((_, i) => va.filter(([, a]) => q.type === 'multi' ? arr(a.a).includes(i) : Number(a.a) === i).length);
    let ansHtml = '';
    if (q.type === 'single' || q.type === 'multi' || q.type === 'poll') {
      ansHtml = opts.map((o, i) => `<div class="qrow ${corr.includes(i) && q.type !== 'poll' ? 'cur' : ''}"><span class="no">${LETTERS[i]}</span><div class="tx"><b>${esc(o)}</b></div><b>${votes[i]}</b> ${corr.includes(i) && q.type !== 'poll' ? '✅' : ''}</div>`).join('');
    } else {
      ansHtml = `<div class="ans">✅ სწორი პასუხი: <b>${esc(q.answer || '—')}</b></div>`;
      const sorted = va.slice().sort((a, b) => (a[1].t || 0) - (b[1].t || 0));
      ansHtml += (sorted.map(([pid, a], i) => `<div class="tans ${a.ok ? 'ok' : (i === 0 ? 'first' : '')}"><span>${i === 0 ? '⭐ პირველი' : (i + 1) + '.'}</span><span>${esc(S.players[pid].avatar)} ${esc(S.players[pid].name)}</span><span class="t"><b>${esc(a.a)}</b></span><button class="tinyb ${a.ok ? 'on' : ''}" data-act="mark" data-id="${pid}">${a.ok ? '✅ სწორია' : '✔ სწორია?'}</button></div>`).join('')) || '<p>პასუხები ჯერ არ მოსულა…</p>';
    }
    const phase = l.phase;
    let step;
    if (l.view === 'scoreboard') step = ['g2next', '⏭ შემდეგი კითხვა'];
    else if (phase === 'answering') step = ['g2lock', '🔒 პასუხების დაკეტვა'];
    else if (phase === 'locked') step = ['g2reveal', '👀 გამოაშკარავება'];
    else step = ['g2board', '🏆 ქულების ცხრილი'];
    cur = `<h3>ახლა: ${esc(q.text)} ${q.hasImg ? '🖼️' : ''}</h3>
    <div class="card" style="font-size:22px">${answeredIds.size}/${players.length} უპასუხა • ეტაპი: <b>${l.view === 'scoreboard' ? 'ქულები' : ({ answering: 'პასუხობენ', locked: 'დაკეტილია', revealed: 'გამოაშკარავებულია' }[phase] || '')}</b></div>
    <div class="acts"><button class="btn pink" data-act="${step[0]}">${step[1]}</button></div>
    ${ansHtml}
    <div class="who">${players.map(([id, p]) => `<span class="${answeredIds.has(id) ? 'yes' : 'no'}">${esc(p.avatar)} ${esc(p.name)} ${answeredIds.has(id) ? '✓' : '…'}</span>`).join('')}</div>`;
  } else cur = `<div class="acts"><button class="btn pink" data-act="g2first">▶ პირველი კითხვა</button></div>`;
  return `<div class="cols"><div><h3>🤔 კითხვები (დააჭირე ▶-ს ნებისმიერზე გადასახტომად)</h3>${list}</div><div>${cur}<div class="acts"><button class="btn lav" data-act="mode" data-id="final">🎉 ფინალი</button></div></div></div>`;
}

function finalPanel() {
  const step = S.live.step || 0;
  const names = ['ჯერ არაფერი ჩანს', '🥉 მესამე ადგილი ჩანს', '🥈 მეორე ადგილიც ჩანს', '🥇 პირველი ადგილიც ჩანს', '🥔 ბოლო ადგილი ჩანს'];
  const r = ranking(S.players, S.awarded);
  return `<div class="card"><div class="big">${names[step]}</div><div class="acts"><button class="btn pink" data-act="fstep" data-id="1" ${step >= 4 ? 'disabled' : ''}>შემდეგი გამოცხადება ▶</button><button class="btn" data-act="fstep" data-id="-1" ${step <= 0 ? 'disabled' : ''}>◀ უკან</button></div></div>
  <h3>ქულები (მხოლოდ შენთვის)</h3>${r.map((p, i) => `<div class="qrow"><span class="no">${i + 1}</span><div class="tx"><b>${esc(p.avatar)} ${esc(p.name)}</b></div><b>${p.score}</b></div>`).join('')}`;
}

// ───────── მოთამაშეები ─────────
function renderPlayers() {
  const pl = Object.entries(S.players);
  const sc = scoreMap(S.awarded);
  view.innerHTML = `<div class="cols"><div><h3>გუნდების სახელები</h3>${[0, 1, 2, 3].map(i => `<div class="team-edit"><span style="background:${TEAM_COLORS[i]};border-radius:12px;padding:6px 10px">${TEAM_EMOJI[i]}</span><input type="text" data-tname="${i}" value="${esc((S.teams[i] || {}).name || '')}" maxlength="24"></div>`).join('')}
  <p style="opacity:.7">სახელები ავტომატურად ინახება.</p></div>
  <div><h3>მოთამაშეები (${pl.length})</h3>${pl.map(([id, p]) => `<div class="prow"><span>${esc(p.avatar)}</span><span class="nm">${esc(p.name)}</span><span>⭐${sc[id] || 0}</span><select data-team="${id}">${[0, 1, 2, 3].map(i => `<option value="${i}" ${p.team === i ? 'selected' : ''}>${TEAM_EMOJI[i]} ${esc(teamName(S.teams, i))}</option>`).join('')}</select><button class="tinyb red" data-act="kick" data-id="${id}">✖</button></div>`).join('') || '<p>ჯერ არავინ შემოსულა.</p>'}</div></div>`;
}

// ───────── მოქმედებები ─────────
const A = {
  mode(m) {
    if (S.live.mode === m) return;
    db.ref('live').set(m === 'final' ? { mode: 'final', step: 0 } : { mode: m });
  },
  sfx(kind) { db.ref('live/sfx').set({ kind, n: Date.now() }); },
  reset() {
    if (!confirm('ნამდვილად? ყველა მოთამაშე, ქულა და პასუხი წაიშლება. კითხვები დარჩება.')) return;
    const u = { players: null, answers: null, awarded: null, live: { mode: 'lobby' }, 'session/code': String(Math.floor(1000 + Math.random() * 9000)), 'session/nextTeam': 0 };
    for (let i = 0; i < 4; i++) u['teams/' + i + '/score'] = 0;
    db.ref().update(u);
  },
  // თამაში 1
  g1show(id) {
    const q = S.questions[id]; if (!q) return;
    db.ref('live').set({ mode: 'g1', qid: id, q: { text: q.text || '', hasImg: !!q.hasImg, hasAudio: !!q.hasAudio }, phase: 'open' });
  },
  g1next() {
    const qs = listQ(1), i = qs.findIndex(x => x.id === S.live.qid);
    const nx = qs[i + 1];
    if (nx) A.g1show(nx.id); else alert('კითხვები დასრულდა 🎉');
  },
  async right() {
    let team = null;
    const r = await db.ref('live').transaction(l => {
      if (!l || l.phase !== 'buzzed' || !l.buzz) return;
      team = l.buzz.team; l.phase = 'right';
      l.reveal = { answer: (S.questions[l.qid] || {}).answer || '' };
      return l;
    }, null, false);
    if (r.committed && team !== null) {
      db.ref('teams/' + team + '/score').transaction(v => (v || 0) + 1);
      db.ref('live/sfx').set({ kind: 'right', n: Date.now() });
    }
  },
  async wrong() {
    const r = await db.ref('live').transaction(l => {
      if (!l || l.phase !== 'buzzed' || !l.buzz) return;
      l.wrongTeams = l.wrongTeams || {}; l.wrongTeams[l.buzz.team] = true;
      delete l.buzz; l.phase = 'open';
      return l;
    }, null, false);
    if (r.committed) db.ref('live/sfx').set({ kind: 'wrong', n: Date.now() });
  },
  showans() { const q = S.questions[S.live.qid]; if (q) db.ref('live/reveal').set({ answer: q.answer || '' }); },
  audio(cmd) { db.ref('live/audio').set({ cmd, n: Date.now() }); },
  tscore(i, b) { db.ref('teams/' + i + '/score').transaction(v => (v || 0) + Number(b.dataset.d)); },
  // თამაში 2
  g2first() { const qs = listQ(2); if (qs[0]) A.g2show(qs[0].id); else alert('ჯერ დაამატე კითხვები'); },
  g2show(id) {
    const q = S.questions[id]; if (!q) return;
    if (S.awarded[id] && !confirm('ამ კითხვას უკვე აქვს ქულები. თავიდან ვაჩვენოთ? ამ კითხვის ქულები და პასუხები წაიშლება.')) return;
    const pub = { type: q.type, text: q.text || '', hasImg: !!q.hasImg };
    if (q.type !== 'text') pub.options = arr(q.options);
    db.ref().update({ ['answers/' + id]: null, ['awarded/' + id]: null, live: { mode: 'g2', qid: id, q: pub, phase: 'answering', view: 'question' } });
  },
  g2next() {
    const qs = listQ(2), i = qs.findIndex(x => x.id === S.live.qid), nx = qs[i + 1];
    if (nx) A.g2show(nx.id); else alert('კითხვები დასრულდა! დააჭირე „ფინალი“-ს 🎉');
  },
  g2lock() { db.ref('live').update({ phase: 'locked', lockedAt: TS }); },
  async g2reveal() {
    const qid = S.live.qid, q = S.questions[qid]; if (!q) return;
    const snap = await db.ref('answers/' + qid).once('value');
    S.answers = snap.val() || {};
    const aw = computeAwards();
    db.ref().update({ ['awarded/' + qid]: Object.keys(aw).length ? aw : null, 'live/phase': 'revealed', 'live/reveal': { correct: arr(q.correct), answer: q.answer || '' } });
  },
  g2board() { db.ref('live/view').set('scoreboard'); },
  mark(pid) {
    const a = S.answers[pid]; if (!a) return;
    db.ref('answers/' + S.live.qid + '/' + pid + '/ok').set(a.ok ? null : true).then(() => {
      if (S.live.phase === 'revealed') { // ქულების გადათვლა, თუ უკვე გამოაშკარავებულია
        setTimeout(() => { const aw = computeAwards(); db.ref('awarded/' + S.live.qid).set(Object.keys(aw).length ? aw : null); }, 150);
      }
    });
  },
  fstep(d) { const s = Math.max(0, Math.min(4, (S.live.step || 0) + Number(d))); db.ref('live/step').set(s); },
  kick(id) { if (confirm('ამ მოთამაშის წაშლა?')) db.ref('players/' + id).remove(); }
};
function computeAwards() {
  const l = S.live, q = S.questions[l.qid], aw = {};
  if (!q || q.type === 'poll') return aw;
  validAnswers().forEach(([pid, a]) => {
    const ok = q.type === 'text' ? a.ok === true : isCorrectChoice(q, a.a);
    if (ok) aw[pid] = true;
  });
  return aw;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (b && !b.disabled && A[b.dataset.act]) A[b.dataset.act](b.dataset.id, b);
  const ea = e.target.closest('[data-eact]');
  if (ea && !ea.disabled && EA[ea.dataset.eact]) EA[ea.dataset.eact](ea.dataset.id, ea);
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.tname !== undefined) db.ref('teams/' + t.dataset.tname + '/name').set(t.value);
  if (t.closest && t.closest('#edform')) collect();
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.team !== undefined) db.ref('players/' + t.dataset.team + '/team').set(Number(t.value));
  if (t.id === 'e_type') { collect(); changeType(t.value); }
  if (t.id === 'e_img') uploadImg(t.files[0]);
  if (t.id === 'e_aud') uploadAud(t.files[0]);
  if (t.closest && t.closest('#edform') && (t.type === 'checkbox' || t.type === 'radio')) collect();
});

// ───────── კითხვების რედაქტორი ─────────
let edId = null, edGame = 1, cur = null, saveT = null, curImg = '', curAud = '';
function renderEditor(force) {
  // ფორმას ბაზის ცვლილებებზე თავიდან არ ვხატავთ — მხოლოდ სიას
  if (!$('#edlist') || force) {
    view.innerHTML = `<div class="cols"><div><div class="modes"><button class="btn ${edGame === 1 ? 'cur' : ''}" data-eact="game" data-id="1">⚡ თამაში 1</button><button class="btn ${edGame === 2 ? 'cur' : ''}" data-eact="game" data-id="2">🤔 თამაში 2</button></div><button class="btn pink" data-eact="add" style="margin-bottom:10px">➕ ახალი კითხვა</button><div id="edlist"></div></div><div id="edform"></div></div>`;
    drawForm();
  }
  drawList();
}
function drawList() {
  const qs = listQ(edGame);
  $('#edlist').innerHTML = qs.map((x, i) => `<div class="qrow ${x.id === edId ? 'cur' : ''} ${qComplete(x) ? '' : 'warn'}"><span class="no">${i + 1}</span><div class="tx"><b>${esc(x.text || '(ცარიელი)')} ${x.hasImg ? '🖼️' : ''}${x.hasAudio ? '🎵' : ''}</b><small>${TYPE_NAMES[x.type] || ''}${qComplete(x) ? '' : ' • ⚠ არასრულია'}</small></div><button class="tinyb" data-eact="up" data-id="${x.id}" ${i === 0 ? 'disabled' : ''}>▲</button><button class="tinyb" data-eact="down" data-id="${x.id}" ${i === qs.length - 1 ? 'disabled' : ''}>▼</button><button class="tinyb on" data-eact="edit" data-id="${x.id}">✏️</button><button class="tinyb red" data-eact="del" data-id="${x.id}">🗑</button></div>`).join('') || '<p>ჯერ კითხვები არ არის.</p>';
}
function drawForm() {
  const f = $('#edform'); if (!f) return;
  if (!cur) { f.innerHTML = '<div class="card">აირჩიე კითხვა ✏️-ით ან დაამატე ახალი ➕</div>'; return; }
  const t = cur.type, opts = arr(cur.options), corr = arr(cur.correct).map(Number);
  let h = `<div class="card"><label class="f">ტიპი</label>`;
  if (cur.game === 2) h += `<select id="e_type">${['single', 'multi', 'poll', 'text'].map(k => `<option value="${k}" ${t === k ? 'selected' : ''}>${{ single: 'ერთი სწორი პასუხი (4 ვარიანტი)', multi: 'რამდენიმე სწორი პასუხი', poll: 'გამოკითხვა (2 ვარიანტი, ქულის გარეშე)', text: 'ჩაწერითი პასუხი' }[k]}</option>`).join('')}</select>`;
  else h += `<div>⚡ ბლიც კითხვა</div>`;
  h += `<label class="f">კითხვა</label><textarea id="e_text">${esc(cur.text)}</textarea>`;
  if (t === 'single' || t === 'multi' || t === 'poll') {
    h += `<label class="f">ვარიანტები ${t === 'poll' ? '' : '(მონიშნე სწორი)'}</label>`;
    opts.forEach((o, i) => {
      h += `<div class="optrow">${t === 'poll' ? `<b>${LETTERS[i]}</b>` : `<input type="${t === 'single' ? 'radio' : 'checkbox'}" name="cor" class="e_cor" data-i="${i}" ${corr.includes(i) ? 'checked' : ''}>`}<input type="text" class="e_opt" value="${esc(o)}" placeholder="${LETTERS[i]} ვარიანტი"></div>`;
    });
  } else {
    h += `<label class="f">სწორი პასუხი (${t === 'buzz' ? 'წამყვანისთვის' : 'ჩანს წამყვანის გვერდზე და ტვ-ზე გამოაშკარავებისას'})</label><input type="text" id="e_ans" value="${esc(cur.answer)}">`;
  }
  h += `<label class="f">🖼️ სურათი (ჩანს მხოლოდ ტვ-ზე)</label><input type="file" id="e_img" accept="image/*">`;
  h += `<div id="e_imgprev">${cur.hasImg ? (curImg ? `<img class="prev" src="${curImg}">` : 'იტვირთება…') : ''}</div>`;
  if (cur.hasImg) h += `<button class="tinyb red" data-eact="rmimg">სურათის წაშლა</button>`;
  if (cur.game === 1) {
    h += `<label class="f">🎵 აუდიო კლიპი — „გამოიცანი სიმღერა“ (მაქს. 30 წამი)</label><input type="file" id="e_aud" accept="audio/*"><div id="e_audprev">${cur.hasAudio ? (curAud ? `<audio controls src="${curAud}" style="width:100%;margin-top:6px"></audio>` : 'იტვირთება…') : ''}</div>`;
    if (cur.hasAudio) h += `<button class="tinyb red" data-eact="rmaud">კლიპის წაშლა</button>`;
  }
  h += `<p class="saved" id="e_status">✔ შენახულია</p></div>`;
  f.innerHTML = h;
}
function collect() {
  if (!cur) return;
  cur.text = $('#e_text').value;
  if ($('.e_opt')) { cur.options = $$('.e_opt').map(i => i.value); cur.correct = $$('.e_cor').filter(c => c.checked).map(c => Number(c.dataset.i)); }
  if ($('#e_ans')) cur.answer = $('#e_ans').value;
  scheduleSave();
}
function changeType(t) {
  cur.type = t;
  const n = t === 'poll' ? 2 : (t === 'text' ? 0 : 4);
  const o = arr(cur.options).slice(0, n); while (o.length < n) o.push('');
  cur.options = o; cur.correct = [];
  scheduleSave(); drawForm();
}
function scheduleSave() {
  const s = $('#e_status'); if (s) s.textContent = '💾 ვინახავ…';
  clearTimeout(saveT); saveT = setTimeout(saveNow, 500);
}
function saveNow() {
  if (!cur || !edId) return;
  clearTimeout(saveT);
  const d = { game: cur.game, order: cur.order, type: cur.type, text: cur.text || '', answer: cur.answer || '', hasImg: !!cur.hasImg, hasAudio: !!cur.hasAudio };
  if (cur.type !== 'text' && cur.type !== 'buzz') { d.options = arr(cur.options); const c = arr(cur.correct).map(Number); if (c.length && cur.type !== 'poll') d.correct = c; }
  return db.ref('questions/' + edId).set(d).then(() => { const s = $('#e_status'); if (s) s.textContent = '✔ შენახულია'; });
}
async function selectQ(id) {
  await saveNow();
  edId = id; const q = S.questions[id];
  cur = JSON.parse(JSON.stringify(q)); cur.options = arr(cur.options); cur.correct = arr(cur.correct);
  const n = cur.type === 'poll' ? 2 : (cur.type === 'text' || cur.type === 'buzz' ? 0 : 4);
  while (cur.options.length < n) cur.options.push('');
  curImg = ''; curAud = '';
  drawForm(); drawList();
  if (cur.hasImg) db.ref('qimg/' + id).once('value').then(s => { if (edId === id) { curImg = s.val() || ''; const p = $('#e_imgprev'); if (p) p.innerHTML = curImg ? `<img class="prev" src="${curImg}">` : ''; } });
  if (cur.hasAudio) db.ref('qaudio/' + id).once('value').then(s => { if (edId === id) { curAud = s.val() || ''; const p = $('#e_audprev'); if (p) p.innerHTML = curAud ? `<audio controls src="${curAud}" style="width:100%;margin-top:6px"></audio>` : ''; } });
}
const EA = {
  game(g) { saveNow(); edGame = Number(g); edId = null; cur = null; renderEditor(true); },
  add() {
    saveNow();
    const all = Object.values(S.questions), order = all.reduce((m, q) => Math.max(m, q.order || 0), 0) + 1;
    const id = db.ref('questions').push().key;
    const t = edGame === 1 ? 'buzz' : 'single';
    const q = { game: edGame, order, type: t, text: '', answer: '', hasImg: false, hasAudio: false };
    if (t === 'single') q.options = ['', '', '', ''];
    S.questions[id] = q;
    db.ref('questions/' + id).set(q).then(() => selectQ(id));
  },
  edit(id) { selectQ(id); },
  del(id) {
    if (!confirm('ნამდვილად წავშალო ეს კითხვა?')) return;
    if (edId === id) { edId = null; cur = null; clearTimeout(saveT); drawForm(); }
    db.ref().update({ ['questions/' + id]: null, ['qimg/' + id]: null, ['qaudio/' + id]: null });
  },
  up(id) { moveQ(id, -1); },
  down(id) { moveQ(id, 1); },
  rmimg() { curImg = ''; cur.hasImg = false; db.ref('qimg/' + edId).remove(); saveNow(); drawForm(); },
  rmaud() { curAud = ''; cur.hasAudio = false; db.ref('qaudio/' + edId).remove(); saveNow(); drawForm(); }
};
function moveQ(id, d) {
  const qs = listQ(edGame), i = qs.findIndex(x => x.id === id), j = i + d;
  if (j < 0 || j >= qs.length) return;
  const a = qs[i], b = qs[j];
  let oa = a.order || 0, ob = b.order || 0;
  if (oa === ob) ob = oa + (d > 0 ? 1 : -1);
  db.ref().update({ ['questions/' + a.id + '/order']: ob, ['questions/' + b.id + '/order']: oa });
}
async function uploadImg(file) {
  if (!file || !cur) return;
  const status = $('#e_status'); if (status) status.textContent = '⏳ სურათს ვამუშავებ…';
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const data = c.toDataURL('image/jpeg', 0.8);
    const id = edId;
    await db.ref('qimg/' + id).set(data);
    if (edId !== id) return;
    curImg = data; cur.hasImg = true; await saveNow(); drawForm();
  } catch (e) { if (status) status.textContent = '⚠ ამ სურათს ვერ ვკითხულობ. სცადე JPG ან PNG.'; }
}
async function uploadAud(file) {
  if (!file || !cur) return;
  const status = $('#e_status');
  if (file.size > 4 * 1024 * 1024) { status.textContent = '⚠ ფაილი ძალიან დიდია (მაქს. ~4 მბ). გააკეთე უფრო მოკლე კლიპი.'; return; }
  const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  const dur = await new Promise(res => { const a = new Audio(); a.onloadedmetadata = () => res(a.duration); a.onerror = () => res(-1); a.src = data; });
  if (dur < 0) { status.textContent = '⚠ ამ აუდიოს ვერ ვკითხულობ. სცადე MP3.'; return; }
  if (dur > 32) { status.textContent = '⚠ კლიპი ' + Math.round(dur) + ' წამია. მაქსიმუმი 30 წამია.'; return; }
  const id = edId;
  await db.ref('qaudio/' + id).set(data);
  if (edId !== id) return;
  curAud = data; cur.hasAudio = true; await saveNow(); drawForm();
}
window.addEventListener('beforeunload', () => { if (saveT) saveNow(); });
