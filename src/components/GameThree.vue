<template>
  <div class="game-three" :class="{ 'play-mode': mode === 'play' || mode === 'characterSelect' }">
    <div class="has-to-be-here-for-reactivity">
      <pre>
Mode: {{mode}}
Character: {{character}}
Score: {{score}}
Moves: {{moves}}
Facing: {{facing}}
{{map}}
      </pre>
</div>

  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import TWEEN from '@tweenjs/tween.js'
import * as THREE from 'three'
window.THREE = THREE
require('three/examples/js/loaders/GLTFLoader')
require('three/examples/js/controls/OrbitControls')

const gltfLoader = new THREE.GLTFLoader()

const prepGLTFPlayer = (gltf) => {
  let lastTime = 0
  gltf.animationNameMap = {}
  gltf.animations.forEach((animation) => {
    gltf.animationNameMap[animation.name] = animation
  })
  gltf.update = (time) => {
    const dt = (time - lastTime) / 1000
    gltf.mixer.update(dt)
    lastTime = time
  }
  gltf.playAnimationByName = (name) => {
    if (gltf.lastAnimation !== name) {
      gltf.mixer = new THREE.AnimationMixer(gltf.scene)
      const clip = gltf.animationNameMap[name]
      let action = gltf.mixer.clipAction(clip)
      action.play()
      gltf.lastAnimation = name
    }
  }
}

let gltfAssetMap = {}
let unpackedObjectMap = {}
const loadGltfAssets = async (assetList) => {
  let promiseList = []
  assetList.forEach((asset) => {
    if (!gltfAssetMap[asset]) {
      let _resolve
      let _reject
      const promise = new Promise((resolve, reject) => {
        _resolve = resolve
        _reject = reject
      })
      gltfLoader.load(
        `models/${asset}.gltf`,
        (gltf) => {
          gltfAssetMap[asset] = gltf
          prepGLTFPlayer(gltf)
          gltf.scene.children.forEach((item) => {
            unpackedObjectMap[item.name] = item
          })
          _resolve(gltf)
        },
        undefined,
        _reject
      )
      promiseList.push(promise)
    }
  })
  await Promise.all(promiseList)
  return gltfAssetMap
}

const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true
})
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  10000
)
const scene = new THREE.Scene()
const group = new THREE.Group()
scene.add(group)

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
directionalLight.position.set(-2, 2, 2)
directionalLight.castShadow = true
scene.add(directionalLight)

const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1.0)
directionalLight2.position.set(1, 2, 1)
directionalLight2.castShadow = true
scene.add(directionalLight2)

const ambientLight = new THREE.AmbientLight(0xffffff, 2)
scene.add(ambientLight)

const light = new THREE.HemisphereLight(0xcefeff, 0xb3eaf0, 0.5)
scene.add(light)

// Fog will be adjusted based on player role
let fog = new THREE.Fog('#5d3758', 9, 12)
scene.fog = fog

const deg45 = Math.PI / 4
const directionMap = {
  X: -deg45 * 4,
  Z: -deg45 * 6,
  A: -deg45 * 6,
  Q: 0,
  W: 0,
  E: -deg45 * 2,
  D: -deg45 * 2,
  C: -deg45 * 4,
  'S': 0,
  ' ': 0,
  '┃': 0,
  '━': -deg45 * 2,
  '┓': -deg45 * 4,
  '┛': -deg45 * 6,
  '┗': 0,
  '┏': -deg45 * 2,
  ',': -deg45 * 2,
  '┻': 0,
  '┣': -deg45 * 2,
  '┳': -deg45 * 4,
  '┫': -deg45 * 6,
  '╋': 0,
  '╻': -deg45 * 4,
  '╹': 0,
  '╺': -deg45 * 2,
  '╸': -deg45 * 6,
  'P': 0,
  'up': -deg45 * 2,
  'down': -deg45 * 6,
  'left': 0,
  'right': -deg45 * 4
}
const charModelMap = {
  'G': 'ghost',
  'Q': 'house_corner',
  'W': 'house',
  'E': 'house_corner',
  'D': 'house',
  'C': 'house_corner',
  'X': 'house',
  'Z': 'house_corner',
  'A': 'house',
  'S': 'road_spawn',
  ' ': 'park',
  '┃': 'road_horizontal',
  '━': 'road_horizontal',
  '┓': 'road_corner',
  '┛': 'road_corner',
  '┗': 'road_corner',
  '┏': 'road_corner',
  ',': 'start',
  '┻': 'road_tee',
  '┣': 'road_tee',
  '┳': 'road_tee',
  '┫': 'road_tee',
  '╋': 'road_plus',
  '╻': 'road_end',
  '╹': 'road_end',
  '╺': 'road_end',
  '╸': 'road_end',
  'P': 'park',
  'H': 'house'
}
const houses = [
  'house_a',
  'house_b',
  'house_c'
]
const getHouseRandom = () => {
  const index = Math.floor(houses.length * Math.random())
  return houses[index]
}

