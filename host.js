// ფაციფუცობანა — წამყვანის გვერდი (მხოლოდ საღამოს სამართავად; მოსამზადებელი ყველაფერი admin.html-შია)
const S = { session: null, live: {}, players: {}, teams: {}, awarded: {}, questions: {}, quizzes: {}, answers: {}, curQ: null, tab: 'control', loaded: {} };
const view = $('#view');
$('#gateLogo').innerHTML = logoHtml(); $('#topLogo').innerHTML = logoHtml();
gate(start);

let started = false;
function start() {
  if (started) return; started = true;
  ensureBase();
  const on = (path, key) => db.ref(path).on('value', s => { S[key] = s.val() || (key === 'session' ? null : {}); S.loaded[key] = true; render(); });
  on('session', 'session'); on('teams', 'teams'); on('players', 'players'); on('awarded', 'awarded'); on('questions', 'questions'); on('quizzes', 'quizzes');
  watchConfig(() => { $('#topLogo').innerHTML = logoHtml(); document.title = gameName() + ' — წამყვანი'; render(); });
  db.ref('live').on('value', s => {
    const l = S.live = s.val() || {};
    if (l.qid !== S.curQ) {
      if (S.curQ) db.ref('answers/' + S.curQ).off();
      S.curQ = l.qid || null; S.answers = {};
      if (S.curQ) db.ref('answers/' + S.curQ).on('value', a => { S.answers = a.val() || {}; render(); });
    }
    render();
  });
  $$('.tabs button').forEach(b => b.onclick = () => { S.tab = b.dataset.tab; lastCtl = ''; render(true); });
}

// ───────── დამხმარე ─────────
function activeQuiz(g) { return (CFG.active || {})['g' + g]; }
function listQ(game) {
  const qz = activeQuiz(game);
  return Object.entries(S.questions).filter(([, q]) => q.game === game && q.quiz === qz).map(([id, q]) => Object.assign({ id }, q)).sort((a, b) => (a.order || 0) - (b.order || 0));
}
function quizName(g) { const id = activeQuiz(g); return id && S.quizzes[id] ? S.quizzes[id].name : null; }
function qComplete(q) {
  if (!q.text) return false;
  if (q.type === 'single') return arr(q.options).length >= 2 && arr(q.options).every(o => o) && arr(q.correct).length === 1;
  if (q.type === 'multi') return arr(q.options).every(o => o) && arr(q.correct).length >= 1;
  if (q.type === 'poll') return arr(q.options).length === 2 && arr(q.options).every(o => o);
  return !!q.answer;
}
const TYPE_NAMES = { buzz: 'ბლიც', single: 'ერთი სწორი', multi: 'რამდენიმე სწორი', poll: 'გამოკითხვა', text: 'ჩაწერითი' };
function validAnswers() {
  const lk = S.live.lockedAt;
  return Object.entries(S.answers).filter(([pid, a]) => S.players[pid] && (!lk || !a.t || a.t <= lk));
}
const pic = a => `<span class="pic">${av(a)}</span>`;

// ───────── გამოსახვა ─────────
// დაჭერისას ეკრანს არ ვანახლებთ, რომ დაწკაპუნება არ დაიკარგოს
let pressing = false, pendingRender = false, lastCtl = '';
document.addEventListener('mousedown', () => { pressing = true; });
document.addEventListener('mouseup', () => setTimeout(() => { pressing = false; if (pendingRender) { pendingRender = false; render(); } }, 0));
function render(force) {
  if (!started) return;
  if (pressing && !force) { pendingRender = true; return; }
  $('#codeBadge').textContent = 'კოდი: ' + (S.session ? S.session.code : '…');
  $('#plBadge').textContent = 'მოთამაშე: ' + Object.keys(S.players).length;
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
  if (S.tab === 'players') {
    lastCtl = '';
    if (!force && document.activeElement && document.activeElement.tagName === 'SELECT') return;
    return renderPlayers();
  }
  renderControl();
}

