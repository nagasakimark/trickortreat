<template>
  <div class="map-editor">
    <div class="editor-header">
      <h2>Map Editor</h2>
      <div class="editor-controls">
        <button class="control" @click="clearMap">Clear</button>
        <button class="control" @click="showLoadDialog = true">Load</button>
        <button class="control" @click="testMap">Test</button>
        <button class="control" @click="saveMap">Save</button>
        <button class="control" @click="$store.dispatch('mode', 'levelSelect')">Back</button>
      </div>
      <div class="editor-info">
        <span>{{ mapWidth }}x{{ mapHeight }}</span>
        <button class="control small" @click="resizeMap(-1, 0)">-W</button>
        <button class="control small" @click="resizeMap(1, 0)">+W</button>
        <button class="control small" @click="resizeMap(0, -1)">-H</button>
        <button class="control small" @click="resizeMap(0, 1)">+H</button>
        <span class="divider">|</span>
        <span>{{ getSelectedTileName() }}</span>
        <span class="controls-hint">| Drag/Right-drag/Scroll = Rotate/Pan/Zoom</span>
        <label class="direction-toggle">
          <input type="checkbox" v-model="showDirectionIndicators" @change="render3DMap" />
          Show Directions
        </label>
        <span class="divider">|</span>
        <label class="mode-toggle">
          <input type="radio" value="tiles" v-model="editMode" />
          <span>Tiles</span>
        </label>
        <label class="mode-toggle">
          <input type="radio" value="nodes" v-model="editMode" />
          <span>Place<br/>Nodes</span>
        </label>
        <label class="mode-toggle">
          <input type="radio" value="paths" v-model="editMode" />
          <span>Draw<br/>Paths</span>
        </label>
        <label class="mode-toggle">
          <input type="radio" value="delete" v-model="editMode" />
          <span>Delete</span>
        </label>
        <button v-if="editMode === 'paths'" class="control small" @click="autoGeneratePaths">Auto-Generate Paths</button>
      </div>
    </div>

    <!-- Load Map Dialog -->
    <div v-if="showLoadDialog" class="modal-overlay" @click="showLoadDialog = false">
      <div class="modal-content" @click.stop>
        <h3>Load Map</h3>
        <p>Paste your map data below (without the road tiles line):</p>
        <textarea
          v-model="loadMapInput"
          placeholder="Paste map here..."
          rows="15"
          class="map-input"
        ></textarea>
        <div class="modal-buttons">
          <button class="control" @click="loadMap">Load</button>
          <button class="control" @click="showLoadDialog = false; loadMapInput = ''">Cancel</button>
        </div>
        <p v-if="loadError" class="error">{{ loadError }}</p>
      </div>
    </div>

    <div class="editor-body">
      <div class="tile-palette" :class="{ collapsed: editMode !== 'tiles' }">
        <template v-if="editMode === 'tiles'">
        <h3>Tiles</h3>
        <div class="palette-section">
          <h4>Special</h4>
          <button
            v-for="tile in specialTiles"
            :key="tile.char"
            class="palette-tile"
            :class="{ selected: selectedTile === tile.char }"
            @click="selectedTile = tile.char"
            :title="tile.name"
          >
            <span class="tile-char">{{ tile.char }}</span>
            <span class="tile-label">{{ tile.name }}</span>
          </button>
        </div>
        <div class="palette-section">
          <h4>Roads</h4>
          <button
            v-for="tile in roadTiles"
            :key="tile.char"
            class="palette-tile"
            :class="{ selected: selectedTile === tile.char }"
            @click="selectedTile = tile.char"
            :title="tile.name"
          >
            <span class="tile-char">{{ tile.char }}</span>
            <span class="tile-label">{{ tile.name }}</span>
          </button>
        </div>
        <div class="palette-section">
          <h4>Houses</h4>
          <button
            v-for="tile in houseTiles"
            :key="tile.char"
            class="palette-tile"
            :class="{ selected: selectedTile === tile.char }"
            @click="selectedTile = tile.char"
            :title="tile.name"
          >
            <span class="tile-char">{{ tile.char }}</span>
            <span class="tile-label">{{ tile.name }}</span>
          </button>
        </div>
        <div class="palette-section">
          <h4>Scenery</h4>
          <button
            v-for="tile in sceneryTiles"
            :key="tile.char"
            class="palette-tile"
            :class="{ selected: selectedTile === tile.char }"
            @click="selectedTile = tile.char"
            :title="tile.name"
          >
            <span class="tile-char">{{ tile.char }}</span>
            <span class="tile-label">{{ tile.name }}</span>
          </button>
        </div>
        </template>
        <template v-else-if="editMode === 'nodes'">
          <h3>Place Nodes</h3>
          <div class="palette-section">
            <h4>Node Type</h4>
            <button class="palette-tile wide" :class="{selected: pointType==='junction'}" @click="pointType='junction'">
              <span class="tile-label">Junction<br/>(Turn Point)</span>
            </button>
            <button class="palette-tile wide" :class="{selected: pointType==='houseStop'}" @click="pointType='houseStop'">
              <span class="tile-label">House Stop<br/>(Short Forward)</span>
            </button>
            <button class="palette-tile wide" :class="{selected: pointType==='both'}" @click="pointType='both'">
              <span class="tile-label">Junction + House<br/>(Both Buttons)</span>
            </button>
          </div>
          <p class="help-text">Click on a tile to place a node. Auto-generate will create these automatically.</p>
        </template>
        <template v-else-if="editMode === 'paths'">
          <h3>Draw Paths</h3>
          <div class="palette-section">
            <p class="help-text">Click and drag between tiles to draw paths. Paths connect nodes automatically.</p>
            <button class="control" @click="finishPath">Finish Path</button>
            <button class="control" @click="clearDraft">Clear Draft</button>
          </div>
        </template>
        <template v-else-if="editMode === 'delete'">
          <h3>Delete</h3>
          <div class="palette-section">
            <p class="help-text">Click on a node or path to delete it</p>
          </div>
        </template>
        <template v-else>
          <h3>Navigation</h3>
          <div class="palette-section">
            <p class="help-text">Select a mode from the top toolbar</p>
          </div>
          <div class="palette-section" v-if="editMode==='nodes'">
            <h4>Point Type</h4>
            <button class="palette-tile" :class="{selected: pointType==='junction'}" @click="pointType='junction'">
              <span class="tile-label">Junction/Turn</span>
            </button>
            <button class="palette-tile" :class="{selected: pointType==='houseStop'}" @click="pointType='houseStop'">
              <span class="tile-label">House Stop</span>
            </button>
          </div>
          <div class="palette-section" v-if="editMode==='paths'">
            <p class="hint">Click to add segments. Existing points autoconnect.</p>
          </div>
        </template>
      </div>

      <div class="map-3d-container" ref="map3dContainer">
      </div>
    </div>
  </div>
