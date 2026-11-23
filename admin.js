// ფაციფუცობანა — ადმინის გვერდი: ქვიზები, კითხვები, სურათები, ხმები, პარამეტრები
const M = { tab: 'quiz', quizzes: {}, questions: {}, images: {}, sounds: {}, videos: {}, teams: {}, selQuiz: null, selQ: null, cur: null, sel: new Set(), moveIds: [], loaded: {}, imgData: {} };
const view = $('#view');
const MAX_SND_MB = 3, MAX_SND_SEC = 30, MAX_GIF_MB = 2.5, MAX_VID_MB = 4, MAX_VID_SEC = 10, WIN_VID_MB = 10, WIN_VID_SEC = 60;
const TAB_TITLES = { quiz: 'ქვიზები და კითხვები', rules: 'წესები', streaks: 'სერიები', battles: 'ბრძოლები', polls: 'ხმის მიცემა (MVP)', images: 'სურათები', sounds: 'ხმები', settings: 'პარამეტრები', history: 'ისტორია' };
const TYPE_NAMES = { buzz: 'ბლიცი', single: 'ერთი სწორი', multi: 'რამდენიმე სწორი', poll: 'გამოკითხვა', text: 'ჩაწერითი' };
const EV_NAME = Object.fromEntries(SOUND_EVENTS);
const Q_EVENTS = { 1: ['buzz', 'right', 'wrong'], 2: ['reveal', 'scoreboard'] };
$('#gateLogo').innerHTML = logoHtml(); $('#sideLogo').innerHTML = logoHtml();
gate(start);

let started = false;
function start() {
  if (started) return; started = true;
  setSaved(true);
  const on = (path, key) => db.ref(path).on('value', s => { M[key] = s.val() || {}; M.loaded[key] = true; onData(key); });
  db.ref('library/sounds').on('value', s => { SFX.libMeta = s.val() || {}; });
  on('quizzes', 'quizzes'); on('questions', 'questions'); on('library/images', 'images'); on('library/sounds', 'sounds'); on('library/videos', 'videos'); on('teams', 'teams');
  db.ref('polls').on('value', s => { M.polls = s.val(); if (M.polls === null && !M.pmade) { M.pmade = true; db.ref('polls').set(DEFAULT_POLLS); } if (M.tab === 'polls') render(false); });
  db.ref('battles').on('value', s => { M.battles = s.val(); if (M.battles === null && !M.bmade) { M.bmade = true; db.ref('battles').set(DEFAULT_BATTLES); } if (M.tab === 'battles') render(false); });
  watchConfig(() => { $('#sideLogo').innerHTML = logoHtml(); document.title = gameName() + ' — ადმინი'; M.loaded.config = true; onData('config'); });
  icons();
}