function renderControl() {
  const l = S.live, mode = l.mode || 'lobby';
  const modes = [['lobby', 'შესვლის ეკრანი'], ['g1', 'თამაში 1: ბლიცი'], ['break', 'შესვენება'], ['g2', 'თამაში 2: ფაცი თუ ფუცი'], ['final', 'ფინალი']];
  let h = `<div class="modes">${modes.map(([m, t]) => `<button class="btn ${mode === m ? 'cur' : ''}" data-act="mode" data-id="${m}">${t}</button>`).join('')}</div>`;
  if (mode === 'lobby') h += lobbyPanel();
  else if (mode === 'break') h += `<div class="panel"><h3>შესვენება</h3><p>ტვ-ზე ჩანს გუნდების ქულები. როცა მზად ხართ, დააჭირე „თამაში 2“-ს.</p></div>`;
  else if (mode === 'g1') h += g1Panel();
  else if (mode === 'g2') h += g2Panel();
  else if (mode === 'final') h += finalPanel();
  if (h !== lastCtl) { view.innerHTML = h; lastCtl = h; }
}

function noQuiz(g) { return `<div class="panel"><h3>ქვიზი არჩეული არ არის</h3><p>გახსენი <a href="admin.html">admin.html</a> და აირჩიე, რომელი ქვიზი გამოიყენება დღეს საღამოს თამაშისთვის ${g}.</p></div>`; }

function lobbyPanel() {
  const pl = Object.entries(S.players);
  const q1 = quizName(1), q2 = quizName(2);
  return `<div class="cols"><div class="panel"><h3>თამაშის კოდი</h3><div class="head" style="font-size:64px;color:var(--pink)">${esc(S.session ? S.session.code : '')}</div>
  <p>შემოვიდა: <b>${pl.length}</b></p><div class="who">${pl.map(([id, p]) => `<span>${pic(p.avatar)}${esc(p.name)}</span>`).join('')}</div></div>
  <div><div class="panel"><h3>დღევანდელი ქვიზები</h3><p>თამაში 1: <b>${esc(q1 || 'არჩეული არ არის')}</b><br>თამაში 2: <b>${esc(q2 || 'არჩეული არ არის')}</b></p><p class="hint">შეცვლა admin.html-ში შეგიძლია.</p></div>
  <div class="panel"><h3>ხმის შემოწმება ტვ-ზე</h3><div class="acts"><button class="btn mint sm" data-act="sfx" data-id="right">სწორი</button><button class="btn sm" data-act="sfx" data-id="wrong">არასწორი</button></div></div></div></div>`;
}

// ───────── თამაში 1 ─────────
function g1Panel() {
  if (!activeQuiz(1)) return noQuiz(1);
  const l = S.live, qs = listQ(1), q = l.qid && S.questions[l.qid];
  const list = qs.map((x, i) => `<div class="qrow ${x.id === l.qid ? 'cur' : ''}"><span class="no">${i + 1}</span><div class="tx"><b>${esc(x.text || '(ცარიელი)')} ${x.img ? ico('image') : ''}${x.snd ? ico('music') : ''}</b><small>პასუხი: ${esc(x.answer || '—')}</small></div><button class="btn sm mint" data-act="g1show" data-id="${x.id}">აჩვენე</button></div>`).join('') || '<p>ამ ქვიზში კითხვები არ არის.</p>';
  let cur = '';
  if (q) {
    const b = l.buzz;
    cur = `<div class="panel"><h3>ახლა</h3><div style="font-size:24px;font-weight:800">${esc(q.text)}</div><div class="ans">პასუხი: <b>${esc(q.answer)}</b></div>
    <div class="bigbuzz" style="${b ? `background:${TEAM_HUES[b.team]}` : ''}">${b ? `${pic(b.avatar)}<span><b>${esc(b.name)}</b> · ${esc(teamName(S.teams, b.team))}${l.phase === 'right' ? ' · სწორია' : ''}</span>` : (l.phase === 'open' ? 'ველოდებით, ვინ დააჭერს…' : '')}</div>
    <div class="acts"><button class="btn mint lg" data-act="right" ${l.phase === 'buzzed' ? '' : 'disabled'}>${ico('check')} სწორია (+1)</button><button class="btn danger lg" data-act="wrong" ${l.phase === 'buzzed' ? '' : 'disabled'}>${ico('cross')} არასწორია</button></div>
    <div class="acts"><button class="btn lemon" data-act="g1next">შემდეგი კითხვა →</button><button class="btn sm" data-act="showans">პასუხი ტვ-ზე</button></div>
    ${q.snd ? audioBtns() : ''}</div>`;
  } else cur = '<div class="panel"><p>აირჩიე კითხვა მარცხნიდან „აჩვენე“-თი.</p></div>';
  const teams = [0, 1, 2, 3].map(i => `<div class="scorepick"><div class="tn">${ttag(i, teamName(S.teams, i))} &nbsp; <b>${teamScore(S.teams, i)}</b></div><button class="btn sm" data-act="tscore" data-id="${i}" data-d="-1">−1</button><button class="btn sm mint" data-act="tscore" data-id="${i}" data-d="1">+1</button></div>`).join('');
  return `<div class="cols"><div class="panel"><h3>${esc(quizName(1) || '')} · კითხვები</h3>${list}</div><div>${cur}<div class="panel"><h3>ქულების ხელით შეცვლა</h3>${teams}</div></div></div>`;
}
function audioBtns() { return `<div class="acts"><button class="btn sky" data-act="audio" data-id="play">${ico('play')} ხმის დაკვრა</button><button class="btn" data-act="audio" data-id="stop">${ico('stop')} გაჩერება</button></div>`; }

