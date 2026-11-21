// ფაციფუცობანა — ადმინის გვერდი: ქვიზები, კითხვები, სურათები, ხმები, პარამეტრები
const M = { tab: 'quiz', quizzes: {}, questions: {}, images: {}, sounds: {}, teams: {}, selQuiz: null, selQ: null, cur: null, sel: new Set(), moveIds: [], loaded: {}, imgData: {} };
const view = $('#view');
const MAX_SND_MB = 3, MAX_SND_SEC = 30;
const TAB_TITLES = { quiz: 'ქვიზები და კითხვები', rules: 'წესები', images: 'სურათები', sounds: 'ხმები', settings: 'პარამეტრები' };
const TYPE_NAMES = { buzz: 'ბლიც', single: 'ერთი სწორი', multi: 'რამდენიმე სწორი', poll: 'გამოკითხვა', text: 'ჩაწერითი' };
const EV_NAME = Object.fromEntries(SOUND_EVENTS);
const Q_EVENTS = { 1: ['buzz', 'right', 'wrong'], 2: ['reveal', 'scoreboard'] };
$('#gateLogo').innerHTML = logoHtml(); $('#sideLogo').innerHTML = logoHtml();
gate(start);

let started = false;
function start() {
  if (started) return; started = true;
  setSaved(true);
  const on = (path, key) => db.ref(path).on('value', s => { M[key] = s.val() || {}; M.loaded[key] = true; onData(key); });
  on('quizzes', 'quizzes'); on('questions', 'questions'); on('library/images', 'images'); on('library/sounds', 'sounds'); on('teams', 'teams');
  watchConfig(() => { $('#sideLogo').innerHTML = logoHtml(); document.title = gameName() + ' — ადმინი'; M.loaded.config = true; onData('config'); });
  icons();
}

// ───────── ავტომატური შენახვა ─────────
const pending = new Map();
function setSaved(ok) { setHTML($('#saveBadge'), ok ? `${L('circle-check-big')}ყველაფერი შენახულია` : `${L('refresh-cw')}ინახება…`); $('#saveBadge').className = 'chip' + (ok ? ' ok' : ''); }
function queueSave(key, fn, delay) {
  clearTimeout((pending.get(key) || {}).t);
  setSaved(false);
  const t = setTimeout(() => run(key), delay == null ? 450 : delay);
  pending.set(key, { t, fn });
}
function run(key) {
  const p = pending.get(key); if (!p) return;
  clearTimeout(p.t); pending.delete(key);
  Promise.resolve(p.fn()).then(() => { if (!pending.size) setSaved(true); });
}
window.addEventListener('beforeunload', () => { [...pending.keys()].forEach(run); });

