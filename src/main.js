import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import './style.css'
import { createAtlas, createIconURL, BLOCK, BLOCKS, HOTBAR, tileForFace } from './textures.js'
import { World, SEA_LEVEL, WORLD_SIZE } from './world.js'
import { Player } from './player.js'
import { Sound } from './audio.js'

const canvas = document.getElementById('game')
const playButton = document.getElementById('play')
const playLabel = document.getElementById('playLabel')
const loadingLabel = document.getElementById('loading')
const pauseOverlay = document.getElementById('pause')
const pauseButton = document.getElementById('pauseBtn')
const soundButton = document.getElementById('soundBtn')
const pauseSoundButton = document.getElementById('pauseSoundBtn')
const fullscreenButton = document.getElementById('fullscreenBtn')
const resetButton = document.getElementById('resetBtn')
const resumeButton = document.getElementById('resumeBtn')
const coordsLabel = document.getElementById('coords')
const seedLabel = document.getElementById('seedLabel')
const toastLabel = document.getElementById('toast')
const hotbarElement = document.getElementById('hotbar')
const joystick = document.getElementById('joystick')
const knob = document.getElementById('knob')
const jumpButton = document.getElementById('jumpBtn')
const mineButton = document.getElementById('mineBtn')
const placeButton = document.getElementById('placeBtn')
const underwaterElement = document.getElementById('underwater')

const coarsePointer = window.matchMedia('(pointer: coarse)').matches
const isTouch = coarsePointer || navigator.maxTouchPoints > 0 || window.innerWidth <= 820
document.body.classList.toggle('touch', isTouch)

const DEFAULT_SEED = 90210
const storedSeed = Number(sessionStorage.getItem('blockcraft-seed'))
const seed = Number.isFinite(storedSeed) && storedSeed > 0 ? storedSeed : DEFAULT_SEED

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.75 : 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.04
renderer.shadowMap.enabled = false

const scene = new THREE.Scene()
scene.background = new THREE.Color(0xc8e3f4)
scene.fog = new THREE.Fog(0xc8e3f4, 56, 148)

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.06, 900)
camera.rotation.order = 'YXZ'
scene.add(camera)

const sunDirection = new THREE.Vector3(-0.48, 0.74, 0.34).normalize()

const skyMaterial = new THREE.ShaderMaterial({
  uniforms: {
    topColor: { value: new THREE.Color(0x3d7bcd) },
    horizonColor: { value: new THREE.Color(0xdceffc) },
    sunColor: { value: new THREE.Color(0xfff4cf) },
    sunDir: { value: sunDirection.clone() }
  },
  vertexShader: `
    varying vec3 vDirection;
    void main() {
      vDirection = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 topColor;
    uniform vec3 horizonColor;
    uniform vec3 sunColor;
    uniform vec3 sunDir;
    varying vec3 vDirection;
    void main() {
      vec3 direction = normalize(vDirection);
      float height = clamp(direction.y * 1.15, 0.0, 1.0);
      vec3 color = mix(horizonColor, topColor, pow(height, 0.55));
      float sunAmount = max(dot(direction, normalize(sunDir)), 0.0);
      color += sunColor * pow(sunAmount, 420.0) * 0.8;
      color += sunColor * pow(sunAmount, 14.0) * 0.11;
      gl_FragColor = vec4(color, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
  side: THREE.BackSide,
  depthWrite: false,
  fog: false
})

const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 18), skyMaterial)
sky.frustumCulled = false
sky.renderOrder = -10
scene.add(sky)

function makeSunSprite() {
  const size = 128
  const sunCanvas = document.createElement('canvas')
  sunCanvas.width = size
  sunCanvas.height = size
  const ctx = sunCanvas.getContext('2d')
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,245,1)')
  gradient.addColorStop(0.18, 'rgba(255,246,205,0.95)')
  gradient.addColorStop(0.44, 'rgba(255,232,164,0.35)')
  gradient.addColorStop(1, 'rgba(255,226,150,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(sunCanvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: false,
    blending: THREE.AdditiveBlending
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.setScalar(96)
  sprite.renderOrder = -9
  return sprite
}

const sunSprite = makeSunSprite()
scene.add(sunSprite)

const hemisphere = new THREE.HemisphereLight(0xd8ecff, 0x6f6048, 1.35)
scene.add(hemisphere)

const ambient = new THREE.AmbientLight(0xffffff, 0.32)
scene.add(ambient)

const sunLight = new THREE.DirectionalLight(0xfff1d2, 2.1)
sunLight.position.copy(sunDirection).multiplyScalar(120)
scene.add(sunLight)

const atlas = createAtlas()

const waterTime = { value: 0 }

const solidMaterial = new THREE.MeshLambertMaterial({
  map: atlas.texture,
  vertexColors: true,
  alphaTest: 0.35,
  side: THREE.DoubleSide
})

const waterMaterial = new THREE.MeshPhongMaterial({
  map: atlas.texture,
  color: 0xffffff,
  transparent: true,
  opacity: 0.82,
  shininess: 110,
  specular: 0x9fd4ee,
  side: THREE.DoubleSide,
  depthWrite: true
})

waterMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = waterTime
  shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
     float wave = sin(position.x * 0.55 + uTime * 1.5) * 0.03 + sin(position.z * 0.7 + uTime * 1.1) * 0.025;
     transformed.y += wave;`
  )
}