</template>

<script>
import * as THREE from 'three'
window.THREE = THREE
require('three/examples/js/loaders/GLTFLoader')
require('three/examples/js/controls/OrbitControls')

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
  '!': 0,
  'H': 0
}

const charModelMap = {
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
  '!': 'road_spawn',
  'H': 'house'
}

export default {
  name: 'MapEditor',
  data () {
    return {
      mapWidth: 10,
      mapHeight: 10,
      mapData: [],
      selectedTile: 'S',
      isDragging: false,
      mouseDownPos: null,
      mouseMoved: false,
      isDraggingPath: false,
      dragStartNode: null,
      gltfLoader: null,
      unpackedObjectMap: {},
      renderer: null,
      camera: null,
      scene: null,
      mapGroup: null,
      tileObjects: [],
      raycaster: null,
      mouse: null,
      loaded: false,
      animationId: null,
      controls: null,
      editMode: 'tiles',
      nodes: [], // {x,y,type}
      edges: [], // {from:{x,y}, to:{x,y}}
      overlayGroup: null,
      pointType: 'junction',
      pathDraftNode: null,
      showLoadDialog: false,
      loadMapInput: '',
      loadError: '',
      showDirectionIndicators: false,
      specialTiles: [
        { char: 'S', name: 'Spawn' },
        { char: '!', name: 'Exit' }
      ],
      roadTiles: [
        { char: '┃', name: 'Road |' },
        { char: '━', name: 'Road -' },
        { char: '┓', name: 'Corner' },
        { char: '┛', name: 'Corner' },
        { char: '┗', name: 'Corner' },
        { char: '┏', name: 'Corner' },
        { char: '┻', name: 'T-Road' },
        { char: '┣', name: 'T-Road' },
        { char: '┳', name: 'T-Road' },
        { char: '┫', name: 'T-Road' },
        { char: '╋', name: 'Cross' },
        { char: '╻', name: 'End' },
        { char: '╹', name: 'End' },
        { char: '╺', name: 'End' },
        { char: '╸', name: 'End' }
      ],
      houseTiles: [
        { char: 'Q', name: 'House' },
        { char: 'W', name: 'House' },
        { char: 'E', name: 'House' },
        { char: 'D', name: 'House' },
        { char: 'C', name: 'House' },
        { char: 'X', name: 'House' },
        { char: 'Z', name: 'House' },
        { char: 'A', name: 'House' }
      ],
      sceneryTiles: [
        { char: 'P', name: 'Park' },
        { char: 'H', name: 'House' }
      ]
    }
  },
  async mounted () {
    this.initializeMap()
    await this.loadAssets()
    this.init3D()
    this.render3DMap()
  },
  beforeDestroy () {
    // Cancel animation loop
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }

    // Dispose controls
    if (this.controls) {
      this.controls.dispose()
      this.controls = null
    }

    // Remove event listeners
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.removeEventListener('mousedown', this.onMapMouseDown)
      this.renderer.domElement.removeEventListener('mouseup', this.onMapMouseUp)
      this.renderer.domElement.removeEventListener('mousemove', this.onMapMouseMove)
    }

    // Clean up renderer
    if (this.renderer) {
      this.renderer.dispose()
      this.renderer = null
    }

    // Clear references
    this.scene = null
    this.camera = null
    this.mapGroup = null
    this.tileObjects = []
  },
  methods: {
    async loadAssets () {
      this.gltfLoader = new THREE.GLTFLoader()
      const gltf = await new Promise((resolve, reject) => {
        this.gltfLoader.load('models/city.gltf', resolve, undefined, reject)
      })
      gltf.scene.children.forEach((item) => {
        this.unpackedObjectMap[item.name] = item
      })
      this.loaded = true
    },
    init3D () {
      if (!this.$refs.map3dContainer) return

      // Setup renderer
      this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
      this.renderer.setSize(this.$refs.map3dContainer.clientWidth, this.$refs.map3dContainer.clientHeight)
      this.$refs.map3dContainer.appendChild(this.renderer.domElement)

      // Setup camera
      this.camera = new THREE.PerspectiveCamera(45, this.$refs.map3dContainer.clientWidth / this.$refs.map3dContainer.clientHeight, 0.1, 1000)
      this.updateCameraPosition()
      this.camera.lookAt(0, 0, 0)

      // Setup scene
      this.scene = new THREE.Scene()
      this.scene.fog = new THREE.Fog('#5d3758', 15, 25)

      // Lighting
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
      directionalLight.position.set(-2, 2, 2)
      this.scene.add(directionalLight)

      const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1.0)
      directionalLight2.position.set(1, 2, 1)
      this.scene.add(directionalLight2)

      const ambientLight = new THREE.AmbientLight(0xffffff, 2)
      this.scene.add(ambientLight)

      const light = new THREE.HemisphereLight(0xcefeff, 0xb3eaf0, 0.5)
      this.scene.add(light)

      // Map group
      this.mapGroup = new THREE.Group()
      this.mapGroup.rotation.x = -deg45 * 2
      this.scene.add(this.mapGroup)

      // Overlay group for nodes/edges (child of mapGroup so it inherits rotation)
      this.overlayGroup = new THREE.Group()
      this.mapGroup.add(this.overlayGroup)

      // Raycaster for clicking
      this.raycaster = new THREE.Raycaster()
      this.mouse = new THREE.Vector2()

      // OrbitControls for camera movement
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement)
      this.controls.enableDamping = true
      this.controls.dampingFactor = 0.25
      this.controls.screenSpacePanning = false
      this.controls.minDistance = 5
      this.controls.maxDistance = 30
      this.controls.maxPolarAngle = Math.PI / 2

      // Mouse events
      this.renderer.domElement.addEventListener('mousedown', this.onMapMouseDown)
      this.renderer.domElement.addEventListener('mouseup', this.onMapMouseUp)
      this.renderer.domElement.addEventListener('mousemove', this.onMapMouseMove)

      // Animation loop
      const animate = () => {
        if (this.renderer && this.scene && this.camera && this.controls) {
          this.animationId = requestAnimationFrame(animate)
          this.controls.update()
          this.renderer.render(this.scene, this.camera)
        }
      }
      animate()
    },
    updateCameraPosition () {
      if (!this.camera) return
      // Adjust camera distance based on map size
      const maxDimension = Math.max(this.mapWidth, this.mapHeight)
      const distance = maxDimension * 1.2 + 5
      this.camera.position.set(0, distance, distance * 0.7)
      this.camera.lookAt(0, 0, 0)
      if (this.controls) {
        this.controls.update()
      }
    },
    initializeMap () {
      this.mapData = new Array(this.mapWidth * this.mapHeight).fill('P')
      const centerIndex = Math.floor((this.mapHeight / 2) * this.mapWidth + this.mapWidth / 2)
      this.mapData[centerIndex] = 'S'
      if (this.loaded) {
        this.updateCameraPosition()
        this.render3DMap()
      }
    },
    resizeMap (deltaWidth, deltaHeight) {
      const newWidth = Math.max(5, Math.min(30, this.mapWidth + deltaWidth))
      const newHeight = Math.max(5, Math.min(30, this.mapHeight + deltaHeight))
      if (newWidth === this.mapWidth && newHeight === this.mapHeight) return
      const newData = new Array(newWidth * newHeight).fill('P')
      for (let y = 0; y < Math.min(this.mapHeight, newHeight); y++) {
        for (let x = 0; x < Math.min(this.mapWidth, newWidth); x++) {
          const oldIndex = y * this.mapWidth + x
          const newIndex = y * newWidth + x
          newData[newIndex] = this.mapData[oldIndex] || 'P'
        }
      }
      this.mapWidth = newWidth
      this.mapHeight = newHeight
      this.mapData = newData
      this.updateCameraPosition()
      this.render3DMap()
    },
    render3DMap () {
      if (!this.mapGroup || !this.loaded) return

      // Clear existing tiles (but keep overlayGroup)
      const children = [...this.mapGroup.children]
      children.forEach(child => {
        if (child !== this.overlayGroup) {
          this.mapGroup.remove(child)
        }
      })
      this.tileObjects = []

      const xOffset = (-this.mapWidth / 2) + 0.5
      const yOffset = (-this.mapHeight / 2)

      const houses = ['house_a', 'house_b', 'house_c']
      const getHouseForPosition = (x, y) => {
        // Use position as seed for consistent house selection
        const seed = (x * 7 + y * 13) % houses.length
        return houses[seed]
      }

      for (let y = 0; y < this.mapHeight; y++) {
        for (let x = 0; x < this.mapWidth; x++) {
          const index = y * this.mapWidth + x
          const char = this.mapData[index]
          let modelName = charModelMap[char] || 'park'
          const rotation = directionMap[char] || 0

          // Handle 'house' placeholder - pick consistent house type based on position
          if (modelName === 'house') {
            modelName = getHouseForPosition(x, y)
          }

          if (this.unpackedObjectMap[modelName]) {
            const tile = this.unpackedObjectMap[modelName].clone()
            tile.position.x = -(x + xOffset)
            tile.position.y = (y + yOffset)
            tile.rotation.z = rotation
            tile.userData = { index, x, y }
            this.mapGroup.add(tile)
            this.tileObjects.push(tile)
          }
        }
      }

      // Add compass direction labels if enabled
      if (this.showDirectionIndicators) {
        this.addCompassLabels(xOffset, yOffset)
      }

      // Render overlay (nodes/edges)
      this.renderOverlay()
    },
    addCompassLabels (xOffset, yOffset) {
      const createLabel = (text, color = '#ff0000') => {
        // Create a new canvas for each label
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        canvas.width = 256
        canvas.height = 256

        context.fillStyle = color
        context.font = 'Bold 180px Arial'
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(text, 128, 128)

        const texture = new THREE.CanvasTexture(canvas)
        const material = new THREE.SpriteMaterial({ map: texture })
        const sprite = new THREE.Sprite(material)
        sprite.scale.set(2, 2, 1)
        return sprite
      }

      // North (top of map)
      const north = createLabel('N')
      north.position.set(0, -(this.mapHeight / 2) - 1.5, 1)
      this.mapGroup.add(north)

      // South (bottom of map)
      const south = createLabel('S')
      south.position.set(0, (this.mapHeight / 2) + 1.5, 1)
      this.mapGroup.add(south)

      // East (right side of map)
      const east = createLabel('E')
      east.position.set(-(this.mapWidth / 2) - 1.5, 0, 1)
      this.mapGroup.add(east)

      // West (left side of map)
      const west = createLabel('W')
      west.position.set((this.mapWidth / 2) + 1.5, 0, 1)
      this.mapGroup.add(west)
    },
    onMapMouseDown (event) {
      this.mouseDownPos = { x: event.clientX, y: event.clientY }
      this.mouseMoved = false

      // For path drawing mode, start drag
      if (this.editMode === 'paths') {
        const hit = this.screenToTile(event)
        if (hit) {
          // Find or create node at this position
          let node = this.nodes.find(n => n.x === hit.x && n.y === hit.y)
          if (!node) {
            node = { x: hit.x, y: hit.y, type: 'junction' }
            this.nodes.push(node)
          }
          this.dragStartNode = node
          this.isDraggingPath = true
          // Disable orbit controls during path drag
          if (this.controls) {
            this.controls.enabled = false
          }
        }
      }
    },
    renderOverlay () {
      if (!this.overlayGroup) return

      // Clear overlay
      while (this.overlayGroup.children.length > 0) {
        this.overlayGroup.remove(this.overlayGroup.children[0])
      }

      const xOffset = (-this.mapWidth / 2) + 0.5
      const yOffset = (-this.mapHeight / 2)

      // Draw nodes (snap to tile centers)
      const nodeGeom = new THREE.SphereGeometry(0.12, 10, 10)
      this.nodes.forEach(({ x, y, type }) => {
        // Color based on type: cyan=junction, red=houseStop, purple=both
        let color = 0x00ffff // cyan for junction
        if (type === 'houseStop') color = 0xff4444 // red
        if (type === 'both') color = 0xff00ff // magenta/purple for junction+house

        const nodeMat = new THREE.MeshBasicMaterial({ color })
        const node = new THREE.Mesh(nodeGeom, nodeMat)
        node.position.x = -(x + xOffset)
        node.position.y = (y + yOffset)
        node.position.z = 0.05 // Just slightly above tile plane
        this.overlayGroup.add(node)
      })

      // Draw edges
      const edgeMat = new THREE.LineBasicMaterial({ color: 0xffcc00 })
      this.edges.forEach(({ from, to }) => {
        const points = []
        points.push(new THREE.Vector3(-(from.x + xOffset), (from.y + yOffset), 0.05))
        points.push(new THREE.Vector3(-(to.x + xOffset), (to.y + yOffset), 0.05))
        const geom = new THREE.BufferGeometry().setFromPoints(points)
        const line = new THREE.Line(geom, edgeMat)
        this.overlayGroup.add(line)
      })
    },
    onMapMouseMove (event) {
      if (this.mouseDownPos) {
        const dx = event.clientX - this.mouseDownPos.x
        const dy = event.clientY - this.mouseDownPos.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance > 5) { // 5px threshold for drag detection
          this.mouseMoved = true
        }
      }

      // Update overlay on mouse move
      this.renderOverlay()
    },
    onMapMouseUp (event) {
      // Handle path drag completion
      if (this.isDraggingPath && this.dragStartNode) {
        const hit = this.screenToTile(event)
        if (hit) {
          // Find or create end node
          let endNode = this.nodes.find(n => n.x === hit.x && n.y === hit.y)
          if (!endNode) {
            endNode = { x: hit.x, y: hit.y, type: 'junction' }
            this.nodes.push(endNode)
          }
          // Create edge if different nodes
          if (!(this.dragStartNode.x === endNode.x && this.dragStartNode.y === endNode.y)) {
            // Check if edge already exists
            const edgeExists = this.edges.some(e =>
              (e.from.x === this.dragStartNode.x && e.from.y === this.dragStartNode.y && e.to.x === endNode.x && e.to.y === endNode.y) ||
              (e.to.x === this.dragStartNode.x && e.to.y === this.dragStartNode.y && e.from.x === endNode.x && e.from.y === endNode.y)
            )
            if (!edgeExists) {
              this.edges.push({
                from: { x: this.dragStartNode.x, y: this.dragStartNode.y },
                to: { x: endNode.x, y: endNode.y }
              })
            }
          }
        }
        this.isDraggingPath = false
        this.dragStartNode = null
        // Re-enable orbit controls
        if (this.controls) {
          this.controls.enabled = true
        }
        this.renderOverlay()
      } else if (!this.mouseMoved && this.mouseDownPos) {
        // Only place tile/node if mouse didn't move (not a drag)
        if (this.editMode === 'tiles') {
          this.placeTileAtClick(event)
        } else if (this.editMode === 'nodes') {
          this.placeNodeAtClick(event)
        } else if (this.editMode === 'delete') {
          this.deleteAtClick(event)
        }
      }
      this.mouseDownPos = null
      this.mouseMoved = false
    },
    screenToTile (event) {
      const rect = this.renderer.domElement.getBoundingClientRect()
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      this.raycaster.setFromCamera(this.mouse, this.camera)

      // Raycast directly against tile objects
      const intersects = this.raycaster.intersectObjects(this.tileObjects, true)
      if (intersects.length > 0) {
        // Find the first intersected tile with userData
        for (const intersect of intersects) {
          let obj = intersect.object
          // Walk up the parent chain to find the tile object with userData
          while (obj && !obj.userData.index && obj.parent) {
          obj = obj.parent
            if (obj === this.scene || obj === this.mapGroup) break
          }
          if (obj && obj.userData && obj.userData.index !== undefined) {
            return { index: obj.userData.index, x: obj.userData.x, y: obj.userData.y }
          }
        }
      }
      return null
    },
    placeTileAtClick (event) {
      if (!this.renderer || !this.camera || !this.raycaster || !this.mouse) return
      const hit = this.screenToTile(event)
      if (hit && hit.index !== undefined) {
        this.$set(this.mapData, hit.index, this.selectedTile)
          this.render3DMap()
      }
    },
    placeNodeAtClick (event) {
      const hit = this.screenToTile(event)
      if (!hit) return
      // Snap to tile center
      this.nodes.push({ x: hit.x, y: hit.y, type: this.pointType })
      this.render3DMap()
    },
    deleteAtClick (event) {
      const hit = this.screenToTile(event)
      if (!hit) return

      // Check if clicking on a node
      const nodeIndex = this.nodes.findIndex(n => n.x === hit.x && n.y === hit.y)
      if (nodeIndex !== -1) {
        const node = this.nodes[nodeIndex]
        // Remove all edges connected to this node
        this.edges = this.edges.filter(e =>
          !(e.from.x === node.x && e.from.y === node.y) &&
          !(e.to.x === node.x && e.to.y === node.y)
        )
        // Remove the node
        this.nodes.splice(nodeIndex, 1)
        this.renderOverlay()
        return
      }

      // Check if clicking near an edge (within 0.5 units)
      for (let i = 0; i < this.edges.length; i++) {
        const edge = this.edges[i]
        // Simple distance check to edge
        const dx = edge.to.x - edge.from.x
        const dy = edge.to.y - edge.from.y
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len === 0) continue

        // Project point onto line segment
        const t = Math.max(0, Math.min(1,
          ((hit.x - edge.from.x) * dx + (hit.y - edge.from.y) * dy) / (len * len)
        ))
        const projX = edge.from.x + t * dx
        const projY = edge.from.y + t * dy
        const dist = Math.sqrt((hit.x - projX) ** 2 + (hit.y - projY) ** 2)

        if (dist < 0.5) {
          this.edges.splice(i, 1)
          this.renderOverlay()
          return
        }
      }
    },
    finishPath () {
      this.pathDraftNode = null
    },
    clearDraft () {
      this.pathDraftNode = null
    },
    autoGeneratePaths () {
      if (!confirm('Auto-generate paths along all roads? This will clear existing paths.')) {
        return
      }

      this.nodes = []
      this.edges = []

      // Road tiles that can be walked on
      const roadChars = 'SH┃━┓┛┗┏┻┣┳┫╋╻╹╺╸'

      // House facing directions (which directions the house can be accessed from)
      const houseFacingMap = {
        'Q': ['up', 'left'], // North-West corner
        'W': ['up'], // North side
        'E': ['up', 'right'], // North-East corner
        'D': ['right'], // East side
        'C': ['down', 'right'], // South-East corner
        'X': ['down'], // South side
        'Z': ['down', 'left'], // South-West corner
        'A': ['left'], // West side
        'H': ['up'] // North-facing house
      }

      // Helper to check if a tile is a road
      const isRoad = (x, y) => {
        if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) return false
        const index = y * this.mapWidth + x
        return roadChars.includes(this.mapData[index])
      }

      // Helper to get tile at position
      const getTile = (x, y) => {
        if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) return null
        const index = y * this.mapWidth + x
        return this.mapData[index]
      }

      // Helper to check if a position has an accessible house
      const getAccessibleHouse = (x, y, fromDirection) => {
        // Check adjacent tiles for houses
        const checks = {
          'up': { dx: 0, dy: -1, houseDir: 'down' },
          'down': { dx: 0, dy: 1, houseDir: 'up' },
          'left': { dx: -1, dy: 0, houseDir: 'right' },
          'right': { dx: 1, dy: 0, houseDir: 'left' }
        }

        for (const [checkDir, offset] of Object.entries(checks)) {
          const hx = x + offset.dx
          const hy = y + offset.dy
          const houseTile = getTile(hx, hy)
          if (houseTile && houseFacingMap[houseTile]) {
            // Check if this house can be accessed from the road tile's direction
            const accessDirs = houseFacingMap[houseTile]
            if (accessDirs.includes(offset.houseDir)) {
              return { hasHouse: true, direction: checkDir }
            }
          }
        }
        return { hasHouse: false }
      }

      // Helper to count road neighbors
      const countRoadNeighbors = (x, y) => {
        let count = 0
        if (isRoad(x - 1, y)) count++
        if (isRoad(x + 1, y)) count++
        if (isRoad(x, y - 1)) count++
        if (isRoad(x, y + 1)) count++
        return count
      }

      // Helper to check if a position is a corner (2 perpendicular roads)
      const isCorner = (x, y) => {
        const left = isRoad(x - 1, y)
        const right = isRoad(x + 1, y)
        const up = isRoad(x, y - 1)
        const down = isRoad(x, y + 1)

        // A corner has exactly 2 neighbors that are perpendicular
        const horizontal = (left || right) && !(left && right)
        const vertical = (up || down) && !(up && down)

        return horizontal && vertical
      }

      // Helper to check if a position is a junction (3+ roads, dead end, or corner)
      const isJunctionTile = (x, y) => {
        const neighbors = countRoadNeighbors(x, y)
        return neighbors === 1 || neighbors >= 3 || isCorner(x, y)
      }

      // First pass: Create nodes at junctions, dead-ends, house stops, and spawn
      const nodeMap = {} // "x,y" -> node
      for (let y = 0; y < this.mapHeight; y++) {
        for (let x = 0; x < this.mapWidth; x++) {
          const index = y * this.mapWidth + x
          const char = this.mapData[index]
          if (!roadChars.includes(char)) continue

          // Always create a node at spawn point
          const isSpawn = char === 'S'
          const isJunction = isJunctionTile(x, y)
          const houseInfo = getAccessibleHouse(x, y)

          let nodeType = null
          if (isSpawn) {
            // Spawn point always gets a node (junction type by default)
            nodeType = houseInfo.hasHouse ? 'both' : 'junction'
          } else if (isJunction && houseInfo.hasHouse) {
            nodeType = 'both' // Special type for junction + house
          } else if (isJunction) {
            nodeType = 'junction'
          } else if (houseInfo.hasHouse) {
            nodeType = 'houseStop'
          }

          if (nodeType) {
            const node = { x, y, type: nodeType }
            this.nodes.push(node)
            nodeMap[`${x},${y}`] = node
          }
        }
      }

      // Second pass: Connect adjacent nodes with edges
      // For each node, trace along roads to find the next node
      const visited = new Set()

      const traceToNextNode = (startX, startY, dirX, dirY) => {
        let x = startX + dirX
        let y = startY + dirY

        // Follow the road until we hit another node or dead end
        while (isRoad(x, y)) {
          const key = `${x},${y}`
          if (nodeMap[key]) {
            // Found another node
            return { x, y }
          }

          // Find next direction (continue straight or turn)
          const neighbors = []
          if (isRoad(x - 1, y) && !(dirX === 1 && dirY === 0)) neighbors.push({ dx: -1, dy: 0 })
          if (isRoad(x + 1, y) && !(dirX === -1 && dirY === 0)) neighbors.push({ dx: 1, dy: 0 })
          if (isRoad(x, y - 1) && !(dirX === 0 && dirY === 1)) neighbors.push({ dx: 0, dy: -1 })
          if (isRoad(x, y + 1) && !(dirX === 0 && dirY === -1)) neighbors.push({ dx: 0, dy: 1 })

          if (neighbors.length === 0) break // Dead end
          if (neighbors.length > 1) break // Junction (shouldn't happen if nodes are correct)

          dirX = neighbors[0].dx
          dirY = neighbors[0].dy
          x += dirX
          y += dirY
        }

        return null
      }

      // For each node, check all 4 directions
      for (const node of this.nodes) {
        const directions = [
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 },
          { dx: 0, dy: -1 },
          { dx: 0, dy: 1 }
        ]

        for (const dir of directions) {
          const nextX = node.x + dir.dx
          const nextY = node.y + dir.dy

          if (!isRoad(nextX, nextY)) continue

          const result = traceToNextNode(node.x, node.y, dir.dx, dir.dy)
          if (result) {
            // Create edge (avoid duplicates by checking if reverse exists)
            const edgeKey = `${Math.min(node.x, result.x)},${Math.min(node.y, result.y)}-${Math.max(node.x, result.x)},${Math.max(node.y, result.y)}`
            if (!visited.has(edgeKey)) {
              visited.add(edgeKey)
              this.edges.push({
                from: { x: node.x, y: node.y },
                to: { x: result.x, y: result.y }
              })
            }
          }
        }
      }

      this.renderOverlay()
      const junctionCount = this.nodes.filter(n => n.type === 'junction').length
      const houseCount = this.nodes.filter(n => n.type === 'houseStop').length
      const bothCount = this.nodes.filter(n => n.type === 'both').length
      alert(`Generated ${this.nodes.length} nodes (${junctionCount} junctions, ${houseCount} house stops, ${bothCount} junction+house) and ${this.edges.length} edges`)
    },
    getSelectedTileName () {
      const allTiles = [...this.specialTiles, ...this.roadTiles, ...this.houseTiles, ...this.sceneryTiles]
      const tile = allTiles.find(t => t.char === this.selectedTile)
      return tile ? tile.name : ''
    },
    clearMap () {
      if (confirm('Clear the entire map?')) {
        this.initializeMap()
      }
    },
    loadMap () {
      try {
        this.loadError = ''
        const input = this.loadMapInput.trim()

        if (!input) {
          this.loadError = 'Please paste a map'
          return
        }

        // Split by lines and remove empty lines
        // Split off meta section if present
        const metaSplit = input.split('\n---META---\n')
        const mapPart = metaSplit[0]
        const metaPart = metaSplit[1]

        const lines = mapPart.split('\n').filter(line => line.length > 0)

        if (lines.length === 0) {
          this.loadError = 'Invalid map format'
          return
        }

        // Calculate dimensions
        const height = lines.length
        const width = lines[0].length

        // Validate all lines have the same width
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].length !== width) {
            this.loadError = `Line ${i + 1} has incorrect width (expected ${width}, got ${lines[i].length})`
            return
          }
        }

        // Load the map
        this.mapWidth = width
        this.mapHeight = height
        this.mapData = []

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            this.mapData.push(lines[y][x])
          }
        }

        // Load meta if present
        this.nodes = []
        this.edges = []
        if (metaPart) {
          try {
            const parsed = JSON.parse(metaPart)
            this.nodes = Array.isArray(parsed.nodes) ? parsed.nodes : []
            this.edges = Array.isArray(parsed.edges) ? parsed.edges : []
          } catch (e) {
            this.loadError = 'Meta section could not be parsed; ignoring.'
          }
        }

        // Render and close dialog
        this.updateCameraPosition()
        this.render3DMap()
        this.showLoadDialog = false
        this.loadMapInput = ''
      } catch (error) {
        this.loadError = 'Error loading map: ' + error.message
      }
    },
    testMap () {
      // Check for spawn point
      if (!this.mapData.includes('S')) {
        alert('Map must have at least one spawn point (S)!')
        return
      }

      // Convert map to string format
      const mapString = this.convertMapToString()

      // Add the map as a custom level
      this.$store.dispatch('testCustomMap', mapString)
    },
    saveMap () {
      // Check for spawn point
      if (!this.mapData.includes('S')) {
        alert('Map must have at least one spawn point (S)!')
        return
      }

      const mapString = this.convertMapToString()
      const meta = {
        nodes: this.nodes,
        edges: this.edges
      }

      // Download as text file
      const blob = new Blob([mapString + '\n---META---\n' + JSON.stringify(meta, null, 2)], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'custom-map.txt'
      a.click()
      URL.revokeObjectURL(url)

      alert('Map saved! You can add it to levels.txt')
    },
    convertMapToString () {
      let mapString = '\n'
      for (let y = 0; y < this.mapHeight; y++) {
        for (let x = 0; x < this.mapWidth; x++) {
          const index = y * this.mapWidth + x
          mapString += this.mapData[index]
        }
        mapString += '\n'
      }
      return mapString
    }
  }
}
</script>