// ───────── ინიციალიზაცია და განახლება ─────────
let inited = false;
function onData() {
  const L0 = M.loaded;
  if (!(L0.quizzes && L0.questions && L0.images && L0.sounds && L0.teams && L0.config)) return;
  if (!inited) {
    inited = true; ensureBase();
    if (!Object.keys(M.quizzes).length) { // პირველი გაშვება: ორი ცარიელი ქვიზი
      const a = db.ref('quizzes').push().key, b = db.ref('quizzes').push().key;
      db.ref().update({ ['quizzes/' + a]: { name: 'ბლიცი: პირველი ქვიზი', game: 1, created: TS }, ['quizzes/' + b]: { name: 'ფაცი თუ ფუცი: პირველი ქვიზი', game: 2, created: TS }, 'config/active/g1': a, 'config/active/g2': b });
      return;
    }
    render(true); return;
  }
  if (M.selQuiz && !M.quizzes[M.selQuiz]) { M.selQuiz = null; closeEditor(); }
  if (!M.selQuiz) { M.selQuiz = firstQuiz(); if (M.tab === 'quiz') return render(true); }
  if (M.selQ && !M.questions[M.selQ]) closeEditor();
  renderChrome();
  if (M.tab === 'quiz') { if (!$('#qz-col')) return render(true); drawQuizCol(); drawQHead(true); drawQList(); }
  else render(false);
}
function firstQuiz() { const a = activeQuiz(2) || activeQuiz(1); return (a && M.quizzes[a]) ? a : (Object.keys(M.quizzes)[0] || null); }
function render(force) {
  if (!inited) return;
  if (!M.selQuiz) M.selQuiz = firstQuiz();
  renderChrome();
  if (!force) { const a = document.activeElement; if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT')) return; }
  if (M.tab === 'quiz') renderQuizTab();
  else if (M.tab === 'rules') renderRules();
  else if (M.tab === 'images') renderImages();
  else if (M.tab === 'sounds') renderSounds();
  else renderSettings();
}
function renderChrome() {
  $('#pageTitle').textContent = TAB_TITLES[M.tab];
  $$('.nav').forEach(b => b.classList.toggle('on', b.dataset.sec === M.tab));
  const qz = M.quizzes[M.selQuiz], chip = $('#quizChip');
  chip.hidden = !qz;
  if (qz) { const t = activeQuiz(qz.game) === M.selQuiz; chip.className = 'chip' + (t ? ' star' : ''); setHTML(chip, `${L(t ? 'star' : 'list-checks')}ქვიზი: <b>${esc(qz.name)}</b>${t ? ' · დღეს საღამოს' : ''}`); }
}
const activeQuiz = g => (CFG.active || {})['g' + g];
const pic = a => `<span class="pic">${av(a)}</span>`;
const quizList = game => Object.entries(M.quizzes).filter(([, q]) => q.game === game).sort((a, b) => (a[1].created || 0) - (b[1].created || 0));
const qOf = qz => Object.entries(M.questions).filter(([, q]) => q.quiz === qz).map(([id, q]) => Object.assign({ id }, q)).sort((a, b) => (a.order || 0) - (b.order || 0));
const hasSfx = q => q.sfx && Object.keys(q.sfx).length > 0;
const hasRules = q => q.rules && Object.keys(q.rules).length > 0;
function qComplete(q) {
  if (!q.text) return false;
  if (q.type === 'single') return arr(q.options).length >= 2 && arr(q.options).every(o => o) && arr(q.correct).length === 1;
  if (q.type === 'multi') return arr(q.options).every(o => o) && arr(q.correct).length >= 1;
  if (q.type === 'poll') return arr(q.options).length === 2 && arr(q.options).every(o => o);
  return !!q.answer;
}
const sndName = v => !v || v === 'default' ? 'ჩაშენებული' : v === 'none' ? 'უხმოდ' : (M.sounds[v] ? M.sounds[v].name : 'წაშლილი ხმა');
const sndOptions = (cur, first) => `${first}${Object.entries(M.sounds).map(([id, s]) => `<option value="${id}" ${cur === id ? 'selected' : ''}>${esc(s.name)} (${Math.round(s.dur || 0)} წმ)</option>`).join('')}`;

// ═════════ ქვიზები და კითხვები ═════════
function renderQuizTab() {
  setHTML(view, `<div class="qz-grid"><div class="panel qzlist" id="qz-col" style="padding:16px"></div><div id="ql-col"></div></div>`);
  drawQuizCol(); drawQHead(); if (M.selQ && M.cur) drawEditor();
}
function drawQuizCol() {
  const grp = (g, title) => `<h3 style="padding:4px 6px 0">${L(g === 1 ? 'zap' : 'circle-help')}${title}<span class="grow"></span><button class="btn quiet icon" data-a="newquiz" data-id="${g}" data-tip="ახალი ქვიზი">${L('plus')}</button></h3>` +
    (quizList(g).map(([id, q]) => `<div class="qzi ${id === M.selQuiz ? 'on' : ''}" data-qz="${id}"><span class="grow">${esc(q.name)}<br><small>${qOf(id).length} კითხვა</small></span>${activeQuiz(g) === id ? `<span data-tip="დღეს საღამოს">${L('star')}</span>` : ''}</div>`).join('') || '<p class="hint" style="padding:0 12px">ქვიზი არ არის</p>');
  setHTML($('#qz-col'), grp(1, 'თამაში 1 · ბლიცი') + '<div style="height:12px"></div>' + grp(2, 'თამაში 2 · ფაცი თუ ფუცი'));
}
function drawQHead(listOnly) {
  const col = $('#ql-col'); if (!col) return;
  const qz = M.quizzes[M.selQuiz];
  if (!qz) { setHTML(col, '<div class="panel"><p>ქვიზი არ არის. დაამატე მარცხნივ.</p></div>'); return; }
  const tonight = activeQuiz(qz.game) === M.selQuiz;
  const tonightBtn = `<button class="btn ${tonight ? '' : 'primary'}" data-a="tonight" ${tonight ? 'disabled' : ''}>${L('star')}${tonight ? 'დღეს საღამოს ეს არის' : 'დღეს ეს გამოვიყენოთ'}</button>`;
  if (!$('#ql-name') || !listOnly) {
    setHTML(col, `<div class="panel"><input type="text" id="ql-name" value="${esc(qz.name)}" maxlength="50" aria-label="ქვიზის სახელი" style="font-weight:800;font-size:18px"><div class="row" style="margin-top:12px"><span id="ql-tonight">${tonightBtn}</span><span class="grow"></span><button class="btn icon" data-a="dupquiz" data-tip="ქვიზის დუბლირება">${L('copy')}</button><button class="btn quiet icon danger" data-a="delquiz" data-tip="ქვიზის წაშლა">${L('trash-2')}</button></div></div>
    <div class="row" style="margin:0 0 12px"><button class="btn primary" data-a="addq">${L('plus')}ახალი კითხვა</button><span class="grow"></span><span id="ql-bulk" class="row"></span></div>
    <div class="qlist" id="ql-list"></div><p class="hint" style="margin-top:10px">${L('grip-vertical')} გადაათრიე რიგის შესაცვლელად · დააჭირე კითხვას რედაქტირებისთვის</p>`);
  } else setHTML($('#ql-tonight'), tonightBtn);
  drawQList();
}
function drawQList() {
  const el = $('#ql-list'); if (!el) return;
  const qs = qOf(M.selQuiz);
  [...M.sel].forEach(id => { if (!qs.some(q => q.id === id)) M.sel.delete(id); });
  setHTML($('#ql-bulk'), M.sel.size ? `<span class="chip">მონიშნულია: <b>${M.sel.size}</b></span><button class="btn" data-a="movesel">${L('arrow-right-left')}გადატანა…</button><button class="btn quiet" data-a="selclear">მოხსნა</button>` : '');
  setHTML(el, qs.map((x, i) => `<div class="qr ${x.id === M.selQ ? 'on' : ''}" draggable="true" data-a="editq" data-id="${x.id}"><input type="checkbox" class="qsel" data-id="${x.id}" ${M.sel.has(x.id) ? 'checked' : ''} aria-label="მონიშვნა"><span class="grip" data-tip="გადაათრიე">${L('grip-vertical')}</span><span class="qn">${i + 1}</span><div class="qmain"><b>${esc(x.text || '(ცარიელი კითხვა)')}</b>${qComplete(x) ? '' : `<small class="warn">არასრულია</small>`}</div><span class="qic">${x.img ? `<span data-tip="სურათი">${L('image')}</span>` : ''}${x.snd ? `<span data-tip="კლიპი">${L('music')}</span>` : ''}${hasSfx(x) ? `<span data-tip="საკუთარი ხმები">${L('volume-2')}</span>` : ''}${hasRules(x) ? `<span data-tip="საკუთარი წესები">${L('scale')}</span>` : ''}</span><span class="tag t-${x.type}">${TYPE_NAMES[x.type] || ''}</span><button class="btn quiet icon" data-a="more" data-id="${x.id}" data-tip="მეტი" aria-label="მეტი">${L('ellipsis')}</button></div>`).join('') || '<div class="empty">ამ ქვიზში კითხვები ჯერ არ არის.</div>');
}

// ── რედაქტორი (მარჯვენა პანელი) ──
function openEditor() { $('#drawer').classList.add('open'); document.body.classList.add('drawer-open'); }
function closeEditor() {
  if (M.selQ) run('q:' + M.selQ);
  M.selQ = null; M.cur = null;
  $('#drawer').classList.remove('open'); document.body.classList.remove('drawer-open');
  drawQList();
}
function drawEditor() {
  const c = M.cur, body = $('#edBody'); if (!c) return;
  const t = c.type, opts = arr(c.options), corr = arr(c.correct).map(Number);
  const n = qOf(c.quiz).findIndex(q => q.id === M.selQ) + 1;
  $('#drawerTitle').textContent = `კითხვა ${n} · ${TYPE_NAMES[t] || ''}`;
  let h = `<div class="sect"><h4>${L('type')}კითხვა</h4>`;
  if (c.game === 2) h += `<select id="e_type" style="margin-bottom:10px">${['single', 'multi', 'poll', 'text'].map(k => `<option value="${k}" ${t === k ? 'selected' : ''}>${{ single: 'ერთი სწორი პასუხი (4 ვარიანტი)', multi: 'რამდენიმე სწორი პასუხი (4 ვარიანტი)', poll: 'გამოკითხვა (2 ვარიანტი, ქულის გარეშე)', text: 'ჩაწერითი პასუხი' }[k]}</option>`).join('')}</select>`;
  else h += `<p class="hint">ბლიც კითხვა: წამყვანი ხმამაღლა კითხულობს.</p>`;
  h += `<textarea id="e_text" rows="3" placeholder="კითხვის ტექსტი">${esc(c.text)}</textarea></div>`;
  if (t === 'single' || t === 'multi' || t === 'poll') {
    h += `<div class="sect"><h4>${L('list')}ვარიანტები ${t === 'poll' ? '' : '· მონიშნე სწორი'}</h4>`;
    opts.forEach((o, i) => { h += `<div class="optrow">${t === 'poll' ? `<span class="lt">${LETTERS[i]}</span>` : `<input type="${t === 'single' ? 'radio' : 'checkbox'}" name="cor" class="e_cor" data-i="${i}" ${corr.includes(i) ? 'checked' : ''} aria-label="სწორი">`}<input type="text" class="e_opt" value="${esc(o)}" placeholder="${LETTERS[i]} ვარიანტი"></div>`; });
    h += '</div>';
  } else {
    h += `<div class="sect"><h4>${L('circle-check-big')}სწორი პასუხი</h4><input type="text" id="e_ans" value="${esc(c.answer)}"><p class="hint">${t === 'buzz' ? 'ჩანს მხოლოდ წამყვანს.' : 'ჩანს წამყვანს და ტვ-ზე გამოაშკარავებისას.'}</p></div>`;
  }
  const im = c.img && M.images[c.img];
  h += `<div class="sect"><h4>${L('image')}სურათი · ჩანს ტვ-ზე</h4><div class="row">${im ? `<img class="thumb" src="${im.thumb}" alt="">` : '<span class="hint">სურათი არ არის</span>'}<span class="grow"></span><button class="btn" data-a="pickimg">${L('images')}ბიბლიოთეკიდან</button><label class="btn">${L('upload')}ატვირთვა<input type="file" id="e_img_up" accept="image/*" hidden></label>${c.img ? `<button class="btn quiet icon danger" data-a="rmimg" data-tip="სურათის მოხსნა">${L('x')}</button>` : ''}</div></div>`;
  h += `<div class="sect"><h4>${L('music')}კლიპი · მაგ. „გამოიცანი სიმღერა“ (წამყვანი უკრავს)</h4><div class="row"><select id="e_snd" class="grow">${sndOptions(c.snd, '<option value="">კლიპის გარეშე</option>')}</select>${c.snd ? `<button class="btn icon" data-a="playsnd" data-id="${c.snd}" data-tip="მოსმენა">${L('play')}</button>` : ''}<label class="btn icon" data-tip="ახლის ატვირთვა">${L('upload')}<input type="file" id="e_snd_up" accept="audio/*" hidden></label></div></div>`;
  const sf = c.sfx || {};
  h += `<div class="sect"><h4>${L('volume-2')}ხმები ამ კითხვისთვის</h4><p class="hint">ჩვეულებრივ: „ნაგულისხმევი“ — თამაშის საერთო ხმა (ხმები → თამაშის ხმები).</p>` +
    Q_EVENTS[c.game].map(ev => `<div class="evline"><b>${EV_NAME[ev]}</b><select data-qev="${ev}">${sndOptions(sf[ev], `<option value="">ნაგულისხმევი (${esc(sndName((CFG.sounds || {})[ev]))})</option>`)}</select><button class="btn icon" data-a="qevplay" data-id="${ev}" data-tip="მოსმენა">${L('play')}</button><label class="btn icon" data-tip="ახლის ატვირთვა">${L('upload')}<input type="file" data-qevup="${ev}" accept="audio/*" hidden></label></div>`).join('') + '</div>';
  h += rulesSect(c);
  h += `<div class="sect"><h4>${L('monitor')}ასე გამოჩნდება ტვ-ზე</h4><div class="tvwrap"><div class="tvframe tv" id="tvprev"></div></div><p class="saved" id="e_status">${L('circle-check-big')}შენახულია</p></div>`;
  setHTML(body, h);
  openEditor(); drawPreview();
}
// კითხვის საკუთარი წესები („თამაშის წესი“ = არაფერი არ ინახება)
function qRuleKeys(c) {
  if (c.game === 1) return ['pts', 'penalty', 'afterWrong'].concat((c.rules || {}).afterWrong === 'all' || (rulesG(1).afterWrong === 'all' && !(c.rules || {}).afterWrong) ? ['sameTeamTwice'] : []);
  const k = ['award'];
  if (((c.rules || {}).award || rulesG(2).award) === 'firstN') k.push('awardN');
  k.push('pts', 'penalty');
  if (c.type === 'multi') k.push('multi');
  if (c.type === 'text') k.push('typed');
  k.push('board');
  return k;
}
const RULE_NAMES = { award: 'ვინ იღებს ქულას', awardN: 'რამდენი პირველი სწორი', pts: 'ქულა სწორ პასუხზე', penalty: 'ქულის დაკლება შეცდომაზე', multi: 'რამდენიმე სწორი პასუხი', typed: 'ჩაწერითი პასუხის შემოწმება', board: 'ქულების ცხრილი კითხვის შემდეგ', afterWrong: 'არასწორი პასუხის შემდეგ', sameTeamTwice: 'იგივე გუნდს ისევ შეუძლია დაჭერა' };
const NUM_RULES = ['pts', 'penalty', 'awardN'];
function ruleControl(key, val, def, attr) {
  if (NUM_RULES.includes(key)) return `<input type="number" ${attr} step="${key === 'awardN' ? 1 : 0.5}" min="0" value="${val === undefined ? '' : esc(val)}" placeholder="${def === undefined ? '' : 'თამაშის წესი: ' + esc(def)}">`;
  const opts = RULE_OPTS[key] || [];
  return `<select ${attr}>${def !== undefined ? `<option value="" ${val === undefined ? 'selected' : ''}>თამაშის წესი: ${esc(optLabel(key, def))}</option>` : ''}${opts.map(([v, l]) => `<option value="${v}" ${val !== undefined && String(val) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
}
function rulesSect(c) {
  const g = rulesG(c.game), own = c.rules || {};
  return `<div class="sect"><h4>${L('scale')}წესები ამ კითხვისთვის</h4><p class="hint">ჩვეულებრივ: „თამაშის წესი“ (წესები → ${c.game === 1 ? 'თამაში 1' : 'თამაში 2'}).</p>` +
    qRuleKeys(c).map(k => `<div class="evline" style="grid-template-columns:190px minmax(0,1fr)"><b>${RULE_NAMES[k]}</b>${ruleControl(k, own[k], g[k], `data-qrule="${k}"`)}</div>`).join('') + '</div>';
}
function setRule(k, raw) {
  const r = M.cur.rules = Object.assign({}, M.cur.rules || {});
  if (raw === '' || raw === undefined) delete r[k];
  else r[k] = NUM_RULES.includes(k) ? Number(raw) : raw === 'true' ? true : raw === 'false' ? false : raw;
  scheduleQSave();
}
async function drawPreview() {
  const box = $('#tvprev'); if (!box || !M.cur) return;
  const w = box.parentElement.clientWidth || 520;
  box.style.setProperty('--u', (w / 100) + 'px'); box.style.setProperty('--v', (w * 9 / 16 / 100) + 'px'); box.style.fontSize = (w / 50) + 'px';
  const c = M.cur; let imgHtml = '';
  if (c.img) {
    if (M.imgData[c.img] === undefined) { M.imgData[c.img] = null; db.ref('libdata/img/' + c.img).once('value').then(s => { M.imgData[c.img] = s.val() || ''; drawPreview(); }); }
    imgHtml = M.imgData[c.img] ? `<img class="qimg" src="${M.imgData[c.img]}" alt="">` : '<div class="hint">სურათი იტვირთება…</div>';
  }
  box.innerHTML = tvPreviewHtml({ type: c.type, text: c.text, options: c.options, snd: c.snd, img: c.img }, imgHtml);
}
function collect() {
  const c = M.cur; if (!c) return;
  c.text = $('#e_text').value;
  if ($('.e_opt')) { c.options = $$('.e_opt').map(i => i.value); c.correct = $$('.e_cor').filter(x => x.checked).map(x => Number(x.dataset.i)); }
  if ($('#e_ans')) c.answer = $('#e_ans').value;
  scheduleQSave(); drawPreview();
}
function qDoc(c) {
  const d = { quiz: c.quiz, game: c.game, order: c.order, type: c.type, text: c.text || '', answer: c.answer || '', img: c.img || null, snd: c.snd || null, sfx: c.sfx && Object.keys(c.sfx).length ? c.sfx : null, rules: c.rules && Object.keys(c.rules).length ? c.rules : null };
  if (c.type !== 'text' && c.type !== 'buzz') { d.options = arr(c.options); const k = arr(c.correct).map(Number); if (k.length && c.type !== 'poll') d.correct = k; }
  return d;
}
function scheduleQSave() {
  const c = M.cur, id = M.selQ; if (!c || !id) return;
  const s = $('#e_status'); if (s) setHTML(s, `${L('refresh-cw')}ინახება…`);
  queueSave('q:' + id, () => db.ref('questions/' + id).set(qDoc(c)).then(() => { const s2 = $('#e_status'); if (s2) setHTML(s2, `${L('circle-check-big')}შენახულია`); }));
}
function selectQ(id) {
  if (M.selQ && M.selQ !== id) run('q:' + M.selQ);
  M.selQ = id; const q = M.questions[id];
  M.cur = JSON.parse(JSON.stringify(q)); M.cur.options = arr(M.cur.options); M.cur.correct = arr(M.cur.correct); M.cur.sfx = Object.assign({}, M.cur.sfx || {}); M.cur.rules = Object.assign({}, M.cur.rules || {});
  const n = M.cur.type === 'poll' ? 2 : (M.cur.type === 'text' || M.cur.type === 'buzz' ? 0 : 4);
  while (M.cur.options.length < n) M.cur.options.push('');
  drawEditor(); drawQList();
}
function setField(k, v) { M.cur[k] = v || null; scheduleQSave(); drawEditor(); }
function setSfx(ev, v) { if (v) M.cur.sfx[ev] = v; else delete M.cur.sfx[ev]; scheduleQSave(); drawEditor(); drawQListSoon(); }
let qlT = null; function drawQListSoon() { clearTimeout(qlT); qlT = setTimeout(drawQList, 700); }

// ── ფანჯრები (სურათის არჩევა, გადატანა) ──
function openModal(html) { closeModal(); const m = document.createElement('div'); m.className = 'modal'; m.id = 'modal'; m.innerHTML = `<div class="box">${html}<div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn quiet" data-a="closemodal">დახურვა</button></div></div>`; document.body.appendChild(m); icons(); m.addEventListener('click', e => { if (e.target === m) m.remove(); }); }
function closeModal() { const m = $('#modal'); if (m) m.remove(); }
function pickImgModal() {
  const l = Object.entries(M.images);
  openModal(`<h3 class="head" style="margin-bottom:14px">აირჩიე სურათი</h3>${l.length ? `<div class="libgrid">${l.map(([id, im]) => `<div class="libitem" style="cursor:pointer" data-a="useimg" data-id="${id}"><img src="${im.thumb}" alt=""><b>${esc(im.name)}</b></div>`).join('')}</div>` : '<p class="muted">ბიბლიოთეკა ცარიელია. ატვირთე სურათი „სურათები“-ში ან პირდაპირ აქ, „ატვირთვა“-თი.</p>'}`);
}
function moveModal() {
  const n = M.moveIds.length;
  const grp = (g, title) => `<h3 style="margin:16px 0 6px;color:var(--muted);font-size:14px;display:flex;gap:8px;align-items:center">${L(g === 1 ? 'zap' : 'circle-help')}${title}</h3>` + (quizList(g).filter(([id]) => id !== M.selQuiz).map(([id, q]) => `<button class="btn block" style="justify-content:space-between;margin:6px 0" data-a="moveto" data-id="${id}"><span>${esc(q.name)}</span><span class="muted">${qOf(id).length} კითხვა</span></button>`).join('') || '<p class="hint">სხვა ქვიზი არ არის</p>');
  openModal(`<h3 class="head" style="margin-bottom:4px">გადატანა: ${n} კითხვა</h3><p class="hint">კითხვა ქვიზის ბოლოში მოხვდება, მერე გადაათრიე სასურველ ადგილას.${M.moveIds.some(id => M.questions[id] && M.questions[id].game === 2) ? ' თამაში 1-ში გადატანისას სწორი პასუხი წამყვანს პასუხად გამოუჩნდება.' : ''}</p>${grp(1, 'თამაში 1 · ბლიცი (ხმამაღლა კითხვა)')}${grp(2, 'თამაში 2 · ფაცი თუ ფუცი')}`);
}
function doMove(qzid) {
  const tz = M.quizzes[qzid]; if (!tz) return;
  let order = qOf(qzid).reduce((m, q) => Math.max(m, q.order || 0), 0);
  const u = {};
  M.moveIds.forEach(id => {
    const q = M.questions[id]; if (!q) return;
    order += 10;
    const d = { quiz: qzid, game: tz.game, order, text: q.text || '', answer: q.answer || '', img: q.img || null, snd: q.snd || null, sfx: null };
    const opts = arr(q.options), corr = arr(q.correct).map(Number);
    if (tz.game === 1) { d.type = 'buzz'; if (!d.answer && corr.length) d.answer = corr.map(i => opts[i]).filter(Boolean).join(' / '); d.options = null; d.correct = null; }
    else if (q.type === 'buzz') { d.type = 'text'; d.options = null; d.correct = null; }
    else { d.type = q.type; d.options = opts.length ? opts : null; d.correct = corr.length ? corr : null; }
    if (q.sfx && tz.game === q.game) d.sfx = q.sfx; // საკუთარი ხმები რჩება, თუ თამაში იგივეა
    d.rules = q.rules && tz.game === q.game ? q.rules : null;
    Object.entries(d).forEach(([k, v]) => { u['questions/' + id + '/' + k] = v; });
    if (M.selQ === id) { pending.delete('q:' + id); closeEditor(); }
    M.sel.delete(id);
  });
  const n = M.moveIds.length; M.moveIds = [];
  closeModal();
  db.ref().update(u).then(() => { toast(`${n} კითხვა გადავიდა: ${tz.name}`); drawQList(); });
}
async function dupQ(id) {
  const q = M.questions[id]; if (!q) return;
  const ids = qOf(q.quiz).map(x => x.id), nid = db.ref('questions').push().key, d = qDoc(Object.assign({}, q, { options: arr(q.options), correct: arr(q.correct) }));
  d.text = d.text ? d.text + ' (ასლი)' : d.text;
  await db.ref('questions/' + nid).set(d);
  M.questions[nid] = d; ids.splice(ids.indexOf(id) + 1, 0, nid); writeOrder(ids); toast('კითხვა დუბლირდა');
}
function writeOrder(ids) { const u = {}; ids.forEach((id, i) => { u['questions/' + id + '/order'] = (i + 1) * 10; if (M.questions[id]) M.questions[id].order = (i + 1) * 10; }); if (M.cur && u['questions/' + M.selQ + '/order']) M.cur.order = u['questions/' + M.selQ + '/order']; db.ref().update(u); }

// ── მოქმედებები ──
const ACT = {
  closemodal() { closeModal(); },
  closeed() { closeEditor(); },
  newquiz(g) {
    const id = db.ref('quizzes').push().key; g = Number(g);
    const u = { ['quizzes/' + id]: { name: 'ახალი ქვიზი', game: g, created: TS } };
    if (!activeQuiz(g)) u['config/active/g' + g] = id;
    closeEditor(); M.selQuiz = id; M.sel.clear();
    db.ref().update(u).then(() => { M.selQuiz = id; renderQuizTab(); setTimeout(() => { const n = $('#ql-name'); if (n) { n.focus(); n.select(); } }, 50); });
  },
  tonight() { const g = M.quizzes[M.selQuiz].game; db.ref('config/active/g' + g).set(M.selQuiz); toast('დღეს საღამოს გამოიყენება: ' + M.quizzes[M.selQuiz].name); },
  async dupquiz() {
    const qz = M.quizzes[M.selQuiz], id = db.ref('quizzes').push().key, u = { ['quizzes/' + id]: { name: qz.name + ' (ასლი)', game: qz.game, created: TS } };
    qOf(M.selQuiz).forEach(q => { const nid = db.ref('questions').push().key; const d = qDoc(q); d.quiz = id; u['questions/' + nid] = d; });
    await db.ref().update(u); closeEditor(); M.selQuiz = id; M.sel.clear(); renderQuizTab(); toast('ქვიზის ასლი შეიქმნა');
  },
  async delquiz() {
    const qz = M.quizzes[M.selQuiz], n = qOf(M.selQuiz).length;
    if (!(await ask(`წაიშლება ქვიზი „${qz.name}“ და მისი ${n} კითხვა. სურათები და ხმები ბიბლიოთეკაში დარჩება.`))) return;
    const u = { ['quizzes/' + M.selQuiz]: null };
    qOf(M.selQuiz).forEach(q => { u['questions/' + q.id] = null; });
    if (activeQuiz(qz.game) === M.selQuiz) u['config/active/g' + qz.game] = null;
    closeEditor(); db.ref().update(u);
  },
  addq() {
    const qz = M.quizzes[M.selQuiz]; if (!qz) return;
    const order = qOf(M.selQuiz).reduce((m, q) => Math.max(m, q.order || 0), 0) + 10;
    const id = db.ref('questions').push().key, t = qz.game === 1 ? 'buzz' : 'single';
    const q = { quiz: M.selQuiz, game: qz.game, order, type: t, text: '', answer: '' };
    if (t === 'single') q.options = ['', '', '', ''];
    M.questions[id] = q;
    db.ref('questions/' + id).set(q).then(() => { selectQ(id); setTimeout(() => { const e = $('#e_text'); if (e) e.focus(); }, 60); });
  },
  editq(id) { selectQ(id); },
  more(id, b) {
    openMenu(b, [
      { icon: 'pencil', label: 'რედაქტირება', run: () => selectQ(id) },
      { icon: 'copy', label: 'დუბლირება', run: () => dupQ(id) },
      { icon: 'arrow-right-left', label: 'გადატანა…', run: () => { M.moveIds = [id]; moveModal(); } },
      'sep',
      { icon: 'trash-2', label: 'წაშლა', danger: true, run: () => ACT.delq(id) }
    ]);
  },
  async delq(id) {
    if (!(await ask('ეს კითხვა წაიშლება.'))) return;
    if (M.selQ === id) { pending.delete('q:' + id); M.selQ = null; closeEditor(); }
    db.ref('questions/' + id).remove();
  },
  movesel() { M.moveIds = qOf(M.selQuiz).map(q => q.id).filter(id => M.sel.has(id)); if (M.moveIds.length) moveModal(); },
  selclear() { M.sel.clear(); drawQList(); },
  moveto(qzid) { doMove(qzid); },
  pickimg() { pickImgModal(); },
  useimg(id) { closeModal(); setField('img', id); },
  rmimg() { setField('img', null); },
  playsnd(id) { togglePlay(id); },
  qevplay(ev) { const v = (M.cur.sfx || {})[ev]; SFX.preview(v || (CFG.sounds || {})[ev] || 'default', ev); },
  // სურათები
  async delimg(id) {
    const used = Object.values(M.questions).filter(q => q.img === id).length;
    if (!(await ask(used ? `ეს სურათი გამოიყენება ${used} კითხვაში. წაშლის შემდეგ ამ კითხვებიდან მოიხსნება.` : 'ეს სურათი წაიშლება.'))) return;
    const u = { ['library/images/' + id]: null, ['libdata/img/' + id]: null };
    Object.entries(M.questions).forEach(([qid, q]) => { if (q.img === id) u['questions/' + qid + '/img'] = null; });
    if (M.cur && M.cur.img === id) M.cur.img = null;
    db.ref().update(u);
  },
  // ხმები
  async delsnd(id) {
    const used = usageSnd(id), ev = Object.entries(CFG.sounds || {}).filter(([, v]) => v === id).map(([k]) => k);
    if (!(await ask(used || ev.length ? `ეს ხმა გამოიყენება ${used} კითხვაში${ev.length ? ' და ' + ev.length + ' მოვლენაზე' : ''}. წაშლის შემდეგ იქ ჩაშენებული ხმა დაბრუნდება.` : 'ეს ხმა წაიშლება.'))) return;
    const u = { ['library/sounds/' + id]: null, ['libdata/snd/' + id]: null };
    Object.entries(M.questions).forEach(([qid, q]) => {
      if (q.snd === id) u['questions/' + qid + '/snd'] = null;
      Object.entries(q.sfx || {}).forEach(([e, v]) => { if (v === id) u['questions/' + qid + '/sfx/' + e] = null; });
    });
    ev.forEach(k => { u['config/sounds/' + k] = 'default'; });
    if (M.cur) { if (M.cur.snd === id) M.cur.snd = null; Object.keys(M.cur.sfx || {}).forEach(e => { if (M.cur.sfx[e] === id) delete M.cur.sfx[e]; }); }
    stopPlay(); db.ref().update(u);
  },
  play(id) { togglePlay(id); },
  testev(ev) { SFX.preview((CFG.sounds || {})[ev] || 'default', ev); },
  resetev(ev) { db.ref('config/sounds/' + ev).set('default').then(() => render(true)); },
  resettext(k) { db.ref('config/texts/' + k).remove().then(() => render(true)); },
  savepin() {
    const v = $('#s_pin').value.trim();
    if (v.length < 4) { note('PIN-ში მინიმუმ 4 სიმბოლო უნდა იყოს.'); return; }
    db.ref('config/pin').set(v).then(() => { try { sessionStorage.setItem('pz_auth', v); } catch (e) {} toast('PIN შეიცვალა'); });
  }
};
function usageSnd(id) { return Object.values(M.questions).filter(q => q.snd === id || Object.values(q.sfx || {}).includes(id)).length; }

// ხმის მოსმენა (ბიბლიოთეკიდან)
let playing = null, playingId = null;
function stopPlay() { if (playing) { playing.pause(); playing = null; playingId = null; } }
async function togglePlay(id) {
  if (playingId === id) { stopPlay(); return; }
  stopPlay();
  const d = (await db.ref('libdata/snd/' + id).once('value')).val(); if (!d) return;
  playing = new Audio(d); playingId = id; playing.onended = () => { playing = null; playingId = null; }; playing.play().catch(() => {});
}

// ───────── ატვირთვები ─────────
async function imgToJpegs(file) {
  const bmp = await createImageBitmap(file);
  const mk = (max, q) => {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', q);
  };
  return { full: mk(1280, .8), thumb: mk(260, .7) };
}
const baseName = f => f.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'ფაილი';
async function addImage(file, replaceId) {
  try {
    const { full, thumb } = await imgToJpegs(file);
    const id = replaceId || db.ref('library/images').push().key;
    await db.ref('libdata/img/' + id).set(full);
    if (replaceId) await db.ref('library/images/' + id + '/thumb').set(thumb);
    else await db.ref('library/images/' + id).set({ name: baseName(file), thumb, created: TS });
    M.imgData[id] = full;
    return id;
  } catch (e) { note('ამ სურათს ვერ ვკითხულობ. სცადე JPG ან PNG ფორმატი.'); return null; }
}
async function readSound(file) {
  const mb = file.size / 1048576;
  if (mb > MAX_SND_MB) throw `ფაილი ძალიან დიდია (${mb.toFixed(1)} მბ). მაქსიმუმი ${MAX_SND_MB} მბ-ია. გამოიყენე უფრო მოკლე კლიპი ან დაბალი ხარისხის MP3.`;
  const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  const dur = await new Promise(res => { const a = new Audio(); a.onloadedmetadata = () => res(a.duration); a.onerror = () => res(-1); a.src = data; });
  if (!(dur > 0)) throw 'ამ ფაილს ვერ ვკითხულობ. სცადე MP3 ან WAV.';
  if (dur > MAX_SND_SEC + .5) throw `ხმა ${Math.round(dur)} წამია. მაქსიმუმი ${MAX_SND_SEC} წამია. გაჭერი უფრო მოკლედ.`;
  return { data, dur, size: file.size };
}
async function addSound(file, replaceId) {
  try {
    const { data, dur, size } = await readSound(file);
    const id = replaceId || db.ref('library/sounds').push().key;
    await db.ref('libdata/snd/' + id).set(data);
    if (replaceId) await db.ref('library/sounds/' + id).update({ dur, size });
    else await db.ref('library/sounds/' + id).set({ name: baseName(file), dur, size, created: TS });
    if (SFX.buffers) delete SFX.buffers[id];
    return id;
  } catch (e) { note(typeof e === 'string' ? e : 'ფაილის ატვირთვა ვერ მოხერხდა.'); return null; }
}

// ═════════ წესები ═════════
function renderRules() {
  const g1 = rulesG(1), g2 = rulesG(2), f = finalRules(), n = teamCount();
  const line = (label, ctl, hint) => `<div class="evline" style="grid-template-columns:240px minmax(0,1fr)"><b>${label}</b>${ctl}</div>${hint ? `<p class="hint" style="margin:-2px 0 8px 248px">${hint}</p>` : ''}`;
  const c = (g, k, v) => ruleControl(k, v, undefined, `data-rule="${g}.${k}"`);
  const sel = (path, cur, opts) => `<select data-rule="${path}">${opts.map(([v, l]) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  setHTML(view, `<div class="cols"><div>
  <div class="panel"><h3>${L('circle-help')}თამაში 2 · ფაცი თუ ფუცი</h3>
    ${line(RULE_NAMES.award, c('g2', 'award', g2.award))}
    ${g2.award === 'firstN' ? line(RULE_NAMES.awardN, c('g2', 'awardN', g2.awardN)) : ''}
    ${line(RULE_NAMES.pts, c('g2', 'pts', g2.pts), 'ნაგულისხმევად 1. კონკრეტულ კითხვას შეგიძლია მეტი ქულა მისცე კითხვის რედაქტორში.')}
    ${line(RULE_NAMES.penalty, c('g2', 'penalty', g2.penalty), '0 = არაფერი აკლდება.')}
    ${line(RULE_NAMES.multi, c('g2', 'multi', g2.multi))}
    ${line(RULE_NAMES.typed, c('g2', 'typed', g2.typed), 'ავტომატურისას წამყვანს მაინც შეუძლია შეასწოროს. რამდენიმე სწორი პასუხი გამოყავი „/“-ით.')}
    ${line(RULE_NAMES.board, c('g2', 'board', g2.board))}
  </div>
  <div class="panel"><h3>${L('flag')}ფინალი</h3>
    ${line('რამდენი ადგილი გამოცხადდეს', sel('final.places', f.places, [[1, '1 (მხოლოდ გამარჯვებული)'], [2, '2'], [3, '3']]))}
    ${line('ბოლო ადგილის გამოცხადება', sel('final.loser', f.loser !== false, [[true, 'კი'], [false, 'არა']]))}
  </div></div>
  <div><div class="panel"><h3>${L('zap')}თამაში 1 · ბლიცი</h3>
    ${line('როგორ თამაშობენ', sel('g1.teamsOn', g1.teamsOn !== false, [[true, 'გუნდებად'], [false, 'ყველა თავისთვის']]))}
    ${g1.teamsOn !== false ? line('გუნდების რაოდენობა', sel('g1.teamCount', n, [[2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']])) : ''}
    ${g1.teamsOn !== false ? `<div style="margin:4px 0 12px 248px">${Array.from({ length: n }, (_, i) => `<div class="row" style="margin:6px 0"><span style="width:22px;height:22px;border-radius:50%;background:${TEAM_COLORS[i]};box-shadow:inset 0 0 0 1.5px var(--pink-l);flex:none"></span><input type="text" class="grow" data-tname="${i}" value="${esc(teamName(M.teams, i))}" maxlength="24" aria-label="გუნდის სახელი"></div>`).join('')}</div>` : ''}
    ${line(RULE_NAMES.pts, c('g1', 'pts', g1.pts))}
    ${line(RULE_NAMES.penalty, c('g1', 'penalty', g1.penalty))}
    ${line(RULE_NAMES.afterWrong, c('g1', 'afterWrong', g1.afterWrong))}
    ${g1.afterWrong === 'all' ? line(RULE_NAMES.sameTeamTwice, c('g1', 'sameTeamTwice', g1.sameTeamTwice), '„არა“ — ვინც შეცდა, ჯერ სხვამ უნდა სცადოს.') : ''}
  </div><p class="hint">ცვლილებები მაშინვე ინახება. წამყვანის გვერდზე თითო კითხვასთან ჩანს მოქმედი წესები.</p></div></div>`);
}
function saveRule(path, raw) {
  const [g, k] = path.split('.');
  const v = ['pts', 'penalty', 'awardN', 'places', 'teamCount'].includes(k) ? Math.max(0, Number(raw) || 0) : raw === 'true' ? true : raw === 'false' ? false : raw;
  return db.ref('config/rules/' + g + '/' + k).set(v);
}

// ═════════ სურათები ═════════
function renderImages() {
  const l = Object.entries(M.images).sort((a, b) => (b[1].created || 0) - (a[1].created || 0));
  setHTML(view, `<div class="panel"><h3>${L('upload')}ატვირთვა</h3><div class="drop"><p class="hint">სურათი ავტომატურად მცირდება (მაქს. 1280 პიქსელი). ერთი სურათი შეგიძლია რამდენიმე კითხვაში გამოიყენო.</p><label class="btn primary">${L('upload')}აირჩიე ფაილები<input type="file" id="lib_img_up" accept="image/*" multiple hidden></label></div></div>
  <div class="panel"><h3>${L('images')}ბიბლიოთეკა (${l.length})</h3>${l.length ? `<div class="libgrid">${l.map(([id, im]) => `<div class="libitem"><img src="${im.thumb}" alt=""><input type="text" data-imgname="${id}" value="${esc(im.name)}" maxlength="40" aria-label="სახელი"><span class="hint" style="margin:0">გამოიყენება ${Object.values(M.questions).filter(q => q.img === id).length} კითხვაში</span><div class="row"><label class="btn grow">${L('refresh-cw')}ჩანაცვლება<input type="file" data-replimg="${id}" accept="image/*" hidden></label><button class="btn quiet icon danger" data-a="delimg" data-id="${id}" data-tip="წაშლა">${L('trash-2')}</button></div></div>`).join('')}</div>` : '<p class="hint">ჯერ სურათები არ არის.</p>'}</div>`);
}

// ═════════ ხმები ═════════
function renderSounds() {
  const l = Object.entries(M.sounds).sort((a, b) => (b[1].created || 0) - (a[1].created || 0));
  const rows = SOUND_EVENTS.map(([ev, label]) => {
    const cur = (CFG.sounds || {})[ev] || 'default';
    return `<div class="evrow2"><b>${label}</b><span class="cur">${L(cur === 'default' ? 'sparkles' : cur === 'none' ? 'volume-x' : 'file-audio')} ${esc(sndName(cur))}</span><button class="btn icon" data-a="testev" data-id="${ev}" data-tip="მოსმენა">${L('play')}</button><label class="btn">${L('upload')}ატვირთვა<input type="file" data-evup="${ev}" accept="audio/*" hidden></label><select data-ev="${ev}" aria-label="ხმის არჩევა"><option value="default" ${cur === 'default' ? 'selected' : ''}>ჩაშენებული</option><option value="none" ${cur === 'none' ? 'selected' : ''}>უხმოდ</option>${l.map(([id, s]) => `<option value="${id}" ${cur === id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select><button class="btn quiet" data-a="resetev" data-id="${ev}" ${cur === 'default' ? 'disabled' : ''}>${L('rotate-ccw')}ჩაშენებული</button></div>`;
  }).join('');
  setHTML(view, `<div class="panel"><h3>${L('volume-2')}თამაშის ხმები · ნაგულისხმევი მთელი თამაშისთვის</h3><p class="hint">კონკრეტულ კითხვას შეგიძლია საკუთარი ხმა მისცე კითხვის რედაქტორში.</p><div class="evtable">${rows}</div></div>
  <div class="panel"><h3>${L('library-big')}ხმების ბიბლიოთეკა (${l.length})<span class="grow"></span><label class="btn primary">${L('upload')}ფაილების ატვირთვა<input type="file" id="lib_snd_up" accept="audio/*" multiple hidden></label></h3><p class="hint">თითო ფაილი: მაქსიმუმ <b>${MAX_SND_SEC} წამი</b> და <b>${MAX_SND_MB} მბ</b>. MP3 საუკეთესოა. აქედან იღებ კლიპებსაც „გამოიცანი სიმღერა“ კითხვებისთვის.</p>
  ${l.map(([id, s]) => `<div class="sndrow"><button class="btn icon" data-a="play" data-id="${id}" data-tip="დაკვრა / გაჩერება">${L('play')}</button><input type="text" data-sndname="${id}" value="${esc(s.name)}" maxlength="40" aria-label="სახელი"><span class="hint" style="margin:0">${Math.round(s.dur || 0)} წმ · ${((s.size || 0) / 1048576).toFixed(2)} მბ · ${usageSnd(id)} კითხვა</span><label class="btn">${L('refresh-cw')}ჩანაცვლება<input type="file" data-replsnd="${id}" accept="audio/*" hidden></label><button class="btn quiet icon danger" data-a="delsnd" data-id="${id}" data-tip="წაშლა">${L('trash-2')}</button></div>`).join('') || '<p class="hint">ჯერ ხმები არ არის.</p>'}</div>`);
}

// ═════════ პარამეტრები ═════════
function renderSettings() {
  setHTML(view, `<div class="cols"><div><div class="panel"><h3>${L('type')}თამაშის სახელი</h3><input type="text" id="s_name" value="${esc(gameName())}" maxlength="30"><p class="hint">ჩანს ლოგოში ტელეფონზე და ტვ-ზე.</p></div>
  <div class="panel"><h3>${L('users')}გუნდები</h3><p class="hint">გუნდების რაოდენობა და სახელები ახლა „წესები“-შია.</p><button class="btn" data-sec="rules">${L('scale')}წესებზე გადასვლა</button></div>
  <div class="panel"><h3>${L('lock')}წამყვანის და ადმინის PIN</h3><div class="row"><input type="text" id="s_pin" class="grow" value="${esc(CFG.pin || DEFAULT_PIN)}" maxlength="12"><button class="btn primary" data-a="savepin">${L('check')}შენახვა</button></div><p class="hint">PIN მსუბუქი დაცვაა, რეპოზიტორია საჯაროა.</p></div></div>
  <div class="panel"><h3>${L('message-circle')}სასაცილო ტექსტები</h3><p class="hint">თითო ხაზი = ერთი ვარიანტი, თამაში შემთხვევით ირჩევს. ბოლო ადგილის ტექსტში {name} ჩაანაცვლებს სახელს.</p>${TEXT_KEYS.map(([k, label]) => `<label class="f">${label}</label><textarea data-text="${k}" rows="${Math.min(7, textList(k).length + 1)}">${esc(textList(k).join('\n'))}</textarea><button class="btn quiet" data-a="resettext" data-id="${k}" style="margin-top:6px">${L('rotate-ccw')}ნაგულისხმევზე დაბრუნება</button>`).join('')}</div></div>`);
}

// ───────── ღონისძიებები ─────────
document.addEventListener('click', e => {
  const nav = e.target.closest('[data-sec]');
  if (nav) { M.tab = nav.dataset.sec; stopPlay(); if (M.tab !== 'quiz') closeEditor(); render(true); return; }
  const q = e.target.closest('[data-qz]');
  if (q && !e.target.closest('[data-a]')) { closeEditor(); M.selQuiz = q.dataset.qz; M.sel.clear(); return renderQuizTab(); }
  if (e.target.matches && e.target.matches('.qsel')) return;
  const b = e.target.closest('[data-a]');
  if (b && !b.disabled && ACT[b.dataset.a]) ACT[b.dataset.a](b.dataset.id, b);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !popOpen() && !$('#menu')) { if ($('#modal')) closeModal(); else if (M.selQ) closeEditor(); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'ql-name') queueSave('qzname', () => db.ref('quizzes/' + M.selQuiz + '/name').set(t.value || 'ქვიზი'));
  else if (t.id === 'e_text' || t.classList.contains('e_opt') || t.id === 'e_ans') collect();
  else if (t.dataset.qrule && t.type === 'number') setRule(t.dataset.qrule, t.value);
  else if (t.dataset.rule && t.type === 'number') queueSave('r:' + t.dataset.rule, () => saveRule(t.dataset.rule, t.value));
  else if (t.dataset.imgname) queueSave('in' + t.dataset.imgname, () => db.ref('library/images/' + t.dataset.imgname + '/name').set(t.value));
  else if (t.dataset.sndname) queueSave('sn' + t.dataset.sndname, () => db.ref('library/sounds/' + t.dataset.sndname + '/name').set(t.value));
  else if (t.id === 's_name') queueSave('gname', () => db.ref('config/gameName').set(t.value.trim() || null));
  else if (t.dataset.tname !== undefined) queueSave('tn' + t.dataset.tname, () => db.ref('teams/' + t.dataset.tname + '/name').set(t.value));
  else if (t.dataset.text) queueSave('tx' + t.dataset.text, () => {
    const lines = t.value.split('\n').map(s => s.trim()).filter(Boolean);
    return db.ref('config/texts/' + t.dataset.text).set(lines.length ? lines : null);
  });
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.classList && t.classList.contains('qsel')) { t.checked ? M.sel.add(t.dataset.id) : M.sel.delete(t.dataset.id); drawQList(); return; }
  if (t.id === 'e_type') { collect(); const c = M.cur; c.type = t.value; const n = t.value === 'poll' ? 2 : (t.value === 'text' ? 0 : 4); const o = arr(c.options).slice(0, n); while (o.length < n) o.push(''); c.options = o; c.correct = []; scheduleQSave(); drawEditor(); drawQListSoon(); }
  else if (t.id === 'e_snd') { setField('snd', t.value); drawQListSoon(); }
  else if (t.dataset.qev) setSfx(t.dataset.qev, t.value);
  else if (t.dataset.qrule) { setRule(t.dataset.qrule, t.value); if (t.tagName === 'SELECT') { drawEditor(); drawQListSoon(); } }
  else if (t.dataset.rule) { queueSave('r:' + t.dataset.rule, () => saveRule(t.dataset.rule, t.value).then(() => { if (t.tagName === 'SELECT') render(true); }), 0); }
  else if (t.classList && t.classList.contains('e_cor')) collect();
  else if (t.id === 'e_img_up' && t.files[0]) { const id = await addImage(t.files[0]); if (id) { setField('img', id); drawQListSoon(); } }
  else if (t.id === 'e_snd_up' && t.files[0]) { const id = await addSound(t.files[0]); if (id) { setField('snd', id); drawQListSoon(); } }
  else if (t.dataset.qevup && t.files[0]) { const id = await addSound(t.files[0]); if (id) setSfx(t.dataset.qevup, id); }
  else if (t.id === 'lib_img_up') { for (const f of t.files) await addImage(f); toast('სურათები აიტვირთა'); }
  else if (t.id === 'lib_snd_up') { for (const f of t.files) await addSound(f); toast('ხმები აიტვირთა'); }
  else if (t.dataset.replimg && t.files[0]) { await addImage(t.files[0], t.dataset.replimg); toast('სურათი ჩანაცვლდა'); render(true); }
  else if (t.dataset.replsnd && t.files[0]) { await addSound(t.files[0], t.dataset.replsnd); toast('ხმა ჩანაცვლდა'); }
  else if (t.dataset.evup && t.files[0]) { const id = await addSound(t.files[0]); if (id) { await db.ref('config/sounds/' + t.dataset.evup).set(id); toast('ხმა დაყენდა: ' + EV_NAME[t.dataset.evup]); render(true); } }
  else if (t.dataset.ev) db.ref('config/sounds/' + t.dataset.ev).set(t.value).then(() => render(true));
});
// გადათრევა: კითხვების რიგის შეცვლა
let dragId = null;
document.addEventListener('dragstart', e => { const r = e.target.closest && e.target.closest('.qr[draggable]'); if (!r) return; dragId = r.dataset.id; r.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (x) {} });
document.addEventListener('dragover', e => { const r = e.target.closest && e.target.closest('.qr[draggable]'); if (!r || !dragId) return; e.preventDefault(); $$('.qr.over').forEach(x => x.classList.remove('over')); r.classList.add('over'); });
document.addEventListener('dragend', () => { dragId = null; $$('.qr.dragging,.qr.over').forEach(x => x.classList.remove('dragging', 'over')); });
document.addEventListener('drop', e => {
  const r = e.target.closest && e.target.closest('.qr[draggable]'); if (!r || !dragId) return; e.preventDefault();
  const ids = qOf(M.selQuiz).map(q => q.id), from = ids.indexOf(dragId), to = ids.indexOf(r.dataset.id);
  dragId = null; if (from < 0 || to < 0 || from === to) return;
  ids.splice(to, 0, ids.splice(from, 1)[0]); writeOrder(ids);
});
window.addEventListener('resize', () => { if (M.cur) drawPreview(); });
