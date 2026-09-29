// Isometric city backdrop, ported from the claude.ai/design "Coming Soon v2" DC.
// Built once with plain DOM; resize only re-positions/re-scales the outer wrapper,
// so running animations never restart.
(() => {
  const UNITLESS = new Set(['opacity', 'fontWeight', 'zIndex']);
  const h = (tag, props, ...kids) => {
    const el = document.createElement(tag);
    const style = props && props.style;
    if (style) for (const k in style) el.style[k] = typeof style[k] === 'number' && !UNITLESS.has(k) ? style[k] + 'px' : style[k];
    for (const c of kids.flat(Infinity)) if (c != null) el.append(c);
    return el;
  };

  const WALK_SPEED = 1.4, PEDESTRIANS = true, TRAFFIC = true;
  const U = 40, S = .3, SW = .12;
  const mix = (c, p) => `color-mix(in oklch, ${c}, black ${p}%)`;
  const pal = {
    road: ['#dcdcdc', '#cdcdcd', '#bdbdbd'],
    walk: ['#f3f3f3', '#e3e3e3', '#d1d1d1'],
    plinth: ['#ececec', '#dcdcdc', '#cbcbcb'],
    tree: ['#d9d9d9', '#c8c8c8', '#b6b6b6'],
    grey: ['#bdbdbd', '#a9a9a9', '#979797'],
    ink: ['#4a4a4a', 'var(--text-heading)', '#111111'],
    amber: ['var(--brand-primary)', 'var(--brand-primary-active)', mix('var(--brand-primary-active)', 22)],
  };
  const tones = [['#ffffff', '#ececec', '#dedede'], ['#fafafa', '#e6e6e6', '#d8d8d8'], ['#f4f4f4', '#dedede', '#cecece'], ['#eeeeee', '#d6d6d6', '#c4c4c4']];
  const cars = [['#ffffff', '#e4e4e4', '#d0d0d0'], ['#bfbfbf', '#acacac', '#999999'], ['#8f8f8f', '#7d7d7d', '#6c6c6c'], ['#f0f0f0', '#dadada', '#c7c7c7']];
  // Facade textures. `up` is the gradient direction that runs up a wall, `across` runs along it
  // (they differ per face because the walls are rotated planes).
  const skins = {
    floors: (up) => `repeating-linear-gradient(${up}, transparent 0 8px, rgba(0,0,0,.07) 8px 12px)`,
    grid: (up, across) => `repeating-linear-gradient(${up}, transparent 0 7px, rgba(0,0,0,.05) 7px 12px), repeating-linear-gradient(${across}, transparent 0 7px, rgba(0,0,0,.05) 7px 10px)`,
    glass: (up, across) => `repeating-linear-gradient(${across}, transparent 0 6px, rgba(0,0,0,.09) 6px 7px), linear-gradient(${up}, rgba(0,0,0,.06), rgba(255,255,255,.5))`,
  };
  const faces = (w, d, ht, c, see, far, skin) => {
    const g = see ? (far ? { opacity: .5 } : { opacity: .5, boxShadow: 'inset 0 0 0 1px #bdbdbd' }) : {};
    const gt = see ? (far ? { opacity: .72 } : { opacity: .72, boxShadow: 'inset 0 0 0 1px #c4c4c4' }) : {};
    const sk = skins[skin];
    return [
      h('div', { style: { position: 'absolute', inset: 0, background: c[0], transform: `translateZ(${ht * U}px)`, ...gt } }),
      h('div', { style: { position: 'absolute', left: 0, top: d * U, width: w * U, height: ht * U, background: c[1], backgroundImage: sk ? sk('to bottom', 'to right') : 'none', transformOrigin: 'top', transform: 'rotateX(90deg)', ...g } }),
      h('div', { style: { position: 'absolute', left: w * U, top: 0, width: ht * U, height: d * U, background: c[2], backgroundImage: sk ? sk('to right', 'to bottom') : 'none', transformOrigin: 'left', transform: 'rotateY(-90deg)', ...g } }),
    ];
  };
  // Pitched roof sitting on z=0 of its box: two slopes plus the gable end facing the viewer.
  // Ridge runs along x (gable on the +x wall) or along y (gable on the +y wall).
  const roofFaces = (w, d, rh, c, alongX) => {
    const run = (alongX ? d : w) / 2, sl = Math.hypot(run, rh), th = Math.atan2(rh, run) * 180 / Math.PI;
    const P = { position: 'absolute', opacity: .85, boxShadow: 'inset 0 0 0 1px #c4c4c4' };
    return alongX ? [
      h('div', { style: { ...P, left: 0, top: 0, width: w * U, height: sl * U, background: c[0], transformOrigin: 'top', transform: `rotateX(${th}deg)` } }),
      h('div', { style: { ...P, left: 0, top: (d - sl) * U, width: w * U, height: sl * U, background: c[1], transformOrigin: 'bottom', transform: `rotateX(${-th}deg)` } }),
      h('div', { style: { ...P, left: w * U, top: 0, width: rh * U, height: d * U, background: c[2], transformOrigin: 'left', transform: 'rotateY(-90deg)', clipPath: 'polygon(0 0, 100% 50%, 0 100%)', boxShadow: 'none' } }),
    ] : [
      h('div', { style: { ...P, left: 0, top: 0, width: sl * U, height: d * U, background: c[0], transformOrigin: 'left', transform: `rotateY(${-th}deg)` } }),
      h('div', { style: { ...P, left: (w - sl) * U, top: 0, width: sl * U, height: d * U, background: c[2], transformOrigin: 'right', transform: `rotateY(${th}deg)` } }),
      h('div', { style: { ...P, left: 0, top: d * U, width: w * U, height: rh * U, background: c[1], transformOrigin: 'top', transform: 'rotateX(90deg)', clipPath: 'polygon(0 0, 100% 0, 50% 100%)', boxShadow: 'none' } }),
    ];
  };

  const out = [];
  const G = [-2, 4], base = S + SW, ins = .5, cx = 8, cy = 8;
  // A box-shaped slot at (x, y, z) that rises into place after `delay` ms; kids draw inside it.
  const solid = (x, y, z, w, d, kids, delay) => {
    if (Math.hypot(x - cx, y - cy) > 9) delay = null;
    out.push(h('div', { style: { position: 'absolute', left: x * U, top: y * U, width: w * U, height: d * U, transformStyle: 'preserve-3d', transform: `translateZ(${z * U}px)` } },
      h('div', { style: { position: 'absolute', inset: 0, transformStyle: 'preserve-3d', animation: delay == null ? 'none' : `rise 900ms cubic-bezier(.2,0,.2,1) ${delay}ms both` } }, kids)));
  };
  const cub = (x, y, z, w, d, ht, c, delay, see, skin) => solid(x, y, z, w, d, faces(w, d, ht, c, see, Math.hypot(x - cx, y - cy) > 12, skin), delay);
  const roof = (x, y, z, w, d, rh, c, delay, alongX) => solid(x, y, z, w, d, roofFaces(w, d, rh, c, alongX), delay);
  // a gabled house: walls plus a pitched roof, ridge along the longer side
  const house = (x, y, w, d, ht, c, delay) => { cub(x, y, base, w, d, ht, c, delay, true); roof(x, y, base + ht, w, d, Math.min(w, d) * .45, c, delay + 90, w >= d); };
  const flat = (x, y, z, w, d, bg, extra) => out.push(h('div', { style: { position: 'absolute', left: x * U, top: y * U, width: w * U, height: d * U, transform: `translateZ(${z * U}px)`, background: bg, ...extra } }));

  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const dly = (x, y) => Math.hypot(x - cx, y - cy) > 9 ? null : 200 + Math.hypot(x - cx, y - cy) * 70;
  cub(G[0] * 6 - 1, G[0] * 6 - 1, 0, (G[1] - G[0]) * 6 + 1, (G[1] - G[0]) * 6 + 1, S, pal.road, null);

  // Variety (rooftops, facades, building shapes) draws from its own stream so the base
  // layout from `rnd` — and the route/marker sightlines it was tuned for — never shifts.
  let seed2 = 7;
  const rnd2 = () => { seed2 = (seed2 * 16807) % 2147483647; return (seed2 - 1) / 2147483646; };
  const tree = (x, y, d, z0, r = rnd) => { const c = .38 + r() * .14; cub(x + .225 - c / 2, y + .225 - c / 2, z0 ?? base, c, c, c * (1.3 + r() * .7), pal.tree, d); };
  const lamp = (x, y, d) => cub(x, y, base, .06, .06, .8, pal.grey, d);
  const bench = (x, y, vert, d) => cub(x, y, base + .08, vert ? .18 : .6, vert ? .6 : .18, .12, pal.grey, d);
  const building = (bx, by, bw, bd, kind, d) => {
    const c = pick(tones), v = rnd2();
    if (kind === 'tower') {
      const ht = 4.2 + rnd() * 3.4, spire = rnd() > .4;
      if (v < .3 && bw > 1.6) {
        // twin slabs joined by a skybridge
        const t = bw * .38, ht2 = ht * (.7 + rnd2() * .2);
        cub(bx, by, base, t, bd, ht, c, d, true, 'glass');
        cub(bx + bw - t, by, base, t, bd, ht2, c, d + 80, true, 'glass');
        cub(bx + t, by + bd / 2 - .25, base + ht2 * .6, bw - 2 * t, .5, .35, c, d + 200, true, 'glass');
      } else if (v < .65) {
        // glass tower with a crown, topped by a spire or a helipad
        cub(bx, by, base, bw, bd, ht, c, d, true, 'glass');
        cub(bx + .3, by + .3, base + ht, bw - .6, bd - .6, .7, c, d + 120, true, 'glass');
        if (spire) cub(bx + bw / 2 - .04, by + bd / 2 - .04, base + ht + .7, .08, .08, 1.4, pal.grey, d + 200);
        else solid(bx + .3, by + .3, base + ht + .71, bw - .6, bd - .6, h('div', { style: { position: 'absolute', inset: '14%', borderRadius: '50%', boxShadow: 'inset 0 0 0 2px #b0b0b0' } }), d + 200);
      } else {
        cub(bx, by, base, bw, bd, ht, c, d, true, 'grid');
        cub(bx + .3, by + .3, base + ht, bw - .6, bd - .6, .7, c, d + 120, true);
        if (spire) cub(bx + bw / 2 - .04, by + bd / 2 - .04, base + ht + .7, .08, .08, .9, pal.grey, d + 200);
      }
    } else if (kind === 'stepped') {
      let z = base, i = 0, w = bw, dd = bd, x = bx, y = by;
      while (i < 3 && w > .8 && dd > .8) { const t = 1 + rnd() * .6; cub(x, y, z, w, dd, t, c, d + i * 110, true, 'floors'); z += t; x += .4; y += .4; w -= .8; dd -= .8; i++; }
      // roof garden on the top tier
      if (v < .5) tree(x - .2, y - .2, d + i * 110 + 150, z, rnd2);
    } else if (kind === 'low') {
      const ht = .6 + rnd() * .6;
      if (v < .5) {
        // a terrace of gabled houses, split along the longer side
        const alongX = bw >= bd, len = alongX ? bw : bd, n = Math.max(2, Math.round(len / .9)), g = .1, sz = (len - g * (n - 1)) / n;
        for (let i = 0; i < n; i++) {
          const o = i * (sz + g), hh = ht * (.8 + rnd2() * .4), hc = pick2(tones);
          house(alongX ? bx + o : bx, alongX ? by : by + o, alongX ? sz : bw, alongX ? bd : sz, hh, hc, d + i * 50);
        }
      } else if (v < .75) {
        // warehouse with rooftop plant
        cub(bx, by, base, bw, bd, ht, c, d, true);
        for (let i = 0, n = 1 + Math.floor(rnd2() * 3); i < n; i++) cub(bx + .15 + rnd2() * (bw - .6), by + .15 + rnd2() * (bd - .6), base + ht, .3 + rnd2() * .15, .3, .18, pal.plinth, d + 150 + i * 40);
      } else cub(bx, by, base, bw, bd, ht, c, d, true);
    } else {
      const ht = 1.3 + rnd() * 2.2;
      const box = rnd() > .35 && bw > .9 && bd > .9 ? [bx + .2 + rnd() * (bw - .9), by + .2 + rnd() * (bd - .9)] : null;
      if (v < .25) {
        // L-shaped block: tall bar at the back, lower wing in front
        cub(bx, by, base, bw, bd * .45, ht, c, d, true, 'floors');
        cub(bx, by + bd * .45, bw * .45, bd * .55, ht * .6, c, d + 80, true, 'floors');
      } else if (v < .42) {
        house(bx, by, bw, bd, Math.min(ht, 1.5), c, d);
      } else if (v < .58) {
        // roof terrace with planters
        cub(bx, by, base, bw, bd, ht, c, d, true, 'grid');
        tree(bx + .1, by + .1, d + 200, base + ht, rnd2);
        if (bw > 1.2) tree(bx + bw - .55, by + bd - .55, d + 240, base + ht, rnd2);
      } else {
        cub(bx, by, base, bw, bd, ht, c, d, true, 'floors');
        if (box) cub(box[0], box[1], base + ht, .5, .5, .3, pal.plinth, d + 150);
      }
    }
  };
  const pick2 = arr => arr[Math.floor(rnd2() * arr.length)];

  const walkers = [];
  for (let zy = G[0]; zy < G[1]; zy++) for (let zx = G[0]; zx < G[1]; zx++) {
    const x0 = zx * 6, y0 = zy * 6, d0 = dly(x0, y0);
    cub(x0, y0, S, 5, 5, SW, pal.walk, d0);
    // lane markings on the street east and south of this block
    flat(x0 + .6, y0 + 5.475, S + .004, 3.8, .05, 'repeating-linear-gradient(to right, #ffffff 0 12px, transparent 12px 24px)');
    flat(x0 + 5.475, y0 + .6, S + .004, .05, 3.8, 'repeating-linear-gradient(to bottom, #ffffff 0 12px, transparent 12px 24px)');
    const X0 = x0 + ins, Y0 = y0 + ins, span = 5 - ins * 2;
    if (zx === 0 && zy === 1) {
      // the office the route leads to
      cub(1.4, 6.8, base, 3, 3.4, 2.4, ['#ffffff', '#f4f4f4', '#e9e9e9'], dly(2, 7), true);
      cub(4.4, 8.15, base, .06, .7, .95, pal.ink, dly(3, 8));
      [7, 9.6].forEach((ty, i) => tree(.6, ty, dly(1, ty) + 60 * i));
      continue;
    }
    const r = rnd();
    if (r < .12) {
      cub(X0, Y0, base, span, span, .08, pal.plinth, d0);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (rnd() > .25) tree(X0 + .3 + i * 1.3 + rnd() * .2, Y0 + .3 + j * 1.3 + rnd() * .2, d0 + 100 + (i + j) * 40);
    } else if (r < .24) {
      cub(X0 - .3, Y0 - .3, base, span + .6, span + .6, .06, pal.plinth, d0);
      const z = base + .06, m = x0 + 2.5, n = y0 + 2.5;
      cub(m - 1, n - 1, z, 2, 2, .18, pal.walk, d0 + 80);
      cub(m - .8, n - .8, z + .12, 1.6, 1.6, .02, ['#e6e6e6', '#d6d6d6', '#c6c6c6'], d0 + 120);
      if (rnd() > .5) { cub(m - .25, n - .25, z, .5, .5, .5, pal.plinth, d0 + 160); cub(m - .1, n - .1, z + .5, .2, .2, 1.1, tones[0], d0 + 220); }
      else { cub(m - .15, n - .15, z, .3, .3, .45, pal.plinth, d0 + 160); cub(m - .3, n - .3, z + .45, .6, .6, .08, pal.plinth, d0 + 200); cub(m - .06, n - .06, z + .53, .12, .12, .3, pal.plinth, d0 + 240); }
      [[X0 - .1, Y0 - .1], [X0 + span - .35, Y0 - .1], [X0 - .1, Y0 + span - .35], [X0 + span - .35, Y0 + span - .35]].forEach(([tx, ty], i) => tree(tx, ty, d0 + 260 + i * 50, z));
      bench(m - .3, n - 1.5, false, d0 + 300); bench(m - .3, n + 1.32, false, d0 + 320); lamp(m - 1.4, n - 1.4, d0 + 380);
    } else if (r < .45) {
      const g = .3, sz = (span - g) / 2;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const q = rnd();
        if (q < .1) { tree(X0 + i * (sz + g) + sz / 2 - .2, Y0 + j * (sz + g) + sz / 2 - .2, d0); continue; }
        building(X0 + i * (sz + g), Y0 + j * (sz + g), sz, sz, q < .35 ? 'tower' : q < .6 ? 'low' : 'mid', d0 + (i + j) * 60);
      }
    } else if (r < .6) {
      building(X0 + .8, Y0 + .8, 2.4, 2.4, 'tower', d0);
      tree(X0 + .1, Y0 + .1, d0 + 200); tree(X0 + span - .55, Y0 + span - .55, d0 + 240);
    } else if (r < .72) {
      building(X0, Y0, span, span, 'stepped', d0);
    } else if (r < .84) {
      const t = .9, ht = 1.2 + rnd() * 1.2, c = pick(tones);
      cub(X0, Y0, base, span, t, ht, c, d0, true, 'grid'); cub(X0, Y0 + span - t, base, span, t, ht, c, d0 + 60, true, 'grid');
      cub(X0, Y0 + t, base, t, span - 2 * t, ht, c, d0 + 90, true, 'grid'); cub(X0 + span - t, Y0 + t, base, t, span - 2 * t, ht, c, d0 + 120, true, 'grid');
      tree(X0 + span / 2 - .22, Y0 + span / 2 - .22, d0 + 200);
    } else {
      const splitX = rnd() > .5, parts = 2 + Math.floor(rnd() * 2), g = .3, sz = (span - g * (parts - 1)) / parts;
      for (let q = 0; q < parts; q++) {
        const a2 = q * (sz + g);
        building(splitX ? X0 + a2 : X0, splitX ? Y0 : Y0 + a2, splitX ? sz : span, splitX ? span : sz, rnd() > .5 ? 'mid' : 'low', d0 + q * 60);
      }
    }
    // street trees and lamps along the kerb, kept off the route
    for (let n = 0, placed = 0; n < 4 && placed < 2; n++) {
      const e = Math.floor(rnd() * 4), t = .6 + rnd() * 3.6, q = rnd() * .62;
      const [tx, ty] = e === 0 ? [x0 + t, y0 + .02] : e === 1 ? [x0 + t, y0 + 4.53] : e === 2 ? [x0 + .02, y0 + t] : [x0 + 4.53, y0 + t];
      if ((Math.abs(ty + .22 - 10.75) < .45 && tx > 10 && tx < 17) || (Math.abs(tx + .22 - 10.75) < .45 && ty > 6 && ty < 11) || (Math.abs(ty + .22 - 6.25) < .45 && tx > 4 && tx < 11) || (Math.abs(tx + .22 - 4.75) < .45 && ty > 6 && ty < 9)) continue;
      placed++;
      if (q < .45) tree(tx, ty, d0 == null ? null : d0 + 300); else lamp(tx + .2, ty + .2, d0 == null ? null : d0 + 300);
    }
    // sidewalk people
    if (PEDESTRIANS && rnd() > .55 && Math.hypot(x0 - cx, y0 - cy) < 14) {
      const e = Math.floor(rnd() * 4), o = .25, st = .4 + rnd() * 1.2, len = 2.2 + rnd() * 1.6;
      const pts = e === 0 ? [[x0 + st, y0 + o], [x0 + st + len, y0 + o]] : e === 1 ? [[x0 + st, y0 + 5 - o], [x0 + st + len, y0 + 5 - o]] : e === 2 ? [[x0 + o, y0 + st], [x0 + o, y0 + st + len]] : [[x0 + 5 - o, y0 + st], [x0 + 5 - o, y0 + st + len]];
      walkers.push(pts.map(p => [p[0], p[1], base]));
    }
  }

  // crosswalks where the route crosses
  const zebraH = 'repeating-linear-gradient(to right, #ffffff 0 5px, transparent 5px 11px)';
  flat(11.08, 10.45, S + .004, .84, .6, zebraH);
  flat(5.1, 5.95, S + .004, .8, .6, zebraH);

  // the route, on sidewalks and across two crossings
  const route = [[16.4, 10.75, base], [10.75, 10.75, base], [10.75, 6.25, base], [4.75, 6.25, base], [4.75, 8.5, base], [4.5, 8.5, base]];
  const lw = .07;
  route.slice(1).forEach((q, i) => {
    const p = route[i], z = base + .006, horiz = p[1] === q[1];
    const x = Math.min(p[0], q[0]) - (horiz ? 0 : lw / 2), y = Math.min(p[1], q[1]) - (horiz ? lw / 2 : 0);
    flat(x, y, z, horiz ? Math.abs(q[0] - p[0]) : lw, horiz ? lw : Math.abs(q[1] - p[1]), `repeating-linear-gradient(${horiz ? 'to right' : 'to bottom'}, var(--text-muted) 0 8px, transparent 8px 16px)`);
  });
  flat(16.4 - .18, 10.75 - .18, base + .006, .36, .36, 'transparent', { borderRadius: '50%', boxShadow: 'inset 0 0 0 2px var(--text-muted)' });

  // marker above the office, always facing the viewer
  out.push(h('div', { style: { position: 'absolute', left: 2.9 * U, top: 8.5 * U, width: 0, height: 0, transformStyle: 'preserve-3d', transform: `translateZ(${(base + 2.8) * U}px) rotateZ(-45deg) rotateX(-55deg)` } },
    h('div', { style: { position: 'absolute', left: 0, bottom: 0, transform: 'translateX(-50%)' } }, h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'markerBob 2.4s cubic-bezier(.2,0,.2,1) infinite' } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', background: 'var(--canvas)', color: 'var(--text-heading)', borderRadius: 9999, padding: '7px 14px', fontFamily: 'var(--font-core)', fontSize: 14, fontWeight: 600, boxShadow: 'var(--shadow-float)' } }, 'Your desk', h('span', { style: { fontWeight: 400, color: 'var(--text-muted)' } }, '· 09:00')),
      h('div', { style: { width: 2, height: 34, background: 'var(--text-heading)' } }),
      h('div', { style: { width: 8, height: 8, marginTop: -4, borderRadius: '50%', background: 'var(--text-heading)' } })))));

  const tf = (p, s) => `translate3d(${p[0] * U}px,${p[1] * U}px,${(p[2] ?? S) * U}px) scale3d(${s},${s},${s})`;
  const walker = (name, pts, opts, spd) => {
    const sp = spd || WALK_SPEED;
    const segs = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
    const len = segs.reduce((a, b) => a + b, 0), walkT = len / sp;
    const pre = opts.spawn || 0, post = opts.enter || 0, pause = opts.pause || 0;
    const T = pre + walkT + post + pause, pc = t => (t / T * 100).toFixed(3) + '%';
    let kf = `0%{transform:${tf(pts[0], pre ? 0 : 1)}}`;
    if (pre) kf += `${pc(pre)}{transform:${tf(pts[0], 1)}}`;
    let t = pre;
    segs.forEach((s, i) => { t += s / sp; kf += `${pc(t)}{transform:${tf(pts[i + 1], 1)}}`; });
    if (post) kf += `${pc(t + post)}{transform:${tf(opts.door, 0)}}100%{transform:${tf(opts.door, 0)}}`;
    return { css: `@keyframes ${name}{${kf}}`, T };
  };
  const figure = (anim, c, sc) => {
    const bw = .32 * sc, hw = .24 * sc;
    return h('div', { style: { position: 'absolute', left: -bw / 2 * U, top: -bw / 2 * U, width: bw * U, height: bw * U, transformStyle: 'preserve-3d', animation: anim } },
      h('div', { style: { position: 'absolute', inset: 0, transformStyle: 'preserve-3d', animation: 'bob 420ms linear infinite' } },
        faces(bw, bw, .5 * sc, c),
        h('div', { style: { position: 'absolute', left: (bw - hw) / 2 * U, top: (bw - hw) / 2 * U, width: hw * U, height: hw * U, transformStyle: 'preserve-3d', transform: `translateZ(${.58 * sc * U}px)` } }, faces(hw, hw, hw, c))));
  };

  const main = walker('selyoWalk', route, { spawn: .6, enter: .7, pause: 1.8, door: [4.15, 8.5, base] });
  const css = [main.css];
  const people = [figure(`selyoWalk ${main.T}s linear 1.6s infinite both`, pal.amber, 1.15)];
  walkers.forEach((pts, i) => {
    const w = walker('selyoP' + i, pts, {}, .5 + rnd() * .5);
    css.push(w.css);
    people.push(figure(`selyoP${i} ${w.T}s ease-in-out ${-(rnd() * w.T).toFixed(2)}s infinite alternate both`, pal.grey, .85));
  });

  if (TRAFFIC) {
    const L0 = G[0] * 6 - 1, L1 = G[1] * 6;
    for (let i = 0; i < 12; i++) {
      const vert = rnd() > .5, dir = rnd() > .5 ? 1 : -1;
      let line = G[0] + Math.floor(rnd() * (G[1] - G[0]));
      if (vert && (line === 0 || line === 1)) line = 2 + Math.floor(rnd() * 3);
      const lane = line * 6 + 5 + (dir > 0 ? .3 : .7), L = .8, W = .36, c = pick(cars);
      const a0 = dir > 0 ? L0 : L1, a1 = dir > 0 ? L1 : L0;
      const P = t => vert ? [lane - W / 2, t - L / 2, S] : [t - L / 2, lane - W / 2, S];
      const T = (L1 - L0) / (1.6 + rnd() * 1.4);
      css.push(`@keyframes selyoCar${i}{from{transform:${tf(P(a0), 1)}}to{transform:${tf(P(a1), 1)}}}`);
      const [bw, bd] = vert ? [W, L] : [L, W], [cw, cd] = vert ? [W - .06, .42] : [.42, W - .06];
      people.push(h('div', { style: { position: 'absolute', left: 0, top: 0, width: bw * U, height: bd * U, transformStyle: 'preserve-3d', animation: `selyoCar${i} ${T.toFixed(2)}s linear ${-(rnd() * T).toFixed(2)}s infinite` } },
        faces(bw, bd, .24, c),
        h('div', { style: { position: 'absolute', left: (bw - cw) / 2 * U, top: (bd - cd) / 2 * U, width: cw * U, height: cd * U, transformStyle: 'preserve-3d', transform: `translateZ(${.24 * U}px)` } }, faces(cw, cd, .18, c))));
    }
  }

  const scaler = h('div', null,
    h('div', { style: { position: 'absolute', left: -cx * U, top: -cy * U, width: 0, height: 0, transformStyle: 'preserve-3d', transformOrigin: `${cx * U}px ${cy * U}px`, transform: 'rotateX(55deg) rotateZ(45deg)' } }, out, people));
  const anchor = h('div', { style: { position: 'absolute', width: 0, height: 0 } }, h('style', null, css.join('')), scaler);

  const layout = () => {
    const vw = innerWidth, vh = innerHeight, narrow = vw < 760;
    const scale = Math.min(2.2, Math.max(narrow ? .8 : .7, Math.max(vw / 1000, vh / 700)));
    anchor.style.left = narrow ? '58%' : '70%';
    anchor.style.top = narrow ? '68%' : '58%';
    scaler.style.transform = `scale(${scale})`;
  };
  layout();
  addEventListener('resize', layout);
  document.getElementById('scene').append(anchor);
})();