<style lang="scss" scoped>
.map-editor {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #2d1b4e;
  color: #ddd;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-header {
  padding: 0.5rem 1rem;
  background-color: #1a0f2e;
  border-bottom: 2px solid #40408a;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;

  h2 {
    margin: 0;
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .editor-controls {
    display: flex;
    gap: 0.3rem;
    flex-shrink: 0;
  }

  .editor-info {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    flex: 1;
    min-width: 200px;

    span {
      &.divider {
        opacity: 0.3;
        margin: 0 0.2rem;
      }
    }

    .controls-hint {
      font-size: 0.7rem;
      opacity: 0.5;
      font-style: italic;
      margin-left: auto;
    }
  }
}

.editor-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.tile-palette {
  width: 320px;
  background-color: #1a0f2e;
  border-right: 2px solid #40408a;
  overflow-y: auto;
  padding: 0.75rem;

  h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.2rem;
  }

  h4 {
    margin: 0.75rem 0 0.3rem 0;
    font-size: 0.85rem;
    color: #fa0;
  }

  .palette-section {
    margin-bottom: 0.75rem;

    h4 {
      display: block;
      width: 100%;
    }
  }

  .palette-section > button {
    display: inline-flex;
  }

  .palette-tile {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    padding: 0.2rem;
    margin: 0.15rem;
    background-color: #2a2040;
    border: 2px solid #5050aa;
    border-radius: 0.25rem;
    cursor: pointer;
    text-align: center;
    transition: all 0.15s;
    font-family: 'Single Day', sans-serif;
    color: #ddd;

    &.wide {
      width: 100%;
      height: 60px;
      margin: 0.25rem 0;
    }

    .tile-char {
      font-size: 1.5rem;
      line-height: 1;
      margin-bottom: 0.1rem;
    }

    .tile-label {
      font-size: 0.5rem;
      line-height: 1.2;
      opacity: 0.7;
      white-space: normal;
      text-align: center;
      max-width: 100%;
    }

    &:hover {
      background-color: #3a3050;
      border-color: #6060ba;
      transform: scale(1.08);
    }

    &.selected {
      background-color: #fa0;
      border-color: #fc0;
      color: #1a0f2e;
      border-width: 3px;
      transform: scale(1.08);

      .tile-label {
        opacity: 1;
        font-weight: bold;
      }
    }
  }
}