const oceanMaterial = new THREE.MeshPhongMaterial({
  color: 0x2c7cb4,
  transparent: true,
  opacity: 0.92,
  shininess: 90,
  specular: 0x9fd4ee,
  depthWrite: false
})

const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), oceanMaterial)
ocean.rotation.x = -Math.PI / 2
ocean.position.set(WORLD_SIZE / 2, SEA_LEVEL + 0.8, WORLD_SIZE / 2)
scene.add(ocean)

const cloudMaterials = [
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.72, depthWrite: false, fog: true }),
  new THREE.MeshBasicMaterial({ color: 0xf2f8ff, transparent: true, opacity: 0.62, depthWrite: false, fog: true })
]
const cloudGeometry = new THREE.BoxGeometry(1, 1, 1)
const clouds = []
let cloudRandom = 23
const randomCloud = () => {
  cloudRandom = (Math.imul(cloudRandom, 1664525) + 1013904223) >>> 0
  return cloudRandom / 4294967296
}
const cloudMatrix = new THREE.Matrix4()
const cloudQuaternion = new THREE.Quaternion()
for (let i = 0; i < 30; i += 1) {
  const group = new THREE.Group()
  const boxCount = 3 + Math.floor(randomCloud() * 5)
  const pieces = []
  for (let j = 0; j < boxCount; j += 1) {
    const piece = cloudGeometry.clone()
    cloudMatrix.compose(
      new THREE.Vector3((randomCloud() - 0.5) * 24, (randomCloud() - 0.5) * 3, (randomCloud() - 0.5) * 22),
      cloudQuaternion,
      new THREE.Vector3(7 + randomCloud() * 16, 2 + randomCloud() * 3.5, 6 + randomCloud() * 13)
    )
    piece.applyMatrix4(cloudMatrix)
    pieces.push(piece)
  }
  const merged = mergeGeometries(pieces)
  for (const piece of pieces) piece.dispose()
  const mesh = new THREE.Mesh(merged, cloudMaterials[i % 2])
  group.add(mesh)
  const cloudAngle = randomCloud() * Math.PI * 2
  const cloudRadius = 55 + randomCloud() * 175
  group.position.set(
    WORLD_SIZE / 2 + Math.cos(cloudAngle) * cloudRadius,
    50 + randomCloud() * 22,
    WORLD_SIZE / 2 + Math.sin(cloudAngle) * cloudRadius
  )
  scene.add(group)
  clouds.push(group)
}

let world
let player
let spawn

try {
  world = new World(scene, solidMaterial, waterMaterial, seed)
  world.buildAll()
  spawn = world.findSpawn()
  player = new Player(camera, world)
  player.spawn(spawn)
  loadingLabel.textContent = 'World ready'
  loadingLabel.classList.add('done')
  playButton.disabled = false
  playLabel.textContent = 'Play'
} catch (error) {
  console.error(error)
  loadingLabel.textContent = 'Could not build the terrain'
  playLabel.textContent = 'Retry'
  playButton.disabled = false
  playButton.addEventListener('click', () => window.location.reload(), { once: true })
}

document.getElementById('brandIcon').src = createIconURL(BLOCK.GRASS, 96)

