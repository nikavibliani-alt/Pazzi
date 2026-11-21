// ფაციფუცობანა — წამყვანის გვერდი (საღამოს სამართავად; მოსამზადებელი ყველაფერი admin.html-შია)
const S = { session: null, live: {}, players: {}, teams: {}, awarded: {}, questions: {}, quizzes: {}, answers: {}, curQ: null, sec: null, conn: true, loaded: {} };
const view = $('#view');
$('#gateLogo').innerHTML = logoHtml(); $('#sideLogo').innerHTML = logoHtml();
gate(start);

const SEC_TITLES = { g1: 'თამაში 1: ბლიცი', g2: 'თამაში 2: ფაცი თუ ფუცი', players: 'მოთამაშეები', board: 'ქულები და ფინალი' };
const MODE_NAMES = { lobby: 'შესვლის ეკრანი', g1: 'თამაში 1', break: 'შესვენება', g2: 'თამაში 2', final: 'ფინალი' };
const TYPE_NAMES = { buzz: 'ბლიც', single: 'ერთი სწორი', multi: 'რამდენიმე სწორი', poll: 'გამოკითხვა', text: 'ჩაწერითი' };

let started = false;
function start() {
  if (started) return; started = true;
  ensureBase();
  const on = (path, key) => db.ref(path).on('value', s => { S[key] = key === 'players' ? cleanPlayers(s.val()) : (s.val() || (key === 'session' ? null : {})); S.loaded[key] = true; render(); });
  on('session', 'session'); on('teams', 'teams'); on('players', 'players'); on('awarded', 'awarded'); on('questions', 'questions'); on('quizzes', 'quizzes');
  watchConfig(() => { $('#sideLogo').innerHTML = logoHtml(); document.title = gameName() + ' — წამყვანი'; render(); });
  watchConnection(ok => { S.conn = ok; render(); });
  db.ref('live').on('value', s => {
    const l = S.live = s.val() || {};
    if (!S.sec) S.sec = l.mode === 'g2' ? 'g2' : l.mode === 'final' ? 'board' : 'g1';
    if (l.qid !== S.curQ) {
      if (S.curQ) db.ref('answers/' + S.curQ).off();
      S.curQ = l.qid || null; S.answers = {};
      if (S.curQ) db.ref('answers/' + S.curQ).on('value', a => { S.answers = a.val() || {}; render(); });
    }
    render();
  });
  icons();
}

// ───────── დამხმარე ─────────
const activeQuiz = g => (CFG.active || {})['g' + g];
function listQ(game) {
  const qz = activeQuiz(game);
  return Object.entries(S.questions).filter(([, q]) => q.game === game && q.quiz === qz).map(([id, q]) => Object.assign({ id }, q)).sort((a, b) => (a.order || 0) - (b.order || 0));
}
const quizName = g => { const id = activeQuiz(g); return id && S.quizzes[id] ? S.quizzes[id].name : null; };
const hasSfx = q => q.sfx && Object.keys(q.sfx).length > 0;
function validAnswers() {
  const lk = S.live.lockedAt;
  return Object.entries(S.answers).filter(([pid, a]) => S.players[pid] && (!lk || !a.t || a.t <= lk));
}
const pic = a => `<span class="pic">${av(a)}</span>`;
const kbd = k => `<span class="kbd">${k}</span>`;

