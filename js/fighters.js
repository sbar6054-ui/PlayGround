import * as THREE from '../vendor/three.module.js';

export const MOVE_DURATION = { punch: 0.34, kick: 0.52, special: 0.95 };

export const HIT_WINDOW = {
  punch: [0.075, 0.2],
  kick: [0.16, 0.33],
  special: [0.22, 0.7],
};

export const FIGHTERS = [
  {
    id: 'kaze',
    name: 'KAZE',
    title: 'THE CRIMSON STORM',
    bio: 'A wandering shinobi whose blade-hand never misses. Fast, precise, unforgiving.',
    style: 'ninja',
    accent: '#e3364a',
    stats: { power: 62, speed: 92, reach: 72 },
    health: 1000,
    reach: 1.62,
    speed: 1.7,
    damage: 1.0,
    colors: {
      suit: 0x28334f, suit2: 0x18203a, accent: 0xe23a4e, trim: 0xf0c878,
      skin: 0xe2ad88, hair: 0x1b1523, metal: 0xc6cedb, eye: 0xffd889,
    },
    scale: 1.0,
    bulk: 1.0,
  },
  {
    id: 'raiga',
    name: 'RAIGA',
    title: 'THE IRON TYPHOON',
    bio: 'A mountain breaker with fists like cannon shot. Slow to wind up, impossible to stop.',
    style: 'brawler',
    accent: '#ff7a3d',
    stats: { power: 98, speed: 54, reach: 68 },
    health: 1120,
    reach: 1.6,
    speed: 1.28,
    damage: 1.28,
    colors: {
      suit: 0x4b2a1b, suit2: 0x2f1911, accent: 0xf07a35, trim: 0xf5bd57,
      skin: 0xc58960, hair: 0x2b1a10, metal: 0x9a9184, eye: 0xffb347,
    },
    scale: 1.07,
    bulk: 1.28,
  },
  {
    id: 'hana',
    name: 'HANA',
    title: 'THE JADE WHISPER',
    bio: 'A shrine dancer who turned silk into a weapon. Her kicks land before the sound arrives.',
    style: 'kicker',
    accent: '#46e0ad',
    stats: { power: 55, speed: 99, reach: 86 },
    health: 940,
    reach: 1.78,
    speed: 1.9,
    damage: 0.9,
    colors: {
      suit: 0x155449, suit2: 0x0c332d, accent: 0x40e8b4, trim: 0xf3dc9f,
      skin: 0xebbb95, hair: 0x2b2024, metal: 0xd5e2db, eye: 0x7dffe0,
    },
    scale: 0.97,
    bulk: 0.92,
  },
  {
    id: 'oni',
    name: 'ONI',
    title: 'THE DEMON SHOGUN',
    bio: 'The arena was built on his grave. He returns every tournament to reclaim it.',
    style: 'oni',
    accent: '#a06bff',
    stats: { power: 92, speed: 66, reach: 80 },
    health: 1080,
    reach: 1.72,
    speed: 1.5,
    damage: 1.18,
    colors: {
      suit: 0x342050, suit2: 0x1c102e, accent: 0x9a5cff, trim: 0xd4b1ff,
      skin: 0x9a6577, hair: 0x170b1e, metal: 0x7d7392, eye: 0xff4d7a,
    },
    scale: 1.05,
    bulk: 1.16,
  },
];

function mat(color, roughness = 0.72, metalness = 0.08, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity });
}

function capsule(radius, length, material) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 5, 10), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function roundedBox(w, h, d, material, radius = 0.03) {
  const geo = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function sphere(r, material, w = 12, h = 10) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, w, h), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function makePose() {
  return {
    bob: 0, bodyX: 0, bodyY: 0, bodyZ: 0,
    torsoX: 0, torsoY: 0, torsoZ: 0, headX: 0, headY: 0,
    sLx: 0, sLy: 0, sLz: 0, eLx: 0, eLz: 0,
    sRx: 0, sRy: 0, sRz: 0, eRx: 0, eRz: 0,
    hLx: 0, hLz: 0, kLx: 0, hRx: 0, hRz: 0, kRx: 0,
  };
}