function buildHotbar() {
  HOTBAR.forEach((type, index) => {
    const slot = document.createElement('button')
    slot.type = 'button'
    slot.className = 'slot'
    slot.setAttribute('aria-label', BLOCKS[type].name)
    slot.dataset.index = String(index)
    const image = document.createElement('img')
    image.src = createIconURL(type, 96)
    image.alt = ''
    image.draggable = false
    const number = document.createElement('span')
    number.className = 'num'
    number.textContent = String(index + 1)
    slot.append(image, number)
    slot.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      if (!started) return
      selectSlot(index)
    })
    hotbarElement.append(slot)
  })
}

buildHotbar()
const slotElements = [...hotbarElement.querySelectorAll('.slot')]

const heldMaterials = []
const heldGroup = new THREE.Group()
{
  const geometry = new THREE.BoxGeometry(0.26, 0.26, 0.26)
  for (let face = 0; face < 6; face += 1) {
    const texture = atlas.texture.clone()
    texture.needsUpdate = true
    texture.repeat.set(1 / 8, 1 / 8)
    heldMaterials.push(new THREE.MeshLambertMaterial({ map: texture }))
  }
  const heldMesh = new THREE.Mesh(geometry, heldMaterials)
  const armMaterial = new THREE.MeshLambertMaterial({ color: 0xe0ad80 })
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), armMaterial)
  arm.position.set(0.075, -0.29, 0.24)
  arm.rotation.set(-0.4, 0, 0.34)
  heldGroup.add(heldMesh, arm)
  heldGroup.position.set(0.5, -0.46, -0.9)
  heldGroup.rotation.set(0.22, -0.58, 0.1)
  heldGroup.visible = false
  camera.add(heldGroup)
}

const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006)),
  new THREE.LineBasicMaterial({ color: 0x0a140d, transparent: true, opacity: 0.62 })
)
highlight.visible = false
scene.add(highlight)

const particleGeometry = new THREE.BoxGeometry(0.13, 0.13, 0.13)
const particleMaterials = new Map()
const particles = []

function particleMaterial(color) {
  if (!particleMaterials.has(color)) {
    particleMaterials.set(color, new THREE.MeshLambertMaterial({ color }))
  }
  return particleMaterials.get(color)
}

function burstParticles(x, y, z, color) {
  for (let i = 0; i < 14; i += 1) {
    const mesh = new THREE.Mesh(particleGeometry, particleMaterial(color))
    mesh.position.set(x + (Math.random() - 0.5) * 0.6, y + (Math.random() - 0.5) * 0.6, z + (Math.random() - 0.5) * 0.6)
    const scale = 0.6 + Math.random() * 0.9
    mesh.scale.setScalar(scale)
    scene.add(mesh)
    particles.push({
      mesh,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 3.6, 1.6 + Math.random() * 2.8, (Math.random() - 0.5) * 3.6),
      spin: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12),
      life: 0.6 + Math.random() * 0.5,
    })
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i]
    particle.life -= dt
    if (particle.life <= 0) {
      scene.remove(particle.mesh)
      particles.splice(i, 1)
      continue
    }
    particle.velocity.y -= 17 * dt
    particle.mesh.position.addScaledVector(particle.velocity, dt)
    particle.mesh.rotation.x += particle.spin.x * dt
    particle.mesh.rotation.y += particle.spin.y * dt
    particle.mesh.rotation.z += particle.spin.z * dt
    const fade = Math.min(1, particle.life / 0.3)
    particle.mesh.scale.multiplyScalar(0.995 + fade * 0.004)
  }
}

const sound = new Sound()
let selectedIndex = 0
let selectedType = HOTBAR[0]
let started = false
let paused = false
let muted = false
let toastTimer = 0
let swingTime = 1
let mineHeld = false
let mineCooldown = 0
let lookPointer = null
let lookX = 0
let lookY = 0
let underwater = false
let lastGrounded = false

const keys = new Set()
const joystickInput = { forward: 0, right: 0, active: false }
const touchInput = { jump: false }

function selectSlot(index, announce = true) {
  selectedIndex = ((index % HOTBAR.length) + HOTBAR.length) % HOTBAR.length
  selectedType = HOTBAR[selectedIndex]
  slotElements.forEach((element, i) => element.classList.toggle('selected', i === selectedIndex))
  for (let face = 0; face < 6; face += 1) {
    const tile = tileForFace(selectedType, face)
    const col = tile % 8
    const row = Math.floor(tile / 8)
    const texture = heldMaterials[face].map
    texture.offset.set(col / 8, 1 - (row + 1) / 8)
    texture.needsUpdate = true
  }
  if (announce) {
    showToast(BLOCKS[selectedType].name)
    sound.select()
  }
}

