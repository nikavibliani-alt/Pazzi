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

// ფერები: ვარდისფერი + პასტელები
const TEAM_COLORS = ['#ff2e88', '#b5ecd8', '#d6cbff', '#ffe58a'];
const TEAM_TEXT = ['#fff', '#34102b', '#34102b', '#34102b'];
const OPT_COLORS = ['#ffc2dd', '#d6cbff', '#b5ecd8', '#ffeaa0', '#bfe0ff', '#ffd3b8'];
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

// ლოგო
function logoHtml(name) {
  name = name || gameName();
  const cols = ['#ff2e88', '#ff2e88', '#ffd24d', '#ff2e88', '#7fdcc0', '#ff2e88'];
  const ys = [0, -.06, .04, -.03, .05, -.05], rots = [-4, 3, -2, 4, -3, 2];
  const ch = [...name].map((c, i) => c === ' ' ? '<span style="width:.3em"></span>' : `<span class="ch" style="color:${cols[i % 6]};--y:${ys[i % 6]}em;--rot:${rots[i % 6]}deg">${esc(c)}</span>`).join('');
  return `<div class="logo">${av('khinkali', 'mas')}<span class="word">${ch}</span>${av('tomato', 'mas')}</div>`;
}

// ───────── ქულები ─────────
function scoreMap(awarded) {
  const m = {};
  for (const q in (awarded || {})) for (const p in awarded[q]) m[p] = (m[p] || 0) + 1;
  return m;
}
function ranking(players, awarded) {
  const sc = scoreMap(awarded);
  return Object.entries(players || {})
    .map(([id, p]) => Object.assign({ id }, p, { score: sc[id] || 0 }))
    .sort((a, b) => (b.score - a.score) || ((a.joined || 0) - (b.joined || 0)));
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
