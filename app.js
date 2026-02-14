// ====== Helpers ======
const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const lerp = (a, b, t) => a + (b - a) * t;

// deterministic noise (stable)
function fract(x) { return x - Math.floor(x); }
function hash(n) { return fract(Math.sin(n) * 10000); }
function noise1D(x) {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash(i);
  const b = hash(i + 1);
  const t = f * f * (3 - 2 * f);
  return a * (1 - t) + b * t;
}

// ====== DOM ======
const canvas = document.getElementById('bloodCanvas');
const spine = document.querySelector('.spine');
const ctx = canvas ? canvas.getContext('2d') : null;

// If canvas/spine missing, don’t crash
let W = 0, H = 0, DPR = 1;
let currentY = 0;
let targetY = 0;
let trailMaxY = 0;

// animation control (only run when needed)
let rafId = null;
let ticking = false;

// ====== Canvas sizing ======
function resizeCanvas() {
  if (!canvas || !spine || !ctx) return;

  const rect = spine.getBoundingClientRect();
  DPR = window.devicePixelRatio || 1;

  W = Math.max(1, Math.floor(rect.width));
  H = Math.max(1, Math.floor(rect.height));

  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  currentY = clamp(currentY, 0, H);
  targetY  = clamp(targetY, 0, H);
  trailMaxY = clamp(trailMaxY, 0, H);

  draw();
}

// ====== Scroll progress ======
function scrollProgress() {
  const doc = document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop;
  const scrollHeight = doc.scrollHeight - window.innerHeight;
  return scrollHeight > 0 ? clamp(scrollTop / scrollHeight) : 0;
}

function updateTargets() {
  const p = scrollProgress();
  const pad = 18;

  targetY = lerp(pad, H - pad, p);
  trailMaxY = Math.max(trailMaxY, targetY);
}