// ───────── გამოსახვა ─────────
// დაჭერის დროს ეკრანს არ ვანახლებთ, რომ დაწკაპუნება არ დაიკარგოს
let pressing = false, pendingRender = false, lastView = '', lastTv = '', lastKeys = '';
document.addEventListener('mousedown', () => { pressing = true; });
document.addEventListener('mouseup', () => setTimeout(() => { pressing = false; if (pendingRender) { pendingRender = false; render(); } }, 0));
function render(force) {
  if (!started || !S.sec) return;
  if (pressing && !force) { pendingRender = true; return; }
  renderChrome();
  if (S.sec === 'players' && !force && document.activeElement && document.activeElement.tagName === 'SELECT') return;
  const h = S.sec === 'g1' ? g1Section() : S.sec === 'g2' ? g2Section() : S.sec === 'players' ? playersSection() : boardSection();
  if (h !== lastView || force) { setHTML(view, h); lastView = h; }
}
function renderChrome() {
  const sec = S.sec, mode = S.live.mode || 'lobby';
  $('#pageTitle').textContent = SEC_TITLES[sec];
  $$('.nav').forEach(b => b.classList.toggle('on', b.dataset.sec === sec));
  const conn = $('#connChip');
  conn.className = 'chip ' + (S.conn ? 'ok' : 'bad');
  conn.innerHTML = S.conn ? `${L('wifi')}დაკავშირებულია` : `${L('wifi-off')}კავშირი გაწყდა`;
  const g = sec === 'g1' ? 1 : sec === 'g2' ? 2 : 0;
  $('#quizChip').hidden = !g;
  if (g) $('#quizChip').innerHTML = `${L('list-checks')}ქვიზი: <b>${esc(quizName(g) || 'არ არის არჩეული')}</b>`;
  $('#codeChip').innerHTML = `${L('key-round')}კოდი: <b>${esc(S.session ? S.session.code : '…')}</b>`;
  $('#plChip').innerHTML = `${L('users')}<b>${Object.keys(S.players).length}</b> მოთამაშე`;
  const tv = `<div class="now">${L('monitor')}ტვ-ზე ახლა: <b>${MODE_NAMES[mode]}</b></div>
    <button class="btn ${mode === 'lobby' ? 'primary' : ''} block" data-act="mode" data-id="lobby">${L('log-in')}შესვლის ეკრანი</button>
    <button class="btn ${mode === 'break' ? 'primary' : ''} block" data-act="mode" data-id="break">${L('coffee')}შესვენება</button>`;
  if (tv !== lastTv) { $('#tvBox').innerHTML = tv; lastTv = tv; }
  const keys = sec === 'g1' ? `${kbd('Space')} შემდეგი ნაბიჯი<br>${kbd('←')}${kbd('→')} წინა / შემდეგი კითხვა<br>${kbd('R')} სწორია · ${kbd('W')} არასწორია`
    : sec === 'g2' ? `${kbd('Space')} შემდეგი ნაბიჯი<br>${kbd('←')}${kbd('→')} წინა / შემდეგი კითხვა`
    : sec === 'board' ? `${kbd('Space')} შემდეგი გამოცხადება` : '';
  if (keys !== lastKeys) { $('#keys').innerHTML = keys; lastKeys = keys; }
  icons();
}
// დიდი „თამაშის დაწყება“ ღილაკი ზემოთ; თუ ვერ დაიწყება — რატომ და სად გასწორდეს
function startBanner(g, qs) {
  const mode = g === 1 ? 'g1' : 'g2', l = S.live, n = Object.keys(S.players).length;
  if (l.mode === mode && l.qid) return '';
  const qz = activeQuiz(g);
  let why = null, link = 'admin.html';
  if (!qz || !S.quizzes[qz]) why = 'დღევანდელი ქვიზი არ არის არჩეული — აირჩიე ადმინში.';
  else if (!qs.length) { why = 'ამ ქვიზში ჯერ კითხვები არ არის — დაამატე ადმინში.'; link = 'admin.html#quiz=' + qz; }
  return `<div class="panel startbar"><div class="grow"><b style="font-size:20px">თამაში ${g}: ${g === 1 ? 'ბლიცი' : 'ფაცი თუ ფუცი'}</b><div class="muted">${why ? esc(why) : `შემოსულია ${n} ${g === 1 ? 'მოთამაშე' : 'მონაწილე'}${quizName(g) ? ' · ქვიზი: ' + esc(quizName(g)) : ''}`}</div></div>
  ${why ? `<button class="btn big primary" disabled>${L('play')}თამაშის დაწყება</button><a class="btn" href="${link}" target="_blank">${L('settings')}ადმინში გასწორება</a>` : `<button class="btn big primary" data-act="${g === 1 ? 'g1first' : 'g2first'}" id="startBtn">${L('play')}თამაში ${g}-ის დაწყება</button>`}</div>`;
}
function noQuiz(g) { return `<div class="panel"><h3>${L('circle-alert')}ქვიზი არ არის არჩეული</h3><p>გახსენი <a href="admin.html">admin.html</a> და აირჩიე, რომელი ქვიზი გამოიყენება დღეს თამაში ${g}-ისთვის.</p></div>`; }
function stepRow(step) {
  return `<div class="steprow"><button class="btn big icon" data-act="jump" data-id="-1" data-tip="წინა კითხვა (←)">${L('chevron-left')}</button>
  <button class="btn big primary" id="stepBtn" data-act="${step.act}" ${step.disabled ? 'disabled' : ''}>${L(step.icon)}${step.label}</button>
  <button class="btn big icon" data-act="jump" data-id="1" data-tip="შემდეგი კითხვა (→)">${L('chevron-right')}</button></div>`;
}
const qIcons = x => `<span class="qic">${x.img ? L('image') : ''}${x.snd ? L('music') : ''}${hasSfx(x) ? L('volume-2') : ''}</span>`;
const audioBtns = () => `<button class="btn" data-act="audio" data-id="play">${L('play')}კლიპის დაკვრა</button><button class="btn" data-act="audio" data-id="stop">${L('square')}გაჩერება</button>`;
const teamRows = () => !teamsOn() ? '<p class="muted">ამ თამაშში გუნდები გამორთულია — ყველა თავისთვის თამაშობს (წესები → თამაში 1).</p>' : Array.from({ length: teamCount() }, (_, i) => `<div class="teamrow"><span class="grow">${ttag(i, teamName(S.teams, i))}</span><button class="btn icon" data-act="tscore" data-id="${i}" data-d="-1" data-tip="−1 ქულა">${L('minus')}</button><span class="score">${fmtPts(teamScore(S.teams, i))} <small class="muted" style="font-size:12px;font-weight:700">ქულა</small></span><button class="btn icon" data-act="tscore" data-id="${i}" data-d="1" data-tip="+1 ქულა">${L('plus')}</button></div>`).join('');
const rulesLine = q => q ? `<div class="shortcuts" style="margin:-4px 0 12px">${L('scale')} წესები: ${esc(rulesText(rulesFor(q), q))}</div>` : '';

