// ფაციფუცობანა — მოთამაშის გვერდი (ტელეფონი)
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const S = {
  ready: { session: false, players: false, live: false, config: false },
  session: null, live: null, players: {}, teams: {}, awarded: {},
  myAns: undefined, myAnsRef: null, curQ: null,
  pid: store.get('pz_pid'),
  form: { code: new URLSearchParams(location.search).get('code') || '', name: '', avatar: null, err: '', rcode: new URLSearchParams(location.search).get('r') || '', byCode: !!new URLSearchParams(location.search).get('r') },
  sel: [], typed: '', busy: false
};
const app = $('#app');
watchConnection(ok => $('#conn').classList.toggle('hidden', ok));
watchConfig(() => { S.ready.config = true; document.title = gameName(); if (SFX.ctx) SFX.preload(CFG.sounds); render(); });

// ───────── ხმა ტელეფონზე ─────────
// პირველივე დაჭერა (შესვლა, ღილაკი, პასუხი) ხსნის ხმას; თუ ვერ ჩაირთო — პატარა ღილაკი „ხმის ჩართვა“
function unlockSound() {
  try { SFX.enable(); SFX.tone(440, 0, .03, 'sine', .001); SFX.preload(CFG.sounds); if (S.live && S.live.q) SFX.preload(S.live.q.sfx); } catch (e) {}
  setTimeout(updateSndBtn, 300);
}
function updateSndBtn() {
  const b = $('#sndBtn'); if (!b) return;
  b.hidden = !(S.pid && S.players[S.pid] && !(SFX.ctx && SFX.ctx.state === 'running'));
}
let lastPh = null; // { qid, phase } — მხოლოდ პასუხის ახალ გახსნაზე ვუკრავთ
function onLiveForSound(l) {
  const prev = lastPh; lastPh = { qid: l.qid, phase: l.phase, mode: l.mode };
  if (SFX.ctx && l.q && l.q.sfx) SFX.preload(l.q.sfx);
  if (!prev || l.mode !== 'g2' || l.qid !== prev.qid || prev.phase === 'revealed' || l.phase !== 'revealed') return;
  if (!S.pid || !l.q || l.q.type === 'poll') return;
  const right = !!(l.reveal && l.reveal.right && l.reveal.right[S.pid]);
  const partly = !!(l.reveal && l.reveal.partial && l.reveal.partial[S.pid]);
  SFX.play(partly ? 'partly' : right ? 'right' : 'wrong', l.q.sfx || null);
  if (navigator.vibrate) navigator.vibrate(partly ? [40] : right ? [90] : [60, 60, 60]);
  // ქულის ამოფრენა (ქულები ცალკე მოდის — ცოტა ვიცდით)
  setTimeout(() => { const p = Number(S.awarded[l.qid] && S.awarded[l.qid][S.pid]) || 0; if (p > 0) flyPoints(p); }, 450);
  S.streakFor = l.qid; checkStreak();
}
function flyPoints(p) { const d = document.createElement('div'); d.className = 'ptsfly'; d.textContent = '+' + fmtPts(p); document.body.appendChild(d); setTimeout(() => d.remove(), 1600); }
// სერია: ამ კითხვის შედეგი ჩაიწერა? → ეფექტი ამ მოთამაშის ტელეფონზე, პასუხის გახსნის შემდეგ
function checkStreak() {
  const qid = S.streakFor; if (!qid || !S.pid || !S.results || !S.results[qid] || S.results[qid][S.pid] === undefined) return;
  S.streakFor = null;
  const hit = streakHit(S.results, qid, S.pid);
  if (hit) setTimeout(() => playStep(hit.step, { score: '+' + fmtPts(Number(S.awarded[qid] && S.awarded[qid][S.pid]) || 0) }), 1700);
}

function forget() { store.del('pz_pid'); store.del('pz_code'); S.pid = null; }

