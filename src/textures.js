import * as THREE from 'three'

export const TILE_SIZE = 16
export const ATLAS_COLS = 8
export const ATLAS_ROWS = 8
export const ATLAS_SIZE = TILE_SIZE * ATLAS_COLS

export const TILE = {
  grassTop: 0,
  grassSide: 1,
  dirt: 2,
  stone: 3,
  sand: 4,
  logSide: 5,
  logTop: 6,
  leaves: 7,
  planks: 8,
  cobble: 9,
  brick: 10,
  snow: 11,
  tallGrass: 12,
  flowerRed: 13,
  flowerYellow: 14,
  gravel: 15,
  sandstone: 16,
  water: 17,
  snowSide: 18,
  stoneDark: 19
}

export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  LOG: 5,
  LEAVES: 6,
  WATER: 7,
  PLANKS: 8,
  COBBLE: 9,
  BRICK: 10,
  SNOW: 11,
  TALL_GRASS: 12,
  FLOWER_RED: 13,
  FLOWER_YELLOW: 14,
  GRAVEL: 15,
  SANDSTONE: 16
}

export const BLOCKS = {
  [BLOCK.GRASS]: { name: 'Grass', top: TILE.grassTop, bottom: TILE.dirt, side: TILE.grassSide, color: 0x6da942, solid: true },
  [BLOCK.DIRT]: { name: 'Dirt', top: TILE.dirt, bottom: TILE.dirt, side: TILE.dirt, color: 0x8a5a3b, solid: true },
  [BLOCK.STONE]: { name: 'Stone', top: TILE.stone, bottom: TILE.stone, side: TILE.stone, color: 0x8d9299, solid: true },
  [BLOCK.SAND]: { name: 'Sand', top: TILE.sand, bottom: TILE.sand, side: TILE.sand, color: 0xe2d39b, solid: true },
  [BLOCK.LOG]: { name: 'Oak Log', top: TILE.logTop, bottom: TILE.logTop, side: TILE.logSide, color: 0x6b4a2c, solid: true },
  [BLOCK.LEAVES]: { name: 'Leaves', top: TILE.leaves, bottom: TILE.leaves, side: TILE.leaves, color: 0x4c8a33, solid: true, alpha: true },
  [BLOCK.WATER]: { name: 'Water', top: TILE.water, bottom: TILE.water, side: TILE.water, color: 0x2f7fbd, solid: false, water: true },
  [BLOCK.PLANKS]: { name: 'Planks', top: TILE.planks, bottom: TILE.planks, side: TILE.planks, color: 0xb7884c, solid: true },
  [BLOCK.COBBLE]: { name: 'Cobblestone', top: TILE.cobble, bottom: TILE.cobble, side: TILE.cobble, color: 0x8a8d8f, solid: true },
  [BLOCK.BRICK]: { name: 'Bricks', top: TILE.brick, bottom: TILE.brick, side: TILE.brick, color: 0xa64e3b, solid: true },
  [BLOCK.SNOW]: { name: 'Snow', top: TILE.snow, bottom: TILE.dirt, side: TILE.snowSide, color: 0xedf4fb, solid: true },
  [BLOCK.TALL_GRASS]: { name: 'Tall Grass', top: TILE.tallGrass, bottom: TILE.tallGrass, side: TILE.tallGrass, color: 0x5e9b3a, solid: false, plant: true, alpha: true },
  [BLOCK.FLOWER_RED]: { name: 'Poppy', top: TILE.flowerRed, bottom: TILE.flowerRed, side: TILE.flowerRed, color: 0xc8433b, solid: false, plant: true, alpha: true },
  [BLOCK.FLOWER_YELLOW]: { name: 'Dandelion', top: TILE.flowerYellow, bottom: TILE.flowerYellow, side: TILE.flowerYellow, color: 0xe0b52e, solid: false, plant: true, alpha: true },
  [BLOCK.GRAVEL]: { name: 'Gravel', top: TILE.gravel, bottom: TILE.gravel, side: TILE.gravel, color: 0x8a8178, solid: true },
  [BLOCK.SANDSTONE]: { name: 'Sandstone', top: TILE.sandstone, bottom: TILE.sandstone, side: TILE.sandstone, color: 0xd8c489, solid: true }
}

