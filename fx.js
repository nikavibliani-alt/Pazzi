// ფაციფუცობანა — ჩაშენებული ეფექტები (ფაილების გარეშე) და სურათის/GIF-ის/ვიდეოს ჩვენება ეკრანზე
const FX_LIST = [['fireworks', 'ფეიერვერკი'], ['confetti', 'კონფეტის ფოიერვერკი'], ['shake', 'ეკრანის რყევა'], ['tomatoes', 'პომიდვრების წვიმა'], ['crack', 'ეკრანის გაბზარვა'], ['stamp', 'დიდი წითელი შტამპი'], ['zoomscore', 'ქულის ნელა გადიდება'], ['money', 'ფულის წვიმა'], ['trophy', 'თასის ჩამოვარდნა']];
const FX_COLORS = ['#C2185B', '#F9C9D8', '#FFE2A8', '#CDEBDD', '#E3D7FA', '#FBD0BE', '#ffffff', '#FFD15C'];

function fxLayer(cls) { const d = document.createElement('div'); d.className = 'fxlayer ' + (cls || ''); d.setAttribute('aria-hidden', 'true'); document.body.appendChild(d); return d; }
function fxEnd(layer, ms) { return new Promise(res => setTimeout(() => { layer.classList.add('fxgone'); setTimeout(() => { layer.remove(); res(); }, 380); }, ms)); }
const rnd = (a, b) => a + Math.random() * (b - a);