db.ref('session').on('value', s => {
  S.session = s.val(); S.ready.session = true;
  if (S.pid && S.session && store.get('pz_code') && store.get('pz_code') !== String(S.session.code)) forget();
  render();
});
db.ref('players').on('value', s => {
  S.players = cleanPlayers(s.val()); S.ready.players = true;
  if (S.pid && !S.players[S.pid] && !S.busy) forget();
  presence();
  render();
});
db.ref('teams').on('value', s => { S.teams = s.val() || {}; render(); });
db.ref('avatars').on('value', s => { S.avatars = s.val() || {}; render(); });          // ვის რომელი პერსონაჟი უჭირავს
db.ref('library/sounds').on('value', s => { SFX.libMeta = s.val() || {}; });
db.ref('results').on('value', s => { S.results = s.val() || {}; checkStreak(); });
db.ref('awarded').on('value', s => { S.awarded = s.val() || {}; render(); });
db.ref('live').on('value', s => {
  const l = S.live = s.val() || {}; S.ready.live = true;
  if (l.mode === 'battle' && l.round !== S.bround) { // ბრძოლის ხმები — მიმდინარე რაუნდი
    if (S.bref) S.bref.off(); S.bround = l.round; S.bvotes = {};
    S.bref = db.ref('bvotes/' + l.round); S.bref.on('value', v => { S.bvotes = v.val() || {}; render(); });
  }
  onLiveForSound(l);
  if (l.qid !== S.curQ) {
    S.curQ = l.qid || null; S.sel = []; S.typed = ''; S.myAns = undefined;
    if (S.myAnsRef) S.myAnsRef.off();
    S.myAnsRef = null;
    if (S.curQ && S.pid) bindAns();
  }
  render();
});
function bindAns() {
  if (!S.curQ || !S.pid) return;
  if (S.myAnsRef) S.myAnsRef.off();
  S.myAnsRef = db.ref('answers/' + S.curQ + '/' + S.pid);
  S.myAnsRef.on('value', s => { S.myAns = s.val(); render(); });
}
// პერსონაჟის საკეტი: { pid, t } (ძველი ფორმატი — უბრალოდ pid)
const lockOwner = v => (v && typeof v === 'object' ? v.pid : v) || null;
function me() { return S.pid ? S.players[S.pid] : null; }

// ონლაინ / ოფლაინ: თითო გახსნილ ტელეფონზე ერთი ჩანაწერი, გათიშვისას თავისით იშლება
let presRef = null, presPid = null;
function presence() {
  const want = S.pid && S.players[S.pid] ? S.pid : null;
  if (want === presPid) return;
  if (presRef) { presRef.onDisconnect().cancel(); presRef.remove(); presRef = null; }
  presPid = want;
  if (want) { presRef = db.ref('players/' + want + '/conns').push(); presRef.onDisconnect().remove(); presRef.set(true); }
}
watchConnection(ok => { if (ok && presRef && presPid && S.players[presPid]) { presRef.onDisconnect().remove(); presRef.set(true); } });

