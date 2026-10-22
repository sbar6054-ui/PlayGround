import * as THREE from 'three'
import { SEA_LEVEL, WORLD_SIZE } from './world.js'

const HALF_WIDTH = 0.3
const HEIGHT = 1.8
const EYE_HEIGHT = 1.62
const GRAVITY = 27
const WALK_SPEED = 4.7
const SPRINT_SPEED = 7.4
const SWIM_SPEED = 3.3
const JUMP_SPEED = 8.6

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export class Player {
  constructor(camera, world) {
    this.camera = camera
    this.world = world
    this.position = new THREE.Vector3()
    this.velocity = new THREE.Vector3()
    this.yaw = 0
    this.pitch = -0.05
    this.onGround = false
    this.inWater = false
    this.headUnder = false
    this.bobPhase = 0
    this.bobAmount = 0
    this.eyeOffset = 0
    this.fov = 70
    this.walkDistance = 0
  }

  spawn(spawn) {
    this.position.set(spawn.x, spawn.y + 0.01, spawn.z)
    this.velocity.set(0, 0, 0)
    this.yaw = spawn.yaw ?? 0
    this.pitch = -0.06
    this.onGround = false
    this.eyeOffset = 0
    this.updateCamera(0)
  }

  look(dx, dy, sensitivity = 0.0024) {
    this.yaw -= dx * sensitivity
    this.pitch -= dy * sensitivity
    this.pitch = clamp(this.pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02)
    this.yaw = ((this.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
  }

  forwardVector(target = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch)
    return target.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp)
  }

  box() {
    return {
      minX: this.position.x - HALF_WIDTH,
      maxX: this.position.x + HALF_WIDTH,
      minY: this.position.y,
      maxY: this.position.y + HEIGHT,
      minZ: this.position.z - HALF_WIDTH,
      maxZ: this.position.z + HALF_WIDTH
    }
  }

  intersectsBlock(x, y, z) {
    const box = this.box()
    return box.maxX > x && box.minX < x + 1 && box.maxY > y && box.minY < y + 1 && box.maxZ > z && box.minZ < z + 1
  }

  update(dt, input) {
    this.inWater = this.world.isWaterAt(Math.floor(this.position.x), Math.floor(this.position.y + 0.6), Math.floor(this.position.z))
    this.headUnder = this.world.isWaterAt(Math.floor(this.position.x), Math.floor(this.position.y + EYE_HEIGHT), Math.floor(this.position.z))

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
    const desired = new THREE.Vector3()
    desired.addScaledVector(forward, input.forward || 0)
    desired.addScaledVector(right, input.right || 0)
    if (desired.lengthSq() > 1) desired.normalize()
    const sprinting = input.sprint && desired.lengthSq() > 0.2
    const speed = this.inWater ? SWIM_SPEED : sprinting ? SPRINT_SPEED : WALK_SPEED
    const targetX = desired.x * speed
    const targetZ = desired.z * speed
    const control = this.onGround ? 14 : this.inWater ? 8 : 5.5
    const blend = 1 - Math.exp(-control * dt)
    this.velocity.x += (targetX - this.velocity.x) * blend
    this.velocity.z += (targetZ - this.velocity.z) * blend

    if (this.inWater) {
      this.velocity.y -= 8 * dt
      this.velocity.y *= Math.exp(-2.2 * dt)
      if (input.jump) this.velocity.y = Math.min(this.velocity.y + 24 * dt, 3.6)
      if (this.velocity.y < -5) this.velocity.y = -5
    } else {
      this.velocity.y -= GRAVITY * dt
      if (this.velocity.y < -42) this.velocity.y = -42
      if (input.jump && this.onGround) {
        this.velocity.y = JUMP_SPEED
        this.onGround = false
        if (input.onJump) input.onJump()
      }
    }

    this.onGround = false
    this.moveAxis('y', this.velocity.y * dt)
    this.moveAxis('x', this.velocity.x * dt)
    this.moveAxis('z', this.velocity.z * dt)

    this.position.x = clamp(this.position.x, 1.2, WORLD_SIZE - 1.2)
    this.position.z = clamp(this.position.z, 1.2, WORLD_SIZE - 1.2)
    this.position.y = Math.max(this.position.y, -8)

    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z)
    if (this.onGround && horizontalSpeed > 0.4) {
      this.bobPhase += dt * horizontalSpeed * 2.2
      this.walkDistance += horizontalSpeed * dt
    } else {
      this.bobPhase += dt * 1.2
    }
    const targetBob = this.onGround ? Math.min(horizontalSpeed / WALK_SPEED, 1.3) : 0
    this.bobAmount += (targetBob - this.bobAmount) * Math.min(1, dt * 8)
    const targetFov = sprinting && horizontalSpeed > 3 ? 77 : 70
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 6)
    this.eyeOffset += ((this.inWater ? -0.12 : 0) - this.eyeOffset) * Math.min(1, dt * 4)
    this.updateCamera(dt)
  }

  moveAxis(axis, delta) {
    if (!delta) return
    this.position[axis] += delta
    const box = this.box()
    const minX = Math.floor(box.minX + 0.0001)
    const maxX = Math.floor(box.maxX - 0.0001)
    const minY = Math.floor(box.minY + 0.0001)
    const maxY = Math.floor(box.maxY - 0.0001)
    const minZ = Math.floor(box.minZ + 0.0001)
    const maxZ = Math.floor(box.maxZ - 0.0001)

    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          if (!this.world.isSolidAt(x, y, z)) continue
          if (axis === 'x') {
            if (delta > 0) this.position.x = x - HALF_WIDTH - 0.0001
            else this.position.x = x + 1 + HALF_WIDTH + 0.0001
            this.velocity.x = 0
          } else if (axis === 'z') {
            if (delta > 0) this.position.z = z - HALF_WIDTH - 0.0001
            else this.position.z = z + 1 + HALF_WIDTH + 0.0001
            this.velocity.z = 0
          } else {
            if (delta > 0) this.position.y = y - HEIGHT - 0.0001
            else {
              this.position.y = y + 1 + 0.0001
              this.onGround = true
            }
            this.velocity.y = 0
          }
        }
      }
    }
  }

  eyePosition(target = new THREE.Vector3()) {
    const bob = Math.sin(this.bobPhase * 2) * 0.035 * this.bobAmount
    return target.set(this.position.x, this.position.y + EYE_HEIGHT + this.eyeOffset + bob, this.position.z)
  }

  updateCamera() {
    this.eyePosition(this.camera.position)
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ')
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov
      this.camera.updateProjectionMatrix()
    }
  }

  isUnderwater() {
    return this.headUnder
  }

  waterSurfaceDistance() {
    return Math.abs(this.position.y - (SEA_LEVEL + 0.9))
  }
}