function showToast(text) {
  toastLabel.textContent = text
  toastLabel.classList.add('show')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => toastLabel.classList.remove('show'), 1200)
}

function swing() {
  swingTime = 0
}

function targetBlock() {
  if (!player) return null
  return world.raycast(player.eyePosition(), player.forwardVector(), 6)
}

function mineBlock() {
  if (!started || paused) return
  const hit = targetBlock()
  if (!hit) return
  const type = world.getBlock(hit.x, hit.y, hit.z)
  const def = BLOCKS[type]
  if (!def || type === BLOCK.AIR || type === BLOCK.WATER) return
  if (hit.y <= 0) return
  world.setBlock(hit.x, hit.y, hit.z, BLOCK.AIR)
  const above = world.getBlock(hit.x, hit.y + 1, hit.z)
  if (BLOCKS[above] && BLOCKS[above].plant) world.setBlock(hit.x, hit.y + 1, hit.z, BLOCK.AIR)
  burstParticles(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, def.color)
  sound.breakBlock()
  swing()
  mineCooldown = 0.26
}

function placeBlock() {
  if (!started || paused) return
  const hit = targetBlock()
  if (!hit) return
  const x = hit.x + hit.normal[0]
  const y = hit.y + hit.normal[1]
  const z = hit.z + hit.normal[2]
  if (x < 0 || z < 0 || x >= WORLD_SIZE || z >= WORLD_SIZE || y < 1 || y >= 47) return
  const existing = world.getBlock(x, y, z)
  const existingDef = BLOCKS[existing]
  if (existing !== BLOCK.AIR && !(existingDef && (existingDef.plant || existingDef.water))) return
  if (player.intersectsBlock(x, y, z)) return
  world.setBlock(x, y, z, selectedType)
  sound.placeBlock()
  swing()
}

function updateHighlight() {
  const hit = targetBlock()
  if (hit) {
    highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5)
    highlight.visible = true
  } else {
    highlight.visible = false
  }
}

function setPaused(value) {
  if (!started) return
  paused = value
  pauseOverlay.classList.toggle('hidden', !paused)
  if (paused) {
    mineHeld = false
    joystickInput.forward = 0
    joystickInput.right = 0
    joystickInput.active = false
    knob.style.transform = 'translate(0px, 0px)'
    keys.clear()
    if (document.pointerLockElement) document.exitPointerLock()
  }
  heldGroup.visible = started && !paused
  if (value) {
    canvas.blur()
  } else {
    sound.init()
  }
}

function startGame() {
  if (!player || started) return
  started = true
  paused = false
  sound.init()
  document.body.classList.add('playing')
  heldGroup.visible = true
  player.updateCamera(0)
  setTimeout(() => canvas.focus(), 60)
}

function setMuted(value) {
  muted = value
  sound.setMuted(value)
  soundButton.classList.toggle('muted', value)
  soundButton.setAttribute('aria-pressed', value ? 'true' : 'false')
  soundButton.setAttribute('aria-label', value ? 'Unmute sound' : 'Mute sound')
  pauseSoundButton.textContent = value ? 'Sound: off' : 'Sound: on'
}

playButton.addEventListener('click', startGame)
pauseButton.addEventListener('click', () => setPaused(true))
resumeButton.addEventListener('click', () => setPaused(false))
soundButton.addEventListener('click', () => setMuted(!muted))
pauseSoundButton.addEventListener('click', () => setMuted(!muted))
fullscreenButton.addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.()
    else await document.exitFullscreen?.()
  } catch (error) {
    console.warn(error)
  }
})
resetButton.addEventListener('click', () => {
  sessionStorage.setItem('blockcraft-seed', String(1000 + Math.floor(Math.random() * 999999)))
  window.location.reload()
})

window.addEventListener('keydown', (event) => {
  if (!started) return
  if (event.code === 'Escape') {
    event.preventDefault()
    setPaused(!paused)
    return
  }
  if (paused) return
  if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault()
  if (/^Digit[1-9]$/.test(event.code)) {
    selectSlot(Number(event.code.slice(5)) - 1)
  }
  keys.add(event.code)
  if (event.code === 'KeyM') setMuted(!muted)
})