// ───────── შესვლა ─────────
async function join() {
  const f = S.form;
  const code = f.code.trim(), name = f.name.trim();
  if (!S.session || code !== String(S.session.code)) { f.err = 'კოდი არასწორია'; return render(); }
  if (!name) { f.err = 'ჩაწერე სახელი'; return render(); }
  // იგივე სახელი უკვე თამაშშია → ალბათ ის თვითონ არის (გადატვირთვა, სხვა ტელეფონი…)
  const ex = Object.entries(S.players).find(([, p]) => (p.name || '').trim().toLowerCase() === name.toLowerCase());
  if (ex) { f.match = ex[0]; f.err = ''; return render(); }
  if (!f.avatar) { f.err = 'აირჩიე პერსონაჟი'; return render(); }
  if (!f.agree) { f.err = 'ჯერ მონიშნე „ხელს ვაწერ“'; return render(); }
  S.busy = true; f.err = '';
  try {
    const pid = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    // პერსონაჟს ბაზა აძლევს მხოლოდ ერთს — ორი ტელეფონი ერთდროულად ვერ აიღებს
    const lock = await db.ref('avatars/' + f.avatar).transaction(cur => { const o = lockOwner(cur); return (o && o !== pid && (S.players[o] || Date.now() - ((cur && cur.t) || 0) < 60000)) ? undefined : { pid, t: Date.now() }; });
    if (!lock.committed) { f.err = 'ეს პერსონაჟი უკვე დაკავებულია, აირჩიე სხვა'; f.avatar = null; S.busy = false; return render(); }
    const team = null; // გუნდებს წამყვანი ანაწილებს
    await db.ref('players/' + pid).set({ name, avatar: f.avatar, team, joined: TS });
    store.set('pz_pid', pid); store.set('pz_code', String(S.session.code));
    S.pid = pid; if (S.curQ) bindAns();
  } catch (e) { f.err = 'შესვლა ვერ მოხერხდა, სცადე თავიდან'; }
  S.busy = false; presence(); render(); updateSndBtn();
}
// წამყვანის მიცემული 4-ციფრიანი კოდით დაბრუნება
async function rejoinByCode() {
  const f = S.form, code = String(f.rcode || '').trim();
  if (!S.session || String(f.code).trim() !== String(S.session.code)) { f.err = 'თამაშის კოდი არასწორია'; return render(); }
  if (!/^\d{4}$/.test(code)) { f.err = 'ჩაწერე წამყვანისგან მიღებული 4-ციფრიანი კოდი'; return render(); }
  const pid = (await db.ref('rejoin/' + code).once('value')).val();
  if (!pid || !S.players[pid]) { f.err = 'ეს კოდი არ მუშაობს. სთხოვე წამყვანს ახალი.'; return render(); }
  store.set('pz_pid', pid); store.set('pz_code', String(S.session.code));
  S.pid = pid; f.err = ''; f.byCode = false; if (S.curQ) bindAns(); presence(); render(); updateSndBtn();
}
function rejoin(yes) {
  const f = S.form, pid = f.match; f.match = null;
  if (yes && pid && S.players[pid]) {
    store.set('pz_pid', pid); store.set('pz_code', String(S.session.code));
    S.pid = pid; if (S.curQ) bindAns(); presence();
  } else { f.name = ''; f.err = 'აირჩიე სხვა სახელი'; }
  render();
}

// ───────── თამაში 1: ზარი ─────────
function buzz() {
  const m = me(); if (!m) return;
  if (navigator.vibrate) navigator.vibrate(60);
  db.ref('live').transaction(l => {
    if (!l || l.mode !== 'g1' || l.phase !== 'open' || l.buzz) return; // გაუქმება
    if (teamsOn() && m.team == null) return;
    const key = buzzKeyOf(l, m, S.pid);
    if (buzzBlocked(l, key)) return;
    if (l.lastWrong && l.lastWrong !== key) l.lastWrong = null;
    l.buzz = { pid: S.pid, name: m.name, avatar: m.avatar, team: m.team, key };
    l.phase = 'buzzed';
    return l;
  }, null, false);
}

// ───────── თამაში 2: პასუხი ─────────
// პასუხს ბაზა ანიჭებს რიგით ნომერს (seq) — ასე ორი ტელეფონი ვერ იქნება ერთად პირველი
async function sendAns(a) {
  if (!S.curQ || S.myAns || !S.live || S.live.phase !== 'answering') return;
  const qid = S.curQ;
  S.myAns = { a, t: 0 }; render();
  const ref = db.ref('answers/' + qid + '/' + S.pid);
  try { await ref.set({ a, t: TS }); } catch (e) { S.myAns = null; render(); return; }  // პასუხი მაშინვე ჩანს წამყვანთან
  try { const r = await db.ref('seq/' + qid).transaction(n => (n || 0) + 1); if (r.committed) await ref.child('seq').set(r.snapshot.val()); } catch (e) {}
}

