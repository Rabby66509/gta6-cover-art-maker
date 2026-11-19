/* Vice Cover Studio — GTA 6-style cover art maker.
   Everything runs offline: photos are read on this machine, the cover is
   drawn on a canvas, and PNG export is a canvas download. No network. */
'use strict';

/* ------------------------------------------------------------------ data */

const LAYOUTS = {
  'hero-left': {
    label: 'Hero left',
    rects: [[0, 0, 0.60, 1], [0.612, 0, 0.388, 0.494], [0.612, 0.506, 0.388, 0.494]],
  },
  'hero-top': {
    label: 'Hero top',
    rects: [[0, 0, 1, 0.60], [0, 0.612, 0.494, 0.388], [0.506, 0.612, 0.494, 0.388]],
  },
  'strips-3': {
    label: '3 strips',
    rects: [[0, 0, 0.326, 1], [0.337, 0, 0.326, 1], [0.674, 0, 0.326, 1]],
  },
  'grid-4': {
    label: '4 grid',
    rects: [[0, 0, 0.494, 0.494], [0.506, 0, 0.494, 0.494], [0, 0.506, 0.494, 0.494], [0.506, 0.506, 0.494, 0.494]],
  },
  'full-bleed': {
    label: 'Full bleed',
    rects: [[0, 0, 1, 1]],
  },
  'tilted': {
    label: 'Tilted snapshots',
    rects: [[0.05, 0.03, 0.42, 0.62, -0.06], [0.52, 0.10, 0.42, 0.62, 0.05], [0.28, 0.42, 0.44, 0.52, -0.02]],
  },
};

const GRADES = {
  sunset: {
    label: 'Sunset Blaze', swatch: 'linear-gradient(90deg,#ff9a3c,#ff2e88)',
    saturate: 1.35, contrast: 1.12, brightness: 1.0,
    overlay: ['rgba(255,154,60,0.55)', 'rgba(255,46,136,0.55)'], multiply: 'rgba(255,120,40,0.10)',
  },
  neon: {
    label: 'Neon Vice', swatch: 'linear-gradient(90deg,#ff2ea6,#00e5ff)',
    saturate: 1.5, contrast: 1.15, brightness: 1.0,
    overlay: ['rgba(255,46,166,0.5)', 'rgba(0,229,255,0.5)'], multiply: 'rgba(120,0,120,0.12)',
  },
  gold: {
    label: 'Palm Gold', swatch: 'linear-gradient(90deg,#ffd76a,#ff7b00)',
    saturate: 1.3, contrast: 1.06, brightness: 1.02,
    overlay: ['rgba(255,215,106,0.5)', 'rgba(255,123,0,0.5)'], multiply: 'rgba(255,190,60,0.12)',
  },
  midnight: {
    label: 'Midnight Neon', swatch: 'linear-gradient(90deg,#2b1055,#ff2e88)',
    saturate: 1.25, contrast: 1.15, brightness: 0.95,
    overlay: ['rgba(43,16,85,0.55)', 'rgba(255,46,136,0.45)'], multiply: 'rgba(30,10,80,0.18)',
  },
  retro: {
    label: 'Retro Fade', swatch: 'linear-gradient(90deg,#2ec4b6,#ff9f1c)',
    saturate: 1.1, contrast: 1.05, brightness: 1.0,
    overlay: ['rgba(46,196,182,0.45)', 'rgba(255,159,28,0.45)'], multiply: 'rgba(20,120,110,0.10)',
  },
};

const SIZES = {
  square: { w: 1080, h: 1080, label: 'Square · 1080 × 1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait · 1080 × 1350' },
  landscape: { w: 1920, h: 1080, label: 'Landscape · 1920 × 1080' },
};

const state = {
  layout: 'hero-left',
  grade: 'sunset',
  size: 'square',
  title: 'SUNSET HEIST',
  subtitle: 'Vice City Nights',
  tagline: 'TWO OUTLAWS · ONE LAST SCORE · NO WAY BACK',
  badge: 'WANTED',
  heat: 4,
  halftone: true,
  selectedPanel: 0,
};