window.addEventListener('keyup', (event) => {
  keys.delete(event.code)
})

window.addEventListener('blur', () => keys.clear())

document.addEventListener('mousemove', (event) => {
  if (!started || paused || isTouch) return
  if (document.pointerLockElement === canvas) player.look(event.movementX, event.movementY)
})

canvas.addEventListener('mousedown', (event) => {
  if (!started || paused || isTouch) return
  if (document.pointerLockElement !== canvas) {
    canvas.requestPointerLock?.()
    return
  }
  if (event.button === 0) mineBlock()
  else if (event.button === 2) placeBlock()
})

canvas.addEventListener('contextmenu', (event) => event.preventDefault())

canvas.addEventListener('pointerdown', (event) => {
  if (!started || paused || !isTouch || event.pointerType === 'mouse') return
  if (lookPointer !== null) return
  lookPointer = event.pointerId
  lookX = event.clientX
  lookY = event.clientY
  canvas.setPointerCapture(event.pointerId)
})

canvas.addEventListener('pointermove', (event) => {
  if (event.pointerId !== lookPointer) return
  const dx = event.clientX - lookX
  const dy = event.clientY - lookY
  lookX = event.clientX
  lookY = event.clientY
  player.look(dx, dy, 0.0034)
})

function releaseLook(event) {
  if (event.pointerId !== lookPointer) return
  lookPointer = null
}

canvas.addEventListener('pointerup', releaseLook)
canvas.addEventListener('pointercancel', releaseLook)

let joystickPointer = null
let joystickCenter = { x: 0, y: 0 }
let joystickRadius = 40

function updateJoystick(event) {
  let dx = event.clientX - joystickCenter.x
  let dy = event.clientY - joystickCenter.y
  const distance = Math.hypot(dx, dy)
  if (distance > joystickRadius) {
    dx = (dx / distance) * joystickRadius
    dy = (dy / distance) * joystickRadius
  }
  knob.style.transform = `translate(${dx}px, ${dy}px)`
  const magnitude = Math.hypot(dx, dy) / joystickRadius
  if (magnitude < 0.14) {
    joystickInput.forward = 0
    joystickInput.right = 0
  } else {
    joystickInput.forward = -dy / joystickRadius
    joystickInput.right = dx / joystickRadius
  }
  joystickInput.active = magnitude >= 0.14
}

joystick.addEventListener('pointerdown', (event) => {
  if (!started || paused) return
  event.preventDefault()
  joystickPointer = event.pointerId
  const rect = joystick.getBoundingClientRect()
  joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  joystickRadius = rect.width * 0.33
  joystick.setPointerCapture(event.pointerId)
  updateJoystick(event)
})

joystick.addEventListener('pointermove', (event) => {
  if (event.pointerId !== joystickPointer) return
  updateJoystick(event)
})

function releaseJoystick(event) {
  if (event.pointerId !== joystickPointer) return
  joystickPointer = null
  joystickInput.forward = 0
  joystickInput.right = 0
  joystickInput.active = false
  knob.style.transform = 'translate(0px, 0px)'
}

joystick.addEventListener('pointerup', releaseJoystick)
joystick.addEventListener('pointercancel', releaseJoystick)

function bindHold(button, onDown, onUp) {
  button.addEventListener('pointerdown', (event) => {
    if (!started || paused) return
    event.preventDefault()
    button.setPointerCapture(event.pointerId)
    button.classList.add('held')
    onDown()
  })
  const finish = (event) => {
    if (event) event.preventDefault()
    button.classList.remove('held')
    onUp()
  }
  button.addEventListener('pointerup', finish)
  button.addEventListener('pointercancel', finish)
  button.addEventListener('lostpointercapture', () => {
    button.classList.remove('held')
    onUp()
  })
}

bindHold(
  jumpButton,
  () => {
    touchInput.jump = true
  },
  () => {
    touchInput.jump = false
  }
)

bindHold(
  mineButton,
  () => {
    mineHeld = true
    mineCooldown = 0
    mineBlock()
  },
  () => {
    mineHeld = false
  }
)

bindHold(
  placeButton,
  () => placeBlock(),
  () => {}
)