// ───────── თამაში 2 ─────────
function g2Panel() {
  if (!activeQuiz(2)) return noQuiz(2);
  const l = S.live, qs = listQ(2), q = l.qid && S.questions[l.qid];
  const list = qs.map((x, i) => `<div class="qrow ${x.id === l.qid ? 'cur' : ''} ${qComplete(x) ? '' : 'warn'}"><span class="no">${i + 1}</span><div class="tx"><b>${esc(x.text || '(ცარიელი)')} ${x.img ? ico('image') : ''}${x.snd ? ico('music') : ''}</b><small>${TYPE_NAMES[x.type] || ''}${S.awarded[x.id] ? ' · ნათამაშებია' : ''}${qComplete(x) ? '' : ' · არასრულია'}</small></div><button class="btn sm mint" data-act="g2show" data-id="${x.id}">აჩვენე</button></div>`).join('') || '<p>ამ ქვიზში კითხვები არ არის.</p>';
  let cur = '';
  if (q) {
    const opts = arr(q.options), corr = arr(q.correct).map(Number);
    const players = Object.entries(S.players), va = validAnswers();
    const answeredIds = new Set(va.map(([p]) => p));
    const votes = opts.map((_, i) => va.filter(([, a]) => q.type === 'multi' ? arr(a.a).includes(i) : Number(a.a) === i).length);
    let ansHtml = '';
    if (q.type === 'single' || q.type === 'multi' || q.type === 'poll') {
      ansHtml = opts.map((o, i) => { const c = corr.includes(i) && q.type !== 'poll'; return `<div class="qrow ${c ? 'cur' : ''}"><span class="no">${LETTERS[i]}</span><div class="tx"><b>${esc(o)}</b></div><b>${votes[i]}</b>${c ? '<span class="no" style="background:var(--mint)">სწორია</span>' : ''}</div>`; }).join('');
    } else {
      ansHtml = `<div class="ans">სწორი პასუხი: <b>${esc(q.answer || '—')}</b></div>`;
      const sorted = va.slice().sort((a, b) => (a[1].t || 0) - (b[1].t || 0));
      ansHtml += (sorted.map(([pid, a], i) => `<div class="tans ${a.ok ? 'ok' : (i === 0 ? 'first' : '')}"><b>${i === 0 ? ico('star') + ' პირველი' : (i + 1) + '.'}</b>${pic(S.players[pid].avatar)}<span>${esc(S.players[pid].name)}</span><span class="t"><b>${esc(a.a)}</b></span><button class="btn sm ${a.ok ? 'mint' : ''}" data-act="mark" data-id="${pid}">${a.ok ? ico('check') + ' სწორია' : 'სწორია?'}</button></div>`).join('')) || '<p>პასუხები ჯერ არ მოსულა…</p>';
    }
    const phase = l.phase;
    let step;
    if (l.view === 'scoreboard') step = ['g2next', 'შემდეგი კითხვა →'];
    else if (phase === 'answering') step = ['g2lock', 'პასუხების დაკეტვა'];
    else if (phase === 'locked') step = ['g2reveal', 'გამოაშკარავება'];
    else step = ['g2board', 'ქულების ცხრილი'];
    const stage = l.view === 'scoreboard' ? 'ქულები' : ({ answering: 'პასუხობენ', locked: 'დაკეტილია', revealed: 'გამოაშკარავებულია' }[phase] || '');
    cur = `<div class="panel"><h3>ახლა</h3><div style="font-size:22px;font-weight:800">${esc(q.text)} ${q.img ? ico('image') : ''}</div>
    <div class="statusbar">უპასუხა ${answeredIds.size}/${players.length} · ეტაპი: <b>${stage}</b></div>
    <div class="acts"><button class="btn primary lg" data-act="${step[0]}">${step[1]}</button></div>
    ${q.snd ? audioBtns() : ''}${ansHtml}
    <div class="who">${players.map(([id, p]) => `<span class="${answeredIds.has(id) ? 'yes' : 'no'}">${pic(p.avatar)}${esc(p.name)} ${answeredIds.has(id) ? ico('check') : '…'}</span>`).join('')}</div></div>`;
  } else cur = `<div class="panel"><div class="acts"><button class="btn primary lg" data-act="g2first">პირველი კითხვა</button></div></div>`;
  return `<div class="cols"><div class="panel"><h3>${esc(quizName(2) || '')} · კითხვები (გადასახტომად დააჭირე „აჩვენე“-ს)</h3>${list}</div><div>${cur}<div class="acts"><button class="btn lav" data-act="mode" data-id="final">ფინალი</button></div></div></div>`;
}