const levelHolder = new THREE.Object3D()
levelHolder.rotation.x = -deg45 * 2

let lastLevel = null
let itemLevelMap = {}
let player = new THREE.Object3D()
let playerTweenQueue = []
let rotationTween = null
let facingArrow = null
const playerTweenOnComplete = () => {
  playerTweenQueue.shift()
  const nextTween = playerTweenQueue[0]
  if (nextTween) {
    nextTween.start()
  }
}

const createFacingArrow = () => {
  if (facingArrow) {
    player.remove(facingArrow)
  }
  
  // Create arrow geometry
  const arrowGeometry = new THREE.ConeGeometry(0.3, 0.8, 8)
  const arrowMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x00ff00,  // Bright green
    transparent: true,
    opacity: 0.8,
    depthTest: false,  // Disable depth testing so arrow always renders on top
    depthWrite: false  // Don't write to depth buffer
  })
  
  facingArrow = new THREE.Mesh(arrowGeometry, arrowMaterial)
  
  // Scale arrow down a bit
  facingArrow.scale.setScalar(0.7)
  
  // Set high render order so arrow renders on top of other objects
  facingArrow.renderOrder = 1000
  
  // Default: cone points along +z axis (upward)
  // Since arrow is positioned correctly and is a child of player:
  // - player.rotation.z rotates the arrow position
  // - We need to orient the cone to point forward relative to its position
  // If arrow points left when it should point forward, rotate around z-axis by -90° (or +90°)
  // rotation.y affects pointing at camera (vertical), rotation.z affects left/right alignment
  facingArrow.rotation.x = -Math.PI / 2  // Point along -z (downward) so it's visible from top
  facingArrow.rotation.y = 0
  facingArrow.rotation.z = -Math.PI / 2  // Rotate to point forward instead of left
  
  // Position arrow immediately with default position (same as updateFacingArrow uses)
  // This ensures it appears correctly from the start, not directly under the player
  facingArrow.position.set(1, 0, 0)
  
  player.add(facingArrow)
}

const updateFacingArrow = (facing) => {
  if (!facingArrow) {
    createFacingArrow()
  }
  
  // Analysis of coordinate system:
  // When positioned at (-1.2, 0, 0): arrow appears on player's LEFT
  // When positioned at (0, -1.2, 0): arrow appears on player's RIGHT
  // This means:
  //   - Negative x = left side
  //   - Negative y = right side
  //   - Therefore: Positive x or positive y should be FRONT
  // 
  // Testing positive x as front:
  //   - If negative x is left, positive x should be right (not front)
  //   - But wait: negative y is right, so that conflicts
  // 
  // Actually, if the player model has a built-in 90° rotation:
  //   - The player's local forward might be at a diagonal
  //   - OR the axes might be: x = left/right, y = forward/back, z = up/down
  //   
  // Since (-1.2, 0, 0) = left and (0, -1.2, 0) = right:
  //   - These are 90° apart, suggesting the axes are rotated
  //   - If negative x is left and negative y is right, then they're diagonal
  //   - Front should be positive x (which would be opposite of negative x = left)
  //   - OR front could be positive y (which would be opposite of negative y = right)
  //
  // Based on typical game coordinate systems and the fact that negative x was left:
  // Let's try positive x as front - (1.2, 0, 0)
  facingArrow.position.set(1, 0, 0)
  
  // Rotation should match the createFacingArrow initialization
  // rotation.x = -PI/2 points cone downward (visible from top-down view)
  // rotation.z = -PI/2 rotates it from pointing left to pointing forward
  facingArrow.rotation.x = -Math.PI / 2
  facingArrow.rotation.y = 0
  facingArrow.rotation.z = -Math.PI / 2
}

