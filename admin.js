// ფაციფუცობანა — ადმინის გვერდი: ქვიზები, კითხვები, სურათები, ხმები, პარამეტრები
const M = { tab: 'quiz', quizzes: {}, questions: {}, images: {}, sounds: {}, teams: {}, selQuiz: null, selQ: null, cur: null, sel: new Set(), moveIds: [], loaded: {}, imgData: {} };
const view = $('#view');
const MAX_SND_MB = 3, MAX_SND_SEC = 30;
$('#gateLogo').innerHTML = logoHtml(); $('#topLogo').innerHTML = logoHtml();
gate(start);

let started = false;
function start() {
  if (started) return; started = true;
  const badge = document.createElement('span'); badge.className = 'badge'; badge.id = 'saveBadge'; badge.innerHTML = ico('check') + ' ყველაფერი შენახულია';
  $('.topbar .badge').after(badge);
  const on = (path, key) => db.ref(path).on('value', s => { M[key] = s.val() || {}; M.loaded[key] = true; onData(key); });
  on('quizzes', 'quizzes'); on('questions', 'questions'); on('library/images', 'images'); on('library/sounds', 'sounds'); on('teams', 'teams');
  watchConfig(() => { $('#topLogo').innerHTML = logoHtml(); document.title = gameName() + ' — ადმინი'; M.loaded.config = true; onData('config'); });
  $$('.tabs button').forEach(b => b.onclick = () => { M.tab = b.dataset.tab; stopPlay(); render(true); });
}

// ───────── ავტომატური შენახვა ─────────
const pending = new Map();
function queueSave(key, fn, delay) {
  clearTimeout((pending.get(key) || {}).t);
  $('#saveBadge').textContent = '… ინახება';
  const t = setTimeout(() => run(key), delay == null ? 450 : delay);
  pending.set(key, { t, fn });
}
function run(key) {
  const p = pending.get(key); if (!p) return;
  clearTimeout(p.t); pending.delete(key);
  Promise.resolve(p.fn()).then(() => { if (!pending.size) $('#saveBadge').innerHTML = ico('check') + ' ყველაფერი შენახულია'; });
}
window.addEventListener('beforeunload', () => { [...pending.keys()].forEach(run); });

// ───────── ინიციალიზაცია და განახლება ─────────
let inited = false;
function onData(key) {
  const L = M.loaded;
  if (!(L.quizzes && L.questions && L.images && L.sounds && L.teams && L.config)) return;
  if (!inited) {
    inited = true; ensureBase();
    if (!Object.keys(M.quizzes).length) { // პირველი გაშვება: ორი ცარიელი ქვიზი
      const a = db.ref('quizzes').push().key, b = db.ref('quizzes').push().key;
      db.ref().update({ ['quizzes/' + a]: { name: 'ბლიცი: პირველი ქვიზი', game: 1, created: TS }, ['quizzes/' + b]: { name: 'ფაცი თუ ფუცი: პირველი ქვიზი', game: 2, created: TS }, 'config/active/g1': a, 'config/active/g2': b });
      return;
    }
    render(true); return;
  }
  if (M.selQuiz && !M.quizzes[M.selQuiz]) { M.selQuiz = null; M.selQ = null; M.cur = null; }
  if (!M.selQuiz) { const ids = Object.keys(M.quizzes); M.selQuiz = ids[0] || null; if (M.tab === 'quiz') return render(true); }
  if (M.tab === 'quiz') { if (!$('#qz-col')) return render(true); drawQuizCol(); drawQList(); }
  else render(false);
}
function render(force) {
  if (!inited) return;
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === M.tab));
  if (!force) { const a = document.activeElement; if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT')) return; }
  if (M.tab === 'quiz') renderQuizTab();
  else if (M.tab === 'images') renderImages();
  else if (M.tab === 'sounds') renderSounds();
  else renderSettings();
}
const activeQuiz = g => (CFG.active || {})['g' + g];
const pic = a => `<span class="pic">${av(a)}</span>`;
const quizList = game => Object.entries(M.quizzes).filter(([, q]) => q.game === game).sort((a, b) => (a[1].created || 0) - (b[1].created || 0));
const qOf = qz => Object.entries(M.questions).filter(([, q]) => q.quiz === qz).map(([id, q]) => Object.assign({ id }, q)).sort((a, b) => (a.order || 0) - (b.order || 0));
const TYPE_NAMES = { buzz: 'ბლიც', single: 'ერთი სწორი', multi: 'რამდენიმე სწორი', poll: 'გამოკითხვა', text: 'ჩაწერითი' };
function qComplete(q) {
  if (!q.text) return false;
  if (q.type === 'single') return arr(q.options).length >= 2 && arr(q.options).every(o => o) && arr(q.correct).length === 1;
  if (q.type === 'multi') return arr(q.options).every(o => o) && arr(q.correct).length >= 1;
  if (q.type === 'poll') return arr(q.options).length === 2 && arr(q.options).every(o => o);
  return !!q.answer;
}