function finalPanel() {
  const step = S.live.step || 0;
  const names = ['ჯერ არაფერი ჩანს', 'მესამე ადგილი ჩანს', 'მეორე ადგილიც ჩანს', 'პირველი ადგილიც ჩანს', 'ბოლო ადგილიც ჩანს'];
  const r = ranking(S.players, S.awarded);
  return `<div class="panel"><h3>პოდიუმი</h3><div class="statusbar">${names[step]} (${step}/4)</div><div class="acts"><button class="btn primary lg" data-act="fstep" data-id="1" ${step >= 4 ? 'disabled' : ''}>შემდეგი გამოცხადება →</button><button class="btn" data-act="fstep" data-id="-1" ${step <= 0 ? 'disabled' : ''}>← უკან</button></div></div>
  <div class="panel"><h3>ქულები (მხოლოდ შენთვის)</h3>${r.map((p, i) => `<div class="qrow"><span class="no">${i + 1}</span>${pic(p.avatar)}<div class="tx"><b>${esc(p.name)}</b></div><b>${p.score}</b></div>`).join('')}</div>`;
}

// ───────── მოთამაშეები ─────────
function renderPlayers() {
  const pl = Object.entries(S.players), sc = scoreMap(S.awarded);
  view.innerHTML = `<div class="cols"><div class="panel"><h3>მოთამაშეები (${pl.length})</h3>${pl.map(([id, p]) => `<div class="prow">${pic(p.avatar)}<span class="nm">${esc(p.name)}</span><span>${sc[id] || 0} ქულა</span>${ttag(p.team, teamName(S.teams, p.team))}<select data-team="${id}">${[0, 1, 2, 3].map(i => `<option value="${i}" ${p.team === i ? 'selected' : ''}>${esc(teamName(S.teams, i))}</option>`).join('')}</select><button class="btn sm danger" data-act="kick" data-id="${id}">წაშლა</button></div>`).join('') || '<p>ჯერ არავინ შემოსულა.</p>'}</div>
  <div class="panel"><h3>ახალი თამაში</h3><p>წაშლის ყველა მოთამაშეს, ქულას და პასუხს, ახალ კოდს შექმნის. კითხვები და პარამეტრები დარჩება.</p><button class="btn danger" data-act="reset">ყველაფრის განულება</button></div></div>`;
}

