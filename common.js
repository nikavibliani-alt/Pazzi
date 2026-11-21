// ფაციფუცობანა — საერთო კოდი ყველა გვერდისთვის
const CONFIG = {
  apiKey: "AIzaSyCQ3Q0ayBW6-3mJxjUtWLNmdtyepSye-fU",
  authDomain: "pazzipuzzobana.firebaseapp.com",
  databaseURL: "https://pazzipuzzobana-default-rtdb.firebaseio.com",
  projectId: "pazzipuzzobana",
  storageBucket: "pazzipuzzobana.firebasestorage.app",
  messagingSenderId: "692233928606",
  appId: "1:692233928606:web:7618bf04f80ada4851e08f"
};
firebase.initializeApp(CONFIG);
// ?ns=სახელი — ცალკე „სათამაშო ყუთი“ ტესტისთვის (რეალურ მონაცემებს არ ეხება). ჩვეულებრივ არ გამოიყენება.
const _db = firebase.database();
const NS = new URLSearchParams(location.search).get('ns');
const db = NS ? { ref: p => _db.ref(p === '.info/connected' ? p : 'ns_' + NS + (p ? '/' + p : '')) } : _db;
const TS = firebase.database.ServerValue.TIMESTAMP;

const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arr = v => Array.isArray(v) ? v.filter(x => x != null) : Object.values(v || {});

// ფერები: მუქი ფონი, ერთი ვარდისფერი აქცენტი (CSS-ში)
const TEAM_COLORS = ['#F9C9D8', '#FFE2A8', '#CDEBDD', '#E3D7FA', '#FBD0BE', '#FFFFFF'];
const TEAM_TEXT = ['#3A0F2A', '#3A0F2A', '#3A0F2A', '#3A0F2A', '#3A0F2A', '#3A0F2A'];
const OPT_COLORS = ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF'];
// გუნდების ფერები: სახელის ტეგის ფონი
const TEAM_HUES = ['#F9C9D8', '#FFE2A8', '#CDEBDD', '#E3D7FA', '#FBD0BE', '#FFFFFF'];
const ttag = (i, name) => `<span class="ttag" style="--t:${TEAM_HUES[i] || '#F9C9D8'}">${esc(name)}</span>`;
const tdot = i => `<i class="tdot" style="--t:${TEAM_HUES[i] || '#888'}"></i>`;
// თეთრი ხაზოვანი ხატულები (ემოჯის ნაცვლად)
const ICONS = {
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  cross: '<path d="M6 6l12 12M18 6L6 18"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',
  drum: '<ellipse cx="12" cy="8" rx="8" ry="3"/><path d="M4 8v8c0 1.7 3.6 3 8 3s8-1.3 8-3V8M9 4L6 1M15 4l3-3"/>'
};
const ico = n => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
const LETTERS = ['ა', 'ბ', 'გ', 'დ', 'ე', 'ვ'];
const DEFAULT_GAME_NAME = 'ფაციფუცობანა';
const DEFAULT_PIN = '5813';

// ხმის მოვლენები (ადმინში თითოეულზე ირჩევ ხმას)
const SOUND_EVENTS = [
  ['right', 'სწორი პასუხი'], ['wrong', 'არასწორი პასუხი'], ['buzz', 'ვიღაცამ დააჭირა ღილაკს'],
  ['reveal', 'კითხვის გამოაშკარავება'], ['scoreboard', 'ქულების ცხრილი'], ['podium', 'პოდიუმი'], ['loser', 'ბოლო ადგილის გამოცხადება']
];

