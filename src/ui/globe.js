// A small 3D globe drawn on a canvas: land as dots (orthographic projection), the chosen country
// lit in the signal colour, an orbit ring, drag to spin. No libraries. The coastlines are coarse
// hand-drawn polygons: they are a picture of the world, not a map to navigate by.

import { countries } from '../data/registry.js';

const RAD = Math.PI / 180;

// Rough continent outlines as [lon, lat] rings.
const LAND = [
  // North America
  [[-168, 66], [-156, 71], [-140, 70], [-125, 70], [-110, 73], [-95, 72], [-80, 73], [-75, 68], [-64, 60], [-56, 52], [-66, 45], [-70, 42], [-76, 35], [-80, 31], [-81, 25], [-84, 30], [-90, 29.5], [-97, 27], [-97, 21], [-91, 18], [-87, 21], [-88, 16], [-84, 11], [-80, 8], [-83, 8.5], [-86, 12], [-92, 14.5], [-96, 16], [-105, 20], [-110, 24], [-112, 29], [-115, 30], [-117, 32.5], [-121, 35], [-124, 40], [-124.5, 48], [-128, 51], [-133, 56], [-140, 59.5], [-148, 60.5], [-155, 58], [-165, 54.5], [-160, 59], [-165, 62]],
  // South America
  [[-80, 8], [-72, 12], [-62, 10.5], [-52, 5], [-50, 0], [-44, -2.5], [-35, -6], [-39, -14], [-41, -22], [-48, -26], [-53, -34], [-58, -38], [-62, -41], [-65, -46], [-68, -52], [-71, -54], [-74, -50], [-73, -42], [-71.5, -30], [-70.5, -18], [-76, -14], [-81, -5], [-78, 1]],
  // Eurasia
  [[-9.5, 37], [-9, 43], [-1.5, 43.5], [-1, 46.5], [-4.5, 48.5], [2, 51], [8, 54], [10, 57.5], [12, 56], [18, 59.5], [17, 62.5], [21, 65.5], [25, 65.5], [21, 69.5], [30, 70.5], [40, 67], [44, 68.5], [55, 68.5], [68, 70.5], [80, 73], [100, 77], [113, 73.5], [130, 71], [150, 71.5], [170, 70], [180, 68], [178, 64], [170, 60], [163, 58], [157, 51], [156, 57], [140, 54], [138, 46], [130, 42.5], [129, 35], [126, 37.5], [121, 31], [119, 25], [110, 21], [106, 17], [109, 12], [105, 8.5], [100, 13.5], [99, 9], [103.5, 1.5], [98, 8], [97.5, 16.5], [92, 22], [86.5, 20], [80, 15.5], [77.5, 8], [72.5, 19], [68, 23.5], [62, 25], [57, 25.5], [56.5, 27], [50, 30], [48, 29], [50.5, 26], [56, 26], [59, 22.5], [55, 17], [43, 12.7], [39, 21], [34.5, 28], [32.5, 31], [35, 36], [27, 36.7], [26, 40.5], [29, 41], [24, 38], [22.5, 36.5], [19.5, 40.5], [13, 45.5], [12.5, 44], [18.5, 40], [16, 38], [12, 41.5], [8.5, 44], [3, 43.3], [0, 39.5], [-2, 36.7], [-5.5, 36]],
  // Africa
  [[-17, 21], [-13, 27.5], [-9.5, 32], [-5.5, 35.8], [10, 37], [11, 33.5], [20, 30.5], [32, 31.3], [34.5, 28], [37, 22], [43, 12.6], [51, 11.8], [49, 6], [42, -1], [39.5, -6], [40.5, -15], [35.5, -24], [32.5, -29], [27.5, -33.7], [20, -34.8], [18.4, -33.9], [15, -27], [12, -17], [13.5, -11], [12, -5], [9, -0.5], [9.5, 4], [5, 6], [-1, 5], [-8, 4.5], [-13, 8], [-17, 14.5]],
  // Madagascar
  [[44, -16], [50, -15.5], [47, -25], [43.5, -22]],
  // Australia
  [[114, -22], [116, -20.5], [122, -17.5], [126, -14], [130, -12], [136.5, -12], [136, -15], [140.5, -17.5], [142, -10.8], [145.5, -15], [147, -19.5], [153, -25.5], [153.5, -29], [150, -37.5], [146, -39], [141, -38.3], [138, -35.5], [136, -35], [132, -31.5], [126, -32.3], [117.5, -35], [115, -34], [113.5, -26]],
  // Great Britain and Ireland
  [[-5.7, 50], [1.4, 51.2], [1.7, 52.7], [0.2, 53.5], [-1.6, 55.6], [-2, 57.7], [-3.3, 58.6], [-5, 58.6], [-6.2, 56.8], [-5, 55], [-3.2, 54.5], [-4.8, 53.3], [-4.2, 52.2], [-5.3, 51.7]],
  [[-6, 52], [-6.2, 54], [-7.5, 55.3], [-10, 54.2], [-10.3, 51.7]],
  // Greenland
  [[-55, 60], [-43, 60], [-37, 65.5], [-22, 70], [-18, 76.5], [-20, 82], [-40, 83.5], [-62, 82], [-73, 78], [-58, 75.5], [-54, 69]],
  // Japan
  [[130.5, 31.5], [135, 34], [140, 35.5], [141.5, 40], [140, 41.5], [144, 43.5], [141.5, 45.5], [139.5, 42], [139.5, 38], [136.5, 37], [132.5, 35]],
  // Indonesia (Sumatra, Borneo, New Guinea)
  [[95.5, 5.5], [104, -2], [106, -6], [101, -3], [97.5, 1]],
  [[109, 1.5], [117, 6.5], [119, 1], [116, -4], [110, -3]],
  [[131, -1], [141, -2.5], [147.5, -6], [150, -10.5], [141, -9], [137, -5]],
  // Korean peninsula, Philippines, Taiwan, Sri Lanka, Iceland, Cuba
  [[126.1, 34.6], [129.4, 35.2], [129.5, 37.5], [128.4, 38.6], [126.5, 37.8]],
  [[120, 18.5], [122.3, 18.5], [124.2, 13], [126.3, 9], [125.5, 6], [122, 7], [117.5, 8.5], [121, 14.5]],
  [[120.1, 22.6], [121.9, 25.1], [121.5, 22]],
  [[79.8, 8], [81.9, 7.4], [80.2, 9.8]],
  [[-24, 65.5], [-18, 66.5], [-13.5, 65.2], [-18, 63.4], [-22.5, 63.8]],
  [[-85, 21.9], [-77, 22.3], [-74.2, 20.2], [-77.7, 19.9], [-82, 22.5]],
  // New Zealand
  [[172.5, -34.5], [178.5, -37.5], [175, -41.5], [173, -41], [168, -46.5], [166.5, -45.5], [171, -41]],
];

