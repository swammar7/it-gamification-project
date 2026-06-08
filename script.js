// ═══ AUDIO ═══
const audioGhostWin = new Audio('after ghost level win.mp3');
const audioGhostLoss = new Audio('after ghost level loss.mp3');
const audioLevel8Win = new Audio('if player wins level 8.mp3');
const AC = new (window.AudioContext || window.webkitAudioContext)();
function bip(f, d, t = 'square', v = .12) { if (AC.state === 'suspended') AC.resume(); const o = AC.createOscillator(), g = AC.createGain(); o.connect(g); g.connect(AC.destination); o.type = t; o.frequency.value = f; g.gain.setValueAtTime(v, AC.currentTime); g.gain.exponentialRampToValueAtTime(.001, AC.currentTime + d); o.start(); o.stop(AC.currentTime + d) }
function sfxPick() { bip(440, .07); setTimeout(() => bip(660, .07), 70) }
function sfxGood() { [523, 659, 784].forEach((f, i) => setTimeout(() => bip(f, .1), i * 70)) }
function sfxBad() { bip(150, .25, 'sawtooth', .15); setTimeout(() => bip(100, .3, 'sawtooth', .1), 90) }
function sfxBurn() { bip(180, .5, 'sawtooth', .18) }
function sfxCombo() { bip(880, .05); setTimeout(() => bip(1100, .08), 50) }
function sfxMeet() { [262, 330, 392, 523].forEach((f, i) => setTimeout(() => bip(f, .12, 'triangle', .12), i * 55)) }
function sfxStun() { bip(90, .35, 'sawtooth', .18); setTimeout(() => bip(70, .35, 'sawtooth', .15), 120) }

// ═══ CANVAS ═══
const cv = document.getElementById('gc'), cx = cv.getContext('2d');
const W = 1100, H = 750;
const dpr = window.devicePixelRatio || 1;
cv.width = W * dpr; cv.height = H * dpr;
cv.style.width = W + 'px'; cv.style.height = H + 'px';

let drawScale = 1;

// Auto-scale canvas to fill viewport natively (High-Res 1080p/4K)
function resizeCanvas() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scaleX = vw / W;
  const scaleY = vh / H;
  const scale = Math.min(scaleX, scaleY);
  
  const dpr = window.devicePixelRatio || 1;
  drawScale = scale * dpr;
  
  // Set internal resolution strictly mapping to physical screen pixels
  cv.width = W * drawScale;
  cv.height = H * drawScale;
  
  // Set CSS size to match logical size
  cv.style.width = (W * scale) + 'px';
  cv.style.height = (H * scale) + 'px';
  cv.style.transform = 'none';
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ═══ GAME STATE ═══
let G = {
  on: false, paused: false, lv: 1, sc: 0, combo: 1, mxCombo: 1, tLeft: 0, done: 0, burns: 0,
  meetCD: 0, cheerCD: 0, stun: 0, comboTimer: 0, stunCount: 0
};
let tasks = [], pts = [], fts = [], bots = [], shake = 0, tick = 0;

// ═══ LOGGER STATE ═══
const GAME_ID = "GM-SPRINTCHAOS";
let playerPseudoId = "";
let sessionId = "";
const LOG_EVENTS = [];

function logEvent(eventType, payload = {}) {
  if (!playerPseudoId) return;
  LOG_EVENTS.push({
    ts: new Date().toISOString(),
    playerPseudoId: playerPseudoId,
    sessionId: sessionId,
    gameId: GAME_ID,
    eventType: eventType,
    payload: payload
  });
}

function checkPlayerId() {
  const input = document.getElementById('player-id');
  const btn = document.getElementById('btn-play');
  if (input.value.trim().length > 0) {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
  } else {
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';
  }
}

function startSession() {
  const input = document.getElementById('player-id');
  playerPseudoId = input.value.trim();
  sessionId = 'sess_' + Math.random().toString(36).substring(2, 10);
  logEvent('session_start');
  showMap();
}