const animatePlayerRotation = (targetRotation) => {
  // Cancel existing rotation tween if any
  if (rotationTween) {
    rotationTween.stop()
  }

  // Calculate the shortest rotation path
  const currentRotation = player.rotation.z
  const twoPi = Math.PI * 2

  // Normalize both angles to [0, 2π)
  let normalizedCurrent = ((currentRotation % twoPi) + twoPi) % twoPi
  let normalizedTarget = ((targetRotation % twoPi) + twoPi) % twoPi

  // Calculate the difference
  let diff = normalizedTarget - normalizedCurrent

  // Find shortest path
  if (diff > Math.PI) {
    diff -= twoPi
  } else if (diff < -Math.PI) {
    diff += twoPi
  }

  // Target is current + shortest difference
  const shortestTarget = currentRotation + diff

  // Create smooth rotation animation
  rotationTween = new TWEEN.Tween(player.rotation)
    .to({ z: shortestTarget }, 200)
    .easing(TWEEN.Easing.Quadratic.Out)
    .start()
}

let characterMountA = new THREE.Object3D()
let characterMountB = new THREE.Object3D()
characterMountA.scale.setScalar(2.5)
characterMountB.scale.setScalar(2.5)
characterMountA.position.set(1, -0.65, 0)
characterMountB.position.set(-1, -0.55, 0)
characterMountA.rotation.set(Math.PI / 2, Math.PI, -Math.PI / 2)
characterMountB.rotation.set(Math.PI / 2, Math.PI, -Math.PI / 2)

const changeSceneMode = (mode, character, isGuide = false) => {
  // Guard: assets and controls may not be ready yet
  if (!controls || !camera || !scene || !levelHolder) {
    return
  }
  if (mode === 'characterSelect') {
    scene.remove(levelHolder)
    scene.add(characterMountA)
    scene.add(characterMountB)
    if (unpackedObjectMap.ghost_root && unpackedObjectMap.alien_root) {
      unpackedObjectMap.ghost_root.position.set(0, 0, 0)
      unpackedObjectMap.alien_root.position.set(0, 0, 0)
      characterMountA.add(unpackedObjectMap.ghost_root)
      characterMountB.add(unpackedObjectMap.alien_root)
    }
    camera.position.set(0, 0, -5)
    camera.lookAt(new THREE.Vector3(0, 0, 0))
    if (controls && controls.update) controls.update()
    return
  }
  if (mode === 'lobby' || mode === 'levelSelect' || mode === 'levelWin') {
    // Hide game scene when in menu/lobby modes
    scene.remove(levelHolder)
    scene.remove(characterMountA)
    scene.remove(characterMountB)
    // Hide facing arrow if it exists
    if (facingArrow) {
      facingArrow.visible = false
    }
    return
  }
  if (mode === 'play') {
    scene.add(levelHolder)
    scene.remove(characterMountA)
    scene.remove(characterMountB)
    if (character) {
      changeCharacter(character)
    }
    
    // Show/hide facing arrow based on role
    if (facingArrow) {
      facingArrow.visible = isGuide
    }

    // Different camera angles for player vs guide
    if (isGuide) {
      // Bird's eye view for guide - pure top-down
      // First, un-rotate the level so it's flat
      levelHolder.rotation.x = 0
      // Position camera directly above
      camera.position.set(0, 18, 0)
      camera.lookAt(new THREE.Vector3(0, 0, 0))
      // Lock camera to top-down view
      controls.minPolarAngle = Math.PI / 2
      controls.maxPolarAngle = Math.PI / 2
      controls.minAzimuthAngle = -Infinity
      controls.maxAzimuthAngle = Infinity
      controls.minDistance = 10
      controls.maxDistance = 30
      // Guide: pan-only, disable rotation
      controls.enableRotate = false
      controls.enableZoom = true
      controls.enablePan = true
      // Prefer pan on left button (support older OrbitControls API)
      const MOUSE = (THREE && THREE.MOUSE) ? THREE.MOUSE : { LEFT: 0, MIDDLE: 1, RIGHT: 2 }
      if (controls.mouseButtons) {
        if ('ORBIT' in controls.mouseButtons && 'PAN' in controls.mouseButtons) {
          controls.mouseButtons.ORBIT = MOUSE.RIGHT
          controls.mouseButtons.PAN = MOUSE.LEFT
          if ('ZOOM' in controls.mouseButtons) controls.mouseButtons.ZOOM = MOUSE.MIDDLE
        }
      }
      // Remove fog for guide so they can see entire map
      scene.fog = null
    } else {
      // Regular player view - restore tilted perspective
      levelHolder.rotation.x = -deg45 * 2
      camera.position.set(-1, 6, -5)
      camera.lookAt(new THREE.Vector3(0, 0, 0))
      controls.minPolarAngle = -Infinity
      controls.maxPolarAngle = Math.PI / 2
      controls.minAzimuthAngle = -Infinity
      controls.maxAzimuthAngle = Infinity
      controls.minDistance = 1
      controls.maxDistance = 10
      controls.enableRotate = true
      controls.enableZoom = true
      controls.enablePan = false
      // Restore fog for player
      scene.fog = new THREE.Fog('#5d3758', 9, 12)
    }
    if (controls && controls.update) controls.update()
  }
}