// Highlight shapes per country (also coarse), and where to point the camera.
export const COUNTRY_SHAPES = {
  US: { center: [-98, 39], rings: [[[-124.7, 48.4], [-95, 49], [-89, 48], [-83, 46], [-82.5, 42], [-79, 43.3], [-75, 45], [-67, 47.3], [-70, 41.5], [-76, 35], [-80.5, 31], [-80, 25.2], [-82.6, 28], [-84, 30], [-90, 29.5], [-97.2, 26], [-99.5, 27.5], [-103, 29], [-106.5, 31.8], [-111, 31.3], [-117.1, 32.5], [-121, 35], [-124, 40]],
    [[-168, 66], [-156, 71], [-141, 69.6], [-141, 60], [-148, 60.5], [-155, 58], [-165, 54.5], [-160, 59], [-165, 62]]] },
  CA: { center: [-100, 57], rings: [[[-141, 69.6], [-125, 70], [-110, 73], [-95, 72], [-80, 73], [-75, 68], [-64, 60], [-56, 52], [-66, 45], [-67, 47.3], [-75, 45], [-79, 43.3], [-82.5, 42], [-83, 46], [-89, 48], [-95, 49], [-124.7, 48.4], [-128, 51], [-133, 56], [-141, 60]]] },
  GB: { center: [-3, 54.5], rings: [LAND[6]] },
  AU: { center: [134, -26], rings: [LAND[5]] },
};

