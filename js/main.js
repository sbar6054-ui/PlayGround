import * as THREE from '../vendor/three.module.js';
import { Fighter, FIGHTERS, MOVE_DURATION, HIT_WINDOW } from './fighters.js';
import { createWorld } from './world.js';
import { ArenaAudio } from './audio.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const TAU = Math.PI * 2;

const canvas = $('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const world = createWorld(scene, renderer);
const camera = world.camera;
const audio = new ArenaAudio();

const models = FIGHTERS.map(d => new Fighter(d));
for (const m of models) { m.root.visible = false; scene.add(m.root); }
const shadows = models.map(() => world.makeContactShadow());
shadows.forEach(s => { s.visible = false; });

const ringGeo = new THREE.RingGeometry(0.58, 0.68, 48);
const ringP = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xf5c15c, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
const ringO = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xe3364a, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
for (const r of [ringP, ringO]) { r.rotation.x = -Math.PI / 2; r.position.y = 0.025; r.visible = false; scene.add(r); }

const flashEl = document.createElement('div');
flashEl.className = 'flash';
document.getElementById('app').appendChild(flashEl);

const game = {
  mode: 'loading',
  selected: 0,
  opponentIndex: 1,
  paused: false,
  time: 0,
  phase: 'intro',
  phaseTime: 0,
  round: 1,
  winsP: 0,
  winsO: 0,
  timeLeft: 60,
  p: null,
  o: null,
  attacks: { p: null, o: null },
  stun: { p: 0, o: 0 },
  blocking: { p: false, o: false },
  meter: { p: 0, o: 0 },
  combo: { count: 0, timer: 0 },
  punchVariant: 0,
  shake: 0,
  slowmo: 0,
  hitstop: 0,
  flash: 0,
  camPos: new THREE.Vector3(0, 2.4, 6),
  camLook: new THREE.Vector3(0, 1.1, 0),
  fov: 42,
};

const ai = { timer: 0, block: 0, strafe: 0, strafeDir: 0, think: 0, aggression: 0.55 };

const input = {
  joy: { x: 0, y: 0, active: false, id: null },
  keys: new Set(),
  block: false,
};

/* ------------------------------------------------------------------ UI */

const roster = $('roster-list');
FIGHTERS.forEach((f, i) => {
  const b = document.createElement('button');
  b.className = 'roster-card';
  b.style.setProperty('--accent', f.accent);
  b.innerHTML = `<div class="rc-index">0${i + 1}</div><div class="rc-name">${f.name}</div><div class="rc-title">${f.title}</div>`;
  b.addEventListener('click', () => { if (audio.ctx) audio.ui(); selectFighter(i); });
  roster.appendChild(b);
});

function selectFighter(index) {
  game.selected = (index + FIGHTERS.length) % FIGHTERS.length;
  const f = FIGHTERS[game.selected];
  [...roster.children].forEach((c, i) => c.classList.toggle('active', i === game.selected));
  $('sel-name').textContent = f.name;
  $('sel-title').textContent = f.title;
  $('sel-bio').textContent = f.bio;
  $('stat-power').style.width = f.stats.power + '%';
  $('stat-speed').style.width = f.stats.speed + '%';
  $('stat-reach').style.width = f.stats.reach + '%';
  models.forEach((m, i) => {
    m.root.visible = i === game.selected;
    if (i === game.selected) {
      m.root.position.set(0, 0, 0);
      m.root.rotation.set(0, 0.16, 0);
      m.setAnim('idle', {}, true);
      m.current = { ...m.current };
      m.applyPose(m.current, true);
    }
  });
}

function showScreen(id) {
  for (const s of ['menu', 'select']) $(s).classList.toggle('show', s === id);
}

function setHudVisible(on) {
  $('hud').classList.toggle('show', on);
  $('touch').classList.toggle('show', on);
}

let toastTimer = 0;
function toast(text, ms = 1500) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function showBanner(kicker, main, sub, ko = false, hold = 1800) {
  const b = $('banner');
  $('banner-kicker').textContent = kicker;
  $('banner-main').textContent = main;
  $('banner-sub').textContent = sub;
  b.classList.remove('show', 'ko');
  void b.offsetWidth;
  if (ko) b.classList.add('ko');
  b.classList.add('show');
  clearTimeout(showBanner.timer);
  showBanner.timer = setTimeout(() => b.classList.remove('show'), hold);
}

function showCallout(text, color = '#f5c15c') {
  const c = $('callout');
  c.textContent = text;
  c.style.color = color;
  c.style.textShadow = `0 0 34px ${color}88, 0 4px 24px #000`;
  c.classList.remove('pop');
  void c.offsetWidth;
  c.classList.add('pop');
}

function damagePopup(worldPos, text, color = '#ffd479') {
  const v = worldPos.clone().project(camera);
  if (v.z > 1) return;
  const el = document.createElement('div');
  el.className = 'dmg-pop';
  el.textContent = text;
  el.style.left = ((v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
  el.style.top = ((-v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
  el.style.color = color;
  el.style.textShadow = `0 0 18px ${color}, 0 3px 10px #000`;
  document.getElementById('app').appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function flashScreen(amount = 0.35) {
  flashEl.style.opacity = amount;
  requestAnimationFrame(() => { flashEl.style.opacity = 0; });
}

/* ------------------------------------------------------------------ match flow */

function pickOpponent() {
  const pool = FIGHTERS.map((_, i) => i).filter(i => i !== game.selected);
  return pool[Math.floor(Math.random() * pool.length)];
}

function startMatch() {
  audio.unlock();
  audio.startMusic();
  game.mode = 'fight';
  game.paused = false;
  game.opponentIndex = pickOpponent();
  game.winsP = 0;
  game.winsO = 0;
  game.round = 1;
  game.meter.p = 0;
  game.meter.o = 0;
  game.p = models[game.selected];
  game.o = models[game.opponentIndex];
  models.forEach((m, i) => { m.root.visible = i === game.selected || i === game.opponentIndex; });
  ringP.material.color.set(game.p.data.colors.accent);
  ringO.material.color.set(game.o.data.colors.accent);
  ringP.visible = ringO.visible = true;
  $('hud-name-p').textContent = game.p.data.name;
  $('hud-name-o').textContent = game.o.data.name;
  showScreen(null);
  document.body.classList.add('fighting');
  $('result').classList.remove('show');
  $('pause').classList.remove('show');
  $('help').classList.remove('show');
  setHudVisible(true);
  startRound();
  try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch {}
}

function startRound() {
  const p = game.p;
  const o = game.o;
  p.health = p.maxHealth;
  o.health = o.maxHealth;
  p.reset(-1.55, 0, 1);
  o.reset(1.55, 0, -1);
  p.setAnim('idle', {}, true);
  o.setAnim('idle', {}, true);
  p.root.rotation.z = 0;
  o.root.rotation.z = 0;
  game.phase = 'intro';
  game.phaseTime = 0;
  game.timeLeft = 60;
  game.attacks = { p: null, o: null };
  game.stun = { p: 0, o: 0 };
  game.blocking = { p: false, o: false };
  game.combo.count = 0;
  game.combo.timer = 0;
  game.meter.p = Math.min(game.meter.p, 35);
  game.meter.o = Math.min(game.meter.o, 35);
  ai.timer = 0.6;
  ai.block = 0;
  ai.strafe = 0;
  $('combo').classList.remove('show');
  updateHUD(true);
  showBanner('DRAGON ARENA · BEST OF THREE', `ROUND ${game.round}`, `${p.data.name} VS ${o.data.name}`, false, 1700);
  audio.gong();
  setHudVisible(true);
}

function resolveRound(winnerSide) {
  if (winnerSide === 'p') game.winsP++; else game.winsO++;
  updatePips();
  const matchOver = game.winsP >= 2 || game.winsO >= 2;
  if (matchOver) {
    game.phase = 'matchover';
    game.phaseTime = 0;
    setTimeout(showResult, 900);
    setHudVisible(false);
    const winner = winnerSide === 'p' ? game.p : game.o;
    winner.setAnim('win', {}, true);
    const loser = winnerSide === 'p' ? game.o : game.p;
    if (loser.anim !== 'ko') loser.setAnim('hit', { power: 0.6 }, true);
    if (winnerSide === 'p') { audio.win(); world.spawnConfetti(winner.root.position.clone().add(new THREE.Vector3(0, 1, 0))); }
    else audio.lose();
  } else {
    game.phase = 'roundover';
    game.phaseTime = 0;
    showBanner('ROUND ' + game.round, winnerSide === 'p' ? 'ROUND WON' : 'ROUND LOST', `${game.winsP} — ${game.winsO}`, false, 1500);
  }
}

function showResult() {
  if (game.phase !== 'matchover') return;
  const won = game.winsP >= 2;
  const card = $('result').querySelector('.modal-card');
  card.classList.toggle('lose', !won);
  $('result-kicker').textContent = won ? 'TOURNAMENT COMPLETE' : 'TOURNAMENT OVER';
  $('result-title').textContent = won ? 'VICTORY' : 'DEFEAT';
  $('result-sub').textContent = won
    ? `${game.p.data.name} CONQUERS THE DRAGON ARENA`
    : `${game.o.data.name} TAKES THE DRAGON THRONE`;
  $('result').classList.add('show');
}

function quitToSelect() {
  document.body.classList.remove('fighting');
  game.mode = 'select';
  game.paused = false;
  $('pause').classList.remove('show');
  $('result').classList.remove('show');
  $('help').classList.remove('show');
  setHudVisible(false);
  ringP.visible = ringO.visible = false;
  models.forEach((m, i) => { m.root.visible = i === game.selected; });
  const m = models[game.selected];
  m.root.position.set(0, 0, 0);
  m.root.rotation.set(0, 0.16, 0);
  m.setAnim('idle', {}, true);
  m.current = { ...m.current };
  m.applyPose(m.current, true);
  showScreen('select');
  $('banner').classList.remove('show');
  updatePips();
}

/* ------------------------------------------------------------------ HUD */

function updateHUD(force = false) {
  if (!game.p || !game.o) return;
  const pr = clamp(game.p.health / game.p.maxHealth, 0, 1);
  const or = clamp(game.o.health / game.o.maxHealth, 0, 1);
  $('hp-p').style.transform = `scaleX(${pr})`;
  $('hp-o').style.transform = `scaleX(${or})`;
  $('chip-p').style.transform = `scaleX(${pr})`;
  $('chip-o').style.transform = `scaleX(${or})`;
  $('meter-p').style.width = game.meter.p + '%';
  $('meter-o').style.width = game.meter.o + '%';
  const t = Math.max(0, Math.ceil(game.timeLeft));
  $('timer').textContent = t;
  const circ = 276.46;
  $('timer-arc').style.strokeDashoffset = String(circ * (1 - game.timeLeft / 60));
  $('timer-arc').style.stroke = game.timeLeft < 10 ? '#ff4d5f' : '#f5c15c';
  $('round-label').textContent = game.round >= 3 ? 'FINAL ROUND' : `ROUND ${game.round}`;
  if (force) updatePips();
  const specialReady = game.meter.p >= 100;
  document.querySelector('.pad-btn.special').classList.toggle('ready', specialReady);
}

function updatePips() {
  const pEls = $('pips-p').children;
  const oEls = $('pips-o').children;
  for (let i = 0; i < 2; i++) {
    pEls[i].classList.toggle('on', i < game.winsP);
    oEls[i].classList.toggle('on', i < game.winsO);
  }
}

/* ------------------------------------------------------------------ input */

function setStickFromEvent(e) {
  const el = $('stick');
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  let dx = e.clientX - cx;
  let dy = e.clientY - cy;
  const max = r.width * 0.36;
  const len = Math.hypot(dx, dy);
  if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
  $('stick-knob').style.transform = `translate(${dx}px, ${dy}px)`;
  input.joy.x = dx / max;
  input.joy.y = dy / max;
}

$('stick').addEventListener('pointerdown', e => {
  e.preventDefault();
  input.joy.active = true;
  input.joy.id = e.pointerId;
  $('stick').setPointerCapture(e.pointerId);
  audio.unlock();
  setStickFromEvent(e);
});
$('stick').addEventListener('pointermove', e => {
  if (!input.joy.active || e.pointerId !== input.joy.id) return;
  e.preventDefault();
  setStickFromEvent(e);
});
function releaseStick(e) {
  if (e.pointerId !== input.joy.id) return;
  input.joy.active = false;
  input.joy.id = null;
  input.joy.x = input.joy.y = 0;
  $('stick-knob').style.transform = 'translate(0px, 0px)';
}
$('stick').addEventListener('pointerup', releaseStick);
$('stick').addEventListener('pointercancel', releaseStick);

for (const btn of document.querySelectorAll('.pad-btn')) {
  const action = btn.dataset.action;
  const down = e => {
    e.preventDefault();
    audio.unlock();
    btn.classList.add('down');
    if (action === 'block') {
      input.block = true;
      game.blocking.p = true;
    } else {
      triggerPlayerAttack(action);
    }
    if (navigator.vibrate) navigator.vibrate(action === 'special' ? 30 : 12);
  };
  const up = e => {
    btn.classList.remove('down');
    if (action === 'block') {
      input.block = false;
      game.blocking.p = false;
    }
  };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('pointerleave', up);
}

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  input.keys.add(k);
  audio.unlock();
  if (k === 'j') triggerPlayerAttack('punch');
  if (k === 'k') triggerPlayerAttack('kick');
  if (k === ' ') triggerPlayerAttack('special');
  if (k === 'l' || k === 'shift') { input.block = true; if (game.p) game.blocking.p = true; }
  if (k === 'escape' || k === 'p') togglePause();
  if (k === 'enter') {
    if (game.mode === 'menu') enterSelect();
    else if (game.mode === 'select') startMatch();
    else if (game.mode === 'fight' && game.phase === 'matchover') showResult();
  }
});
window.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  input.keys.delete(k);
  if (k === 'l' || k === 'shift') { input.block = false; if (game.p) game.blocking.p = false; }
});

window.addEventListener('blur', () => {
  input.keys.clear();
  input.block = false;
  input.joy.x = input.joy.y = 0;
});

/* ------------------------------------------------------------------ attacks */

function triggerPlayerAttack(type) {
  if (game.mode !== 'fight' || game.paused || game.phase !== 'fight') return;
  if (!game.p || game.stun.p > 0 || game.attacks.p) return;
  if (type === 'special' && game.meter.p < 100) {
    toast('SPIRIT METER NOT READY', 1100);
    if (audio.ctx) audio.ui();
    return;
  }
  input.block = false;
  game.blocking.p = false;
  startAttack('p', type);
}

function startAttack(side, type) {
  const f = side === 'p' ? game.p : game.o;
  if (!f) return;
  if (type === 'special') {
    if (game.meter[side] < 100) return;
    game.meter[side] = 0;
  }
  let variant = 0;
  if (type === 'punch') { game.punchVariant = (game.punchVariant + 1) % 2; variant = game.punchVariant; }
  game.attacks[side] = { type, applied: false, variant };
  f.setAnim('attack', { type, variant }, true);
  if (type === 'special') {
    audio.special();
    world.spawnAura(f.root.position, f.data.colors.accent);
    showCallout('SPIRIT ART', '#ffd479');
    flashScreen(0.22);
    game.shake = Math.max(game.shake, 0.5);
  } else {
    audio.whiff();
  }
}

function tryHit(side) {
  const atk = game.attacks[side];
  if (!atk || atk.applied) return;
  const attacker = side === 'p' ? game.p : game.o;
  const defender = side === 'p' ? game.o : game.p;
  if (!attacker || !defender) return;
  const type = atk.type;
  const dx = defender.root.position.x - attacker.root.position.x;
  const dz = defender.root.position.z - attacker.root.position.z;
  const facing = side === 'p' ? 1 : -1;
  if (dx * facing < -0.35) return;
  const reach = attacker.data.reach + (type === 'kick' ? 0.14 : 0) + (type === 'special' ? 0.7 : 0);
  const dist = Math.hypot(dx, dz);
  if (dist > reach || Math.abs(dz) > 0.9) return;

  atk.applied = true;
  const otherSide = side === 'p' ? 'o' : 'p';
  const blocked = game.blocking[otherSide] && defender.anim === 'block' && game.stun[otherSide] <= 0;
  const pos = attacker.root.position.clone().add(defender.root.position).multiplyScalar(0.5);
  pos.y = 1.25;
  pos.x += (defender.root.position.x - attacker.root.position.x) * 0.16;

  if (blocked) {
    const chip = Math.round((type === 'special' ? 34 : type === 'kick' ? 12 : 7) * defender.data.damage);
    defender.health = Math.max(1, defender.health - chip);
    game.meter[side] = clamp(game.meter[side] + 3, 0, 100);
    game.meter[otherSide] = clamp(game.meter[otherSide] + 8, 0, 100);
    audio.block();
    world.spawnHit(pos, 0x7bd7ff, 0.55);
    game.shake = Math.max(game.shake, 0.16);
    damagePopup(pos, 'BLOCK', '#8fd8ff');
    const push = type === 'special' ? 0.5 : 0.18;
    defender.root.position.x += facing * push;
    if (navigator.vibrate) navigator.vibrate(8);
    return;
  }

  let base = type === 'special' ? 168 : type === 'kick' ? 70 : 46;
  base *= attacker.data.damage;
  if (side === 'p') {
    game.combo.count++;
    game.combo.timer = 1.35;
    const scale = Math.max(0.55, 1 - (game.combo.count - 1) * 0.07);
    base *= scale;
    $('combo-count').textContent = String(game.combo.count);
    $('combo').classList.toggle('show', game.combo.count >= 2);
  } else {
    game.combo.count = 0;
    game.combo.timer = 0;
    $('combo').classList.remove('show');
  }
  const dmg = Math.round(base);
  defender.health = Math.max(0, defender.health - dmg);
  game.meter[side] = clamp(game.meter[side] + (type === 'special' ? 6 : 9), 0, 100);
  game.meter[otherSide] = clamp(game.meter[otherSide] + 6, 0, 100);

  defender.setAnim('hit', { power: type === 'special' ? 1.8 : type === 'kick' ? 1.2 : 0.85 }, true);
  game.stun[otherSide] = type === 'special' ? 0.7 : type === 'kick' ? 0.48 : 0.36;
  game.attacks[otherSide] = null;
  game.blocking[otherSide] = false;
  if (otherSide === 'p') input.block = false;

  const knock = (type === 'special' ? 1.45 : type === 'kick' ? 0.65 : 0.42) * (side === 'p' ? 1 : -1);
  defender.root.position.x += knock;
  defender.root.position.z += (Math.random() - 0.5) * 0.22;

  const color = type === 'special' ? 0xffcf6a : 0xffc177;
  world.spawnHit(pos, color, type === 'special' ? 2.0 : type === 'kick' ? 1.15 : 0.9);
  if (type === 'special') world.spawnHit(pos.clone().add(new THREE.Vector3(0, 0.2, 0)), defender.data.colors.accent, 1.6);
  audio.hit(type === 'special' ? 1.5 : type === 'kick' ? 1.1 : 0.9);
  game.shake = Math.max(game.shake, type === 'special' ? 1.0 : type === 'kick' ? 0.42 : 0.3);
  game.hitstop = type === 'special' ? 0.09 : 0.045;
  if (type === 'special') game.slowmo = Math.max(game.slowmo, 0.55);
  flashScreen(type === 'special' ? 0.5 : 0.16);
  damagePopup(pos, String(dmg), type === 'special' ? '#ff9a5a' : '#ffd479');
  if (navigator.vibrate) navigator.vibrate(type === 'special' ? [20, 30, 40] : 18);

  if (defender.health <= 0) {
    triggerKO(side);
  }
}

function checkAttackWindows(side) {
  const atk = game.attacks[side];
  if (!atk) return;
  const f = side === 'p' ? game.p : game.o;
  const win = HIT_WINDOW[atk.type];
  if (f.animTime >= win[0] && f.animTime <= win[1]) tryHit(side);
  if (f.animTime >= MOVE_DURATION[atk.type]) {
    game.attacks[side] = null;
    if (f.anim !== 'hit' && f.anim !== 'ko') f.setAnim('idle');
  }
}

function triggerKO(winnerSide) {
  if (game.phase !== 'fight') return;
  const loser = winnerSide === 'p' ? game.o : game.p;
  const winner = winnerSide === 'p' ? game.p : game.o;
  loser.health = 0;
  loser.setAnim('ko', {}, true);
  game.stun.p = game.stun.o = 0;
  game.attacks = { p: null, o: null };
  game.blocking = { p: false, o: false };
  game.phase = 'ko';
  game.phaseTime = 0;
  game.slowmo = 1.35;
  game.shake = 1.2;
  flashScreen(0.65);
  audio.ko();
  world.spawnHit(loser.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xffca7a, 2.6);
  showBanner('', 'K.O.', `${loser.data.name} IS DOWN`, true, 2100);
  if (winner.anim !== 'win') winner.setAnim('win', {}, true);
  if (navigator.vibrate) navigator.vibrate([60, 50, 90]);
  game.roundWinner = winnerSide;
}

/* ------------------------------------------------------------------ updates */

function moveClampX(x, min, max) {
  return clamp(x, min, max);
}

function arenaClamp(pos) {
  const maxR = 6.9;
  const r = Math.hypot(pos.x, pos.z);
  if (r > maxR) { pos.x = (pos.x / r) * maxR; pos.z = (pos.z / r) * maxR; }
  pos.z = clamp(pos.z, -4.7, 4.7);
}

function updatePlayer(dt) {
  const p = game.p;
  if (!p) return;
  if (game.stun.p > 0) return;
  if (game.attacks.p) return;

  if (input.block) {
    game.blocking.p = true;
    if (p.anim !== 'block') p.setAnim('block');
    return;
  }
  game.blocking.p = false;

  let x = input.joy.x;
  let z = input.joy.y;
  if (input.keys.has('a')) x -= 1;
  if (input.keys.has('d')) x += 1;
  if (input.keys.has('w')) z -= 1;
  if (input.keys.has('s')) z += 1;
  x = clamp(x, -1, 1);
  z = clamp(z, -1, 1);
  const mag = Math.hypot(x, z);
  if (mag > 1) { x /= mag; z /= mag; }

  const speed = p.data.speed;
  if (Math.abs(x) > 0.04) {
    p.root.position.x += x * speed * dt;
    if (p.anim !== 'walk') p.setAnim('walk', { moveDir: Math.sign(x) });
    else p.meta.moveDir = Math.sign(x);
  } else if (Math.abs(z) > 0.04) {
    p.root.position.z += z * speed * 0.85 * dt;
    if (p.anim !== 'strafe') p.setAnim('strafe', { strafeDir: Math.sign(z) });
    else p.meta.strafeDir = Math.sign(z);
  } else {
    if (p.anim !== 'idle') p.setAnim('idle');
  }
  p.root.position.x = moveClampX(p.root.position.x, -6.3, game.o.root.position.x - 0.82);
  arenaClamp(p.root.position);
}

function updateAI(dt) {
  const o = game.o;
  const p = game.p;
  if (!o || !p || game.stun.o > 0) return;
  if (game.phase !== 'fight') return;
  if (game.attacks.o) return;

  const dist = o.root.position.x - p.root.position.x;
  ai.block = Math.max(0, ai.block - dt);
  ai.strafe = Math.max(0, ai.strafe - dt);

  if (ai.block > 0) {
    game.blocking.o = true;
    if (o.anim !== 'block') o.setAnim('block');
    return;
  }
  game.blocking.o = false;

  const playerAtk = game.attacks.p;
  if (playerAtk && !playerAtk.applied && dist < 2.6) {
    const chance = 1 - Math.exp(-1.7 * dt);
    if (Math.random() < chance) {
      ai.block = 0.32 + Math.random() * 0.2;
      game.blocking.o = true;
      if (o.anim !== 'block') o.setAnim('block');
      return;
    }
  }

  ai.timer -= dt;
  if (ai.timer <= 0) {
    ai.timer = 0.26 + Math.random() * 0.42;
    const r = Math.random();
    if (game.meter.o >= 100 && dist < 2.35 && r < 0.35) {
      startAttack('o', 'special');
      return;
    }
    if (dist < o.data.reach + 0.18) {
      if (r < 0.13) { ai.block = 0.3 + Math.random() * 0.3; game.blocking.o = true; if (o.anim !== 'block') o.setAnim('block'); return; }
      if (r < 0.27) { ai.strafe = 0.32; ai.strafeDir = Math.random() < 0.5 ? -1 : 1; return; }
      if (r < 0.72) { startAttack('o', r < 0.42 ? 'punch' : 'kick'); return; }
    } else if (dist < 3.0 && r < 0.18) {
      startAttack('o', 'kick');
      return;
    }
  }

  if (ai.strafe > 0) {
    o.root.position.z += ai.strafeDir * o.data.speed * 0.8 * dt;
    if (o.anim !== 'strafe') o.setAnim('strafe', { strafeDir: ai.strafeDir });
    else o.meta.strafeDir = ai.strafeDir;
  } else {
    let vx = 0;
    if (dist > o.data.reach + 0.15) vx = -1;
    else if (dist < 0.98) vx = 1;
    if (vx !== 0) {
      o.root.position.x += vx * o.data.speed * 0.85 * dt;
      if (o.anim !== 'walk') o.setAnim('walk', { moveDir: Math.sign(vx) });
      else o.meta.moveDir = Math.sign(vx);
    } else {
      if (o.anim !== 'idle' && o.anim !== 'block') o.setAnim('idle');
    }
    const dz = p.root.position.z - o.root.position.z;
    if (Math.abs(dz) > 0.08) {
      o.root.position.z += Math.sign(dz) * Math.min(Math.abs(dz), o.data.speed * 0.7 * dt);
    }
  }
  o.root.position.x = clamp(o.root.position.x, p.root.position.x + 0.85, 6.3);
  arenaClamp(o.root.position);
}

function updateFight(dt) {
  const p = game.p;
  const o = game.o;
  if (!p || !o) return;

  game.phaseTime += dt;

  if (game.phase === 'intro') {
    if (game.phaseTime > 1.7) {
      game.phase = 'fight';
      game.phaseTime = 0;
      showCallout('FIGHT!', '#ffd479');
      audio.gong();
    }
  } else if (game.phase === 'fight') {
    game.timeLeft -= dt;
    if (game.timeLeft <= 0) {
      game.timeLeft = 0;
      game.phase = 'roundend';
      game.phaseTime = 0;
      const pr = p.health / p.maxHealth;
      const or = o.health / o.maxHealth;
      showBanner('TIME UP', pr >= or ? 'ROUND WON' : 'ROUND LOST', `${Math.round(pr * 100)}% — ${Math.round(or * 100)}%`, false, 1400);
      audio.gong();
    }
    updatePlayer(dt);
    updateAI(dt);

    if (game.stun.p > 0) {
      game.stun.p -= dt;
      if (game.stun.p <= 0 && p.anim === 'hit') p.setAnim('idle');
    }
    if (game.stun.o > 0) {
      game.stun.o -= dt;
      if (game.stun.o <= 0 && o.anim === 'hit') o.setAnim('idle');
    }

    const latk = game.attacks.p;
    const oAtk = game.attacks.o;
    for (const side of ['p', 'o']) {
      const atk = game.attacks[side];
      if (!atk) continue;
      const f = side === 'p' ? p : o;
      if (atk.type === 'special' && f.animTime > 0.1 && f.animTime < 0.62) {
        const dir = side === 'p' ? 1 : -1;
        f.root.position.x += dir * 3.0 * dt;
        if (f.animTime % 0.12 < dt && Math.random() < 0.5) {
          world.spawnDust(f.root.position.clone().add(new THREE.Vector3(0, 0.05, 0)), f.data.colors.accent, 1, 0.7);
        }
      }
      if (side === 'p') f.root.position.x = clamp(f.root.position.x, -6.3, o.root.position.x - 0.8);
      else f.root.position.x = clamp(f.root.position.x, p.root.position.x + 0.8, 6.3);
      arenaClamp(f.root.position);
    }
    if (latk || oAtk) {
      p.update(dt);
      o.update(dt);
      if (game.attacks.p) checkAttackWindows('p');
      if (game.attacks.o) checkAttackWindows('o');
    } else {
      p.update(dt);
      o.update(dt);
    }
    updateHUD();
  } else if (game.phase === 'ko') {
    p.update(dt);
    o.update(dt);
    if (game.phaseTime > 2.35) {
      game.phase = 'ko-done';
      resolveRound(game.roundWinner === 'p' ? 'p' : 'o');
      game.phaseTime = 0;
    }
    updateHUD();
  } else if (game.phase === 'roundend') {
    p.update(dt);
    o.update(dt);
    if (game.phaseTime > 1.45) {
      const pr = p.health / p.maxHealth;
      const or = o.health / o.maxHealth;
      resolveRound(pr >= or ? 'p' : 'o');
    }
    updateHUD();
  } else if (game.phase === 'roundover') {
    p.update(dt);
    o.update(dt);
    if (game.phaseTime > 1.55) {
      game.round++;
      startRound();
    }
  } else if (game.phase === 'matchover') {
    p.update(dt);
    o.update(dt);
    updateHUD();
  }

  if (game.combo.timer > 0) {
    game.combo.timer -= dt;
    if (game.combo.timer <= 0) {
      game.combo.count = 0;
      $('combo').classList.remove('show');
    }
  }

  updateShadows();
}

function updateShadows() {
  models.forEach((m, i) => {
    const s = shadows[i];
    s.visible = m.root.visible;
    if (!s.visible) return;
    s.position.x = m.root.position.x;
    s.position.z = m.root.position.z;
    const ko = m.anim === 'ko';
    s.scale.setScalar(ko ? 2.1 : 1.35);
    s.material.opacity = ko ? 0.5 : 0.8;
  });
}

function updateShowcase(time) {
  const m = models[game.selected];
  if (!m) return;
  const portrait = window.innerWidth / window.innerHeight < 0.85;
  if (game.mode === 'menu' && portrait) {
    m.root.visible = false;
    return;
  }
  m.root.visible = true;
  m.root.rotation.y = 0.16 + Math.sin(time * 0.35) * 0.13;
  m.update(1 / 60);
}

/* ------------------------------------------------------------------ camera */

function updateCamera(dt, time) {
  if (game.mode === 'fight') {
    const p = game.p;
    const o = game.o;
    if (p && o) {
      const sep = Math.abs(o.root.position.x - p.root.position.x);
      const mid = (o.root.position.x + p.root.position.x) / 2;
      const zMid = (o.root.position.z + p.root.position.z) / 2;
      const aspect = window.innerWidth / window.innerHeight;
      const portrait = aspect < 0.85;
      camera.fov = portrait ? 64 : 46;
      const halfWidth = Math.max(portrait ? 1.9 : 2.8, sep * 0.5 + (portrait ? 0.2 : 1.2));
      const hFov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect);
      let dist = halfWidth / Math.tan(hFov / 2);
      dist = clamp(dist, portrait ? 6.2 : 5.0, portrait ? 13 : 14);
      const ko = game.phase === 'ko' || game.phase === 'matchover';
      const zoom = ko ? 0.9 : 1;
      const target = new THREE.Vector3(
        mid * (portrait ? 0.28 : 0.5),
        (portrait ? 1.62 : 1.82) * zoom + (ko ? 0.25 : 0),
        dist * zoom + zMid * 0.35
      );
      const look = new THREE.Vector3(mid * (portrait ? 0.35 : 0.55), (portrait ? 1.06 : 1.32) + (ko ? 0.12 : 0), zMid * 0.5);
      game.camPos.lerp(target, 1 - Math.exp(-5.5 * dt));
      game.camLook.lerp(look, 1 - Math.exp(-7 * dt));
      camera.position.copy(game.camPos);
      if (game.shake > 0.002) {
        const s = game.shake;
        camera.position.x += (Math.random() - 0.5) * s * 0.24;
        camera.position.y += (Math.random() - 0.5) * s * 0.2;
        camera.position.z += (Math.random() - 0.5) * s * 0.14;
      }
      camera.lookAt(game.camLook);
      camera.rotation.z += (Math.random() - 0.5) * game.shake * 0.012;
      camera.updateProjectionMatrix();
      return;
    }
  }

  const inMenu = game.mode === 'menu';
  const aspect = window.innerWidth / window.innerHeight;
  const portrait = aspect < 0.85;
  camera.fov = inMenu ? (portrait ? 52 : 44) : (portrait ? 50 : 42);
  const radius = inMenu ? (portrait ? 6.6 : 4.8) : (portrait ? 5.9 : 4.3);
  const angle = inMenu ? Math.sin(time * 0.11) * 0.3 - 0.05 : Math.sin(time * 0.16) * 0.32 - 0.16;
  const height = inMenu ? 2.05 : 1.75;
  const target = new THREE.Vector3(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
  const shift = portrait ? 0 : (inMenu ? 1.0 : 0.86);
  const look = new THREE.Vector3(-shift, inMenu ? 1.15 : 1.02, 0);
  game.camPos.lerp(target, 1 - Math.exp(-3.2 * dt));
  game.camLook.lerp(look, 1 - Math.exp(-4 * dt));
  camera.position.copy(game.camPos);
  camera.lookAt(game.camLook);
  camera.updateProjectionMatrix();
}

/* ------------------------------------------------------------------ loop */

const clock = new THREE.Clock();

function frame() {
  const raw = Math.min(clock.getDelta(), 0.05);
  game.time += raw;

  let dt = raw;
  if (game.hitstop > 0) {
    game.hitstop -= raw;
    dt = raw * 0.08;
  } else if (game.slowmo > 0) {
    game.slowmo -= raw;
    dt = raw * 0.34;
  }

  if (game.mode === 'fight' && !game.paused) {
    updateFight(dt);
  } else if ((game.mode === 'menu' || game.mode === 'select') && !game.paused) {
    updateShowcase(game.time);
    updateShadows();
  }

  if (!game.paused) {
    world.update(game.mode === 'fight' ? dt * 0.85 + raw * 0.15 : raw, game.time);
    game.shake = damp(game.shake, 0, 7.5, raw);
    if (game.shake < 0.002) game.shake = 0;
  }

  if (game.mode === 'fight' && game.p && game.o) {
    if (game.phase !== 'matchover') {
      ringP.position.set(game.p.root.position.x, 0.025, game.p.root.position.z);
      ringO.position.set(game.o.root.position.x, 0.025, game.o.root.position.z);
      const pulse = 0.32 + Math.sin(game.time * 4) * 0.06;
      ringP.material.opacity = pulse;
      ringO.material.opacity = pulse;
    }
  }

  updateCamera(raw, game.time);
  renderer.render(scene, camera);
}

/* ------------------------------------------------------------------ wiring */

function enterSelect() {
  audio.unlock();
  audio.startMusic();
  audio.ui();
  game.mode = 'select';
  selectFighter(game.selected);
  showScreen('select');
}

$('btn-enter').addEventListener('click', enterSelect);
$('btn-back').addEventListener('click', () => {
  audio.ui();
  game.mode = 'menu';
  game.selected = game.selected;
  models.forEach((m, i) => { m.root.visible = i === game.selected; });
  const m = models[game.selected];
  m.root.position.set(0, 0, 0);
  m.root.rotation.set(0, 0.16, 0);
  m.setAnim('idle', {}, true);
  showScreen('menu');
});
$('btn-fight').addEventListener('click', () => { audio.unlock(); audio.ui(); startMatch(); });
$('roster-prev').addEventListener('click', () => { audio.ui(); selectFighter(game.selected - 1); });
$('roster-next').addEventListener('click', () => { audio.ui(); selectFighter(game.selected + 1); });

$('btn-sound').addEventListener('click', e => {
  audio.unlock();
  audio.setEnabled(!audio.enabled);
  e.currentTarget.textContent = audio.enabled ? 'SOUND ON' : 'SOUND OFF';
  e.currentTarget.setAttribute('aria-pressed', String(audio.enabled));
  if (audio.enabled) audio.startMusic(); else audio.stopMusic();
});

$('btn-fullscreen').addEventListener('click', async () => {
  audio.unlock();
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
      if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape').catch(() => {});
    } else {
      await document.exitFullscreen?.();
    }
  } catch {}
});