// ნაწილაკები canvas-ზე (ფეიერვერკი, კონფეტი)
function particles(layer, mode, ms) {
  const c = document.createElement('canvas'), x = c.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
  const W = innerWidth, H = innerHeight; c.width = W * dpr; c.height = H * dpr; c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  x.scale(dpr, dpr); layer.appendChild(c);
  const P = [], t0 = performance.now();
  const burst = (cx, cy, n, sp) => { for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), v = rnd(sp * .3, sp); P.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (mode === 'confetti' ? sp * .6 : 0), life: rnd(.8, 1.4), c: FX_COLORS[i % FX_COLORS.length], r: rnd(2, 4.5), w: rnd(6, 11), h: rnd(4, 7), rot: rnd(0, 6), vr: rnd(-.3, .3) }); } };
  if (mode === 'confetti') { burst(W / 2, H * .55, 170, Math.min(W, H) * .022); burst(W * .2, H * .7, 60, Math.min(W, H) * .018); burst(W * .8, H * .7, 60, Math.min(W, H) * .018); }
  let nextBurst = 0;
  (function frame(now) {
    const t = now - t0; x.clearRect(0, 0, W, H);
    if (mode === 'fireworks' && t < ms - 700 && t > nextBurst) { nextBurst = t + rnd(280, 480); burst(rnd(W * .15, W * .85), rnd(H * .12, H * .5), 70, Math.min(W, H) * .012); }
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i]; p.x += p.vx; p.y += p.vy; p.vy += mode === 'confetti' ? .18 : .06; p.vx *= .985; p.life -= mode === 'confetti' ? .004 : .012; p.rot += p.vr;
      if (p.life <= 0 || p.y > H + 20) { P.splice(i, 1); continue; }
      x.globalAlpha = Math.max(0, Math.min(1, p.life)); x.fillStyle = p.c;
      if (mode === 'confetti') { x.save(); x.translate(p.x, p.y); x.rotate(p.rot); x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); x.restore(); }
      else { x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fill(); }
    }
    if (t < ms) requestAnimationFrame(frame);
  })(t0);
}
const TOMATO = '<svg viewBox="0 0 40 40"><circle cx="20" cy="23" r="15" fill="#E5533D" stroke="#3A0F2A" stroke-width="2"/><path d="M20 9l-5-4 4 1 1-4 2 4 4-1-4 4z" fill="#7BBF6A" stroke="#3A0F2A" stroke-width="1.5" stroke-linejoin="round"/><ellipse cx="14" cy="18" rx="3" ry="2" fill="#fff" opacity=".5"/></svg>';
const BILL = '<svg viewBox="0 0 60 32"><rect x="1.5" y="1.5" width="57" height="29" rx="4" fill="#9ED89A" stroke="#3A0F2A" stroke-width="2"/><circle cx="30" cy="16" r="8" fill="#CDEBDD" stroke="#3A0F2A" stroke-width="1.5"/><text x="30" y="20.5" font-size="12" text-anchor="middle" font-family="sans-serif" font-weight="700" fill="#3A0F2A">₾</text></svg>';
const TROPHY = '<svg viewBox="0 0 100 110"><path d="M28 10h44v26c0 16-10 28-22 28S28 52 28 36z" fill="#FFD15C" stroke="#3A0F2A" stroke-width="3" stroke-linejoin="round"/><path d="M28 18H14c0 14 6 22 16 24M72 18h14c0 14-6 22-16 24" fill="none" stroke="#3A0F2A" stroke-width="3" stroke-linecap="round"/><path d="M44 64h12v14H44z" fill="#FFD15C" stroke="#3A0F2A" stroke-width="3"/><rect x="30" y="78" width="40" height="12" rx="3" fill="#C2185B" stroke="#3A0F2A" stroke-width="3"/><path d="M38 20q2 16 8 22" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none" opacity=".7"/></svg>';
function rain(layer, svg, n, minW, maxW) {
  layer.innerHTML = Array.from({ length: n }, () => `<span class="fxdrop" style="left:${rnd(-2, 96)}vw;width:${rnd(minW, maxW)}vmin;animation-duration:${rnd(1.6, 3)}s;animation-delay:${rnd(0, 1)}s">${svg}</span>`).join('');
}
function crack(layer) {
  const cx = rnd(35, 65), cy = rnd(35, 60); let paths = '';
  for (let i = 0; i < 9; i++) { let x = cx, y = cy, d = `M${x} ${y}`, a = (i / 9) * Math.PI * 2 + rnd(-.3, .3); for (let k = 0; k < 6; k++) { x += Math.cos(a) * rnd(6, 13); y += Math.sin(a) * rnd(6, 13); a += rnd(-.5, .5); d += ` L${x.toFixed(1)} ${y.toFixed(1)}`; } paths += `<path d="${d}"/>`; }
  layer.innerHTML = `<svg class="fxcrack" viewBox="0 0 100 100" preserveAspectRatio="none"><g fill="none" stroke="#3A0F2A" stroke-width=".9" stroke-linecap="round" stroke-linejoin="round">${paths}</g><g fill="none" stroke="#fff" stroke-width=".35" stroke-linecap="round">${paths}</g></svg>`;
}
function shakeApp() { const a = document.getElementById('app') || document.body; a.classList.remove('fxshake'); void a.offsetWidth; a.classList.add('fxshake'); setTimeout(() => a.classList.remove('fxshake'), 900); }

// ჩაშენებული ეფექტი. o = { text, score, ms }
function runFx(name, o) {
  o = o || {};
  const ms = o.ms || ({ fireworks: 3200, confetti: 2600, shake: 1400, tomatoes: 3200, crack: 2600, stamp: 2400, zoomscore: 2800, money: 3200, trophy: 2800 })[name] || 2500;
  const L = fxLayer('fx-' + name);
  if (name === 'fireworks' || name === 'confetti') particles(L, name, ms);
  else if (name === 'tomatoes') rain(L, TOMATO, 22, 7, 13);
  else if (name === 'money') rain(L, BILL, 26, 10, 18);
  else if (name === 'crack') { crack(L); shakeApp(); }
  else if (name === 'stamp') L.innerHTML = `<div class="fxstamp">${esc(o.text || 'შეცდომა!')}</div>`;
  else if (name === 'zoomscore') L.innerHTML = `<div class="fxzoom">${esc(o.score || o.text || '')}</div>`;
  else if (name === 'trophy') L.innerHTML = `<div class="fxtrophy">${TROPHY}</div>`;
  else if (name === 'shake') shakeApp();
  if (o.text && name !== 'stamp' && name !== 'zoomscore') L.insertAdjacentHTML('beforeend', `<div class="fxtext">${esc(o.text)}</div>`);
  return fxEnd(L, ms);
}

