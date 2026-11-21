// ფაციფუცობანა — 27 მხიარული პერსონაჟი: ბერიანი ხაზი (2.5), პასტელის ფონი, ერთნაირი სტილი
(function () {
  const B = '#3A0F2A', PK = '#F9C9D8', YL = '#FFE2A8', MT = '#CDEBDD', LV = '#E3D7FA', PC = '#FBD0BE', WH = '#fff';
  const S = `stroke="${B}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"`;
  const P = (d, f) => `<path d="${d}" fill="${f || 'none'}" ${S}/>`;
  const C = (x, y, r, f) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f || 'none'}" ${S}/>`;
  const E = (x, y, rx, ry, f, t) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f || 'none'}" ${S}${t ? ` transform="${t}"` : ''}/>`;
  const R = (x, y, w, h, rx, f) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f || 'none'}" ${S}/>`;
  const dot = (x, y, r = 2.7) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${B}"/>`;
  const eyes = (x1, x2, y) => dot(x1, y) + dot(x2, y);
  const wink = (x, y) => P(`M${x - 4.5} ${y + 1}Q${x} ${y - 4} ${x + 4.5} ${y + 1}`);        // ^ დახუჭული თვალი
  const grin = (x, y, w = 11) => P(`M${x - w} ${y}Q${x} ${y + w * 1.5} ${x + w} ${y}Z`, WH);  // დიდი ღიმილი
  const smile = (x, y, w = 8) => P(`M${x - w} ${y}Q${x} ${y + w * .9} ${x + w} ${y}`);
  const tongue = (x, y, w = 9) => P(`M${x - w} ${y}Q${x} ${y + w} ${x + w} ${y}`) + P(`M${x - 4} ${y + 3.2}V${y + 9}Q${x} ${y + 12} ${x + 4} ${y + 9}V${y + 3.2}`, PK);
  const shades = (x, y) => `<path d="M${x - 17} ${y - 4}H${x + 17}" ${S}/>` + R(x - 17, y - 5, 14, 10, 4, B) + R(x + 3, y - 5, 14, 10, 4, B);
  const stache = (x, y) => P(`M${x} ${y}Q${x - 6} ${y - 6} ${x - 13} ${y - 2}Q${x - 9} ${y + 6} ${x - 2} ${y + 3}Q${x} ${y + 2} ${x} ${y + 2}Q${x} ${y + 2} ${x + 2} ${y + 3}Q${x + 9} ${y + 6} ${x + 13} ${y - 2}Q${x + 6} ${y - 6} ${x} ${y}Z`, B);
  const crown = (x, y) => P(`M${x - 11} ${y}L${x - 13} ${y - 13}L${x - 5} ${y - 7}L${x} ${y - 15}L${x + 5} ${y - 7}L${x + 13} ${y - 13}L${x + 11} ${y}Z`, YL);
  const brows = (x1, x2, y) => P(`M${x1 - 5} ${y - 1}L${x1 + 4} ${y - 4}M${x2 - 4} ${y - 4}L${x2 + 5} ${y - 1}`);

  const A = {
    khinkali: [PK, P('M50 28C30 36 16 56 20 74C24 88 76 88 80 74C84 56 70 36 50 28Z', WH) + P('M50 28C46 22 46 17 50 12C54 17 54 22 50 28Z', WH) + P('M38 40L44 33M62 40L56 33M29 54L36 47M71 54L64 47') + dot(41, 58) + wink(59, 58) + grin(50, 66, 9)],
    khachapuri: [LV, P('M10 56Q50 22 90 56Q50 90 10 56Z', YL) + P('M24 56Q50 41 76 56Q50 71 24 56Z', WH) + C(50, 55, 10, PC) + dot(46, 53, 1.8) + dot(54, 53, 1.8) + P('M45.5 58Q50 63 54.5 58')],
    potato: [MT, P('M16 56C12 34 34 20 54 22C78 24 88 44 84 62C80 82 56 86 36 82C22 78 18 66 16 56Z', PC) + dot(30, 40, 1.6) + dot(70, 74, 1.6) + dot(64, 34, 1.4) + brows(40, 62, 45) + eyes(40, 62, 52) + stache(51, 65) + smile(51, 73, 7)],
    tomato: [YL, P('M50 28L41 17L50 22L58 14L57 28', MT) + C(50, 57, 31, PK) + wink(39, 52) + dot(61, 52) + grin(50, 62, 13)],
    icecream: [LV, P('M33 56L50 92L67 56Z', YL) + P('M39 64L59 60M43 75L59 71') + C(50, 42, 24, PK) + P('M27 52Q26 62 33 56', PK) + C(50, 15, 5, PC) + shades(50, 40) + grin(50, 50, 9)],
    banana: [MT, `<g transform="rotate(-18 50 54)">${E(50, 54, 22, 38, YL)}${P('M45 14V8H55V14', PC)}${shades(50, 48)}${grin(50, 63, 10)}</g>`],
    mushroom: [YL, P('M32 52V76Q32 86 42 86H58Q68 86 68 76V52', WH) + P('M12 56C12 26 88 26 88 56Z', PK) + C(33, 44, 5, WH) + C(56, 38, 6, WH) + C(73, 50, 4, WH) + eyes(43, 58, 65) + tongue(50.5, 72, 6)],
    pizza: [LV, P('M50 90L12 30Q50 12 88 30Z', YL) + P('M12 30Q50 12 88 30L83 40Q50 24 17 40Z', PC) + C(37, 56, 5, PK) + C(61, 63, 4.5, PK) + wink(40, 50) + dot(60, 50) + grin(50, 60, 8)],
    cat: [YL, P('M22 44L20 14L44 30ZM78 44L80 14L56 30Z', PC) + E(50, 58, 33, 28, PC) + dot(37, 54) + wink(63, 54) + P('M47 64H53L50 68Z', PK) + P('M50 68V70M50 70Q45 76 42 71M50 70Q55 76 58 71') + P('M14 62L30 64M14 70L30 68M86 62L70 64M86 70L70 68')],
    dog: [PK, E(22, 48, 10, 22, PC, 'rotate(12 22 48)') + E(78, 48, 10, 22, PC, 'rotate(-12 78 48)') + E(50, 54, 30, 30, YL) + eyes(38, 62, 46) + E(50, 58, 8, 5.5, B) + tongue(50, 67, 9)],
    frog: [PK, E(50, 64, 36, 26, MT) + C(30, 36, 14, WH) + C(70, 36, 14, WH) + dot(30, 38, 3.4) + dot(70, 38, 3.4) + P('M20 62Q50 92 80 62Z', WH) + dot(45, 54, 1.6) + dot(55, 54, 1.6)],
    pig: [MT, P('M24 40L20 18L42 30ZM76 40L80 18L58 30Z', PK) + C(50, 55, 32, PK) + wink(37, 46) + dot(63, 46) + E(50, 62, 14, 10, PC) + `<ellipse cx="45" cy="62" rx="2" ry="3.4" fill="${B}"/><ellipse cx="55" cy="62" rx="2" ry="3.4" fill="${B}"/>` + P('M38 77Q50 85 62 77')],
    owl: [PC, P('M24 36L22 14L42 26ZM76 36L78 14L58 26Z', LV) + E(50, 57, 32, 33, LV) + C(36, 48, 13, WH) + C(64, 48, 13, WH) + dot(37, 50, 3.4) + wink(64, 50) + P('M24 36L46 40M76 36L54 40') + P('M45 58H55L50 67Z', YL)],
    penguin: [YL, E(50, 56, 30, 34, LV) + E(50, 62, 19, 24, WH) + P('M20 62Q10 54 14 44M80 62Q90 54 86 44') + dot(41, 44) + wink(59, 44) + P('M44 53H56L50 61Z', PC) + P('M39 72L50 77L61 72V82L50 78L39 82Z', PK)],
    sloth: [LV, E(50, 57, 34, 30, PC) + E(36, 54, 9, 11, WH, 'rotate(-18 36 54)') + E(64, 54, 9, 11, WH, 'rotate(18 64 54)') + dot(37, 55, 2.8) + dot(63, 55, 2.8) + E(50, 63, 5, 3.5, B) + P('M40 70Q50 80 60 70')],
    octopus: [YL, P('M20 60C20 20 80 20 80 60C80 66 76 70 74 74C70 86 78 90 84 88C76 96 62 90 64 76C60 84 62 92 54 94C46 94 48 84 44 76C40 88 38 94 30 90C34 84 28 80 26 74C22 70 20 66 20 60Z', LV) + dot(38, 48) + wink(62, 48) + grin(50, 58, 9)],
    chicken: [LV, C(50, 60, 31, WH) + crown(50, 32) + dot(40, 52) + wink(60, 52) + P('M42 60H58L50 71Z', YL) + P('M48 71Q50 80 52 71Z', PK)],
    cow: [YL, P('M28 34Q16 26 14 14M72 34Q84 26 86 14') + E(15, 46, 10, 7, WH, 'rotate(-20 15 46)') + E(85, 46, 10, 7, WH, 'rotate(20 85 46)') + R(20, 28, 60, 58, 26, WH) + P('M56 30Q74 30 78 46Q70 50 62 44Q54 40 56 30Z', LV) + E(50, 68, 20, 13, PK) + `<ellipse cx="43" cy="66" rx="2" ry="3.4" fill="${B}"/><ellipse cx="57" cy="66" rx="2" ry="3.4" fill="${B}"/>` + dot(37, 48) + dot(63, 48) + P('M43 74Q50 80 57 74')],
    monkey: [PK, C(16, 52, 11, PC) + C(84, 52, 11, PC) + C(50, 52, 33, PC) + P('M50 42C42 32 25 38 28 52C30 66 40 76 50 76C60 76 70 66 72 52C75 38 58 32 50 42Z', YL) + dot(40, 50) + wink(60, 50) + dot(47, 58, 1.5) + dot(53, 58, 1.5) + grin(50, 64, 9)],
    fish: [MT, P('M70 52L92 32L90 72Z', PC) + E(46, 52, 34, 26, PC) + P('M42 26Q50 14 62 28M48 78Q56 90 64 76', YL) + dot(38, 44, 3) + P('M12 56Q10 66 20 66Q30 64 26 56Q20 52 12 56Z', PK) + stache(24, 52) + P('M60 38Q66 52 60 66') + C(14, 36, 3.5) + C(22, 26, 2.5)],
    dino: [YL, P('M26 40L30 22L38 34L48 18L54 32L64 20L66 36Z', PK) + P('M20 62C16 36 38 28 56 32C80 36 88 52 82 68C78 82 56 86 40 84C28 82 22 74 20 62Z', MT) + dot(76, 52, 1.6) + dot(50, 48) + wink(67, 46) + P('M26 66Q50 86 78 68Z', WH) + P('M36 72V77M46 76V81M56 77V82M66 74V79')],
    bunny: [LV, E(36, 26, 10, 24, WH, 'rotate(-10 36 26)') + E(64, 26, 10, 24, WH, 'rotate(14 64 26)') + E(36, 28, 4.5, 16, PK, 'rotate(-10 36 28)') + E(64, 28, 4.5, 16, PK, 'rotate(14 64 28)') + C(50, 62, 30, WH) + dot(38, 58) + wink(62, 58) + P('M47 65H53L50 69Z', PK) + P('M40 72Q50 82 60 72') + R(46, 74, 8, 9, 2, WH)],
    alien: [PK, P('M50 28V14') + C(50, 12, 4, YL) + P('M50 26C20 26 14 64 32 78C42 88 58 88 68 78C86 64 80 26 50 26Z', MT) + C(50, 50, 15, WH) + dot(51, 51, 6) + grin(50, 68, 9)],
    ghost: [LV, P('M20 86V46C20 18 80 18 80 46V86L70 76L60 86L50 76L40 86L30 76Z', WH) + shades(50, 46) + tongue(50, 58, 9)],
    cactus: [PK, P('M26 58V42Q26 34 33 36Q38 38 38 46V62M74 54V38Q74 30 67 32Q62 34 62 42V58') + R(32, 22, 36, 64, 18, MT) + P('M44 12Q50 4 56 12Q50 20 44 12Z', YL) + P('M38 40H42M58 36H62M40 72H44M58 68H62') + shades(50, 46) + grin(50, 58, 8)],
    cloud: [YL, P('M24 70C10 70 8 50 24 48C22 30 44 24 52 36C60 22 84 30 78 48C94 48 92 70 76 70Z', WH) + dot(38, 52) + wink(62, 52) + grin(50, 58, 9)],
    robot: [PC, P('M50 24V12') + C(50, 10, 4, PK) + R(14, 44, 8, 22, 3, LV) + R(78, 44, 8, 22, 3, LV) + R(20, 24, 60, 58, 10, LV) + R(28, 36, 44, 22, 6, WH) + P('M34 50Q40 42 46 50M54 50Q60 42 66 50') + R(34, 66, 32, 10, 3, WH) + P('M42 66V76M50 66V76M58 66V76')]
  };
  const IDS = Object.keys(A);
  window.AVATAR_IDS = IDS;
  const sprite = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' + IDS.map(id => `<symbol id="av_${id}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="49" fill="${A[id][0]}"/><g clip-path="url(#avclip)">${A[id][1]}</g></symbol>`).join('') + '<clipPath id="avclip"><circle cx="50" cy="50" r="49"/></clipPath></defs></svg>';
  function inject() { if (!document.getElementById('avsprite')) { const d = document.createElement('div'); d.id = 'avsprite'; d.innerHTML = sprite; document.body.prepend(d); } }
  if (document.body) inject(); else document.addEventListener('DOMContentLoaded', inject);
  window.av = (id, cls) => `<svg class="av ${cls || ''}" viewBox="0 0 100 100" aria-hidden="true"><use href="#av_${IDS.includes(id) ? id : IDS[0]}"/></svg>`;
})();
