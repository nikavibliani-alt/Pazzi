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
    d.innerHTML = `<div class="pop-card" role="dialog" aria-modal="true">${o.title ? `<h4>${esc(o.title)}</h4>` : ''}${o.text ? `<p>${esc(o.text)}</p>` : ''}${o.html || ''}<div class="pop-acts">${o.cancel === false ? '' : `<button class="btn quiet" data-pop="no">${esc(o.cancel || 'გაუქმება')}</button>`}<button class="btn ${o.danger ? 'danger' : 'primary'}" data-pop="ok">${esc(o.ok || 'კარგი')}</button></div></div>`;
    const done = v => {
      let out = v;
      if (v && o.html) { out = {}; d.querySelectorAll('[name]').forEach(el => { out[el.name] = el.value; }); }
      document.removeEventListener('keydown', key, true); d.remove(); res(out);
    };
    const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); } else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(true); } };
    d.addEventListener('click', e => { const b = e.target.closest('[data-pop]'); if (b) done(b.dataset.pop === 'ok'); else if (e.target === d) done(false); });
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
  m.innerHTML = items.map((it, i) => it === 'sep' ? '<hr>' : `<button class="mi ${it.danger ? 'danger' : ''}" data-mi="${i}" role="menuitem">${L(it.icon)}${esc(it.label)}</button>`).join('');
  document.body.appendChild(m); icons();
  const r = anchor.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px';
  m.style.top = (r.bottom + h + 8 > window.innerHeight ? r.top - h - 6 : r.bottom + 6) + 'px';
  m.addEventListener('click', e => { const b = e.target.closest('[data-mi]'); if (!b) return; const it = items[Number(b.dataset.mi)]; closeMenu(); it.run(); });
  setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
}
function outside(e) { const m = document.getElementById('menu'); if (m && !m.contains(e.target)) closeMenu(); }
function closeMenu() { const m = document.getElementById('menu'); if (m) m.remove(); document.removeEventListener('mousedown', outside, true); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
window.addEventListener('scroll', closeMenu, true);