// GIF-ის ხანგრძლივობა (ერთი სრული დაკვრა) — კადრების დაყოვნებების ჯამი
async function gifDuration(src) {
  try {
    const b = new Uint8Array(await (await fetch(src)).arrayBuffer()); let t = 0;
    for (let i = 0; i < b.length - 6; i++) if (b[i] === 0x21 && b[i + 1] === 0xF9 && b[i + 2] === 0x04) { const d = b[i + 4] | (b[i + 5] << 8); t += d <= 1 ? 10 : d; }
    return t ? t * 10 : 3000;
  } catch (e) { return 3000; }
}
// სურათი / GIF / ვიდეო ეკრანის ცენტრში. dur: წამები ან 'once'
async function showMedia(m, dur, caption) {
  if (!m) return;
  let src = m.url || m.data, kind = m.kind || (m.type === 'video' || /\.(mp4|webm)(\?|$)/i.test(src || '') ? 'video' : 'img');
  if (!src && m.id) { src = (await db.ref((kind === 'video' ? 'libdata/vid/' : 'libdata/img/') + m.id).once('value')).val(); }
  if (!src) return;
  const L = fxLayer('fx-media');
  const cap = caption ? `<div class="fxcap">${esc(caption)}</div>` : '';
  if (kind === 'video') { // loop = GIF-ის მსგავსი უხმო ვიდეო; სხვა შემთხვევაში — ხმით
    L.innerHTML = `<div class="fxmediabox"><video src="${esc(src)}" autoplay playsinline ${m.loop ? 'loop muted' : ''}></video>${cap}</div>`;
    const v = L.querySelector('video'); if (m.loop) v.muted = true; v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
    let ms = dur === 'once' ? 12000 : (Number(dur) || 3) * 1000;
    if (dur === 'once') { v.loop = false; v.onended = () => { L.classList.add('fxgone'); setTimeout(() => L.remove(), 380); }; }
    return fxEnd(L, ms);
  }
  L.innerHTML = `<div class="fxmediabox"><img src="${esc(src)}" alt="">${cap}</div>`;
  const ms = dur === 'once' ? await gifDuration(src) : (Number(dur) || 2) * 1000;
  return fxEnd(L, Math.min(ms, 12000));
}
// სრულ ეკრანზე ვიდეო ხმით (ბრძოლის გამარჯვებულის ვიდეო) — ბოლომდე
async function playFullVideo(id) {
  const src = (await db.ref('libdata/vid/' + id).once('value')).val(); if (!src) return;
  const L = fxLayer('fx-fullvid');
  L.innerHTML = `<video src="${src}" autoplay playsinline></video>`;
  const v = L.querySelector('video'); v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
  return new Promise(res => { const end = () => { L.classList.add('fxgone'); setTimeout(() => { L.remove(); res(); }, 380); }; v.onended = end; setTimeout(end, 600000); });
}
// სერიის ერთი საფეხური: მედია + ეფექტი + ხმა ერთად
function playStep(step, o) {
  if (!step) return;
  o = o || {};
  if (step.sound && step.sound !== 'none' && window.SFX && SFX.ctx) SFX.preview(step.sound, 'right');
  const jobs = [];
  if (step.media && (step.media.url || step.media.id)) jobs.push(showMedia({ url: step.media.url, id: step.media.id, loop: step.media.loop, kind: step.media.kind || (step.media.type === 'video' ? 'video' : undefined) }, step.dur, o.caption));
  if (step.effect) jobs.push(runFx(step.effect, { text: step.text, score: o.score }));
  else if (step.text) jobs.push(runFx('stamp', { text: step.text, ms: 1800 }));
  return Promise.all(jobs);
}