/* photos: { img, name } — samples first, uploads appended. */
const photos = [];
/* panels: one per layout slot (max 4): { photo, zoom, x, y } */
const panels = [
  { photo: 0, zoom: 1.2, x: 0.5, y: 0.45 },
  { photo: 1, zoom: 1.15, x: 0.5, y: 0.5 },
  { photo: 0, zoom: 1.35, x: 0.5, y: 0.35 },
  { photo: 1, zoom: 1.2, x: 0.5, y: 0.55 },
];

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

/* ---------------------------------------------------------------- helpers */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load ' + src));
    img.src = src;
  });
}

function makeGrainTile() {
  const t = document.createElement('canvas');
  t.width = 140; t.height = 140;
  const c = t.getContext('2d');
  const data = c.createImageData(140, 140);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 110 + Math.floor(Math.random() * 90);
    data.data[i] = v; data.data[i + 1] = v; data.data[i + 2] = v; data.data[i + 3] = 255;
  }
  c.putImageData(data, 0, 0);
  return t;
}
let grainTile = null;

function starPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function fitFont(ctx, text, startSize, maxWidth, family) {
  let size = startSize;
  while (size > 12) {
    ctx.font = size + 'px ' + family;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.font = size + 'px ' + family;
  return size;
}

/* ------------------------------------------------------------ cover paint */

function paintPanel(ctx, img, rect, panel, grade, canvasW, canvasH) {
  const rx = rect[0] * canvasW;
  const ry = rect[1] * canvasH;
  const rw = rect[2] * canvasW;
  const rh = rect[3] * canvasH;
  const rot = rect[4] || 0;
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.translate(-rw / 2, -rh / 2);

  if (rot !== 0) {
    // Polaroid-style white frame for tilted snapshots.
    ctx.fillStyle = '#fdf6ec';
    ctx.fillRect(-10, -10, rw + 20, rh + 26);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    ctx.fillRect(-10, -10, rw + 20, rh + 26);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  ctx.beginPath();
  ctx.rect(0, 0, rw, rh);
  ctx.clip();

  if (img) {
    const base = Math.max(rw / img.width, rh / img.height) * panel.zoom;
    const dw = img.width * base;
    const dh = img.height * base;
    const dx = -(dw - rw) * panel.x;
    const dy = -(dh - rh) * panel.y;
    ctx.filter = `saturate(${grade.saturate}) contrast(${grade.contrast}) brightness(${grade.brightness})`;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.filter = 'none';

    const grad = ctx.createLinearGradient(0, 0, rw, rh);
    grad.addColorStop(0, grade.overlay[0]);
    grad.addColorStop(1, grade.overlay[1]);
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, rw, rh);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = grade.multiply;
    ctx.fillRect(0, 0, rw, rh);
    ctx.globalCompositeOperation = 'source-over';

    const vig = ctx.createRadialGradient(rw / 2, rh / 2, Math.min(rw, rh) * 0.35, rw / 2, rh / 2, Math.max(rw, rh) * 0.75);
    vig.addColorStop(0, 'rgba(10,4,24,0)');
    vig.addColorStop(1, 'rgba(10,4,24,0.45)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, rw, rh);
  } else {
    const g = ctx.createLinearGradient(0, 0, rw, rh);
    g.addColorStop(0, '#3a1c5c'); g.addColorStop(1, '#12081f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, rw, rh);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold ' + Math.max(14, rw * 0.05) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ADD A PHOTO', rw / 2, rh / 2);
  }

  if (grainTile) {
    const pattern = ctx.createPattern(grainTile, 'repeat');
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, rw, rh);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  // Inked poster frame around the panel.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.translate(-rw / 2, -rh / 2);
  ctx.lineWidth = Math.max(3, canvasW * 0.004);
  ctx.strokeStyle = '#12081f';
  ctx.strokeRect(0, 0, rw, rh);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.strokeRect(3, 3, rw - 6, rh - 6);
  ctx.restore();
}

function paintHalftone(ctx, x, y, w, h, W) {
  const step = Math.max(10, W * 0.012);
  ctx.save();
  ctx.fillStyle = 'rgba(255,46,136,0.13)';
  for (let row = 0; row * step < h; row++) {
    for (let col = 0; col * step < w; col++) {
      const px = x + col * step + (row % 2 ? step / 2 : 0);
      const py = y + row * step;
      const depth = 1 - row * step / h;
      const r = 1 + depth * step * 0.28;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function paintHeatMeter(ctx, W, H) {
  const r = Math.max(10, W * 0.016);
  const gap = r * 2.5;
  const x0 = W * 0.05;
  const y = H * 0.07;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold ' + Math.max(11, W * 0.011) + 'px sans-serif';
  try { ctx.letterSpacing = '3px'; } catch (e) { /* older canvas */ }
  ctx.fillStyle = '#ffe9a8';
  ctx.shadowColor = '#ff5e3a';
  ctx.shadowBlur = W * 0.006;
  const label = 'HEAT';
  ctx.fillText(label, x0, y);
  ctx.shadowBlur = 0;
  try { ctx.letterSpacing = '0px'; } catch (e) { /* older canvas */ }
  const starX0 = x0 + ctx.measureText(label).width + r * 1.6;
  for (let i = 0; i < 5; i++) {
    const cx = starX0 + r + i * gap;
    starPath(ctx, cx, y, r);
    if (i < state.heat) {
      ctx.fillStyle = '#ffd23f';
      ctx.shadowColor = '#ff5e3a';
      ctx.shadowBlur = W * 0.008;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = 'rgba(20,8,43,0.65)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffd23f';
      ctx.stroke();
    }
  }
  ctx.restore();
}

function paintBadge(ctx, W, H) {
  if (!state.badge.trim()) return;
  const cx = W * 0.9;
  const cy = H * 0.085;
  const r = Math.max(26, W * 0.068);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.18);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#ff7ad9');
  g.addColorStop(0.55, '#ff2e88');
  g.addColorStop(1, '#c40e5f');
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(2, W * 0.003);
  ctx.strokeStyle = '#ffd23f';
  ctx.stroke();
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = Math.max(11, r * 0.32) + 'px Anton, sans-serif';
  const label = state.badge.trim().toUpperCase();
  const size = fitFont(ctx, label, r * 0.42, r * 1.5, 'Anton, sans-serif');
  void size;
  ctx.fillText('★', 0, -r * 0.42);
  ctx.fillText(label, 0, r * 0.12);
  ctx.restore();
}

function paintTitleBlock(ctx, W, H) {
  const bandTop = H * 0.74;
  const band = ctx.createLinearGradient(0, bandTop, 0, H);
  band.addColorStop(0, 'rgba(8,3,20,0)');
  band.addColorStop(0.35, 'rgba(8,3,20,0.82)');
  band.addColorStop(1, 'rgba(8,3,20,0.94)');
  ctx.fillStyle = band;
  ctx.fillRect(0, bandTop, W, H - bandTop);

  if (state.halftone) paintHalftone(ctx, 0, bandTop, W, H - bandTop, W);

  const title = state.title.trim().toUpperCase();
  if (title) {
    const size = fitFont(ctx, title, W * 0.115, W * 0.94, 'Anton, sans-serif');
    const ty = H * 0.885;
    const grad = ctx.createLinearGradient(0, ty - size, 0, ty);
    grad.addColorStop(0, '#ffe259');
    grad.addColorStop(0.5, '#ffa751');
    grad.addColorStop(1, '#ff2e88');
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#ff5e3a';
    ctx.shadowBlur = W * 0.018;
    ctx.shadowOffsetY = W * 0.004;
    ctx.lineWidth = size * 0.14;
    ctx.strokeStyle = '#14082b';
    ctx.strokeText(title, W / 2, ty);
    ctx.fillStyle = grad;
    ctx.fillText(title, W / 2, ty);
    ctx.restore();
  }

  if (state.subtitle.trim()) {
    ctx.save();
    ctx.translate(W / 2, H * 0.932);
    ctx.rotate(-0.03);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const subSize = fitFont(ctx, state.subtitle.trim(), W * 0.052, W * 0.8, 'Pacifico, cursive');
    void subSize;
    ctx.shadowColor = '#ff2ea6';
    ctx.shadowBlur = W * 0.02;
    ctx.fillStyle = '#ff7ad9';
    ctx.fillText(state.subtitle.trim(), 0, 0);
    ctx.restore();
  }

  if (state.tagline.trim()) {
    const stripH = H * 0.048;
    ctx.fillStyle = 'rgba(8,3,20,0.95)';
    ctx.fillRect(0, H - stripH, W, stripH);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(0, H - stripH, W, Math.max(2, H * 0.003));
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    try { ctx.letterSpacing = '3px'; } catch (e) { /* older canvas */ }
    const tagSize = fitFont(ctx, state.tagline.trim().toUpperCase(), H * 0.02, W * 0.94, 'bold sans-serif');
    void tagSize;
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(state.tagline.trim().toUpperCase(), W / 2, H - stripH / 2 + 1);
    ctx.restore();
  }
}

/* Draw the whole cover onto ctx at W x H. Pure function of `state`. */
function drawCover(ctx, W, H) {
  const grade = GRADES[state.grade];
  const layout = LAYOUTS[state.layout];

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1c0b33');
  bg.addColorStop(0.55, '#0d0618');
  bg.addColorStop(1, '#2b0a2e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.7, H * 0.1, 10, W * 0.7, H * 0.1, W * 0.8);
  glow.addColorStop(0, 'rgba(255,94,58,0.30)');
  glow.addColorStop(0.5, 'rgba(255,46,136,0.12)');
  glow.addColorStop(1, 'rgba(255,46,136,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  layout.rects.forEach((rect, i) => {
    const panel = panels[i] || panels[0];
    const img = photos[panel.photo] ? photos[panel.photo].img : null;
    paintPanel(ctx, img, rect, panel, grade, W, H);
  });

  paintTitleBlock(ctx, W, H);
  paintHeatMeter(ctx, W, H);
  paintBadge(ctx, W, H);
}

/* ------------------------------------------------------------------ render */

function renderPreview() {
  const canvas = $('coverCanvas');
  const size = SIZES[state.size];
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  const ctx = canvas.getContext('2d');
  drawCover(ctx, size.w, size.h);

  // Selection outline (editor only, never exported).
  const layout = LAYOUTS[state.layout];
  const rect = layout.rects[state.selectedPanel];
  if (rect) {
    const rx = rect[0] * size.w, ry = rect[1] * size.h;
    const rw = rect[2] * size.w, rh = rect[3] * size.h;
    ctx.save();
    ctx.translate(rx + rw / 2, ry + rh / 2);
    ctx.rotate(rect[4] || 0);
    ctx.translate(-rw / 2, -rh / 2);
    ctx.setLineDash([14, 10]);
    ctx.lineWidth = Math.max(4, size.w * 0.005);
    ctx.strokeStyle = '#ffd23f';
    ctx.strokeRect(0, 0, rw, rh);
    ctx.restore();
  }
  $('sizeLabel').textContent = SIZES[state.size].label;
}

function exportCover(sizeKey) {
  const size = SIZES[sizeKey];
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off.getContext('2d'), size.w, size.h);
  return new Promise((resolve) => {
    off.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const fileName = 'vice-cover-' + state.layout + '-' + state.grade + '-' + size.w + 'x' + size.h + '.png';
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      $('exportNote').textContent = 'Exported ' + fileName + ' ✓';
      resolve(blob);
    }, 'image/png');
  });
}

function exportDataUrl(sizeKey) {
  const size = SIZES[sizeKey];
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off.getContext('2d'), size.w, size.h);
  return off.toDataURL('image/png');
}

/* --------------------------------------------------------------------- UI */

function buildButtons(containerId, entries, current, onPick, swatchKey) {
  const box = $(containerId);
  box.innerHTML = '';
  Object.entries(entries).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.key = key;
    if (swatchKey && def.swatch) {
      const sw = document.createElement('span');
      sw.className = 'grade-swatch';
      sw.style.background = def.swatch;
      b.appendChild(sw);
    }
    b.appendChild(document.createTextNode(def.label));
    if (key === current) b.classList.add('active');
    b.addEventListener('click', () => {
      onPick(key);
      box.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x.dataset.key === key));
      renderPreview();
    });
    box.appendChild(b);
  });
}