// ───────── ავტომატური შენახვა ─────────
const pending = new Map();
function setSaved(ok) { ['#saveBadge', '#edSave'].forEach(s => { const el = $(s); if (!el) return; setHTML(el, ok ? `${L('circle-check-big')}${s === '#edSave' ? 'შენახულია' : 'ყველაფერი შენახულია'}` : `${L('refresh-cw')}ინახება…`); el.className = 'chip' + (ok ? ' ok' : '') + (s === '#edSave' ? ' edsave' : ''); }); }
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
  if (!(L0.quizzes && L0.questions && L0.images && L0.sounds && L0.videos && L0.teams && L0.config)) return;
  if (!inited) {
    inited = true; ensureBase();
    if (!Object.keys(M.quizzes).length) { // პირველი გაშვება: ორი ცარიელი ქვიზი
      const a = db.ref('quizzes').push().key, b = db.ref('quizzes').push().key;
      db.ref().update({ ['quizzes/' + a]: { name: 'ბლიცი: პირველი ქვიზი', game: 1, created: TS }, ['quizzes/' + b]: { name: 'ფაცი თუ ფუცი: პირველი ქვიზი', game: 2, created: TS }, 'config/active/g1': a, 'config/active/g2': b });
      return;
    }
    const hm = location.hash.match(/quiz=([^&]+)/); if (hm && M.quizzes[decodeURIComponent(hm[1])]) M.selQuiz = decodeURIComponent(hm[1]);
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
  else if (M.tab === 'streaks') renderStreaks();
  else if (M.tab === 'battles') renderBattles();
  else if (M.tab === 'polls') renderPolls();
  else if (M.tab === 'images') renderImages();
  else if (M.tab === 'sounds') renderSounds();
  else if (M.tab === 'history') renderHistory();
  else renderSettings();
}
function renderChrome() {
  $('#pageTitle').textContent = TAB_TITLES[M.tab];
  $$('.nav').forEach(b => b.classList.toggle('on', b.dataset.sec === M.tab));
  const mb = $('#moreBtn'); if (mb) mb.classList.toggle('on', MORE_TABS.some(([k]) => k === M.tab));
  const qz = M.quizzes[M.selQuiz], chip = $('#quizChip');
  chip.hidden = !qz;
  if (qz) { const t = activeQuiz(qz.game) === M.selQuiz; chip.className = 'chip' + (t ? ' star' : ''); setHTML(chip, `${L(t ? 'star' : 'list-checks')}ქვიზი: <b>${esc(qz.name)}</b>${t ? ' · დღეს საღამოს' : ''}`); }
}
const activeQuiz = g => (CFG.active || {})['g' + g];
// ტელეფონზე ქვედა ზოლი: 4 მთავარი + „მეტი“ ამ განყოფილებებით
const MORE_TABS = [['sounds', 'volume-2', 'ხმები'], ['battles', 'swords', 'ბრძოლები'], ['polls', 'vote', 'ხმის მიცემა (MVP)'], ['history', 'history', 'ისტორია'], ['settings', 'settings', 'პარამეტრები']];
const isPhone = () => window.matchMedia('(max-width: 799px)').matches;
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
  setHTML(el, qs.map((x, i) => `<div class="qr ${x.id === M.selQ ? 'on' : ''}" draggable="true" data-a="editq" data-id="${x.id}"><input type="checkbox" class="qsel" data-id="${x.id}" ${M.sel.has(x.id) ? 'checked' : ''} aria-label="მონიშვნა"><span class="grip" data-tip="გადაათრიე">${L('grip-vertical')}</span><span class="qn">${i + 1}</span><div class="qmain"><b>${esc(x.text || '(ცარიელი კითხვა)')}</b>${qComplete(x) ? '' : `<small class="warn">არასრულია</small>`}</div><span class="qic">${x.img ? `<span data-tip="სურათი">${L('image')}</span>` : ''}${x.snd ? `<span data-tip="მუსიკა">${L('music')}</span>` : ''}${x.vid ? `<span data-tip="ვიდეო">${L('film')}</span>` : ''}${hasSfx(x) ? `<span data-tip="საკუთარი ხმები">${L('volume-2')}</span>` : ''}${hasRules(x) ? `<span data-tip="საკუთარი წესები">${L('scale')}</span>` : ''}${x.wrongFx ? `<span data-tip="შეცდომის ეფექტი">${L(x.wrongFx.type === 'video' ? 'film' : 'sparkles')}</span>` : ''}</span><span class="tag t-${x.type}">${TYPE_NAMES[x.type] || ''}</span><button class="btn quiet icon" data-a="more" data-id="${x.id}" data-tip="მეტი" aria-label="მეტი">${L('ellipsis')}</button></div>`).join('') || '<div class="empty">ამ ქვიზში კითხვები ჯერ არ არის.</div>');
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
  else h += `<p class="hint">ბლიცი კითხვა: წამყვანი ხმამაღლა კითხულობს.</p>`;
  h += `<textarea id="e_text" rows="3" placeholder="კითხვის ტექსტი">${esc(c.text)}</textarea></div>`;
  if (t === 'single' || t === 'multi' || t === 'poll') {
    h += `<div class="sect"><h4>${L('list')}ვარიანტები ${t === 'poll' ? '' : '· მონიშნე სწორი'}</h4>`;
    opts.forEach((o, i) => { h += `<div class="optrow">${t === 'poll' ? `<span class="lt">${LETTERS[i]}</span>` : `<input type="${t === 'single' ? 'radio' : 'checkbox'}" name="cor" class="e_cor" data-i="${i}" ${corr.includes(i) ? 'checked' : ''} aria-label="სწორი">`}<input type="text" class="e_opt" value="${esc(o)}" placeholder="${LETTERS[i]} ვარიანტი"></div>`; });
    h += '</div>';
  } else {
    h += `<div class="sect"><h4>${L('circle-check-big')}სწორი პასუხი</h4><input type="text" id="e_ans" value="${esc(c.answer)}"><p class="hint">${t === 'buzz' ? 'ჩანს მხოლოდ წამყვანს.' : 'ჩანს წამყვანს და ტვ-ზე პასუხის გახსნისას.'}</p></div>`;
  }
  const im = c.img && M.images[c.img];
  h += `<div class="sect"><h4>${L('image')}სურათი · ჩანს ტვ-ზე</h4><div class="row">${im ? `<img class="thumb" src="${im.thumb}" alt="">` : '<span class="hint">სურათი არ არის</span>'}<span class="grow"></span><button class="btn" data-a="pickimg">${L('images')}ბიბლიოთეკიდან</button><label class="btn">${L('upload')}ატვირთვა<input type="file" id="e_img_up" accept="image/*" hidden></label>${c.img ? `<button class="btn quiet icon danger" data-a="rmimg" data-tip="სურათის მოხსნა">${L('x')}</button>` : ''}</div></div>`;
  h += `<div class="sect"><h4>${L('film')}მოკლე ვიდეო · ტვ-ზე</h4><div class="row"><select id="e_vid" class="grow"><option value="">ვიდეოს გარეშე</option>${Object.entries(M.videos).map(([id, v]) => `<option value="${id}" ${c.vid === id ? 'selected' : ''}>${esc(v.name)} (${Math.round(v.dur || 0)} წმ)</option>`).join('')}</select><label class="btn">${L('upload')}ატვირთვა<input type="file" id="e_vid_up" accept="video/*" hidden></label></div><p class="hint">მაქსიმუმ ${MAX_VID_SEC} წამი და ${MAX_VID_MB} მბ.</p></div>`;
  if ((c.game || 2) === 1) h += `<div class="sect"><h4>${L('monitor')}როდის გამოჩნდეს სურათი / ვიდეო ტვ-ზე</h4><select id="e_mwhen"><option value="" ${!c.mediaWhen ? 'selected' : ''}>ნაგულისხმევი (${esc(G1_WHEN.find(m => m[0] === g1WhenNorm(rulesG(1).media))[1])})</option>${G1_WHEN.map(([v, l]) => `<option value="${v}" ${c.mediaWhen === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select><p class="hint">ტვ-ზე მარტო სურათი ან ვიდეო ჩანს, ტექსტის გარეშე. მუსიკა მხოლოდ ღილაკით ირთვება, ტვ-ზე ქულები რჩება. წამყვანის ღილაკები „ჩვენება / დამალვა“ ყოველთვის მუშაობს.</p></div>`;
  else h += `<div class="sect"><h4>${L('monitor')}სურათი / ვიდეო / მუსიკა ტვ-ზე</h4><select id="e_mauto"><option value="" ${!c.mediaAuto ? 'selected' : ''}>როგორც თამაშის წესებშია (${esc((MEDIA_MODES.find(m => m[0] === rulesG(c.game || 2).media) || MEDIA_MODES[0])[1])})</option>${MEDIA_MODES.map(([v, l]) => `<option value="${v}" ${c.mediaAuto === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
  h += `<div class="sect"><h4>${L('music')}მუსიკა / კლიპი · მაგ. „გამოიცანი სიმღერა“</h4><div class="row"><select id="e_snd" class="grow">${sndOptions(c.snd, '<option value="">კლიპის გარეშე</option>')}</select>${c.snd ? `<button class="btn icon" data-a="playsnd" data-id="${c.snd}" data-tip="მოსმენა">${L('play')}</button>` : ''}<label class="btn icon" data-tip="ახლის ატვირთვა">${L('upload')}<input type="file" id="e_snd_up" accept="audio/*" hidden></label></div></div>`;
  const sf = c.sfx || {};
  h += `<div class="sect"><h4>${L('volume-2')}ხმები ამ კითხვისთვის</h4><p class="hint">ჩვეულებრივ: „ნაგულისხმევი“ — თამაშის საერთო ხმა (ხმები → თამაშის ხმები).</p>` +
    Q_EVENTS[c.game].map(ev => `<div class="evline"><b>${EV_NAME[ev]}</b><select data-qev="${ev}">${sndOptions(sf[ev], `<option value="">ნაგულისხმევი (${esc(sndName((CFG.sounds || {})[ev]))})</option>`)}</select><button class="btn icon" data-a="qevplay" data-id="${ev}" data-tip="მოსმენა">${L('play')}</button><label class="btn icon" data-tip="ახლის ატვირთვა">${L('upload')}<input type="file" data-qevup="${ev}" accept="audio/*" hidden></label></div>`).join('') + '</div>';
  h += wrongSect(c);
  h += rulesSect(c);
  h += `<div class="sect"><h4>${L('monitor')}ასე გამოჩნდება ტვ-ზე</h4><div class="tvwrap"><div class="tvframe tv" id="tvprev"></div></div><p class="saved" id="e_status">${L('circle-check-big')}შენახულია</p></div>`;
  setHTML(body, h);
  openEditor(); drawPreview();
}
// კითხვის საკუთარი წესები („თამაშის წესი“ = არაფერი არ ინახება)
function qRuleKeys(c) {
  if (c.game === 1) return ['pts', 'penalty']; // ბლიცი: წამყვანი ნიშნავს გუნდს, ღილაკი აღარ არის
  const k = ['ptsFirst', 'ptsOther', 'onlyFirst', 'penalty'];
  if (c.type === 'multi') k.push('multi');
  if (c.type === 'text') k.push('typed');
  k.push('board');
  return k;
}
const RULE_NAMES = { ptsFirst: 'ქულა პირველ სწორ პასუხზე', ptsOther: 'ქულა დანარჩენ სწორ პასუხებზე', onlyFirst: 'ვინ იღებს ქულას', pts: 'ქულა სწორ პასუხზე', penalty: 'ქულის დაკლება შეცდომაზე', multi: 'რამდენიმე სწორი პასუხი', typed: 'ჩაწერითი პასუხის შემოწმება', board: 'ქულების ცხრილი კითხვის შემდეგ', afterWrong: 'არასწორი პასუხის შემდეგ', sameTeamTwice: 'იმავე გუნდს ისევ შეუძლია დაჭერა' };
const NUM_RULES = ['pts', 'penalty', 'ptsFirst', 'ptsOther'];
function ruleControl(key, val, def, attr) {
  if (NUM_RULES.includes(key)) return `<input type="number" ${attr} step="0.5" min="0" value="${val === undefined ? '' : esc(val)}" placeholder="${def === undefined ? '' : 'თამაშის წესი: ' + esc(def)}">`;
  const opts = RULE_OPTS[key] || [];
  return `<select ${attr}>${def !== undefined ? `<option value="" ${val === undefined ? 'selected' : ''}>თამაშის წესი: ${esc(optLabel(key, def))}</option>` : ''}${opts.map(([v, l]) => `<option value="${v}" ${val !== undefined && String(val) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
}
function rulesSect(c) {
  const g = rulesG(c.game), own = c.rules || {};
  return `<div class="sect"><h4>${L('scale')}წესები ამ კითხვისთვის</h4><p class="hint">ჩვეულებრივ: „თამაშის წესი“ (წესები → ${c.game === 1 ? 'თამაში 1' : 'თამაში 2'}).</p>` +
    qRuleKeys(c).map(k => `<div class="evline" style="grid-template-columns:190px minmax(0,1fr)"><b>${RULE_NAMES[k]}</b>${ruleControl(k, own[k], g[k], `data-qrule="${k}"`)}</div>`).join('') + '</div>';
}
// „როცა ვინმე შეცდება“: სურათი/GIF, მოკლე ვიდეო ან ჩაშენებული ეფექტი (ტვ-ზე პასუხის გახსნისას)
const FX_NAMES = Object.fromEntries(FX_LIST);
function wrongSect(c) {
  const fx = c.wrongFx || null, t = fx ? fx.type : '';
  let body = '';
  if (t === 'img') { const im = M.images[fx.id]; body = `<div class="row">${im ? `<img class="thumb" src="${im.thumb}" alt="">` : '<span class="hint">სურათი არ არის არჩეული</span>'}<span class="grow"></span><button class="btn" data-a="pickfximg">${L('images')}ბიბლიოთეკიდან</button><label class="btn">${L('upload')}სურათი / GIF<input type="file" id="e_fx_img" accept="image/*" hidden></label></div><p class="hint">GIF რჩება მოძრავი (მაქს. ${MAX_GIF_MB} მბ).</p>`; }
  else if (t === 'video') body = `<div class="row"><select id="e_fx_vid" class="grow"><option value="">აირჩიე ვიდეო</option>${Object.entries(M.videos).map(([id, v]) => `<option value="${id}" ${fx.id === id ? 'selected' : ''}>${esc(v.name)} (${Math.round(v.dur || 0)} წმ)</option>`).join('')}</select><label class="btn">${L('upload')}ვიდეოს ატვირთვა<input type="file" id="e_fx_vup" accept="video/*" hidden></label></div><p class="hint">მაქსიმუმ ${MAX_VID_SEC} წამი და ${MAX_VID_MB} მბ (MP4 საუკეთესოა).</p>`;
  else if (t === 'effect') body = `<select id="e_fx_eff">${Object.entries(FX_NAMES).map(([k, v]) => `<option value="${k}" ${fx.name === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
  return `<div class="sect"><h4>${L('sparkles')}როცა ვინმე შეცდება · ტვ-ზე, პასუხის გახსნისას</h4><select id="e_fx_type" style="margin-bottom:10px"><option value="" ${!t ? 'selected' : ''}>არაფერი</option><option value="img" ${t === 'img' ? 'selected' : ''}>სურათი ან GIF</option><option value="video" ${t === 'video' ? 'selected' : ''}>მოკლე ვიდეო</option><option value="effect" ${t === 'effect' ? 'selected' : ''}>ჩაშენებული ეფექტი</option></select>${body}<p class="hint">ჩაირთვება მხოლოდ მაშინ, თუ ერთმა მაინც არასწორად უპასუხა.</p></div>`;
}
function setFx(fx) { M.cur.wrongFx = fx; scheduleQSave(); drawEditor(); drawQListSoon(); }
async function addVideo(file, big) { // big = ბრძოლის გამარჯვებულის ვიდეო (უფრო გრძელი)
  const MAXMB = big ? WIN_VID_MB : MAX_VID_MB, MAXSEC = big ? WIN_VID_SEC : MAX_VID_SEC;
  const mb = file.size / 1048576;
  if (mb > MAXMB) { note(`ვიდეო ძალიან დიდია (${mb.toFixed(1)} მბ). მაქსიმუმი ${MAXMB} მბ-ია. დაამოკლე ან დაბალი ხარისხით ატვირთე.`); return null; }
  const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  const dur = await new Promise(res => { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => res(v.duration); v.onerror = () => res(-1); v.src = data; });
  if (!(dur > 0)) { note('ამ ვიდეოს ვერ ვკითხულობ. სცადე MP4.'); return null; }
  if (dur > MAXSEC + .5) { note(`ვიდეო ${Math.round(dur)} წამია. მაქსიმუმი ${MAXSEC} წამია. უფრო მოკლედ მოჭერი.`); return null; }
  const id = db.ref('library/videos').push().key;
  await db.ref('libdata/vid/' + id).set(data);
  await db.ref('library/videos/' + id).set({ name: baseName(file), dur, size: file.size, created: TS });
  return id;
}
function setRule(k, raw) {
  const r = M.cur.rules = Object.assign({}, M.cur.rules || {}); M.cur.wrongFx = M.cur.wrongFx || null;
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
  if ((c.game || 2) === 1) { // ბლიცი: ტვ ტექსტს არასდროს აჩვენებს
    box.innerHTML = c.img ? `<div class="scr mediafull"><div class="imgbox">${imgHtml}</div></div>` : `<div class="scr"><div class="sub">ტვ-ზე ჩანს მხოლოდ გუნდების ქულები${c.snd ? ` (${ico('music')} მუსიკისას)` : ''}${c.vid ? ' · ვიდეო — მთელ ეკრანზე' : ''}. კითხვას და პასუხს ტვ არ აჩვენებს.</div></div>`;
    return;
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
  const d = { quiz: c.quiz, game: c.game, order: c.order, type: c.type, text: c.text || '', answer: c.answer || '', img: c.img || null, snd: c.snd || null, sfx: c.sfx && Object.keys(c.sfx).length ? c.sfx : null, rules: c.rules && Object.keys(c.rules).length ? c.rules : null, wrongFx: c.wrongFx || null, vid: c.vid || null, mediaAuto: c.mediaAuto || null, mediaWhen: c.mediaWhen || null };
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
  if (!q) return; // ჯერ არ ჩამოსულა ბაზიდან — რედაქტორი გაიხსნება, როცა ჩამოვა
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
  openModal(`<h3 class="head" style="margin-bottom:14px">აირჩიე სურათი</h3>${l.length ? `<div class="libgrid">${l.map(([id, im]) => `<div class="libitem" style="cursor:pointer" data-a="useimg" data-id="${id}"><img src="${im.thumb}" alt=""><b>${esc(im.name)}</b></div>`).join('')}</div>` : '<p class="muted">ბიბლიოთეკა ცარიელია. ატვირთე სურათი „სურათებში“ ან პირდაპირ აქ, „ატვირთვით“.</p>'}`);
}
function moveModal() {
  const n = M.moveIds.length;
  const grp = (g, title) => `<h3 style="margin:16px 0 6px;color:var(--muted);font-size:14px;display:flex;gap:8px;align-items:center">${L(g === 1 ? 'zap' : 'circle-help')}${title}</h3>` + (quizList(g).filter(([id]) => id !== M.selQuiz).map(([id, q]) => `<button class="btn block" style="justify-content:space-between;margin:6px 0" data-a="moveto" data-id="${id}"><span>${esc(q.name)}</span><span class="muted">${qOf(id).length} კითხვა</span></button>`).join('') || '<p class="hint">სხვა ქვიზი არ არის</p>');
  openModal(`<h3 class="head" style="margin-bottom:4px">გადატანა: ${n} კითხვა</h3><p class="hint">კითხვა ქვიზის ბოლოში მოხვდება, მერე გადაათრიე სასურველ ადგილას.${M.moveIds.some(id => M.questions[id] && M.questions[id].game === 2) ? ' თამაში 1-ში გადატანისას სწორი პასუხი წამყვანს პასუხად გამოუჩნდება.' : ''}</p>${grp(1, 'თამაში 1 · ბლიცი (ხმამაღლა წასაკითხი)')}${grp(2, 'თამაში 2 · ფაცი თუ ფუცი')}`);
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
    d.wrongFx = q.wrongFx || null; d.vid = q.vid || null; d.mediaAuto = q.mediaAuto || null; d.mediaWhen = q.mediaWhen || null;
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
    selectQ(id); setTimeout(() => { const e = $('#e_text'); if (e) e.focus(); }, 60); // რედაქტორი მაშინვე იხსნება
    db.ref('questions/' + id).set(q);
  },
  editq(id) { selectQ(id); },
  moretabs(id, b) { openMenu(b, MORE_TABS.map(([k, icon, label]) => ({ icon, label: (M.tab === k ? '• ' : '') + label, run: () => { M.tab = k; stopPlay(); closeEditor(); render(true); window.scrollTo(0, 0); } }))); },
  more(id, b) {
    const ids = qOf(M.selQuiz).map(q => q.id), i = ids.indexOf(id);
    openMenu(b, [
      { icon: 'pencil', label: 'რედაქტირება', run: () => selectQ(id) },
      { icon: 'arrow-up', label: 'ზემოთ აწევა', run: () => moveQ(id, -1), disabled: i <= 0 },
      { icon: 'arrow-down', label: 'ქვემოთ ჩამოწევა', run: () => moveQ(id, 1), disabled: i >= ids.length - 1 },
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
  pickimg() { M.pickFor = null; pickImgModal(); },
  useimg(id) { closeModal(); if (M.pickFor === 'fx') { M.pickFor = null; setFx({ type: 'img', id }); } else setField('img', id); },
  pickfximg() { M.pickFor = 'fx'; pickImgModal(); },
  rmimg() { setField('img', null); },
  playsnd(id) { togglePlay(id); },
  qevplay(ev) { const v = (M.cur.sfx || {})[ev]; SFX.preview(v || (CFG.sounds || {})[ev] || 'default', ev); },
  // სურათები
  async delimg(id) {
    const used = Object.values(M.questions).filter(q => q.img === id).length;
    if (!(await ask(used ? `ეს სურათი გამოიყენება ${used} კითხვაში. წაშლის შემდეგ ამ კითხვებიდან მოიხსნება.` : 'ეს სურათი წაიშლება.'))) return;
    const u = { ['library/images/' + id]: null, ['libdata/img/' + id]: null };
    Object.entries(M.questions).forEach(([qid, q]) => { if (q.img === id) u['questions/' + qid + '/img'] = null; if (q.wrongFx && q.wrongFx.id === id) u['questions/' + qid + '/wrongFx'] = null; });
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
  setpack(k) {
    const cur = CFG.sounds || {}, u = { soundPack: k };
    if ((CFG.soundPack || 'own') === 'own') u.soundsOwn = cur;
    if (k === 'own') u.sounds = CFG.soundsOwn || cur;
    else { const m = {}; Object.entries(SOUND_PACKS[k]).forEach(([ev, name]) => { const e = Object.entries(M.sounds).find(([, x]) => x.name === name); m[ev] = e ? e[0] : 'default'; }); u.sounds = Object.assign({}, cur, m); }
    db.ref('config').update(u).then(() => { toast('ხმების ნაკრები: ' + ({ funny: 'სასაცილო', serious: 'სერიოზული', own: 'ჩემი' })[k]); render(true); });
  },
  // ხმის მიცემა
  padd() { const id = db.ref('polls').push().key; db.ref('polls/' + id).set({ title: 'ახალი ხმის მიცემა', created: Date.now(), pts: 0, self: false, win: { dur: 4 } }).then(() => renderPolls()); },
  async pdel(id) { const p = pollsM()[id]; if (p && await ask(`წაიშლება „${p.title}“.`)) db.ref('polls/' + id).remove(); },
  pclear(id) { db.ref('polls/' + id + '/win/media').remove(); },
  pprev(id) { SFX.enable(); const w = (pollsM()[id] || {}).win || {}; runFx('fireworks', {}); if (w.sound) SFX.preview(w.sound, 'podium'); if (w.media) showMedia({ url: w.media.url, id: w.media.id, loop: w.media.loop, kind: w.media.type === 'video' ? 'video' : undefined }, w.dur || 4, 'გამარჯვებული'); },
  // ბრძოლები
  badd() { const id = db.ref('battles').push().key; db.ref('battles/' + id).set({ name: 'ახალი ბრძოლა', created: Date.now(), pts: 0, win: { dur: 4, videoDelay: 2 } }).then(() => renderBattles()); },
  async bdel(id) { const b = battlesM()[id]; if (b && await ask(`წაიშლება ბრძოლა „${b.name}“.`)) db.ref('battles/' + id).remove(); },
  bclear(id) { db.ref('battles/' + id + '/win/media').remove(); },
  bprev(id) { SFX.enable(); const b = battlesM()[id] || {}, w = b.win || {}; if (w.sound) SFX.preview(w.sound, 'podium'); if (w.media) showMedia({ url: w.media.url, id: w.media.id, loop: w.media.loop, kind: w.media.type === 'video' ? 'video' : undefined }, w.dur || 4, 'გამარჯვებული'); if (w.video) setTimeout(() => playFullVideo(w.video), (Number(w.videoDelay) || 2) * 1000); },
  // სერიები
  skadd(kind) { addStreakStep(kind); },
  skdel(fp) { const [w, path] = splitW(fp), c = streaksCopy(w), [k, n] = path.split('.'); delete c[k][n]; saveStreaks(c, w); renderStreaks(); },
  skprev(fp) {
    SFX.enable(); const [w, path] = splitW(fp), [k, n] = path.split('.'), st = (streaksCopy(w)[k] || {})[n]; if (!st) return;
    if (w === 't' && TEAM_FX.some(x => x[0] === st.effect)) { // გუნდის სვეტის ეფექტი — მიახლოებითი გადახედვა
      const map = { sparks: 'confetti', flames: 'fireworks', bigflames: 'fireworks', colfireworks: 'fireworks', shiver: 'shake' };
      playStep(Object.assign({}, st, { effect: map[st.effect] }), { caption: 'გუნდის სვეტზე ტვ-ზე' }); toast('ტვ-ზე ეს ეფექტი გუნდის სვეტზე გამოჩნდება');
    } else playStep(st, { score: '+1.5', caption: 'გადახედვა' });
  },
  skclear(path) { setStreakField(path + '.media', null); renderStreaks(); },
  resetev(ev) { db.ref('config/sounds/' + ev).set('default').then(() => render(true)); },
  resettext(k) { db.ref('config/texts/' + k).remove().then(() => render(true)); },
  async fresh() { if (await freshEvening()) { M.hist = null; toast('საღამო შეინახა ისტორიაში, ახალი საღამო დაიწყო'); } },
  histopen(id) { M.histSel = id; render(true); window.scrollTo(0, 0); },
  histback() { M.histSel = null; render(true); },
  async histreload() { await loadHistory(true); render(true); },
  async histnow() { if (!(await popup({ title: 'შენახვა ისტორიაში', text: 'მიმდინარე საღამო (ქულები, პასუხები, გამარჯვებულები) შეინახება ისტორიაში. თამაშში არაფერი შეიცვლება.', ok: 'შენახვა' }))) return; const id = await archiveEvening('ხელით შენახული'); if (!id) return toast('შესანახი არაფერია'); await loadHistory(true); M.histSel = id; render(true); toast('შეინახა'); },
  async backupexp() { try { await exportBackup(); } catch (e) { toast('ექსპორტი ვერ მოხერხდა'); } },
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
    let { full, thumb } = await imgToJpegs(file);
    if (file.type === 'image/gif') { // GIF რჩება მოძრავი
      if (file.size / 1048576 > MAX_GIF_MB) { note(`GIF ძალიან დიდია (${(file.size / 1048576).toFixed(1)} მბ). მაქსიმუმი ${MAX_GIF_MB} მბ-ია.`); return null; }
      full = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
    }
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
  if (dur > MAX_SND_SEC + .5) throw `ხმა ${Math.round(dur)} წამია. მაქსიმუმი ${MAX_SND_SEC} წამია. უფრო მოკლედ მოჭერი.`;
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
    ${line(RULE_NAMES.ptsFirst, c('g2', 'ptsFirst', g2.ptsFirst), 'ვინც პირველი უპასუხებს სრულად სწორად. ნაგულისხმევად 1.5. რიგს ბაზა წყვეტს.')}
    ${line(RULE_NAMES.ptsOther, c('g2', 'ptsOther', g2.ptsOther), 'ნაგულისხმევად 1. კონკრეტულ კითხვას შეგიძლია სხვა ქულა მისცე კითხვის რედაქტორში.')}
    ${line(RULE_NAMES.onlyFirst, c('g2', 'onlyFirst', g2.onlyFirst))}
    ${line(RULE_NAMES.penalty, c('g2', 'penalty', g2.penalty), '0 = არაფერი აკლდება.')}
    ${line(RULE_NAMES.multi, c('g2', 'multi', g2.multi))}
    ${line(RULE_NAMES.typed, c('g2', 'typed', g2.typed), 'ავტომატურისას წამყვანს მაინც შეუძლია შეასწოროს. რამდენიმე სწორი პასუხი გამოყავი „/“-ით.')}
    ${line(RULE_NAMES.board, c('g2', 'board', g2.board))}
    ${line('სურათი / ვიდეო / მუსიკა ტვ-ზე', sel('g2.media', g2.media, MEDIA_MODES), 'კითხვის დაწყებისას. თითო კითხვას შეგიძლია სხვა მისცე კითხვის რედაქტორში.')}
  </div>
  <div class="panel"><h3>${L('flag')}ფინალი</h3>
    ${line('რამდენი ადგილი გამოცხადდეს', sel('final.places', f.places, [[1, '1 (მხოლოდ გამარჯვებული)'], [2, '2'], [3, '3']]))}
    ${line('ბოლო ადგილის გამოცხადება', sel('final.loser', f.loser !== false, [[true, 'კი'], [false, 'არა']]))}
  </div></div>
  <div><div class="panel"><h3>${L('zap')}თამაში 1 · ბლიცი</h3>
    <p class="hint" style="margin:0 0 12px">ბლიცში ტელეფონები არ გამოიყენება: წამყვანი ყოველ კითხვაზე ნიშნავს, რომელმა გუნდმა უპასუხა სწორად ან არასწორად.</p>
    ${true ? line('გუნდების რაოდენობა', sel('g1.teamCount', n, [[2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']])) : ''}
    ${true ? `<div style="margin:4px 0 12px 248px">${Array.from({ length: n }, (_, i) => `<div class="row" style="margin:6px 0"><span style="width:22px;height:22px;border-radius:50%;background:${TEAM_COLORS[i]};box-shadow:inset 0 0 0 1.5px var(--pink-l);flex:none"></span><input type="text" class="grow" data-tname="${i}" value="${esc(teamName(M.teams, i))}" maxlength="24" aria-label="გუნდის სახელი"></div>`).join('')}</div>` : ''}
    ${line('სწორზე ემატება (+)', c('g1', 'pts', g1.pts), 'ნაგულისხმევად 1. კითხვას შეგიძლია სხვა მისცე რედაქტორში.')}
    ${line('არასწორზე აკლდება (−)', c('g1', 'penalty', g1.penalty), 'ნაგულისხმევად 1. 0 = არაფერი აკლდება. ქულა შეიძლება მინუსში ჩავიდეს.')}
    ${line('როდის გამოჩნდეს სურათი / ვიდეო ტვ-ზე', sel('g1.media', g1WhenNorm(g1.media), G1_WHEN), 'ტვ-ზე მარტო სურათი/ვიდეო, ტექსტის გარეშე. მუსიკა — მხოლოდ ღილაკით. თითო კითხვას შეგიძლია სხვა მისცე რედაქტორში.')}
  </div><p class="hint">ცვლილებები მაშინვე ინახება. წამყვანის გვერდზე თითო კითხვასთან ჩანს მოქმედი წესები.</p></div></div>`);
}
function saveRule(path, raw) {
  const [g, k] = path.split('.');
  const v = ['pts', 'penalty', 'ptsFirst', 'ptsOther', 'places', 'teamCount'].includes(k) ? Math.max(0, Number(raw) || 0) : raw === 'true' ? true : raw === 'false' ? false : raw;
  return db.ref('config/rules/' + g + '/' + k).set(v);
}

// ═════════ სერიები (ზედიზედ სწორი / არასწორი) ═════════
// 't:' წინსართი = ბლიცის გუნდების სერიები (config/teamStreaks), სხვა — მოთამაშეების (config/streaks)
const splitW = p => p && p.startsWith('t:') ? ['t', p.slice(2)] : ['', p];
const streaksCopy = w => JSON.parse(JSON.stringify(w === 't' ? teamStreakCfg() : streakCfg()));
function saveStreaks(c, w) { const k = w === 't' ? 'teamStreaks' : 'streaks'; queueSave(k, () => db.ref('config/' + k).set(c), 0); CFG[k] = c; }
function setStreakField(fullPath, v) {
  const [w, path] = splitW(fullPath);
  if (path === 'on') { const c0 = streaksCopy(w); c0.on = v === true || v === 'true'; return saveStreaks(c0, w); }
  const c = streaksCopy(w), parts = path.split('.'), [kind, n] = parts;
  c[kind] = c[kind] || {}; const st = c[kind][n] = c[kind][n] || { where: 'phone', dur: 2 };
  const key = parts.slice(2).join('.');
  if (key === 'media.url') st.media = v ? { type: 'url', url: String(v).trim() } : null;
  else if (key === 'media') st.media = v;
  else if (key === 'once') st.dur = v ? 'once' : 2;
  else if (key === 'dur') st.dur = Math.max(0.5, Number(v) || 2);
  else st[key] = v || null;
  saveStreaks(c, w);
}
async function addStreakStep(fullKind) {
  const [w, kind] = splitW(fullKind);
  const v = await popup({ title: kind === 'correct' ? 'ახალი საფეხური: ზედიზედ სწორი' : 'ახალი საფეხური: ზედიზედ არასწორი', text: 'რამდენი ზედიზედ?', html: '<input type="number" name="n" min="2" max="50" value="6" style="width:100%;margin-bottom:16px">', ok: 'დამატება' });
  if (!v) return; const n = Math.max(2, Math.min(50, parseInt(v.n, 10) || 0)); if (!n) return;
  const c = streaksCopy(w); c[kind] = c[kind] || {}; if (!c[kind][n]) c[kind][n] = { where: 'phone', dur: 2 }; saveStreaks(c, w); renderStreaks();
}
function renderStreaks() {
  const c = streakCfg(), tc = teamStreakCfg(), sounds = Object.entries(M.sounds);
  const sndSel = (path, cur) => `<select data-sk="${path}.sound"><option value="" ${!cur ? 'selected' : ''}>ხმის გარეშე</option>${sounds.map(([id, x]) => `<option value="${id}" ${cur === id || cur === x.name ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`;
  const card = (kind, n, st, w) => {
    const p = (w === 't' ? 't:' : '') + kind + '.' + n, m = st.media || null, isUrl = m && m.type === 'url', fxs = w === 't' ? TEAM_FX.concat(FX_LIST) : FX_LIST;
    const thumb = m ? (isUrl ? `<img class="thumb" src="${esc(m.url)}" alt="" loading="lazy">` : m.type === 'img' && M.images[m.id] ? `<img class="thumb" src="${M.images[m.id].thumb}" alt="">` : m.type === 'video' ? `<span class="chip">${L('film')}ვიდეო</span>` : '') : '<span class="hint" style="margin:0">მედია არ არის</span>';
    return `<div class="skcard"><div class="row"><b class="grow">${n} ზედიზედ ${kind === 'correct' ? 'სწორი' : 'არასწორი'}${w === 't' ? ' (გუნდი)' : ''}</b><button class="btn" data-a="skprev" data-id="${p}">${L('play')}გადახედვა</button><button class="btn quiet icon danger" data-a="skdel" data-id="${p}" data-tip="საფეხურის წაშლა">${L('trash-2')}</button></div>
      <div class="evline" style="grid-template-columns:150px minmax(0,1fr)"><b>GIF / სურათი / ვიდეო</b><div><div class="row">${thumb}<span class="grow"></span><label class="btn">${L('upload')}ატვირთვა<input type="file" data-skup="${p}" accept="image/*,video/*" hidden></label>${m ? `<button class="btn quiet icon" data-a="skclear" data-id="${p}" data-tip="მოხსნა">${L('x')}</button>` : ''}</div><input type="text" style="margin-top:8px" data-sk="${p}.media.url" value="${isUrl ? esc(m.url) : ''}" placeholder="ან ჩასვი ბმული (მაგ. tenor.com/….gif)"></div></div>
      ${isUrl ? `<p class="hint warnline">${L('wifi')} ბმულით ჩასმულ GIF-ს საღამოს ინტერნეტი დასჭირდება. თუ გინდა, ჯობს „ატვირთვა“.</p>` : ''}
      <div class="evline" style="grid-template-columns:150px minmax(0,1fr)"><b>ჩაშენებული ეფექტი</b><select data-sk="${p}.effect"><option value="">ეფექტის გარეშე</option>${fxs.map(([k, t]) => `<option value="${k}" ${st.effect === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="evline" style="grid-template-columns:150px minmax(0,1fr)"><b>წარწერა</b><input type="text" data-sk="${p}.text" value="${esc(st.text || '')}" maxlength="40" placeholder="მაგ. ორჯერ ზედიზედ"></div>
      <div class="evline" style="grid-template-columns:150px minmax(0,1fr)"><b>ხმა</b><div><div class="row">${sndSel(p, st.sound)}<label class="btn">${L('upload')}ხმის ატვირთვა<input type="file" data-sksnd="${p}" accept="audio/*" hidden></label></div>${st.sound && !sounds.some(([id, x]) => id === st.sound || x.name === st.sound) ? `<p class="hint warnline">${L('circle-alert')} „${esc(st.sound)}“ ჯერ ატვირთული არ არის — დააჭირე „ხმის ატვირთვა“.</p>` : ''}</div></div>
      <div class="evline" style="grid-template-columns:150px minmax(0,1fr)"><b>ხანგრძლივობა</b><div class="row"><input type="number" style="max-width:110px" data-sk="${p}.dur" min="0.5" step="0.5" value="${st.dur === 'once' ? '' : esc(st.dur || 2)}" ${st.dur === 'once' ? 'disabled' : ''}><span class="muted">წამი</span><label class="row" style="gap:6px;font-weight:700"><input type="checkbox" data-sk="${p}.once" ${st.dur === 'once' ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--pink)">ერთხელ ბოლომდე</label></div></div>
      ${w === 't' ? '' : `<div class="evline" style="grid-template-columns:150px minmax(0,1fr)"><b>სად ჩანს</b><select data-sk="${p}.where"><option value="phone" ${st.where !== 'both' ? 'selected' : ''}>მხოლოდ მოთამაშის ტელეფონზე</option><option value="both" ${st.where === 'both' ? 'selected' : ''}>ტელეფონზე და ტვ-ზე</option></select></div>`}</div>`;
  };
  const list = (kind, w) => Object.entries((w === 't' ? tc : c)[kind] || {}).sort((a, b) => a[0] - b[0]).map(([n, st]) => card(kind, n, st || {}, w)).join('') || '<p class="hint">საფეხური არ არის.</p>';
  setHTML(view, `<div class="panel"><div class="row"><h3 style="margin:0" class="grow">${L('flame')}სერიები: ზედიზედ სწორი და არასწორი (თამაში 2)</h3><select data-sk="on" style="max-width:220px"><option value="true" ${c.on !== false ? 'selected' : ''}>ჩართულია</option><option value="false" ${c.on === false ? 'selected' : ''}>გამორთულია</option></select></div><p class="hint" style="margin-top:10px">ეფექტი ჩნდება იმ მოთამაშის ტელეფონზე, ვინც სერიას მიაღწია, პასუხის გახსნის შემდეგ. ნაწილობრივ სწორი პასუხი სერიას არ ცვლის. უპასუხოდ დატოვება არასწორად ითვლება.</p></div>
  <div class="cols"><div class="panel"><h3>${L('trophy')}ზედიზედ სწორი<span class="grow"></span><button class="btn" data-a="skadd" data-id="correct">${L('plus')}საფეხური</button></h3>${list('correct')}</div>
  <div class="panel"><h3>${L('circle-alert')}ზედიზედ არასწორი<span class="grow"></span><button class="btn" data-a="skadd" data-id="wrong">${L('plus')}საფეხური</button></h3>${list('wrong')}</div></div>
  <div class="panel"><div class="row"><h3 style="margin:0" class="grow">${L('zap')}თამაში 1 · გუნდების სერიები (ეფექტი გუნდის სვეტზე ტვ-ზე)</h3><select data-sk="t:on" style="max-width:220px"><option value="true" ${tc.on !== false ? 'selected' : ''}>ჩართულია</option><option value="false" ${tc.on === false ? 'selected' : ''}>გამორთულია</option></select></div><p class="hint" style="margin-top:10px">სწორი პასუხი ზრდის გუნდის სერიას. არასწორი ან სხვა გუნდის ქულა სერიას ამთავრებს — ცეცხლი კვამლით ქრება.</p></div>
  <div class="cols"><div class="panel"><h3>${L('trophy')}გუნდი: ზედიზედ სწორი<span class="grow"></span><button class="btn" data-a="skadd" data-id="t:correct">${L('plus')}საფეხური</button></h3>${list('correct', 't')}</div>
  <div class="panel"><h3>${L('circle-alert')}გუნდი: ზედიზედ არასწორი<span class="grow"></span><button class="btn" data-a="skadd" data-id="t:wrong">${L('plus')}საფეხური</button></h3>${list('wrong', 't')}</div></div>`);
}

// სერიის ხმის სახელი (გუნდის 3 ზედიზედ — „სერგია გამოუღებლად“)
function streakSoundName(path) { const [w, p] = splitW(path), st = (streaksCopy(w)[p.split('.')[0]] || {})[p.split('.')[1]] || {}; return st.sound && !M.sounds[st.sound] ? st.sound : null; }
// GIF-ის ბმული → ჩამოტვირთვა და ბიბლიოთეკაში შენახვა (დიდი Tenor GIF → პატარა უხმო ვიდეო)
async function importMediaLink(url) {
  const tries = [], tm = url.match(/tenor\.com\/(?:m\/)?([A-Za-z0-9_-]{11})[A-Za-z0-9_-]{5}\//);
  if (tm) { tries.push({ u: `https://media.tenor.com/${tm[1]}AAAAC/x.gif`, kind: 'img' }, { u: `https://media.tenor.com/${tm[1]}AAAPo/x.mp4`, kind: 'video' }, { u: `https://media.tenor.com/${tm[1]}AAAAM/x.gif`, kind: 'img' }); }
  else tries.push({ u: url, kind: /\.(mp4|webm)(\?|$)/i.test(url) ? 'video' : 'img' });
  for (const t of tries) {
    try {
      const r = await fetch(t.u); if (!r.ok) continue;
      const blob = await r.blob(), mb = blob.size / 1048576;
      if (t.kind === 'img' && mb > MAX_GIF_MB) continue;           // ძალიან დიდი GIF — ვცდით ვიდეოს
      if (t.kind === 'video' && mb > MAX_VID_MB) continue;
      const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
      const name = 'GIF ' + new Date().toLocaleDateString('ka-GE');
      if (t.kind === 'video') { const id = db.ref('library/videos').push().key; await db.ref('libdata/vid/' + id).set(data); await db.ref('library/videos/' + id).set({ name, size: blob.size, dur: 0, gif: true, created: TS }); return { type: 'video', id, loop: true }; }
      const file = new File([blob], 'link.gif', { type: blob.type || 'image/gif' }); const id = await addImage(file); if (id) return { type: 'img', id };
    } catch (e) {}
  }
  return null;
}

// ═════════ მოთამაშეების ხმის მიცემა (MVP) ═════════
const pollsM = () => M.polls || DEFAULT_POLLS;
function setPollField(path, v) {
  const [id, key] = path.split('|'); if (!id) return;
  let val = v;
  if (key === 'pts' || key === 'win.dur') val = Math.max(0, Number(v) || 0);
  if (key === 'self') val = v === true || v === 'true';
  if (key === 'title') val = String(v).trim() || 'ხმის მიცემა';
  if (key === 'win.once') return db.ref('polls/' + id + '/win/dur').set(v ? 'once' : 4);
  if (key === 'win.media.url') val = String(v).trim() ? { type: 'url', url: String(v).trim() } : null;
  queueSave('p:' + path, () => db.ref('polls/' + id + '/' + key.replace(/\./g, '/').replace(/\/url$/, '')).set(val === '' ? null : val), 0);
}
function renderPolls() {
  const all = pollsM(), ids = Object.keys(all).sort((a, b) => (all[a].created || 0) - (all[b].created || 0)), sounds = Object.entries(M.sounds);
  const line = (label, ctl) => `<div class="evline" style="grid-template-columns:200px minmax(0,1fr)"><b>${label}</b>${ctl}</div>`;
  const card = id => {
    const p = all[id] || {}, w = p.win || {}, m = w.media || null, isUrl = m && m.type === 'url';
    const thumb = m ? (isUrl ? `<img class="thumb" src="${esc(m.url)}" alt="">` : m.type === 'img' && M.images[m.id] ? `<img class="thumb" src="${M.images[m.id].thumb}" alt="">` : `<span class="chip">${L('film')}ვიდეო</span>`) : '<span class="hint" style="margin:0">არ არის</span>';
    return `<div class="panel"><div class="row"><input type="text" class="grow" data-pf="${id}|title" value="${esc(p.title || '')}" maxlength="60" style="font-weight:800;font-size:17px"><button class="btn" data-a="pprev" data-id="${id}">${L('play')}გადახედვა</button><button class="btn quiet icon danger" data-a="pdel" data-id="${id}" data-tip="წაშლა">${L('trash-2')}</button></div>
      ${line('ქულა გამარჯვებულს', `<input type="number" min="0" step="0.5" data-pf="${id}|pts" value="${esc(p.pts || 0)}" style="max-width:120px">`)}
      ${line('საკუთარ თავს ხმა', `<select data-pf="${id}|self"><option value="false" ${!p.self ? 'selected' : ''}>არ შეიძლება</option><option value="true" ${p.self ? 'selected' : ''}>შეიძლება</option></select>`)}
      ${line('გამარჯვების GIF / სურათი', `<div><div class="row">${thumb}<span class="grow"></span><label class="btn">${L('upload')}ატვირთვა<input type="file" data-pup="${id}|media" accept="image/*,video/*" hidden></label>${m ? `<button class="btn quiet icon" data-a="pclear" data-id="${id}" data-tip="მოხსნა">${L('x')}</button>` : ''}</div><input type="text" style="margin-top:8px" data-pf="${id}|win.media.url" value="${isUrl ? esc(m.url) : ''}" placeholder="ან ჩასვი ბმული"></div>`)}
      ${line('რამდენ ხანს ჩანს', `<div class="row"><input type="number" style="max-width:110px" min="1" step="0.5" data-pf="${id}|win.dur" value="${w.dur === 'once' ? '' : esc(w.dur || 4)}" ${w.dur === 'once' ? 'disabled' : ''}><span class="muted">წამი</span><label class="row" style="gap:6px;font-weight:700"><input type="checkbox" data-pf="${id}|win.once" ${w.dur === 'once' ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--pink)">ერთხელ ბოლომდე</label></div>`)}
      ${line('გამარჯვების ხმა', `<div class="row"><select data-pf="${id}|win.sound"><option value="">ხმის გარეშე</option>${sounds.map(([sid, x]) => `<option value="${sid}" ${w.sound === sid ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><label class="btn">${L('upload')}ატვირთვა<input type="file" data-pup="${id}|sound" accept="audio/*" hidden></label></div>`)}
    </div>`;
  };
  setHTML(view, `<div class="row" style="margin-bottom:16px"><p class="hint grow" style="margin:0">ყველა მოთამაშე ტელეფონით აძლევს ხმას ერთ-ერთ სხვა მოთამაშეს. ტვ-ზე ჯერ მესამე, მეორე და პირველი ადგილი ჩნდება, მერე გამარჯვებული გვირგვინით და ფეიერვერკით. მილოცვის ტექსტები — „პარამეტრებში“. ახალი სათაური შეგიძლია წამყვანის გვერდიდანაც შექმნა.</p><button class="btn primary" data-a="padd">${L('plus')}ახალი</button></div><div class="cols">${ids.map(card).join('')}</div>`);
}

// ═════════ ბრძოლები ═════════
const battlesM = () => M.battles || DEFAULT_BATTLES;
function setBattleField(path, v) {
  const [bid, key] = path.split('|'); if (!bid) return;
  let val = v;
  if (key === 'pts' || key === 'win.dur' || key === 'win.videoDelay') val = Math.max(0, Number(v) || 0);
  if (key === 'win.once') return db.ref('battles/' + bid + '/win/dur').set(v ? 'once' : 4);
  if (key === 'win.media.url') val = String(v).trim() ? { type: 'url', url: String(v).trim() } : null;
  queueSave('b:' + path, () => db.ref('battles/' + bid + '/' + key.replace(/\./g, '/').replace(/\/url$/, '')).set(val === '' ? null : val), 0);
}
function renderBattles() {
  const all = battlesM(), ids = Object.keys(all).sort((a, b) => (all[a].created || 0) - (all[b].created || 0)), sounds = Object.entries(M.sounds), vids = Object.entries(M.videos);
  const card = id => {
    const b = all[id] || {}, w = b.win || {}, m = w.media || null, isUrl = m && m.type === 'url';
    const thumb = m ? (isUrl ? `<img class="thumb" src="${esc(m.url)}" alt="">` : m.type === 'img' && M.images[m.id] ? `<img class="thumb" src="${M.images[m.id].thumb}" alt="">` : `<span class="chip">${L('film')}ვიდეო</span>`) : '<span class="hint" style="margin:0">არ არის</span>';
    return `<div class="panel"><div class="row"><input type="text" class="grow" data-bf="${id}|name" value="${esc(b.name || '')}" maxlength="40" style="font-weight:800;font-size:18px"><button class="btn" data-a="bprev" data-id="${id}">${L('play')}გადახედვა</button><button class="btn quiet icon danger" data-a="bdel" data-id="${id}" data-tip="ბრძოლის წაშლა">${L('trash-2')}</button></div>
      <div class="evline" style="grid-template-columns:200px minmax(0,1fr)"><b>ქულა გამარჯვებულს</b><input type="number" min="0" step="0.5" data-bf="${id}|pts" value="${esc(b.pts || 0)}" style="max-width:120px"></div>
      <div class="evline" style="grid-template-columns:200px minmax(0,1fr)"><b>გამარჯვების GIF / სურათი</b><div><div class="row">${thumb}<span class="grow"></span><label class="btn">${L('upload')}ატვირთვა<input type="file" data-bup="${id}|media" accept="image/*,video/*" hidden></label>${m ? `<button class="btn quiet icon" data-a="bclear" data-id="${id}" data-tip="მოხსნა">${L('x')}</button>` : ''}</div><input type="text" style="margin-top:8px" data-bf="${id}|win.media.url" value="${isUrl ? esc(m.url) : ''}" placeholder="ან ჩასვი ბმული"></div></div>
      <div class="evline" style="grid-template-columns:200px minmax(0,1fr)"><b>რამდენ ხანს ჩანს</b><div class="row"><input type="number" style="max-width:110px" min="1" step="0.5" data-bf="${id}|win.dur" value="${w.dur === 'once' ? '' : esc(w.dur || 4)}" ${w.dur === 'once' ? 'disabled' : ''}><span class="muted">წამი</span><label class="row" style="gap:6px;font-weight:700"><input type="checkbox" data-bf="${id}|win.once" ${w.dur === 'once' ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--pink)">ერთხელ ბოლომდე</label></div></div>
      <div class="evline" style="grid-template-columns:200px minmax(0,1fr)"><b>გამარჯვების ხმა</b><div class="row"><select data-bf="${id}|win.sound"><option value="">ხმის გარეშე</option>${sounds.map(([sid, x]) => `<option value="${sid}" ${w.sound === sid ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><label class="btn">${L('upload')}ატვირთვა<input type="file" data-bup="${id}|sound" accept="audio/*" hidden></label></div></div>
      <div class="evline" style="grid-template-columns:200px minmax(0,1fr)"><b>გამარჯვებულის ვიდეო (სრულ ეკრანზე, ხმით)</b><div class="row"><select data-bf="${id}|win.video"><option value="">ვიდეოს გარეშე</option>${vids.map(([vid, x]) => `<option value="${vid}" ${w.video === vid ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><label class="btn">${L('upload')}ვიდეოს ატვირთვა<input type="file" data-bup="${id}|video" accept="video/*" hidden></label></div></div>
      <div class="evline" style="grid-template-columns:200px minmax(0,1fr)"><b>ვიდეო იწყება</b><div class="row"><input type="number" style="max-width:110px" min="0" step="0.5" data-bf="${id}|win.videoDelay" value="${esc(w.videoDelay == null ? 2 : w.videoDelay)}"><span class="muted">წამში მილოცვის შემდეგ</span></div></div>
      ${isUrl ? `<p class="hint warnline">${L('wifi')} ბმულს საღამოს ინტერნეტი სჭირდება — ჯობს „ატვირთვა“.</p>` : ''}</div>`;
  };
  setHTML(view, `<div class="row" style="margin-bottom:16px"><p class="hint grow" style="margin:0">ბრძოლა: რამდენიმე მოთამაშე გამოდის, დანარჩენები ტელეფონით აძლევენ ხმას. მართვა — წამყვანის გვერდზე „ბრძოლები“. გამარჯვებულის ვიდეო: მაქს. ${WIN_VID_SEC} წამი / ${WIN_VID_MB} მბ (MP4 საუკეთესოა).</p><button class="btn primary" data-a="badd">${L('plus')}ახალი ბრძოლა</button></div><div class="cols">${ids.map(card).join('')}</div>`);
}

// ═════════ სურათები ═════════
function renderImages() {
  const l = Object.entries(M.images).sort((a, b) => (b[1].created || 0) - (a[1].created || 0));
  setHTML(view, `<div class="panel"><h3>${L('upload')}ატვირთვა</h3><div class="drop"><p class="hint">სურათი ავტომატურად მცირდება (მაქს. 1280 პიქსელი). GIF რჩება მოძრავი (მაქს. ${MAX_GIF_MB} მბ). ერთი სურათი შეგიძლია რამდენიმე კითხვაში გამოიყენო.</p><label class="btn primary">${L('upload')}აირჩიე ფაილები<input type="file" id="lib_img_up" accept="image/*" multiple hidden></label></div></div>
  <div class="panel"><h3>${L('images')}ბიბლიოთეკა (${l.length})</h3>${l.length ? `<div class="libgrid">${l.map(([id, im]) => `<div class="libitem"><img src="${im.thumb}" alt=""><input type="text" data-imgname="${id}" value="${esc(im.name)}" maxlength="40" aria-label="სახელი"><span class="hint" style="margin:0">გამოიყენება ${Object.values(M.questions).filter(q => q.img === id).length} კითხვაში</span><div class="row"><label class="btn grow">${L('refresh-cw')}ჩანაცვლება<input type="file" data-replimg="${id}" accept="image/*" hidden></label><button class="btn quiet icon danger" data-a="delimg" data-id="${id}" data-tip="წაშლა">${L('trash-2')}</button></div></div>`).join('')}</div>` : '<p class="hint">ჯერ სურათები არ არის.</p>'}</div>`);
}

// ═════════ ხმები ═════════
function renderSounds() {
  const l = Object.entries(M.sounds).sort((a, b) => (b[1].created || 0) - (a[1].created || 0));
  const rows = SOUND_EVENTS.map(([ev, label]) => {
    const cur = (CFG.sounds || {})[ev] || 'default';
    return `<div class="evrow2"><b>${label}</b><span class="cur">${L(cur === 'default' ? 'sparkles' : cur === 'none' ? 'volume-x' : 'file-audio')} ${esc(sndName(cur))}</span><button class="btn icon" data-a="testev" data-id="${ev}" data-tip="მოსმენა">${L('play')}</button><label class="btn">${L('upload')}ატვირთვა<input type="file" data-evup="${ev}" accept="audio/*" hidden></label><select data-ev="${ev}" aria-label="ხმის არჩევა"><option value="default" ${cur === 'default' ? 'selected' : ''}>ჩაშენებული</option><option value="none" ${cur === 'none' ? 'selected' : ''}>უხმოდ</option>${l.map(([id, s]) => `<option value="${id}" ${cur === id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select><button class="btn quiet" data-a="resetev" data-id="${ev}" ${cur === 'default' ? 'disabled' : ''}>${L('rotate-ccw')}ჩაშენებული</button></div>`;
  }).join('');
  const pack = CFG.soundPack || 'own';
  const packBar = `<div class="panel"><h3>${L('package')}ხმების ნაკრები</h3><div class="seg">${[['funny', 'სასაცილო'], ['serious', 'სერიოზული'], ['own', 'ჩემი']].map(([k, t]) => `<button class="btn ${pack === k ? 'primary' : ''}" data-a="setpack" data-id="${k}">${t}</button>`).join('')}</div><p class="hint">ნაკრების არჩევა ერთად აყენებს ყველა მოვლენის ხმას. მერე ნებისმიერი ცალკე შეგიძლია შეცვალო — მაშინ ნაკრები „ჩემი“ ხდება. მზა ხმები: Mixkit (უფასო).</p></div>`;
  setHTML(view, packBar + `<div class="panel"><h3>${L('volume-2')}თამაშის ხმები · ნაგულისხმევი მთელი თამაშისთვის</h3><p class="hint">კონკრეტულ კითხვას შეგიძლია საკუთარი ხმა მისცე კითხვის რედაქტორში.</p><div class="evtable">${rows}</div></div>
  <div class="panel"><h3>${L('library-big')}ხმების ბიბლიოთეკა (${l.length})<span class="grow"></span><label class="btn primary">${L('upload')}ფაილების ატვირთვა<input type="file" id="lib_snd_up" accept="audio/*" multiple hidden></label></h3><p class="hint">თითო ფაილი: მაქსიმუმ <b>${MAX_SND_SEC} წამი</b> და <b>${MAX_SND_MB} მბ</b>. MP3 საუკეთესოა. აქედან იღებ კლიპებსაც „გამოიცანი სიმღერა“ კითხვებისთვის.</p>
  ${l.map(([id, s]) => `<div class="sndrow"><button class="btn icon" data-a="play" data-id="${id}" data-tip="დაკვრა / გაჩერება">${L('play')}</button><input type="text" data-sndname="${id}" value="${esc(s.name)}" maxlength="40" aria-label="სახელი">${s.pack ? `<span class="tag ${s.pack === 'funny' ? 't-poll' : s.pack === 'serious' ? 't-multi' : 't-text'}">${s.pack === 'funny' ? 'სასაცილო' : s.pack === 'serious' ? 'სერიოზული' : 'მზა'}</span>` : ''}<span class="hint" style="margin:0">${Math.round(s.dur || 0)} წმ · ${((s.size || 0) / 1048576).toFixed(2)} მბ · ${usageSnd(id)} კითხვა</span><label class="btn">${L('refresh-cw')}ჩანაცვლება<input type="file" data-replsnd="${id}" accept="audio/*" hidden></label><button class="btn quiet icon danger" data-a="delsnd" data-id="${id}" data-tip="წაშლა">${L('trash-2')}</button></div>`).join('') || '<p class="hint">ჯერ ხმები არ არის.</p>'}</div>`);
}

// ═════════ პარამეტრები ═════════
function renderSettings() {
  setHTML(view, `<div class="cols"><div><div class="panel"><h3>${L('type')}თამაშის სახელი</h3><input type="text" id="s_name" value="${esc(gameName())}" maxlength="30"><p class="hint">ჩანს ლოგოში ტელეფონზე და ტვ-ზე.</p></div>
  <div class="panel"><h3>${L('users')}გუნდები</h3><p class="hint">გუნდების რაოდენობა და სახელები ახლა „წესებშია“.</p><button class="btn" data-sec="rules">${L('scale')}წესებზე გადასვლა</button></div>
  <div class="panel"><h3>${L('check')}„ხელს ვაწერ“ შესვლისას</h3><textarea id="s_agree" rows="3">${esc(agreeText())}</textarea><p class="hint">ტელეფონზე ჩანს შესვლისას. ვიდრე არ მონიშნავენ, შესვლის ღილაკი არ ირთვება.</p></div>
  <div class="panel"><h3>${L('sparkles')}ახალი საღამოს დაწყება</h3><p class="hint">წაშლის ყველა მოთამაშეს, ქულას, გუნდებში განაწილებას, პასუხებს, ბრძოლების და ხმის მიცემის შედეგებს და თამაშების პროგრესს. ტელეფონები თავიდან შემოდიან ახალი კოდით. ქვიზები, მედია, წესები, გუნდების სახელები და PIN რჩება.</p><button class="btn danger" data-a="fresh" id="freshBtn">${L('sparkles')}ახალი საღამოს დაწყება</button></div>
  <div class="panel"><h3>${L('hard-drive-download')}სარეზერვო ფაილი</h3><p class="hint">ერთ ფაილში: ყველა ქვიზი, კითხვა, სურათი, ვიდეო, ხმა, პარამეტრი და ისტორია. იმპორტი მხოლოდ ამატებს იმას, რაც ჯერ არ არის — არსებულს არ შლის და არ ცვლის.</p><div class="row"><button class="btn primary" data-a="backupexp" id="backupExp">${L('download')}სარეზერვოს ჩამოტვირთვა</button><label class="btn">${L('upload')}სარეზერვოდან აღდგენა<input type="file" id="backupImp" accept="application/json,.json" hidden></label></div></div>
  <div class="panel"><h3>${L('lock')}წამყვანის და ადმინის PIN</h3><div class="row"><input type="text" id="s_pin" class="grow" value="${esc(CFG.pin || DEFAULT_PIN)}" maxlength="12"><button class="btn primary" data-a="savepin">${L('check')}შენახვა</button></div><p class="hint">PIN მსუბუქი დაცვაა, რეპოზიტორია საჯაროა.</p></div></div>
  <div class="panel"><h3>${L('monitor-play')}ტვ-ზე შესავლები („ტვ-ზე ჩვენება“)</h3><p class="hint">თამაშის სახელი და 1–2 ხაზი წესები, რაც ტვ-ზე ჩანს წამყვანის „ტვ-ზე ჩვენებაზე“. ცარიელი = ნაგულისხმევი.</p>${introList(M.battles || null).map(x => { const it = introOf(x.key, M.battles || null), own = ((CFG.intros || {})[introCfgKey(x.key)]) || {}; return `<label class="f">${esc(x.short)}</label><input type="text" data-intro="${esc(introCfgKey(x.key))}|title" value="${esc(own.title || '')}" placeholder="${esc(it.title)}" maxlength="40"><textarea data-intro="${esc(introCfgKey(x.key))}|text" rows="2" placeholder="${esc(it.text)}" style="margin-top:6px">${esc(own.text || '')}</textarea>`; }).join('')}</div>
  <div class="panel"><h3>${L('message-circle')}სასაცილო ტექსტები</h3><p class="hint">თითო ხაზი = ერთი ვარიანტი, თამაში შემთხვევით ირჩევს. ბოლო ადგილის ტექსტში {name} ჩაანაცვლებს სახელს.</p>${TEXT_KEYS.map(([k, label]) => `<label class="f">${label}</label><textarea data-text="${k}" rows="${Math.min(7, textList(k).length + 1)}">${esc(textList(k).join('\n'))}</textarea><button class="btn quiet" data-a="resettext" data-id="${k}" style="margin-top:6px">${L('rotate-ccw')}ნაგულისხმევზე დაბრუნება</button>`).join('')}</div></div>`);
}

// ───────── ისტორია: წარსული საღამოები ─────────
const fmtDate = t => { if (!t) return ''; const d = new Date(t), z = n => String(n).padStart(2, '0'); return `${z(d.getDate())}.${z(d.getMonth() + 1)}.${d.getFullYear()} ${z(d.getHours())}:${z(d.getMinutes())}`; };
async function loadHistory(force) {
  if (M.hist && !force) return M.hist;
  M.hist = (await db.ref('history').once('value')).val() || {}; return M.hist;
}
async function renderHistory() {
  if (!M.hist) { setHTML(view, '<div class="panel"><p class="muted">იტვირთება…</p></div>'); await loadHistory(); if (M.tab !== 'history') return; }
  const h = M.hist, list = Object.entries(h).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
  if (M.histSel && h[M.histSel]) return setHTML(view, historyDetail(M.histSel, h[M.histSel]));
  const rows = list.map(([id, e]) => { const s = e.summary || {}, top = (s.players || [])[0]; return `<button class="histrow" data-a="histopen" data-id="${id}"><span class="hd">${L('calendar')}<b>${esc(fmtDate(e.started || e.at))}</b></span><span class="grow">${esc(e.note || '')}</span><span class="muted">${(s.players || []).length} მოთამაშე</span>${top ? `<span class="chip star">${L('trophy')}${esc(top.name)} · ${fmtPts(top.score)}</span>` : ''}${L('chevron-right')}</button>`; }).join('');
  setHTML(view, `<div class="panel"><h3>${L('history')}წარსული საღამოები<span class="grow"></span><button class="btn quiet" data-a="histreload">${L('refresh-cw')}განახლება</button></h3><p class="hint">„ახალი საღამოს დაწყება“ მიმდინარე საღამოს ჯერ აქ ინახავს, მერე ასუფთავებს.</p>${rows || '<div class="empty">ისტორია ჯერ ცარიელია.</div>'}<div class="row" style="margin-top:14px"><button class="btn" data-a="histnow">${L('save')}მიმდინარე საღამოს შენახვა ახლავე</button></div></div>`);
}
function historyDetail(id, e) {
  const s = e.summary || {}, P = (e.raw && e.raw.players) || {}, nm = pid => (P[pid] || {}).name || '?', ps = s.players || [], byId = {}; ps.forEach(p => { byId[p.id] = p; });
  const tn = i => { const t = (s.teams || []).find(x => x.i === Number(i)); return t ? t.name : ''; };
  const medal = ['🥇', '🥈', '🥉'];
  const podium = (s.podium || []).map((pid, i) => `<div class="hpod"><span class="md">${medal[i] || i + 1}</span><span class="pic">${av((byId[pid] || {}).avatar)}</span><b>${esc(nm(pid))}</b><span class="muted">${fmtPts((byId[pid] || {}).score)} ქულა</span></div>`).join('');
  const last = s.last ? `<div class="hpod lastp"><span class="md">🐢</span><span class="pic">${av((byId[s.last] || {}).avatar)}</span><b>${esc(nm(s.last))}</b><span class="muted">ბოლო ადგილი · ${fmtPts((byId[s.last] || {}).score)}</span></div>` : '';
  const votes = (arr2, title, icon) => arr2.map(v => `<div class="hvote"><b>${L(icon)}${esc(v.name || title)}</b>: ${v.winners.length ? v.winners.map(w => esc(w.name)).join(' და ') : '—'}<span class="muted"> · ${v.list.map(x => esc(x.name) + ' ' + x.n).join(', ')}</span></div>`).join('');
  const teams = (s.teams || []).map((t, i) => `<div class="row hteam"><span>${i + 1}.</span>${ttag(t.i, t.name)}<span class="grow"></span><b>${fmtPts(t.score)}</b></div>`).join('') || '<p class="hint">—</p>';
  const board = `<table class="htbl"><thead><tr><th>#</th><th>მოთამაშე</th><th>გუნდი</th><th>ქულა</th></tr></thead><tbody>${ps.map((p, i) => `<tr><td>${i + 1}</td><td><span class="pic sm">${av(p.avatar)}</span>${esc(p.name)}</td><td>${p.team == null ? '' : esc(tn(p.team))}</td><td><b>${fmtPts(p.score)}</b></td></tr>`).join('')}</tbody></table>`;
  // კითხვები: თითო მოთამაშის პასუხი
  const qs = e.qs || {}, ans = (e.raw && e.raw.answers) || {}, aw = (e.raw && e.raw.awarded) || {}, g1 = Object.values((e.raw && e.raw.g1log) || {});
  const ansTxt = (q, a) => { if (!a) return ''; const o = arr(q.options); if (q.type === 'text') return esc(a.a); if (q.type === 'multi') return arr(a.a).map(i => esc(o[i] || '?')).join(' • '); return esc(o[a.a] !== undefined ? o[a.a] : String(a.a)); };
  const qlist = Object.entries(qs).sort((a, b) => (a[1].game - b[1].game) || ((a[1].order || 0) - (b[1].order || 0)));
  const qhtml = qlist.map(([qid, q]) => {
    const o = arr(q.options), corr = q.type === 'text' ? esc(q.answer || '') : arr(q.correct).map(i => esc(o[i] || '')).join(' • ');
    let body;
    if (q.game === 1) body = g1.filter(x => x.qid === qid).map(x => `<div>${ttag(x.team, tn(x.team) || 'გუნდი ' + (Number(x.team) + 1))} ${x.kind === 'r' ? 'სწორი' : 'არასწორი'} ${x.pts > 0 ? '+' : ''}${fmtPts(x.pts)}</div>`).join('') || '<span class="hint">არავინ მონიშნულა</span>';
    else { const a = ans[qid] || {}; body = `<table class="htbl sm"><tbody>${ps.map(p => { const x = a[p.id], pts = Number((aw[qid] || {})[p.id]) || 0; return `<tr><td>${esc(p.name)}</td><td>${x ? ansTxt(q, x) : '<span class="hint">—</span>'}</td><td>${pts ? (pts > 0 ? '+' : '') + fmtPts(pts) : ''}</td></tr>`; }).join('')}</tbody></table>`; }
    return `<details class="hq"><summary><span class="tag t-${q.type}">${q.game === 1 ? 'ბლიცი' : (TYPE_NAMES[q.type] || '')}</span>${esc(q.text || '(ცარიელი)')}</summary>${corr ? `<p class="hint">სწორი პასუხი: <b>${corr}</b></p>` : ''}${body}</details>`;
  }).join('');
  return `<div class="row" style="margin-bottom:14px"><button class="btn" data-a="histback">${L('arrow-left')}ყველა საღამო</button><span class="grow"></span><span class="chip">${L('calendar')}${esc(fmtDate(e.started || e.at))} · კოდი ${esc(e.code || '')}</span></div>
  ${e.note ? `<p class="muted">${esc(e.note)}</p>` : ''}
  <div class="cols"><div><div class="panel"><h3>${L('trophy')}პოდიუმი</h3><div class="hpods">${podium}${last}</div></div>
  <div class="panel"><h3>${L('vote')}MVP და ბრძოლები</h3>${votes(s.mvp || [], 'MVP', 'star')}${votes(s.battles || [], 'ბრძოლა', 'swords')}${!(s.mvp || []).length && !(s.battles || []).length ? '<p class="hint">ხმის მიცემა არ ყოფილა.</p>' : ''}</div>
  <div class="panel"><h3>${L('users')}ბლიცი: გუნდების ქულები</h3>${teams}</div></div>
  <div class="panel"><h3>${L('list-ordered')}ქულების ცხრილი</h3>${board}</div></div>
  <div class="panel"><h3>${L('list-checks')}კითხვები და ყველა პასუხი (${qlist.length})</h3>${qhtml || '<p class="hint">—</p>'}</div>`;
}

// ───────── სარეზერვო ფაილი: ექსპორტი / იმპორტი (იმპორტი არაფერს შლის) ─────────
const BACKUP_KEYS = ['quizzes', 'questions', 'library', 'libdata', 'config', 'history', 'battles', 'polls', 'teams'];
const BACKUP_DEPTH = { library: 2, libdata: 2, config: 99 }; // სხვები: 1 (თითო ჩანაწერი მთლიანად)
async function exportBackup() {
  toast('სარეზერვო ფაილი მზადდება…');
  const snaps = await Promise.all(BACKUP_KEYS.map(k => db.ref(k).once('value')));
  const data = {}; BACKUP_KEYS.forEach((k, i) => { data[k] = snaps[i].val() || null; });
  const blob = new Blob([JSON.stringify({ app: 'pazzi', v: 1, at: Date.now(), data })], { type: 'application/json' });
  const d = new Date(), z = n => String(n).padStart(2, '0'), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `pazzi-backup-${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}.json`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  return blob.size;
}
// მხოლოდ ის, რაც ბაზაში ჯერ არ არის → { path: value }
function missingPaths(ex, inc, path, depth, out) {
  if (inc === null || inc === undefined) return;
  if (ex === null || ex === undefined) { out[path] = inc; return; }
  if (depth <= 0 || typeof ex !== 'object' || typeof inc !== 'object') return; // უკვე არის — არ ვცვლით
  for (const k in inc) missingPaths(ex[k], inc[k], path + '/' + k, depth - 1, out);
}
async function importBackup(file) {
  let j; try { j = JSON.parse(await file.text()); } catch (e) { return popup({ title: 'ფაილი ვერ წავიკითხე', text: 'ეს არ ჰგავს ფაციფუცობანას სარეზერვო ფაილს.', ok: 'კარგი' }); }
  const data = j && j.app === 'pazzi' && j.data; if (!data) return popup({ title: 'ფაილი ვერ წავიკითხე', text: 'ეს არ ჰგავს ფაციფუცობანას სარეზერვო ფაილს.', ok: 'კარგი' });
  const out = {}, cnt = {};
  for (const k of BACKUP_KEYS) { if (!data[k]) continue; const ex = (await db.ref(k).once('value')).val(); const o = {}; missingPaths(ex, data[k], k, BACKUP_DEPTH[k] || 1, o); cnt[k] = Object.keys(o).length; Object.assign(out, o); }
  const n = Object.keys(out).length;
  if (!n) return popup({ title: 'ახალი არაფერია', text: 'ფაილში ყველაფერი უკვე ბაზაშია. არაფერი შეცვლილა.', ok: 'კარგი' });
  const names = { quizzes: 'ქვიზი', questions: 'კითხვა', library: 'მედიის ჩანაწერი', libdata: 'მედიის ფაილი', config: 'პარამეტრი', history: 'საღამო ისტორიაში', battles: 'ბრძოლა', polls: 'ხმის მიცემა', teams: 'გუნდი' };
  const txt = Object.entries(cnt).filter(([, v]) => v).map(([k, v]) => `${names[k]}: ${v}`).join(', ');
  if (!(await popup({ title: 'იმპორტი', text: `დაემატება მხოლოდ ის, რაც ჯერ არ არის (${txt}). არსებული არაფერი წაიშლება და არ შეიცვლება.`, ok: 'დამატება' }))) return;
  // ნაწილ-ნაწილ, რომ დიდი ფაილი ერთ ჩაწერაში არ გაიჭედოს
  let batch = {}, size = 0;
  for (const [p, v] of Object.entries(out)) { const s = JSON.stringify(v).length; if (size + s > 4e6 && size) { await db.ref().update(batch); batch = {}; size = 0; } batch[p] = v; size += s; }
  if (size) await db.ref().update(batch);
  M.hist = null; toast(`დაემატა: ${n}`); return cnt;
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
  else if (t.dataset.sk && /media\.url$/.test(t.dataset.sk)) {}
  else if (t.dataset.sk && (t.type === 'text' || t.type === 'number')) { const k = t.dataset.sk, v = t.value; queueSave('sk:' + k, () => { setStreakField(k, v); }, 500); }
  else if (t.dataset.rule && t.type === 'number') queueSave('r:' + t.dataset.rule, () => saveRule(t.dataset.rule, t.value));
  else if (t.dataset.imgname) queueSave('in' + t.dataset.imgname, () => db.ref('library/images/' + t.dataset.imgname + '/name').set(t.value));
  else if (t.dataset.sndname) queueSave('sn' + t.dataset.sndname, () => db.ref('library/sounds/' + t.dataset.sndname + '/name').set(t.value));
  else if (t.id === 's_agree') queueSave('agree', () => db.ref('config/agreeText').set(t.value.trim() || null));
  else if (t.dataset.pf && (t.type === 'text' || t.type === 'number')) { const k = t.dataset.pf, v = t.value; if (!/media\.url$/.test(k)) queueSave('pf:' + k, () => setPollField(k, v), 500); }
  else if (t.dataset.bf && (t.type === 'text' || t.type === 'number')) { const k = t.dataset.bf, v = t.value; if (!/media\.url$/.test(k)) queueSave('bf:' + k, () => setBattleField(k, v), 500); }
  else if (t.id === 's_name') queueSave('gname', () => db.ref('config/gameName').set(t.value.trim() || null));
  else if (t.dataset.tname !== undefined) queueSave('tn' + t.dataset.tname, () => db.ref('teams/' + t.dataset.tname + '/name').set(t.value));
  else if (t.dataset.intro) { const [k, f] = t.dataset.intro.split('|'); queueSave('in' + t.dataset.intro, () => db.ref('config/intros/' + k + '/' + f).set(t.value.trim() ? t.value : null)); }
  else if (t.dataset.text) queueSave('tx' + t.dataset.text, () => {
    const lines = t.value.split('\n').map(s => s.trim()).filter(Boolean);
    return db.ref('config/texts/' + t.dataset.text).set(lines.length ? lines : null);
  });
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.classList && t.classList.contains('qsel')) { t.checked ? M.sel.add(t.dataset.id) : M.sel.delete(t.dataset.id); drawQList(); return; }
  if (t.id === 'backupImp' && t.files[0]) { const f = t.files[0]; t.value = ''; try { await importBackup(f); } catch (err) { toast('იმპორტი ვერ მოხერხდა'); } return; }
  if (t.id === 'e_type') { collect(); const c = M.cur; c.type = t.value; const n = t.value === 'poll' ? 2 : (t.value === 'text' ? 0 : 4); const o = arr(c.options).slice(0, n); while (o.length < n) o.push(''); c.options = o; c.correct = []; scheduleQSave(); drawEditor(); drawQListSoon(); }
  else if (t.id === 'e_snd') { setField('snd', t.value); drawQListSoon(); }
  else if (t.dataset.qev) setSfx(t.dataset.qev, t.value);
  else if (t.id === 'e_vid') { setField('vid', t.value); drawQListSoon(); }
  else if (t.id === 'e_vid_up' && t.files[0]) { const id = await addVideo(t.files[0]); if (id) { setField('vid', id); drawQListSoon(); } }
  else if (t.id === 'e_mauto') { M.cur.mediaAuto = t.value || null; scheduleQSave(); }
  else if (t.id === 'e_mwhen') { M.cur.mediaWhen = t.value || null; scheduleQSave(); }
  else if (t.id === 'e_fx_type') setFx(t.value === 'effect' ? { type: 'effect', name: 'tomatoes' } : t.value ? { type: t.value, id: null } : null);
  else if (t.id === 'e_fx_eff') setFx({ type: 'effect', name: t.value });
  else if (t.id === 'e_fx_vid') setFx({ type: 'video', id: t.value || null });
  else if (t.id === 'e_fx_img' && t.files[0]) { const id = await addImage(t.files[0]); if (id) setFx({ type: 'img', id }); }
  else if (t.id === 'e_fx_vup' && t.files[0]) { const id = await addVideo(t.files[0]); if (id) setFx({ type: 'video', id }); }
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
  else if (t.dataset.ev) { const m = Object.assign({}, CFG.sounds || {}, { [t.dataset.ev]: t.value }); db.ref('config').update({ sounds: m, soundsOwn: m, soundPack: 'own' }).then(() => render(true)); }
  else if ((t.dataset.sk && /\.media\.url$/.test(t.dataset.sk)) || (t.dataset.bf && /media\.url$/.test(t.dataset.bf)) || (t.dataset.pf && /media\.url$/.test(t.dataset.pf))) { // ბმული → ჩამოტვირთვა და შენახვა
    const isP = !!t.dataset.pf, isB = !!t.dataset.bf || isP, k = t.dataset.pf || t.dataset.bf || t.dataset.sk, url = t.value.trim(), put = v => isP ? setPollField(k.replace(/\.url$/, ''), v) : t.dataset.bf ? setBattleField(k.replace(/\.url$/, ''), v) : setStreakField(k.replace(/\.url$/, ''), v);
    if (!url) put(null);
    else { toast('ფაილს ვტვირთავ…'); const m = await importMediaLink(url); if (m) { put(m); toast('GIF ჩამოიტვირთა და შეინახა ბიბლიოთეკაში'); } else { put({ type: 'url', url }); note('ამ ბმულიდან ფაილი ვერ ჩამოვტვირთე. ჩამოტვირთე შენ კომპიუტერში და ატვირთე ღილაკით „ატვირთვა“. (ბმულს მაინც ვინახავ, მაგრამ საღამოს შეიძლება არ გამოჩნდეს.)'); } }
    isP ? renderPolls() : isB ? renderBattles() : renderStreaks(); }
  else if (t.dataset.sk) { setStreakField(t.dataset.sk, t.type === 'checkbox' ? t.checked : t.value); if (t.tagName === 'SELECT' || t.type === 'checkbox') renderStreaks(); }
  else if (t.dataset.sksnd && t.files[0]) { const want = streakSoundName(t.dataset.sksnd); const id = await addSound(t.files[0]); if (id) { if (want) await db.ref('library/sounds/' + id + '/name').set(want); setStreakField(t.dataset.sksnd + '.sound', id); toast('ხმა აიტვირთა' + (want ? ': ' + want : '')); renderStreaks(); } }
  else if (t.dataset.pf) { setPollField(t.dataset.pf, t.type === 'checkbox' ? t.checked : t.value); if (t.tagName === 'SELECT' || t.type === 'checkbox') setTimeout(renderPolls, 50); }
  else if (t.dataset.pup && t.files[0]) { const f = t.files[0], [pid, what] = t.dataset.pup.split('|'); let v = null;
    if (what === 'sound') { const id = await addSound(f); if (id) v = id; }
    else { const isVid = f.type.startsWith('video/'); const id = isVid ? await addVideo(f) : await addImage(f); if (id) v = isVid ? { type: 'video', id, loop: true } : { type: 'img', id }; }
    if (v) { setPollField(pid + '|' + (what === 'media' ? 'win.media' : 'win.sound'), v); renderPolls(); } }
  else if (t.dataset.bf) { setBattleField(t.dataset.bf, t.type === 'checkbox' ? t.checked : t.value); if (t.tagName === 'SELECT' || t.type === 'checkbox') renderBattles(); }
  else if (t.dataset.bup && t.files[0]) { const f = t.files[0], [bid, what] = t.dataset.bup.split('|'); let v = null;
    if (what === 'video') { toast('ვიდეოს ვტვირთავ…'); const id = await addVideo(f, true); if (id) v = id; }
    else if (what === 'sound') { const id = await addSound(f); if (id) v = id; }
    else { const isVid = f.type.startsWith('video/'); const id = isVid ? await addVideo(f) : await addImage(f); if (id) v = isVid ? { type: 'video', id, loop: true } : { type: 'img', id }; }
    if (v) { setBattleField(bid + '|' + (what === 'media' ? 'win.media' : what === 'video' ? 'win.video' : 'win.sound'), v); renderBattles(); } }
  else if (t.dataset.skup && t.files[0]) { const f = t.files[0], isVid = f.type.startsWith('video/'); const id = isVid ? await addVideo(f) : await addImage(f); if (id) { setStreakField(t.dataset.skup + '.media', { type: isVid ? 'video' : 'img', id }); renderStreaks(); } }
});
// გადათრევა: კითხვების რიგის შეცვლა
let dragId = null;
document.addEventListener('dragstart', e => { const r = e.target.closest && e.target.closest('.qr[draggable]'); if (!r) return; dragId = r.dataset.id; r.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (x) {} });
document.addEventListener('dragover', e => { const r = e.target.closest && e.target.closest('.qr[draggable]'); if (!r || !dragId) return; e.preventDefault(); $$('.qr.over').forEach(x => x.classList.remove('over')); r.classList.add('over'); });
document.addEventListener('dragend', () => { dragId = null; $$('.qr.dragging,.qr.over').forEach(x => x.classList.remove('dragging', 'over')); });
// ზემოთ / ქვემოთ (ტელეფონზე, როცა გადათრევა მოუხერხებელია)
function moveQ(id, d) {
  const ids = qOf(M.selQuiz).map(q => q.id), i = ids.indexOf(id), j = i + d;
  if (i < 0 || j < 0 || j >= ids.length) return;
  ids.splice(j, 0, ids.splice(i, 1)[0]); writeOrder(ids); toast(d < 0 ? 'ზემოთ აიწია' : 'ქვემოთ ჩამოიწია');
}
// შეხებით გადათრევა: თითი გეჭიროს ⋮⋮ სახელურზე და გადაათრიე
let tDrag = null;
document.addEventListener('touchstart', e => {
  const g = e.target.closest && e.target.closest('.qr .grip'); if (!g) return;
  const r = g.closest('.qr'); tDrag = { id: r.dataset.id, over: null }; r.classList.add('dragging'); e.preventDefault();
}, { passive: false });
document.addEventListener('touchmove', e => {
  if (!tDrag) return; e.preventDefault();
  const t = e.touches[0], el = document.elementFromPoint(t.clientX, t.clientY), r = el && el.closest && el.closest('.qr[draggable]');
  $$('.qr.over').forEach(x => x.classList.remove('over')); if (r && r.dataset.id !== tDrag.id) { r.classList.add('over'); tDrag.over = r.dataset.id; } else tDrag.over = null;
  if (t.clientY < 70) window.scrollBy(0, -12); else if (t.clientY > innerHeight - 110) window.scrollBy(0, 12);
}, { passive: false });
document.addEventListener('touchend', () => {
  if (!tDrag) return; const { id, over } = tDrag; tDrag = null; $$('.qr.dragging,.qr.over').forEach(x => x.classList.remove('dragging', 'over'));
  if (!over) return; const ids = qOf(M.selQuiz).map(q => q.id), from = ids.indexOf(id), to = ids.indexOf(over);
  if (from < 0 || to < 0) return; ids.splice(to, 0, ids.splice(from, 1)[0]); writeOrder(ids);
});
document.addEventListener('drop', e => {
  const r = e.target.closest && e.target.closest('.qr[draggable]'); if (!r || !dragId) return; e.preventDefault();
  const ids = qOf(M.selQuiz).map(q => q.id), from = ids.indexOf(dragId), to = ids.indexOf(r.dataset.id);
  dragId = null; if (from < 0 || to < 0 || from === to) return;
  ids.splice(to, 0, ids.splice(from, 1)[0]); writeOrder(ids);
});
window.addEventListener('resize', () => { if (M.cur) drawPreview(); });