// ───────── თამაში 1 ─────────
function g1Section() {
  const l = S.live, qs = listQ(1), cur = l.mode === 'g1' ? l.qid : null, q = cur && S.questions[cur];
  const rows = qs.map((x, i) => `<div class="qr ${x.id === cur ? 'on' : ''}" data-act="g1show" data-id="${x.id}"><span class="qn">${i + 1}</span><div class="qmain"><b>${esc(x.text || '(ცარიელი)')}</b><small>პასუხი: ${esc(x.answer || '—')}</small></div>${qIcons(x)}</div>`).join('') || '<div class="empty">ამ ქვიზში კითხვები არ არის.</div>';
  const idx = qs.findIndex(x => x.id === cur), b = l.buzz;
  let step;
  if (!q) step = { act: 'g1first', icon: 'play', label: 'კითხვის ჩვენება', disabled: !qs.length };
  else if (l.phase === 'buzzed') step = { act: 'g1next', icon: 'skip-forward', label: 'ჯერ მონიშნე პასუხი', disabled: true };
  else if (idx >= qs.length - 1) step = { act: 'g1next', icon: 'circle-check-big', label: 'კითხვები დასრულდა', disabled: true };
  else step = { act: 'g1next', icon: 'skip-forward', label: 'შემდეგი კითხვა' };
  const tvNote = l.mode !== 'g1' ? `<span class="chip">${L('monitor')}ტვ-ზე: ${MODE_NAMES[l.mode || 'lobby']}</span>` : '';
  let body;
  if (q) {
    const tOn = teamsOn();
    body = `<p class="stage-q">${esc(q.text)}</p>${rulesLine(q)}<div class="anspill">${L('circle-check-big')}პასუხი: ${esc(q.answer || '—')}</div>
    <div class="buzzbox" style="${b && tOn ? `background:${TEAM_HUES[b.team]}` : ''}">${b ? `${pic(b.avatar)}<span>${esc(b.name)}${tOn ? ' · ' + esc(teamName(S.teams, b.team)) : ''}${l.phase === 'right' ? ' · სწორია' : ''}</span>` : `<span class="muted">${l.phase === 'right' ? 'სწორია!' : l.phase === 'missed' ? 'ღილაკი დაიკეტა — გადადი შემდეგ კითხვაზე' : 'ველოდებით, ვინ დააჭერს…'}</span>`}</div>
    <div class="marks"><button class="btn big mark-ok" data-act="right" ${l.phase === 'buzzed' ? '' : 'disabled'}>${L('check')}სწორია +1</button><button class="btn big mark-no" data-act="wrong" ${l.phase === 'buzzed' ? '' : 'disabled'}>${L('x')}არასწორია</button></div>`;
  } else body = `<p class="muted">აირჩიე კითხვა სიიდან ან დააჭირე „კითხვის ჩვენება“-ს.</p>`;
  const extras = q ? `<div class="row" style="margin-top:14px">${q.snd ? audioBtns() : ''}<button class="btn quiet" data-act="showans">${L('eye')}პასუხი ტვ-ზე</button></div>` : '';
  return `${startBanner(1, qs)}<div class="ctl-grid"><div class="qlist">${rows}</div><div>
  <div class="panel"><h3>${L('zap')}${q ? `კითხვა ${idx + 1} / ${qs.length}` : 'ახლა'}<span class="grow"></span>${tvNote}</h3>${body}
  ${stepRow(step)}<div class="shortcuts">${kbd('Space')} შემდეგი ნაბიჯი · ${kbd('←')}${kbd('→')} წინა / შემდეგი · ${kbd('R')} სწორია · ${kbd('W')} არასწორია</div>${extras}</div>
  <div class="panel"><h3>${L('users')}${teamsOn() ? 'გუნდების ქულები' : 'ქულები'}</h3>${teamRows()}</div></div></div>`;
}