const changeCharacter = (character) => {
  if (player.children[0]) {
    player.remove(player.children[0])
  }
  const playerAvatar = unpackedObjectMap[`${character}_root`]
  if (!playerAvatar) return
  playerAvatar.position.set(0, 0, 0)
  player.add(playerAvatar)
  
  // Create facing arrow for guide view
  createFacingArrow()
}

const mapAsciiStateToThree = ({
  map,
  mapRaw,
  currentLevel,
  facing,
  candyHouseIndex,
  isGuide
}) => {
  if (lastLevel !== currentLevel) {
    const lastItemHolder = itemLevelMap[lastLevel]
    if (lastItemHolder) {
      levelHolder.remove(lastItemHolder)
    }
    lastLevel = currentLevel
  }
  let itemHolder = itemLevelMap[currentLevel]
  const xMax = map.indexOf('\n', 1) - 1
  const yMax = (map.match(/\n/g) || []).length - 1
  const xOffset = (-xMax / 2) + 0.5
  const yOffset = (-yMax / 2)
  // const largestAxis = Math.max(xMax, yMax)
  // const scale = (1 / largestAxis) * 5
  // levelHolder.scale.setScalar(scale)
  if (!itemHolder) {
    let chars = [...mapRaw]
    itemHolder = itemLevelMap[currentLevel] = new THREE.Object3D()
    let tileIndex = 0 // Track actual tile position (non-newline chars)
    chars.forEach((char, stringIndex) => {
      if (char === '\n') {
        // Skip newlines, don't create items for them
        const item = new THREE.Object3D()
        itemHolder.add(item)
        return
      }
      const y = Math.floor(tileIndex / xMax)
      const x = tileIndex % xMax
      let item = itemHolder.children[stringIndex]
      if (!item) {
        const charUpper = char.toLocaleUpperCase()
        let modelName = charModelMap[charUpper] || 'road_spawn'
        if (modelName === 'house') {
          modelName = getHouseRandom()
        }
        const rotation = directionMap[charUpper] || 0
        item = unpackedObjectMap[modelName].clone()
        item.name = modelName // Explicitly set the name
        item.position.x = -(x + xOffset)
        item.position.y = (y + yOffset)
        item.rotation.z = rotation
        if (modelName.indexOf('house') === 0) {
          // Only add candy to the ONE selected house
          // candyHouseIndex is the actual index in state.map string (includes newlines)
          if (stringIndex === candyHouseIndex) {
            const candy = unpackedObjectMap.candy_circle.clone()
            // Candy only visible to guide, not player
            candy.visible = isGuide
            candy.name = 'candy_circle'
            item.add(candy)
          }
        }
        itemHolder.add(item)
      }
      tileIndex++
    })
  }
  itemHolder.add(player)
  let chars = [...map]
  if (chars.length && chars[0] === '\n') {
    // Keep the string indices aligned with placement (which used mapRaw string indices)
    // Do NOT shift here; iterate using actual string indices
  }
  // Compute player position from the actual string index in the map (includes newlines)
  const gStringIndex = map.indexOf('G')
  if (gStringIndex >= 0) {
    const tileOffset = gStringIndex - 1 // subtract leading newline
    const y = Math.floor(tileOffset / (xMax + 1))
    const x = tileOffset - y * (xMax + 1)
    const rotation = directionMap[facing] || 0
    const tween = new TWEEN.Tween(player.position)
      .to(
        {
          x: -(x + xOffset),
          y: y + yOffset
        },
        100
      )
      .easing(TWEEN.Easing.Quadratic.Out)
      .onUpdate(() => {
        // Do not auto-follow for guide
        if (!isGuide) {
          itemHolder.position.x = -player.position.x
          itemHolder.position.y = -player.position.y
        }
      })
      .onComplete(playerTweenOnComplete)
    playerTweenQueue.push(tween)
    if (playerTweenQueue.length < 2) {
      tween.start()
    }
    animatePlayerRotation(rotation)
    
    // Update facing arrow for guide view
    updateFacingArrow(facing)
  }

  // Update candy visibility and placement
  for (let s = 0; s < map.length; s++) {
    const ch = map.charAt(s)
    if (ch === '\n') continue
    let item = itemHolder.children[s]
    if (!item) continue
    if (item.name && item.name.indexOf('house') === 0) {
      // Check if this house should have candy
      const shouldHaveCandy = (s === candyHouseIndex)
      const hasCandy = item.children.length > 0 && item.children[0].name === 'candy_circle'
      
      if (shouldHaveCandy && !hasCandy) {
        // Add candy to this house
        console.log('🍭 Adding candy to house at index', s, 'isGuide:', isGuide)
        const candy = unpackedObjectMap.candy_circle.clone()
        candy.visible = isGuide
        candy.name = 'candy_circle'
        item.add(candy)
      } else if (!shouldHaveCandy && hasCandy) {
        // Remove candy from this house
        console.log('🗑️ Removing candy from house at index', s)
        item.remove(item.children[0])
      } else if (hasCandy) {
        // Update visibility based on whether house has been visited
        const show = ch === ch.toLocaleUpperCase()
        item.children[0].visible = show && isGuide
      }
    }
  }
  
  levelHolder.add(itemHolder)
}

renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
let width
let height
// let square
let center = new THREE.Vector2()
const deg = Math.PI / 180
const resize = () => {
  const clientWidth = renderer.domElement.clientWidth
  const clientHeight = renderer.domElement.clientHeight
  const dpr = window.devicePixelRatio
  width = clientWidth * dpr
  height = clientHeight * dpr
  // square = Math.min(width, height)
  if (
    renderer.domElement.width !== width ||
    renderer.domElement.height !== height
  ) {
    const aspect = width / height
    const desiredMinimumFov = deg45
    // this ensures that I always have a 90deg square in the center of both landscape and portrait viewports
    camera.fov = (
      aspect >= 1 ? desiredMinimumFov : 2 * Math.atan(Math.tan(desiredMinimumFov / 2) / aspect)
    ) / deg
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(dpr)
    renderer.setSize(
      clientWidth,
      clientHeight,
      false
    )
    center.set(width / 2, height / 2)
  }
}
let controls
let go = true
const loop = (time) => {
  if (go) {
    requestAnimationFrame(loop)
    resize()
    animate(time)
  }
}
const start = (parentNode) => {
  parentNode.appendChild(renderer.domElement)
  controls = new THREE.OrbitControls(camera, renderer.domElement)
  camera.position.set(-1, 6, -5)
  camera.lookAt(new THREE.Vector3(0, 0, 0))
  controls.enableDamping = true // an animation loop is required when either damping or auto-rotation are enabled
  controls.dampingFactor = 0.25
  controls.screenSpacePanning = false
  controls.enablePan = false
  controls.minDistance = 1
  controls.maxDistance = 10
  controls.minPolarAngle = -Infinity // Math.PI / 2
  controls.maxPolarAngle = Math.PI / 2
  requestAnimationFrame(loop)
}