window.addEventListener(
  'wheel',
  (event) => {
    if (!started || paused) return
    event.preventDefault()
    selectSlot(selectedIndex + (event.deltaY > 0 ? 1 : -1))
  },
  { passive: false }
)

function gatherInput() {
  const forwardKeys = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0)
  const rightKeys = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)
  return {
    forward: Math.max(-1, Math.min(1, forwardKeys + joystickInput.forward)),
    right: Math.max(-1, Math.min(1, rightKeys + joystickInput.right)),
    jump: keys.has('Space') || touchInput.jump,
    sprint: keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(joystickInput.forward, joystickInput.right) > 0.92,
    onJump: () => sound.jump()
  }
}

function updateUnderwater() {
  const under = player.isUnderwater()
  if (under === underwater) return
  underwater = under
  underwaterElement.classList.toggle('active', under)
  if (under) {
    scene.fog.color.setHex(0x1c5f92)
    scene.fog.near = 1.5
    scene.fog.far = 30
  } else {
    scene.fog.color.setHex(0xc8e3f4)
    scene.fog.near = 56
    scene.fog.far = 148
  }
}

function updateHeldItem(dt) {
  if (!heldGroup.visible) return
  if (swingTime < 0.3) {
    swingTime = Math.min(0.3, swingTime + dt)
    const phase = Math.sin((swingTime / 0.3) * Math.PI)
    heldGroup.position.set(0.5, -0.46 - phase * 0.07, -0.9)
    heldGroup.rotation.set(0.2 - phase * 0.85, -0.62 + phase * 0.12, 0.1 + phase * 0.25)
  } else {
    const bob = Math.sin(player.bobPhase * 2) * 0.007 * player.bobAmount
    heldGroup.position.set(0.5, -0.46 + bob, -0.9)
    heldGroup.rotation.set(0.2, -0.62, 0.1)
  }
}

let lastTime = performance.now()
let hudTimer = 0
const startTime = performance.now()
const cinematicBaseYaw = spawn ? spawn.yaw : 0

function animate(now) {
  requestAnimationFrame(animate)
  const dt = Math.min((now - lastTime) / 1000, 0.05)
  lastTime = now
  const elapsed = (now - startTime) / 1000

  if (!started) {
    const angle = cinematicBaseYaw + Math.sin(elapsed * 0.13) * 0.55 + 0.35
    const radius = 19
    if (spawn) {
      camera.position.set(
        spawn.x + Math.sin(angle) * radius,
        spawn.y + 11.5 + Math.sin(elapsed * 0.35) * 0.7,
        spawn.z + Math.cos(angle) * radius
      )
      camera.lookAt(spawn.x, spawn.y + 4.2, spawn.z)
    }
  } else if (!paused && player) {
    player.update(dt, gatherInput())
    updateHighlight()
    updateUnderwater()
    updateHeldItem(dt)
    if (player.onGround && !lastGrounded) sound.land()
    lastGrounded = player.onGround
    const horizontalSpeed = Math.hypot(player.velocity.x, player.velocity.z)
    if (player.onGround) sound.step(dt, horizontalSpeed)
    if (mineHeld) {
      mineCooldown -= dt
      if (mineCooldown <= 0) mineBlock()
    }
  } else {
    updateHeldItem(dt)
  }

  if (started && !paused) {
    hudTimer += dt
    if (hudTimer > 0.2) {
      hudTimer = 0
      coordsLabel.textContent = `${Math.floor(player.position.x)}, ${Math.floor(player.position.y)}, ${Math.floor(player.position.z)}`
    }
  }

  for (const cloud of clouds) {
    cloud.position.x += 0.9 * dt
    if (cloud.position.x > WORLD_SIZE / 2 + 260) cloud.position.x -= 520
  }

  waterTime.value += dt
  sky.position.copy(camera.position)
  sunSprite.position.copy(camera.position).addScaledVector(sunDirection, 300)
  ocean.position.y = SEA_LEVEL + 0.8

  updateParticles(dt)
  renderer.render(scene, camera)
}

seedLabel.textContent = `Seed ${seed}`
selectSlot(0, false)
window.__blockcraft = { scene, camera, player, world, heldGroup, renderer, get started() { return started }, get paused() { return paused } }
animate(performance.now())

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.75 : 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
})

document.addEventListener('visibilitychange', () => {
  if (document.hidden && started && !paused) setPaused(true)
})