export const HOTBAR = [
  BLOCK.GRASS,
  BLOCK.DIRT,
  BLOCK.STONE,
  BLOCK.SAND,
  BLOCK.LOG,
  BLOCK.LEAVES,
  BLOCK.PLANKS,
  BLOCK.COBBLE,
  BLOCK.BRICK
]

const FACE_SIDES = [0, 0, 1, 2, 0, 0]

export function tileForFace(type, face) {
  const def = BLOCKS[type]
  if (!def) return TILE.stone
  const side = FACE_SIDES[face]
  if (side === 1) return def.top
  if (side === 2) return def.bottom
  return def.side
}

function makeRng(seed) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function colorShift(hex, amount) {
  const r = Math.max(0, Math.min(255, ((hex >> 16) & 255) + amount))
  const g = Math.max(0, Math.min(255, ((hex >> 8) & 255) + amount))
  const b = Math.max(0, Math.min(255, (hex & 255) + amount))
  return `rgb(${r},${g},${b})`
}

function mixHex(a, b, t) {
  const ar = (a >> 16) & 255
  const ag = (a >> 8) & 255
  const ab = a & 255
  const br = (b >> 16) & 255
  const bg = (b >> 8) & 255
  const bb = b & 255
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`
}

function tileOrigin(index) {
  return { x: (index % ATLAS_COLS) * TILE_SIZE, y: Math.floor(index / ATLAS_COLS) * TILE_SIZE }
}

function speckle(ctx, ox, oy, base, palette, rng, density = 0.55) {
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      if (rng() > density) continue
      ctx.fillStyle = colorShift(base, palette[Math.floor(rng() * palette.length)])
      ctx.fillRect(ox + x, oy + y, 1, 1)
    }
  }
}

function drawGrassTop(ctx, ox, oy, rng) {
  ctx.fillStyle = '#5c9638'
  ctx.fillRect(ox, oy, 16, 16)
  const greens = ['#4d8630', '#68a943', '#74b34b', '#568d33', '#7cbb52']
  speckle(ctx, ox, oy, 0x5c9638, [10, -8, 18, -16, 6], rng, 0.8)
  for (let i = 0; i < 14; i += 1) {
    const x = Math.floor(rng() * 16)
    const y = Math.floor(rng() * 16)
    ctx.fillStyle = greens[Math.floor(rng() * greens.length)]
    ctx.fillRect(ox + x, oy + y, 1, 1 + Math.floor(rng() * 2))
  }
  ctx.fillStyle = 'rgba(32,70,22,0.25)'
  ctx.fillRect(ox, oy, 16, 1)
  ctx.fillRect(ox, oy, 1, 16)
}

function drawDirt(ctx, ox, oy, rng) {
  ctx.fillStyle = '#8a5b3c'
  ctx.fillRect(ox, oy, 16, 16)
  const shades = [-18, -10, 12, 20, -4, 6]
  speckle(ctx, ox, oy, 0x8a5b3c, shades, rng, 0.72)
  for (let i = 0; i < 9; i += 1) {
    const x = Math.floor(rng() * 15)
    const y = Math.floor(rng() * 15)
    ctx.fillStyle = rng() > 0.5 ? 'rgba(74,44,26,0.55)' : 'rgba(168,116,82,0.45)'
    ctx.fillRect(ox + x, oy + y, 1 + Math.floor(rng() * 2), 1)
  }
}

function drawGrassSide(ctx, ox, oy, rng) {
  drawDirt(ctx, ox, oy, rng)
  for (let x = 0; x < 16; x += 1) {
    const depth = 3 + Math.floor(rng() * 3)
    for (let y = 0; y < depth; y += 1) {
      ctx.fillStyle = mixHex(0x4b8230, 0x74b34b, rng())
      ctx.fillRect(ox + x, oy + y, 1, 1)
    }
    if (rng() > 0.45) {
      ctx.fillStyle = 'rgba(67,112,41,0.9)'
      ctx.fillRect(ox + x, oy + depth, 1, 1 + Math.floor(rng() * 3))
    }
  }
}

function drawStone(ctx, ox, oy, rng) {
  ctx.fillStyle = '#8d9299'
  ctx.fillRect(ox, oy, 16, 16)
  speckle(ctx, ox, oy, 0x8d9299, [-16, -8, 9, 16, -3], rng, 0.72)
  ctx.fillStyle = 'rgba(94,99,105,0.75)'
  ctx.fillRect(ox + 3, oy + 5, 4, 1)
  ctx.fillRect(ox + 9, oy + 11, 4, 1)
  ctx.fillRect(ox + 11, oy + 4, 1, 3)
  ctx.fillStyle = 'rgba(175,180,186,0.55)'
  ctx.fillRect(ox + 5, oy + 9, 3, 1)
  ctx.fillRect(ox + 2, oy + 13, 2, 1)
}

function drawSand(ctx, ox, oy, rng) {
  ctx.fillStyle = '#e0d39c'
  ctx.fillRect(ox, oy, 16, 16)
  speckle(ctx, ox, oy, 0xe0d39c, [-12, -6, 8, 14, 3], rng, 0.65)
  for (let i = 0; i < 12; i += 1) {
    ctx.fillStyle = rng() > 0.5 ? 'rgba(182,162,111,0.55)' : 'rgba(247,238,193,0.65)'
    ctx.fillRect(ox + Math.floor(rng() * 16), oy + Math.floor(rng() * 16), 1, 1)
  }
}

function drawLogSide(ctx, ox, oy, rng) {
  ctx.fillStyle = '#6b4a2c'
  ctx.fillRect(ox, oy, 16, 16)
  for (let x = 0; x < 16; x += 1) {
    const dark = rng() > 0.5
    ctx.fillStyle = dark ? mixHex(0x593a21, 0x4c311b, rng()) : mixHex(0x7b5836, 0x8a6540, rng())
    ctx.fillRect(ox + x, oy, 1, 16)
    if (rng() > 0.72) {
      ctx.fillStyle = 'rgba(46,29,16,0.65)'
      const y0 = Math.floor(rng() * 12)
      ctx.fillRect(ox + x, oy + y0, 1, 3 + Math.floor(rng() * 4))
    }
  }
  ctx.fillStyle = 'rgba(40,25,13,0.55)'
  ctx.fillRect(ox, oy, 1, 16)
  ctx.fillRect(ox + 15, oy, 1, 16)
}

function drawLogTop(ctx, ox, oy, rng) {
  ctx.fillStyle = '#b18a52'
  ctx.fillRect(ox, oy, 16, 16)
  const cx = 7.5
  const cy = 7.5
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      const ring = Math.floor(d) % 3
      if (ring === 1) {
        ctx.fillStyle = rng() > 0.5 ? '#8f6a3d' : '#9b7546'
        ctx.fillRect(ox + x, oy + y, 1, 1)
      }
    }
  }
  ctx.strokeStyle = '#6b4a2c'
  ctx.lineWidth = 1
  ctx.strokeRect(ox + 0.5, oy + 0.5, 15, 15)
  ctx.fillStyle = '#6b4a2c'
  ctx.fillRect(ox + 7, oy + 7, 2, 2)
}

function drawLeaves(ctx, ox, oy, rng) {
  ctx.clearRect(ox, oy, 16, 16)
  const palette = ['#3c772b', '#4c8c34', '#5a9b3c', '#2f6622', '#63a845']
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      if (rng() < 0.17) continue
      ctx.fillStyle = palette[Math.floor(rng() * palette.length)]
      ctx.fillRect(ox + x, oy + y, 1, 1)
    }
  }
  for (let i = 0; i < 7; i += 1) {
    ctx.fillStyle = 'rgba(24,55,16,0.45)'
    ctx.fillRect(ox + Math.floor(rng() * 16), oy + Math.floor(rng() * 16), 1, 1)
  }
}

function drawPlanks(ctx, ox, oy, rng) {
  ctx.fillStyle = '#b6884d'
  ctx.fillRect(ox, oy, 16, 16)
  for (let row = 0; row < 4; row += 1) {
    const y = row * 4
    ctx.fillStyle = mixHex(0xb6884d, 0xc39a60, rng() * 0.5)
    ctx.fillRect(ox, oy + y, 16, 3)
    ctx.fillStyle = '#815c32'
    ctx.fillRect(ox, oy + y + 3, 16, 1)
    const seam = (row % 2 === 0 ? 5 : 11) + Math.floor(rng() * 2)
    ctx.fillStyle = 'rgba(112,79,42,0.8)'
    ctx.fillRect(ox + seam, oy + y, 1, 3)
  }
  for (let i = 0; i < 8; i += 1) {
    ctx.fillStyle = 'rgba(126,91,50,0.35)'
    ctx.fillRect(ox + Math.floor(rng() * 16), oy + Math.floor(rng() * 16), 1, 1)
  }
}

function drawCobble(ctx, ox, oy, rng) {
  ctx.fillStyle = '#6e7276'
  ctx.fillRect(ox, oy, 16, 16)
  const stones = [
    [1, 1, 6, 5], [8, 1, 7, 4], [1, 7, 4, 4], [6, 6, 4, 5], [11, 6, 4, 4],
    [1, 12, 7, 3], [9, 11, 6, 4]
  ]
  for (const [x, y, w, h] of stones) {
    ctx.fillStyle = mixHex(0x8f9498, 0xb4b8ba, rng())
    ctx.fillRect(ox + x, oy + y, w, h)
    ctx.fillStyle = 'rgba(190,194,196,0.35)'
    ctx.fillRect(ox + x, oy + y, w, 1)
    ctx.fillStyle = 'rgba(66,69,72,0.45)'
    ctx.fillRect(ox + x, oy + y + h - 1, w, 1)
  }
}

function drawBrick(ctx, ox, oy, rng) {
  ctx.fillStyle = '#c7bcae'
  ctx.fillRect(ox, oy, 16, 16)
  const brickColors = [0xa74d39, 0xb25843, 0x984532, 0xbb6049]
  for (let row = 0; row < 4; row += 1) {
    const offset = row % 2 === 0 ? 0 : 4
    for (let col = -1; col < 3; col += 1) {
      const x = col * 8 + offset
      const w = 7
      const y = row * 4
      ctx.fillStyle = mixHex(brickColors[Math.floor(rng() * brickColors.length)], 0xc06a52, rng() * 0.25)
      ctx.fillRect(ox + x, oy + y, w, 3)
      ctx.fillStyle = 'rgba(79,35,26,0.45)'
      ctx.fillRect(ox + x, oy + y + 2, w, 1)
    }
  }
}

function drawSnow(ctx, ox, oy, rng) {
  ctx.fillStyle = '#eef5fc'
  ctx.fillRect(ox, oy, 16, 16)
  speckle(ctx, ox, oy, 0xeef5fc, [-8, -4, 3, 8, 12], rng, 0.45)
}

function drawSnowSide(ctx, ox, oy, rng) {
  drawStone(ctx, ox, oy, rng)
  for (let x = 0; x < 16; x += 1) {
    const depth = 3 + Math.floor(rng() * 2)
    for (let y = 0; y < depth; y += 1) {
      ctx.fillStyle = mixHex(0xe9f1fa, 0xffffff, rng())
      ctx.fillRect(ox + x, oy + y, 1, 1)
    }
  }
}

function drawTallGrass(ctx, ox, oy, rng) {
  ctx.clearRect(ox, oy, 16, 16)
  const greens = ['#3f7d29', '#529235', '#65a744', '#356d23']
  for (let i = 0; i < 7; i += 1) {
    const x = 2 + Math.floor(rng() * 12)
    const height = 5 + Math.floor(rng() * 8)
    const lean = rng() > 0.5 ? 1 : -1
    ctx.fillStyle = greens[Math.floor(rng() * greens.length)]
    for (let y = 0; y < height; y += 1) {
      ctx.fillRect(ox + x + Math.floor(y / 4) * lean, oy + 15 - y, 1, 1)
    }
  }
}

function drawFlower(ctx, ox, oy, rng, petal, center) {
  ctx.clearRect(ox, oy, 16, 16)
  ctx.fillStyle = '#3f7d29'
  ctx.fillRect(ox + 7, oy + 8, 2, 8)
  ctx.fillRect(ox + 5, oy + 11, 2, 1)
  ctx.fillRect(ox + 9, oy + 13, 2, 1)
  ctx.fillStyle = petal
  for (const [x, y] of [[6, 4], [9, 4], [7, 2], [7, 6], [5, 5], [10, 5]]) {
    ctx.fillRect(ox + x, oy + y, 2, 2)
  }
  ctx.fillStyle = center
  ctx.fillRect(ox + 7, oy + 4, 2, 2)
}

function drawGravel(ctx, ox, oy, rng) {
  ctx.fillStyle = '#857c72'
  ctx.fillRect(ox, oy, 16, 16)
  const colors = ['#6b6259', '#9a9186', '#776e64', '#a9a095', '#5e5650']
  for (let i = 0; i < 34; i += 1) {
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)]
    const w = 1 + Math.floor(rng() * 3)
    const h = 1 + Math.floor(rng() * 2)
    ctx.fillRect(ox + Math.floor(rng() * (16 - w)), oy + Math.floor(rng() * (16 - h)), w, h)
  }
}

function drawSandstone(ctx, ox, oy, rng) {
  ctx.fillStyle = '#d9c78e'
  ctx.fillRect(ox, oy, 16, 16)
  for (let y = 0; y < 16; y += 5) {
    ctx.fillStyle = 'rgba(170,148,95,0.4)'
    ctx.fillRect(ox, oy + y, 16, 1)
  }
  speckle(ctx, ox, oy, 0xd9c78e, [-8, -3, 6, 10], rng, 0.4)
}

function drawWater(ctx, ox, oy, rng) {
  ctx.fillStyle = '#2e79b5'
  ctx.fillRect(ox, oy, 16, 16)
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      if (rng() < 0.35) {
        ctx.fillStyle = rng() > 0.5 ? 'rgba(72,145,200,0.5)' : 'rgba(24,88,143,0.45)'
        ctx.fillRect(ox + x, oy + y, 1, 1)
      }
    }
  }
  ctx.fillStyle = 'rgba(157,207,236,0.7)'
  ctx.fillRect(ox + 2, oy + 5, 5, 1)
  ctx.fillRect(ox + 9, oy + 11, 4, 1)
  ctx.fillRect(ox + 11, oy + 3, 3, 1)
}

function drawTile(ctx, index, rng) {
  const { x, y } = tileOrigin(index)
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, TILE_SIZE, TILE_SIZE)
  ctx.clip()
  switch (index) {
    case TILE.grassTop: drawGrassTop(ctx, x, y, rng); break
    case TILE.grassSide: drawGrassSide(ctx, x, y, rng); break
    case TILE.dirt: drawDirt(ctx, x, y, rng); break
    case TILE.stone: drawStone(ctx, x, y, rng); break
    case TILE.sand: drawSand(ctx, x, y, rng); break
    case TILE.logSide: drawLogSide(ctx, x, y, rng); break
    case TILE.logTop: drawLogTop(ctx, x, y, rng); break
    case TILE.leaves: drawLeaves(ctx, x, y, rng); break
    case TILE.planks: drawPlanks(ctx, x, y, rng); break
    case TILE.cobble: drawCobble(ctx, x, y, rng); break
    case TILE.brick: drawBrick(ctx, x, y, rng); break
    case TILE.snow: drawSnow(ctx, x, y, rng); break
    case TILE.tallGrass: drawTallGrass(ctx, x, y, rng); break
    case TILE.flowerRed: drawFlower(ctx, x, y, rng, '#c93f3a', '#f0c93d'); break
    case TILE.flowerYellow: drawFlower(ctx, x, y, rng, '#e6b92f', '#8c5a1f'); break
    case TILE.gravel: drawGravel(ctx, x, y, rng); break
    case TILE.sandstone: drawSandstone(ctx, x, y, rng); break
    case TILE.water: drawWater(ctx, x, y, rng); break
    case TILE.snowSide: drawSnowSide(ctx, x, y, rng); break
    case TILE.stoneDark: drawStone(ctx, x, y, rng); break
    default: break
  }
  ctx.restore()
}

let atlasCache = null

export function createAtlas() {
  if (atlasCache) return atlasCache
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS_SIZE
  canvas.height = ATLAS_SIZE
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  for (let i = 0; i < ATLAS_COLS * ATLAS_ROWS; i += 1) {
    drawTile(ctx, i, makeRng(1337 + i * 7919))
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  atlasCache = { texture, canvas }
  return atlasCache
}

export function tileUV(index, inset = 0.02) {
  const col = index % ATLAS_COLS
  const row = Math.floor(index / ATLAS_COLS)
  const u0 = (col * TILE_SIZE + inset) / ATLAS_SIZE
  const u1 = ((col + 1) * TILE_SIZE - inset) / ATLAS_SIZE
  const vTop = 1 - (row * TILE_SIZE + inset) / ATLAS_SIZE
  const vBottom = 1 - ((row + 1) * TILE_SIZE - inset) / ATLAS_SIZE
  return { u0, u1, vTop, vBottom }
}

export function createBlockIcon(type, size = 52) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  const def = BLOCKS[type]
  if (!def) return canvas
  const atlas = createAtlas().canvas
  const pad = Math.round(size * 0.1)
  const topY = Math.round(size * 0.14)
  const cubic = size - pad * 2
  const half = cubic / 2
  const height = Math.round(cubic * 0.28)
  const sideHeight = size - pad - topY - height
  const cx = size / 2
  const drawFace = (tile, quad, darken) => {
    const sx = (tile % ATLAS_COLS) * TILE_SIZE
    const sy = Math.floor(tile / ATLAS_COLS) * TILE_SIZE
    const [a, b, c, d] = quad
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(a[0], a[1])
    ctx.lineTo(b[0], b[1])
    ctx.lineTo(c[0], c[1])
    ctx.lineTo(d[0], d[1])
    ctx.closePath()
    ctx.clip()
    const ux = (b[0] - a[0]) / TILE_SIZE
    const uy = (b[1] - a[1]) / TILE_SIZE
    const vx = (d[0] - a[0]) / TILE_SIZE
    const vy = (d[1] - a[1]) / TILE_SIZE
    ctx.setTransform(ux, uy, vx, vy, a[0], a[1])
    ctx.drawImage(atlas, sx, sy, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE)
    ctx.restore()
    if (darken > 0) {
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(a[0], a[1])
      ctx.lineTo(b[0], b[1])
      ctx.lineTo(c[0], c[1])
      ctx.lineTo(d[0], d[1])
      ctx.closePath()
      ctx.fillStyle = `rgba(8,20,10,${darken})`
      ctx.fill()
      ctx.restore()
    }
  }
  const top = [[cx, topY], [cx + half, topY + height / 2], [cx, topY + height], [cx - half, topY + height / 2]]
  const left = [[cx - half, topY + height / 2], [cx, topY + height], [cx, topY + height + sideHeight], [cx - half, topY + height / 2 + sideHeight]]
  const right = [[cx + half, topY + height / 2], [cx, topY + height], [cx, topY + height + sideHeight], [cx + half, topY + height / 2 + sideHeight]]
  drawFace(def.top, top, 0)
  drawFace(def.side, right, 0.18)
  drawFace(def.side, left, 0.38)
  return canvas
}

export function createIconURL(type, size) {
  return createBlockIcon(type, size).toDataURL()
}