function rebuildPanelGrid() {
  const count = LAYOUTS[state.layout].rects.length;
  if (state.selectedPanel >= count) state.selectedPanel = 0;
  const box = $('panelGrid');
  box.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Panel ' + (i + 1);
    if (i === state.selectedPanel) b.classList.add('active');
    b.addEventListener('click', () => {
      state.selectedPanel = i;
      syncPanelControls();
      renderPreview();
    });
    box.appendChild(b);
  }
}

function rebuildPhotoSelect() {
  const sel = $('panelPhotoSelect');
  sel.innerHTML = '';
  photos.forEach((p, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = (i + 1) + ' · ' + p.name;
    sel.appendChild(o);
  });
  sel.value = String(panels[state.selectedPanel].photo);
}

function rebuildThumbs() {
  const row = $('thumbRow');
  row.innerHTML = '';
  photos.forEach((p, i) => {
    const img = document.createElement('img');
    img.src = p.img.src;
    img.alt = p.name;
    img.title = p.name + ' — click to put in the selected panel';
    if (panels[state.selectedPanel].photo === i) img.classList.add('active');
    img.addEventListener('click', () => {
      panels[state.selectedPanel].photo = i;
      rebuildThumbs();
      rebuildPhotoSelect();
      renderPreview();
    });
    row.appendChild(img);
  });
}