// ───────── თამაში 2 ─────────
function g2Section() {
  const l = S.live, qs = listQ(2), cur = l.mode === 'g2' ? l.qid : null, q = cur && S.questions[cur];
  const rows = qs.map((x, i) => `<div class="qr ${x.id === cur ? 'on' : ''} ${S.awarded[x.id] ? 'played' : ''}" data-act="g2show" data-id="${x.id}"><span class="qn">${i + 1}</span><div class="qmain"><b>${esc(x.text || '(ცარიელი)')}</b></div>${qIcons(x)}<span class="tag t-${x.type}">${TYPE_NAMES[x.type] || ''}</span></div>`).join('') || '<div class="empty">ამ ქვიზში კითხვები არ არის.</div>';
  const idx = qs.findIndex(x => x.id === cur);
  const stage = !q ? 'none' : l.view === 'scoreboard' ? 'board' : l.phase;
  const nextStep = idx >= qs.length - 1 ? { act: 'finale', icon: 'flag', label: 'ფინალზე გადასვლა' } : { act: 'g2next', icon: 'skip-forward', label: 'შემდეგი კითხვა' };
  const noBoard = q && rulesFor(q).board === false;
  const steps = { none: { act: 'g2first', icon: 'play', label: 'კითხვის ჩვენება', disabled: !qs.length }, answering: { act: 'g2lock', icon: 'lock', label: 'პასუხების დაკეტვა' }, locked: { act: 'g2reveal', icon: 'eye', label: 'გამოაშკარავება' }, revealed: noBoard ? nextStep : { act: 'g2board', icon: 'trophy', label: 'ქულების ცხრილი' }, board: nextStep };
  const step = steps[stage] || steps.none;
  const order = ['answering', 'locked', 'revealed', 'board'], si = order.indexOf(stage);
  const stepper = q ? `<div class="stepper">${['კითხვა', 'დაკეტვა', 'გამოაშკარავება', 'ქულები'].map((t, i) => `<span class="${i === si ? 'now' : i < si ? 'done' : ''}">${i < si ? L('check') : ''}${t}</span>`).join('')}</div>` : '';
  let body = '<p class="muted">დააჭირე „კითხვის ჩვენება“-ს ან აირჩიე ნებისმიერი კითხვა სიიდან.</p>', detail = '';
  if (q) {
    const opts = arr(q.options), corr = arr(q.correct).map(Number), players = Object.entries(S.players), va = validAnswers();
    const answered = new Set(va.map(([p]) => p));
    const votes = opts.map((_, i) => va.filter(([, a]) => q.type === 'multi' ? arr(a.a).includes(i) : Number(a.a) === i).length);
    body = `<p class="stage-q">${esc(q.text)}</p>${rulesLine(q)}${stepper}<span class="statusbar" style="margin:0">უპასუხა ${answered.size} / ${players.length}</span>`;
    if (q.type === 'text') {
      const sorted = va.slice().sort(ansOrder);
      detail = `<div class="anspill">${L('circle-check-big')}სწორი პასუხი: ${esc(q.answer || '—')}</div>` + (sorted.map(([pid, a], i) => { const ok = typedOk(q, a); return `<div class="tans ${ok ? 'ok' : (i === 0 ? 'first' : '')}"><b>${i === 0 ? `${L('star')} პირველი` : (i + 1) + '.'}</b>${pic(S.players[pid].avatar)}<span>${esc(S.players[pid].name)}</span><span class="t"><b>${esc(a.a)}</b></span><button class="btn ${ok ? 'mark-ok' : ''}" data-act="mark" data-id="${pid}">${L(ok ? 'circle-check-big' : 'check')}${ok ? 'სწორია' : 'სწორია?'}</button></div>`; }).join('') || '<p class="muted">პასუხები ჯერ არ მოსულა…</p>');
    } else {
      const ord = va.slice().sort(ansOrder), rank = {}; ord.forEach(([p], i) => { rank[p] = i + 1; });
      detail = opts.map((o, i) => {
        const g = corr.includes(i) && q.type !== 'poll';
        const who = ord.filter(([, a]) => q.type === 'multi' ? arr(a.a).map(Number).includes(i) : Number(a.a) === i);
        return `<div class="vote ${g ? 'good' : ''}"><span class="lt">${LETTERS[i]}</span><span class="grow">${esc(o)}</span><b>${votes[i]}</b>${g ? L('circle-check-big') : ''}</div>` +
          (who.length ? `<div class="who" style="margin:4px 0 10px 38px">${who.map(([p]) => `<span class="${rank[p] === 1 ? 'firstpick' : ''}" title="${rank[p]}-ე">${rank[p] === 1 ? L('star') : `<small>${rank[p]}</small>`}${pic(S.players[p].avatar)}${esc(S.players[p].name)}</span>`).join('')}</div>` : '');
      }).join('') + `<p class="hint">ნომერი = რიგი, ვინ როდის უპასუხა. ტვ-ზე ეს არ ჩანს, სანამ „გამოაშკარავებას“ არ დააჭერ.</p>`;
    }
    detail += `<div class="who">${players.map(([id, p]) => `<span class="${answered.has(id) ? 'yes' : 'no'}">${pic(p.avatar)}${esc(p.name)}</span>`).join('')}</div>`;
  }
  const tvNote = l.mode !== 'g2' ? `<span class="chip">${L('monitor')}ტვ-ზე: ${MODE_NAMES[l.mode || 'lobby']}</span>` : '';
  return `${startBanner(2, qs)}<div class="ctl-grid"><div class="qlist">${rows}</div><div>
  <div class="panel"><h3>${L('circle-help')}${q ? `კითხვა ${idx + 1} / ${qs.length}` : 'ახლა'}<span class="grow"></span>${tvNote}</h3>${body}
  ${stepRow(step)}<div class="shortcuts">${kbd('Space')} შემდეგი ნაბიჯი · ${kbd('←')}${kbd('→')} წინა / შემდეგი კითხვა</div>
  ${q && q.snd ? `<div class="row" style="margin-top:14px">${audioBtns()}</div>` : ''}</div>
  ${q ? `<div class="panel"><h3>${L('list')}პასუხები</h3>${detail}</div>` : ''}</div></div>`;
}