// ═════════ ქვიზები და კითხვები ═════════
function renderQuizTab() {
  view.innerHTML = `<div style="display:grid;grid-template-columns:290px minmax(0,1fr) minmax(0,1.15fr);gap:22px;align-items:start"><div id="qz-col"></div><div id="ql-col"></div><div id="ed-col"></div></div>`;
  drawQuizCol(); drawQHead(); drawEditor();
}
function drawQuizCol() {
  const grp = (g, title) => {
    const l = quizList(g);
    return `<div class="panel"><h3>${title}</h3>${l.map(([id, q]) => `<div class="qrow ${id === M.selQuiz ? 'cur' : ''}" data-qz="${id}" style="cursor:pointer"><div class="tx"><b>${esc(q.name)}</b><small>${qOf(id).length} კითხვა${activeQuiz(g) === id ? ` · ${ico('star')} დღეს საღამოს` : ''}</small></div></div>`).join('') || '<p class="hint">ქვიზი არ არის</p>'}<button class="btn sm block" data-a="newquiz" data-id="${g}" style="margin-top:10px">+ ახალი ქვიზი</button></div>`;
  };
  $('#qz-col').innerHTML = grp(1, 'თამაში 1 · ბლიცი') + grp(2, 'თამაში 2 · ფაცი თუ ფუცი');
  drawQHead(true);
}
function drawQHead(listOnly) {
  const col = $('#ql-col'); if (!col) return;
  const qz = M.quizzes[M.selQuiz];
  if (!qz) { col.innerHTML = '<div class="panel"><p>ქვიზი არ არის. დაამატე მარცხნივ.</p></div>'; return; }
  if (!$('#ql-name') || !listOnly) {
    const tonight = activeQuiz(qz.game) === M.selQuiz;
    col.innerHTML = `<div class="panel"><h3>ქვიზი</h3><label class="f" style="margin-top:0">სახელი</label><input type="text" id="ql-name" value="${esc(qz.name)}" maxlength="50">
    <div class="acts" style="margin-bottom:0"><button class="btn sm ${tonight ? 'mint' : 'primary'}" data-a="tonight" ${tonight ? 'disabled' : ''}>${tonight ? ico('star') + ' დღეს საღამოს ეს არის' : ico('star') + ' დღეს ეს გამოვიყენოთ'}</button><button class="btn sm" data-a="dupquiz">დუბლირება</button><button class="btn sm danger" data-a="delquiz">წაშლა</button></div></div>
    <div class="panel"><h3>კითხვები <span class="muted" style="text-transform:none;font-size:13px">· გადაათრიე რიგის შესაცვლელად</span></h3><button class="btn primary block" data-a="addq" style="margin-bottom:10px">+ ახალი კითხვა</button><div id="ql-list"></div></div>`;
  } else {
    // სახელის ველს ხელს არ ვუშლით, მხოლოდ ღილაკებს ვანახლებთ
    const tonight = activeQuiz(qz.game) === M.selQuiz, b = $('[data-a=tonight]');
    if (b) { b.disabled = tonight; b.className = 'btn sm ' + (tonight ? 'mint' : 'primary'); b.innerHTML = tonight ? ico('star') + ' დღეს საღამოს ეს არის' : ico('star') + ' დღეს ეს გამოვიყენოთ'; }
  }
  drawQList();
}
function drawQList() {
  const el = $('#ql-list'); if (!el) return;
  const qs = qOf(M.selQuiz);
  [...M.sel].forEach(id => { if (!qs.some(q => q.id === id)) M.sel.delete(id); });
  const bulk = M.sel.size ? `<div class="row2" style="margin:0 0 10px"><span class="statusbar" style="margin:0">მონიშნულია: ${M.sel.size}</span><button class="btn sm primary" data-a="movesel">გადატანა…</button><button class="btn sm" data-a="selclear">მონიშვნის მოხსნა</button></div>` : '';
  el.innerHTML = bulk + qs.map((x, i) => `<div class="qrow ${x.id === M.selQ ? 'cur' : ''} ${qComplete(x) ? '' : 'warn'}" draggable="true" data-id="${x.id}"><input type="checkbox" class="qsel" data-id="${x.id}" ${M.sel.has(x.id) ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--pink);flex:none"><span class="grip">⠿</span><span class="no">${i + 1}</span><div class="tx" data-a="editq" data-id="${x.id}" style="cursor:pointer"><b>${esc(x.text || '(ცარიელი კითხვა)')} ${x.img ? ico('image') : ''}${x.snd ? ico('music') : ''}</b><small>${TYPE_NAMES[x.type] || ''}${qComplete(x) ? '' : ' · არასრულია'}</small></div><button class="btn sm" data-a="moveone" data-id="${x.id}">გადატანა…</button><button class="btn sm" data-a="up" data-id="${x.id}" ${i === 0 ? 'disabled' : ''}>▲</button><button class="btn sm" data-a="down" data-id="${x.id}" ${i === qs.length - 1 ? 'disabled' : ''}>▼</button><button class="btn sm danger" data-a="delq" data-id="${x.id}">${ico('cross')}</button></div>`).join('') || '<p class="hint">ამ ქვიზში კითხვები ჯერ არ არის.</p>';
}