// ───────── გამოსახვა ─────────
let lastHtml = '', lastKey = '';
function view(html, key) {
  if (html === lastHtml) return;
  const ae = document.activeElement;
  const id = ae && ae.id, ss = ae && ae.selectionStart;
  const kind = key && lastKey && key !== lastKey ? (key.split('|')[0] !== lastKey.split('|')[0] || key.split('|')[1] !== lastKey.split('|')[1] ? 'slide' : 'fade') : null;
  swapScreen(app, html, kind); lastHtml = html; if (key) lastKey = key;
  fitJoin();
  if (id) { const n = document.getElementById(id); if (n) { n.focus(); try { n.setSelectionRange(ss, ss); } catch (e) {} } }
}
function msg(avatar, text, small) { return `<div class="msg pop"><div class="pic">${av(avatar)}</div>${esc(text)}${small ? `<small>${esc(small)}</small>` : ''}</div>`; }

function render() {
  const R = S.ready;
  if (!R.session || !R.players || !R.live || !R.config) return view(`${logoHtml()}<div class="msg">…</div>`);
  const m = me();
  if (!m) return view(joinHtml());
  const l = S.live || {}, mode = l.mode || 'lobby';
  const myScore = scoreMap(S.awarded)[S.pid] || 0;
  const t = m.team, tOn = teamsOn();
  let score = myScore, sub = '';
  if (tOn && mode === 'g1' && t != null) sub = `<small>${ttag(t, teamName(S.teams, t))}</small>`; // გუნდები მხოლოდ თამაშ 1-ში
  const teamPts = mode === 'g1' && tOn;
  if (teamPts) score = teamScore(S.teams, t);
  const sc = (mode === 'g1' || mode === 'g2') ? `<div class="sc" ${teamPts ? `style="background:${TEAM_COLORS[t]};color:${TEAM_TEXT[t]}"` : ''}>${fmtPts(score)}<small>ქულა</small></div>` : '';
  const top = `<div class="top" style="--t:${TEAM_HUES[t]}"><div class="pic">${av(m.avatar)}</div><div class="nm">${esc(m.name)}${sub}</div>${sc}</div>`;
  let body = '';
  if (mode === 'lobby') body = msg(m.avatar, pickText('wait_start', S.pid + 'lobby'));
  else if (mode === 'break') body = msg(m.avatar, 'შესვენებაა!', 'დაისვენე და წაიხემსე.');
  else if (mode === 'g1') body = g1Html(m, l);
  else if (mode === 'g2') body = g2Html(m, l);
  else if (mode === 'final') body = msg(m.avatar, 'ფინალი! შეხედე ეკრანს.');
  else if (mode === 'battle') body = battleHtml(m, l);
  view(top + body, [mode, l.qid || '', l.phase || '', l.view || ''].join('|'));
  updateSndBtn();
}

