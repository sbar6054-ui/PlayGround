import * as THREE from '../vendor/three.module.js';

function canvasTexture(size, draw, { repeat = 1, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

function radialTexture(size, stops, power = 1) {
  return canvasTexture(size, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    for (const [stop, color] of stops) g.addColorStop(stop, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    if (power !== 1) {
      ctx.globalCompositeOperation = 'destination-in';
      const g2 = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g2.addColorStop(0, 'rgba(255,255,255,1)');
      g2.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, s, s);
    }
  }, { repeat: 1, srgb: true });
}

function makeGlow() {
  return radialTexture(128, [
    [0, 'rgba(255,255,255,1)'],
    [0.18, 'rgba(255,235,190,0.95)'],
    [0.45, 'rgba(255,160,80,0.35)'],
    [1, 'rgba(255,90,40,0)'],
  ]);
}

function makeSmoke() {
  return canvasTexture(256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) {
      const x = s * (0.2 + Math.random() * 0.6);
      const y = s * (0.2 + Math.random() * 0.6);
      const r = s * (0.08 + Math.random() * 0.22);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.16)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeat: 1, srgb: false });
}

function makePetalTexture() {
  return canvasTexture(64, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const g = ctx.createRadialGradient(s * 0.5, s * 0.45, 1, s * 0.5, s * 0.45, s * 0.42);
    g.addColorStop(0, 'rgba(255,240,245,1)');
    g.addColorStop(0.5, 'rgba(255,170,205,0.95)');
    g.addColorStop(1, 'rgba(255,120,170,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(s / 2, s / 2, s * 0.22, s * 0.34, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }, { repeat: 1, srgb: true });
}

function makeStone() {
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#2a2430';
    ctx.fillRect(0, 0, s, s);
    const tile = s / 4;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const v = 30 + Math.floor(Math.random() * 18);
        ctx.fillStyle = `rgb(${v + 8},${v + 2},${v + 12})`;
        ctx.fillRect(x * tile + 3, y * tile + 3, tile - 6, tile - 6);
        ctx.strokeStyle = 'rgba(10,8,14,0.85)';
        ctx.lineWidth = 4;
        ctx.strokeRect(x * tile + 2, y * tile + 2, tile - 4, tile - 4);
        ctx.strokeStyle = 'rgba(190,170,150,0.10)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x * tile + 7, y * tile + 7, tile - 14, tile - 14);
        for (let k = 0; k < 7; k++) {
          ctx.strokeStyle = `rgba(20,16,24,${0.15 + Math.random() * 0.2})`;
          ctx.lineWidth = 1 + Math.random();
          ctx.beginPath();
          let px = x * tile + Math.random() * tile;
          let py = y * tile + Math.random() * tile;
          ctx.moveTo(px, py);
          for (let j = 0; j < 3; j++) {
            px += (Math.random() - 0.5) * 34;
            py += (Math.random() - 0.5) * 34;
            ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }
    }
    const glow = ctx.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s * 0.75);
    glow.addColorStop(0, 'rgba(255,180,110,0.10)');
    glow.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, s, s);
  }, { repeat: 3, srgb: true });
}

function makeEmblem() {
  return canvasTexture(512, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const cx = s / 2, cy = s / 2;
    ctx.strokeStyle = 'rgba(240,205,130,0.85)';
    for (const [r, w, a] of [[238, 5, 0.9], [224, 1.5, 0.5], [188, 2, 0.6], [92, 1.5, 0.5]]) {
      ctx.globalAlpha = a;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 188, cy + Math.sin(a) * 188);
      ctx.lineTo(cx + Math.cos(a) * 224, cy + Math.sin(a) * 224);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const a = t * Math.PI * 2.2 - 0.4;
      const r = 30 + t * 150;
      const x = cx + Math.cos(a) * r + Math.sin(a * 3) * 16;
      const y = cy + Math.sin(a) * r * 0.95;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(240,205,130,0.9)';
    ctx.beginPath();
    ctx.moveTo(cx + 172, cy - 66);
    ctx.lineTo(cx + 208, cy - 96);
    ctx.lineTo(cx + 190, cy - 48);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 180, cy - 66, 7, 0, Math.PI * 2);
    ctx.fill();
  }, { repeat: 1, srgb: true });
}