$('btn-help').addEventListener('click', () => { audio.ui(); $('help').classList.add('show'); });
$('btn-help-close').addEventListener('click', () => { audio.ui(); $('help').classList.remove('show'); });
$('help').addEventListener('click', e => { if (e.target === $('help')) $('help').classList.remove('show'); });

function togglePause() {
  if (game.mode !== 'fight' || game.phase === 'matchover') return;
  game.paused = !game.paused;
  $('pause').classList.toggle('show', game.paused);
  if (game.paused) audio.stopMusic(); else audio.startMusic();
  audio.ui();
}
$('btn-pause').addEventListener('click', togglePause);
$('btn-resume').addEventListener('click', togglePause);
$('btn-restart').addEventListener('click', () => {
  game.paused = false;
  $('pause').classList.remove('show');
  audio.ui();
  startMatch();
});
$('btn-quit').addEventListener('click', () => { audio.ui(); quitToSelect(); });
$('btn-rematch').addEventListener('click', () => { audio.ui(); $('result').classList.remove('show'); startMatch(); });
$('btn-choose').addEventListener('click', () => { audio.ui(); quitToSelect(); });

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });

/* ------------------------------------------------------------------ boot */

selectFighter(0);
models.forEach((m, i) => { m.root.visible = i === 0; });
$('loading').classList.remove('show');
$('menu').classList.add('show');
game.mode = 'menu';
game.camPos.set(0, 2.4, 6.2);
game.camLook.set(0, 1.15, 0);

renderer.setAnimationLoop(frame);

setTimeout(() => {
  if (game.mode === 'menu') toast('TAP ENTER THE ARENA TO BEGIN', 2200);
}, 1600);
