// ფაციფუცობანა — ტვ-ის კითხვის ეკრანის ნაწილები (იყენებს ტვ და ადმინის გადახედვა)
function tvQCard(q) { return `${q && q.type === 'multi' ? `<div class="multibadge tv">${MULTI_BADGE}</div>` : ''}<div class="q pop">${esc(q.text || '…')}</div>`; }
function tvImgBox(imgHtml) { return imgHtml ? `<div class="imgbox rise">${imgHtml}</div>` : ''; }
// o: { phase, corr:[], votes:[] }
function tvOptions(q, o) {
  o = o || {};
  if (!q || q.type === 'text' || q.type === 'buzz') return '';
  const opts = arr(q.options), revealed = o.phase === 'revealed';
  return `<div class="opts stag">${opts.map((t, i) => {
    const showCt = revealed && q.type === 'poll';
    const total = (o.votes || []).reduce((a, b) => a + b, 0);
    const pct = showCt && total ? Math.round(100 * o.votes[i] / total) : 0;
    const cls = revealed && q.type !== 'poll' ? ((o.corr || []).includes(i) ? 'good' : 'dim') : '';
    return `<div class="op ${cls}" style="--c:${OPT_COLORS[i]}">${showCt ? `<div class="fill" style="width:${pct}%"></div>` : ''}<span class="lt">${LETTERS[i]}</span><span>${esc(t || '…')}</span>${showCt ? `<span class="ct">${o.votes[i]}</span>` : ''}</div>`;
  }).join('')}</div>`;
}
// ადმინის გადახედვა: ისეთივე, როგორიც ტვ-ზე გამოჩნდება
function tvPreviewHtml(q, imgHtml) {
  return `<div class="scr">${tvQCard(q)}${tvImgBox(imgHtml)}${tvOptions(q, {})}${q.type === 'buzz' && q.snd ? `<div class="sub">${ico('music')} გამოიცანი სიმღერა!</div>` : ''}</div>`;
}