// ── რედაქტორი ──
function drawEditor() {
  const col = $('#ed-col'); if (!col) return;
  const c = M.cur;
  if (!c) { col.innerHTML = '<div class="panel"><p>აირჩიე კითხვა სიიდან ან დაამატე ახალი.</p></div>'; return; }
  const t = c.type, opts = arr(c.options), corr = arr(c.correct).map(Number);
  let h = `<div class="panel" id="edform"><h3>კითხვის რედაქტირება</h3>`;
  if (c.game === 2) h += `<label class="f" style="margin-top:0">ტიპი</label><select id="e_type">${['single', 'multi', 'poll', 'text'].map(k => `<option value="${k}" ${t === k ? 'selected' : ''}>${{ single: 'ერთი სწორი პასუხი (4 ვარიანტი)', multi: 'რამდენიმე სწორი პასუხი (4 ვარიანტი)', poll: 'გამოკითხვა (2 ვარიანტი, ქულის გარეშე)', text: 'ჩაწერითი პასუხი' }[k]}</option>`).join('')}</select>`;
  else h += `<div class="hint">ბლიც კითხვა: წამყვანი ხმამაღლა კითხულობს.</div>`;
  h += `<label class="f">კითხვა</label><textarea id="e_text" rows="3">${esc(c.text)}</textarea>`;
  if (t === 'single' || t === 'multi' || t === 'poll') {
    h += `<label class="f">ვარიანტები ${t === 'poll' ? '' : '(მონიშნე სწორი)'}</label>`;
    opts.forEach((o, i) => { h += `<div class="optrow">${t === 'poll' ? `<span class="lt">${LETTERS[i]}</span>` : `<input type="${t === 'single' ? 'radio' : 'checkbox'}" name="cor" class="e_cor" data-i="${i}" ${corr.includes(i) ? 'checked' : ''}>`}<input type="text" class="e_opt" value="${esc(o)}" placeholder="${LETTERS[i]} ვარიანტი"></div>`; });
  } else {
    h += `<label class="f">სწორი პასუხი ${t === 'buzz' ? '(წამყვანისთვის)' : '(ჩანს წამყვანს და ტვ-ზე გამოაშკარავებისას)'}</label><input type="text" id="e_ans" value="${esc(c.answer)}">`;
  }
  const im = c.img && M.images[c.img];
  h += `<label class="f">სურათი (ჩანს ტვ-ზე)</label><div class="row2">${im ? `<img src="${im.thumb}" style="width:96px;height:72px;object-fit:cover;border-radius:12px;border:2px solid var(--pink-l)">` : '<span class="hint">სურათი არ არის</span>'}<button class="btn sm" data-a="pickimg">ბიბლიოთეკიდან</button><label class="btn sm">ახლის ატვირთვა<input type="file" id="e_img_up" accept="image/*" hidden></label>${c.img ? '<button class="btn sm danger" data-a="rmimg">მოხსნა</button>' : ''}</div>`;
  const sn = c.snd && M.sounds[c.snd];
  const sopts = Object.entries(M.sounds);
  h += `<label class="f">ხმა (მაგ. „გამოიცანი სიმღერა“ — იკვრება ტვ-ზე, წამყვანი აჭერს ღილაკს)</label><div class="row2"><select id="e_snd"><option value="">ხმის გარეშე</option>${sopts.map(([id, s]) => `<option value="${id}" ${c.snd === id ? 'selected' : ''}>${esc(s.name)} (${Math.round(s.dur || 0)} წმ)</option>`).join('')}</select>${sn ? `<button class="btn sm" data-a="playsnd" data-id="${c.snd}">${ico('play')}</button>` : ''}<label class="btn sm">ახლის ატვირთვა<input type="file" id="e_snd_up" accept="audio/*" hidden></label></div>`;
  h += `<p class="saved" id="e_status">${ico('check')} შენახულია</p></div>`;
  h += `<div class="panel"><h3>ასე გამოჩნდება ტვ-ზე</h3><div class="tvwrap"><div class="tvframe tv" id="tvprev"></div></div></div>`;
  col.innerHTML = h;
  drawPreview();
}
async function drawPreview() {
  const box = $('#tvprev'); if (!box || !M.cur) return;
  const w = box.parentElement.clientWidth || 600;
  box.style.setProperty('--u', (w / 100) + 'px'); box.style.setProperty('--v', (w * 9 / 16 / 100) + 'px');
  box.style.fontSize = (w / 50) + 'px';
  const c = M.cur;
  let imgHtml = '';
  if (c.img) {
    if (M.imgData[c.img] === undefined) { M.imgData[c.img] = null; db.ref('libdata/img/' + c.img).once('value').then(s => { M.imgData[c.img] = s.val() || ''; drawPreview(); }); }
    imgHtml = M.imgData[c.img] ? `<img class="qimg" src="${M.imgData[c.img]}">` : '<div class="hint">სურათი იტვირთება…</div>';
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
  const d = { quiz: c.quiz, game: c.game, order: c.order, type: c.type, text: c.text || '', answer: c.answer || '', img: c.img || null, snd: c.snd || null };
  if (c.type !== 'text' && c.type !== 'buzz') { d.options = arr(c.options); const k = arr(c.correct).map(Number); if (k.length && c.type !== 'poll') d.correct = k; }
  return d;
}
function scheduleQSave() {
  const c = M.cur, id = M.selQ; if (!c || !id) return;
  const s = $('#e_status'); if (s) s.textContent = '… ინახება';
  queueSave('q:' + id, () => db.ref('questions/' + id).set(qDoc(c)).then(() => { const s2 = $('#e_status'); if (s2) s2.innerHTML = ico('check') + ' შენახულია'; }));
}
function selectQ(id) {
  if (M.selQ) run('q:' + M.selQ);
  M.selQ = id; const q = M.questions[id];
  M.cur = JSON.parse(JSON.stringify(q)); M.cur.options = arr(M.cur.options); M.cur.correct = arr(M.cur.correct);
  const n = M.cur.type === 'poll' ? 2 : (M.cur.type === 'text' || M.cur.type === 'buzz' ? 0 : 4);
  while (M.cur.options.length < n) M.cur.options.push('');
  drawEditor(); drawQList();
}
function setField(k, v) { M.cur[k] = v || null; scheduleQSave(); drawEditor(); }

// ── სურათის ამორჩევა ──
function openModal(html) { const m = document.createElement('div'); m.className = 'modal'; m.id = 'modal'; m.innerHTML = `<div class="box">${html}<div class="acts"><button class="btn" data-a="closemodal">დახურვა</button></div></div>`; document.body.appendChild(m); m.addEventListener('click', e => { if (e.target === m) m.remove(); }); }
function pickImgModal() {
  const l = Object.entries(M.images);
  openModal(`<h3 class="head" style="color:var(--pink-d);margin-bottom:12px">აირჩიე სურათი</h3>${l.length ? `<div class="libgrid">${l.map(([id, im]) => `<div class="libitem" style="cursor:pointer" data-a="useimg" data-id="${id}"><img src="${im.thumb}"><b>${esc(im.name)}</b></div>`).join('')}</div>` : '<p>ბიბლიოთეკა ცარიელია. ატვირთე სურათი „სურათები“ ჩანართში ან პირდაპირ აქ, „ახლის ატვირთვა“-თი.</p>'}`);
}

// ── მოქმედებები ──
const ACT = {
  closemodal() { $('#modal') && $('#modal').remove(); },
  newquiz(g) {
    const id = db.ref('quizzes').push().key; g = Number(g);
    const u = { ['quizzes/' + id]: { name: 'ახალი ქვიზი', game: g, created: TS } };
    if (!activeQuiz(g)) u['config/active/g' + g] = id;
    M.selQuiz = id; M.selQ = null; M.cur = null;
    db.ref().update(u).then(() => { M.selQuiz = id; renderQuizTab(); setTimeout(() => { const n = $('#ql-name'); if (n) { n.focus(); n.select(); } }, 50); });
  },
  tonight() { const g = M.quizzes[M.selQuiz].game; db.ref('config/active/g' + g).set(M.selQuiz); toast('დღეს საღამოს გამოიყენება: ' + M.quizzes[M.selQuiz].name); },
  async dupquiz() {
    const qz = M.quizzes[M.selQuiz], id = db.ref('quizzes').push().key, u = { ['quizzes/' + id]: { name: qz.name + ' (ასლი)', game: qz.game, created: TS } };
    qOf(M.selQuiz).forEach(q => { const nid = db.ref('questions').push().key; const d = qDoc(q); d.quiz = id; u['questions/' + nid] = d; });
    await db.ref().update(u); M.selQuiz = id; M.selQ = null; M.cur = null; renderQuizTab(); toast('ასლი შეიქმნა');
  },
  delquiz() {
    const qz = M.quizzes[M.selQuiz], n = qOf(M.selQuiz).length;
    if (!confirm(`წავშალო ქვიზი „${qz.name}“ და მისი ${n} კითხვა? სურათები და ხმები ბიბლიოთეკაში დარჩება. უკან დაბრუნება შეუძლებელია.`)) return;
    const u = { ['quizzes/' + M.selQuiz]: null };
    qOf(M.selQuiz).forEach(q => { u['questions/' + q.id] = null; });
    if (activeQuiz(qz.game) === M.selQuiz) u['config/active/g' + qz.game] = null;
    M.selQ = null; M.cur = null; db.ref().update(u);
  },
  addq() {
    const qz = M.quizzes[M.selQuiz]; if (!qz) return;
    const order = qOf(M.selQuiz).reduce((m, q) => Math.max(m, q.order || 0), 0) + 10;
    const id = db.ref('questions').push().key, t = qz.game === 1 ? 'buzz' : 'single';
    const q = { quiz: M.selQuiz, game: qz.game, order, type: t, text: '', answer: '' };
    if (t === 'single') q.options = ['', '', '', ''];
    M.questions[id] = q;
    db.ref('questions/' + id).set(q).then(() => { selectQ(id); setTimeout(() => { const e = $('#e_text'); if (e) e.focus(); }, 50); });
  },
  editq(id) { selectQ(id); },
  delq(id) {
    if (!confirm('წავშალო ეს კითხვა?')) return;
    if (M.selQ === id) { M.selQ = null; M.cur = null; pending.delete('q:' + id); drawEditor(); }
    db.ref('questions/' + id).remove();
  },
  up(id) { moveQ(id, -1); }, down(id) { moveQ(id, 1); },
  pickimg() { pickImgModal(); },
  useimg(id) { $('#modal').remove(); setField('img', id); },
  rmimg() { setField('img', null); },
  playsnd(id) { togglePlay(id); },
  // კითხვების გადატანა სხვა ქვიზში
  moveone(id) { M.moveIds = [id]; moveModal(); },
  movesel() { M.moveIds = qOf(M.selQuiz).map(q => q.id).filter(id => M.sel.has(id)); if (M.moveIds.length) moveModal(); },
  selclear() { M.sel.clear(); drawQList(); },
  moveto(qzid) { doMove(qzid); },
  // სურათები
  delimg(id) {
    const used = Object.values(M.questions).filter(q => q.img === id).length;
    if (!confirm(used ? `ეს სურათი გამოიყენება ${used} კითხვაში. წავშალო? ამ კითხვებიდან სურათი მოიხსნება.` : 'წავშალო ეს სურათი?')) return;
    const u = { ['library/images/' + id]: null, ['libdata/img/' + id]: null };
    Object.entries(M.questions).forEach(([qid, q]) => { if (q.img === id) u['questions/' + qid + '/img'] = null; });
    if (M.cur && M.cur.img === id) M.cur.img = null;
    db.ref().update(u);
  },
  // ხმები
  delsnd(id) {
    const used = Object.values(M.questions).filter(q => q.snd === id).length;
    const ev = Object.entries(CFG.sounds || {}).filter(([, v]) => v === id).map(([k]) => k);
    if (!confirm(used || ev.length ? `ეს ხმა გამოიყენება ${used} კითხვაში${ev.length ? ' და ' + ev.length + ' მოვლენაზე' : ''}. წავშალო? ისინი ჩაშენებულ ხმას დაუბრუნდება / მოიხსნება.` : 'წავშალო ეს ხმა?')) return;
    const u = { ['library/sounds/' + id]: null, ['libdata/snd/' + id]: null };
    Object.entries(M.questions).forEach(([qid, q]) => { if (q.snd === id) u['questions/' + qid + '/snd'] = null; });
    ev.forEach(k => { u['config/sounds/' + k] = 'default'; });
    if (M.cur && M.cur.snd === id) M.cur.snd = null;
    stopPlay(); db.ref().update(u);
  },
  play(id) { togglePlay(id); },
  testev(ev) { const sel = $(`select[data-ev="${ev}"]`); SFX.preview(sel.value, ev); },
  resettext(k) { db.ref('config/texts/' + k).remove().then(() => render(true)); },
  savepin() {
    const v = $('#s_pin').value.trim();
    if (v.length < 4) { alert('PIN-ში მინიმუმ 4 სიმბოლო უნდა იყოს.'); return; }
    db.ref('config/pin').set(v).then(() => { try { sessionStorage.setItem('pz_auth', v); } catch (e) {} toast('PIN შეიცვალა. ახალი PIN: ' + v); });
  }
};
function moveModal() {
  const n = M.moveIds.length;
  const grp = (g, title) => `<h3 style="margin:14px 0 6px;color:var(--muted);font-size:14px">${title}</h3>` + quizList(g).filter(([id]) => id !== M.selQuiz).map(([id, q]) => `<button class="btn block" style="justify-content:space-between;margin:6px 0" data-a="moveto" data-id="${id}"><span>${esc(q.name)}</span><span class="muted">${qOf(id).length} კითხვა</span></button>`).join('');
  const body = grp(1, 'თამაში 1 · ბლიცი (ხმამაღლა კითხვა)') + grp(2, 'თამაში 2 · ფაცი თუ ფუცი');
  openModal(`<h3 class="head" style="margin-bottom:4px">გადატანა: ${n} კითხვა</h3><p class="hint">კითხვა ქვიზის ბოლოში მოხვდება, მერე გადაათრიე სასურველ ადგილას.${M.moveIds.some(id => M.questions[id] && M.questions[id].game === 2) ? ' თამაში 1-ში გადატანისას სწორი პასუხი წამყვანს პასუხად გამოუჩნდება.' : ''}</p>${body}`);
}
function doMove(qzid) {
  const tz = M.quizzes[qzid]; if (!tz) return;
  let order = qOf(qzid).reduce((m, q) => Math.max(m, q.order || 0), 0);
  const u = {};
  M.moveIds.forEach(id => {
    const q = M.questions[id]; if (!q) return;
    order += 10;
    const d = { quiz: qzid, game: tz.game, order, text: q.text || '', answer: q.answer || '', img: q.img || null, snd: q.snd || null };
    const opts = arr(q.options), corr = arr(q.correct).map(Number);
    if (tz.game === 1) {            // ბლიცი: ტექსტი + წამყვანისთვის პასუხი
      d.type = 'buzz';
      if (!d.answer && corr.length) d.answer = corr.map(i => opts[i]).filter(Boolean).join(' / ');
    } else if (q.type === 'buzz') { // ბლიციდან თამაში 2-ში: ჩაწერითი კითხვა
      d.type = 'text';
    } else {
      d.type = q.type; if (opts.length) d.options = opts; if (corr.length) d.correct = corr;
    }
    Object.entries(d).forEach(([k, v]) => { u['questions/' + id + '/' + k] = v; });
    if (tz.game === 1 || q.type === 'buzz') { u['questions/' + id + '/options'] = d.options || null; u['questions/' + id + '/correct'] = d.correct || null; }
    if (M.selQ === id) { pending.delete('q:' + id); M.selQ = null; M.cur = null; }
    M.sel.delete(id);
  });
  const n = M.moveIds.length; M.moveIds = [];
  const m = $('#modal'); if (m) m.remove();
  db.ref().update(u).then(() => { toast(`${n} კითხვა გადავიდა: ${tz.name}`); drawEditor(); drawQList(); });
}
function moveQ(id, d) {
  const qs = qOf(M.selQuiz), i = qs.findIndex(x => x.id === id), j = i + d;
  if (j < 0 || j >= qs.length) return;
  const ids = qs.map(q => q.id); [ids[i], ids[j]] = [ids[j], ids[i]]; writeOrder(ids);
}
function writeOrder(ids) { const u = {}; ids.forEach((id, i) => { u['questions/' + id + '/order'] = (i + 1) * 10; if (M.questions[id]) M.questions[id].order = (i + 1) * 10; }); if (M.cur && u['questions/' + M.selQ + '/order']) M.cur.order = u['questions/' + M.selQ + '/order']; db.ref().update(u); }

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
const baseName = f => f.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'სურათი';
async function addImage(file, replaceId) {
  try {
    const { full, thumb } = await imgToJpegs(file);
    const id = replaceId || db.ref('library/images').push().key;
    await db.ref('libdata/img/' + id).set(full);
    if (replaceId) await db.ref('library/images/' + id + '/thumb').set(thumb);
    else await db.ref('library/images/' + id).set({ name: baseName(file), thumb, created: TS });
    M.imgData[id] = full;
    return id;
  } catch (e) { alert('ამ სურათს ვერ ვკითხულობ. სცადე JPG ან PNG ფორმატი.'); return null; }
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
  } catch (e) { alert(typeof e === 'string' ? e : 'ფაილის ატვირთვა ვერ მოხერხდა.'); return null; }
}