function makeBanner() {
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#5d0f1c';
    ctx.fillRect(0, 0, s, s);
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, 'rgba(255,150,100,0.18)');
    g.addColorStop(0.5, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#e8bd6d';
    ctx.lineWidth = 8;
    ctx.strokeRect(14, 14, s - 28, s - 28);
    ctx.strokeStyle = 'rgba(232,189,109,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeRect(26, 26, s - 52, s - 52);
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.strokeStyle = '#f0cf88';
    ctx.lineWidth = 7;
    ctx.beginPath();
    for (let i = 0; i <= 46; i++) {
      const a = (i / 46) * Math.PI * 2;
      const r = s * (0.22 + Math.sin(a * 5) * 0.035 + Math.sin(a * 2 + 1) * 0.025);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'rgba(240,207,136,0.9)';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(20,5,10,0.4)';
    for (let i = 0; i < 40; i++) {
      ctx.fillRect(Math.random() * s, Math.random() * s, Math.random() * 20, 1);
    }
  }, { repeat: 1, srgb: true });
}

export function createWorld(scene, renderer) {
  const glowTex = makeGlow();
  const smokeTex = makeSmoke();
  const petalTex = makePetalTexture();
  const stoneTex = makeStone();
  const bannerTex = makeBanner();
  const emblemTex = makeEmblem();

  const envCanvas = document.createElement('canvas');
  envCanvas.width = 512;
  envCanvas.height = 256;
  {
    const ctx = envCanvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#1a1430');
    g.addColorStop(0.45, '#3d1f42');
    g.addColorStop(0.62, '#b3543a');
    g.addColorStop(0.72, '#2a1524');
    g.addColorStop(1, '#08060d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 256);
    const sun = ctx.createRadialGradient(150, 140, 0, 150, 140, 110);
    sun.addColorStop(0, 'rgba(255,220,160,0.9)');
    sun.addColorStop(0.2, 'rgba(255,150,80,0.45)');
    sun.addColorStop(1, 'rgba(255,100,50,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, 512, 256);
  }
  const envTex = new THREE.CanvasTexture(envCanvas);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  envTex.colorSpace = THREE.SRGBColorSpace;
  scene.environment = envTex;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 320);
  camera.position.set(0, 2.6, 8.4);

  scene.fog = new THREE.FogExp2(0x1a1020, 0.019);

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x06040d) },
      midColor: { value: new THREE.Color(0x2b1738) },
      horizonColor: { value: new THREE.Color(0xd0643a) },
      bottomColor: { value: new THREE.Color(0x110a14) },
      sunColor: { value: new THREE.Color(0xffca7a) },
      sunDir: { value: new THREE.Vector3(-0.3, 0.14, -0.94).normalize() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      uniform vec3 topColor, midColor, horizonColor, bottomColor, sunColor, sunDir;
      varying vec3 vDir;
      float hash(vec3 p){ p = fract(p * 0.3183099 + vec3(0.1,0.2,0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(horizonColor, midColor, smoothstep(-0.02, 0.42, h));
        col = mix(col, topColor, smoothstep(0.34, 0.92, h));
        col = mix(col, bottomColor, smoothstep(0.0, -0.35, h));
        float sun = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * pow(sun, 300.0) * 2.0;
        col += sunColor * pow(sun, 14.0) * 0.28;
        col += vec3(1.0, 0.65, 0.4) * pow(sun, 3.0) * 0.06;
        float star = step(0.9978, hash(floor(d * 720.0))) * smoothstep(0.22, 0.65, h);
        col += vec3(0.9, 0.9, 1.0) * star * 0.9;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(220, 32, 24), skyMat);
  scene.add(sky);

  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc07a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  sunSprite.position.set(-24, 12, -82);
  sunSprite.scale.set(38, 38, 1);
  scene.add(sunSprite);

  const hemi = new THREE.HemisphereLight(0x9c86c2, 0x30181c, 0.78);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb877, 3.2);
  sun.position.set(-7, 13, 8);
  sun.castShadow = true;
  const lowPower = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  sun.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
  sun.shadow.camera.left = -11;
  sun.shadow.camera.right = 11;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -8;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.025;
  scene.add(sun);
  const rimA = new THREE.PointLight(0xff3157, 20, 22, 2);
  rimA.position.set(-8, 4.5, 3);
  scene.add(rimA);
  const rimB = new THREE.PointLight(0x7b5bff, 20, 22, 2);
  rimB.position.set(8, 5, -2);
  scene.add(rimB);
  const topLight = new THREE.PointLight(0xffd2a0, 12, 20, 2);
  topLight.position.set(0, 9, 2);
  scene.add(topLight);
  const fill = new THREE.DirectionalLight(0xffe0c2, 0.55);
  fill.position.set(3, 6, 10);
  scene.add(fill);
  const coolRim = new THREE.DirectionalLight(0x8b7cff, 0.45);
  coolRim.position.set(-4, 5, -10);
  scene.add(coolRim);
  const centerSpot = new THREE.SpotLight(0xffe2bf, 160, 26, 0.95, 0.65, 1.35);
  centerSpot.position.set(0, 10, 5);
  centerSpot.target.position.set(0, 0, 0);
  scene.add(centerSpot, centerSpot.target);
  const fighterFill = new THREE.DirectionalLight(0xffe6cf, 1.9);
  fighterFill.position.set(2.5, 5, 9);
  fighterFill.layers.set(1);
  scene.add(fighterFill);
  const fighterRim = new THREE.DirectionalLight(0xb79cff, 1.15);
  fighterRim.position.set(-3, 4, -9);
  fighterRim.layers.set(1);
  scene.add(fighterRim);

  const world = new THREE.Group();
  scene.add(world);
  const animated = [];
  const lanterns = [];

  const floorMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    bumpMap: stoneTex,
    bumpScale: 0.06,
    roughness: 0.82,
    metalness: 0.22,
    color: 0xb9aab8,
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(8.4, 96), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.005;
  floor.receiveShadow = true;
  world.add(floor);

  const edge = new THREE.Mesh(new THREE.TorusGeometry(8.4, 0.13, 8, 96), new THREE.MeshStandardMaterial({ color: 0x6b4a2a, metalness: 0.85, roughness: 0.3, emissive: 0x3a1c08, emissiveIntensity: 0.5 }));
  edge.rotation.x = Math.PI / 2;
  edge.position.y = 0.02;
  world.add(edge);

  const innerRing = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.34, 80), new THREE.MeshStandardMaterial({ color: 0x4a2c22, metalness: 0.8, roughness: 0.4, emissive: 0x1b0c06, emissiveIntensity: 0.6 }));
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.012;
  world.add(innerRing);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 4.9), new THREE.MeshBasicMaterial({ color: 0x8a5a2a, transparent: true, opacity: 0.22 }));
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = a + Math.PI / 2;
    line.position.set(Math.cos(a) * 5.8, 0.013, Math.sin(a) * 5.8);
    world.add(line);
  }

  const emblem = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 5.6),
    new THREE.MeshBasicMaterial({ map: emblemTex, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  emblem.rotation.x = -Math.PI / 2;
  emblem.position.y = 0.016;
  world.add(emblem);

  const under = new THREE.Mesh(new THREE.CylinderGeometry(8.6, 7.6, 1.1, 64), new THREE.MeshStandardMaterial({ color: 0x171019, roughness: 0.9, metalness: 0.1 }));
  under.position.y = -0.56;
  world.add(under);
  const underGlow = new THREE.Mesh(new THREE.TorusGeometry(8.2, 0.16, 8, 96), new THREE.MeshBasicMaterial({ color: 0xff6a2a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  underGlow.rotation.x = Math.PI / 2;
  underGlow.position.y = -1.05;
  world.add(underGlow);

  const waterMat = new THREE.MeshStandardMaterial({ color: 0x0a0914, roughness: 0.18, metalness: 0.95, envMapIntensity: 0.8 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(150, 64), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -5.2;
  world.add(water);

  const mountains = new THREE.Group();
  for (let layer = 0; layer < 2; layer++) {
    const radius = 62 + layer * 38;
    const color = layer === 0 ? 0x2b1938 : 0x1d1229;
    const count = layer === 0 ? 34 : 26;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + layer * 0.13 + Math.random() * 0.1;
      const gap = Math.max(0, 1 - Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) / 0.75);
      const h = ((layer === 0 ? 4.5 : 9) + Math.random() * (layer === 0 ? 9 : 17)) * (1 - gap * 0.45);
      const r = (layer === 0 ? 9 : 13) + Math.random() * (layer === 0 ? 13 : 18);
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6 + Math.floor(Math.random() * 4), 1), new THREE.MeshBasicMaterial({ color, fog: true }));
      m.position.set(Math.cos(a) * radius, -5.2 + h / 2, Math.sin(a) * radius);
      m.rotation.y = Math.random() * Math.PI;
      m.rotation.z = (Math.random() - 0.5) * 0.09;
      m.scale.x = 1.2 + Math.random() * 0.9;
      mountains.add(m);
    }
  }
  world.add(mountains);

  function buildTorii(x, z, scale = 1) {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x8f241f, roughness: 0.7, metalness: 0.08 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x2c1010, roughness: 0.85 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xcaa25c, metalness: 0.65, roughness: 0.35 });
    const H = 5.4;
    for (const s of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.27, H, 12), wood);
      pillar.position.set(2.5 * s, H / 2, 0);
      pillar.rotation.z = -0.035 * s;
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      g.add(pillar);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.3, 12), darkWood);
      foot.position.set(2.5 * s, 0.15, 0);
      g.add(foot);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.32, 0.5), wood);
    top.position.y = H;
    top.castShadow = true;
    g.add(top);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.16, 0.8), darkWood);
    roof.position.y = H + 0.22;
    g.add(roof);
    for (const s of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.78), darkWood);
      tip.position.set(3.5 * s, H + 0.3, 0);
      tip.rotation.z = 0.14 * s;
      g.add(tip);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.24, 0.34), wood);
    beam.position.y = H - 0.8;
    g.add(beam);
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.14), gold);
    plaque.position.set(0, H - 0.36, 0.02);
    g.add(plaque);
    for (const s of [-1, 1]) {
      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffd7a0, emissive: 0xffa04a, emissiveIntensity: 1.6, roughness: 0.6 }));
      lantern.scale.set(0.85, 1.1, 0.85);
      lantern.position.set(1.55 * s, H - 1.25, 0);
      g.add(lantern);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 4), darkWood);
      cord.position.set(1.55 * s, H - 0.95, 0);
      g.add(cord);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff9a45, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.copy(lantern.position);
      glow.scale.set(1.7, 1.7, 1);
      g.add(glow);
      lanterns.push(lantern);
    }
    g.position.set(x, 0, z);
    g.scale.setScalar(scale);
    g.rotation.y = 0;
    world.add(g);
    return g;
  }
  buildTorii(0, -8.4, 1.0);

  function buildStoneLantern(x, z, scale = 1) {
    const g = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0x3c343c, roughness: 0.9, metalness: 0.05 });
    const emissive = new THREE.MeshStandardMaterial({ color: 0xffd7a0, emissive: 0xff9a3c, emissiveIntensity: 2.2, roughness: 0.5 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, 0.24, 6), stone);
    base.position.y = 0.12;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 1.0, 6), stone);
    post.position.y = 0.74;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.4, 0.46), stone);
    box.position.y = 1.46;
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.3), emissive);
    light.position.y = 1.46;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.32, 6), stone);
    cap.position.y = 1.82;
    for (const m of [base, post, box, light, cap]) { m.castShadow = true; g.add(m); }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff9a45, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.y = 1.46;
    glow.scale.set(2.0, 2.0, 1);
    g.add(glow);
    g.position.set(x, 0, z);
    g.scale.setScalar(scale);
    world.add(g);
    lanterns.push(light);
    return g;
  }
  for (let i = 0; i < 6; i++) {
    if (i === 1) continue;
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    buildStoneLantern(Math.cos(a) * 7.2, Math.sin(a) * 7.2, 0.9 + (i % 2) * 0.12);
  }

  function buildBanner(x, z, rot, scale = 1) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 4.4, 6), new THREE.MeshStandardMaterial({ color: 0x241712, roughness: 0.9 }));
    pole.position.y = 2.2;
    g.add(pole);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 2.7, 1, 1), new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.92, side: THREE.DoubleSide, emissive: 0x25070c, emissiveIntensity: 0.25 }));
    cloth.position.set(0.6, 2.8, 0);
    cloth.castShadow = true;
    g.add(cloth);
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    g.scale.setScalar(scale);
    world.add(g);
    animated.push({ type: 'banner', mesh: cloth, base: rot, phase: Math.random() * 6 });
    return g;
  }
  buildBanner(-4.6, -6.3, 0.25);
  buildBanner(4.6, -6.3, -0.25);
  buildBanner(-7.3, -2.2, 0.9, 0.85);

  function buildTree(x, z, s = 1) {
    const g = new THREE.Group();
    const bark = new THREE.MeshStandardMaterial({ color: 0x241318, roughness: 0.95 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 3.2, 8), bark);
    trunk.position.y = 1.6;
    trunk.rotation.z = -0.1;
    trunk.castShadow = true;
    g.add(trunk);
    const branches = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const len = 1.4 + Math.random() * 1.4;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, len, 6), bark);
      b.position.set(Math.cos(a) * 0.4, 2.9 + Math.random() * 0.8, Math.sin(a) * 0.4);
      b.rotation.z = Math.cos(a) * 0.7;
      b.rotation.x = Math.sin(a) * 0.7;
      b.castShadow = true;
      g.add(b);
      branches.push({ x: Math.cos(a) * (0.6 + len * 0.4), y: 3.2 + Math.random() * 1.0, z: Math.sin(a) * (0.6 + len * 0.4) });
    }
    const petalGeo = new THREE.IcosahedronGeometry(0.13, 0);
    const petalMat = new THREE.MeshStandardMaterial({ color: 0xffb6cf, roughness: 0.85, emissive: 0x641735, emissiveIntensity: 0.25, flatShading: true });
    const count = 90;
    const inst = new THREE.InstancedMesh(petalGeo, petalMat, count);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const b = branches[i % branches.length];
      const r = Math.random() * 1.15;
      const a = Math.random() * Math.PI * 2;
      dummy.position.set(b.x + Math.cos(a) * r, b.y + (Math.random() - 0.5) * 1.1, b.z + Math.sin(a) * r);
      dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      const sc = 0.6 + Math.random() * 1.2;
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      col.setHSL(0.93 + Math.random() * 0.04, 0.55, 0.72 + Math.random() * 0.12);
      inst.setColorAt(i, col);
    }
    inst.castShadow = true;
    g.add(inst);
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    world.add(g);
    return g;
  }
  buildTree(-8.4, -4.6, 1.0);
  buildTree(8.7, -5.2, 0.9);
  buildTree(6.8, 3.2, 0.7);

  const rockMat = new THREE.MeshStandardMaterial({ color: 0x241a26, roughness: 0.95, flatShading: true });
  const rocks = [];
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const radius = 12 + Math.random() * 22;
    const r = 0.8 + Math.random() * 3.4;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rockMat);
    let px = Math.cos(a) * radius;
    let pz = Math.sin(a) * radius;
    if (Math.abs(px) < 17 && pz > -4) pz = -Math.abs(pz) - 13;
    rock.position.set(px, -3.6 + Math.random() * 3.4, pz);
    rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    rock.castShadow = true;
    world.add(rock);
    rocks.push({ mesh: rock, baseY: rock.position.y, phase: Math.random() * 6, amp: 0.2 + Math.random() * 0.4 });
  }

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    const mist = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x8b5a7a, transparent: true, opacity: 0.13, depthWrite: false }));
    mist.position.set(Math.cos(a) * (14 + Math.random() * 16), -2.3 + Math.random() * 2.6, Math.sin(a) * (14 + Math.random() * 16));
    mist.scale.set(16 + Math.random() * 18, 9 + Math.random() * 10, 1);
    scene.add(mist);
    animated.push({ type: 'mist', mesh: mist, baseX: mist.position.x, baseZ: mist.position.z, phase: Math.random() * 6, speed: 0.05 + Math.random() * 0.05 });
  }

  const moteGeo = new THREE.BufferGeometry();
  const moteCount = 260;
  const motePos = new Float32Array(moteCount * 3);
  const moteSeed = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 14;
    motePos[i * 3] = Math.cos(a) * r;
    motePos[i * 3 + 1] = Math.random() * 8;
    motePos[i * 3 + 2] = Math.sin(a) * r;
    moteSeed[i] = Math.random();
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({ map: glowTex, color: 0xffb066, size: 0.11, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  const motes = new THREE.Points(moteGeo, moteMat);
  scene.add(motes);

  const fireflyGeo = new THREE.BufferGeometry();
  const ffCount = 70;
  const ffPos = new Float32Array(ffCount * 3);
  const ffSeed = [];
  for (let i = 0; i < ffCount; i++) {
    ffPos[i * 3] = (Math.random() - 0.5) * 18;
    ffPos[i * 3 + 1] = 0.4 + Math.random() * 5;
    ffPos[i * 3 + 2] = (Math.random() - 0.5) * 18;
    ffSeed.push({ phase: Math.random() * 10, speed: 0.3 + Math.random() * 0.7 });
  }
  fireflyGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  const fireflies = new THREE.Points(fireflyGeo, new THREE.PointsMaterial({ map: glowTex, color: 0xffe07a, size: 0.16, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(fireflies);

  const petalGeo = new THREE.BufferGeometry();
  const petalCount = 220;
  const petalPos = new Float32Array(petalCount * 3);
  const petalVel = [];
  for (let i = 0; i < petalCount; i++) {
    petalPos[i * 3] = (Math.random() - 0.5) * 26;
    petalPos[i * 3 + 1] = Math.random() * 12;
    petalPos[i * 3 + 2] = (Math.random() - 0.5) * 26;
    petalVel.push({ speed: 0.18 + Math.random() * 0.4, drift: Math.random() * Math.PI * 2 });
  }
  petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPos, 3));
  const petals = new THREE.Points(petalGeo, new THREE.PointsMaterial({ map: petalTex, color: 0xffb9d4, size: 0.14, transparent: true, opacity: 0.92, depthWrite: false, alphaTest: 0.02 }));
  scene.add(petals);

  const contactTex = radialTexture(128, [
    [0, 'rgba(0,0,0,0.72)'],
    [0.55, 'rgba(0,0,0,0.34)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  const contactMaterial = new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.NormalBlending });

  const effects = [];
  const shardGeo = new THREE.TetrahedronGeometry(0.055);
  let flashLight = null;

  function spawnHit(pos, color = 0xffca7a, power = 1) {
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.position.copy(pos);
      const sc = (0.15 + Math.random() * 0.45) * power;
      s.scale.setScalar(sc);
      scene.add(s);
      const a = Math.random() * Math.PI * 2;
      const b = (Math.random() - 0.5) * Math.PI;
      const sp = (2.2 + Math.random() * 5) * power;
      effects.push({ type: 'spark', mesh: s, life: 0, max: 0.24 + Math.random() * 0.3, v: new THREE.Vector3(Math.cos(a) * Math.cos(b) * sp, Math.sin(b) * sp + 1.2, Math.sin(a) * Math.cos(b) * sp), grav: -7, scale0: sc });
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.22, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
    ring.position.copy(pos);
    ring.lookAt(camera.position);
    scene.add(ring);
    effects.push({ type: 'ring', mesh: ring, life: 0, max: 0.36, scale0: 1, grow: 9 * power });

    for (let i = 0; i < Math.floor(5 * power); i++) {
      const shard = new THREE.Mesh(shardGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending }));
      shard.position.copy(pos);
      shard.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      scene.add(shard);
      effects.push({ type: 'shard', mesh: shard, life: 0, max: 0.4 + Math.random() * 0.3, v: new THREE.Vector3((Math.random() - 0.5) * 7, 2 + Math.random() * 5, (Math.random() - 0.5) * 7), grav: -16, spin: (Math.random() - 0.5) * 20 });
    }

    if (!flashLight) {
      flashLight = new THREE.PointLight(color, 0, 9, 2);
      scene.add(flashLight);
    }
    flashLight.position.copy(pos);
    flashLight.color.set(color);
    flashLight.intensity = 45 * power;
    flashLight.userData.life = 0.18;
  }

  function spawnDust(pos, color = 0xa88a72, count = 4, power = 1) {
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color, transparent: true, opacity: 0.32, depthWrite: false }));
      s.position.copy(pos);
      s.position.x += (Math.random() - 0.5) * 0.4;
      s.position.z += (Math.random() - 0.5) * 0.4;
      s.position.y += 0.08;
      const sc = (0.5 + Math.random() * 0.7) * power;
      s.scale.set(sc, sc * 0.7, 1);
      scene.add(s);
      effects.push({ type: 'dust', mesh: s, life: 0, max: 0.6 + Math.random() * 0.5, v: new THREE.Vector3((Math.random() - 0.5) * 0.9, 0.35 + Math.random() * 0.7, (Math.random() - 0.5) * 0.9), grav: 0, scale0: sc, opacity: 0.32 });
    }
  }

  function spawnAura(pos, color = 0x7b5bff) {
    for (let i = 0; i < 26; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      const a = Math.random() * Math.PI * 2;
      const r = 0.35 + Math.random() * 0.4;
      s.position.set(pos.x + Math.cos(a) * r, 0.15 + Math.random() * 1.6, pos.z + Math.sin(a) * r);
      s.scale.setScalar(0.15 + Math.random() * 0.3);
      scene.add(s);
      effects.push({ type: 'aura', mesh: s, life: 0, max: 0.6 + Math.random() * 0.5, v: new THREE.Vector3(Math.cos(a) * 1.4, 2 + Math.random() * 2.4, Math.sin(a) * 1.4), grav: 0, scale0: s.scale.x, opacity: 0.9 });
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.35, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.03, pos.z);
    scene.add(ring);
    effects.push({ type: 'ring', mesh: ring, life: 0, max: 0.6, scale0: 1, grow: 7, billboard: false, opacity: 0.55 });
  }

  function spawnConfetti(pos, color = 0xffca7a) {
    for (let i = 0; i < 40; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: i % 3 === 0 ? 0xff7396 : color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.position.set(pos.x + (Math.random() - 0.5) * 2, pos.y + Math.random() * 2.6, pos.z + (Math.random() - 0.5) * 1.4);
      s.scale.setScalar(0.1 + Math.random() * 0.22);
      scene.add(s);
      effects.push({ type: 'spark', mesh: s, life: 0, max: 1.2 + Math.random() * 1.2, v: new THREE.Vector3((Math.random() - 0.5) * 3.2, 1.5 + Math.random() * 4, (Math.random() - 0.5) * 2), grav: -3.2, scale0: s.scale.x });
    }
  }

  function update(dt, time) {
    for (const a of animated) {
      if (a.type === 'banner') {
        a.mesh.rotation.y = Math.sin(time * 1.4 + a.phase) * 0.06;
        a.mesh.rotation.z = Math.sin(time * 0.9 + a.phase * 2) * 0.02;
      } else if (a.type === 'mist') {
        a.mesh.position.x = a.baseX + Math.sin(time * a.speed + a.phase) * 4;
        a.mesh.position.z = a.baseZ + Math.cos(time * a.speed * 0.8 + a.phase) * 4;
      }
    }
    for (const r of rocks) {
      r.mesh.position.y = r.baseY + Math.sin(time * 0.4 + r.phase) * r.amp;
      r.mesh.rotation.y += dt * 0.02;
    }
    for (const l of lanterns) {
      if (l.material) l.material.emissiveIntensity = 1.9 + Math.sin(time * 5 + l.id) * 0.35;
    }
    underGlow.material.opacity = 0.38 + Math.sin(time * 1.3) * 0.1;
    emblem.rotation.z = Math.sin(time * 0.15) * 0.04;
    emblem.material.opacity = 0.26 + Math.sin(time * 0.8) * 0.05;
    waterMat.envMapIntensity = 0.7 + Math.sin(time * 0.5) * 0.1;

    const mp = motes.geometry.attributes.position;
    for (let i = 0; i < moteCount; i++) {
      let y = mp.getY(i) + dt * (0.18 + moteSeed[i] * 0.35);
      if (y > 8.5) y = 0;
      mp.setY(i, y);
      mp.setX(i, mp.getX(i) + Math.sin(time * 0.4 + i) * dt * 0.08);
    }
    mp.needsUpdate = true;

    const fp = fireflies.geometry.attributes.position;
    for (let i = 0; i < ffCount; i++) {
      const s = ffSeed[i];
      fp.setX(i, fp.getX(i) + Math.sin(time * s.speed + s.phase) * dt * 0.35);
      fp.setY(i, fp.getY(i) + Math.cos(time * s.speed * 0.8 + s.phase) * dt * 0.2);
      fp.setZ(i, fp.getZ(i) + Math.cos(time * s.speed * 0.6 + s.phase) * dt * 0.35);
    }
    fp.needsUpdate = true;

    const pp = petals.geometry.attributes.position;
    for (let i = 0; i < petalCount; i++) {
      const v = petalVel[i];
      let y = pp.getY(i) - dt * v.speed;
      let x = pp.getX(i) + Math.sin(time * 0.7 + v.drift) * dt * 0.55;
      let z = pp.getZ(i) + Math.cos(time * 0.5 + v.drift) * dt * 0.3;
      if (y < 0.04) { y = 11 + Math.random() * 2; x = (Math.random() - 0.5) * 26; z = (Math.random() - 0.5) * 26; }
      pp.setX(i, x); pp.setY(i, y); pp.setZ(i, z);
    }
    pp.needsUpdate = true;

    if (flashLight) {
      flashLight.userData.life -= dt;
      flashLight.intensity = Math.max(0, flashLight.userData.life / 0.18) * 45;
      if (flashLight.userData.life <= 0) { scene.remove(flashLight); flashLight = null; }
    }

    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.life += dt;
      const p = e.life / e.max;
      if (e.v) {
        if (e.grav) e.v.y += e.grav * dt;
        e.mesh.position.addScaledVector(e.v, dt);
      }
      if (e.type === 'ring') {
        const k = 1 + p * e.grow;
        e.mesh.scale.setScalar(k);
        e.mesh.material.opacity = (e.opacity ?? 0.9) * (1 - p);
        if (e.billboard !== false) e.mesh.quaternion.copy(camera.quaternion);
      } else if (e.type === 'spark') {
        e.mesh.material.opacity = 1 - p;
        e.mesh.scale.setScalar(e.scale0 * (1 + p * 1.4));
      } else if (e.type === 'shard') {
        e.mesh.material.opacity = 1 - p;
        e.mesh.rotation.x += e.spin * dt;
        e.mesh.rotation.y += e.spin * 0.7 * dt;
      } else if (e.type === 'dust') {
        const sc = e.scale0 * (1 + p * 2.1);
        e.mesh.scale.set(sc, sc * 0.75, 1);
        e.mesh.material.opacity = e.opacity * (1 - p);
      } else if (e.type === 'aura') {
        e.mesh.material.opacity = e.opacity * (1 - p);
        e.mesh.scale.setScalar(e.scale0 * (1 + p * 1.2));
      }
      if (e.life >= e.max) {
        scene.remove(e.mesh);
        if (e.mesh.material) e.mesh.material.dispose();
        if (e.mesh.geometry && e.type !== 'spark' && e.type !== 'dust' && e.type !== 'aura') e.mesh.geometry.dispose();
        effects.splice(i, 1);
      }
    }
  }

  function makeContactShadow() {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), contactMaterial.clone());
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.02;
    m.renderOrder = 1;
    scene.add(m);
    return m;
  }

  world.updateMatrixWorld(true);
  const wp = new THREE.Vector3();
  world.traverse(o => {
    if (!o.isMesh) return;
    o.getWorldPosition(wp);
    if (wp.z > 0.8) o.castShadow = false;
  });

  return { camera, update, spawnHit, spawnDust, spawnAura, spawnConfetti, makeContactShadow, sun, hemi, rimA, rimB, glowTex, smokeTex };
}