// უკვე თამაშშია ეს სახელი? (დაბრუნებას „ხელმოწერა“ აღარ სჭირდება)
function nameTaken() { const n = (S.form.name || '').trim().toLowerCase(); return !!n && Object.values(S.players).some(p => (p.name || '').trim().toLowerCase() === n); }
// პერსონაჟების არე ზუსტად ჩაეტიოს ხილულ ეკრანზე (Safari-ს ზოლების ჩათვლით)
function fitJoin() {
  const g = document.getElementById('avs'), jb = document.querySelector('.joinbar'); if (!g || !jb) return;
  const vh = window.visualViewport ? visualViewport.height : innerHeight;
  g.style.maxHeight = '420px';                       // ვზომავთ დანარჩენის სიმაღლეს, მერე ბადე ავსებს დარჩენილ ადგილს
  const rest = document.documentElement.scrollHeight - g.offsetHeight;
  g.style.maxHeight = Math.max(110, Math.min(420, Math.floor(vh - rest - 2))) + 'px';
}
if (window.visualViewport) visualViewport.addEventListener('resize', fitJoin);
addEventListener('resize', fitJoin);
function joinHtml() {
  const f = S.form;
  const mp = f.match && S.players[f.match];
  if (mp) return `${logoHtml()}<div class="card join-card pop" style="text-align:center"><div class="msg" style="padding:6px 0 12px">ეს შენ ხარ?</div><div class="pic" style="width:110px;height:110px;margin:0 auto 12px">${av(mp.avatar)}</div><div style="font-size:24px;font-weight:800">${esc(mp.name)}</div><div class="muted" style="margin:4px 0 6px">${fmtPts(scoreMap(S.awarded)[f.match] || 0)} ქულა</div><button class="btn primary block lg" id="rejoinYes">კი, მე ვარ</button><button class="btn block" id="rejoinNo" style="margin-top:10px">არა, სხვა სახელს ავირჩევ</button></div>`;
  if (f.byCode) return `${logoHtml()}<div class="card join-card pop">
  <div class="msg" style="padding:0 0 6px;font-size:22px">უკვე ვთამაშობდი</div>
  <label class="f">თამაშის კოდი</label>
  <input id="fcode" type="tel" inputmode="numeric" maxlength="6" value="${esc(f.code)}" placeholder="0000" autocomplete="off">
  <label class="f">შენი პირადი კოდი (წამყვანისგან)</label>
  <input id="frcode" type="tel" inputmode="numeric" maxlength="4" value="${esc(f.rcode)}" placeholder="0000" autocomplete="off">
  <div class="err">${esc(f.err)}</div>
  <button class="btn primary block lg" id="rcodeBtn">გაგრძელება</button>
  <button class="btn block" id="rcodeBack" style="margin-top:10px">უკან</button></div>`;
  return `${logoHtml()}<div class="card join-card pop">
  <p class="hint join-hint">${ico('sound')}ჩართე ხმა და გამორთე უხმო რეჟიმი</p>
  <div class="jrow"><div><label class="f" for="fcode">კოდი</label><input id="fcode" type="tel" inputmode="numeric" maxlength="6" value="${esc(f.code)}" placeholder="0000" autocomplete="off"></div>
  <div><label class="f" for="fname">შენი სახელი</label><input id="fname" type="text" maxlength="14" value="${esc(f.name)}" placeholder="მაგ: ნიკა" autocomplete="off"></div></div>
  <label class="f">აირჩიე პერსონაჟი</label>
  <div class="avs" id="avs">${AVATAR_IDS.map(a => { const o = lockOwner((S.avatars || {})[a]), owner = o && S.players[o]; return owner ? `<button class="taken" disabled aria-label="დაკავებულია">${av(a)}<span class="avn">${esc(owner.name)}</span></button>` : `<button data-av="${a}" class="${f.avatar === a ? 'sel' : ''}" aria-label="პერსონაჟი">${av(a)}</button>`; }).join('')}</div>
  <div class="err">${esc(f.err)}</div>
  <div class="joinbar"><label class="agree"><input type="checkbox" id="agree" ${f.agree ? 'checked' : ''}><span>${esc(agreeText())}</span></label><button class="btn primary block lg" id="joinBtn" ${S.busy || !(f.agree || nameTaken()) ? 'disabled' : ''}>${nameTaken() ? 'გაგრძელება' : 'შესვლა'}</button>
  <button class="btn block quietlink" id="rcodeOpen">უკვე ვთამაშობდი</button></div></div>`;
}