// ───────── მოთამაშეები ─────────
function playersSection() {
  const pl = Object.entries(S.players).sort((x, y) => (x[1].joined || 0) - (y[1].joined || 0)), sc = scoreMap(S.awarded), tOn = teamsOn(), n = teamCount();
  const online = pl.filter(([, p]) => isOnline(p)).length;
  const rows = pl.map(([id, p]) => `<div class="prow2"><span class="odot ${isOnline(p) ? 'on' : ''}" data-tip="${isOnline(p) ? 'ონლაინ' : 'ოფლაინ'}"></span>${pic(p.avatar)}<span class="grow">${esc(p.name)}</span>${tOn ? ttag(p.team, teamName(S.teams, p.team)) : ''}<span class="muted">${fmtPts(sc[id] || 0)} ქულა</span>${tOn ? `<select data-team="${id}" aria-label="გუნდი">${Array.from({ length: Math.max(n, (p.team || 0) + 1) }, (_, i) => `<option value="${i}" ${p.team === i ? 'selected' : ''}>${esc(teamName(S.teams, i))}</option>`).join('')}</select>` : ''}<button class="btn icon" data-act="rcode" data-id="${id}" data-tip="დაბრუნების კოდი">${L('qr-code')}</button><button class="btn quiet icon" data-act="pmenu" data-id="${id}" data-tip="მეტი">${L('ellipsis')}</button></div>`).join('') || '<p class="muted">ჯერ არავინ შემოსულა.</p>';
  return `<div class="cols"><div class="panel"><h3>${L('users')}მოთამაშეები (${pl.length}) · ონლაინ ${online}</h3>${rows}<p class="hint" style="margin-top:12px">ვინც ტელეფონს გადატვირთავს ან სხვა ტელეფონიდან შემოვა, იგივე კოდით და სახელით დაბრუნდება თავისი ქულით.</p></div><div>
  <div class="panel"><h3>${L('key-round')}თამაშის კოდი</h3><div class="bigcode">${esc(S.session ? S.session.code : '')}</div><p class="muted">ტელეფონზე: ${esc(location.href.replace(/host\.html.*$/, '').replace(/^https?:\/\//, ''))}</p></div>
  <div class="panel"><h3>${L('volume-2')}ხმის შემოწმება ტვ-ზე</h3><div class="row"><button class="btn" data-act="sfx" data-id="right">${L('check')}სწორი</button><button class="btn" data-act="sfx" data-id="wrong">${L('x')}არასწორი</button></div></div>
  <div class="panel"><h3>${L('rotate-ccw')}ქულების განულება</h3><p class="muted">ყველა ქულა (გუნდების და მოთამაშეების) გახდება 0. მოთამაშეები და კითხვები დარჩება.</p><button class="btn" data-act="resetscores">${L('rotate-ccw')}ქულების განულება</button></div>
  <div class="panel"><h3>${L('trash-2')}ახალი თამაში</h3><p class="muted">წაშლის ყველა მოთამაშეს, ქულას და პასუხს და შექმნის ახალ კოდს. კითხვები და პარამეტრები დარჩება.</p><button class="btn danger" data-act="reset">${L('trash-2')}ყველაფრის განულება</button></div></div></div>`;
}

// ───────── ქულები და ფინალი ─────────
function boardSection() {
  const l = S.live, step = l.step || 0, r = ranking(S.players, S.awarded), fs = finalSteps(), max = fs.length;
  const names = ['დაწყება'].concat(fs.map(x => ({ p2: 'მესამე', p1: 'მეორე', p0: 'პირველი', loser: 'ბოლო' })[x]));
  const fin = l.mode !== 'final'
    ? `<p class="muted">ფინალი ტვ-ზე აჩვენებს მესამე, მეორე და პირველ ადგილს, ბოლოს კი ბოლო ადგილს.</p><button class="btn big primary block" data-act="finale">${L('flag')}ფინალის დაწყება</button>`
    : `<div class="stepper">${names.map((t, i) => `<span class="${i === step ? 'now' : i < step ? 'done' : ''}">${i < step ? L('check') : ''}${t}</span>`).join('')}</div>
       <div class="steprow"><button class="btn big icon" data-act="fstep" data-id="-1" data-tip="უკან" ${step <= 0 ? 'disabled' : ''}>${L('chevron-left')}</button><button class="btn big primary" id="stepBtn" data-act="fstep" data-id="1" ${step >= max ? 'disabled' : ''}>${L('party-popper')}${step >= max ? 'ყველაფერი გამოცხადდა' : 'შემდეგი გამოცხადება'}</button></div><div class="shortcuts">${kbd('Space')} შემდეგი გამოცხადება</div>`;
  const rank = r.map((p, i) => `<div class="prow2"><span class="qn" style="min-width:30px;height:24px;border-radius:999px;background:${i === 0 ? 'var(--pink)' : 'var(--pink-l)'};color:${i === 0 ? '#fff' : 'inherit'};display:grid;place-items:center;font-size:13px;font-weight:700">${i + 1}</span>${pic(p.avatar)}<span class="grow">${esc(p.name)}</span><b>${fmtPts(p.score)}</b> <span class="muted">ქულა</span></div>`).join('') || '<p class="muted">ჯერ არავინ შემოსულა.</p>';
  return `<div class="cols"><div><div class="panel"><h3>${L('flag')}ფინალი</h3>${fin}</div><div class="panel"><h3>${L('zap')}თამაში 1 · გუნდები</h3>${teamRows()}</div></div>
  <div class="panel"><h3>${L('trophy')}თამაში 2 · მონაწილეები</h3>${rank}</div></div>`;
}