function downloadLogs() {
  if (LOG_EVENTS.length === 0) {
    alert("No game logs generated yet! Play a sprint first.");
    return;
  }
  const jsonl = LOG_EVENTS.map(e => JSON.stringify(e)).join('\n');
  const blob = new Blob([jsonl], { type: 'application/x-jsonlines' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gpaf_logs_${playerPseudoId}_${Date.now()}.jsonl`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// DOM cache for performance
let DOM = {};
function cacheDom() {
  DOM.tm = document.getElementById('h-tm');
  DOM.sc = document.getElementById('h-sc');
  DOM.gl = document.getElementById('h-gl');
  DOM.co = document.getElementById('h-co');
  DOM.tq = document.getElementById('tq-list');
  DOM.stun = document.getElementById('stun');
  DOM.speech = document.getElementById('stun-speech');
  DOM.tut = document.getElementById('tutorial-overlay');
  DOM.mp = document.getElementById('motivation-popup');
}

// ═══ LEVELS ═══
const LVL = [null,
  { id: 1, goal: 3, time: 90, bots: 0, lay: 1, move: false, label: 'SPRINT 1', sub: 'Tutorial — The Leader', emoji: '📚', tutorial: 1, starTime: 10, starStuns: 1 },
  { id: 2, goal: 10, time: 80, bots: 1, lay: 2, move: false, label: 'SPRINT 2', sub: 'Time Wasters', emoji: '🗣️', tutorial: 2, starTime: 8, starStuns: 2 },
  { id: 3, goal: 12, time: 70, bots: 2, lay: 1, move: false, label: 'SPRINT 3', sub: 'Double Trouble', emoji: '😰', starTime: 8, starStuns: 3 },
  { id: 4, goal: 14, time: 65, bots: 2, lay: 2, move: true, label: 'SPRINT 4', sub: 'Musical Chairs', emoji: '💺', starTime: 5, starStuns: 3 },
  { id: 5, goal: 15, time: 50, bots: 2, lay: 1, move: true, label: 'SPRINT 5', sub: 'Fog of War', emoji: '🌫️', special: 'fog', starTime: 3, starStuns: 5 },
  { id: 6, goal: 17, time: 55, bots: 3, lay: 2, move: true, label: 'SPRINT 6', sub: 'Clean Floor', emoji: '🧊', special: 'speedZones', starTime: 5, starStuns: 4 },
  { id: 7, goal: 16, time: 60, bots: 3, lay: 1, move: true, label: 'SPRINT 7', sub: 'Ghost Talkers', emoji: '👻', special: 'stealth', starTime: 5, starStuns: 4 },
  { id: 8, goal: 15, time: 50, bots: 5, lay: 2, move: true, label: 'SPRINT 8', sub: 'Runaway Backlog!', emoji: '🏃‍♂️', special: 'movingBoard', starTime: 3, starStuns: 5 }
];

// ═══ MOTIVATION SAYINGS ═══
const MOTIVATIONS = [
  '🌟 Great job, keep it up!', '💪 You\'re on fire!', '🏆 Outstanding work!',
  '⭐ You\'re a rockstar!', '🎯 Nailed it!', '🚀 Keep that momentum!',
  '👏 Excellent delivery!', '🙌 The team needs you!', '💎 Quality work!',
  '🔥 Unstoppable!', '✨ Brilliant effort!', '🎖️ Top performer!',
  '💫 You make the team shine!', '🏅 MVP material!', '👑 Leading by example!',
  '🌈 Spreading positivity!', '⚡ Energizing the team!', '🎉 Celebrate this win!',
  '💯 Perfect execution!', '🦾 Powering through!'
];

// ═══ TALKER (TIME-WASTER) SAYINGS ═══
const TALKER_SAYINGS = [
  '"Hey, did you see the game last night?"', '"So about that meeting tomorrow..."',
  '"Let me tell you about my weekend..."', '"Have you tried the new coffee blend?"',
  '"I think we should restructure the org chart."', '"Let\'s circle back on synergies..."',
  '"Per my last email..."', '"Can we take this offline?"',
  '"Let me give you some unsolicited advice..."', '"This reminds me of a funny story..."',
  '"Did you hear the latest gossip?"', '"Let\'s schedule a meeting about meetings."',
  '"Quick question — got 30 minutes?"'
];

// ═══ SPEED ZONES (for level 6 special) ═══
let speedZones = [];
function initSpeedZones() {
  speedZones = [];
  const laneThickness = 90;
  // Horizontal lane
  speedZones.push({
    x: 0, y: H / 2 - laneThickness / 2, w: W, h: laneThickness, boost: 2.2
  });
  // Vertical lane
  speedZones.push({
    x: W / 2 - laneThickness / 2, y: 0, w: laneThickness, h: H, boost: 2.2
  });
}

// ═══ TUTORIAL STATE ═══
let tutorialPhase = 0, tutorialActive = false, tutorialPaused = false;
const TUTORIAL_STEPS = [
  // Phase 0: WASD
  { icon: '👥', title: 'Welcome, Team Leader!', text: 'You are the Project Manager — the leader of a development team. Use WASD to move around the office.' },
  // Phase 1: Backlog
  { icon: '📋', title: 'The Backlog Board', text: 'Tasks appear on the BACKLOG board (the purple circle). Walk up to it and press E to pick up a task.' },
  // Phase 2: Deliver
  { icon: '🎯', title: 'Delegate Tasks', text: 'Great! Now deliver this task to the correct developer by walking to their desk and pressing E.' },
  // Phase 3: Motivation
  { icon: '❤️', title: 'Keep Morale High!', text: 'After completing 3 tasks, workers become exhausted. Walk up to them and press F to motivate them!' },
  
  // Phase 4 (Level 2): Time Wasters
  { icon: '🗣️', title: 'Beware of Time Wasters!', text: 'Some people will try to hold you up with useless chatter. Avoid them, or you\'ll drop your task!' },
  // Phase 5: Dash
  { icon: '⚡', title: 'Speed & Productivity', text: 'Press SHIFT while moving to DASH. Use it to escape time wasters and deliver tasks quickly!' }
];

// ═══ ROLES ═══
const R = {
  FE: { name: 'Frontend', col: '#3b82f6', hair: '#60a5fa', acc: 'glasses', icon: '🖥️' },
  BE: { name: 'Backend', col: '#ec4899', hair: '#f472b6', acc: 'hoodie', icon: '⚙️' },
  QA: { name: 'QA', col: '#f59e0b', hair: '#fbbf24', acc: 'hat', icon: '🔍' },
  DO: { name: 'DevOps', col: '#8b5cf6', hair: '#a78bfa', acc: 'helmet', icon: '🚀' }
};
let BOARD = { x: 550, y: 120, r: 42, vx: 0, vy: 0 };

const TASKS = [
  { n: 'Login Page', r: 'FE' }, { n: 'Dashboard', r: 'FE' }, { n: 'Nav Bar', r: 'FE' },
  { n: 'API Routes', r: 'BE' }, { n: 'DB Schema', r: 'BE' }, { n: 'Auth Flow', r: 'BE' },
  { n: 'Unit Tests', r: 'QA' }, { n: 'Bug Hunt', r: 'QA' }, { n: 'E2E Tests', r: 'QA' },
  { n: 'CI/CD Pipe', r: 'DO' }, { n: 'Docker', r: 'DO' }, { n: 'K8s Deploy', r: 'DO' }
];

// ═══ TEAMMATES ═══
let M = {};
function initMates(lv) {
  M = {};
  const L = LVL[lv];
  const P = L.lay === 1
    ? [{ x: 920, y: 240 }, { x: 920, y: 560 }, { x: 180, y: 560 }, { x: 180, y: 240 }]
    : [{ x: 220, y: 375 }, { x: 880, y: 375 }, { x: 550, y: 220 }, { x: 550, y: 600 }];
    
  let wCount = 4;
  if (lv === 1) wCount = 1;
  else if (lv === 2) wCount = 2;
  else if (lv === 3) wCount = 3;
  
  let i = 0;
  for (const k in R) {
    if (i >= wCount) break;
    M[k] = {
      ...R[k], x: P[i].x, y: P[i].y, ox: P[i].x, oy: P[i].y, tx: P[i].x, ty: P[i].y,
      en: 100, tr: 60, wk: false, prog: 0, colN: 0, cd: 0, idle: Math.random() * 6, rd: 65, tasksDelivered: 0, needsMotivation: false
    };
    i++;
  }
}

// ═══ PLAYER ═══
const P = {
  x: 550, y: 400, r: 22, spd: 5, dir: 1, held: null,
  vx: 0, vy: 0,
  dash: false, dCD: 0, dT: 0, dDX: 0, dDY: 0, bob: 0, trail: [], walkFrame: 0
};
const K = {};
window.addEventListener('keydown', e => { 
  K[e.code] = true; 
  if (['Space', 'ShiftLeft', 'ShiftRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape') togglePause();
});
window.addEventListener('keyup', e => K[e.code] = false);

// ═══ UPDATE ═══
let lastFrameTime = 0;
let accumulator = 0;
const TARGET_DT = 1 / 60; // 60fps target

function update(dt) {
  if (!G.on || tutorialPaused || G.paused) return;
  tick++; const now = Date.now(); const lv = LVL[G.lv];

  // Timer (use dt for frame-rate independence)
  G.tLeft -= dt;
  const pct = Math.max(0, G.tLeft / lv.time);
  DOM.tm.style.width = (pct * 100) + '%';
  DOM.tm.className = 'timer-fill' + (pct < .25 ? ' urgent' : '');
  if (G.tLeft <= 0) { endGame(G.sc >= lv.goal, 'Time ran out!'); return }

  // Cooldowns
  if (G.meetCD > 0) G.meetCD -= dt;
  if (G.cheerCD > 0) G.cheerCD -= dt;
  if (G.comboTimer > 0) { G.comboTimer -= dt; if (G.comboTimer <= 0) { G.combo = 1; updHUD() } }

  // Stun
  if (G.stun > 0) { G.stun -= dt; if (G.stun <= 0) { DOM.stun.classList.remove('on'); DOM.speech.classList.remove('on') } }

  // ── Player Movement ──
  let dx = 0, dy = 0;
  if (G.stun <= 0) {
    if (K['KeyW'] || K['ArrowUp']) dy -= 1;
    if (K['KeyS'] || K['ArrowDown']) dy += 1;
    if (K['KeyA'] || K['ArrowLeft']) { dx -= 1; P.dir = -1 }
    if (K['KeyD'] || K['ArrowRight']) { dx += 1; P.dir = 1 }
    if (dx && dy) { dx *= .707; dy *= .707 }

    // Dash
    if ((K['ShiftLeft'] || K['ShiftRight'] || K['KeyJ']) && P.dCD <= 0 && (dx || dy)) {
      P.dash = true; P.dCD = 12; P.dT = 7;
      const len = Math.hypot(dx, dy); P.dDX = dx / len; P.dDY = dy / len;
      burst(P.x, P.y, 12, '#a78bfa', 5); K['ShiftLeft'] = K['ShiftRight'] = K['KeyJ'] = false;
    }
    if (P.dCD > 0) P.dCD--;

    if (P.dash && P.dT > 0) {
      P.x = clamp(P.x + P.dDX * 17, 28, W - 28);
      P.y = clamp(P.y + P.dDY * 17, 28, H - 28);
      P.dT--; P.trail.push({ x: P.x, y: P.y, a: .7, c: '#a78bfa' });
      if (P.trail.length > 10) P.trail.shift();
      if (!P.dT) P.dash = false;
    } else if (!P.dash && (dx || dy)) {
      // Slippery Ice zones (level 6 special)
      let onIce = false;
      if (lv.special === 'speedZones') {
        for (const z of speedZones) {
          if (P.x > z.x && P.x < z.x + z.w && P.y > z.y && P.y < z.y + z.h) { onIce = true; break; }
        }
      }
      
      const targetVx = dx * P.spd;
      const targetVy = dy * P.spd;
      
      if (onIce) {
        // Slippery acceleration (drifting)
        P.vx += (targetVx - P.vx) * 0.08;
        P.vy += (targetVy - P.vy) * 0.08;
      } else {
        // Normal tight controls
        P.vx = targetVx;
        P.vy = targetVy;
      }

      P.x = clamp(P.x + P.vx, 28, W - 28);
      P.y = clamp(P.y + P.vy, 28, H - 28);
      P.bob += .22; P.walkFrame += .15;
      P.trail.push({ x: P.x, y: P.y, a: .25, c: '#94a3b8' });
      if (P.trail.length > 5) P.trail.shift();
    } else if (!dx && !dy) {
      let onIce = false;
      if (lv.special === 'speedZones') {
        for (const z of speedZones) {
          if (P.x > z.x && P.x < z.x + z.w && P.y > z.y && P.y < z.y + z.h) { onIce = true; break; }
        }
      }
      if (onIce) {
        P.vx *= 0.92;
        P.vy *= 0.92;
        P.x = clamp(P.x + P.vx, 28, W - 28);
        P.y = clamp(P.y + P.vy, 28, H - 28);
      } else {
        P.vx = 0; P.vy = 0;
      }
    }

    // Actions
    if (K['KeyE'] || K['KeyK']) { K['KeyE'] = K['KeyK'] = false; doInteract() }
    if ((K['KeyF'] || K['KeyL']) && G.cheerCD > 0 === false) { K['KeyF'] = K['KeyL'] = false; doCheer() }
  }

  const speedMult = dt / TARGET_DT; // frame-rate independent movement

  // ── Moving Backlog Board (Level 8 special) ──
  if (lv.special === 'movingBoard') {
    BOARD.x += BOARD.vx * speedMult;
    BOARD.y += BOARD.vy * speedMult;
    if (BOARD.x < BOARD.r + 30 || BOARD.x > W - BOARD.r - 30) { BOARD.vx *= -1; BOARD.x = clamp(BOARD.x, BOARD.r + 30, W - BOARD.r - 30) }
    if (BOARD.y < BOARD.r + 30 || BOARD.y > H - BOARD.r - 30) { BOARD.vy *= -1; BOARD.y = clamp(BOARD.y, BOARD.r + 30, H - BOARD.r - 30) }
  }

  // ── Talkers (Time Wasters) ──
  for (const b of bots) {
    // Stealth mode (level 5 special) - 2s visible, 1.5s invisible staggered
    if (lv.special === 'stealth') {
      const cycleTime = 3500;
      const tInCycle = (now + b.ang * 1000) % cycleTime;
      b.visible = tInCycle < 2000;
    } else {
      b.visible = true;
    }
    // Swarm mode: talkers chase the player (level 8 special)
    if (lv.special === 'swarm') {
      const chaseA = Math.atan2(P.y - b.y, P.x - b.x);
      const chaseSpd = 1.5 + G.lv * 0.2;
      b.vx += Math.cos(chaseA) * 0.08 * speedMult;
      b.vy += Math.sin(chaseA) * 0.08 * speedMult;
      const maxV = chaseSpd;
      const curSpd = Math.hypot(b.vx, b.vy);
      if (curSpd > maxV) { b.vx = (b.vx / curSpd) * maxV; b.vy = (b.vy / curSpd) * maxV; }
    }
    b.x += b.vx * speedMult; b.y += b.vy * speedMult; b.ang += .05;
    if (b.x < b.r + 10 || b.x > W - b.r - 10) { b.vx *= -1; b.x = clamp(b.x, b.r + 10, W - b.r - 10) }
    if (b.y < b.r + 10 || b.y > H - b.r - 10) { b.vy *= -1; b.y = clamp(b.y, b.r + 10, H - b.r - 10) }
    // Hit player - talker grabs you (only if visible)
    if (b.visible && G.stun <= 0 && !P.dash && dist(P.x, P.y, b.x, b.y) < P.r + b.r) {
      G.stun = 1.8; shake = 18; sfxStun();
      burst(P.x, P.y, 25, '#64748b', 5);
      document.getElementById('stun').classList.add('on');
      const saying = TALKER_SAYINGS[Math.floor(Math.random() * TALKER_SAYINGS.length)];
      const ss = document.getElementById('stun-speech');
      ss.textContent = '🗣️ ' + saying; ss.classList.add('on');
      G.stunCount++;
      if (P.held) { tasks.push(P.held); P.held = null; ftxt('📋 Dropped task!', P.x, P.y - 50, '#ef4444') }
      else ftxt('🗣️ Held up!', P.x, P.y - 50, '#64748b');
      G.combo = 1; updHUD();
    }
  }

  // ── Teammates ──
  const mateKeys = Object.keys(M);
  for (const k of mateKeys) {
    const t = M[k]; t.idle += .06;

    // Moving workers
    if (lv.move && !t.wk && t.cd <= 0) {
      if (G.lv === 4 || G.lv === 5) {
        // Circular orbit movement
        const orbitRadius = 80;
        const orbitSpeed = 0.0015;
        // Generate unique orbit center and phase based on worker key
        const hash = k.charCodeAt(0) + (k.charCodeAt(1) || 0); 
        const phaseOffset = hash * 2;
        const centerX = clamp(t.ox + Math.sin(phaseOffset) * 100, 200, W - 200);
        const centerY = clamp(t.oy + Math.cos(phaseOffset) * 100, 200, H - 200);
        
        t.tx = centerX + Math.cos(now * orbitSpeed + phaseOffset) * orbitRadius;
        t.ty = centerY + Math.sin(now * orbitSpeed + phaseOffset) * orbitRadius;
        
        const a = Math.atan2(t.ty - t.y, t.tx - t.x);
        t.x += Math.cos(a) * 2.0 * speedMult;
        t.y += Math.sin(a) * 2.0 * speedMult;
      } else {
        // Active wandering logic
        if (dist(t.x, t.y, t.tx, t.ty) < 8) {
          if (Math.random() < .025) {
            t.tx = clamp(t.ox + (Math.random() - .5) * 450, 120, W - 120);
            t.ty = clamp(t.oy + (Math.random() - .5) * 450, 120, H - 120);
          }
        } else {
          const a = Math.atan2(t.ty - t.y, t.tx - t.x);
          t.x += Math.cos(a) * 2.2 * speedMult;
          t.y += Math.sin(a) * 2.2 * speedMult;
        }
      }
    }

    // Collision avoidance — ALWAYS active for ALL workers
    // Repel from other workers
    let pushX = 0, pushY = 0;
    for (const ok of mateKeys) {
      if (ok === k) continue;
      const o = M[ok];
      const d = dist(t.x, t.y, o.x, o.y);
      const minDist = 140; // Prevent overlapping circles
      if (d < minDist && d > 0) {
        const repelStrength = (minDist - d) / minDist * 8; // Strong repel
        pushX += ((t.x - o.x) / d) * repelStrength;
        pushY += ((t.y - o.y) / d) * repelStrength;
      }
    }
    // Repel from backlog board
    const dBoard = dist(t.x, t.y, BOARD.x, BOARD.y);
    const minBoardDist = 120;
    if (dBoard < minBoardDist && dBoard > 0) {
      const repelStrength = (minBoardDist - dBoard) / minBoardDist * 4;
      pushX += ((t.x - BOARD.x) / dBoard) * repelStrength;
      pushY += ((t.y - BOARD.y) / dBoard) * repelStrength;
    }
    if (pushX !== 0 || pushY !== 0) {
      t.x += pushX; t.y += pushY;
      t.tx = t.x; t.ty = t.y; // reset target so they don't walk back
    }
    t.x = clamp(t.x, 150, W - 150);
    t.y = clamp(t.y, 150, H - 150);

    if (t.cd > 0) { t.cd -= dt; continue }
    if (t.wk) {
      const spd = t.tr > 70 ? .016 : .01;
      t.prog += spd * (G.lv * .25 + .75);
      if (tick % 5 === 0 && Math.random() < .5) burst(t.x + (Math.random() - .5) * 30, t.y - 15, 1, t.col, 1.5);
      if (t.prog >= 1) {
        t.wk = false; t.prog = 0; G.sc++; G.done++;
        logEvent('score_update', { score: G.sc, total_shipped: G.done });
        G.combo = Math.min(G.combo + 1, 8); G.comboTimer = 5;
        G.mxCombo = Math.max(G.mxCombo, G.combo);
        updHUD();
        ftxt('✅ +' + G.combo + '!', t.x, t.y - 70, '#10b981');
        burst(t.x, t.y, 22, '#10b981', 4); shake = 5;
        t.tr = Math.min(100, t.tr + 5); sfxGood();
        if (G.combo >= 3) sfxCombo();
        if (G.sc >= lv.goal) { endGame(true); return }
      }
    }
    if (t.tr <= 0) { endGame(false, t.name + ' rage-quit!'); return }
  }

  // Particles
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; p.x += p.vx; p.y += p.vy; p.vy += .15; p.life--; if (p.life <= 0) pts.splice(i, 1) }
  for (let i = fts.length - 1; i >= 0; i--) { const f = fts[i]; f.y -= 1.2; f.a -= .014; f.s += .008; if (f.a <= 0) fts.splice(i, 1) }
  for (let i = P.trail.length - 1; i >= 0; i--) { P.trail[i].a -= .07; if (P.trail[i].a <= 0) P.trail.splice(i, 1) }
  if (shake > 0) shake -= .7;

  updQueue();
}

// ═══ INTERACTIONS ═══
function doInteract() {
  // Backlog board
  if (dist(P.x, P.y, BOARD.x, BOARD.y) < 95) {
    if (!P.held && tasks.length > 0) { P.held = tasks.shift(); sfxPick(); ftxt('📋 Got it!', BOARD.x, BOARD.y - 55, '#fbbf24'); burst(BOARD.x, BOARD.y, 10, '#fbbf24', 3); checkTutorialTrigger('pickup') }
    else if (!P.held) ftxt('Empty!', BOARD.x, BOARD.y - 55, '#64748b');
    return;
  }
  // Teammates
  for (const k in M) {
    const t = M[k];
    if (dist(P.x, P.y, t.x, t.y) < 105) {
      if (!P.held) { ftxt('Need a task!', t.x, t.y - 70, '#64748b'); return }
      if (t.needsMotivation) { ftxt('😩 Exhausted! Motivate [F/L]!', t.x, t.y - 70, '#f59e0b'); sfxBad(); return }
      if (t.tr < 15) { ftxt('💔 Too stressed!', t.x, t.y - 70, '#ef4444'); burst(t.x, t.y, 8, '#ef4444'); sfxBad(); return }
      if (t.wk || t.cd > 0) { ftxt('⏳ Busy!', t.x, t.y - 70, '#f59e0b'); return }
      if (P.held.r === k) {
        t.wk = true; P.held = null; t.tasksDelivered++;
        ftxt('🎯 Perfect!', t.x, t.y - 70, '#10b981'); burst(t.x, t.y, 15, t.col, 3); sfxPick();
        checkTutorialTrigger('deliver');
        // Every 3 tasks, worker needs motivation
        if (t.tasksDelivered % 3 === 0) {
          t.needsMotivation = true;
          t.en = 0; t.tr = Math.max(0, t.tr - 10);
          ftxt('😓 Needs motivation!', t.x, t.y - 90, '#f59e0b');
          checkTutorialTrigger('exhausted');
        }
      } else {
        ftxt('❌ Wrong person!', t.x, t.y - 70, '#ef4444');
        t.tr = Math.max(0, t.tr - 12); tasks.push(P.held); P.held = null;
        shake = 10; burst(t.x, t.y, 12, '#ef4444', 3); sfxBad(); G.combo = 1; G.comboTimer = 0; updHUD();
      }
    }
  }
}

function doCheer() {
  G.cheerCD = 2.5; let hit = false;
  const saying = MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)];
  for (const k in M) {
    const t = M[k];
    if (dist(P.x, P.y, t.x, t.y) < 120) {
      if (t.needsMotivation) {
        t.needsMotivation = false;
        t.en = Math.min(100, t.en + 35); t.tr = Math.min(100, t.tr + 20);
        ftxt(saying, t.x, t.y - 70, '#34d399'); burst(t.x, t.y - 20, 18, '#34d399', 3);
        showMotivationPopup(saying);
      } else {
        t.en = Math.min(100, t.en + 20); t.tr = Math.min(100, t.tr + 8);
        ftxt('✨ ' + saying, t.x, t.y - 70, '#38bdf8'); burst(t.x, t.y - 20, 10, '#38bdf8', 2);
      }
      hit = true;
    }
  }
  if (!hit) ftxt('Too far!', P.x, P.y - 40, '#64748b');
}

// ═══ HELPERS ═══
function spawnTask() { 
  const validTasks = TASKS.filter(t => M[t.r]);
  const t = validTasks[Math.floor(Math.random() * validTasks.length)]; 
  tasks.push({ ...t, id: Date.now() + Math.random(), dl: 999, sp: Date.now() }) 
}
function ftxt(t, x, y, c) { fts.push({ text: t, x, y, a: 1, s: 1, color: c }) }
function burst(x, y, n, c, s = 2) { if (pts.length > 80) return; for (let i = 0; i < n; i++)pts.push({ x, y, vx: (Math.random() - .5) * s * 2, vy: (Math.random() - 1) * s * 2.5, life: 25 + Math.random() * 18, color: c, sz: 2 + Math.random() * 3 }) }
function dist(a, b, c, d) { return Math.hypot(a - c, b - d) }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }

function updHUD() {
  DOM.sc.textContent = G.sc;
  DOM.gl.textContent = G.sc + '/' + LVL[G.lv].goal;
  DOM.co.textContent = 'x' + G.combo;
  
  // Star Tracker
  const stList = document.getElementById('st-list');
  if (stList) {
    const lv = LVL[G.lv];
    const isGoalMet = G.sc >= lv.goal;
    const distPass = G.stunCount <= lv.starStuns;
    const timePass = Math.ceil(G.tLeft) >= lv.starTime;
    
    stList.innerHTML = `
      <div class="st-item ${isGoalMet ? 'pass' : ''}">
        ${isGoalMet ? '✅' : '⬜'} Finish sprint
      </div>
      <div class="st-item ${distPass ? 'pass' : 'fail'}">
        ${distPass ? '✅' : '❌'} Distractions &le; ${lv.starStuns} (Current: ${G.stunCount})
      </div>
      <div class="st-item ${timePass ? 'pass' : 'fail'}">
        ${timePass ? '✅' : '❌'} Finish with &ge; ${lv.starTime}s
      </div>
    `;
  }
}
function updQueue() {
  const el = DOM.tq; el.innerHTML = '';
  const shown = tasks.slice(0, 5);
  for (let i = 0; i < shown.length; i++) {
    const t = shown[i], s = R[t.r];
    const d = document.createElement('div'); d.className = 'tq-item'; d.style.borderLeftColor = s.col;
    d.innerHTML = `<span>${s.icon} ${t.n}</span><span class="tq-dl">${tasks.length} left</span>`;
    el.appendChild(d);
  }
}


let motivTO;
function showMotivationPopup(text) {
  const el = document.getElementById('motivation-popup');
  el.textContent = text; el.classList.add('show');
  clearTimeout(motivTO);
  motivTO = setTimeout(() => el.classList.remove('show'), 2500);
}

// ═══ DRAW ═══
function draw() {
  cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.scale(drawScale, drawScale);

  const sx = shake > 0 ? (Math.random() - .5) * shake * 2 : 0;
  const sy = shake > 0 ? (Math.random() - .5) * shake * 2 : 0;
  cx.save(); cx.translate(sx, sy);

  // Floor
  cx.fillStyle = '#0f172a'; cx.fillRect(0, 0, W, H);
  // Carpet tiles
  for (let gx = 0; gx < W; gx += 80)for (let gy = 0; gy < H; gy += 80) {
    cx.fillStyle = (Math.floor(gx / 80) + Math.floor(gy / 80)) % 2 === 0 ? '#131c33' : '#111827';
    cx.fillRect(gx, gy, 80, 80);
  }
  // Subtle grid
  cx.strokeStyle = 'rgba(255,255,255,.025)'; cx.lineWidth = 1;
  for (let x = 0; x < W; x += 80) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke() }
  for (let y = 0; y < H; y += 80) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke() }

  // Dashed paths
  if (!LVL[G.lv].move) {
    cx.strokeStyle = '#1e293b'; cx.lineWidth = 6; cx.setLineDash([12, 16]);
    const ks = Object.keys(M);
    for (let i = 0; i < ks.length; i++)for (let j = i + 1; j < ks.length; j++) {
      cx.beginPath(); cx.moveTo(M[ks[i]].x, M[ks[i]].y); cx.lineTo(M[ks[j]].x, M[ks[j]].y); cx.stroke();
    }
    cx.setLineDash([]);
  }

  // Office decorations
  drawWhiteboard(550, 50);
  drawPlant(60, 60); drawPlant(W - 60, 60); drawPlant(60, H - 60); drawPlant(W - 60, H - 60);
  drawCoffeeMachine(60, H / 2);

  // Backlog Board
  cx.save(); cx.shadowBlur = 25; cx.shadowColor = 'rgba(139,92,246,.35)';
  cx.fillStyle = '#7c3aed'; cx.beginPath(); cx.arc(BOARD.x, BOARD.y, BOARD.r + 6, 0, Math.PI * 2); cx.fill();
  cx.fillStyle = '#1e1b4b'; cx.beginPath(); cx.arc(BOARD.x, BOARD.y, BOARD.r, 0, Math.PI * 2); cx.fill();
  cx.shadowBlur = 0;
  cx.fillStyle = '#c4b5fd'; cx.font = '800 13px Nunito'; cx.textAlign = 'center';
  cx.fillText('BACKLOG', BOARD.x, BOARD.y - 5);
  cx.fillStyle = '#f1f5f9'; cx.font = '900 22px Nunito'; cx.fillText(tasks.length, BOARD.x, BOARD.y + 18);
  cx.restore();

  // Stations & Mates
  for (const k in M) {
    const t = M[k], isT = P.held && P.held.r === k;
    const prox = dist(P.x, P.y, t.x, t.y) < 120;

    // Glow ring if target
    if (isT) {
      cx.save(); cx.shadowBlur = 30; cx.shadowColor = t.col;
      cx.strokeStyle = t.col; cx.lineWidth = 4;
      cx.beginPath(); cx.arc(t.x, t.y, t.rd + 25, 0, Math.PI * 2); cx.stroke();
      cx.restore();
    }

    const ringCol = t.needsMotivation ? '#ef4444' : t.col;

    // Station circle
    cx.fillStyle = ringCol + '18'; cx.beginPath(); cx.arc(t.x, t.y, t.rd + 20, 0, Math.PI * 2); cx.fill();
    cx.strokeStyle = ringCol + (isT ? 'aa' : '44'); cx.lineWidth = isT ? 4 : 2;
    cx.beginPath(); cx.arc(t.x, t.y, t.rd + 20, 0, Math.PI * 2); cx.stroke();

    // Desk
    cx.fillStyle = '#1e293b'; rr(t.x - 55, t.y - 10, 110, 40, 10); cx.fill();
    cx.strokeStyle = t.col + '66'; cx.lineWidth = 2; rr(t.x - 55, t.y - 10, 110, 40, 10); cx.stroke();
    // Monitor on desk
    cx.fillStyle = '#0f172a'; rr(t.x - 18, t.y - 25, 36, 20, 4); cx.fill();
    cx.fillStyle = t.col + '55'; rr(t.x - 15, t.y - 22, 30, 14, 3); cx.fill();
    cx.fillStyle = '#334155'; cx.fillRect(t.x - 4, t.y - 5, 8, 6);// stand

    // Character
    const bounce = Math.sin(t.idle) * 4;
    drawCharacter(t.x - 40, t.y - 35 + bounce, t.col, t.hair, t.acc, t.wk, t.cd > 0, t.en, t.tr);

    // Name badge
    cx.fillStyle = '#0f172a'; rr(t.x - 42, t.y + 45, 84, 24, 8); cx.fill();
    cx.fillStyle = '#e2e8f0'; cx.font = '700 12px Nunito'; cx.textAlign = 'center';
    cx.fillText(t.icon + ' ' + t.name, t.x, t.y + 62);

    // Dynamic Task text / Trust Bar
    if (t.needsMotivation) { 
      cx.fillStyle = '#ef4444'; cx.font = '900 20px Nunito'; cx.fillText('💥 EXHAUSTED! [F/L]', t.x, t.y - 100);
    } else {
      const tasksLeft = 3 - (t.tasksDelivered % 3);
      cx.fillStyle = '#10b981'; cx.font = '800 13px Nunito';
      cx.fillText(tasksLeft + (tasksLeft === 1 ? ' task' : ' tasks'), t.x, t.y - 80);
    }
    
    if (t.wk) {
      drawBar(t.x - 42, t.y - 92, 84, 10, t.prog, t.col, '');
      cx.fillStyle = '#fbbf24'; cx.font = '800 13px Nunito'; cx.fillText('⚙️ Working…', t.x, t.y - 100);
    }
    if (t.cd > 0) { cx.fillStyle = '#ef4444'; cx.font = '800 13px Nunito'; cx.fillText('😵 ' + Math.ceil(t.cd) + 's', t.x, t.y - 100) }

    // Proximity hint
    if (prox && !t.wk && t.cd <= 0 && P.held) {
      cx.fillStyle = P.held.r === k ? '#10b981' : '#ef4444'; cx.font = '800 14px Nunito';
      cx.fillText(P.held.r === k ? '[E/K] Assign' : 'Wrong role!', t.x, t.y - 110);
    }
    cx.textAlign = 'start';
  }

  // Trail
  P.trail.forEach((tr, i) => { cx.fillStyle = tr.c; cx.globalAlpha = tr.a * .5; cx.beginPath(); cx.arc(tr.x, tr.y, P.r * (1 - i / P.trail.length), 0, Math.PI * 2); cx.fill() });
  cx.globalAlpha = 1;

  // Player
  const py = P.y + Math.sin(P.bob) * 3;
  drawPlayerChar(P.x, py, P.dir, G.stun > 0);

  // Dash ring
  if (P.dCD > 0) { cx.strokeStyle = 'rgba(167,139,250,.45)'; cx.lineWidth = 3; cx.beginPath(); cx.arc(P.x, py, P.r + 10, -Math.PI / 2, -Math.PI / 2 + (1 - P.dCD / 12) * Math.PI * 2); cx.stroke() }

  // Held task
  if (P.held) {
    const tb = Math.sin(Date.now() * .005) * 4, sc = R[P.held.r];
    cx.fillStyle = '#1e293b'; rr(P.x - 44, py - 82 + tb, 88, 28, 8); cx.fill();
    cx.strokeStyle = sc.col; cx.lineWidth = 3; rr(P.x - 44, py - 82 + tb, 88, 28, 8); cx.stroke();
    cx.fillStyle = '#f1f5f9'; cx.font = '800 12px Nunito'; cx.textAlign = 'center';
    cx.fillText(P.held.n, P.x, py - 63 + tb);
    // Arrow to correct station
    if (M[P.held.r]) {
      const mt = M[P.held.r]; const a = Math.atan2(mt.y - P.y, mt.x - P.x);
      const ax = P.x + Math.cos(a) * 45, ay = py + Math.sin(a) * 45;
      cx.fillStyle = sc.col; cx.beginPath(); cx.arc(ax, ay, 6, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = sc.col + '88'; cx.beginPath(); cx.arc(ax, ay, 10 + Math.sin(tick * .1) * 3, 0, Math.PI * 2); cx.fill();
    }
    cx.textAlign = 'start';
  }

  // Ice zones (level 6 special)
  if (LVL[G.lv].special === 'speedZones') {
    for (const z of speedZones) {
      cx.save();
      
      cx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      cx.fillRect(z.x, z.y, z.w, z.h);
      
      cx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; cx.lineWidth = 2; cx.setLineDash([10, 10]);
      if (z.w > z.h) { // Horizontal
        cx.beginPath(); cx.moveTo(z.x, z.y); cx.lineTo(z.x + z.w, z.y); cx.stroke();
        cx.beginPath(); cx.moveTo(z.x, z.y + z.h); cx.lineTo(z.x + z.w, z.y + z.h); cx.stroke();
      } else { // Vertical
        cx.beginPath(); cx.moveTo(z.x, z.y); cx.lineTo(z.x, z.y + z.h); cx.stroke();
        cx.beginPath(); cx.moveTo(z.x + z.w, z.y); cx.lineTo(z.x + z.w, z.y + z.h); cx.stroke();
      }
      cx.setLineDash([]); cx.restore();
    }
  }

  // Talkers (time wasters)
  for (const b of bots) {
    if (b.visible) {
      drawTalker(b.x, b.y, b.r, b.ang);
    }
  }

  // Particles (round!)
  pts.forEach(p => { cx.fillStyle = p.color; cx.globalAlpha = p.life / 45; cx.beginPath(); cx.arc(p.x, p.y, p.sz, 0, Math.PI * 2); cx.fill() });
  cx.globalAlpha = 1;

  // Fog of War (level 7 special) — heavy dark overlay AFTER everything
  if (LVL[G.lv].special === 'fog') {
    cx.save();
    // Dark overlay covering the whole screen
    const fogGrad = cx.createRadialGradient(P.x, P.y, 100, P.x, P.y, 260);
    fogGrad.addColorStop(0, 'rgba(0,0,0,0)');
    fogGrad.addColorStop(0.6, 'rgba(0,0,0,0.4)');
    fogGrad.addColorStop(0.85, 'rgba(0,0,0,0.88)');
    fogGrad.addColorStop(1, 'rgba(0,0,0,0.96)');
    cx.fillStyle = fogGrad;
    cx.fillRect(0, 0, W, H);
    cx.restore();
  }

  // Float text (drawn AFTER fog so it's always visible)
  fts.forEach(f => { cx.globalAlpha = f.a; cx.fillStyle = f.color; cx.font = `900 ${16 * f.s}px Nunito`; cx.textAlign = 'center'; cx.shadowBlur = 8; cx.shadowColor = 'rgba(0,0,0,.7)'; cx.fillText(f.text, f.x, f.y); cx.shadowBlur = 0 });
  cx.globalAlpha = 1; cx.textAlign = 'start';

  cx.restore();
}

// ═══ CHARACTER ART ═══
function drawCharacter(x, y, col, hairCol, acc, working, recovering, energy, trust) {
  const cx2 = cx;
  // Shadow
  cx2.fillStyle = 'rgba(0,0,0,.25)'; cx2.beginPath(); cx2.ellipse(x + 18, y + 52, 14, 5, 0, 0, Math.PI * 2); cx2.fill();
  // Legs
  const legAnim = working ? Math.sin(Date.now() * .012) * 4 : 0;
  cx2.fillStyle = recovering ? '#334155' : '#1e293b';
  rr(x + 6, y + 38 + legAnim, 8, 14, 3); cx2.fill();
  rr(x + 22, y + 38 - legAnim, 8, 14, 3); cx2.fill();
  // Body
  cx2.fillStyle = recovering ? '#475569' : col;
  rr(x + 4, y + 18, 28, 24, 6); cx2.fill();
  // Arms
  if (working) {
    const armW = Math.sin(Date.now() * .018) * 6;
    cx2.fillStyle = col;
    rr(x - 6, y + 22 + armW, 10, 14, 4); cx2.fill();
    rr(x + 32, y + 22 - armW, 10, 14, 4); cx2.fill();
  } else {
    cx2.fillStyle = recovering ? '#475569' : col;
    rr(x - 4, y + 22, 10, 16, 4); cx2.fill();
    rr(x + 30, y + 22, 10, 16, 4); cx2.fill();
  }
  // BIG HEAD
  cx2.fillStyle = recovering ? '#94a3b8' : '#fde68a';
  cx2.beginPath(); cx2.arc(x + 18, y + 6, 18, 0, Math.PI * 2); cx2.fill();
  // Hair
  cx2.fillStyle = hairCol;
  if (acc === 'glasses') {// Frontend: messy hair + glasses
    cx2.beginPath(); cx2.arc(x + 10, y - 10, 8, 0, Math.PI * 2); cx2.fill();
    cx2.beginPath(); cx2.arc(x + 18, y - 12, 9, 0, Math.PI * 2); cx2.fill();
    cx2.beginPath(); cx2.arc(x + 26, y - 10, 8, 0, Math.PI * 2); cx2.fill();
    // Glasses
    cx2.strokeStyle = '#e2e8f0'; cx2.lineWidth = 2;
    cx2.beginPath(); cx2.arc(x + 11, y + 6, 6, 0, Math.PI * 2); cx2.stroke();
    cx2.beginPath(); cx2.arc(x + 25, y + 6, 6, 0, Math.PI * 2); cx2.stroke();
    cx2.beginPath(); cx2.moveTo(x + 17, y + 6); cx2.lineTo(x + 19, y + 6); cx2.stroke();
  } else if (acc === 'hoodie') {// Backend: hoodie
    cx2.beginPath(); cx2.arc(x + 18, y - 8, 14, Math.PI, 0); cx2.fill();
    cx2.fillRect(x + 4, y - 8, 28, 8);
  } else if (acc === 'hat') {// QA: detective hat
    cx2.fillRect(x + 4, y - 14, 28, 8);
    cx2.fillRect(x, y - 8, 36, 5);
  } else if (acc === 'helmet') {// DevOps: hard hat
    cx2.beginPath(); cx2.arc(x + 18, y - 6, 16, Math.PI, 0); cx2.fill();
    cx2.fillRect(x, y - 6, 36, 5);
    cx2.fillStyle = '#f1f5f9'; cx2.fillRect(x + 14, y - 14, 8, 6);// light
  }
  // Eyes - change based on state
  if (recovering) {
    // X_X eyes
    cx2.strokeStyle = '#ef4444'; cx2.lineWidth = 2;
    cx2.beginPath(); cx2.moveTo(x + 8, y + 2); cx2.lineTo(x + 14, y + 8); cx2.moveTo(x + 14, y + 2); cx2.lineTo(x + 8, y + 8); cx2.stroke();
    cx2.beginPath(); cx2.moveTo(x + 22, y + 2); cx2.lineTo(x + 28, y + 8); cx2.moveTo(x + 28, y + 2); cx2.lineTo(x + 22, y + 8); cx2.stroke();
    // Tongue
    cx2.fillStyle = '#f87171'; cx2.beginPath(); cx2.arc(x + 18, y + 16, 4, 0, Math.PI); cx2.fill();
  } else {
    // White eyes
    cx2.fillStyle = '#fff';
    cx2.beginPath(); cx2.arc(x + 11, y + 5, 5, 0, Math.PI * 2); cx2.fill();
    cx2.beginPath(); cx2.arc(x + 25, y + 5, 5, 0, Math.PI * 2); cx2.fill();
    // Pupils (look at player)
    const lookX = clamp((P.x - (x + 18)) / 200, -2, 2);
    const lookY = clamp((P.y - (y + 6)) / 200, -1, 1);
    cx2.fillStyle = '#1e1b4b';
    cx2.beginPath(); cx2.arc(x + 11 + lookX, y + 5 + lookY, 2.5, 0, Math.PI * 2); cx2.fill();
    cx2.beginPath(); cx2.arc(x + 25 + lookX, y + 5 + lookY, 2.5, 0, Math.PI * 2); cx2.fill();
    // Mouth
    if (energy < 30) {// tired frown
      cx2.strokeStyle = '#92400e'; cx2.lineWidth = 2; cx2.beginPath(); cx2.arc(x + 18, y + 18, 5, Math.PI * .2, Math.PI * .8); cx2.stroke();
    } else if (working) {// concentrating O
      cx2.fillStyle = '#92400e'; cx2.beginPath(); cx2.arc(x + 18, y + 14, 3, 0, Math.PI * 2); cx2.fill();
    } else {// happy smile
      cx2.strokeStyle = '#92400e'; cx2.lineWidth = 2; cx2.beginPath(); cx2.arc(x + 18, y + 10, 5, Math.PI * .2, Math.PI * .8); cx2.stroke();
    }
  }
  // Sweat drops
  if (energy < 35 && !recovering) {
    const sw = Math.sin(Date.now() * .005) * 8;
    cx2.fillStyle = '#38bdf8'; cx2.beginPath(); cx2.arc(x + 34, y + sw, 3, 0, Math.PI * 2); cx2.fill();
  }
}

function drawPlayerChar(x, y, dir, stunned) {
  // Shadow
  cx.fillStyle = 'rgba(0,0,0,.25)'; cx.beginPath(); cx.ellipse(x, y + 28, 16, 5, 0, 0, Math.PI * 2); cx.fill();
  // Legs (animated)
  const legA = Math.sin(P.walkFrame) * 5;
  cx.fillStyle = '#1e1b4b';
  rr(x - 10, y + 14 + legA, 8, 14, 3); cx.fill();
  rr(x + 2, y + 14 - legA, 8, 14, 3); cx.fill();
  // Body
  cx.fillStyle = '#7c3aed'; rr(x - 14, y - 4, 28, 22, 6); cx.fill();
  // Tie
  cx.fillStyle = '#ef4444'; cx.beginPath(); cx.moveTo(x, y - 2); cx.lineTo(x - 4, y + 10); cx.lineTo(x + 4, y + 10); cx.closePath(); cx.fill();
  // Arms
  const armA = Math.sin(P.walkFrame * .8) * 4;
  cx.fillStyle = '#7c3aed';
  rr(x + (dir === 1 ? 14 : -22), y + armA, 8, 14, 4); cx.fill();
  rr(x + (dir === 1 ? -18 : 10), y - armA, 8, 14, 4); cx.fill();
  // BIG HEAD
  cx.fillStyle = '#fcd34d'; cx.beginPath(); cx.arc(x, y - 16, 20, 0, Math.PI * 2); cx.fill();
  // PM Crown
  cx.fillStyle = '#f59e0b';
  cx.beginPath(); cx.moveTo(x - 14, y - 30); cx.lineTo(x - 10, y - 38); cx.lineTo(x - 4, y - 32);
  cx.lineTo(x, y - 42); cx.lineTo(x + 4, y - 32); cx.lineTo(x + 10, y - 38); cx.lineTo(x + 14, y - 30); cx.closePath(); cx.fill();
  // Eyes
  if (stunned) {
    // Dizzy spiral eyes
    cx.strokeStyle = '#5b21b6'; cx.lineWidth = 2;
    for (let e = -8; e <= 8; e += 16) {
      cx.beginPath();
      for (let a = 0; a < Math.PI * 3; a += .2) {
        const r = a * 1.2; cx.lineTo(x + e + Math.cos(a + tick * .15) * r * .3, y - 16 + Math.sin(a + tick * .15) * r * .3);
      }
      cx.stroke();
    }
    // Stars spinning
    for (let i = 0; i < 3; i++) {
      const sa = tick * .08 + i * 2.1;
      const sx = x + Math.cos(sa) * 28, sy = y - 20 + Math.sin(sa) * 12;
      cx.fillStyle = '#fbbf24'; cx.font = '14px Nunito'; cx.textAlign = 'center'; cx.fillText('⭐', sx, sy);
    }
    cx.textAlign = 'start';
  } else {
    // White eyes
    cx.fillStyle = '#fff';
    cx.beginPath(); cx.arc(x + (dir === 1 ? -6 : -6), y - 18, 6, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.arc(x + (dir === 1 ? 8 : 8), y - 18, 6, 0, Math.PI * 2); cx.fill();
    // Pupils
    cx.fillStyle = '#1e1b4b';
    cx.beginPath(); cx.arc(x + (dir === 1 ? -4 : -8), y - 18, 3, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.arc(x + (dir === 1 ? 10 : 6), y - 18, 3, 0, Math.PI * 2); cx.fill();
    // Smile
    cx.strokeStyle = '#92400e'; cx.lineWidth = 2; cx.beginPath(); cx.arc(x, y - 8, 7, Math.PI * .15, Math.PI * .85); cx.stroke();
  }
}

// ═══ ENVIRONMENT ART ═══
function drawTalker(x, y, r, ang) {
  const bob = Math.sin(Date.now() * .003 + ang) * 3;
  const ty = y + bob;
  // Shadow
  cx.fillStyle = 'rgba(0,0,0,.2)'; cx.beginPath(); cx.ellipse(x, y + 22, 14, 5, 0, 0, Math.PI * 2); cx.fill();
  // Legs
  const legA = Math.sin(Date.now() * .008 + ang) * 4;
  cx.fillStyle = '#1e293b';
  rr(x - 10, ty + 8 + legA, 8, 14, 3); cx.fill();
  rr(x + 2, ty + 8 - legA, 8, 14, 3); cx.fill();
  // Body (dark suit)
  cx.fillStyle = '#334155'; rr(x - 14, ty - 10, 28, 22, 6); cx.fill();
  // Tie
  cx.fillStyle = '#64748b'; cx.beginPath(); cx.moveTo(x, ty - 8); cx.lineTo(x - 3, ty + 4); cx.lineTo(x + 3, ty + 4); cx.closePath(); cx.fill();
  // Arms (waving)
  const armW = Math.sin(Date.now() * .012 + ang) * 6;
  cx.fillStyle = '#334155';
  rr(x - 20, ty - 6 + armW, 8, 14, 4); cx.fill();
  rr(x + 12, ty - 6 - armW, 8, 14, 4); cx.fill();
  // Head
  cx.fillStyle = '#fcd34d'; cx.beginPath(); cx.arc(x, ty - 22, 16, 0, Math.PI * 2); cx.fill();
  // Slicked-back hair
  cx.fillStyle = '#1e293b'; cx.beginPath(); cx.arc(x, ty - 28, 13, Math.PI, 0); cx.fill();
  cx.fillRect(x - 13, ty - 28, 26, 6);
  // Eyes (looking at player)
  cx.fillStyle = '#fff';
  cx.beginPath(); cx.arc(x - 5, ty - 23, 4, 0, Math.PI * 2); cx.fill();
  cx.beginPath(); cx.arc(x + 5, ty - 23, 4, 0, Math.PI * 2); cx.fill();
  const lx = clamp((P.x - x) / 200, -2, 2), ly = clamp((P.y - ty) / 200, -1, 1);
  cx.fillStyle = '#1e1b4b';
  cx.beginPath(); cx.arc(x - 5 + lx, ty - 23 + ly, 2, 0, Math.PI * 2); cx.fill();
  cx.beginPath(); cx.arc(x + 5 + lx, ty - 23 + ly, 2, 0, Math.PI * 2); cx.fill();
  // Smirk
  cx.strokeStyle = '#92400e'; cx.lineWidth = 1.5; cx.beginPath(); cx.arc(x + 2, ty - 16, 4, 0, Math.PI * .8); cx.stroke();
  // Speech bubble if near player
  if (dist(P.x, P.y, x, y) < 100) {
    cx.save(); cx.globalAlpha = .7;
    cx.fillStyle = '#fff'; rr(x - 18, ty - 52, 36, 16, 8); cx.fill();
    cx.fillStyle = '#64748b'; cx.font = '700 9px Nunito'; cx.textAlign = 'center';
    cx.fillText('bla bla', x, ty - 40);
    cx.textAlign = 'start'; cx.restore();
  }
  // Danger glow
  cx.save(); cx.shadowBlur = 12; cx.shadowColor = 'rgba(100,116,139,.4)';
  cx.fillStyle = 'transparent'; cx.beginPath(); cx.arc(x, y, r + 3, 0, Math.PI * 2); cx.fill();
  cx.restore();
}

function drawPlant(x, y) {
  // Pot
  cx.fillStyle = '#78350f'; rr(x - 14, y - 4, 28, 22, 4); cx.fill();
  cx.fillStyle = '#92400e'; rr(x - 16, y - 6, 32, 8, 3); cx.fill();
  // Leaves
  cx.fillStyle = '#065f46';
  cx.beginPath(); cx.arc(x - 8, y - 18, 12, 0, Math.PI * 2); cx.fill();
  cx.beginPath(); cx.arc(x + 8, y - 14, 11, 0, Math.PI * 2); cx.fill();
  cx.beginPath(); cx.arc(x, y - 24, 14, 0, Math.PI * 2); cx.fill();
  cx.fillStyle = '#059669';
  cx.beginPath(); cx.arc(x - 3, y - 18, 8, 0, Math.PI * 2); cx.fill();
  cx.beginPath(); cx.arc(x + 5, y - 20, 7, 0, Math.PI * 2); cx.fill();
}

function drawWhiteboard(x, y) {
  // Board
  cx.fillStyle = '#1e293b'; rr(x - 60, y - 5, 120, 45, 6); cx.fill();
  cx.fillStyle = '#334155'; rr(x - 55, y, 110, 35, 4); cx.fill();
  // Text lines
  cx.fillStyle = '#64748b';
  cx.fillRect(x - 45, y + 8, 40, 3);
  cx.fillRect(x - 45, y + 16, 55, 3);
  cx.fillRect(x - 45, y + 24, 30, 3);
  // "SPRINT" label
  cx.fillStyle = '#8b5cf6'; cx.font = '700 8px Nunito'; cx.textAlign = 'center';
  cx.fillText('SPRINT BOARD', x, y + 10); cx.textAlign = 'start';
}

function drawCoffeeMachine(x, y) {
  // Machine body
  cx.fillStyle = '#334155'; rr(x - 16, y - 20, 32, 40, 6); cx.fill();
  cx.fillStyle = '#475569'; rr(x - 12, y - 16, 24, 20, 3); cx.fill();
  // Cup
  cx.fillStyle = '#f5f5f4'; rr(x - 6, y + 6, 12, 14, 3); cx.fill();
  // Steam
  const st = Math.sin(Date.now() * .004) * 3;
  cx.strokeStyle = 'rgba(255,255,255,.2)'; cx.lineWidth = 2;
  cx.beginPath(); cx.moveTo(x - 2, y + 2); cx.quadraticCurveTo(x - 4 + st, y - 6, x, y - 12); cx.stroke();
  cx.beginPath(); cx.moveTo(x + 2, y + 2); cx.quadraticCurveTo(x + 4 - st, y - 8, x + 1, y - 14); cx.stroke();
}

function drawBar(x, y, w, h, pct, col, icon) {
  cx.fillStyle = '#0f172a'; rr(x, y, w, h, h / 2); cx.fill();
  if (pct > 0) {
    const bw = Math.max(h, w * clamp(pct, 0, 1));
    cx.fillStyle = col; rr(x, y, bw, h, h / 2); cx.fill();
  }
}

function rr(x, y, w, h, r) {
  if (w < 2 * r) r = w / 2; if (h < 2 * r) r = h / 2; if (r < 0) r = 0;
  cx.beginPath(); cx.moveTo(x + r, y); cx.lineTo(x + w - r, y); cx.quadraticCurveTo(x + w, y, x + w, y + r);
  cx.lineTo(x + w, y + h - r); cx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); cx.lineTo(x + r, y + h);
  cx.quadraticCurveTo(x, y + h, x, y + h - r); cx.lineTo(x, y + r); cx.quadraticCurveTo(x, y, x + r, y); cx.closePath();
}

// ═══ GAME FLOW ═══
function gameLoop(timestamp) {
  if (!lastFrameTime) lastFrameTime = timestamp;
  let rawDt = (timestamp - lastFrameTime) / 1000;
  lastFrameTime = timestamp;
  
  // Clamp rawDt to prevent huge jumps/spiral of death after tab switch
  if (rawDt > 0.1) rawDt = 0.1;
  
  accumulator += rawDt;
  
  // Fixed time step for logic updates (always 60 updates per second)
  while (accumulator >= TARGET_DT) {
    update(TARGET_DT);
    accumulator -= TARGET_DT;
  }
  
  draw();
  if (G.on) requestAnimationFrame(gameLoop);
}

function startLevel(lv) {
  G.paused = false;
  if (AC.state === 'suspended') AC.resume();
  cacheDom();
  G.lv = lv; G.sc = 0; G.combo = 1; G.mxCombo = 1; G.done = 0; G.burns = 0; G.stunCount = 0;
  G.tLeft = LVL[lv].time; G.cheerCD = 0; G.stun = 0; G.comboTimer = 0;
  tasks = []; pts = []; fts = [];
  P.x = 550; P.y = 400; P.vx = 0; P.vy = 0; P.held = null; P.trail = []; P.dCD = 0; P.dash = false; P.dT = 0; P.bob = 0; P.walkFrame = 0;
  DOM.stun.classList.remove('on');
  DOM.speech.classList.remove('on');
  tutorialActive = false; tutorialPaused = false; tutorialPhase = 0;
  DOM.tut.classList.remove('show');

  DOM.tut.classList.remove('show');

  // Initialize teammates FIRST so spawnTask knows which roles exist
  initMates(lv);

  // Pre-fill backlog with all tasks for this level
  for (let i = 0; i < LVL[lv].goal; i++) { spawnTask() }

  // Setup talkers (time wasters) — faster bots on harder levels, avoiding player start pos
  bots = [];
  for (let i = 0; i < LVL[lv].bots; i++) {
    let spd = 3 + G.lv * .7 + Math.random() * 1.5;
    let bx, by;
    do {
      bx = 100 + Math.random() * (W - 200);
      by = 100 + Math.random() * (H - 200);
    } while (dist(P.x, P.y, bx, by) < 300); // Ensure they don't spawn right on top of the player

    bots.push({
      x: bx, y: by,
      vx: (Math.random() > .5 ? 1 : -1) * spd, vy: (Math.random() > .5 ? 1 : -1) * spd,
      r: 18, ang: Math.random() * 6, visible: true
    });
  }

  // Reset or init mechanics
  BOARD.x = 550; BOARD.y = 120; BOARD.vx = 0; BOARD.vy = 0;
  if (LVL[lv].special === 'speedZones') initSpeedZones();
  if (LVL[lv].special === 'movingBoard') {
    BOARD.vx = (Math.random() > 0.5 ? 1 : -1) * 2;
    BOARD.vy = (Math.random() > 0.5 ? 1 : -1) * 2;
  }

  document.getElementById('title-screen').style.display = 'none';
  document.getElementById('map-screen').style.display = 'none';
  document.getElementById('gameover-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'flex';
  document.getElementById('h-lv').textContent = lv;
  updHUD();

  const lb = document.getElementById('lvl-ban');
  document.getElementById('lb-t').textContent = LVL[lv].label;
  document.getElementById('lb-s').textContent = LVL[lv].sub;
  lb.classList.add('show'); G.on = false; lastFrameTime = 0; accumulator = 0; draw();

  // Tutorial on level 1 and 2
  if (LVL[lv].tutorial) {
    setTimeout(() => {
      lb.classList.remove('show'); G.on = true; tick = 0; lastFrameTime = 0; accumulator = 0; requestAnimationFrame(gameLoop);
      setTimeout(() => startTutorial(LVL[lv].tutorial), 800);
    }, 2200);
  } else {
    setTimeout(() => { lb.classList.remove('show'); G.on = true; tick = 0; lastFrameTime = 0; accumulator = 0; requestAnimationFrame(gameLoop) }, 2200);
  }
}

function endGame(win, msg = '') {
  G.on = false;
  DOM.stun.classList.remove('on'); DOM.speech.classList.remove('on');
  document.getElementById('gameover-screen').style.display = 'flex';
  const t = document.getElementById('go-t');
  const lv = LVL[G.lv];
  
  logEvent('level_complete', { level: G.lv, win: win, final_score: G.sc });
  
  if (G.lv === 7) {
    if (win) audioGhostWin.play().catch(()=>{});
    else audioGhostLoss.play().catch(()=>{});
  } else if (G.lv === 8 && win) {
    audioLevel8Win.play().catch(()=>{});
  }

  // Star calculation (only if won)
  let stars = 0;
  if (win) {
    stars = 1; // completed = at least 1 star
    if (G.stunCount <= lv.starStuns) stars = 2; // few/no distractions = 2 stars
    if (G.stunCount <= lv.starStuns && G.tLeft >= lv.starTime) stars = 3; // few distractions + fast = 3 stars
    
    // Save high score / stars
    const prevStars = parseInt(localStorage.getItem('sc_stars_' + G.lv) || '0', 10);
    if (stars > prevStars) {
      localStorage.setItem('sc_stars_' + G.lv, stars);
    }
  }
  const starStr = win ? ('\n' + '⭐'.repeat(stars) + '☆'.repeat(3 - stars)) : ''

  t.textContent = win ? '🚀 SPRINT DELIVERED!' : '💥 SPRINT FAILED!';
  t.style.color = win ? '#34d399' : '#f87171';
  document.getElementById('go-m').textContent = (msg || (win ? 'Great velocity, PM!' : 'Better luck next sprint!'));

  // Stars display
  const starHTML = win ? `<div class="go-stars">${'<span class="star-filled">⭐</span>'.repeat(stars)}${'<span class="star-empty">☆</span>'.repeat(3 - stars)}</div>` : '';

  document.getElementById('go-s').innerHTML = `
    ${starHTML}
    <div class="st-i"><div class="st-v">${G.done}</div><div class="st-n">Shipped</div></div>
    <div class="st-i"><div class="st-v">x${G.mxCombo}</div><div class="st-n">Max Combo</div></div>
    <div class="st-i"><div class="st-v">${G.burns}</div><div class="st-n">Burnouts</div></div>
    <div class="st-i"><div class="st-v">${Math.ceil(Math.max(0, G.tLeft))}s</div><div class="st-n">Time Left</div></div>
    <div class="st-i"><div class="st-v">${G.stunCount}</div><div class="st-n">Distracted</div></div>
    <div class="st-i"><div class="st-v">${stars}/3</div><div class="st-n">Stars</div></div>`;
  const nb = document.getElementById('go-n');
  if (win && G.lv < LVL.length - 1) { nb.style.display = 'inline-block'; nb.textContent = 'NEXT SPRINT ▶' }
  else { nb.style.display = 'none'; if (win) document.getElementById('go-m').textContent += ' 🏆 YOU BEAT ALL SPRINTS!' }
}

function nextLvl() { showLevelPopup(G.lv + 1) }

function showMap() {
  document.getElementById('title-screen').style.display = 'none';
  document.getElementById('gameover-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('level-popup-modal').style.display = 'none';
  document.getElementById('map-screen').style.display = 'flex';
  const g = document.getElementById('map-grid'); g.innerHTML = '';
  for (let i = 1; i < LVL.length; i++) {
    const l = LVL[i];
    const savedStars = parseInt(localStorage.getItem('sc_stars_' + i) || '0', 10);
    const starHTML = savedStars > 0 ? `<div class="map-stars">${'⭐'.repeat(savedStars)}</div>` : '';
    
    g.innerHTML += `<div class="map-node" onclick="showLevelPopup(${i})">
      <div class="map-emoji">${l.emoji}</div>
      <div class="map-num">${i}</div>
      ${starHTML}
      <div class="map-label">${l.sub}</div></div>`;
  }
}

let pendingLevel = null;
const LEVEL_INTROS = [
  "",
  "Welcome to your first day as Team Leader! Let's start by managing the backlog.",
  "Oh no, the chatty coworkers are here... Try to dash past them so you don't drop your tasks!",
  "The team is growing! More workers means more tasks. Keep up the pace!",
  "Someone took away half the chairs. Everyone is wandering around. Catch them if you can!",
  "The lights are out! Rely on your memory and stick close to the team.",
  "Who spilled coffee on the floor? It's completely frozen over. Watch your step, it's slippery!",
  "Wait... did that guy just turn invisible? Keep an eye out for stealthy time wasters!",
  "The backlog board is running away! Chase it down and deliver those tasks!"
];

function showLevelPopup(lv) {
  pendingLevel = lv;
  document.getElementById('lp-title').textContent = 'Sprint ' + lv + ': ' + LVL[lv].sub;
  document.getElementById('lp-goal').textContent = 'Goal: ' + LVL[lv].goal + ' tasks';
  document.getElementById('lp-desc').textContent = LEVEL_INTROS[lv] || "Prepare for the next sprint!";
  document.getElementById('level-popup-modal').style.display = 'flex';
}

// ═══ AGILE QUIZ GAMIFICATION ═══
const QUIZ_QUESTIONS = [
  { q: "In Agile Project Management, what is a 'Sprint'?", opts: ["A fast-paced phase where the entire project is completed.", "A set period of time during which specific work has to be completed and made ready for review.", "A quick meeting at the end of the project to review mistakes.", "A penalty phase for missing deadlines."], ans: 1, exp: "A sprint is a short, time-boxed period when a scrum team works to complete a set amount of work." },
  { q: "What is the primary purpose of the 'Backlog' in Agile?", opts: ["To store rejected ideas from the client.", "To keep track of employee vacation days.", "An ordered list of everything that is known to be needed in the product.", "A log of bugs that will never be fixed."], ans: 2, exp: "The product backlog is the single authoritative source for things that a team works on." },
  { q: "During a Daily Standup meeting, which question is NOT typically asked?", opts: ["What did you do yesterday?", "What will you do today?", "Are there any impediments in your way?", "Who is to blame for the latest bug?"], ans: 3, exp: "Standups focus on progress and blockers, not assigning blame." },
  { q: "Who is responsible for maximizing the value of the product resulting from the work of the Development Team?", opts: ["The Scrum Master", "The Product Owner", "The Project Manager", "The Agile Coach"], ans: 1, exp: "The Product Owner is responsible for maximizing product value and managing the Product Backlog." },
  { q: "What happens if the team finishes all Sprint Backlog items before the Sprint is over?", opts: ["The Sprint ends immediately.", "The team goes on vacation.", "The team works with the Product Owner to pull in more work.", "The team hides the fact that they are done."], ans: 2, exp: "If a team finishes early, they collaborate with the Product Owner to add more items from the top of the Product Backlog." },
  { q: "What is the main role of the Scrum Master?", opts: ["To act as the project manager and assign tasks.", "To remove impediments and facilitate the Scrum process.", "To design the software architecture.", "To report directly to the client."], ans: 1, exp: "The Scrum Master is a servant-leader who helps the team remove blockers and follow Agile practices." },
  { q: "Which of the following is NOT an Agile manifesto value?", opts: ["Individuals and interactions over processes and tools.", "Working software over comprehensive documentation.", "Following a plan over responding to change.", "Customer collaboration over contract negotiation."], ans: 2, exp: "Agile values responding to change OVER following a strict plan." },
  { q: "When is a Sprint Retrospective held?", opts: ["At the beginning of every sprint.", "At the end of every sprint.", "Only when the project fails.", "Whenever the Scrum Master feels like it."], ans: 1, exp: "The Retrospective is held at the end of every sprint to discuss what went well and what to improve." },
  { q: "What does 'Velocity' measure in Agile?", opts: ["The speed at which code runs on the server.", "The amount of work a team can complete during a single sprint.", "How fast the Product Owner can write user stories.", "The time it takes to boot up the project."], ans: 1, exp: "Velocity is a metric that tracks how much work (often in story points) the team finishes in a sprint." },
  { q: "In Agile, who defines the priority of items in the Product Backlog?", opts: ["The Development Team", "The Scrum Master", "The Product Owner", "The CEO"], ans: 2, exp: "The Product Owner holds the sole responsibility for ordering the items in the Product Backlog to maximize value." }
];

function confirmLevelStart() {
  document.getElementById('level-popup-modal').style.display = 'none';
  showQuiz(pendingLevel);
}

function showQuiz(lv) {
  pendingLevel = lv;
  const qObj = QUIZ_QUESTIONS[Math.floor(Math.random() * QUIZ_QUESTIONS.length)];
  document.getElementById('quiz-q').textContent = qObj.q;
  
  const optsDiv = document.getElementById('quiz-opts');
  optsDiv.innerHTML = '';
  document.getElementById('quiz-fb').style.display = 'none';
  document.getElementById('quiz-cont').style.display = 'none';
  
  qObj.opts.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary';
    btn.style.textAlign = 'left';
    btn.style.width = '100%';
    btn.style.whiteSpace = 'normal';
    btn.style.height = 'auto';
    btn.textContent = String.fromCharCode(65 + i) + ') ' + opt;
    btn.onclick = () => answerQuiz(i, qObj.ans, qObj.exp, optsDiv);
    optsDiv.appendChild(btn);
  });
  
  document.getElementById('quiz-modal').style.display = 'flex';
}

function answerQuiz(selected, correct, exp, optsDiv) {
  Array.from(optsDiv.children).forEach((b, i) => {
    b.disabled = true;
    b.style.opacity = '0.7';
    if (i === correct) { b.style.backgroundColor = '#10b981'; b.style.borderColor = '#10b981'; b.style.color = '#fff'; b.style.opacity = '1'; }
    else if (i === selected) { b.style.backgroundColor = '#ef4444'; b.style.borderColor = '#ef4444'; b.style.color = '#fff'; b.style.opacity = '1'; }
  });
  
  const fbDiv = document.getElementById('quiz-fb');
  const fbT = document.getElementById('quiz-fb-t');
  const fbD = document.getElementById('quiz-fb-d');
  
  fbDiv.style.display = 'block';
  if (selected === correct) {
    fbDiv.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
    fbDiv.style.border = '1px solid #10b981';
    fbT.textContent = '✅ Correct!';
    fbT.style.color = '#10b981';
  } else {
    fbDiv.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
    fbDiv.style.border = '1px solid #ef4444';
    fbT.textContent = '❌ Incorrect!';
    fbT.style.color = '#ef4444';
  }
  fbD.textContent = exp;
  document.getElementById('quiz-cont').style.display = 'block';
}

function startQuizLevel() {
  document.getElementById('quiz-modal').style.display = 'none';
  startLevel(pendingLevel);
}

// ═══ PAUSE MENU LOGIC ═══
function togglePause() {
  if (!G.on) return; // Only pause if actually in a level
  G.paused = !G.paused;
  document.getElementById('pause-menu').style.display = G.paused ? 'flex' : 'none';
  if (!G.paused) {
    // Reset frame time to prevent massive dt jumps upon resume
    lastFrameTime = performance.now();
  }
}

function restartLevel() {
  document.getElementById('pause-menu').style.display = 'none';
  startLevel(G.lv);
}

function quitToMap() {
  G.paused = false;
  G.on = false;
  document.getElementById('pause-menu').style.display = 'none';
  logEvent('session_end', { completed: false, reason: "quit_to_map" });
  showMap();
}

function closeLevelPopup() {
  document.getElementById('level-popup-modal').style.display = 'none';
}



function goTitle() {
  logEvent('session_end', { completed: true, reason: "return_to_title" });
  document.getElementById('map-screen').style.display = 'none';
  document.getElementById('gameover-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('title-screen').style.display = 'flex';
}

function showHelp() {
  alert(`🚀 SPRINT CHAOS - HOW TO PLAY

You are the Project Manager (PM)!
Grab tasks from the BACKLOG board and deliver them
to the correct developer before time runs out.

CONTROLS:
  WASD / Arrows = Move
  SHIFT = Dash (short cooldown)
  E = Pick up / Drop task
  F = Cheer teammate (+Energy +Trust)
  SPACE = Daily Standup (recharges all, but pauses work)

WATCH OUT FOR:
  🗣️ Time wasters grab you and talk nonsense!
  🔥 Burnout happens when energy hits 0
  💔 Wrong assignments lose trust - 3 quits = game over
  💺 In later levels, devs wander around!

TIPS:
  ✨ Chain correct deliveries for COMBO multiplier
  📢 Use Standups wisely - they pause all work
  ❤️ Cheer tired teammates before they burn out
  💪 Motivate workers every 3 tasks to keep them going`);
}

// ═══ TUTORIAL SYSTEM ═══
// ═══ TUTORIAL LOGIC ═══
function startTutorial(level) {
  tutorialActive = true; 
  if (level === 1) {
    tutorialPhase = 0;
    showTutorialStep(0);
  } else if (level === 2) {
    tutorialPhase = 4;
    showTutorialStep(4);
  }
}

function showTutorialStep(idx) {
  if (idx >= TUTORIAL_STEPS.length) { tutorialActive = false; tutorialPaused = false; document.getElementById('tutorial-overlay').classList.remove('show'); return }
  tutorialPhase = idx;
  tutorialPaused = true;
  const step = TUTORIAL_STEPS[idx];
  document.getElementById('tutorial-icon').textContent = step.icon;
  document.getElementById('tutorial-title').textContent = step.title;
  document.getElementById('tutorial-text').textContent = step.text;
  document.getElementById('tutorial-overlay').classList.add('show');
}

function advanceTutorial() {
  document.getElementById('tutorial-overlay').classList.remove('show');
  tutorialPaused = false;
  
  if (tutorialPhase === 0) {
    showTutorialStep(1); // Backlog pops up immediately after OK
  } else if (tutorialPhase === 1) {
    tutorialWatchPhase = 2; // Waiting for pickup
  } else if (tutorialPhase === 2) {
    tutorialWatchPhase = 3; // Waiting for motivation (3 tasks)
  } else if (tutorialPhase === 4) {
    showTutorialStep(5); // Dash pops up immediately after OK
  } else {
    tutorialActive = false; // Done
  }
}

let tutorialWatchPhase = -1;
// Called from game events to trigger next tutorial step
function checkTutorialTrigger(event) {
  if (!tutorialActive || tutorialWatchPhase < 0) return;
  if (tutorialWatchPhase === 2 && event === 'pickup') {
    showTutorialStep(2); tutorialWatchPhase = -1;
  } else if (tutorialWatchPhase === 3 && event === 'exhausted') {
    showTutorialStep(3); tutorialWatchPhase = -1;
  }
}