// ბრძოლა: გამომსვლელები ვერ აძლევენ ხმას; დანარჩენები ირჩევენ ერთს (შეცვლა შეიძლება დახურვამდე)
function battleHtml(m, l) {
  const perf = l.perf || {}, ids = Object.keys(perf).filter(id => S.players[id]);
  if (perf[S.pid]) return msg(m.avatar, 'შენ გამოდიხარ, წარმატებები!');
  if (l.phase === 'result') { const w = battleCount(perf, S.bvotes).winners.filter(id => S.players[id]); return w.length ? msg(S.players[w[0]].avatar, (w.length > 1 ? 'გამარჯვებულები: ' : 'გამარჯვებული: ') + w.map(id => S.players[id].name).join(' და '), 'შეხედე ეკრანს!') : msg(m.avatar, 'ხმები არ არის'); }
  const my = (S.bvotes || {})[S.pid];
  if (l.phase !== 'voting') return msg(m.avatar, 'ხმის მიცემა დასრულდა', my && S.players[my] ? 'შენ ხმა მიეცი: ' + S.players[my].name : '');
  return `<div class="qtext">ვის აძლევ ხმას?</div>` + ids.map(id => `<button class="opt votebtn ${my === id ? 'sel' : ''}" data-vote="${id}"><span class="pic">${av(S.players[id].avatar)}</span><span>${esc(S.players[id].name)}</span></button>`).join('') + `<div class="msg" style="padding:8px 0"><small>${my ? 'ხმა მიცემულია. შეგიძლია შეცვალო, სანამ დაიხურება.' : 'ერთი ხმა გაქვს.'}</small></div>`;
}
function vote(pid) {
  const l = S.live || {}; if (l.mode !== 'battle' || l.phase !== 'voting' || (l.perf || {})[S.pid] || !(l.perf || {})[pid]) return;
  S.bvotes = Object.assign({}, S.bvotes, { [S.pid]: pid }); render();
  db.ref('bvotes/' + l.round + '/' + S.pid).set(pid).then(() => battleAutoLock(S.players, l.perf, S.bvotes));
}
function g1Html(m, l) {
  if (teamsOn() && (m.team == null || m.team >= teamCount())) return msg(m.avatar, 'დაელოდე გუნდში გადანაწილებას', 'წამყვანი მალე გაგანაწილებთ გუნდებში.');
  if (!l.qid) return (teamsOn() ? `<div class="teamhello" style="--t:${TEAM_HUES[m.team]}">შენი გუნდი<b>${esc(teamName(S.teams, m.team))}</b></div>` : '') + msg(m.avatar, pickText('wait_start', S.pid + 'g1'));
  const b = l.buzz, seed = l.qid + S.pid, key = buzzKeyOf(l, m, S.pid), solo = key[0] === 'p';
  if (l.phase === 'open') {
    if (buzzBlocked(l, key)) return `<button class="buzz" disabled>${esc(pickText('wrong', seed))}</button><div class="msg"><small>${solo ? 'შენ უკვე სცადე' : 'თქვენმა გუნდმა უკვე სცადა'}. ახლა სხვების ჯერია.</small></div>`;
    return `<button class="buzz" id="buzz">დააჭირე!</button>`;
  }
  if (l.phase === 'missed') return msg(m.avatar, pickText('wrong', seed), 'ამ კითხვაზე ღილაკი დაიკეტა. ველოდებით შემდეგს.');
  if (b && b.pid === S.pid) {
    return `<button class="buzz won" disabled>${esc(pickText('buzz_first', seed))}</button>` + (l.phase === 'right' ? msg(m.avatar, pickText('correct', seed)) : `<div class="msg"><small>თქვი პასუხი ხმამაღლა!</small></div>`);
  }
  if (b) return msg(b.avatar, `${b.name} დააჭირა პირველმა`, l.phase === 'right' ? pickText('correct', seed) : pickText('too_slow', seed));
  return msg(m.avatar, '…');
}