// ====== Drawing ======
function drawBloodTrail() {
  const centerX = W / 2;

  const baseW = 3.2;
  const maxW = 6.0;

  const grad = ctx.createLinearGradient(0, 0, 0, trailMaxY);
  grad.addColorStop(0.0, 'rgba(91,10,10,0)');
  grad.addColorStop(0.18, 'rgba(91,10,10,0.92)');
  grad.addColorStop(1.0, 'rgba(42,0,0,0.96)');

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = grad;
  ctx.shadowColor = 'rgba(91,10,10,0.22)';
  ctx.shadowBlur = 12;

  ctx.beginPath();
  const step = 8;

  for (let y = 10; y <= trailMaxY; y += step) {
    const j = (noise1D(y * 0.08) - 0.5) * 6.0;
    const x = centerX + j;
    if (y === 10) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  const thickness = baseW + (noise1D(trailMaxY * 0.06) * (maxW - baseW));
  ctx.lineWidth = thickness;
  ctx.globalAlpha = 0.95;
  ctx.stroke();
  ctx.restore();

  // micro droplets
  ctx.save();
  ctx.fillStyle = 'rgba(59,0,0,0.85)';
  ctx.globalAlpha = 0.65;

  for (let i = 0; i < 10; i++) {
    const yy = trailMaxY * (i / 10);
    if (yy < 40) continue;

    const chance = noise1D(yy * 0.13);
    if (chance > 0.83) {
      const dx = (noise1D(yy * 0.2) - 0.5) * 10;
      const r = 1.2 + noise1D(yy * 0.3) * 2.0;

      ctx.beginPath();
      ctx.ellipse(centerX + dx, yy, r, r * 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawDripHead() {
  const centerX = W / 2;
  const y = currentY;
  const r = 6.5;

  ctx.save();
  ctx.translate(centerX, y);

  ctx.shadowColor = 'rgba(91,10,10,0.25)';
  ctx.shadowBlur = 16;

  const g = ctx.createRadialGradient(0, -2, 2, 0, 0, r * 1.8);
  g.addColorStop(0, 'rgba(91,10,10,0.98)');
  g.addColorStop(1, 'rgba(42,0,0,0.96)');
  ctx.fillStyle = g;

  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(r * 0.9, -r * 0.2, r * 0.7, r * 0.6);
  ctx.quadraticCurveTo(0, r * 1.7, -r * 0.7, r * 0.6);
  ctx.quadraticCurveTo(-r * 0.9, -r * 0.2, 0, -r);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.35;
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.ellipse(-1.5, -2.5, 1.2, 2.0, 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  drawBloodTrail();
  drawDripHead();
}

// ====== Tick (runs only while we need movement) ======
function tick() {
  ticking = true;
  updateTargets();

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const speed = prefersReduced ? 1.0 : 0.12;

  currentY = lerp(currentY, targetY, speed);
  draw();

  // stop when close enough
  if (Math.abs(currentY - targetY) < 0.25) {
    currentY = targetY;
    draw();
    ticking = false;
    rafId = null;
    return;
  }

  rafId = requestAnimationFrame(tick);
}

function requestTick() {
  if (!canvas || !spine || !ctx) return;
  if (ticking) return;
  rafId = requestAnimationFrame(tick);
}

// ====== Lookbook Modal ======
const lookbookModal = document.getElementById('lookbookModal');
const lookbookGrid  = document.getElementById('lookbookGrid');
const viewer = document.getElementById('viewer');
const viewerImg = document.getElementById('viewerImg');

const openBtns = [
  document.getElementById('openLookbook'),
  document.getElementById('openLookbook3'),
  document.getElementById('openLookbook4'),
].filter(Boolean);

const closeBtn1 = document.getElementById('closeLookbook');
const closeBtn2 = document.getElementById('closeLookbook2');
const viewerClose = document.getElementById('viewerClose');

const LOOKBOOK = [
  "lookbook/01.jpg",
  "lookbook/02.jpg",
  "lookbook/03.jpg",
  "lookbook/04.jpg",
  "lookbook/05.jpg",
  "lookbook/06.jpg"
];

function lockScroll(lock) {
  document.body.style.overflow = lock ? 'hidden' : '';
}

function openLookbook() {
  buildLookbook();
  lookbookModal?.setAttribute('aria-hidden', 'false');
  lockScroll(true);
}

function closeLookbook() {
  lookbookModal?.setAttribute('aria-hidden', 'true');
  lockScroll(false);
}

function openViewer(src) {
  if (!viewerImg) return;
  viewerImg.src = src;
  viewer?.setAttribute('aria-hidden', 'false');
}

function closeViewer() {
  viewer?.setAttribute('aria-hidden', 'true');
  if (viewerImg) viewerImg.src = "";
}

function buildLookbook() {
  if (!lookbookGrid) return;
  lookbookGrid.innerHTML = "";

  LOOKBOOK.forEach((src, idx) => {
    const item = document.createElement('div');
    item.className = "lbItem";
    item.innerHTML = `
      <img src="${src}" alt="Lookbook image ${idx + 1}" loading="lazy">
      <div class="lbCap">LOOK ${String(idx + 1).padStart(2, '0')}</div>
    `;

    // If an image is missing, don’t break the grid
    const img = item.querySelector('img');
    img.addEventListener('error', () => {
      item.style.opacity = '0.35';
      item.style.pointerEvents = 'none';
    });

    item.addEventListener('click', () => openViewer(src));
    lookbookGrid.appendChild(item);
  });
}

openBtns.forEach(b => b.addEventListener('click', openLookbook));
closeBtn1?.addEventListener('click', closeLookbook);
closeBtn2?.addEventListener('click', closeLookbook);
viewerClose?.addEventListener('click', closeViewer);

// Close viewer when clicking backdrop
viewer?.addEventListener('click', (e) => {
  if (e.target === viewerClose) closeViewer();
});

// Esc closes viewer first, then modal
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;

  if (viewer?.getAttribute('aria-hidden') === 'false') closeViewer();
  else if (lookbookModal?.getAttribute('aria-hidden') === 'false') closeLookbook();
});

// ====== Mobile menu ======
const menuBtn = document.getElementById('menuBtn');
const nav = document.querySelector('.nav');

menuBtn?.addEventListener('click', () => {
  const open = nav.style.display === 'flex';
  nav.style.display = open ? 'none' : 'flex';
  nav.style.flexDirection = 'column';
  nav.style.position = 'absolute';
  nav.style.right = '16px';
  nav.style.top = '58px';
  nav.style.padding = '12px';
  nav.style.borderRadius = '16px';
  nav.style.background = 'rgba(0,0,0,.72)';
  nav.style.border = '1px solid rgba(255,255,255,.10)';
  nav.style.backdropFilter = 'blur(10px)';
  menuBtn.setAttribute('aria-expanded', String(!open));
});

// ====== Reveal ======
const revealEls = [...document.querySelectorAll('[data-reveal]')];
const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('revealed');
  });
}, { threshold: 0.12 });

revealEls.forEach(el => io.observe(el));

// ====== Notify (concept) ======
document.getElementById('notifyBtn')?.addEventListener('click', () => {
  const msg = document.getElementById('notifyMsg');
  if (msg) msg.textContent = "Saved (concept). Wire this to Mailchimp / Google Sheets later.";
});

// Year
const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());

// ====== Init ======
window.addEventListener('resize', () => {
  resizeCanvas();
  requestTick();
});

window.addEventListener('scroll', () => {
  // only animate when user scrolls
  requestTick();
}, { passive: true });

resizeCanvas();
requestTick();