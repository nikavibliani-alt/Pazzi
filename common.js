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
const TEAM_COLORS = ['#F9C9D8', '#FFE2A8', '#CDEBDD', '#E3D7FA'];
const TEAM_TEXT = ['#3A0F2A', '#3A0F2A', '#3A0F2A', '#3A0F2A'];
const OPT_COLORS = ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF'];
// გუნდების ფერები: სახელის ტეგის ფონი
const TEAM_HUES = ['#F9C9D8', '#FFE2A8', '#CDEBDD', '#E3D7FA'];
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
