// ფაციფუცობანა — წამყვანისა და ადმინის საერთო ინტერფეისი: Lucide ხატულები, დადასტურების ფანჯარა, „მეტი“ მენიუ
const L = (name, cls) => `<i data-lucide="${name}" class="${cls || ''}"></i>`;
function icons() { if (window.lucide) lucide.createIcons({ attrs: { 'stroke-width': 2 } }); }
function setHTML(el, html) { if (!el) return; el.innerHTML = html; icons(); }

// პატარა ჩაშენებული ფანჯარა: popup({ title, text, ok, cancel, danger }) → Promise<true|false>
function popOpen() { return !!document.getElementById('pop'); }
function popup(o) {
  return new Promise(res => {
    const old = document.getElementById('pop'); if (old) old.remove();
    const d = document.createElement('div'); d.className = 'pop-back'; d.id = 'pop';
    d.innerHTML = `<div class="pop-card" role="dialog" aria-modal="true">${o.title ? `<h4>${esc(o.title)}</h4>` : ''}${o.text ? `<p>${esc(o.text)}</p>` : ''}${o.html || ''}<div class="pop-acts">${o.extra ? `<button class="btn quiet" data-pop="x:${esc(o.extra.value)}" style="margin-right:auto">${esc(o.extra.label)}</button>` : ''}${o.cancel === false ? '' : `<button class="btn quiet" data-pop="no">${esc(o.cancel || 'გაუქმება')}</button>`}<button class="btn ${o.danger ? 'danger' : 'primary'}" data-pop="ok">${esc(o.ok || 'კარგი')}</button></div></div>`;
    const done = v => {
      let out = v;
      if (v === true && o.html) { out = {}; d.querySelectorAll('[name]').forEach(el => { out[el.name] = el.value; }); }
      document.removeEventListener('keydown', key, true); d.remove(); res(out);
    };
    const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); } else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(true); } };
    d.addEventListener('click', e => { const b = e.target.closest('[data-pop]'); if (b) done(b.dataset.pop === 'ok' ? true : b.dataset.pop.startsWith('x:') ? b.dataset.pop.slice(2) : false); else if (e.target === d) done(false); });
    document.addEventListener('keydown', key, true);
    document.body.appendChild(d);
    setTimeout(() => { const f = d.querySelector('input, select') || d.querySelector('[data-pop=ok]'); if (f) { f.focus(); if (f.select) f.select(); } }, 0);
  });
}
const ask = (text, ok) => popup({ title: 'დარწმუნებული ხარ?', text, ok: ok || 'დიახ, წაშალე', danger: true });
const note = text => popup({ text, ok: 'კარგი', cancel: false });