// ═════════ სურათები ═════════
function usage(field, id) { return Object.values(M.questions).filter(q => q[field] === id).length; }
function renderImages() {
  const l = Object.entries(M.images).sort((a, b) => (b[1].created || 0) - (a[1].created || 0));
  view.innerHTML = `<div class="panel"><h3>სურათების ბიბლიოთეკა</h3><div class="drop"><b>ატვირთე სურათები კომპიუტერიდან</b><p class="hint">სურათი ავტომატურად მცირდება (მაქს. 1280 პიქსელი). ერთი სურათი შეგიძლია რამდენიმე კითხვაში გამოიყენო.</p><label class="btn primary">აირჩიე ფაილები<input type="file" id="lib_img_up" accept="image/*" multiple hidden></label></div></div>
  <div class="panel"><h3>სურათები (${l.length})</h3>${l.length ? `<div class="libgrid">${l.map(([id, im]) => `<div class="libitem"><img src="${im.thumb}"><input type="text" data-imgname="${id}" value="${esc(im.name)}" maxlength="40"><span class="hint" style="margin:0">გამოიყენება ${usage('img', id)} კითხვაში</span><div class="row2"><label class="btn sm">ჩანაცვლება<input type="file" data-replimg="${id}" accept="image/*" hidden></label><button class="btn sm danger" data-a="delimg" data-id="${id}">წაშლა</button></div></div>`).join('')}</div>` : '<p class="hint">ჯერ სურათები არ არის.</p>'}</div>`;
}

