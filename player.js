// ფაციფუცობანა — მოთამაშის გვერდი (ტელეფონი)
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const S = {
  ready: { session: false, players: false, live: false },
  session: null, live: null, players: {}, teams: {}, awarded: {},
  myAns: undefined, myAnsRef: null, curQ: null,
  pid: store.get('pz_pid'),
  form: { code: new URLSearchParams(location.search).get('code') || '', name: '', avatar: null, err: '' },
  sel: [], typed: '', busy: false
};
const app = $('#app');
watchConnection(ok => $('#conn').classList.toggle('hidden', ok));

function forget() { store.del('pz_pid'); store.del('pz_code'); S.pid = null; }

db.ref('session').on('value', s => {
  S.session = s.val(); S.ready.session = true;
  if (S.pid && S.session && store.get('pz_code') && store.get('pz_code') !== String(S.session.code)) forget();
  render();
});
db.ref('players').on('value', s => {
  S.players = s.val() || {}; S.ready.players = true;
  if (S.pid && !S.players[S.pid] && !S.busy) forget();
  render();
});
db.ref('teams').on('value', s => { S.teams = s.val() || {}; render(); });
db.ref('awarded').on('value', s => { S.awarded = s.val() || {}; render(); });
db.ref('live').on('value', s => {
  const l = S.live = s.val() || {}; S.ready.live = true;
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

function me() { return S.pid ? S.players[S.pid] : null; }

// ───────── შესვლა ─────────
async function join() {
  const f = S.form;
  const code = f.code.trim(), name = f.name.trim();
  if (!S.session || code !== String(S.session.code)) { f.err = 'კოდი არასწორია 🙈'; return render(); }
  if (!name) { f.err = 'ჩაწერე სახელი ✏️'; return render(); }
  if (!f.avatar) { f.err = 'აირჩიე სურათი 🙂'; return render(); }
  if (Object.values(S.players).some(p => (p.name || '').toLowerCase() === name.toLowerCase())) {
    f.err = 'ეს სახელი უკვე დაკავებულია, სხვა აირჩიე'; return render();
  }
  S.busy = true; f.err = '';
  try {
    const r = await db.ref('session/nextTeam').transaction(n => (n || 0) + 1);
    const team = (r.snapshot.val() - 1) % 4;
    const pid = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await db.ref('players/' + pid).set({ name, avatar: f.avatar, team, joined: TS });
    store.set('pz_pid', pid); store.set('pz_code', String(S.session.code));
    S.pid = pid; if (S.curQ) bindAns();
  } catch (e) { f.err = 'ვერ შევედით, სცადე თავიდან'; }
  S.busy = false; render();
}

// ───────── Game 1: ზარი ─────────
function buzz() {
  const m = me(); if (!m) return;
  if (navigator.vibrate) navigator.vibrate(60);
  db.ref('live').transaction(l => {
    if (!l || l.mode !== 'g1' || l.phase !== 'open' || l.buzz) return; // გაუქმება
    if (l.wrongTeams && l.wrongTeams[m.team]) return;
    l.buzz = { pid: S.pid, name: m.name, avatar: m.avatar, team: m.team };
    l.phase = 'buzzed';
    return l;
  }, null, false);
}

// ───────── Game 2: პასუხი ─────────
function sendAns(a) {
  if (!S.curQ || S.myAns || !S.live || S.live.phase !== 'answering') return;
  S.myAns = { a, t: 0 }; render();
  db.ref('answers/' + S.curQ + '/' + S.pid).set({ a, t: TS }).catch(() => { S.myAns = null; render(); });
}

// ───────── გამოსახვა ─────────
let lastHtml = '';
function view(html) {
  if (html === lastHtml) return;
  const ae = document.activeElement;
  const id = ae && ae.id, val = ae && ae.value, ss = ae && ae.selectionStart;
  app.innerHTML = html; lastHtml = html;
  if (id) { const n = document.getElementById(id); if (n) { n.focus(); try { n.setSelectionRange(ss, ss); } catch (e) {} } }
}
function msg(emo, text) { return `<div class="msg"><span class="emo">${emo}</span>${text}</div>`; }

function render() {
  if (!S.ready.session || !S.ready.players || !S.ready.live) return view(msg('⏳', 'იტვირთება…'));
  const m = me();
  if (!m) return view(joinHtml());
  const l = S.live || {}, mode = l.mode || 'lobby';
  const myScore = scoreMap(S.awarded)[S.pid] || 0;
  const tc = TEAM_COLORS[m.team];
  let right = myScore, sub = '';
  if (mode === 'g1') { right = teamScore(S.teams, m.team); sub = `<small style="color:${tc}">${TEAM_EMOJI[m.team]} ${esc(teamName(S.teams, m.team))}</small>`; }
  const top = `<div class="top"><div class="av">${esc(m.avatar)}</div><div class="nm">${esc(m.name)}${sub}</div>${(mode === 'g1' || mode === 'g2') ? `<div class="sc" style="background:${mode === 'g1' ? tc : ''}">${right}</div>` : ''}</div>`;
  let body = '';
  if (mode === 'lobby') body = msg('🎈', 'მალე დავიწყებთ!<br>ეკრანს უყურე 📺');
  else if (mode === 'break') body = msg('☕🍰', 'შესვენებაა!<br>დაისვენე და ჭამე 😋');
  else if (mode === 'g1') body = g1Html(m, l);
  else if (mode === 'g2') body = g2Html(m, l);
  else if (mode === 'final') body = finalHtml();
  view(top + body);
}

function joinHtml() {
  const f = S.form;
  return `<h1>🎉 ფაციფუცობანა</h1>
  <label>თამაშის კოდი</label>
  <input id="fcode" type="tel" inputmode="numeric" maxlength="6" value="${esc(f.code)}" placeholder="0000" autocomplete="off">
  <label>შენი სახელი</label>
  <input id="fname" type="text" maxlength="14" value="${esc(f.name)}" placeholder="მაგ: ნიკა" autocomplete="off">
  <label>აირჩიე სურათი</label>
  <div class="avs">${AVATARS.map(a => `<button data-av="${a}" class="${f.avatar === a ? 'sel' : ''}">${a}</button>`).join('')}</div>
  <div class="err">${esc(f.err)}</div>
  <button class="btn pink" id="joinBtn" ${S.busy ? 'disabled' : ''}>შესვლა 🎉</button>`;
}

function g1Html(m, l) {
  if (!l.qid) return msg('👀', 'მოემზადე!<br>შემდეგ კითხვას ველოდებით');
  const t = m.team, b = l.buzz;
  if (l.phase === 'open') {
    if (l.wrongTeams && l.wrongTeams[t]) return `<button class="buzz" disabled style="font-size:30px">🙈<br>თქვენმა გუნდმა<br>უკვე სცადა</button>`;
    return `<button class="buzz" id="buzz">🔔<br>დააჭირე!</button>`;
  }
  if (b && b.pid === S.pid) {
    return `<button class="buzz won" disabled style="font-size:36px">🎉<br>შენ დააჭირე<br>პირველმა!</button>` + (l.phase === 'right' ? msg('✅', 'სწორია!') : `<div class="msg">თქვით პასუხი ხმამაღლა 🗣️</div>`);
  }
  if (b) return msg(b.avatar || '🔔', `${esc(b.name)} დააჭირა პირველმა` + (l.phase === 'right' ? '<br>✅ სწორია!' : ''));
  return msg('⏳', '…');
}

function g2Html(m, l) {
  const q = l.q;
  if (!q || !l.qid) return msg('👀', 'მოემზადე!<br>კითხვას ველოდებით');
  if (l.view === 'scoreboard') return scoreHtml();
  const opts = arr(q.options), a = S.myAns;
  const qt = `<div class="qtext">${esc(q.text)}</div>`;
  const phase = l.phase;
  if (phase === 'answering') {
    if (a) return qt + sentHtml(q, a) + `<div class="msg" style="padding:10px">✅ პასუხი გაგზავნილია<br><small>ველოდებით სხვებს…</small></div>`;
    if (q.type === 'single' || q.type === 'poll') {
      return qt + opts.map((o, i) => `<button class="opt" data-pick="${i}" style="background:${OPT_COLORS[i]}"><span class="lt">${LETTERS[i]}</span>${esc(o)}</button>`).join('');
    }
    if (q.type === 'multi') {
      return qt + `<div style="text-align:center;font-size:17px;opacity:.8">შეიძლება რამდენიმე სწორი იყოს</div>` +
        opts.map((o, i) => `<button class="opt ${S.sel.includes(i) ? 'sel' : ''}" data-tog="${i}" style="background:${OPT_COLORS[i]}"><span class="lt">${S.sel.includes(i) ? '✓' : LETTERS[i]}</span>${esc(o)}</button>`).join('') +
        `<button class="btn pink" id="sendMulti" ${S.sel.length ? '' : 'disabled'} style="margin-top:16px">გაგზავნა ✅</button>`;
    }
    if (q.type === 'text') {
      return qt + `<textarea id="typed" maxlength="80" placeholder="ჩაწერე პასუხი…">${esc(S.typed)}</textarea><button class="btn pink" id="sendText">გაგზავნა ✅</button>`;
    }
  }
  if (phase === 'locked') return qt + (a ? sentHtml(q, a) : '') + msg('🔒', 'პასუხები დაიკეტა<br><small>ველოდებით გამოაშკარავებას…</small>');
  if (phase === 'revealed') {
    const aw = S.awarded[l.qid] && S.awarded[l.qid][S.pid];
    let res;
    if (q.type === 'poll') res = msg('🗳️', 'მადლობა ხმისთვის!');
    else if (aw) res = msg('🎉', 'სწორია! +1');
    else if (!a) res = msg('😴', 'ამ კითხვაზე არ გიპასუხია');
    else res = msg('😅', 'ამჯერად არა');
    let corr = '';
    if (q.type === 'single' || q.type === 'multi') {
      const c = arr((l.reveal || {}).correct).map(Number);
      corr = `<div class="card" style="text-align:center;font-size:20px">სწორი პასუხი:<br>${c.map(i => esc(opts[i])).join(' • ')}</div>`;
    } else if (q.type === 'text' && l.reveal && l.reveal.answer) {
      corr = `<div class="card" style="text-align:center;font-size:20px">სწორი პასუხი:<br>${esc(l.reveal.answer)}</div>`;
    }
    return qt + res + corr;
  }
  return msg('⏳', '…');
}
function sentHtml(q, a) {
  const opts = arr(q.options);
  let t = '';
  if (q.type === 'text') t = esc(a.a);
  else if (q.type === 'multi') t = arr(a.a).map(i => esc(opts[i])).join(' • ');
  else t = esc(opts[a.a]);
  return `<div class="card" style="text-align:center;font-size:22px;margin:8px 0">შენი პასუხი:<br>${t}</div>`;
}
function scoreHtml() {
  const r = ranking(S.players, S.awarded);
  const idx = r.findIndex(x => x.id === S.pid);
  const list = r.slice(0, 5).map((p, i) => `<div class="row ${p.id === S.pid ? 'me' : ''}"><b>${i + 1}.</b> <span>${esc(p.avatar)}</span> <span style="flex:1">${esc(p.name)}</span> <b>${p.score}</b></div>`).join('');
  const mine = idx >= 5 ? `<div class="row me"><b>${idx + 1}.</b> <span>${esc(r[idx].avatar)}</span> <span style="flex:1">${esc(r[idx].name)}</span> <b>${r[idx].score}</b></div>` : '';
  return `<h1>🏆 ქულები</h1>${list}${mine}<div class="msg" style="font-size:20px;padding:12px">ეკრანზე ნახე სრული ცხრილი 📺</div>`;
}
function finalHtml() { return msg('🏁', 'ფინალი!<br>შეხედე ეკრანს 📺'); }

// ───────── დაჭერები ─────────
document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.av) { S.form.avatar = t.dataset.av; S.form.err = ''; render(); }
  else if (t.id === 'joinBtn') join();
  else if (t.id === 'buzz') buzz();
  else if (t.dataset.pick !== undefined) sendAns(Number(t.dataset.pick));
  else if (t.dataset.tog !== undefined) {
    const i = Number(t.dataset.tog);
    S.sel = S.sel.includes(i) ? S.sel.filter(x => x !== i) : S.sel.concat(i).sort();
    render();
  }
  else if (t.id === 'sendMulti') { if (S.sel.length) sendAns(S.sel.slice().sort()); }
  else if (t.id === 'sendText') { const v = S.typed.trim(); if (v) sendAns(v); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'fcode') S.form.code = e.target.value;
  else if (e.target.id === 'fname') S.form.name = e.target.value;
  else if (e.target.id === 'typed') S.typed = e.target.value;
});
// buzz-ზე სწრაფი რეაქცია (touchstart), ორმაგი გაშვების გარეშე
document.addEventListener('touchstart', e => {
  const t = e.target.closest('#buzz'); if (t) { e.preventDefault(); buzz(); }
}, { passive: false });
render();