const COMBAT_KEYS = Object.keys(makePose());

function guardBase() {
  const p = makePose();
  p.sLx = -0.52; p.sLz = -0.2; p.eLx = -1.92;
  p.sRx = -0.52; p.sRz = 0.2; p.eRx = -1.92;
  p.hLx = -0.08; p.hRx = 0.08;
  p.torsoX = 0.04;
  p.headX = -0.04;
  return p;
}

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class Fighter {
  constructor(data, { player = false } = {}) {
    this.data = data;
    this.player = player;
    this.maxHealth = data.health;
    this.health = data.health;
    this.root = new THREE.Group();
    this.root.scale.setScalar(data.scale);
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.current = makePose();
    this.target = makePose();
    this.anim = 'idle';
    this.animTime = 0;
    this.meta = {};
    this.forward = 1;
    this.ribbons = [];
    this.glowParts = [];
    this._build();
    this.applyPose(this.current, true);
  }

  setFacing(sign) {
    this.forward = sign;
    this.root.rotation.y = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  _build() {
    const c = this.data.colors;
    const bulk = this.data.bulk;
    const skin = mat(c.skin, 0.68, 0.02);
    const suit = mat(c.suit, 0.7, 0.12);
    const suit2 = mat(c.suit2, 0.82, 0.06);
    const accent = mat(c.accent, 0.48, 0.25, c.accent, 0.18);
    const trim = mat(c.trim, 0.36, 0.55);
    const metal = mat(c.metal, 0.3, 0.85);
    const dark = mat(0x0a0810, 0.9, 0.1);
    const hair = mat(c.hair, 0.85, 0.08);
    const eye = mat(c.eye, 0.25, 0.1, c.eye, 2.2);
    this.materials = { skin, suit, suit2, accent, trim, metal, dark, hair, eye };

    const hips = new THREE.Group();
    hips.position.y = 0.92;
    this.body.add(hips);
    this.hips = hips;

    const pelvis = roundedBox(0.34 * bulk, 0.2, 0.25 * bulk, suit);
    pelvis.position.y = 0.02;
    hips.add(pelvis);

    const belt = roundedBox(0.4 * bulk, 0.09, 0.3 * bulk, trim);
    belt.position.y = 0.1;
    hips.add(belt);

    if (this.data.style === 'ninja' || this.data.style === 'kicker') {
      const sash = roundedBox(0.15, 0.42, 0.035, accent);
      sash.position.set(0.15 * bulk, -0.12, -0.14 * bulk);
      sash.rotation.z = 0.16;
      hips.add(sash);
      this.ribbons.push({ mesh: sash, base: 0.16, phase: 0, amp: 0.22, axis: 'z' });
    }

    const torso = new THREE.Group();
    torso.position.y = 0.14;
    hips.add(torso);
    this.torso = torso;

    const chest = capsule(0.22 * bulk, 0.22, suit);
    chest.scale.set(1.35, 1.05, 0.82);
    chest.position.y = 0.24;
    torso.add(chest);

    if (this.data.style === 'brawler' || this.data.style === 'oni') {
      const plate = roundedBox(0.42 * bulk, 0.3, 0.16, suit2);
      plate.position.set(0, 0.28, 0.11 * bulk);
      torso.add(plate);
      const rune = roundedBox(0.08, 0.2, 0.02, accent);
      rune.position.set(0, 0.3, 0.2 * bulk);
      torso.add(rune);
    } else {
      const strap = roundedBox(0.09, 0.44, 0.02, trim);
      strap.position.set(-0.06, 0.24, 0.2 * bulk);
      strap.rotation.z = -0.34;
      torso.add(strap);
    }

    const neck = capsule(0.075 * bulk, 0.05, skin);
    neck.position.y = 0.48;
    torso.add(neck);

    const head = new THREE.Group();
    head.position.y = 0.57;
    torso.add(head);
    this.head = head;

    const skull = sphere(0.15, skin, 16, 14);
    skull.scale.set(0.92, 1.1, 0.95);
    skull.position.y = 0.1;
    head.add(skull);

    const jaw = sphere(0.105, skin, 12, 10);
    jaw.scale.set(1, 0.8, 0.9);
    jaw.position.set(0, 0.03, 0.035);
    head.add(jaw);

    const eyeGeo = new THREE.SphereGeometry(0.026, 8, 6);
    const eyeL = new THREE.Mesh(eyeGeo, eye);
    eyeL.position.set(-0.055, 0.12, 0.128);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.055;
    head.add(eyeL, eyeR);
    this.glowParts.push(eyeL, eyeR);

    const brow = roundedBox(0.13, 0.018, 0.02, dark);
    brow.position.set(0, 0.152, 0.128);
    head.add(brow);

    if (this.data.style === 'ninja') {
      const mask = roundedBox(0.21, 0.14, 0.075, suit2);
      mask.position.set(0, 0.0, 0.118);
      head.add(mask);
      const maskTrim = roundedBox(0.215, 0.02, 0.06, accent);
      maskTrim.position.set(0, 0.065, 0.12);
      head.add(maskTrim);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.022, 6, 18), accent);
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.155;
      band.scale.z = 1.2;
      head.add(band);
      for (let i = 0; i < 2; i++) {
        const ribbon = roundedBox(0.07, 0.42, 0.012, accent);
        ribbon.position.set(0.09 + i * 0.02, 0.02, -0.16);
        ribbon.rotation.z = -0.2 - i * 0.12;
        ribbon.rotation.x = 0.35;
        head.add(ribbon);
        this.ribbons.push({ mesh: ribbon, base: ribbon.rotation.z, phase: i * 1.3, amp: 0.3, axis: 'z' });
      }
      const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.05, 6, 14), accent);
      scarf.rotation.x = Math.PI / 2;
      scarf.position.y = 0.47;
      scarf.scale.z = 0.8;
      torso.add(scarf);
    } else if (this.data.style === 'brawler') {
      const hairTop = sphere(0.14, hair, 10, 8);
      hairTop.scale.set(1, 0.7, 1);
      hairTop.position.y = 0.18;
      head.add(hairTop);
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.27 - i * 0.02, 6), accent);
        spike.position.set(0, 0.3 + i * 0.01, 0.06 - i * 0.04);
        spike.rotation.x = -0.2 + i * 0.12;
        spike.castShadow = true;
        head.add(spike);
      }
      const beard = roundedBox(0.17, 0.11, 0.08, hair);
      beard.position.set(0, -0.035, 0.128);
      head.add(beard);
    } else if (this.data.style === 'kicker') {
      const hairBack = sphere(0.16, hair, 12, 10);
      hairBack.scale.set(1.02, 0.98, 1.03);
      hairBack.position.set(0, 0.145, -0.055);
      head.add(hairBack);
      const fringe = roundedBox(0.27, 0.075, 0.1, hair);
      fringe.position.set(0, 0.205, 0.115);
      head.add(fringe);
      const ponytail = new THREE.Group();
      ponytail.position.set(0.02, 0.15, -0.14);
      head.add(ponytail);
      for (let i = 0; i < 4; i++) {
        const tail = capsule(0.055 - i * 0.009, 0.22, hair);
        tail.position.set(0.02 - i * 0.02, -0.02 - i * 0.19, -0.03 - i * 0.035);
        tail.rotation.z = -0.12 - i * 0.06;
        tail.rotation.x = -0.18;
        ponytail.add(tail);
        this.ribbons.push({ mesh: tail, base: tail.rotation.z, phase: i * 0.8, amp: 0.16, axis: 'z' });
      }
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.018, 5, 10), accent);
      tie.rotation.x = Math.PI / 2;
      tie.position.set(0, 0.015, 0);
      ponytail.add(tie);
      const pin = roundedBox(0.03, 0.12, 0.02, trim);
      pin.position.set(0.12, 0.19, 0.05);
      pin.rotation.z = 0.5;
      head.add(pin);
    } else if (this.data.style === 'oni') {
      const mask = roundedBox(0.25, 0.21, 0.08, dark);
      mask.position.set(0, 0.055, 0.118);
      head.add(mask);
      const maskRidge = roundedBox(0.06, 0.19, 0.05, trim);
      maskRidge.position.set(0, 0.06, 0.16);
      head.add(maskRidge);
      for (const s of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.24, 6), trim);
        horn.position.set(0.1 * s, 0.25, 0.02);
        horn.rotation.z = -0.35 * s;
        horn.castShadow = true;
        head.add(horn);
        const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.09, 5), trim);
        tusk.position.set(0.055 * s, -0.02, 0.13);
        tusk.rotation.x = Math.PI;
        head.add(tusk);
      }
      const mane = roundedBox(0.3, 0.34, 0.16, hair);
      mane.position.set(0, 0.05, -0.1);
      head.add(mane);
    }

    for (const s of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(0.28 * bulk * s, 0.42, 0);
      torso.add(shoulder);
      const isRight = s > 0;
      const pad = sphere(0.105 * bulk, this.data.style === 'brawler' ? metal : this.data.style === 'oni' ? accent : suit2, 10, 8);
      pad.scale.set(1.2, 0.88, 1);
      shoulder.add(pad);
      if (this.data.style === 'brawler') {
        const padTrim = new THREE.Mesh(new THREE.TorusGeometry(0.082 * bulk, 0.018, 5, 10), accent);
        padTrim.rotation.y = Math.PI / 2;
        padTrim.position.x = 0.02 * s;
        shoulder.add(padTrim);
      }
      if (this.data.style === 'oni') {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 6), trim);
        spike.position.set(0.06 * s, 0.12, 0);
        spike.rotation.z = -0.5 * s;
        spike.castShadow = true;
        shoulder.add(spike);
      }
      const upper = capsule(0.062 * bulk, 0.18, suit);
      upper.position.y = -0.14;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -0.3;
      shoulder.add(elbow);
      const fore = capsule(0.055 * bulk, 0.16, this.data.style === 'brawler' || this.data.style === 'oni' ? suit2 : suit);
      fore.position.y = -0.12;
      elbow.add(fore);
      const guardMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.075 * bulk, 0.065 * bulk, 0.17, 8), metal);
      guardMesh.position.y = -0.14;
      guardMesh.castShadow = true;
      elbow.add(guardMesh);
      const fist = sphere(0.075 * bulk, suit2, 10, 8);
      fist.position.y = -0.29;
      elbow.add(fist);
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.064 * bulk, 0.014, 5, 10), accent);
      wrap.rotation.x = Math.PI / 2;
      wrap.position.y = -0.235;
      elbow.add(wrap);
      if (isRight) { this.shoulderR = shoulder; this.elbowR = elbow; }
      else { this.shoulderL = shoulder; this.elbowL = elbow; }
    }

    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(0.13 * bulk * s, -0.02, 0);
      hips.add(hip);
      const thigh = capsule(0.085 * bulk, 0.24, suit);
      thigh.position.y = -0.19;
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.4;
      hip.add(knee);
      const shin = capsule(0.065 * bulk, 0.24, suit2);
      shin.position.y = -0.2;
      knee.add(shin);
      const kneePad = sphere(0.07 * bulk, accent, 8, 6);
      kneePad.scale.set(1, 0.8, 1);
      kneePad.position.set(0, 0.015, 0.045);
      knee.add(kneePad);
      const foot = roundedBox(0.15 * bulk, 0.1, 0.3, dark);
      foot.position.set(0, -0.4, 0.075);
      knee.add(foot);
      if (s > 0) { this.hipR = hip; this.kneeR = knee; }
      else { this.hipL = hip; this.kneeL = knee; }
    }

    this.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } o.layers.enable(1); });
  }

  setAnim(name, meta = {}, force = false) {
    if (this.anim === name && !force) {
      if (meta && Object.keys(meta).length) this.meta = meta;
      return;
    }
    this.anim = name;
    this.animTime = 0;
    this.meta = meta;
  }

  update(dt) {
    this.animTime += dt;
    const t = this.animTime;
    const m = this.meta;
    const p = guardBase();

    switch (this.anim) {
      case 'idle': {
        const s = Math.sin(t * 2.7);
        p.bob = s * 0.018;
        p.torsoX = 0.045 + s * 0.012;
        p.headX = -0.04 - s * 0.01;
        p.sLx += s * 0.02; p.sRx -= s * 0.02;
        p.hLx = -0.1; p.hRx = 0.14; p.kLx = 0.06; p.kRx = 0.04;
        break;
      }
      case 'walk': {
        const dir = m.moveDir ?? 1;
        const s = Math.sin(t * 8.5);
        const c = Math.cos(t * 8.5);
        p.bob = Math.abs(s) * 0.035;
        p.hLx = -0.38 * s * (dir >= 0 ? 1 : -1);
        p.hRx = 0.38 * s * (dir >= 0 ? 1 : -1);
        p.kLx = Math.max(0, -s) * 0.8;
        p.kRx = Math.max(0, s) * 0.8;
        p.torsoX = 0.07;
        p.torsoY = s * 0.06 * dir;
        p.hLz = -0.04; p.hRz = 0.04;
        p.bob += c * 0.004;
        break;
      }
      case 'strafe': {
        const s = Math.sin(t * 7);
        p.bob = Math.abs(s) * 0.03;
        p.hLz = 0.26 * s; p.hRz = 0.26 * s;
        p.hLx = -0.18 - s * 0.1; p.hRx = -0.18 + s * 0.1;
        p.kLx = 0.2; p.kRx = 0.2;
        p.torsoZ = -m.strafeDir * 0.12;
        break;
      }
      case 'block': {
        p.bob = -0.06;
        p.torsoX = 0.14;
        p.headX = 0.08;
        p.sLx = -0.95; p.sLz = -0.6; p.eLx = -2.15; p.eLz = 0.5;
        p.sRx = -0.95; p.sRz = 0.6; p.eRx = -2.05; p.eRz = -0.4;
        p.hLx = -0.24; p.hRx = -0.16; p.kLx = 0.32; p.kRx = 0.28;
        p.hLz = -0.1; p.hRz = 0.1;
        break;
      }
      case 'hit': {
        const power = m.power ?? 1;
        const k = Math.min(1, t / 0.16);
        p.bob = 0.01 * power;
        p.bodyX = 0.16 * power * k;
        p.torsoX = 0.24 * power * k;
        p.headX = 0.32 * power * k;
        p.sLx = 0.15; p.sLz = -0.7; p.eLx = -0.5;
        p.sRx = 0.2; p.sRz = 0.75; p.eRx = -0.35;
        p.hLx = -0.22; p.hRx = -0.12; p.kLx = 0.2; p.kRx = 0.18;
        p.bodyZ = 0.06 * power * k;
        break;
      }
      case 'ko': {
        const k = Math.min(1, t / 0.55);
        const e = 1 - Math.pow(1 - k, 3);
        p.bodyX = -1.42 * e;
        p.bodyZ = 0.18 * e;
        p.bob = -0.02;
        p.torsoX = -0.12;
        p.headX = -0.28;
        p.sLx = 0.4; p.sLz = -1.3; p.eLx = -0.3;
        p.sRx = 0.2; p.sRz = 1.3; p.eRx = -0.2;
        p.hLx = 0.2; p.hRx = 0.05; p.kLx = 0.4; p.kRx = 0.24;
        p.hLz = -0.3; p.hRz = 0.3;
        break;
      }
      case 'win': {
        const s = Math.sin(t * 4.2);
        p.bob = Math.abs(Math.sin(t * 4.2)) * 0.05;
        p.sLx = -2.5 - s * 0.15; p.sLz = -0.35; p.eLx = -0.35;
        p.sRx = -2.5 + s * 0.15; p.sRz = 0.35; p.eRx = -0.35;
        p.torsoX = -0.1;
        p.headX = -0.18;
        p.hLx = -0.08; p.hRx = 0.08;
        break;
      }
      case 'intro': {
        const s = Math.sin(t * 3);
        p.bob = s * 0.012;
        p.torsoY = s * 0.12;
        p.headY = -s * 0.1;
        p.sLx = -0.7; p.sRx = -0.7;
        break;
      }
      case 'attack': {
        this._attackPose(p, m.type || 'punch', t);
        break;
      }
      default:
        break;
    }

    this.target = p;
    const critical = this.anim === 'attack' || this.anim === 'hit' || this.anim === 'ko';
    const rate = critical ? 26 : 11;
    const k = 1 - Math.exp(-rate * dt);
    for (const key of COMBAT_KEYS) {
      if (key === 'bodyY') continue;
      this.current[key] = lerp(this.current[key], p[key], k);
    }
    this.current.bodyY = this.anim === 'attack' && m.type === 'special'
      ? lerpAngle(this.current.bodyY, p.bodyY, Math.min(1, dt * 20))
      : lerpAngle(this.current.bodyY, p.bodyY, k);

    if (this.anim === 'walk' || this.anim === 'strafe' || this.anim === 'idle') {
      for (const r of this.ribbons) {
        const sway = Math.sin(t * (this.anim === 'idle' ? 1.8 : 5.5) + r.phase) * r.amp * (this.anim === 'idle' ? 0.5 : 1);
        r.mesh.rotation[r.axis] = r.base + sway;
      }
    } else {
      for (const r of this.ribbons) r.mesh.rotation[r.axis] = lerp(r.mesh.rotation[r.axis], r.base, 0.15);
    }

    this.applyPose(this.current, false);
  }

  _attackPose(p, type, t) {
    if (type === 'punch') {
      const D = MOVE_DURATION.punch;
      const wind = Math.min(1, t / 0.085);
      const strike = t < 0.085 ? 0 : t < 0.19 ? Math.min(1, (t - 0.085) / 0.055) : Math.max(0, 1 - (t - 0.19) / 0.15);
      const right = this.meta.variant !== 1;
      const side = right ? 1 : -1;
      const sgn = right ? -1 : 1;
      p.torsoY = sgn * (0.18 * wind + 0.42 * strike);
      p.bodyX = 0.02 + 0.05 * strike;
      if (right) {
        p.sRx = -0.52 + 0.35 * wind - 1.25 * strike;
        p.sRz = 0.2 - 0.1 * strike;
        p.eRx = -1.92 + 0.55 * wind + 1.82 * strike;
        p.sLx = -0.52 - 0.18 * strike; p.eLx = -1.92 - 0.15 * strike;
      } else {
        p.sLx = -0.52 + 0.35 * wind - 1.25 * strike;
        p.sLz = -0.2 + 0.1 * strike;
        p.eLx = -1.92 + 0.55 * wind + 1.82 * strike;
        p.sRx = -0.52 - 0.18 * strike; p.eRx = -1.92 - 0.15 * strike;
      }
      p.hLx = -0.16; p.hRx = 0.22;
      p.kLx = 0.12; p.kRx = 0.1;
      p.bob = 0.02 * strike;
      p.headY = sgn * 0.12 * strike;
      p.torsoX = 0.06 + 0.1 * strike;
      p.bob += t > D * 0.86 ? -0.01 : 0;
    } else if (type === 'kick') {
      const wind = Math.min(1, t / 0.14);
      const strike = t < 0.14 ? 0 : t < 0.3 ? Math.min(1, (t - 0.14) / 0.07) : Math.max(0, 1 - (t - 0.3) / 0.2);
      const high = this.meta.variant === 1;
      p.bodyZ = -0.1 * strike;
      p.torsoY = 0.24 * strike;
      p.torsoX = -0.08 - 0.16 * strike;
      p.bob = 0.045 * strike;
      p.sLx = -0.75 - 0.3 * strike; p.sLz = -0.55; p.eLx = -1.6;
      p.sRx = -0.6 + 0.4 * strike; p.sRz = 0.8; p.eRx = -1.4;
      p.hRx = 0.18 + (high ? -1.55 : -1.15) * strike + 0.2 * wind;
      p.kRx = 0.95 - 0.9 * strike;
      p.hRz = 0.06;
      p.hLx = -0.32 * strike;
      p.kLx = 0.24 + 0.35 * strike;
      p.headX = -0.1;
      p.headY = -0.12 * strike;
    } else if (type === 'special') {
      const D = MOVE_DURATION.special;
      const pct = Math.min(1, t / D);
      const spin = pct * Math.PI * 2;
      const air = Math.sin(Math.min(1, pct * 1.15) * Math.PI);
      p.bodyY = spin;
      p.bob = air * 0.62;
      p.bodyX = -0.12 * air;
      p.torsoX = -0.1;
      p.sLx = -1.35 - 0.3 * air; p.sLz = -1.25; p.eLx = -0.1;
      p.sRx = -1.35 - 0.3 * air; p.sRz = 1.25; p.eRx = -0.1;
      p.hLx = -0.2 - 0.5 * air; p.hRx = 0.1 + 0.7 * air;
      p.kLx = 0.5 - 0.3 * air; p.kRx = 0.2 - 0.4 * air;
      p.hLz = -0.2; p.hRz = 0.2;
      p.headX = -0.18;
    }
  }

  applyPose(p, snap = false) {
    const b = this.body;
    b.position.y = p.bob;
    b.rotation.x = p.bodyX;
    b.rotation.y = p.bodyY;
    b.rotation.z = p.bodyZ;
    this.torso.rotation.x = p.torsoX;
    this.torso.rotation.y = p.torsoY;
    this.torso.rotation.z = p.torsoZ;
    this.head.rotation.x = p.headX;
    this.head.rotation.y = p.headY;
    this.shoulderL.rotation.set(p.sLx, p.sLy, p.sLz);
    this.elbowL.rotation.set(p.eLx, 0, p.eLz);
    this.shoulderR.rotation.set(p.sRx, p.sRy, p.sRz);
    this.elbowR.rotation.set(p.eRx, 0, p.eRz);
    this.hipL.rotation.set(p.hLx, 0, p.hLz);
    this.kneeL.rotation.x = p.kLx;
    this.hipR.rotation.set(p.hRx, 0, p.hRz);
    this.kneeR.rotation.x = p.kRx;
    if (snap) {
      this.current = { ...p };
    }
  }

  isActionDone() {
    if (this.anim === 'attack') return this.animTime >= MOVE_DURATION[this.meta.type || 'punch'];
    return true;
  }

  reset(x, z, facing) {
    this.health = this.maxHealth;
    this.root.position.set(x, 0, z);
    this.setFacing(facing);
    this.anim = 'idle';
    this.animTime = 0;
    this.current = makePose();
    this.applyPose(this.current, true);
    this.root.visible = true;
    this.root.rotation.z = 0;
  }
}