const animate = (time) => {
  controls.update()
  TWEEN.update(time)
  renderer.render(scene, camera)
}

export default {
  data () {
    return {
      loaded: false,
      lastMap: null
    }
  },
  computed: {
    ...mapGetters([
      'mode',
      'character',
      'currentLevel',
      'lastDirection',
      'facing',
      'levels',
      'score',
      'moves',
      'map',
      'candyHouseIndex',
      'isGuide',
      'isPlayer',
      'isMultiplayer',
      'activePlayerCharacter'
    ]),
    // Use activePlayerCharacter in multiplayer, otherwise use character
    displayCharacter () {
      if (this.isMultiplayer) {
        // In multiplayer, use activePlayerCharacter if set, otherwise fall back to own character
        return this.activePlayerCharacter || this.character
      }
      return this.character
    }
  },
  mounted () {
    start(this.$el)
    this.startLoad()
  },
  destroyed () {
    go = false
  },
  beforeUpdate () {
    this.updateState()
  },
  methods: {
    async startLoad () {
      await loadGltfAssets([
        'city',
        'characters'
      ])
      // TODO: Figure out why these aren't working
      // scene.add(gltfAssetMap.characters.scene)
      // gltfAssetMap.characters.playAnimationByName('alien_idle')
      // gltfAssetMap.characters.playAnimationByName('ghost_idle')

      console.log('Loaded', unpackedObjectMap)
      this.loaded = true
      this.updateState()
      changeSceneMode(this.mode, this.displayCharacter, this.isGuide)
    },
    updateState () {
      if (
        this.map &&
        this.loaded &&
        this.lastMap !== this.map &&
        this.currentLevel !== null
      ) {
        mapAsciiStateToThree({
          map: this.map,
          mapRaw: this.levels[this.currentLevel],
          currentLevel: this.currentLevel,
          facing: this.facing,
          candyHouseIndex: this.candyHouseIndex,
          isGuide: this.isGuide
        })
        this.lastMap = this.map
      }
    }
  },
  watch: {
    mode () {
      changeSceneMode(this.mode, this.displayCharacter, this.isGuide)
      // Force state update when mode changes to ensure map renders
      if (this.mode === 'play' && this.loaded) {
        this.$nextTick(() => {
          this.updateState()
        })
      }
    },
    currentLevel () {
      this.updateState()
    },
    facing () {
      // Animate rotation when facing changes (even without moving)
      if (this.loaded && this.mode === 'play') {
        const rotation = directionMap[this.facing] || 0
        animatePlayerRotation(rotation)
        
        // Update facing arrow for guide view
        if (this.isGuide) {
          updateFacingArrow(this.facing)
        }
      }
    },
    isGuide () {
      // Update camera when role changes
      if (this.loaded && this.mode === 'play') {
        changeSceneMode(this.mode, this.displayCharacter, this.isGuide)
        
        // Reset camera position for new role
        if (this.isGuide) {
          // Guide: center on map
          if (levelHolder && levelHolder.children[this.currentLevel]) {
            levelHolder.children[this.currentLevel].position.x = 0
            levelHolder.children[this.currentLevel].position.y = 0
          }
          
          // Create and position facing arrow
          if (!facingArrow) {
            createFacingArrow()
          }
          updateFacingArrow(this.facing)
        }
      }
    },
    displayCharacter () {
      // Update character when activePlayerCharacter changes (role switch)
      if (this.loaded && this.mode === 'play') {
        changeCharacter(this.displayCharacter)
      }
    }
  }
}
</script>

<style lang="scss">
.game-three {
  position: absolute;
  z-index: 0;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;

  .has-to-be-here-for-reactivity {
    display: none;

    pre {
      font-family: monospace;
      font-size: 1.5rem;
      line-height: 1.25rem;
      letter-spacing: 0.25rem;
      text-align: left;
    }
  }

  canvas {
    display: block;
    position: absolute;
    z-index: 0;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
  
  // Hide canvas when not in play mode
  &:not(.play-mode) canvas {
    opacity: 0;
    pointer-events: none;
  }
}
</style>