// ───────── მოქმედებები ─────────
const A = {
  mode(m) {
    if (S.live.mode === m || (!S.live.mode && m === 'lobby')) return;
    if (S.live.mode && !confirm('ეკრანს გადავრთავ. გავაგრძელო?')) return;
    db.ref('live').set(m === 'final' ? { mode: 'final', step: 0 } : { mode: m });
  },
  sfx(kind) { db.ref('live/sfx').set({ kind, n: Date.now() }); },
  reset() {
    if (!confirm('ნამდვილად? ყველა მოთამაშე, ქულა და პასუხი წაიშლება.')) return;
    const u = { players: null, answers: null, awarded: null, live: { mode: 'lobby' }, 'session/code': String(Math.floor(1000 + Math.random() * 9000)), 'session/nextTeam': 0 };
    for (let i = 0; i < 4; i++) u['teams/' + i + '/score'] = 0;
    db.ref().update(u);
  },
  // თამაში 1
  g1show(id) {
    const q = S.questions[id]; if (!q) return;
    db.ref('live').set({ mode: 'g1', qid: id, q: { text: q.text || '', img: q.img || null, snd: q.snd || null }, phase: 'open' });
  },
  g1next() {
    const qs = listQ(1), i = qs.findIndex(x => x.id === S.live.qid), nx = qs[i + 1];
    if (nx) A.g1show(nx.id); else alert('კითხვები დასრულდა');
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
  g2first() { const qs = listQ(2); if (qs[0]) A.g2show(qs[0].id); else alert('ამ ქვიზში კითხვები არ არის'); },
  g2show(id) {
    const q = S.questions[id]; if (!q) return;
    if (S.awarded[id] && !confirm('ამ კითხვას უკვე აქვს ქულები. თავიდან ვაჩვენოთ? ამ კითხვის ქულები და პასუხები წაიშლება.')) return;
    const pub = { type: q.type, text: q.text || '', img: q.img || null, snd: q.snd || null };
    if (q.type !== 'text') pub.options = arr(q.options);
    db.ref().update({ ['answers/' + id]: null, ['awarded/' + id]: null, live: { mode: 'g2', qid: id, q: pub, phase: 'answering', view: 'question' } });
  },
  g2next() {
    const qs = listQ(2), i = qs.findIndex(x => x.id === S.live.qid), nx = qs[i + 1];
    if (nx) A.g2show(nx.id); else alert('კითხვები დასრულდა! დააჭირე „ფინალი“-ს');
  },
  g2lock() { db.ref('live').update({ phase: 'locked', lockedAt: TS }); },
  async g2reveal() {
    const qid = S.live.qid, q = S.questions[qid]; if (!q) return;
    S.answers = (await db.ref('answers/' + qid).once('value')).val() || {};
    const aw = computeAwards();
    db.ref().update({ ['awarded/' + qid]: Object.keys(aw).length ? aw : null, 'live/phase': 'revealed', 'live/reveal': { correct: arr(q.correct), answer: q.answer || '' } });
  },
  g2board() { db.ref('live/view').set('scoreboard'); },
  mark(pid) {
    const a = S.answers[pid]; if (!a) return;
    db.ref('answers/' + S.live.qid + '/' + pid + '/ok').set(a.ok ? null : true).then(() => {
      if (S.live.phase === 'revealed') setTimeout(() => { const aw = computeAwards(); db.ref('awarded/' + S.live.qid).set(Object.keys(aw).length ? aw : null); }, 150);
    });
  },
  fstep(d) { db.ref('live/step').set(Math.max(0, Math.min(4, (S.live.step || 0) + Number(d)))); },
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
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.team !== undefined) db.ref('players/' + t.dataset.team + '/team').set(Number(t.value));
});