// ═════════ ხმები ═════════
function renderSounds() {
  const l = Object.entries(M.sounds).sort((a, b) => (b[1].created || 0) - (a[1].created || 0));
  const sel = ev => { const cur = (CFG.sounds || {})[ev] || 'default'; return `<select data-ev="${ev}"><option value="default" ${cur === 'default' ? 'selected' : ''}>ჩაშენებული (ნაგულისხმევი)</option><option value="none" ${cur === 'none' ? 'selected' : ''}>უხმოდ</option>${l.map(([id, s]) => `<option value="${id}" ${cur === id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>`; };
  view.innerHTML = `<div class="cols"><div><div class="panel"><h3>ხმების ბიბლიოთეკა</h3><div class="drop"><b>ატვირთე შენი ხმები</b><p class="hint">თითო ფაილი: მაქსიმუმ <b>${MAX_SND_SEC} წამი</b> და <b>${MAX_SND_MB} მბ</b>. MP3 საუკეთესოა. იგივე ბიბლიოთეკიდან იღებ სიმღერის კლიპებსაც „გამოიცანი სიმღერა“ კითხვებისთვის.</p><label class="btn primary">აირჩიე ფაილები<input type="file" id="lib_snd_up" accept="audio/*" multiple hidden></label></div></div>
  <div class="panel"><h3>ხმები (${l.length})</h3>${l.map(([id, s]) => `<div class="sndrow"><button class="btn sm sky" data-a="play" data-id="${id}">${ico('play')} / ${ico('stop')}</button><input type="text" data-sndname="${id}" value="${esc(s.name)}" maxlength="40"><span class="hint" style="margin:0">${Math.round(s.dur || 0)} წმ · ${((s.size || 0) / 1048576).toFixed(2)} მბ · ${usage('snd', id)} კითხვა</span><label class="btn sm">ჩანაცვლება<input type="file" data-replsnd="${id}" accept="audio/*" hidden></label><button class="btn sm danger" data-a="delsnd" data-id="${id}">წაშლა</button></div>`).join('') || '<p class="hint">ჯერ ხმები არ არის.</p>'}</div></div>
  <div class="panel"><h3>რომელი ხმა როდის უკრავს (ტვ-ზე)</h3><p class="hint">აირჩიე ჩაშენებული ხმა, უხმოდ, ან შენი ატვირთული ხმა. „${ico('play')}“-თი მოუსმინე.</p>${SOUND_EVENTS.map(([ev, label]) => `<div class="evrow"><b>${label}</b>${sel(ev)}<button class="btn sm sky" data-a="testev" data-id="${ev}">${ico('play')}</button></div>`).join('')}</div></div>`;
}

// ═════════ პარამეტრები ═════════
function renderSettings() {
  view.innerHTML = `<div class="cols"><div><div class="panel"><h3>თამაშის სახელი</h3><input type="text" id="s_name" value="${esc(gameName())}" maxlength="30"><p class="hint">ჩანს ლოგოში ტელეფონზე და ტვ-ზე.</p></div>
  <div class="panel"><h3>გუნდების სახელები</h3>${[0, 1, 2, 3].map(i => `<div class="row2"><span style="width:26px;height:26px;border-radius:50%;background:${TEAM_COLORS[i]};flex:none"></span><input type="text" data-tname="${i}" value="${esc(teamName(M.teams, i))}" maxlength="24"></div>`).join('')}</div>
  <div class="panel"><h3>წამყვანის და ადმინის PIN</h3><div class="row2"><input type="text" id="s_pin" value="${esc(CFG.pin || DEFAULT_PIN)}" maxlength="12"><button class="btn sm primary" data-a="savepin">შენახვა</button></div><p class="hint">PIN მსუბუქი დაცვაა, რეპოზიტორია საჯაროა.</p></div></div>
  <div class="panel"><h3>სასაცილო ტექსტები</h3><p class="hint">თითო ხაზი = ერთი ვარიანტი. თამაში შემთხვევით ირჩევს. ბოლო ადგილის ტექსტში {name} ჩაანაცვლებს სახელს.</p>${TEXT_KEYS.map(([k, label]) => `<label class="f">${label}</label><textarea data-text="${k}" rows="${Math.min(7, textList(k).length + 1)}">${esc(textList(k).join('\n'))}</textarea><button class="btn sm" data-a="resettext" data-id="${k}" style="margin-top:6px">ნაგულისხმევზე დაბრუნება</button>`).join('')}</div></div>`;
}

// ───────── ღონისძიებები ─────────
document.addEventListener('click', e => {
  const q = e.target.closest('[data-qz]');
  if (q && !e.target.closest('[data-a]')) { M.selQuiz = q.dataset.qz; M.selQ = null; M.cur = null; M.sel.clear(); return renderQuizTab(); }
  const b = e.target.closest('[data-a]');
  if (b && !b.disabled && ACT[b.dataset.a]) ACT[b.dataset.a](b.dataset.id, b);
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'ql-name') queueSave('qzname', () => db.ref('quizzes/' + M.selQuiz + '/name').set(t.value || 'ქვიზი'));
  else if (t.closest && t.closest('#edform') && t.id !== 'e_img_up' && t.id !== 'e_snd_up') collect();
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
  if (t.id === 'e_type') { collect(); const c = M.cur; c.type = t.value; const n = t.value === 'poll' ? 2 : (t.value === 'text' ? 0 : 4); const o = arr(c.options).slice(0, n); while (o.length < n) o.push(''); c.options = o; c.correct = []; scheduleQSave(); drawEditor(); }
  else if (t.id === 'e_snd') setField('snd', t.value);
  else if (t.closest && t.closest('#edform') && (t.type === 'checkbox' || t.type === 'radio')) collect();
  else if (t.id === 'e_img_up' && t.files[0]) { const id = await addImage(t.files[0]); if (id) setField('img', id); }
  else if (t.id === 'e_snd_up' && t.files[0]) { const id = await addSound(t.files[0]); if (id) setField('snd', id); }
  else if (t.id === 'lib_img_up') { for (const f of t.files) await addImage(f); toast('სურათები აიტვირთა'); }
  else if (t.id === 'lib_snd_up') { for (const f of t.files) await addSound(f); toast('ხმები აიტვირთა'); }
  else if (t.dataset.replimg && t.files[0]) { await addImage(t.files[0], t.dataset.replimg); toast('სურათი ჩანაცვლდა'); render(true); }
  else if (t.dataset.replsnd && t.files[0]) { await addSound(t.files[0], t.dataset.replsnd); toast('ხმა ჩანაცვლდა'); }
  else if (t.dataset.ev) db.ref('config/sounds/' + t.dataset.ev).set(t.value);
});
// გადათრევა: კითხვების რიგის შეცვლა
let dragId = null;
document.addEventListener('dragstart', e => { const r = e.target.closest && e.target.closest('.qrow[draggable]'); if (!r) return; dragId = r.dataset.id; r.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (x) {} });
document.addEventListener('dragover', e => { const r = e.target.closest && e.target.closest('.qrow[draggable]'); if (!r || !dragId) return; e.preventDefault(); $$('.qrow.over').forEach(x => x.classList.remove('over')); r.classList.add('over'); });
document.addEventListener('dragend', () => { dragId = null; $$('.qrow.dragging,.qrow.over').forEach(x => x.classList.remove('dragging', 'over')); });
document.addEventListener('drop', e => {
  const r = e.target.closest && e.target.closest('.qrow[draggable]'); if (!r || !dragId) return; e.preventDefault();
  const ids = qOf(M.selQuiz).map(q => q.id), from = ids.indexOf(dragId), to = ids.indexOf(r.dataset.id);
  dragId = null; if (from < 0 || to < 0 || from === to) return;
  ids.splice(to, 0, ids.splice(from, 1)[0]); writeOrder(ids);
});
window.addEventListener('resize', () => { if (M.tab === 'quiz') drawPreview(); });