function syncPanelControls() {
  const p = panels[state.selectedPanel];
  $('zoomInput').value = String(p.zoom);
  $('zoomVal').textContent = p.zoom.toFixed(2) + '×';
  $('panXInput').value = String(p.x);
  $('panYInput').value = String(p.y);
  rebuildPhotoSelect();
  rebuildThumbs();
  document.querySelectorAll('#panelGrid button').forEach((b, i) => b.classList.toggle('active', i === state.selectedPanel));
}

function refreshHeatLabel() {
  $('heatLabel').textContent = '★'.repeat(state.heat) + '☆'.repeat(5 - state.heat);
}

function wireEditor() {
  buildButtons('layoutGrid', LAYOUTS, state.layout, (k) => {
    state.layout = k;
    rebuildPanelGrid();
    syncPanelControls();
  });
  buildButtons('gradeGrid', GRADES, state.grade, (k) => { state.grade = k; }, true);

  document.querySelectorAll('.size-tabs button').forEach((b) => {
    b.addEventListener('click', () => {
      state.size = b.dataset.size;
      document.querySelectorAll('.size-tabs button').forEach((x) => x.classList.toggle('active', x === b));
      renderPreview();
    });
  });

  $('titleInput').addEventListener('input', (e) => { state.title = e.target.value; renderPreview(); });
  $('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; renderPreview(); });
  $('taglineInput').addEventListener('input', (e) => { state.tagline = e.target.value; renderPreview(); });
  $('badgeInput').addEventListener('input', (e) => { state.badge = e.target.value; renderPreview(); });
  $('heatInput').addEventListener('input', (e) => { state.heat = Number(e.target.value); refreshHeatLabel(); renderPreview(); });
  $('halftoneInput').addEventListener('change', (e) => { state.halftone = e.target.checked; renderPreview(); });

  $('panelPhotoSelect').addEventListener('change', (e) => {
    panels[state.selectedPanel].photo = Number(e.target.value);
    rebuildThumbs();
    renderPreview();
  });
  $('zoomInput').addEventListener('input', (e) => {
    panels[state.selectedPanel].zoom = Number(e.target.value);
    $('zoomVal').textContent = panels[state.selectedPanel].zoom.toFixed(2) + '×';
    renderPreview();
  });
  $('panXInput').addEventListener('input', (e) => { panels[state.selectedPanel].x = Number(e.target.value); renderPreview(); });
  $('panYInput').addEventListener('input', (e) => { panels[state.selectedPanel].y = Number(e.target.value); renderPreview(); });

  document.querySelectorAll('[data-sample]').forEach((b) => {
    b.addEventListener('click', () => {
      const idx = photos.findIndex((p) => p.name === b.dataset.sample);
      if (idx >= 0) {
        panels[state.selectedPanel].photo = idx;
        syncPanelControls();
        renderPreview();
      }
    });
  });
  $('fillAllBtn').addEventListener('click', () => {
    const src = panels[state.selectedPanel].photo;
    panels.forEach((p) => { p.photo = src; });
    syncPanelControls();
    renderPreview();
  });

  $('photoUpload').addEventListener('change', async (e) => {
    for (const file of e.target.files) {
      const dataUrl = await new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.readAsDataURL(file);
      });
      try {
        const img = await loadImage(dataUrl);
        photos.push({ img, name: file.name.replace(/\.[^.]+$/, '') });
      } catch (err) { /* skip unreadable files */ }
    }
    rebuildThumbs();
    rebuildPhotoSelect();
    renderPreview();
  });

  document.querySelectorAll('[data-export]').forEach((b) => {
    b.addEventListener('click', () => {
      const [w, h] = b.dataset.export.split('x').map(Number);
      const key = Object.keys(SIZES).find((k) => SIZES[k].w === w && SIZES[k].h === h);
      exportCover(key || 'square');
    });
  });

  $('coverCanvas').addEventListener('click', (e) => {
    const canvas = $('coverCanvas');
    const r = canvas.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    const rects = LAYOUTS[state.layout].rects;
    for (let i = 0; i < rects.length; i++) {
      const [x, y, w, h] = rects[i];
      if (nx >= x && nx <= x + w && ny >= y && ny <= y + h) {
        state.selectedPanel = i;
        syncPanelControls();
        renderPreview();
        break;
      }
    }
  });
}