function g2Html(m, l) {
  const q = l.q;
  if (!q || !l.qid) return msg(m.avatar, pickText('wait_start', S.pid + 'g2'));
  if (l.view === 'scoreboard') return scoreHtml(l);
  const opts = arr(q.options), a = S.myAns, seed = l.qid + S.pid;
  const qt = `<div class="qtext">${esc(q.text)}</div>`;
  const phase = l.phase;
  if (phase === 'answering') {
    if (a) return qt + sentHtml(q, a) + msg(m.avatar, pickText('wait_others', seed));
    if (q.type === 'single' || q.type === 'poll') {
      return qt + opts.map((o, i) => `<button class="opt" data-pick="${i}" style="--c:${OPT_COLORS[i]}"><span class="lt">${LETTERS[i]}</span>${esc(o)}</button>`).join('');
    }
    if (q.type === 'multi') {
      return qt + `<div class="msg" style="padding:0 0 4px"><small>ერთზე მეტი პასუხია სწორი</small></div>` +
        opts.map((o, i) => `<button class="opt ${S.sel.includes(i) ? 'sel' : ''}" data-tog="${i}" style="--c:${OPT_COLORS[i]}"><span class="lt">${S.sel.includes(i) ? ico('check') : LETTERS[i]}</span>${esc(o)}</button>`).join('') +
        `<button class="btn primary block lg" id="sendMulti" ${S.sel.length ? '' : 'disabled'} style="margin-top:18px">გაგზავნა</button>`;
    }
    if (q.type === 'text') {
      return qt + `<textarea id="typed" maxlength="80" placeholder="ჩაწერე პასუხი…">${esc(S.typed)}</textarea><button class="btn primary block lg" id="sendText">გაგზავნა</button>`;
    }
  }
  if (phase === 'locked') return qt + (a ? sentHtml(q, a) + msg(m.avatar, 'პასუხები დაიკეტა', 'ველოდებით სწორ პასუხს…') : msg(m.avatar, pickText('too_slow', seed), 'პასუხები დაიკეტა'));
  if (phase === 'revealed') {
    const pts = Number(S.awarded[l.qid] && S.awarded[l.qid][S.pid]) || 0;
    const right = !!(l.reveal && l.reveal.right && l.reveal.right[S.pid]);
    const partly = !!(l.reveal && l.reveal.partial && l.reveal.partial[S.pid]);
    if (partly && a) { // ნაწილობრივ სწორი: არა „არასწორი“ — თითო არჩევანი ✓ / ✗ და გამოტოვებული „სწორი იყო“
      const c = arr((l.reveal || {}).correct).map(Number), mine = arr(a.a).map(Number);
      const rows = opts.map((o, i) => { const p = mine.includes(i), ok = c.includes(i); if (!p && !ok) return ''; return `<div class="pick ${p ? (ok ? 'ok' : 'no') : 'miss'}"><span class="mk">${p ? (ok ? '✓' : '✗') : LETTERS[i]}</span><span>${esc(o)}</span>${!p ? '<span class="miss-l">სწორი იყო</span>' : ''}</div>`; }).join('');
      return qt + msg(m.avatar, 'ნაწილობრივ სწორია!', `+${fmtPts(pts)} ქულა`) + `<div class="picks">${rows}</div>`;
    }
    let res;
    if (q.type === 'poll') res = msg(m.avatar, 'მადლობა ხმისთვის!');
    else if (right && pts > 0) res = msg(m.avatar, pickText('correct', seed), `+${fmtPts(pts)} ქულა`);
    else if (right) res = msg(m.avatar, pickText('correct', seed), 'სწორია, მაგრამ ქულები უფრო სწრაფებს ერგოთ.');
    else if (!a) res = msg(m.avatar, pickText('too_slow', seed));
    else res = msg(m.avatar, pickText('wrong', seed), pts < 0 ? `−${fmtPts(-pts)} ქულა` : '');
    let corr = '';
    if (q.type === 'single' || q.type === 'multi') {
      const c = arr((l.reveal || {}).correct).map(Number);
      corr = `<div class="card" style="text-align:center;font-weight:800">სწორი პასუხი:<br>${c.map(i => esc(opts[i])).join(' • ')}</div>`;
    } else if (q.type === 'text' && l.reveal && l.reveal.answer) {
      corr = `<div class="card" style="text-align:center;font-weight:800">სწორი პასუხი:<br>${esc(l.reveal.answer)}</div>`;
    }
    return qt + res + corr;
  }
  return msg(m.avatar, '…');
}
function sentHtml(q, a) {
  const opts = arr(q.options);
  let t = '';
  if (q.type === 'text') t = esc(a.a);
  else if (q.type === 'multi') t = arr(a.a).map(i => esc(opts[i])).join(' • ');
  else t = esc(opts[a.a]);
  return `<div class="card" style="text-align:center;font-weight:800;margin:8px 0">შენი პასუხი:<br>${t}</div>`;
}
function scoreHtml(l) {
  const r = ranking(S.players, S.awarded);
  const idx = r.findIndex(x => x.id === S.pid);
  const row = (p, i) => `<div class="row ${p.id === S.pid ? 'me' : ''}"><span>${i + 1}.</span><span class="pic">${av(p.avatar)}</span><span style="flex:1">${esc(p.name)}</span><b>${fmtPts(p.score)} <small style="font-weight:400">ქულა</small></b></div>`;
  const mine = idx >= 5 ? row(r[idx], idx) : '';
  return `<div class="title head">${esc(pickText('board_title', l.qid))}</div>${r.slice(0, 5).map(row).join('')}${mine}<div class="msg"><small>სრული ცხრილი ტვ-ზეა</small></div>`;
}

