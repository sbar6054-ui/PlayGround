import * as THREE from 'three'
import { BLOCK, BLOCKS, TILE, tileForFace, tileUV } from './textures.js'

export const CHUNK = 16
export const WORLD_CHUNKS = 10
export const WORLD_SIZE = CHUNK * WORLD_CHUNKS
export const WORLD_HEIGHT = 48
export const SEA_LEVEL = 10

const FACES = [
  { dir: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.82, tangents: [1, 2] },
  { dir: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.82, tangents: [1, 2] },
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0, tangents: [0, 2] },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.55, tangents: [0, 2] },
  { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.74, tangents: [0, 1] },
  { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.74, tangents: [0, 1] }
]

const AO_LEVELS = [1, 0.82, 0.66, 0.5]

function fade(t) {
  return t * t * (3 - 2 * t)
}

function makeHash(seed) {
  return (x, z) => {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

function makeNoise(hash) {
  return (x, z) => {
    const xi = Math.floor(x)
    const zi = Math.floor(z)
    const xf = x - xi
    const zf = z - zi
    const a = hash(xi, zi)
    const b = hash(xi + 1, zi)
    const c = hash(xi, zi + 1)
    const d = hash(xi + 1, zi + 1)
    const u = fade(xf)
    const v = fade(zf)
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
  }
}

function fbm(noise, x, z, octaves) {
  let value = 0
  let amplitude = 0.5
  let frequency = 1
  let total = 0
  for (let i = 0; i < octaves; i += 1) {
    value += noise(x * frequency, z * frequency) * amplitude
    total += amplitude
    amplitude *= 0.5
    frequency *= 2
  }
  return value / total
}

function smoothstep(edge0, edge1, value) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export class World {
  constructor(scene, solidMaterial, waterMaterial, seed = 90210) {
    this.scene = scene
    this.solidMaterial = solidMaterial
    this.waterMaterial = waterMaterial
    this.seed = seed
    this.hash = makeHash(seed)
    this.noise = makeNoise(this.hash)
    this.data = new Uint8Array(WORLD_SIZE * WORLD_HEIGHT * WORLD_SIZE)
    this.heights = new Int16Array(WORLD_SIZE * WORLD_SIZE)
    this.chunks = new Map()
    this.group = new THREE.Group()
    this.group.name = 'world'
    scene.add(this.group)
    this.decorate = makeHash(seed ^ 0x9e3779b9)
    this.generateTerrain()
    this.plantTrees()
    this.plantGroundCover()
  }

  index(x, y, z) {
    return (y * WORLD_SIZE + z) * WORLD_SIZE + x
  }

  inBounds(x, y, z) {
    return x >= 0 && x < WORLD_SIZE && z >= 0 && z < WORLD_SIZE && y >= 0 && y < WORLD_HEIGHT
  }

  getBlock(x, y, z) {
    if (!this.inBounds(x, y, z)) return BLOCK.AIR
    return this.data[this.index(x, y, z)]
  }

  setRaw(x, y, z, type) {
    if (!this.inBounds(x, y, z)) return
    this.data[this.index(x, y, z)] = type
  }

  heightAt(x, z) {
    if (x < 0 || x >= WORLD_SIZE || z < 0 || z >= WORLD_SIZE) return SEA_LEVEL
    return this.heights[z * WORLD_SIZE + x]
  }

  generateTerrain() {
    const noise = this.noise
    const center = WORLD_SIZE / 2
    for (let z = 0; z < WORLD_SIZE; z += 1) {
      for (let x = 0; x < WORLD_SIZE; x += 1) {
        const continental = fbm(noise, x * 0.013, z * 0.013, 4)
        const detail = fbm(noise, x * 0.07, z * 0.07, 2)
        const mask = smoothstep(0.5, 0.74, fbm(noise, x * 0.005 + 77, z * 0.005 + 33, 3))
        const ridge = 1 - Math.abs(fbm(noise, x * 0.009 + 31, z * 0.009 + 17, 3) * 2 - 1)
        let height = 12 + (continental - 0.5) * 36 + (detail - 0.5) * 5 + mask * Math.pow(Math.max(0, ridge - 0.2), 1.5) * 64

        const spawnDistance = Math.hypot(x - center, z - center)
        if (spawnDistance < 17) {
          const blend = smoothstep(17, 3, spawnDistance)
          height += (18 - height) * blend * 0.82
        }

        const ridgeDistance = Math.hypot((x - (center + 58)) / 1.35, (z - (center - 5)) / 0.82)
        if (ridgeDistance < 45) {
          const blend = smoothstep(44, 11, ridgeDistance)
          const target = 22 + (1 - ridgeDistance / 45) * 8
          height += (target - height) * blend * 0.82
        }

        const lakeDistance = Math.hypot((x - (center + 27)) / 1.15, (z - (center + 3)) / 0.86)
        if (lakeDistance < 20) {
          const blend = smoothstep(19, 8, lakeDistance)
          height += (6.4 - height) * blend
        }

        height = clamp(Math.floor(height), 3, WORLD_HEIGHT - 8)
        this.heights[z * WORLD_SIZE + x] = height

        for (let y = 0; y <= height; y += 1) {
          let type = BLOCK.STONE
          if (height <= SEA_LEVEL + 1) {
            if (y > height - 4) type = BLOCK.SAND
            else if (y > height - 7) type = BLOCK.SANDSTONE
          } else if (height >= 24) {
            if (y === height) type = BLOCK.SNOW
            else if (y > height - 3) type = BLOCK.STONE
          } else if (height >= 21) {
            if (y > height - 2) type = BLOCK.STONE
          } else {
            if (y === height) type = BLOCK.GRASS
            else if (y > height - 4) type = BLOCK.DIRT
          }
          this.setRaw(x, y, z, type)
        }

        if (height < SEA_LEVEL) {
          for (let y = height + 1; y <= SEA_LEVEL; y += 1) this.setRaw(x, y, z, BLOCK.WATER)
        }
      }
    }
  }

  canPlantTree(x, z) {
    const height = this.heightAt(x, z)
    if (height <= SEA_LEVEL + 1 || height > 16) return false
    if (this.getBlock(x, height, z) !== BLOCK.GRASS) return false
    if (distance(x, z, WORLD_SIZE / 2, WORLD_SIZE / 2) < 12) return false
    return true
  }

  plantTrees() {
    for (let z = 4; z < WORLD_SIZE - 4; z += 1) {
      for (let x = 4; x < WORLD_SIZE - 4; x += 1) {
        const roll = this.decorate(x * 3 + 11, z * 7 + 29)
        if (roll < 0.988) continue
        if (!this.canPlantTree(x, z)) continue
        if (!this.flatEnough(x, z, 2)) continue
        this.growTree(x, z)
      }
    }
  }

  flatEnough(x, z, radius) {
    const center = this.heightAt(x, z)
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.abs(this.heightAt(x + dx, z + dz) - center) > 2) return false
      }
    }
    return true
  }

  growTree(x, z) {
    const base = this.heightAt(x, z) + 1
    const roll = this.decorate(x + 91, z - 57)
    const trunk = 4 + Math.floor(roll * 4)
    const top = base + trunk
    if (top + 2 >= WORLD_HEIGHT) return
    for (let y = base; y < top; y += 1) this.setRaw(x, y, z, BLOCK.LOG)
    for (let y = top - 2; y <= top + 1; y += 1) {
      const radius = y >= top ? 1 : 2
      for (let dz = -radius; dz <= radius; dz += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.abs(dx) === radius && Math.abs(dz) === radius) {
            if (this.decorate(x + dx * 13 + z, z + dz * 7 + y) < 0.55) continue
          }
          if (dx === 0 && dz === 0 && y < top) continue
          if (this.getBlock(x + dx, y, z + dz) === BLOCK.AIR) this.setRaw(x + dx, y, z + dz, BLOCK.LEAVES)
        }
      }
    }
    this.setRaw(x, top, z, BLOCK.LEAVES)
  }

  plantGroundCover() {
    for (let z = 1; z < WORLD_SIZE - 1; z += 1) {
      for (let x = 1; x < WORLD_SIZE - 1; x += 1) {
        const height = this.heightAt(x, z)
        if (height < SEA_LEVEL + 1 || height > 21) continue
        if (this.getBlock(x, height, z) !== BLOCK.GRASS) continue
        if (this.getBlock(x, height + 1, z) !== BLOCK.AIR) continue
        if (distance(x, z, WORLD_SIZE / 2, WORLD_SIZE / 2) < 2) continue
        const roll = this.decorate(x * 17 + 5, z * 23 + 13)
        if (roll > 0.985) this.setRaw(x, height + 1, z, BLOCK.FLOWER_RED)
        else if (roll > 0.968) this.setRaw(x, height + 1, z, BLOCK.FLOWER_YELLOW)
        else if (roll > 0.86) this.setRaw(x, height + 1, z, BLOCK.TALL_GRASS)
      }
    }
  }

  isOpaque(x, y, z) {
    const type = this.getBlock(x, y, z)
    if (type === BLOCK.AIR || type === BLOCK.WATER) return false
    const def = BLOCKS[type]
    return Boolean(def && def.solid && !def.plant && !def.alpha)
  }

  isSolidAt(x, y, z) {
    const def = BLOCKS[this.getBlock(x, y, z)]
    return Boolean(def && def.solid)
  }

  isWaterAt(x, y, z) {
    return this.getBlock(x, y, z) === BLOCK.WATER
  }

  isTargetable(x, y, z) {
    const type = this.getBlock(x, y, z)
    return type !== BLOCK.AIR && type !== BLOCK.WATER
  }

  buildAll() {
    for (let cz = 0; cz < WORLD_CHUNKS; cz += 1) {
      for (let cx = 0; cx < WORLD_CHUNKS; cx += 1) this.buildChunk(cx, cz)
    }
  }

  buildChunk(cx, cz) {
    const key = `${cx},${cz}`
    const existing = this.chunks.get(key)
    if (existing) {
      if (existing.water) this.group.remove(existing.water)
      this.group.remove(existing.solid)
      existing.solid.geometry.dispose()
      if (existing.water) existing.water.geometry.dispose()
    }
    const solid = this.buildSolidGeometry(cx, cz)
    const water = this.buildWaterGeometry(cx, cz)
    const solidMesh = new THREE.Mesh(solid, this.solidMaterial)
    solidMesh.frustumCulled = true
    solidMesh.matrixAutoUpdate = false
    solidMesh.updateMatrix()
    let waterMesh = null
    if (water.index && water.index.count > 0) {
      waterMesh = new THREE.Mesh(water, this.waterMaterial)
      waterMesh.frustumCulled = true
      waterMesh.renderOrder = 2
      waterMesh.matrixAutoUpdate = false
      waterMesh.updateMatrix()
      this.group.add(waterMesh)
    } else {
      water.dispose()
    }
    this.group.add(solidMesh)
    this.chunks.set(key, { solid: solidMesh, water: waterMesh })
  }

  buildSolidGeometry(cx, cz) {
    const positions = []
    const normals = []
    const uvs = []
    const colors = []
    const indices = []
    let vertexCount = 0
    const startX = cx * CHUNK
    const startZ = cz * CHUNK

    for (let lz = 0; lz < CHUNK; lz += 1) {
      for (let lx = 0; lx < CHUNK; lx += 1) {
        const x = startX + lx
        const z = startZ + lz
        for (let y = 0; y < WORLD_HEIGHT; y += 1) {
          const type = this.getBlock(x, y, z)
          if (type === BLOCK.AIR || type === BLOCK.WATER) continue
          const def = BLOCKS[type]
          if (!def) continue
          if (def.plant) {
            const uv = tileUV(def.top)
            const variation = 0.92 + this.decorate(x * 7 + y, z * 11 + y) * 0.12
            vertexCount = this.addPlant(positions, normals, uvs, colors, indices, vertexCount, x, y, z, uv, variation)
            continue
          }
          const variation = 0.94 + this.decorate(x * 5 + y * 3, z * 11 + y * 7) * 0.1
          for (let faceIndex = 0; faceIndex < 6; faceIndex += 1) {
            const face = FACES[faceIndex]
            const nx = x + face.dir[0]
            const ny = y + face.dir[1]
            const nz = z + face.dir[2]
            const neighborType = this.getBlock(nx, ny, nz)
            const neighborDef = BLOCKS[neighborType]
            if (neighborDef && neighborDef.solid && !neighborDef.plant && !neighborDef.alpha) continue
            if (type === BLOCK.LEAVES && neighborType === BLOCK.LEAVES) continue
            const tile = tileForFace(type, faceIndex)
            const uv = tileUV(tile)
            const baseIndex = vertexCount
            for (let i = 0; i < 4; i += 1) {
              const corner = face.corners[i]
              positions.push(x + corner[0], y + corner[1], z + corner[2])
              normals.push(face.dir[0], face.dir[1], face.dir[2])
              const u = i === 0 || i === 3 ? uv.u0 : uv.u1
              const v = i < 2 ? uv.vBottom : uv.vTop
              uvs.push(u, v)
              const ao = this.ambientOcclusion(x, y, z, face, corner)
              const light = face.shade * ao * variation
              colors.push(light, light, light)
            }
            indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3)
            vertexCount += 4
          }
        }
      }
    }

    return makeGeometry(positions, normals, uvs, colors, indices)
  }

  ambientOcclusion(x, y, z, face, corner) {
    const nx = x + face.dir[0]
    const ny = y + face.dir[1]
    const nz = z + face.dir[2]
    const t1 = face.tangents[0]
    const t2 = face.tangents[1]
    const s1 = corner[t1] ? 1 : -1
    const s2 = corner[t2] ? 1 : -1
    const offsets = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0]
    ]
    offsets[0][t1] = s1
    offsets[1][t2] = s2
    const side1 = this.isOpaque(nx + offsets[0][0], ny + offsets[0][1], nz + offsets[0][2])
    const side2 = this.isOpaque(nx + offsets[1][0], ny + offsets[1][1], nz + offsets[1][2])
    const cornerBlock = this.isOpaque(
      nx + offsets[0][0] + offsets[1][0],
      ny + offsets[0][1] + offsets[1][1],
      nz + offsets[0][2] + offsets[1][2]
    )
    let level = side1 && side2 ? 3 : Number(side1) + Number(side2) + Number(cornerBlock)
    level = Math.min(3, level)
    return AO_LEVELS[level]
  }

  addPlant(positions, normals, uvs, colors, indices, vertexCount, x, y, z, uv, variation) {
    const quads = [
      [[0.16, 0.02, 0.16], [0.84, 0.02, 0.84], [0.84, 0.96, 0.84], [0.16, 0.96, 0.16]],
      [[0.84, 0.02, 0.16], [0.16, 0.02, 0.84], [0.16, 0.96, 0.84], [0.84, 0.96, 0.16]]
    ]
    const lightness = 0.9 * variation
    for (const quad of quads) {
      const baseIndex = vertexCount
      for (let i = 0; i < 4; i += 1) {
        positions.push(x + quad[i][0], y + quad[i][1], z + quad[i][2])
        normals.push(0, 1, 0)
        const u = i === 0 || i === 3 ? uv.u0 : uv.u1
        const v = i < 2 ? uv.vBottom : uv.vTop
        uvs.push(u, v)
        colors.push(lightness, lightness, lightness)
      }
      indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3)
      vertexCount += 4
    }
    return vertexCount
  }

  buildWaterGeometry(cx, cz) {
    const positions = []
    const normals = []
    const uvs = []
    const colors = []
    const indices = []
    let vertexCount = 0
    const uv = tileUV(TILE.water)
    const startX = cx * CHUNK
    const startZ = cz * CHUNK
    const top = 0.88

    const addQuad = (points) => {
      const baseIndex = vertexCount
      for (let i = 0; i < 4; i += 1) {
        positions.push(points[i][0], points[i][1], points[i][2])
        normals.push(0, 1, 0)
        const u = i === 0 || i === 3 ? uv.u0 : uv.u1
        const v = i < 2 ? uv.vBottom : uv.vTop
        uvs.push(u, v)
        colors.push(0.88, 0.94, 1)
      }
      indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3)
      vertexCount += 4
    }

    for (let lz = 0; lz < CHUNK; lz += 1) {
      for (let lx = 0; lx < CHUNK; lx += 1) {
        const x = startX + lx
        const z = startZ + lz
        for (let y = 0; y < WORLD_HEIGHT; y += 1) {
          if (this.getBlock(x, y, z) !== BLOCK.WATER) continue
          const above = this.getBlock(x, y + 1, z)
          if (above !== BLOCK.WATER && !this.isOpaque(x, y + 1, z)) {
            addQuad([
              [x, y + top, z + 1],
              [x + 1, y + top, z + 1],
              [x + 1, y + top, z],
              [x, y + top, z]
            ])
          }
          if (!this.isOpaque(x + 1, y, z) && this.getBlock(x + 1, y, z) !== BLOCK.WATER) {
            addQuad([
              [x + 1, y, z + 1],
              [x + 1, y, z],
              [x + 1, y + top, z],
              [x + 1, y + top, z + 1]
            ])
          }
          if (!this.isOpaque(x - 1, y, z) && this.getBlock(x - 1, y, z) !== BLOCK.WATER) {
            addQuad([
              [x, y, z],
              [x, y, z + 1],
              [x, y + top, z + 1],
              [x, y + top, z]
            ])
          }
          if (!this.isOpaque(x, y, z + 1) && this.getBlock(x, y, z + 1) !== BLOCK.WATER) {
            addQuad([
              [x, y, z + 1],
              [x + 1, y, z + 1],
              [x + 1, y + top, z + 1],
              [x, y + top, z + 1]
            ])
          }
          if (!this.isOpaque(x, y, z - 1) && this.getBlock(x, y, z - 1) !== BLOCK.WATER) {
            addQuad([
              [x + 1, y, z],
              [x, y, z],
              [x, y + top, z],
              [x + 1, y + top, z]
            ])
          }
        }
      }
    }

    return makeGeometry(positions, normals, uvs, colors, indices)
  }

  setBlock(x, y, z, type) {
    if (!this.inBounds(x, y, z)) return false
    if (y === 0) return false
    this.setRaw(x, y, z, type)
    const cx = Math.floor(x / CHUNK)
    const cz = Math.floor(z / CHUNK)
    const lx = x - cx * CHUNK
    const lz = z - cz * CHUNK
    const impacted = new Set([`${cx},${cz}`])
    const west = lx === 0 && cx > 0
    const east = lx === CHUNK - 1 && cx < WORLD_CHUNKS - 1
    const north = lz === 0 && cz > 0
    const south = lz === CHUNK - 1 && cz < WORLD_CHUNKS - 1
    if (west) impacted.add(`${cx - 1},${cz}`)
    if (east) impacted.add(`${cx + 1},${cz}`)
    if (north) impacted.add(`${cx},${cz - 1}`)
    if (south) impacted.add(`${cx},${cz + 1}`)
    if (west && north) impacted.add(`${cx - 1},${cz - 1}`)
    if (west && south) impacted.add(`${cx - 1},${cz + 1}`)
    if (east && north) impacted.add(`${cx + 1},${cz - 1}`)
    if (east && south) impacted.add(`${cx + 1},${cz + 1}`)
    for (const key of impacted) {
      const [scx, scz] = key.split(',').map(Number)
      this.buildChunk(scx, scz)
    }
    return true
  }

  raycast(origin, direction, maxDistance = 6) {
    let x = Math.floor(origin.x)
    let y = Math.floor(origin.y)
    let z = Math.floor(origin.z)
    if (this.isTargetable(x, y, z)) return { x, y, z, normal: [0, 1, 0], type: this.getBlock(x, y, z) }

    const stepX = Math.sign(direction.x)
    const stepY = Math.sign(direction.y)
    const stepZ = Math.sign(direction.z)
    const tDeltaX = stepX === 0 ? Infinity : Math.abs(1 / direction.x)
    const tDeltaY = stepY === 0 ? Infinity : Math.abs(1 / direction.y)
    const tDeltaZ = stepZ === 0 ? Infinity : Math.abs(1 / direction.z)
    let tMaxX = stepX === 0 ? Infinity : (stepX > 0 ? x + 1 - origin.x : origin.x - x) / Math.abs(direction.x)
    let tMaxY = stepY === 0 ? Infinity : (stepY > 0 ? y + 1 - origin.y : origin.y - y) / Math.abs(direction.y)
    let tMaxZ = stepZ === 0 ? Infinity : (stepZ > 0 ? z + 1 - origin.z : origin.z - z) / Math.abs(direction.z)
    let distance = 0
    let normal = [0, 1, 0]

    for (let i = 0; i < 128; i += 1) {
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX
        distance = tMaxX
        tMaxX += tDeltaX
        normal = [-stepX, 0, 0]
      } else if (tMaxY < tMaxZ) {
        y += stepY
        distance = tMaxY
        tMaxY += tDeltaY
        normal = [0, -stepY, 0]
      } else {
        z += stepZ
        distance = tMaxZ
        tMaxZ += tDeltaZ
        normal = [0, 0, -stepZ]
      }
      if (distance > maxDistance) break
      if (this.isTargetable(x, y, z)) {
        return { x, y, z, normal, type: this.getBlock(x, y, z), distance }
      }
    }
    return null
  }

  findSpawn() {
    const center = WORLD_SIZE / 2
    let best = null
    for (let radius = 0; radius <= 24 && !best; radius += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue
          const x = center + dx
          const z = center + dz
          const height = this.heightAt(x, z)
          if (height <= SEA_LEVEL + 1 || height > SEA_LEVEL + 8) continue
          if (this.getBlock(x, height, z) !== BLOCK.GRASS) continue
          if (this.getBlock(x, height + 1, z) !== BLOCK.AIR) continue
          if (this.getBlock(x, height + 2, z) !== BLOCK.AIR) continue
          if (!this.flatEnough(x, z, 1)) continue
          best = { x: x + 0.5, z: z + 0.5, y: height + 1, height }
          break
        }
        if (best) break
      }
    }
    if (!best) {
      const height = this.heightAt(center, center)
      best = { x: center + 0.5, z: center + 0.5, y: height + 2, height }
    }
    best.yaw = this.chooseViewYaw(best.x, best.z)
    return best
  }

  chooseViewYaw(x, z) {
    let bestYaw = 0
    let bestScore = Infinity
    for (let i = 0; i < 24; i += 1) {
      const angle = (i / 24) * Math.PI * 2
      const dx = Math.cos(angle)
      const dz = Math.sin(angle)
      let score = 0
      for (const distance of [8, 14, 22]) {
        const h = this.heightAt(Math.floor(x + dx * distance), Math.floor(z + dz * distance))
        score += h + (h <= SEA_LEVEL ? -6 : 0)
      }
      if (score < bestScore) {
        bestScore = score
        bestYaw = Math.atan2(-dx, -dz)
      }
    }
    return bestYaw
  }

  dispose() {
    for (const chunk of this.chunks.values()) {
      chunk.solid.geometry.dispose()
      if (chunk.water) chunk.water.geometry.dispose()
    }
    this.scene.remove(this.group)
  }
}

function makeGeometry(positions, normals, uvs, colors, indices) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

function distance(x1, z1, x2, z2) {
  return Math.hypot(x1 - x2, z1 - z2)
}