// სასაცილო ტექსტები (ადმინში რედაქტირდება). {name} = მოთამაშის სახელი
const TEXT_KEYS = [
  ['wait_start', 'ველოდებით დაწყებას'], ['wait_others', 'ველოდებით სხვების პასუხს'], ['buzz_first', 'შენ დააჭირე პირველმა'],
  ['too_slow', 'ძალიან ნელი / სხვა იყო სწრაფი'], ['correct', 'სწორია'], ['wrong', 'არასწორია'],
  ['board_title', 'ქულების ცხრილის სათაური'], ['podium_title', 'პოდიუმის სათაური'], ['loser', 'ბოლო ადგილის გამოცხადება ({name} = სახელი)']
];
const DEFAULT_TEXTS = {
  wait_start: ['ცოტაც და დავიწყებთ! გაითბე თითები.', 'წამყვანი ჯერ წყალს სვამს. მოიცადე ცოტა.', 'ყველა იკრიბება... ზოგი ჯერ ფეხსაცმელს იცმევს.', 'ტვინი ჩართე, თამაში მალე იწყება!', 'ერთი ღრმა ამოსუნთქვა. ფაცი თუ ფუცი მალე გაირკვევა!'],
  wait_others: ['შენ უკვე მზად ხარ. დანარჩენები ჯერ ფიქრობენ... ან ვერ ფიქრობენ.', 'პასუხი გაფრინდა! ახლა სხვებს ვუცდით.', 'ჩუუ... სხვები ტვინს ძრავენ.', 'გაგზავნილია! უკან დასახევი გზა აღარ არის.', 'კარგი ამბავია: შენ უკვე გაასწარი. ახლა დაისვენე.'],
  buzz_first: ['შენ პირველი ხარ! თითი ელვასავით გაქვს.', 'პირველი შენ! ახლა ხმამაღლა თქვი, რას ფიქრობ.', 'ბრავო! ეგ თითი ოქროსია!', 'შენ დააჭირე პირველმა! გუნდს არ შეარცხვინო.'],
  too_slow: ['ამჯერად სხვა იყო უფრო სწრაფი.', 'ნელი აღმოჩნდი, მაგრამ ლამაზი.', 'ლოკოკინამაც გაგასწრო!', 'ეს კითხვა გამოგეპარა. ბოლო არ არის.', 'ერთი წამით დაგაგვიანდა... იქნებ ორით.'],
  correct: ['სწორია! გენიოსი ხარ... ან გაგიმართლა.', 'ვაიმე, ეს იცოდი?!', 'ბრავო! ტვინი დღეს ჩართულია.', 'სწორია! ახლა ნუ გაამპარტავნდები.', 'ზუსტად! აპლოდისმენტები შენს ტვინს.'],
  wrong: ['ეჰ, არა. მაგრამ თავდაჯერებულად უპასუხე!', 'არასწორია, მაგრამ ლამაზად ცდები.', 'ოხ... გუგლი ახლა ვერ გიშველის.', 'არა-არა-არა! მაგრამ ამას არავინ დაიმახსოვრებს. ალბათ.', 'ამჯერად არა! მომდევნოში გაგიმართლებს.'],
  board_title: ['ვინ დგას სათავეში?', 'ქულების ცხრილი: გული დაიჭირეთ!', 'ცხრილი არ იტყუება!', 'ვინ ჭკვიანობს და ვინ მხოლოდ ჩანს?'],
  podium_title: ['ჩემპიონების პოდიუმი!', 'ვინ ავიდა მწვერვალზე?', 'და გამარჯვებულები არიან...', 'დრამის ბგერა, თუ შეიძლება!'],
  loser: ['{name}, ბოლო ადგილი შენია! შენ ჩვენი საღამოს უდიდესი ფუცი ხარ. გვიყვარხარ!', 'ბოლო ადგილი: {name}! ნელა წასვლა შორს მიდის... ალბათ.', 'და ფუცობის ჩემპიონი ხდება {name}! სიყვარულით და აპლოდისმენტებით!', '{name}, არა უშავს! ბოლო ადგილი ყველაზე თბილია, იქ მარტო არავინ ზის.', '{name} დღეს ფუცობდა, ჩვენ კი ვტაშობდით! გვიყვარხარ.']
};

// ───────── კონფიგურაცია (ადმინში იცვლება) ─────────
let CFG = {};
function watchConfig(cb) { db.ref('config').on('value', s => { CFG = s.val() || {}; if (cb) cb(CFG); }); }
function gameName() { return CFG.gameName || DEFAULT_GAME_NAME; }
function textList(key) {
  const l = CFG.texts && CFG.texts[key] ? arr(CFG.texts[key]).filter(x => String(x).trim()) : [];
  return l.length ? l : DEFAULT_TEXTS[key];
}
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
// seed-ით არჩეული ტექსტი: ერთსა და იმავე მომენტში ერთნაირი, მომდევნოზე — სხვა
function pickText(key, seed, name) {
  const l = textList(key);
  return String(l[hashStr(String(seed) + key) % l.length]).replace(/\{name\}/g, name || '');
}

// ლოგო: სუფთა წარწერა + ერთი ვარდისფერი კითხვის ნიშანი
function logoHtml(name) {
  name = name || gameName();
  return `<div class="logo"><span class="word">${esc(name)}</span><span class="qm">?!</span></div>`;
}

// ───────── ქულები ─────────
// ქულა თითო კითხვაზე: true = 1 (ძველი ფორმატი) ან რიცხვი (შეიძლება უარყოფითიც)
function scoreMap(awarded) {
  const m = {};
  for (const q in (awarded || {})) for (const p in awarded[q]) { const v = awarded[q][p]; m[p] = Math.round(((m[p] || 0) + (v === true ? 1 : Number(v) || 0)) * 100) / 100; }
  return m;
}
const fmtPts = n => { n = Number(n) || 0; return Number.isInteger(n) ? String(n) : n.toFixed(1); };
// მხოლოდ ნამდვილი მოთამაშეები (სახელით)
function cleanPlayers(v) { const o = {}; for (const k in (v || {})) if (v[k] && v[k].name) o[k] = v[k]; return o; }
const isOnline = p => !!(p && p.conns && Object.keys(p.conns).length);
function ranking(players, awarded) {
  const sc = scoreMap(awarded);
  return Object.entries(cleanPlayers(players))
    .map(([id, p]) => Object.assign({ id }, p, { score: sc[id] || 0 }))
    .sort((a, b) => (b.score - a.score) || ((a.joined || 0) - (b.joined || 0)));
}

