// ფაციფუცობანა — საერთო კოდი სამივე გვერდისთვის
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
const db = firebase.database();
const TS = firebase.database.ServerValue.TIMESTAMP;

const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arr = v => Array.isArray(v) ? v.filter(x => x != null) : Object.values(v || {});

const TEAM_COLORS = ['#ff4fa3', '#25c9a5', '#9b7bff', '#ffb11f'];
const TEAM_EMOJI = ['🌸', '🍀', '🔮', '🌞'];
const OPT_COLORS = ['#ff4fa3', '#6f95ff', '#25c9a5', '#ffb11f', '#ff8a65', '#c084fc'];
const LETTERS = ['ა', 'ბ', 'გ', 'დ', 'ე', 'ვ'];
const AVATARS = ['🐱', '🐶', '🦄', '🐼', '🦊', '🐸', '🐵', '🐰', '🐯', '🦁', '🐙', '🦋', '🐧', '🐻', '🐷', '🐨', '🦖', '🐝', '🦩', '🍓', '🍑', '🍉', '🌈', '⭐'];

// ქულების გამოთვლა: მოთამაშის ქულა = რამდენ კითხვაში არის დაწერილი "awarded"-ში
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
function teamName(teams, i) {
  return (teams && teams[i] && teams[i].name) || ('გუნდი ' + (i + 1));
}
function teamScore(teams, i) {
  return (teams && teams[i] && teams[i].score) || 0;
}
// სწორი პასუხის შემოწმება არჩევით კითხვებზე
function isCorrectChoice(q, a) {
  const corr = arr(q.correct).map(Number).sort((x, y) => x - y);
  if (q.type === 'single') return a !== undefined && a !== null && corr.length === 1 && Number(a) === corr[0];
  if (q.type === 'multi') {
    const mine = arr(a).map(Number).sort((x, y) => x - y);
    return corr.length > 0 && JSON.stringify(mine) === JSON.stringify(corr);
  }
  return false;
}
// ინტერნეტის გაწყვეტის ინდიკატორი
function watchConnection(cb) {
  db.ref('.info/connected').on('value', s => cb(!!s.val()));
}