function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const RADIAL = countries.filter((c) => !COUNTRY_SHAPES[c.code] && c.globe).map((c) => ({ code: c.code, lon: c.globe.center[0], lat: c.globe.center[1], r: c.globe.radius || 3 }));

function centreOf(code) {
  if (COUNTRY_SHAPES[code]) return COUNTRY_SHAPES[code].center;
  return countries.find((c) => c.code === code)?.globe?.center || null;
}

function buildDots(step = 1.8) {
  const dots = [];
  for (let lat = -58; lat <= 84; lat += step) {
    const lonStep = step / Math.max(0.25, Math.cos(lat * RAD));
    for (let lon = -180; lon < 180; lon += lonStep) {
      const p = [lon, lat];
      if (!LAND.some((r) => inRing(p, r))) continue;
      let country = Object.keys(COUNTRY_SHAPES).find((k) => COUNTRY_SHAPES[k].rings.some((r) => inRing(p, r))) || null;
      if (!country) {
        let best = Infinity;
        for (const c of RADIAL) {
          const dx = (lon - c.lon) * Math.cos(lat * RAD), dy = lat - c.lat, dist = Math.hypot(dx, dy) / c.r;
          if (dist < 1 && dist < best) { best = dist; country = c.code; }
        }
      }
      dots.push({ lon: lon * RAD, lat: lat * RAD, country });
    }
  }
  return dots;
}

/**
 * Mount a globe into `canvas`. Returns { focus(code), destroy() }.
 * Colours are read from CSS custom properties so it follows the theme.
 */
