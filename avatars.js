// ფაციფუცობანა — 27 პერსონაჟი: მარტივი ბრტყელი ხაზოვანი ხატულები, მუქ წრეზე, ერთნაირი ხაზის სისქით
(function () {
  const W = '#f3f0f4', G = '#3a3441';
  const L = `fill="none" stroke="${W}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
  const P = (d, f) => `<path d="${d}" ${L.replace('fill="none"', `fill="${f || 'none'}"`)}/>`;
  const dot = (x, y, r = 2.8) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${W}"/>`;
  const C = (x, y, r, f) => `<circle cx="${x}" cy="${y}" r="${r}" ${L.replace('fill="none"', `fill="${f || 'none'}"`)}/>`;
  const E = (x, y, rx, ry, f, t) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" ${L.replace('fill="none"', `fill="${f || 'none'}"`)}${t ? ` transform="${t}"` : ''}/>`;
  // ბრტყელი, გულგრილი სახე: მძიმე ქუთუთო + წერტილი
  const eyes = (x1, x2, y) => P(`M${x1 - 5} ${y - 2}H${x1 + 5}M${x2 - 5} ${y - 2}H${x2 + 5}`) + dot(x1, y + 1.5, 2.4) + dot(x2, y + 1.5, 2.4);
  const dots = (x1, x2, y) => dot(x1, y) + dot(x2, y);
  const flat = (x, y, w = 6) => P(`M${x - w} ${y}H${x + w}`);
  const frown = (x, y) => P(`M${x - 7} ${y + 2}Q${x} ${y - 4} ${x + 7} ${y + 2}`);

  const A = {
    khinkali: P('M50 28C30 36 16 56 20 74C24 88 76 88 80 74C84 56 70 36 50 28Z', G) + P('M50 28C46 22 46 17 50 12C54 17 54 22 50 28Z') + P('M38 40L44 33M62 40L56 33M29 54L36 47M71 54L64 47') + eyes(41, 59, 62) + flat(50, 73),
    khachapuri: P('M10 56Q50 22 90 56Q50 90 10 56Z', G) + P('M24 56Q50 41 76 56Q50 71 24 56Z') + C(50, 56, 9, W) + `<circle cx="46.5" cy="54.5" r="1.7" fill="${G}"/><circle cx="53.5" cy="54.5" r="1.7" fill="${G}"/><path d="M47 60H53" stroke="${G}" stroke-width="2" stroke-linecap="round"/>`,
    potato: P('M16 56C12 34 34 20 54 22C78 24 88 44 84 62C80 82 56 86 36 82C22 78 18 66 16 56Z', G) + dot(30, 40, 1.6) + dot(70, 74, 1.6) + dot(64, 34, 1.4) + dot(26, 64, 1.4) + P('M32 44L46 48M70 44L56 48') + eyes(40, 62, 54) + frown(51, 70),
    tomato: C(50, 57, 31, G) + P('M50 28L41 18L50 22L58 15L57 28') + eyes(39, 61, 54) + flat(50, 70, 8),
    icecream: P('M33 56L50 92L67 56Z', G) + P('M39 64L59 60M43 75L59 71') + C(50, 42, 24) + P('M27 52Q26 62 33 56') + C(50, 14, 4.5, W) + dots(42, 58, 42) + flat(50, 52, 5),
    banana: `<g transform="rotate(-18 50 54)">${E(50, 54, 22, 38, G)}${P('M45 14V8H55V14')}${P('M31 50H48V60H31ZM52 50H69V60H52Z', W)}${P('M48 53H52')}${flat(50, 76, 6)}</g>`,
    mushroom: P('M32 52V76Q32 86 42 86H58Q68 86 68 76V52', G) + P('M12 56C12 26 88 26 88 56Z') + C(33, 44, 5) + C(56, 38, 6) + C(73, 50, 4) + dots(43, 58, 68) + flat(50.5, 77, 4),
    pizza: P('M50 90L12 30Q50 12 88 30Z', G) + P('M12 30Q50 12 88 30L83 40Q50 24 17 40Z') + C(37, 56, 5) + C(61, 63, 4.5) + eyes(41, 60, 50) + flat(50.5, 70, 5),
    cat: P('M22 44L20 14L44 30ZM78 44L80 14L56 30Z') + E(50, 58, 33, 28, G) + eyes(37, 63, 56) + P('M47 66H53L50 70Z') + P('M14 62L30 64M14 70L30 68M86 62L70 64M86 70L70 68') + flat(50, 76, 4),
    dog: E(22, 48, 10, 22, G, 'rotate(12 22 48)') + E(78, 48, 10, 22, G, 'rotate(-12 78 48)') + E(50, 54, 30, 30) + eyes(38, 62, 48) + E(50, 62, 8, 5.5, W) + P('M50 68V72') + flat(50, 74, 6),
    frog: E(50, 64, 36, 26, G) + C(30, 36, 14) + C(70, 36, 14) + P('M22 33H38M62 33H78') + dot(30, 40, 2.6) + dot(70, 40, 2.6) + P('M22 68Q50 78 78 68') + dot(45, 56, 1.6) + dot(55, 56, 1.6),
    pig: P('M24 40L20 18L42 30ZM76 40L80 18L58 30Z') + C(50, 55, 32, G) + eyes(37, 63, 46) + E(50, 63, 14, 10, W) + `<ellipse cx="45" cy="63" rx="2" ry="3.4" fill="${G}"/><ellipse cx="55" cy="63" rx="2" ry="3.4" fill="${G}"/>`,
    owl: P('M24 36L22 14L42 26ZM76 36L78 14L58 26Z') + E(50, 57, 32, 33, G) + C(36, 48, 13) + C(64, 48, 13) + dot(37, 51, 3.2) + dot(63, 51, 3.2) + P('M24 42L46 44M76 42L54 44') + P('M45 58H55L50 67Z', W),
    penguin: E(50, 56, 30, 34, G) + E(50, 62, 19, 24) + P('M20 62Q10 54 14 44M80 62Q90 54 86 44') + eyes(41, 59, 44) + P('M44 54H56L50 62Z', W) + P('M39 73L50 78L61 73V83L50 79L39 83Z', W),
    sloth: E(50, 57, 34, 30, G) + E(36, 54, 9, 11, 'none', 'rotate(-18 36 54)') + E(64, 54, 9, 11, 'none', 'rotate(18 64 54)') + P('M31 55H42M58 55H69') + E(50, 64, 5, 3.5, W) + flat(50, 72, 5),
    octopus: P('M20 60C20 20 80 20 80 60C80 66 76 70 74 74C70 86 78 90 84 88C76 96 62 90 64 76C60 84 62 92 54 94C46 94 48 84 44 76C40 88 38 94 30 90C34 84 28 80 26 74C22 70 20 66 20 60Z', G) + eyes(38, 62, 50) + flat(50, 66, 5),
    chicken: P('M38 28Q36 14 44 18Q48 8 54 18Q62 12 62 28') + C(50, 58, 32, G) + eyes(39, 61, 50) + P('M42 58H58L50 70Z', W) + P('M48 70Q50 80 52 70'),
    cow: P('M28 34Q16 26 14 14M72 34Q84 26 86 14') + E(15, 46, 10, 7, G, 'rotate(-20 15 46)') + E(85, 46, 10, 7, G, 'rotate(20 85 46)') + `<rect x="20" y="28" width="60" height="58" rx="26" ${L}/>` + P('M56 30Q74 30 78 46Q70 50 62 44Q54 40 56 30Z', G) + E(50, 70, 20, 13, W) + `<ellipse cx="43" cy="70" rx="2" ry="3.4" fill="${G}"/><ellipse cx="57" cy="70" rx="2" ry="3.4" fill="${G}"/>` + eyes(37, 63, 50),
    monkey: C(16, 52, 11, G) + C(84, 52, 11, G) + C(50, 52, 33, G) + P('M50 42C42 32 25 38 28 52C30 66 40 76 50 76C60 76 70 66 72 52C75 38 58 32 50 42Z') + eyes(40, 60, 52) + dot(47, 60, 1.5) + dot(53, 60, 1.5) + flat(50, 69, 6),
    fish: P('M70 52L92 32L90 72Z', G) + E(46, 52, 34, 26) + P('M42 26Q50 14 62 28M48 78Q56 90 64 76') + dot(36, 44, 3) + P('M12 56Q10 66 20 66Q30 64 26 56Q20 52 12 56Z', W) + P('M60 38Q66 52 60 66') + C(14, 36, 3.5) + C(22, 26, 2.5),
    dino: P('M26 40L30 22L38 34L48 18L54 32L64 20L66 36Z') + P('M20 62C16 36 38 28 56 32C80 36 88 52 82 68C78 82 56 86 40 84C28 82 22 74 20 62Z', G) + dot(76, 52, 1.6) + eyes(50, 68, 48).replace(/<path[^>]*\/>/, '') + P('M28 70Q50 82 76 72') + P('M38 74V78M48 76V80M58 76V80M68 74V78'),
    bunny: E(36, 26, 10, 24, G, 'rotate(-10 36 26)') + E(64, 26, 10, 24, G, 'rotate(14 64 26)') + C(50, 62, 30) + eyes(38, 62, 58) + P('M47 66H53L50 70Z') + `<rect x="46" y="73" width="8" height="9" rx="2" ${L}/>`,
    alien: P('M50 28V14') + C(50, 12, 4, W) + P('M50 26C20 26 14 64 32 78C42 88 58 88 68 78C86 64 80 26 50 26Z', G) + C(50, 52, 16, W) + `<circle cx="51" cy="53" r="6" fill="${G}"/>` + flat(50, 76, 6),
    ghost: P('M20 86V46C20 18 80 18 80 46V86L70 76L60 86L50 76L40 86L30 76Z', G) + `<ellipse cx="38" cy="46" rx="4.5" ry="7" fill="${W}"/><ellipse cx="62" cy="46" rx="4.5" ry="7" fill="${W}"/>` + C(50, 64, 5),
    cactus: P('M26 58V42Q26 34 33 36Q38 38 38 46V62M74 54V38Q74 30 67 32Q62 34 62 42V58') + `<rect x="32" y="22" width="36" height="64" rx="18" ${L.replace('fill="none"', `fill="${G}"`)}/>` + P('M44 12Q50 4 56 12Q50 20 44 12Z') + P('M38 40H42M58 36H62M40 72H44M58 68H62') + eyes(43, 57, 52) + flat(50, 64, 4),
    cloud: P('M24 70C10 70 8 50 24 48C22 30 44 24 52 36C60 22 84 30 78 48C94 48 92 70 76 70Z', G) + P('M30 46L46 50M70 46L54 50') + eyes(38, 62, 56) + frown(50, 66) + P('M32 78L30 86M50 78L48 88M68 78L66 86'),
    robot: P('M50 24V12') + C(50, 10, 4, W) + `<rect x="14" y="44" width="8" height="22" rx="3" ${L}/><rect x="78" y="44" width="8" height="22" rx="3" ${L}/>` + `<rect x="20" y="24" width="60" height="58" rx="10" ${L.replace('fill="none"', `fill="${G}"`)}/>` + `<rect x="28" y="36" width="44" height="22" rx="6" ${L}/>` + P('M36 48H46M54 48H64') + `<rect x="34" y="66" width="32" height="10" rx="3" ${L}/>` + P('M42 66V76M50 66V76M58 66V76')
  };
  const IDS = Object.keys(A);
  window.AVATAR_IDS = IDS;
  const sprite = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' + IDS.map(id => `<symbol id="av_${id}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#221d28" stroke="#4a4352" stroke-width="2.5"/><g clip-path="url(#avclip)">${A[id]}</g></symbol>`).join('') + '<clipPath id="avclip"><circle cx="50" cy="50" r="47"/></clipPath></defs></svg>';
  function inject() { if (!document.getElementById('avsprite')) { const d = document.createElement('div'); d.id = 'avsprite'; d.innerHTML = sprite; document.body.prepend(d); } }
  if (document.body) inject(); else document.addEventListener('DOMContentLoaded', inject);
  window.av = (id, cls) => `<svg class="av ${cls || ''}" viewBox="0 0 100 100" aria-hidden="true"><use href="#av_${IDS.includes(id) ? id : IDS[0]}"/></svg>`;
})();