// ───────── მოქმედებები ─────────
const A = {
  async mode(m) {
    if (S.live.mode === m || (!S.live.mode && m === 'lobby')) return;
    if (S.live.mode && S.live.mode !== 'lobby' && !(await popup({ title: 'ეკრანის გადართვა', text: `ტვ-ზე გამოჩნდება: ${MODE_NAMES[m]}. გავაგრძელო?`, ok: 'გადართვა' }))) return;
    db.ref('live').set({ mode: m });
  },
  sfx(kind) { db.ref('live/sfx').set({ kind, n: Date.now() }); },
  async reset() {
    if (!(await ask('წაიშლება ყველა მოთამაშე, ქულა და პასუხი. კითხვები და პარამეტრები დარჩება.', 'დიახ, განულება'))) return;
    const u = { players: null, answers: null, awarded: null, seq: null, rejoin: null, live: { mode: 'lobby' }, 'session/code': String(Math.floor(1000 + Math.random() * 9000)), 'session/nextTeam': 0 };
    for (let i = 0; i < 4; i++) u['teams/' + i + '/score'] = 0;
    db.ref().update(u); toast('თამაში განულდა');
  },
  // თამაში 1
  g1first() { const qs = listQ(1); if (qs[0]) A.g1show(qs[0].id); },
  g1show(id) {
    const q = S.questions[id]; if (!q) return;
    db.ref('live').set({ mode: 'g1', qid: id, q: { text: q.text || '', img: q.img || null, snd: q.snd || null, sfx: q.sfx || null, rules: rulesFor(q) }, phase: 'open' });
  },
  g1next() { const qs = listQ(1), i = qs.findIndex(x => x.id === S.live.qid), nx = qs[i + 1]; if (nx) A.g1show(nx.id); else toast('კითხვები დასრულდა'); },
  async right() {
    let bz = null, qid = null;
    const r = await db.ref('live').transaction(l => {
      if (!l || l.phase !== 'buzzed' || !l.buzz) return;
      bz = l.buzz; qid = l.qid; l.phase = 'right'; l.reveal = { answer: (S.questions[l.qid] || {}).answer || '' };
      return l;
    }, null, false);
    if (r.committed && bz) { addPoints(bz, qid, Number(rulesFor(S.questions[qid]).pts) || 0); db.ref('live/sfx').set({ kind: 'right', n: Date.now() }); }
  },
  async wrong() {
    let bz = null, qid = null;
    const r = await db.ref('live').transaction(l => {
      if (!l || l.phase !== 'buzzed' || !l.buzz) return;
      const rr = (l.q && l.q.rules) || {}, key = l.buzz.key || ('t' + l.buzz.team);
      bz = l.buzz; qid = l.qid;
      l.wrong = l.wrong || {}; l.wrong[key] = true; l.lastWrong = key; delete l.buzz;
      l.phase = rr.afterWrong === 'next' ? 'missed' : 'open';
      return l;
    }, null, false);
    if (r.committed && bz) { const pen = Number(rulesFor(S.questions[qid]).penalty) || 0; if (pen) addPoints(bz, qid, -pen); db.ref('live/sfx').set({ kind: 'wrong', n: Date.now() }); }
  },
  showans() { const q = S.questions[S.live.qid]; if (q) db.ref('live/reveal').set({ answer: q.answer || '' }); },
  audio(cmd) { db.ref('live/audio').set({ cmd, n: Date.now() }); },
  tscore(i, b) { db.ref('teams/' + i + '/score').transaction(v => (v || 0) + Number(b.dataset.d)); },
  // თამაში 2
  g2first() { const qs = listQ(2); if (qs[0]) A.g2show(qs[0].id); },
  async g2show(id) {
    const q = S.questions[id]; if (!q) return;
    if (S.awarded[id] && !(await popup({ title: 'თავიდან ჩვენება?', text: 'ამ კითხვას უკვე აქვს ქულები. თუ თავიდან აჩვენებ, ამ კითხვის ქულები და პასუხები წაიშლება.', ok: 'თავიდან ჩვენება', danger: true }))) return;
    const pub = { type: q.type, text: q.text || '', img: q.img || null, snd: q.snd || null, sfx: q.sfx || null, rules: rulesFor(q), wrongFx: q.wrongFx || null };
    if (q.type !== 'text') pub.options = arr(q.options);
    db.ref().update({ ['answers/' + id]: null, ['awarded/' + id]: null, ['seq/' + id]: null, live: { mode: 'g2', qid: id, q: pub, phase: 'answering', view: 'question' } });
  },
  g2next() { const qs = listQ(2), i = qs.findIndex(x => x.id === S.live.qid), nx = qs[i + 1]; if (nx) A.g2show(nx.id); else toast('კითხვები დასრულდა'); },
  async resetscores() {
    if (!(await ask('ყველა ქულა გახდება 0. მოთამაშეები და კითხვები დარჩება.', 'დიახ, განულება'))) return;
    const u = { awarded: null }; for (let i = 0; i < 6; i++) u['teams/' + i + '/score'] = 0;
    db.ref().update(u); toast('ქულები განულდა');
  },
  rcode(id) { rejoinCode(id); },
  pmenu(id, b) {
    openMenu(b, [
      { icon: 'pencil', label: 'სახელის შეცვლა', run: () => renamePlayer(id) },
      { icon: 'merge', label: 'სხვა მოთამაშესთან გაერთიანება…', run: () => mergePlayer(id) },
      'sep',
      { icon: 'trash-2', label: 'წაშლა', danger: true, run: () => A.kick(id) }
    ]);
  },
  g2lock() { db.ref('live').update({ phase: 'locked', lockedAt: TS }); },
  async g2reveal() {
    const qid = S.live.qid, q = S.questions[qid]; if (!q) return;
    S.answers = (await db.ref('answers/' + qid).once('value')).val() || {};
    const { aw, right, first } = computeAwards();
    db.ref().update({ ['awarded/' + qid]: Object.keys(aw).length ? aw : null, 'live/phase': 'revealed', 'live/reveal': { correct: arr(q.correct), answer: q.answer || '', right: Object.keys(right).length ? right : null, first: first || null } });
  },
  g2board() { db.ref('live/view').set('scoreboard'); },
  mark(pid) {
    const a = S.answers[pid], q = S.questions[S.live.qid]; if (!a || !q) return;
    db.ref('answers/' + S.live.qid + '/' + pid + '/ok').set(!typedOk(q, a)).then(() => {
      if (S.live.phase === 'revealed') setTimeout(() => { const { aw, right } = computeAwards(); db.ref().update({ ['awarded/' + S.live.qid]: Object.keys(aw).length ? aw : null, 'live/reveal/right': Object.keys(right).length ? right : null }); }, 150);
    });
  },
  async finale() {
    S.sec = 'board'; render(true);
    if (S.live.mode === 'final') return;
    if (!(await popup({ title: 'ფინალის დაწყება', text: 'ტვ-ზე გამოჩნდება პოდიუმი. გავაგრძელო?', ok: 'დაწყება' }))) return;
    db.ref('live').set({ mode: 'final', step: 0 });
  },
  fstep(d) { db.ref('live/step').set(Math.max(0, Math.min(finalSteps().length, (S.live.step || 0) + Number(d)))); },
  async kick(id) { const p = S.players[id]; if (p && await ask(`${p.name} წაიშლება თამაშიდან.`)) db.ref('players/' + id).remove(); },
  jump(d) {
    const g = S.sec === 'g1' ? 1 : S.sec === 'g2' ? 2 : 0; if (!g) return;
    const qs = listQ(g), cur = S.live.mode === (g === 1 ? 'g1' : 'g2') ? S.live.qid : null, i = qs.findIndex(x => x.id === cur);
    const t = i < 0 ? (Number(d) > 0 ? 0 : -1) : i + Number(d);
    if (t >= 0 && t < qs.length) (g === 1 ? A.g1show : A.g2show)(qs[t].id);
  }
};
// ქულები კითხვის წესების მიხედვით
function computeAwards() { const q = S.questions[S.live.qid]; return scoreQuestion(q, validAnswers(), rulesFor(q)); }
const typedOk = (q, a) => a.ok === true || (a.ok === undefined && rulesFor(q).typed === 'auto' && autoMatch(a.a, q.answer));
// ბლიცში ქულა გუნდს ან (გუნდების გარეშე) მოთამაშეს
function addPoints(bz, qid, pts) {
  if (!pts) return;
  if (teamsOn()) db.ref('teams/' + bz.team + '/score').transaction(v => Math.round(((v || 0) + pts) * 100) / 100);
  else db.ref('awarded/' + qid + '/' + bz.pid).transaction(v => { const n = Math.round(((v === true ? 1 : Number(v) || 0) + pts) * 100) / 100; return n || null; });
}
// პირადი 4-ციფრიანი კოდი + QR: მოთამაშე ნებისმიერი ტელეფონიდან ბრუნდება. ახალი კოდი ძველს აუქმებს.
async function rejoinCode(id, fresh) {
  const p = S.players[id]; if (!p) return;
  const map = (await db.ref('rejoin').once('value')).val() || {};
  let code = !fresh && p.rcode && map[p.rcode] === id ? p.rcode : null;
  if (!code) {
    do { code = String(Math.floor(1000 + Math.random() * 9000)); } while (map[code]);
    const u = { ['rejoin/' + code]: id, ['players/' + id + '/rcode']: code };
    if (p.rcode && map[p.rcode] === id) u['rejoin/' + p.rcode] = null;
    await db.ref().update(u);
  }
  const url = location.href.replace(/host\.html.*$/, '') + 'index.html?code=' + encodeURIComponent(S.session ? S.session.code : '') + '&r=' + code + (NS ? '&ns=' + encodeURIComponent(NS) : '');
  const pr = popup({ title: `${p.name} — დაბრუნება`, text: 'მოთამაშემ გახსნას თამაში ნებისმიერ ტელეფონზე (ან დაასკანეროს QR), დააჭიროს „უკვე ვთამაშობდი“ და ჩაწეროს ეს კოდი.', html: `<div class="rjcode">${code}</div><div id="qrbox" class="qrbox"></div><input type="hidden" name="act" value="ok">`, ok: 'კარგი', cancel: false, extra: { label: 'ახალი კოდი', value: 'new' } });
  try { new QRCode(document.getElementById('qrbox'), { text: url, width: 180, height: 180, colorDark: '#3A0F2A', colorLight: '#ffffff' }); } catch (e) {}
  const v = await pr;
  if (v === 'new') rejoinCode(id, true); // მხოლოდ „ახალი კოდი“ ქმნის ახალს; დახურვა (Esc, გარეთ დაჭერა, „კარგი“) — არა
}
async function renamePlayer(id) {
  const p = S.players[id]; if (!p) return;
  const v = await popup({ title: 'სახელის შეცვლა', text: '', html: `<input type="text" name="name" value="${esc(p.name)}" maxlength="14" style="width:100%;margin-bottom:16px">`, ok: 'შენახვა' });
  if (!v) return;
  const name = String(v.name || '').trim();
  if (!name) return;
  if (Object.entries(S.players).some(([k, x]) => k !== id && x.name.trim().toLowerCase() === name.toLowerCase())) { note('ეს სახელი უკვე აქვს სხვა მოთამაშეს.'); return; }
  db.ref('players/' + id + '/name').set(name);
}
async function mergePlayer(id) {
  const p = S.players[id]; if (!p) return;
  const others = Object.entries(S.players).filter(([k]) => k !== id);
  if (!others.length) { note('გასაერთიანებელი სხვა მოთამაშე არ არის.'); return; }
  const v = await popup({ title: 'გაერთიანება', text: `„${p.name}“-ის ქულები დაემატება არჩეულ მოთამაშეს, „${p.name}“ კი წაიშლება.`, html: `<select name="to" style="width:100%;margin-bottom:16px">${others.map(([k, x]) => `<option value="${k}">${esc(x.name)}</option>`).join('')}</select>`, ok: 'გაერთიანება', danger: true });
  if (!v || !v.to || !S.players[v.to]) return;
  const u = {};
  Object.entries(S.awarded).forEach(([qid, m]) => {
    if (m[id] === undefined) return;
    const val = x => x === true ? 1 : Number(x) || 0, sum = Math.round((val(m[id]) + val(m[v.to])) * 100) / 100;
    u['awarded/' + qid + '/' + v.to] = sum || null; u['awarded/' + qid + '/' + id] = null;
  });
  u['players/' + id] = null;
  await db.ref().update(u); toast('მოთამაშეები გაერთიანდა');
}
document.addEventListener('click', e => {
  const n = e.target.closest('[data-sec]');
  if (n) { S.sec = n.dataset.sec; lastView = ''; render(true); n.blur(); return; }
  const b = e.target.closest('[data-act]');
  if (b && !b.disabled && A[b.dataset.act]) { A[b.dataset.act](b.dataset.id, b); if (b.blur) b.blur(); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.team !== undefined) db.ref('players/' + t.dataset.team + '/team').set(Number(t.value));
});
// კლავიატურა: Space = შემდეგი ნაბიჯი, ← → = წინა/შემდეგი კითხვა, R/W = სწორია/არასწორია
document.addEventListener('keydown', e => {
  if (!started || popOpen() || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest && e.target.closest('input, textarea, select')) return;
  if (e.code === 'Space') {
    e.preventDefault();
    const b = $('#stepBtn');
    if (b && !b.disabled) b.click();
    else if (S.sec === 'g1' && S.live.phase === 'buzzed') toast('ჯერ მონიშნე: სწორია ან არასწორია');
  } else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') { e.preventDefault(); A.jump(e.code === 'ArrowRight' ? 1 : -1); }
  else if (S.sec === 'g1' && e.code === 'KeyR') A.right();
  else if (S.sec === 'g1' && e.code === 'KeyW') A.wrong();
});