// ───────── დაჭერები ─────────
document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (!SFX.ctx || SFX.ctx.state !== 'running') unlockSound();
  if (t.id === 'sndBtn') return;
  if (t.id === 'rcodeOpen') { S.form.byCode = true; S.form.err = ''; return render(); }
  if (t.id === 'rcodeBack') { S.form.byCode = false; S.form.err = ''; return render(); }
  if (t.id === 'rcodeBtn') return rejoinByCode();
  if (t.dataset.av) { const o = lockOwner((S.avatars || {})[t.dataset.av]); if (o && S.players[o] && o !== S.pid) return; S.form.avatar = t.dataset.av; S.form.err = ''; render(); }
  else if (t.id === 'joinBtn') join();
  else if (t.id === 'rejoinYes') rejoin(true);
  else if (t.id === 'rejoinNo') rejoin(false);
  else if (t.id === 'buzz') buzz();
  else if (t.dataset.vote) vote(t.dataset.vote);
  else if (t.dataset.pick !== undefined) sendAns(Number(t.dataset.pick));
  else if (t.dataset.tog !== undefined) {
    const i = Number(t.dataset.tog);
    S.sel = S.sel.includes(i) ? S.sel.filter(x => x !== i) : S.sel.concat(i).sort();
    render();
  }
  else if (t.id === 'sendMulti') { if (S.sel.length) sendAns(S.sel.slice().sort()); }
  else if (t.id === 'sendText') { const v = S.typed.trim(); if (v) sendAns(v); }
});
document.addEventListener('change', e => { if (e.target.id === 'agree') { S.form.agree = e.target.checked; S.form.err = ''; render(); } });
document.addEventListener('input', e => {
  if (e.target.id === 'fcode') S.form.code = e.target.value;
  else if (e.target.id === 'fname') { S.form.name = e.target.value; render(); }
  else if (e.target.id === 'typed') S.typed = e.target.value;
  else if (e.target.id === 'frcode') S.form.rcode = e.target.value;
});
// კლავიატურის გახსნისას ველი და „გაგზავნა“ ჩანდეს
document.addEventListener('focusin', e => { if (e.target.id === 'typed') setTimeout(() => { const b = $('#sendText'); (b || e.target).scrollIntoView({ block: 'end', behavior: 'smooth' }); }, 350); });
if (window.visualViewport) visualViewport.addEventListener('resize', () => { const a = document.activeElement; if (a && a.id === 'typed') { const b = $('#sendText'); if (b) b.scrollIntoView({ block: 'end' }); } });
document.addEventListener('touchstart', e => {
  const t = e.target.closest('#buzz'); if (t) { e.preventDefault(); if (!SFX.ctx || SFX.ctx.state !== 'running') unlockSound(); buzz(); }
}, { passive: false });
render();