// ───────── წესები (ადმინში იცვლება; კითხვას შეუძლია საკუთარი) ─────────
const DEFAULT_RULES = {
  1: { award: 'all', awardN: 3, pts: 1, penalty: 0, afterWrong: 'others', sameTeamTwice: false, teamsOn: true, teamCount: 4 },
  2: { award: 'all', awardN: 3, pts: 1, penalty: 0, multi: 'exact', typed: 'manual', board: true }
};
const RULE_OPTS = {
  award: [['all', 'ყველა, ვინც სწორად უპასუხა'], ['first', 'მხოლოდ პირველი სწორი'], ['firstN', 'მხოლოდ პირველი N სწორი']],
  multi: [['exact', 'ქულა მხოლოდ ზუსტად სწორზე'], ['partial', 'ნაწილობრივი ქულა თითო სწორ არჩევანზე']],
  typed: [['manual', 'წამყვანი თვითონ ნიშნავს'], ['auto', 'ავტომატური შედარება (გამოტოვებების და ასოების ზომის გარეშე)']],
  afterWrong: [['others', 'ღილაკი იხსნება სხვა გუნდებისთვის'], ['all', 'ღილაკი იხსნება ყველასთვის, იგივე გუნდისთვისაც'], ['next', 'გადავდივართ შემდეგ კითხვაზე']],
  board: [[true, 'ჩართული'], [false, 'გამორთული']],
  sameTeamTwice: [[true, 'კი'], [false, 'არა, ჯერ სხვამ უნდა სცადოს']]
};
const optLabel = (k, v) => { const o = (RULE_OPTS[k] || []).find(x => String(x[0]) === String(v)); return o ? o[1] : String(v); };
function rulesG(g) { return Object.assign({}, DEFAULT_RULES[g], (CFG.rules || {})['g' + g] || {}); }
function rulesFor(q) { if (!q) return {}; const r = Object.assign(rulesG(q.game || 2), q.rules || {}); r.teamsOn = rulesG(1).teamsOn; return r; }
function finalRules() { return Object.assign({ places: 3, loser: true }, (CFG.rules || {}).final || {}); }
function teamCount() { const n = Number(rulesG(1).teamCount) || 4; return Math.max(2, Math.min(6, n)); }
function teamsOn() { return rulesG(1).teamsOn !== false; }
// ფინალის ნაბიჯები: ['p2','p1','p0','loser'] — ქვემოდან ზემოთ
function finalSteps() { const f = finalRules(), n = Math.max(1, Math.min(3, Number(f.places) || 3)), st = []; for (let i = n - 1; i >= 0; i--) st.push('p' + i); if (f.loser !== false) st.push('loser'); return st; }
// მოკლე აღწერა წამყვანისთვის
function rulesText(r, q) {
  const t = [`სწორზე +${fmtPts(r.pts)}`];
  if (Number(r.penalty)) t.push(`შეცდომაზე −${fmtPts(r.penalty)}`);
  if (q && q.game === 1) {
    t.push(r.afterWrong === 'next' ? 'შეცდომის შემდეგ — შემდეგი კითხვა' : r.afterWrong === 'all' ? (r.sameTeamTwice ? 'შეცდომის შემდეგ ყველას შეუძლია' : 'შეცდომის შემდეგ ყველას, ოღონდ ჯერ სხვამ') : 'შეცდომის შემდეგ — სხვა გუნდები');
    if (!r.teamsOn) t.push('ყველა თავისთვის');
  } else {
    t.push(r.award === 'first' ? 'ქულა მხოლოდ პირველ სწორს' : r.award === 'firstN' ? `ქულა პირველ ${r.awardN} სწორს` : 'ქულა ყველა სწორს');
    if (q && q.type === 'multi') t.push(r.multi === 'partial' ? 'ნაწილობრივი ქულა' : 'მხოლოდ ზუსტად სწორი');
    if (q && q.type === 'text') t.push(r.typed === 'auto' ? 'ავტომატური შემოწმება' : 'წამყვანი ნიშნავს');
    if (r.board === false) t.push('ქულების ცხრილის გარეშე');
  }
  return t.join(' · ');
}
// ბლიცი: ვინ ვერ დააჭერს ახლა (key = 't'+გუნდი ან 'p'+მოთამაშე)
function buzzBlocked(l, key) {
  if (!l || l.phase !== 'open') return true;
  const r = (l.q && l.q.rules) || {};
  if (r.afterWrong === 'all') return !r.sameTeamTwice && l.lastWrong === key;
  return !!(l.wrong && l.wrong[key]);
}
const buzzKeyOf = (l, p, pid) => ((l && l.q && l.q.rules && l.q.rules.teamsOn === false) ? 'p' + pid : 't' + p.team);
// ჩაწერითი პასუხის ავტომატური შედარება (რამდენიმე სწორი „/“-ით)
const normAns = s => String(s || '').toLowerCase().replace(/[\s.,!?'"„“”-]+/g, '');
function autoMatch(given, expected) { const g = normAns(given); return !!g && String(expected || '').split('/').some(x => normAns(x) && normAns(x) === g); }
// კითხვის ქულები წესების მიხედვით → { aw: {pid: ქულა}, right: {pid: true} }
function scoreQuestion(q, entries, r) {
  const aw = {}, right = {};
  if (!q || q.type === 'poll') return { aw, right };
  const pts = Number(r.pts) || 0, pen = Number(r.penalty) || 0, corr = arr(q.correct).map(Number);
  const sorted = entries.slice().sort((a, b) => ((a[1].t || 0) - (b[1].t || 0)));
  const good = [];
  sorted.forEach(([pid, a]) => {
    let frac = 0;
    if (q.type === 'text') frac = (a.ok === true || (a.ok === undefined && r.typed === 'auto' && autoMatch(a.a, q.answer))) ? 1 : 0;
    else if (q.type === 'multi' && r.multi === 'partial') { const mine = arr(a.a).map(Number), hit = mine.filter(i => corr.includes(i)).length, miss = mine.length - hit; frac = corr.length ? Math.max(0, (hit - miss) / corr.length) : 0; }
    else frac = isCorrectChoice(q, a.a) ? 1 : 0;
    if (frac > 0) { right[pid] = true; good.push([pid, frac]); }
    else if (pen) aw[pid] = -pen;
  });
  const lim = r.award === 'first' ? 1 : r.award === 'firstN' ? Math.max(1, Number(r.awardN) || 1) : Infinity;
  good.slice(0, lim).forEach(([pid, frac]) => { const v = Math.round(pts * frac * 100) / 100; if (v) aw[pid] = v; });
  return { aw, right };
}
function teamName(teams, i) { return (teams && teams[i] && teams[i].name) || ('გუნდი ' + (i + 1)); }
function teamScore(teams, i) { return (teams && teams[i] && teams[i].score) || 0; }
function isCorrectChoice(q, a) {
  const corr = arr(q.correct).map(Number).sort((x, y) => x - y);
  if (q.type === 'single') return a !== undefined && a !== null && corr.length === 1 && Number(a) === corr[0];
  if (q.type === 'multi') {
    const mine = arr(a).map(Number).sort((x, y) => x - y);
    return corr.length > 0 && JSON.stringify(mine) === JSON.stringify(corr);
  }
  return false;
}
function watchConnection(cb) { db.ref('.info/connected').on('value', s => cb(!!s.val())); }

// ───────── PIN-ით დაცული გვერდები (host, admin) ─────────
function gate(onOk) {
  const pinP = db.ref('config/pin').once('value').then(s => String(s.val() || DEFAULT_PIN));
  const enter = () => { $('#gate').hidden = true; $('#app').hidden = false; onOk(); };
  const go = async () => {
    const pin = await pinP;
    if ($('#pin').value === pin) { try { sessionStorage.setItem('pz_auth', pin); } catch (e) {} enter(); }
    else { $('#pinErr').textContent = 'PIN არასწორია'; $('#pin').value = ''; }
  };
  $('#pinBtn').onclick = go;
  $('#pin').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  pinP.then(pin => { let saved = null; try { saved = sessionStorage.getItem('pz_auth'); } catch (e) {} if (saved === pin) enter(); });
}
// სესიის კოდი და გუნდები, თუ ჯერ არ არსებობს
async function ensureBase() {
  const [s, t] = await Promise.all([db.ref('session').once('value'), db.ref('teams').once('value')]);
  if (!s.val() || !s.val().code) await db.ref('session').update({ code: String(Math.floor(1000 + Math.random() * 9000)), nextTeam: 0 });
  if (!t.val()) { const o = {}; for (let i = 0; i < 4; i++) o[i] = { name: 'გუნდი ' + (i + 1), score: 0 }; await db.ref('teams').set(o); }
}
function toast(msg) {
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; document.body.appendChild(d);
  setTimeout(() => d.remove(), 3200);
}