export function createGlobe(canvas, { selected = null } = {}) {
  const ctx = canvas.getContext('2d');
  const dots = buildDots();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lon0 = -40 * RAD, lat0 = 20 * RAD;           // camera: centre longitude and tilt
  let target = null;                               // { lon, lat } while easing to a country
  let current = selected;
  let dragging = null, lastInteract = 0, raf = 0, t = 0, colours = null;

  const readColours = () => {
    const cs = getComputedStyle(canvas);
    colours = {
      land: cs.getPropertyValue('--globe-land').trim() || '#6f7d8c',
      hot: cs.getPropertyValue('--globe-hot').trim() || '#d6ff3e',
      body: cs.getPropertyValue('--globe-body').trim() || 'rgba(255,255,255,.02)',
      ring: cs.getPropertyValue('--globe-ring').trim() || 'rgba(255,255,255,.08)',
      data: cs.getPropertyValue('--accent').trim() || '#38d6ff',
    };
  };

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const { width } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(width * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function project(lon, lat, r, cx, cy) {
    const cosLat = Math.cos(lat), dl = lon - lon0;
    const x = cosLat * Math.sin(dl);
    const y = Math.cos(lat0) * Math.sin(lat) - Math.sin(lat0) * cosLat * Math.cos(dl);
    const z = Math.sin(lat0) * Math.sin(lat) + Math.cos(lat0) * cosLat * Math.cos(dl);
    return [cx + x * r, cy - y * r, z];
  }

  function draw() {
    const w = canvas.getBoundingClientRect().width;
    const cx = w / 2, cy = w / 2, r = w * 0.36;
    ctx.clearRect(0, 0, w, w);

    // Orbit ring behind the sphere (back half), tilted.
    const tilt = -0.32, rx = r * 1.32, ry = r * 0.34;
    const orbitPoint = (a) => [cx + Math.cos(a) * rx * Math.cos(tilt) - Math.sin(a) * ry * Math.sin(tilt), cy + Math.cos(a) * rx * Math.sin(tilt) + Math.sin(a) * ry * Math.cos(tilt)];
    const drawOrbit = (from, to) => {
      ctx.beginPath();
      for (let a = from; a <= to; a += 0.03) { const [x, y] = orbitPoint(a); a === from ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.strokeStyle = colours.ring; ctx.lineWidth = 1; ctx.stroke();
    };
    drawOrbit(Math.PI, Math.PI * 2);

    // Sphere body and rim.
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = colours.body; ctx.fill();
    ctx.strokeStyle = colours.ring; ctx.lineWidth = 1; ctx.stroke();

    // Dots: back hemisphere faint, front by depth; the chosen country in the signal colour.
    const size = Math.max(1, w / 440);
    for (const d of dots) {
      const [x, y, z] = project(d.lon, d.lat, r, cx, cy);
      if (z < -0.15) continue;
      const hot = current && d.country === current;
      ctx.globalAlpha = z < 0 ? 0.08 : hot ? 1 : 0.25 + z * 0.6;
      ctx.fillStyle = hot ? colours.hot : colours.land;
      const s = hot ? size * 2 : size;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;

    // Pin and pulse on the chosen country.
    if (current && centreOf(current)) {
      const [plon, plat] = centreOf(current);
      const [x, y, z] = project(plon * RAD, plat * RAD, r, cx, cy);
      if (z > 0) {
        const pulse = reduce ? 0.5 : (t % 1600) / 1600;
        ctx.beginPath(); ctx.arc(x, y, 4 + pulse * 18, 0, Math.PI * 2);
        ctx.strokeStyle = colours.hot; ctx.globalAlpha = 1 - pulse; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fillStyle = colours.hot; ctx.fill();
      }
    }

    // Orbit front half and a satellite on it.
    drawOrbit(0, Math.PI);
    const sa = reduce ? 0.9 : (t / 5200) * Math.PI * 2;
    const [sx, sy] = orbitPoint(sa % (Math.PI * 2));
    const front = Math.sin(sa % (Math.PI * 2)) > 0;
    ctx.globalAlpha = front ? 1 : 0.25;
    ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fillStyle = colours.data; ctx.fill();
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    const dt = Math.min(64, now - (frame.last || now));
    frame.last = now; t += dt;
    if (!canvas.isConnected) { raf = requestAnimationFrame(frame); return; }
    if (stale) { readColours(); stale = false; }
    if (target) {
      let dl = target.lon - lon0;
      dl = Math.atan2(Math.sin(dl), Math.cos(dl));
      lon0 += dl * 0.08; lat0 += (target.lat - lat0) * 0.08;
      if (Math.abs(dl) < 0.002 && Math.abs(target.lat - lat0) < 0.002) target = null;
    } else if (!dragging && !reduce && now - lastInteract > 2500) {
      // With a country chosen, ease back to it; otherwise drift slowly.
      if (current && centreOf(current)) api.focus(current);
      else lon0 += dt * 0.00009;
    }
    draw();
    raf = requestAnimationFrame(frame);
  }

  const onDown = (e) => { dragging = { x: e.clientX, y: e.clientY, lon: lon0, lat: lat0 }; target = null; canvas.setPointerCapture(e.pointerId); };
  const onMove = (e) => {
    if (!dragging) return;
    const w = canvas.getBoundingClientRect().width;
    lon0 = dragging.lon - ((e.clientX - dragging.x) / w) * Math.PI * 1.2;
    lat0 = Math.max(-1.1, Math.min(1.1, dragging.lat + ((e.clientY - dragging.y) / w) * Math.PI));
    lastInteract = performance.now();
  };
  const onUp = () => { dragging = null; lastInteract = performance.now(); };

  let stale = false;
  readColours();
  resize();
  const ro = new ResizeObserver(() => { resize(); draw(); });
  ro.observe(canvas);
  // Re-read the theme colours on the next frame the canvas is on screen.
  const mo = new MutationObserver(() => { stale = true; });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  var api = {
    focus(code) {
      current = code;
      const c = centreOf(code);
      if (!c) return;
      target = { lon: c[0] * RAD, lat: Math.max(-0.6, Math.min(0.75, c[1] * RAD * 0.85)) };
      if (reduce) { lon0 = target.lon; lat0 = target.lat; target = null; }
    },
    /** Turn to a point without choosing a country (used for continents). */
    look(lon, lat) {
      target = { lon: lon * RAD, lat: Math.max(-0.6, Math.min(0.75, lat * RAD * 0.85)) };
      lastInteract = performance.now() + 4000;
      if (reduce) { lon0 = target.lon; lat0 = target.lat; target = null; }
    },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); },
  };
  if (selected && centreOf(selected)) { api.focus(selected); if (!reduce) { lon0 = centreOf(selected)[0] * RAD - 1.2; } }
  raf = requestAnimationFrame(frame);
  return api;
}