/* ------------------------------------------------------------------ boot */

async function loadSamples() {
  const defs = [
    { src: 'samples/pier.jpg', name: 'pier' },
    { src: 'samples/boulevard.jpg', name: 'boulevard' },
  ];
  for (const d of defs) {
    try {
      const img = await loadImage(d.src);
      photos.push({ img, name: d.name });
    } catch (err) { /* a missing sample just leaves its panels empty */ }
  }
}

async function boot() {
  grainTile = makeGrainTile();
  try {
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('60px Pacifico'),
      document.fonts.ready,
    ]);
  } catch (err) { /* canvas falls back to sans-serif if a font fails */ }
  await loadSamples();

  if (params.get('caption')) state.title = params.get('caption');
  if (params.get('subtitle')) state.subtitle = params.get('subtitle');
  if (params.get('layout') && LAYOUTS[params.get('layout')]) state.layout = params.get('layout');
  if (params.get('grade') && GRADES[params.get('grade')]) state.grade = params.get('grade');
  if (params.get('size') && SIZES[params.get('size')]) state.size = params.get('size');

  const shot = params.get('shot') || (params.get('cover') ? 'cover' : '');
  if (shot === 'cover' || shot === 'export') {
    document.body.classList.add('cover-mode');
    if (shot === 'export') {
      const img = $('exportShotImg');
      img.src = exportDataUrl(state.size);
      $('exportShot').hidden = false;
      document.title = 'Exported cover — Vice Cover Studio';
      return;
    }
    const canvas = $('coverCanvasFull');
    const size = SIZES[state.size];
    canvas.width = size.w;
    canvas.height = size.h;
    drawCover(canvas.getContext('2d'), size.w, size.h);
    $('coverOnly').hidden = false;
    return;
  }

  wireEditor();
  rebuildPanelGrid();
  rebuildPhotoSelect();
  rebuildThumbs();
  syncPanelControls();
  refreshHeatLabel();
  renderPreview();
}

boot();