.map-3d-container {
  flex: 1 1 auto;
  overflow: hidden;
  position: relative;
  background: linear-gradient(180deg, #5d3758 0%, #2d1b4e 100%);

  canvas {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }
}

.control {
  display: inline-block;
  padding: 0.4rem 0.8rem;
  margin: 0;
  cursor: pointer;
  text-align: center;
  font-size: 0.85rem;
  border-radius: 0.3rem;
  background-color: #40408a;
  color: #ddd;
  border: none;
  outline: none;
  font-family: Knewave, sans-serif;
  transition: all 0.15s;

  &:hover {
    background-color: #5050aa;
  }

  &:active {
    background-color: #ddd;
    color: #fa0;
  }

  &.small {
    padding: 0.3rem 0.5rem;
    font-size: 0.75rem;
  }
}

.direction-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
  font-size: 0.8rem;
  margin-left: 0.5rem;

  input[type="checkbox"] {
    cursor: pointer;
  }
}

.mode-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
  font-size: 0.75rem;
  margin-left: 0.5rem;
  padding: 0.3rem 0.5rem;
  border: 1px solid #5050aa;
  border-radius: 0.25rem;
  background-color: #2a2040;
  transition: all 0.15s;

  span {
    line-height: 1.1;
    text-align: center;
  }

  input[type="radio"] {
    cursor: pointer;
  }

  &:hover {
    background-color: #3a3050;
    border-color: #6060ba;
  }

  input[type="radio"]:checked + span {
    color: #fa0;
    font-weight: bold;
  }
}

.help-text {
  font-size: 0.75rem;
  opacity: 0.7;
  line-height: 1.3;
  margin: 0.5rem 0;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: #1a0f2e;
  border: 2px solid #40408a;
  border-radius: 0.5rem;
  padding: 1.5rem;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;

  h3 {
    margin: 0 0 1rem 0;
    font-size: 1.3rem;
    color: #fa0;
  }

  p {
    margin: 0.5rem 0;
    font-size: 0.9rem;
  }

  .map-input {
    width: 100%;
    min-height: 200px;
    padding: 0.5rem;
    background-color: #0a0514;
    color: #ddd;
    border: 1px solid #40408a;
    border-radius: 0.3rem;
    font-family: 'Courier New', monospace;
    font-size: 0.9rem;
    resize: vertical;
    margin: 0.5rem 0;

    &:focus {
      outline: none;
      border-color: #fa0;
    }
  }

  .modal-buttons {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
    justify-content: flex-end;
  }

  .error {
    color: #ff4444;
    font-size: 0.85rem;
    margin-top: 0.5rem;
    padding: 0.5rem;
    background-color: rgba(255, 0, 0, 0.1);
    border-radius: 0.3rem;
  }
}
</style>