// „მეტი“ მენიუ ღილაკთან: items = [{ icon, label, run, danger }] ან 'sep'
function openMenu(anchor, items) {
  closeMenu();
  const m = document.createElement('div'); m.className = 'menu'; m.id = 'menu'; m.setAttribute('role', 'menu');
  m.innerHTML = items.map((it, i) => it === 'sep' ? '<hr>' : `<button class="mi ${it.danger ? 'danger' : ''}" data-mi="${i}" role="menuitem" ${it.disabled ? 'disabled' : ''}>${L(it.icon)}${esc(it.label)}</button>`).join('');
  document.body.appendChild(m); icons();
  const r = anchor.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px';
  m.style.top = (r.bottom + h + 8 > window.innerHeight ? r.top - h - 6 : r.bottom + 6) + 'px';
  m.addEventListener('click', e => { const b = e.target.closest('[data-mi]'); if (!b || b.disabled) return; const it = items[Number(b.dataset.mi)]; closeMenu(); it.run(); });
  setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
}
function outside(e) { const m = document.getElementById('menu'); if (m && !m.contains(e.target)) closeMenu(); }
function closeMenu() { const m = document.getElementById('menu'); if (m) m.remove(); document.removeEventListener('mousedown', outside, true); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
window.addEventListener('scroll', closeMenu, true);

// ───────── „ახალი საღამოს დაწყება“: ყველაფრის განულება (კითხვები, მედია, წესები, გუნდების სახელები, PIN რჩება) ─────────
const FRESH_DEL = ['ყველა მოთამაშე (ტელეფონებმა თავიდან უნდა შემოვიდნენ)', 'ყველა ქულა და გუნდებში განაწილება', 'სერიები, პასუხები, ღილაკზე დაჭერები', 'ბრძოლების და ხმის მიცემის შედეგები', 'თამაშების პროგრესი და „საღამო აქამდე“'];
const FRESH_KEEP = 'რჩება: ქვიზები და კითხვები, სურათები, ვიდეოები, ხმები, წესები, პარამეტრები, გუნდების სახელები და PIN.';
// დაცვა შემთხვევითი დაჭერისგან: ღილაკი მუშაობს 2 წამით დაჭერილ მდგომარეობაში ან „კი“-ს ჩაწერის შემდეგ
function confirmFresh() {
  return new Promise(res => {
    const old = document.getElementById('pop'); if (old) old.remove();
    const d = document.createElement('div'); d.className = 'pop-back'; d.id = 'pop';
    d.innerHTML = `<div class="pop-card fresh-card" role="dialog" aria-modal="true"><h4>ახალი საღამოს დაწყება</h4><p><b>წაიშლება:</b></p><ul class="fresh-list">${FRESH_DEL.map(t => `<li>${esc(t)}</li>`).join('')}</ul><p class="muted">${esc(FRESH_KEEP)}</p><p class="muted">ტვ დაბრუნდება შესვლის ეკრანზე, თამაშს ახალი კოდი ექნება.</p>
      <label class="fresh-type">დასადასტურებლად ჩაწერე <b>კი</b> ან 2 წამი ხანგრძლივად დააჭირე ღილაკს<input type="text" id="freshYes" autocomplete="off" autocapitalize="off" placeholder="კი"></label>
      <div class="pop-acts"><button class="btn quiet" data-pop="no">გაუქმება</button><button class="btn danger fresh-go" id="freshGo"><span class="fresh-fill"></span><span class="fresh-lbl">დააჭირე და გეჭიროს 2 წამი</span></button></div></div>`;
    const btn = d.querySelector('#freshGo'), fill = d.querySelector('.fresh-fill'), lbl = d.querySelector('.fresh-lbl'), inp = d.querySelector('#freshYes');
    let timer = null, t0 = 0, raf = 0, closed = false;
    const done = v => { if (closed) return; closed = true; cancelHold(); document.removeEventListener('keydown', key, true); d.remove(); res(v); };
    const typedOk = () => inp.value.trim() === 'კი';
    const sync = () => { const ok = typedOk(); btn.classList.toggle('armed', ok); lbl.textContent = ok ? 'წაშლა და ახალი საღამო' : 'დააჭირე და გეჭიროს 2 წამი'; };
    const tick = () => { fill.style.width = Math.min(100, (Date.now() - t0) / 20) + '%'; raf = requestAnimationFrame(tick); };
    const startHold = e => { if (typedOk()) return; e.preventDefault(); t0 = Date.now(); tick(); timer = setTimeout(() => done(true), 2000); };
    function cancelHold() { clearTimeout(timer); timer = null; cancelAnimationFrame(raf); fill.style.width = '0'; }
    btn.addEventListener('pointerdown', startHold);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, () => { if (timer) cancelHold(); }));
    btn.addEventListener('contextmenu', e => e.preventDefault());
    btn.addEventListener('click', () => { if (typedOk()) done(true); });
    inp.addEventListener('input', sync);
    const key = e => { if (e.key === 'Escape') { e.preventDefault(); done(false); } else if (e.key === 'Enter' && typedOk()) { e.preventDefault(); done(true); } };
    d.addEventListener('click', e => { if (e.target.closest('[data-pop=no]') || e.target === d) done(false); });
    document.addEventListener('keydown', key, true);
    document.body.appendChild(d);
  });
}
async function freshEvening() {
  if (!(await confirmFresh())) return false;
  const [s, t] = await Promise.all([db.ref('session').once('value'), db.ref('teams').once('value')]);
  const oldCode = String((s.val() || {}).code || ''); let code;
  do code = String(Math.floor(1000 + Math.random() * 9000)); while (code === oldCode);
  const u = { players: null, answers: null, awarded: null, seq: null, rejoin: null, results: null, avatars: null, tstreak: null, bvotes: null, pvotes: null, yt: null, g1log: null, tvstate: null, ctl: null,
    live: { mode: 'lobby' }, session: { code, sid: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), nextTeam: 0, started: Date.now() } };
  Object.keys(t.val() || {}).forEach(i => { u['teams/' + i + '/score'] = 0; });
  await db.ref().update(u);
  return true;
}
