import Vue from 'vue'
import Vuex from 'vuex'
import { event } from 'vue-analytics'

Vue.use(Vuex)

const spliceSlice = (str, index, count, add) => {
  return str.slice(0, index) + add + str.slice(index + count)
}
// Uppercase house tiles (walkable/interactive houses)
// Include 'H' as a north-facing standalone house
const uppercaseHousesRegex = /[QWEDCXZAH]/gm

// Rotation values matching GameThree.vue directionMap
const FACING = {
  LEFT: 'left',
  UP: 'up',
  RIGHT: 'right',
  DOWN: 'down'
}

const turnLeft = (currentFacing) => {
  const turnMap = {
    [FACING.LEFT]: FACING.DOWN,
    [FACING.DOWN]: FACING.RIGHT,
    [FACING.RIGHT]: FACING.UP,
    [FACING.UP]: FACING.LEFT
  }
  return turnMap[currentFacing]
}

const turnRight = (currentFacing) => {
  const turnMap = {
    [FACING.LEFT]: FACING.UP,
    [FACING.UP]: FACING.RIGHT,
    [FACING.RIGHT]: FACING.DOWN,
    [FACING.DOWN]: FACING.LEFT
  }
  return turnMap[currentFacing]
}

// Direction vectors for graph navigation
const DIR_VECS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 }
}

// Pick the immediate forward neighbor index along the current facing axis
// Chooses the closest neighbor in the facing direction, aligned to the axis
function getForwardNeighborIdx (state, fromIdx, facing) {
  const dirVec = DIR_VECS[facing]
  const cur = state.pathNodes[fromIdx]
  const neighbors = Array.from(state.pathAdjacency[fromIdx] || [])
  let nextIdx = null
  let bestDist = Infinity
  neighbors.forEach((nIdx) => {
    const n = state.pathNodes[nIdx]
    const dx = n.x - cur.x
    const dy = n.y - cur.y
    if (dirVec.dx !== 0) {
      if (dy === 0 && Math.sign(dx) === dirVec.dx) {
        const d = Math.abs(dx)
        if (d > 0 && d < bestDist) { bestDist = d; nextIdx = nIdx }
      }
    } else {
      if (dx === 0 && Math.sign(dy) === dirVec.dy) {
        const d = Math.abs(dy)
        if (d > 0 && d < bestDist) { bestDist = d; nextIdx = nIdx }
      }
    }
  })
  return nextIdx
}

// Detect if a perpendicular branch is available at a node for the given facing
function hasPerpendicularBranch (state, atIdx, facing) {
  const dirVec = DIR_VECS[facing]
  const cur = state.pathNodes[atIdx]
  const neighbors = Array.from(state.pathAdjacency[atIdx] || [])
  let hasBranch = false
  neighbors.forEach((nIdx) => {
    const n = state.pathNodes[nIdx]
    const dx = n.x - cur.x
    const dy = n.y - cur.y
    // Opposite/back neighbor
    const isBack = (dirVec.dx !== 0 && Math.sign(dx) === -dirVec.dx && dy === 0) || (dirVec.dy !== 0 && Math.sign(dy) === -dirVec.dy && dx === 0)
    if (isBack) return
    // Perpendicular neighbor if axis switches
    if (dirVec.dx !== 0 && dx === 0 && dy !== 0) hasBranch = true
    if (dirVec.dy !== 0 && dy === 0 && dx !== 0) hasBranch = true
  })
  return hasBranch
}

// Coordinate/Index helpers that correctly account for newlines between rows
// width = xMax (number of columns), rowStride = width + 1 (includes newline)
const toIndex = (x, y, xMax) => {
  const rowStride = xMax + 1
  return 1 + (y * rowStride) + x
}
const fromIndex = (index, xMax) => {
  const rowStride = xMax + 1
  const i = index - 1
  const y = Math.floor(i / rowStride)
  const x = i % rowStride
  return { x, y }
}

const getNextPosition = (x, y, xMax, yMax, direction) => {
  let newX = x
  let newY = y
  if (direction === 'up') { newY = Math.max(y - 1, 0) }
  if (direction === 'down') { newY = Math.min(y + 1, yMax) }
  if (direction === 'left') { newX = Math.max(x - 1, 0) }
  if (direction === 'right') { newX = Math.min(x + 1, xMax) }
  return { x: newX, y: newY }
}

const canMoveInDirection = (map, x, y, xMax, direction, roadTiles) => {
  const yMax = (map.match(/\n/g) || []).length - 1
  const next = getNextPosition(x, y, xMax, yMax, direction)
  if (next.x === x && next.y === y) return false // Hit boundary
  const nextIndex = toIndex(next.x, next.y, xMax)
  const charAtNext = map.charAt(nextIndex)
  // Movement is allowed only onto road tiles or exit
  return roadTiles.includes(charAtNext) || charAtNext === '!'
}

const isJunction = (map, x, y, xMax, currentDirection, roadTiles) => {
  // A junction is where we can turn (perpendicular directions are available)
  const perpendicular = {
    'up': ['left', 'right'],
    'down': ['left', 'right'],
    'left': ['up', 'down'],
    'right': ['up', 'down']
  }
  const perpendicularDirs = perpendicular[currentDirection] || []
  return perpendicularDirs.some(dir => canMoveInDirection(map, x, y, xMax, dir, roadTiles))
}

const canCollectFromHouse = (houseChar, playerDirection) => {
  // Map of which directions each house type faces
  // Player can only collect candy if approaching from a direction the house faces
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

  const houseFacings = houseFacingMap[houseChar] || []
  return houseFacings.includes(playerDirection)
}

// Check if player is adjacent to a house they can interact with
// A house is interactable when the player stands on the street tile that is in one of the
// house's facing directions (house -> player direction). Additionally, require that the
// player is looking toward the house (player -> house direction) to confirm intent.
const getAdjacentInteractableHouse = (map, x, y, xMax, playerFacing) => {
  const yMax = (map.match(/\n/g) || []).length - 1
  const dirs = [
    { name: 'up', dx: 0, dy: -1 },
    { name: 'down', dx: 0, dy: 1 },
    { name: 'left', dx: -1, dy: 0 },
    { name: 'right', dx: 1, dy: 0 }
  ]
  const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' }

  for (const d of dirs) {
    const nx = Math.min(Math.max(x + d.dx, 0), xMax)
    const ny = Math.min(Math.max(y + d.dy, 0), yMax)
    const nIndex = toIndex(nx, ny, xMax)
    const nChar = map.charAt(nIndex)
    if (nChar && nChar.match(uppercaseHousesRegex)) {
      // Direction from house to player is the opposite of d
      const houseToPlayer = opposite[d.name]
      // Player must be on a tile that the house faces
      const okByHouseFacing = canCollectFromHouse(nChar, houseToPlayer)
      // And the player must be facing toward the house
      const okByPlayerFacing = playerFacing === d.name
      if (okByHouseFacing && okByPlayerFacing) {
        return { houseChar: nChar, houseIndex: nIndex }
      }
    }
  }
  return null
}

const changeStateByDirection = (state, direction) => {
  const mapLast = state.map
  const xMax = mapLast.indexOf('\n', 1) - 1
  const yMax = (mapLast.match(/\n/g) || []).length - 1
  const gIndexLast = mapLast.indexOf('G', 1)
  const { x: xLast, y: yLast } = fromIndex(gIndexLast, xMax)
  let x = xLast
  let y = yLast
  if (direction === 'up') { y = Math.max(y - 1, 0) }
  if (direction === 'down') { y = Math.min(y + 1, yMax) }
  if (direction === 'left') { x = Math.max(x - 1, 0) }
  if (direction === 'right') { x = Math.min(x + 1, xMax) }
  const newIndex = toIndex(x, y, xMax)
  let gIndex = gIndexLast
  let moves = state.moves
  let score = state.score
  let map = mapLast
  const charAtNewIndex = mapLast.charAt(newIndex)
  if (state.roadTiles.includes(charAtNewIndex)) {
    gIndex = newIndex
    const lastCharAtSpace = state.levels[state.currentLevel].charAt(gIndexLast)
    map = spliceSlice(map, gIndexLast, 1, lastCharAtSpace)
    map = spliceSlice(map, gIndex, 1, 'G')
  }
  // Collect candy when adjacent to a house in the correct facing direction
  if (state.charAtNewIndex && state.charAtNewIndex.match(uppercaseHousesRegex)) {
    const houseChar = state.charAtNewIndex
    const canCollect = canCollectFromHouse(houseChar, direction)
    if (canCollect) {
      score += 1
      const houseIndex = newIndex
      map = spliceSlice(map, houseIndex, 1, houseChar.toLocaleLowerCase())
    }
  }
  if (
    gIndex !== gIndexLast ||
    score !== state.score
  ) {
    moves += 1
  }
  return {
    charAtNewIndex,
    gIndexLast,
    newIndex,
    yLast,
    xLast,
    x,
    y,
    moves,
    score,
    map
  }
}
let totalWinCount = 0
export default new Vuex.Store({
  state: {
    charAtNewIndex: null,
    lastDirection: null,
    facing: FACING.LEFT, // Ghost starts facing left
    moves: 0,
    score: 0,
    levels: [],
    levelMeta: [], // [{ nodes: [{x,y}], edges: [{from:{x,y}, to:{x,y}}] }]
    pathNodes: [],
    pathEdges: [],
    pathAdjacency: {}, // nodeIdx -> Set<nodeIdx>
    currentNodeIdx: null,
    roadTiles: [],
    mode: 'lobby',
    modePrevious: 'lobby',
    character: null,
    currentLevel: null,
    map: null,
    candyHouseIndex: null, // Index of the single house that has candy
    overlayActive: false,
    overlayType: null, // 'success' | 'fail'
    overlayMessage: null,
    lastInteractedHouseIndex: null, // Track last house interacted with to prevent double-clicking
    // Multiplayer state
    multiplayer: {
      isMultiplayer: false,
      isHost: false,
      playerId: null,
      roomCode: null,
      playerName: null,
      playerRole: null, // 'player' or 'guide'
      otherPlayerName: null,
      otherPlayerRole: null,
      webrtcConnected: false,
      roomData: null,
      activePlayerCharacter: null, // Character of whoever has 'player' role this round
      otherPlayerWasConnected: false, // Track if other player was previously connected
      webrtcConnectedAt: null // Track when WebRTC connected for grace period
    }
  },
  getters: {
    score: state => {
      return state.score
    },
    moves: state => {
      return state.moves
    },
    map: state => {
      return state.map
    },
    mode: state => {
      return state.mode
    },
    modePrevious: state => {
      return state.modePrevious
    },
    character: state => {
      return state.character
    },
    levels: state => {
      return state.levels
    },
    levelMeta: state => state.levelMeta,
    currentLevel: state => {
      return state.currentLevel
    },
    candyHouseIndex: state => {
      return state.candyHouseIndex
    },
    lastDirection: state => {
      return state.lastDirection
    },
    facing: state => {
      return state.facing
    },
    // Multiplayer getters
    isMultiplayer: state => {
      return state.multiplayer.isMultiplayer
    },
    isHost: state => {
      return state.multiplayer.isHost
    },
    playerRole: state => {
      return state.multiplayer.playerRole
    },
    isPlayer: state => {
      return state.multiplayer.playerRole === 'player'
    },
    isGuide: state => {
      return state.multiplayer.playerRole === 'guide'
    },
    webrtcConnected: state => {
      return state.multiplayer.webrtcConnected
    },
    roomData: state => {
      return state.multiplayer.roomData
    },
    playerId: state => {
      return state.multiplayer.playerId
    },
    activePlayerCharacter: state => {
      return state.multiplayer.activePlayerCharacter
    },
    overlayActive: state => state.overlayActive,
    overlayType: state => state.overlayType,
    overlayMessage: state => state.overlayMessage,
    canTrickOrTreat: state => {
      // Check if player is facing a house they can interact with
      if (!state.map || state.overlayActive) return false
      
      const gIndex = state.map.indexOf('G', 1)
      if (gIndex < 0) return false
      
      const xMax = state.map.indexOf('\n', 1) - 1
      const { x, y } = fromIndex(gIndex, xMax)
      const house = getAdjacentInteractableHouse(state.map, x, y, xMax, state.facing)
      
      // Don't show button if no house or if it's the same house we just interacted with
      if (!house) return false
      if (house.houseIndex === state.lastInteractedHouseIndex) return false
      
      return true
    }
  },
  mutations: {
    setLevels (state, payload) {
      state.roadTiles = payload.roadTiles
      state.levels = payload.levels
      state.levelMeta = payload.levelMeta || []
    },
    startLevel (state, payload) {
      // payload can be a number (level index) or an object { level, candyHouseIndex, keepScore }
      const levelIndex = typeof payload === 'object' ? payload.level : payload
      const providedCandyIndex = typeof payload === 'object' ? payload.candyHouseIndex : null
      const keepScore = typeof payload === 'object' ? payload.keepScore : false
      
      state.currentLevel = levelIndex
      state.map = state.levels.length ? state.levels[state.currentLevel].replace('S', 'G') : null
      
      // Only reset score if not keeping it (for role switches, we keep the score)
      if (!keepScore) {
        state.score = 0
      }
      
      state.moves = 0
      state.facing = FACING.LEFT // Reset facing to left at start
      state.lastInteractedHouseIndex = null // Reset interaction tracking

      // Pick ONE random house to have candy
      // In multiplayer, only pick if not provided (i.e., only the player/host picks)
      if (state.map) {
        if (providedCandyIndex !== null && providedCandyIndex !== undefined) {
          // Use the provided candy house index (synced from other player)
          state.candyHouseIndex = providedCandyIndex
          console.log('🍬 Candy house synced from other player:', providedCandyIndex)
        } else {
          // Pick a random house
          const houses = state.map.match(uppercaseHousesRegex)
          if (houses && houses.length > 0) {
            const randomHouseNum = Math.floor(Math.random() * houses.length)
            // Find the index of the Nth house in the map
            let houseCount = 0
            for (let i = 0; i < state.map.length; i++) {
              if (state.map[i].match(uppercaseHousesRegex)) {
                if (houseCount === randomHouseNum) {
                  // Store the STRING index (includes newlines) for rendering
                  state.candyHouseIndex = i
                  const xMax = state.map.indexOf('\n', 1) - 1
                  const { x, y } = fromIndex(i, xMax)
                  console.log('🍬 Candy house selected:')
                  console.log('  stringIndex:', i)
                  console.log('  position:', { x, y })
                  console.log('  char:', state.map[i])
                  console.log('  houseNumber:', randomHouseNum, 'of', houses.length)
                  break
                }
                houseCount++
              }
            }
          } else {
            state.candyHouseIndex = null
          }
        }
      }

      // Load path meta for this level (use levelIndex, not payload)
      const meta = state.levelMeta[levelIndex] || { nodes: [], edges: [] }
      state.pathNodes = Array.isArray(meta.nodes) ? meta.nodes : []
      state.pathEdges = Array.isArray(meta.edges) ? meta.edges : []
      // Build adjacency and index map
      const coordToIndex = {}
      state.pathNodes.forEach((n, i) => { coordToIndex[`${n.x},${n.y}`] = i })
      const adj = {}
      const addEdge = (a, b) => {
        if (a === undefined || b === undefined) return
        if (!adj[a]) adj[a] = new Set()
        if (!adj[b]) adj[b] = new Set()
        adj[a].add(b)
        adj[b].add(a)
      }
      state.pathEdges.forEach(e => {
        const a = coordToIndex[`${e.from.x},${e.from.y}`]
        const b = coordToIndex[`${e.to.x},${e.to.y}`]
        addEdge(a, b)
      })
      state.pathAdjacency = adj
      // Find current node under G
      if (state.map) {
        const xMax = state.map.indexOf('\n', 1) - 1
        const gIndex = state.map.indexOf('G', 1)
        if (gIndex > 0) {
          const { x, y } = fromIndex(gIndex, xMax)
          const nodeIdx = coordToIndex[`${x},${y}`]
          state.currentNodeIdx = Number.isInteger(nodeIdx) ? nodeIdx : null
          console.log('Level loaded. Spawn at:', x, y, 'Node index:', state.currentNodeIdx, 'Total nodes:', state.pathNodes.length, 'Total edges:', state.pathEdges.length)
          if (state.currentNodeIdx === null) {
            console.warn('⚠️ No node found at spawn point! Graph navigation will not work.')
          }
        } else {
          state.currentNodeIdx = null
        }
      }
    },
    mode (state, payload) {
      state.modePrevious = state.mode
      state.mode = payload
    },
    selectCharacter (state, payload) {
      state.character = payload
    },
    // Multiplayer mutations
    setMultiplayerInfo (state, payload) {
      state.multiplayer.isMultiplayer = payload.isMultiplayer
      state.multiplayer.isHost = payload.isHost
      state.multiplayer.playerId = payload.playerId
      state.multiplayer.roomCode = payload.roomCode
      state.multiplayer.playerName = payload.playerName
      if (payload.activePlayerCharacter !== undefined) {
        state.multiplayer.activePlayerCharacter = payload.activePlayerCharacter
      }
    },
    setPlayerRole (state, role) {
      state.multiplayer.playerRole = role
    },
    setWebRTCConnected (state, connected) {
      state.multiplayer.webrtcConnected = connected
      if (connected) {
        state.multiplayer.webrtcConnectedAt = Date.now()
      } else {
        state.multiplayer.webrtcConnectedAt = null
      }
    },
    setOtherPlayerConnected (state, connected) {
      state.multiplayer.otherPlayerWasConnected = connected
    },
    updateMultiplayerRoom (state, roomData) {
      state.multiplayer.roomData = roomData

      // Update other player info
      const otherPlayerId = state.multiplayer.playerId === 'player1' ? 'player2' : 'player1'
      if (roomData.players && roomData.players[otherPlayerId]) {
        state.multiplayer.otherPlayerName = roomData.players[otherPlayerId].name
        state.multiplayer.otherPlayerRole = roomData.players[otherPlayerId].role
      }
    },
    syncGameState (state, gameState) {
      // Sync game state from other player (guide receives updates from player)
      if (gameState.map !== undefined) state.map = gameState.map
      if (gameState.score !== undefined) state.score = gameState.score
      if (gameState.moves !== undefined) state.moves = gameState.moves
      if (gameState.facing !== undefined) state.facing = gameState.facing
      if (gameState.lastDirection !== undefined) state.lastDirection = gameState.lastDirection
      if (gameState.charAtNewIndex !== undefined) state.charAtNewIndex = gameState.charAtNewIndex
      if (gameState.candyHouseIndex !== undefined) {
        console.log('🔄 Syncing candyHouseIndex:', gameState.candyHouseIndex, 'was:', state.candyHouseIndex)
        state.candyHouseIndex = gameState.candyHouseIndex
      }
      if (gameState.activePlayerCharacter !== undefined) state.multiplayer.activePlayerCharacter = gameState.activePlayerCharacter
    },
    resetMultiplayer (state) {
      state.multiplayer = {
        isMultiplayer: false,
        isHost: false,
        playerId: null,
        roomCode: null,
        playerName: null,
        playerRole: null,
        otherPlayerName: null,
        otherPlayerRole: null,
        webrtcConnected: false,
        roomData: null,
        activePlayerCharacter: null,
        otherPlayerWasConnected: false,
        webrtcConnectedAt: null
      }
    },
    setOverlay (state, payload) {
      state.overlayActive = !!payload.active
      state.overlayType = payload.type || null
      state.overlayMessage = payload.message || null
    },
    move (state, payload) {
      // Graph-based step: move from current node to adjacent node in the desired direction if available
      if (state.overlayActive) return
      const direction = payload
      const xMax = state.map.indexOf('\n', 1) - 1
      if (!Number.isInteger(state.currentNodeIdx) || !state.pathNodes[state.currentNodeIdx]) {
        // Fallback to old logic if graph not present
        const newState = changeStateByDirection(state, direction)
        state.lastDirection = direction
        state.map = newState.map
        state.score = newState.score
        state.moves = newState.moves
        state.charAtNewIndex = newState.charAtNewIndex
      } else {
        const cur = state.pathNodes[state.currentNodeIdx]
        const neighbors = Array.from(state.pathAdjacency[state.currentNodeIdx] || [])
        const dirVec = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } }[direction]
        let nextIdx = null
        let bestDist = Infinity
        neighbors.forEach(nIdx => {
          const n = state.pathNodes[nIdx]
          const dx = n.x - cur.x
          const dy = n.y - cur.y
          if (dirVec.dx !== 0) {
            if (dy === 0 && Math.sign(dx) === dirVec.dx) {
              const d = Math.abs(dx)
              if (d > 0 && d < bestDist) { bestDist = d; nextIdx = nIdx }
            }
          } else {
            if (dx === 0 && Math.sign(dy) === dirVec.dy) {
              const d = Math.abs(dy)
              if (d > 0 && d < bestDist) { bestDist = d; nextIdx = nIdx }
            }
          }
        })
        if (nextIdx !== null) {
          const newIndex = toIndex(state.pathNodes[nextIdx].x, state.pathNodes[nextIdx].y, xMax)
          const gIndexLast = state.map.indexOf('G', 1)
          const lastCharAtSpace = state.levels[state.currentLevel].charAt(gIndexLast)
          const newMap = spliceSlice(spliceSlice(state.map, gIndexLast, 1, lastCharAtSpace), newIndex, 1, 'G')
          state.map = newMap
          // moves removed
          state.lastDirection = direction
          state.facing = direction
          state.currentNodeIdx = nextIdx
        } else {
          // No neighbor in that direction; count attempt
          state.moves += 1
        }
      }
      // Broadcast to other player if multiplayer
      if (state.multiplayer.isMultiplayer && state.multiplayer.webrtcConnected) {
        const webrtcService = require('./services/webrtcService').default
        const updateData = {
          map: state.map,
          score: state.score,
          facing: state.facing,
          candyHouseIndex: state.candyHouseIndex,
          activePlayerCharacter: state.multiplayer.activePlayerCharacter
        }
        console.log('Sending game state (move):', updateData)
        webrtcService.sendGameState(updateData)
      }
    },
    turnLeftMutation (state) {
      if (state.overlayActive) return
      state.facing = turnLeft(state.facing)
      state.lastDirection = state.facing
      state.moves += 1
      // Reset last interacted house when turning
      state.lastInteractedHouseIndex = null

      // Broadcast to other player if multiplayer
      if (state.multiplayer.isMultiplayer && state.multiplayer.webrtcConnected) {
        const webrtcService = require('./services/webrtcService').default
        const updateData = {
          facing: state.facing,
          lastDirection: state.lastDirection,
          map: state.map,
          score: state.score,
          candyHouseIndex: state.candyHouseIndex,
          activePlayerCharacter: state.multiplayer.activePlayerCharacter
        }
        console.log('Sending game state (turn left):', updateData)
        webrtcService.sendGameState(updateData)
      }
    },
    turnRightMutation (state) {
      if (state.overlayActive) return
      state.facing = turnRight(state.facing)
      state.lastDirection = state.facing
      state.moves += 1
      // Reset last interacted house when turning
      state.lastInteractedHouseIndex = null

      // Broadcast to other player if multiplayer
      if (state.multiplayer.isMultiplayer && state.multiplayer.webrtcConnected) {
        const webrtcService = require('./services/webrtcService').default
        const updateData = {
          facing: state.facing,
          lastDirection: state.lastDirection,
          map: state.map,
          score: state.score,
          candyHouseIndex: state.candyHouseIndex,
          activePlayerCharacter: state.multiplayer.activePlayerCharacter
        }
        console.log('Sending game state (turn right):', updateData)
        webrtcService.sendGameState(updateData)
      }
    },
    moveForward (state) {
      if (state.overlayActive) return
      // Go straight until junction (or both) node, walking only forward neighbors
      if (Number.isInteger(state.currentNodeIdx) && state.pathNodes[state.currentNodeIdx]) {
        const xMax = state.map.indexOf('\n', 1) - 1
        let curIdx = state.currentNodeIdx
        let movedAny = false
        while (true) {
          const forwardIdx = getForwardNeighborIdx(state, curIdx, state.facing)
          if (forwardIdx === null) break
          const newIndex = toIndex(state.pathNodes[forwardIdx].x, state.pathNodes[forwardIdx].y, xMax)
          const gIndexLast = state.map.indexOf('G', 1)
          const lastCharAtSpace = state.levels[state.currentLevel].charAt(gIndexLast)
          state.map = spliceSlice(spliceSlice(state.map, gIndexLast, 1, lastCharAtSpace), newIndex, 1, 'G')
          state.moves += 1
          movedAny = true
          curIdx = forwardIdx
          const nextNode = state.pathNodes[curIdx]
          if (nextNode.type === 'junction' || nextNode.type === 'both') break
          if (hasPerpendicularBranch(state, curIdx, state.facing)) break
        }
        state.currentNodeIdx = curIdx
        if (!movedAny) state.moves += 1
        if (state.multiplayer.isMultiplayer && state.multiplayer.webrtcConnected) {
          const webrtcService = require('./services/webrtcService').default
          webrtcService.sendGameState({
            map: state.map,
            score: state.score,
            facing: state.facing,
            candyHouseIndex: state.candyHouseIndex,
            activePlayerCharacter: state.multiplayer.activePlayerCharacter
          })
        }
        return
      }
      const mapLast = state.map
      const xMax = mapLast.indexOf('\n', 1) - 1
      const gIndexLast = mapLast.indexOf('G', 1)
      const yLast = Math.floor((gIndexLast - 1) / (xMax + 1))
      const xLast = (gIndexLast - yLast) % xMax

      let currentX = xLast
      let currentY = yLast

      // Keep moving forward until we hit a junction or can't move anymore
      while (canMoveInDirection(state.map, currentX, currentY, xMax, state.facing, state.roadTiles)) {
        // Move one step
        const newState = changeStateByDirection(state, state.facing)
        state.lastDirection = state.facing
        state.map = newState.map
        state.score = newState.score
        state.moves = newState.moves
        state.charAtNewIndex = newState.charAtNewIndex

        // Update current position for next iteration
        const newGIndex = state.map.indexOf('G', 1)
        const { x: newX, y: newY } = fromIndex(newGIndex, xMax)

        // Check if we've reached a junction
        if (isJunction(state.map, newX, newY, xMax, state.facing, state.roadTiles)) {
          break
        }

        currentX = newX
        currentY = newY
      }

      // moves removed

      // Broadcast to other player if multiplayer
      if (state.multiplayer.isMultiplayer && state.multiplayer.webrtcConnected) {
        const webrtcService = require('./services/webrtcService').default
        const updateData = {
          map: state.map,
          score: state.score,
          facing: state.facing,
          lastDirection: state.lastDirection,
          charAtNewIndex: state.charAtNewIndex,
          candyHouseIndex: state.candyHouseIndex,
          activePlayerCharacter: state.multiplayer.activePlayerCharacter
        }
        console.log('Sending game state (move forward):', updateData)
        webrtcService.sendGameState(updateData)
      }
    },
    shortForward (state) {
      // Go short until houseStop (or both) before first junction. If multiple houses before junction,
      // prefer the one adjacent to the candy house.
      if (state.overlayActive) return
      if (Number.isInteger(state.currentNodeIdx) && state.pathNodes[state.currentNodeIdx]) {
        const xMax = state.map.indexOf('\n', 1) - 1
        const candyIdx = state.candyHouseIndex
        // Scan forward nodes until a junction (inclusive), collect house stops
        let scanIdx = state.currentNodeIdx
        let targetIdx = null
        let firstHouseIdx = null
        while (true) {
          const forwardIdx = getForwardNeighborIdx(state, scanIdx, state.facing)
          if (forwardIdx === null) break
          const node = state.pathNodes[forwardIdx]
          // Stop scanning at first junction (do not pass it)
          if (node.type === 'junction') {
            break
          }
          // Record first house
          if ((node.type === 'houseStop' || node.type === 'both') && firstHouseIdx === null) {
            firstHouseIdx = forwardIdx
          }
          // Check if this houseStop is adjacent to the candy house tile
          if (node.type === 'houseStop' || node.type === 'both') {
            const x = node.x
            const y = node.y
            const neighbors = [
              { nx: x - 1, ny: y },
              { nx: x + 1, ny: y },
              { nx: x, ny: y - 1 },
              { nx: x, ny: y + 1 }
            ]
            for (const { nx, ny } of neighbors) {
              // Validate ny within [0, yMax] and nx within [0, xMax]
              const yMax = (state.map.match(/\n/g) || []).length - 1
              if (nx >= 0 && nx <= xMax && ny >= 0 && ny <= yMax) {
                const houseIndex = toIndex(nx, ny, xMax)
                if (houseIndex === candyIdx) {
                  targetIdx = forwardIdx
                  break
                }
              }
            }
            if (targetIdx !== null) break
          }
          scanIdx = forwardIdx
        }
        // Choose candy target if found; else first house if any; else don't move
        if (targetIdx === null) targetIdx = firstHouseIdx
        if (targetIdx !== null) {
          let curIdx = state.currentNodeIdx
          let movedAny = false
          while (curIdx !== targetIdx) {
            const stepIdx = getForwardNeighborIdx(state, curIdx, state.facing)
            if (stepIdx === null) break
            const newIndex = toIndex(state.pathNodes[stepIdx].x, state.pathNodes[stepIdx].y, xMax)
            const gIndexLast = state.map.indexOf('G', 1)
            const lastCharAtSpace = state.levels[state.currentLevel].charAt(gIndexLast)
            state.map = spliceSlice(spliceSlice(state.map, gIndexLast, 1, lastCharAtSpace), newIndex, 1, 'G')
            state.moves += 1
            movedAny = true
            curIdx = stepIdx
          }
          state.currentNodeIdx = curIdx
          if (!movedAny) { /* moves removed */ }
        } else {
          // No valid house before a junction – no-op
        }
        if (state.multiplayer.isMultiplayer && state.multiplayer.webrtcConnected) {
          const webrtcService = require('./services/webrtcService').default
          webrtcService.sendGameState({
            map: state.map,
            score: state.score,
            facing: state.facing,
            candyHouseIndex: state.candyHouseIndex,
            activePlayerCharacter: state.multiplayer.activePlayerCharacter
          })
        }
        return
      }

      // Fallback to old logic if graph not present
      const mapLast = state.map
      const xMax = mapLast.indexOf('\n', 1) - 1
      const yMax = (mapLast.match(/\n/g) || []).length - 1
      const gIndexLast = mapLast.indexOf('G', 1)
      const yLast = Math.floor((gIndexLast - 1) / (xMax + 1))
      const xLast = (gIndexLast - yLast) % xMax

      let currentX = xLast
      let currentY = yLast
      let moved = false

      // Helper to check if there's a house adjacent (left or right)
      const hasAdjacentHouse = (x, y) => {
        const leftOrRight = state.facing === 'up' || state.facing === 'down'
          ? ['left', 'right']
          : ['up', 'down']

        for (const dir of leftOrRight) {
          const next = getNextPosition(x, y, xMax, yMax, dir)
          const nextIndex = toIndex(next.x, next.y, xMax)
          const charAtNext = state.map.charAt(nextIndex)
          if (charAtNext.match(uppercaseHousesRegex) || charAtNext.match(/[qwedcxzah]/i)) {
            return true
          }
        }
        return false
      }

      // Keep moving forward until we find a house adjacent or can't move
      while (canMoveInDirection(state.map, currentX, currentY, xMax, state.facing, state.roadTiles)) {
        // Move one step
        const newState = changeStateByDirection(state, state.facing)
        state.lastDirection = state.facing
        state.map = newState.map
        state.score = newState.score
        state.moves = newState.moves
        state.charAtNewIndex = newState.charAtNewIndex
        moved = true

        // Update current position
        const newGIndex = state.map.indexOf('G', 1)
        const { x: newX, y: newY } = fromIndex(newGIndex, xMax)

        // Check if there's a house to our left or right
        if (hasAdjacentHouse(newX, newY)) {
          break
        }

        currentX = newX
        currentY = newY
      }

      // If we didn't move at all, still count it as a move attempt
      if (!moved) { /* moves removed */ }

      // Broadcast to other player if multiplayer
      if (state.multiplayer.isMultiplayer && state.multiplayer.webrtcConnected) {
        const webrtcService = require('./services/webrtcService').default
        const updateData = {
          map: state.map,
          score: state.score,
          facing: state.facing,
          lastDirection: state.lastDirection,
          charAtNewIndex: state.charAtNewIndex,
          candyHouseIndex: state.candyHouseIndex,
          activePlayerCharacter: state.multiplayer.activePlayerCharacter
        }
        console.log('Sending game state (short forward):', updateData)
        webrtcService.sendGameState(updateData)
      }
    }
  },
  actions: {
    async loadLevels ({ dispatch }) {
      const result = await fetch('./levels.txt')
      // Normalize Windows CRLF to LF to keep coordinate math correct
      const levelText = (await result.text()).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      let levelSplit = levelText.split('\n\n')
      const roadTiles = [...levelSplit.shift()]
      const levels = []
      const levelMeta = []

      levelSplit.forEach((block) => {
        // Skip empty blocks
        if (!block.trim()) return

        // Check if this block starts with ---META--- (orphaned metadata)
        if (block.trim().startsWith('---META---')) {
          // This is metadata for the previous level
          if (levels.length > 0) {
            try {
              const metaContent = block.split('---META---')[1].trim()
              const parsed = JSON.parse(metaContent)
              levelMeta[levelMeta.length - 1] = parsed
            } catch (e) {
              console.error('Failed to parse orphaned metadata:', e)
            }
          }
          return
        }

        // Split block into map and metadata
        const parts = block.split('\n---META---\n')
        const mapPart = parts[0].trim()
        const metaPart = parts[1]

        // Only add non-empty maps
        if (mapPart.trim()) {
          // Ensure consistent single leading newline and trimmed map content
          levels.push('\n' + mapPart)

          if (metaPart) {
            try {
              levelMeta.push(JSON.parse(metaPart))
            } catch (e) {
              console.error('Failed to parse metadata:', e)
              levelMeta.push({ nodes: [], edges: [] })
            }
          } else {
            levelMeta.push({ nodes: [], edges: [] })
          }
        }
      })

      console.log('📦 Loaded levels:', levels.length, 'levels with', levelMeta.length, 'metadata entries')
      levelMeta.forEach((meta, i) => {
        console.log(`Level ${i}: ${meta.nodes ? meta.nodes.length : 0} nodes, ${meta.edges ? meta.edges.length : 0} edges`)
      })

      dispatch(
        'setLevels',
        {
          roadTiles,
          levels,
          levelMeta
        }
      )
    },
    setLevels ({ commit }, payload) {
      commit('setLevels', payload)
    },
    setMultiplayerMode ({ commit }, isMultiplayer) {
      if (!isMultiplayer) {
        commit('resetMultiplayer')
      }
    },
    selectCharacter ({ state, commit }, payload) {
      commit('selectCharacter', payload)
      // Only auto-start level in single player mode
      if (!state.multiplayer.isMultiplayer) {
        commit('startLevel', 0)
        commit('mode', 'play')
      }
      event('interaction', 'selectCharacter', payload, null)
    },
    startLevel ({ state, commit }, payload) {
      commit('startLevel', payload)
      commit('mode', 'play')
      event('interaction', 'startLevel', null, state.currentLevel)
    },
    mode ({ state, commit }, payload) {
      commit('mode', payload)
      event('interaction', 'mode', payload, null)
    },
    nextLevel ({ state, commit }) {
      const nextLevel = (state.currentLevel + 1) % state.levels.length
      commit('startLevel', nextLevel)
      commit('mode', 'play')
      event('interaction', 'nextLevel', null, state.currentLevel)
    },
    move ({ state, commit }, payload) {
      // Only allow moves if player has control
      if (state.multiplayer.isMultiplayer && state.multiplayer.playerRole !== 'player') {
        return
      }

      commit('move', payload)
      const win = !state.map.match(uppercaseHousesRegex)
      const earlyExit = state.charAtNewIndex === '!'
      if (win || earlyExit) {
        totalWinCount += 1
        event(
          'interaction',
          'win',
          `currentLevel: ${state.currentLevel}, score: ${state.score}, moves: ${state.moves}`,
          totalWinCount
        )
        event(
          'interaction',
          'winMap',
          state.map,
          win ? 1 : 0
        )
        setTimeout(
          () => {
            commit('mode', 'levelWin')

            // In multiplayer, send win notification via WebRTC (no Firebase)
            if (state.multiplayer.isMultiplayer && state.multiplayer.webrtcConnected) {
              const webrtcService = require('./services/webrtcService').default
              webrtcService.sendGameState({
                type: 'levelWin',
                map: state.map,
                score: state.score,
                facing: state.facing,
                candyHouseIndex: state.candyHouseIndex,
                activePlayerCharacter: state.multiplayer.activePlayerCharacter
              })
            }
          },
          200
        )
      }
    },
    turnLeftAction ({ state, commit }) {
      // Only allow turns if player has control
      if (state.multiplayer.isMultiplayer && state.multiplayer.playerRole !== 'player') {
        return
      }

      commit('turnLeftMutation')
      event('interaction', 'turnLeft', state.facing, null)
    },
    turnRightAction ({ state, commit }) {
      // Only allow turns if player has control
      if (state.multiplayer.isMultiplayer && state.multiplayer.playerRole !== 'player') {
        return
      }

      commit('turnRightMutation')
      event('interaction', 'turnRight', state.facing, null)
    },
    forward ({ state, commit }) {
      // Only allow forward if player has control
      if (state.multiplayer.isMultiplayer && state.multiplayer.playerRole !== 'player') {
        return
      }

      commit('moveForward')
      const win = !state.map.match(uppercaseHousesRegex)
      const earlyExit = state.charAtNewIndex === '!'
      if (win || earlyExit) {
        totalWinCount += 1
        event(
          'interaction',
          'win',
          `currentLevel: ${state.currentLevel}, score: ${state.score}, moves: ${state.moves}`,
          totalWinCount
        )
        event(
          'interaction',
          'winMap',
          state.map,
          win ? 1 : 0
        )
        setTimeout(
          () => {
            commit('mode', 'levelWin')

            // In multiplayer, send win notification via WebRTC (no Firebase)
            if (state.multiplayer.isMultiplayer && state.multiplayer.webrtcConnected) {
              const webrtcService = require('./services/webrtcService').default
              webrtcService.sendGameState({
                type: 'levelWin',
                map: state.map,
                score: state.score,
                facing: state.facing,
                candyHouseIndex: state.candyHouseIndex,
                activePlayerCharacter: state.multiplayer.activePlayerCharacter
              })
            }
          },
          200
        )
      }
    },
    shortForwardAction ({ state, commit }) {
      // Only allow forward if player has control
      if (state.multiplayer.isMultiplayer && state.multiplayer.playerRole !== 'player') {
        return
      }

      commit('shortForward')

      // Just move to the house, don't interact
      // Interaction is now done via the Trick-Or-Treat button
      
      const win = !state.map.match(uppercaseHousesRegex)
      const earlyExit = state.charAtNewIndex === '!'
      if (win || earlyExit) {
        totalWinCount += 1
        event(
          'interaction',
          'win',
          `currentLevel: ${state.currentLevel}, score: ${state.score}, moves: ${state.moves}`,
          totalWinCount
        )
        event(
          'interaction',
          'winMap',
          state.map,
          win ? 1 : 0
        )
        setTimeout(
          () => {
            commit('mode', 'levelWin')

            // In multiplayer, send win notification via WebRTC (no Firebase)
            if (state.multiplayer.isMultiplayer && state.multiplayer.webrtcConnected) {
              const webrtcService = require('./services/webrtcService').default
              webrtcService.sendGameState({
                type: 'levelWin',
                map: state.map,
                score: state.score,
                facing: state.facing,
                candyHouseIndex: state.candyHouseIndex,
                activePlayerCharacter: state.multiplayer.activePlayerCharacter
              })
            }
          },
          200
        )
      }
    },
    testCustomMap ({ state, commit }, mapString) {
      // Add custom map temporarily for testing
      const customLevelIndex = state.levels.length
      state.levels.push(mapString)
      commit('startLevel', customLevelIndex)
      commit('mode', 'play')
      event('interaction', 'testCustomMap', null, null)
    },
    // Multiplayer actions
    setMultiplayerInfo ({ commit }, payload) {
      commit('setMultiplayerInfo', payload)
    },
    setPlayerRole ({ commit }, role) {
      commit('setPlayerRole', role)
    },
    setWebRTCConnected ({ commit }, connected) {
      commit('setWebRTCConnected', connected)
    },
    updateMultiplayerRoom ({ commit, state, dispatch }, roomData) {
      commit('updateMultiplayerRoom', roomData)
      
      // Check for disconnection during gameplay
      // Only check if we're in play mode AND we have a WebRTC connection established
      // And only after a grace period (don't check immediately after connection)
      if (state.multiplayer.isMultiplayer && state.mode === 'play' && state.multiplayer.webrtcConnected && roomData && roomData.players) {
        const myPlayerId = state.multiplayer.playerId
        const otherPlayerId = myPlayerId === 'player1' ? 'player2' : 'player1'
        
        const otherPlayer = roomData.players[otherPlayerId]
        
        // Track previous connection state
        if (!state.multiplayer.otherPlayerWasConnected && otherPlayer && otherPlayer.connected) {
          // Other player just connected, mark them as connected
          commit('setOtherPlayerConnected', true)
        }
        
        // Only check for disconnection if we're past the initial grace period
        // Give at least 3 seconds after WebRTC connects before checking for disconnection
        const gracePeriodMs = 3000
        const timeSinceConnect = state.multiplayer.webrtcConnectedAt ? Date.now() - state.multiplayer.webrtcConnectedAt : Infinity
        
        // Check if other player disconnected:
        // 1. They were previously connected
        // 2. They are now disconnected (either not in room data, or connected: false)
        // 3. Enough time has passed since connection
        if (timeSinceConnect > gracePeriodMs && state.multiplayer.otherPlayerWasConnected) {
          const isDisconnected = !otherPlayer || !otherPlayer.connected
          
          if (isDisconnected) {
            console.log('⚠️ Other player disconnected during gameplay')
            
            // Import services for cleanup
            const webrtcService = require('./services/webrtcService').default
            const roomService = require('./services/roomService').default
            
            // Clean up connections
            webrtcService.destroy()
            roomService.disconnect().then(() => {
              if (state.multiplayer.isHost) {
                roomService.deleteRoom()
              }
            })
            
            // Reset multiplayer and return to lobby
            dispatch('resetMultiplayer')
            dispatch('mode', 'lobby')
            
            // Show error message
            setTimeout(() => {
              alert('接続が切断されました')
            }, 100)
          }
        }
      }
    },
    handleMultiplayerMessage ({ commit, state, dispatch }, message) {
      console.log('📥 Received multiplayer message:', message.type, message.data)
      
      if (message.type === 'gameState') {
        // Check if this is an initialSync message
        if (message.data.type === 'initialSync') {
          console.log('📥 Guide received initial sync with candyHouseIndex:', message.data.candyHouseIndex)
          console.log('📥 Levels loaded:', state.levels.length, 'levels')
          
          // Guide receives initial game state from player
          const level = message.data.level !== undefined ? message.data.level : 0
          const candyHouseIndex = message.data.candyHouseIndex
          
          if (candyHouseIndex !== undefined) {
            console.log('📥 Starting level', level, 'with candyHouseIndex:', candyHouseIndex)
            commit('startLevel', { level, candyHouseIndex })
          } else {
            console.log('📥 Starting level', level, 'without candyHouseIndex')
            commit('startLevel', level)
          }
          
          // Sync other state
          commit('syncGameState', message.data)
          
          // Now that guide has the map, switch to play mode
          commit('mode', 'play')
          console.log('📥 Guide map loaded:', state.map ? 'map exists' : 'no map', 'mode set to play')
        } else if (message.data.type === 'roleSwitch') {
          // Handle role switch - guide receives this from player
          console.log('📥 Guide received roleSwitch, score in message:', message.data.score)
          
          // Close any active overlay
          commit('setOverlay', { active: false, type: null, message: null })
          
          // Sync the score from the player BEFORE switching roles
          if (message.data.score !== undefined) {
            state.score = message.data.score
            console.log('📥 Score synced to:', state.score)
          }
          
          // Now call switchRolesAndContinue to become the player
          dispatch('switchRolesAndContinue')
        } else if (message.data.type === 'levelWin') {
          console.log('Received level win notification:', message.data)
          // Sync the final game state
          commit('syncGameState', message.data)
        } else if (message.data.type === 'houseInteraction') {
          console.log('Received house interaction:', message.data)
          
          // Only the guide should handle this message (player already handled it locally)
          if (state.multiplayer.playerRole !== 'guide') {
            console.log('Ignoring houseInteraction - not guide role')
            return
          }
          
          // Sync game state
          commit('syncGameState', message.data)

          // Show overlay for guide
          if (message.data.success) {
            commit('setOverlay', {
              active: true,
              type: 'success',
              message: 'Good Job! You got candy!'
            })
            // Don't close overlay here - wait for roleSwitch message
            // The roleSwitch handler will close the overlay and start the new round
          } else {
            commit('setOverlay', {
              active: true,
              type: 'fail',
              message: 'Oh no! You got homework!'
            })
            setTimeout(() => {
              commit('setOverlay', { active: false, type: null, message: null })
            }, 5000)
          }
        } else if (message.data.type === 'levelStart') {
          console.log('📥 Guide received levelStart with candyHouseIndex:', message.data.candyHouseIndex, 'score:', message.data.score)
          // New guide receives level info from new player
          const level = message.data.level !== undefined ? message.data.level : state.currentLevel
          const candyHouseIndex = message.data.candyHouseIndex
          
          // Sync score FIRST before starting level
          if (message.data.score !== undefined) {
            state.score = message.data.score
            console.log('📥 Score synced to:', state.score)
          }
          
          // Start level with candy house (keep score)
          if (candyHouseIndex !== undefined) {
            commit('startLevel', { level, candyHouseIndex, keepScore: true })
          } else {
            commit('startLevel', { level, keepScore: true })
          }
          
          // Sync other state (map, facing, etc.)
          commit('syncGameState', message.data)
          console.log('📥 Final score after sync:', state.score)
        } else {
          // Regular game state update
          console.log('Received game state update:', message.data)
          commit('syncGameState', message.data)
        }
      }
    },
    resetMultiplayer ({ commit }) {
      commit('resetMultiplayer')
    },
    async switchRolesAndContinue ({ state, commit }) {
      console.log('🔄 switchRolesAndContinue called, current role:', state.multiplayer.playerRole)
      
      // Determine new roles
      const currentRole = state.multiplayer.playerRole
      const newRole = currentRole === 'player' ? 'guide' : 'player'
      console.log('🔄 Switching from', currentRole, 'to', newRole)

      // Determine new activePlayerCharacter
      const currentChar = state.multiplayer.activePlayerCharacter
      const newActiveChar = currentChar === 'ghost' ? 'alien' : 'ghost'

      const nextLevel = (state.currentLevel + 1) % state.levels.length
      
      // If I'm currently the player, send roleSwitch BEFORE switching my role
      if (currentRole === 'player') {
        console.log('🔄 I was the player, sending roleSwitch to guide first, current score:', state.score)
        
        if (state.multiplayer.webrtcConnected) {
          const webrtcService = require('./services/webrtcService').default
          console.log('📤 Sending roleSwitch message to guide with score:', state.score)
          webrtcService.sendGameState({
            type: 'roleSwitch',
            activePlayerCharacter: newActiveChar,
            level: nextLevel,
            score: state.score // Pass the current score to the guide
          })
        }
        
        // Now switch my role to guide
        commit('setPlayerRole', newRole)
        state.multiplayer.activePlayerCharacter = newActiveChar
        console.log('🔄 I am now the guide, keeping score:', state.score)
      } else {
        // I'm currently the guide, becoming player
        console.log('🔄 I was the guide, becoming player')
        commit('setPlayerRole', newRole)
        state.multiplayer.activePlayerCharacter = newActiveChar
        
        // Pick candy house and start level (keep score across rounds)
        const scoreBeforeStart = state.score
        console.log('🔄 Starting level', nextLevel, 'as new player, score before startLevel:', scoreBeforeStart)
        commit('startLevel', { level: nextLevel, keepScore: true })
        console.log('🔄 Score after startLevel:', state.score, '(should be', scoreBeforeStart, ')')
        
        // Send level info to new guide
        if (state.multiplayer.webrtcConnected) {
          const webrtcService = require('./services/webrtcService').default
          console.log('📤 Sending levelStart with candyHouseIndex:', state.candyHouseIndex, 'score:', state.score)
          webrtcService.sendGameState({
            type: 'levelStart',
            level: nextLevel,
            candyHouseIndex: state.candyHouseIndex,
            map: state.map,
            score: state.score,
            facing: state.facing,
            activePlayerCharacter: state.multiplayer.activePlayerCharacter
          })
        }
      }
      
      commit('mode', 'play')
      console.log('🔄 switchRolesAndContinue complete, mode set to play')
    },
    trickOrTreat ({ dispatch }) {
      // Trigger house interaction
      dispatch('interactWithHouse')
    },
    async interactWithHouse ({ state, commit, dispatch }) {
      console.log('🏠 interactWithHouse called')
      // Only player can interact
      if (state.multiplayer.isMultiplayer && state.multiplayer.playerRole !== 'player') {
        console.log('🏠 Not player role, skipping interaction')
        return
      }

      // Check if player is adjacent to an interactable house
      const gIndex = state.map.indexOf('G', 1)
      const xMax = state.map.indexOf('\n', 1) - 1
      const { x, y } = fromIndex(gIndex, xMax)
      const house = getAdjacentInteractableHouse(state.map, x, y, xMax, state.facing)

      console.log('🏠 House check result:', { house, candyHouseIndex: state.candyHouseIndex })

      if (!house) {
        console.log('🏠 No interactable house found')
        return // No interactable house
      }

      // Mark this house as the last one we interacted with
      state.lastInteractedHouseIndex = house.houseIndex

      // Check if this is the candy house
      // Both should be string indices that include newlines
      const { x: houseX, y: houseY } = fromIndex(house.houseIndex, xMax)
      const { x: candyX, y: candyY } = fromIndex(state.candyHouseIndex, xMax)
      
      const isCorrectHouse = house.houseIndex === state.candyHouseIndex
      console.log('🏠 House comparison:')
      console.log('  foundHouseIndex:', house.houseIndex, 'at position:', { x: houseX, y: houseY })
      console.log('  candyHouseIndex:', state.candyHouseIndex, 'at position:', { x: candyX, y: candyY })
      console.log('  isCorrectHouse:', isCorrectHouse)
      console.log('  houseChar:', house.houseChar)
      console.log('  mapAtFoundIndex:', state.map.charAt(house.houseIndex))
      console.log('  mapAtCandyIndex:', state.map.charAt(state.candyHouseIndex))

      if (isCorrectHouse) {
        // SUCCESS! Got candy
        commit('setOverlay', {
          active: true,
          type: 'success',
          message: 'Good Job! You got candy!'
        })

        // Update score
        state.score += 1

        // Mark house as visited
        const houseChar = house.houseChar
        state.map = spliceSlice(state.map, house.houseIndex, 1, houseChar.toLowerCase())

        // Broadcast success via WebRTC
        if (state.multiplayer.isMultiplayer && state.multiplayer.webrtcConnected) {
          const webrtcService = require('./services/webrtcService').default
          webrtcService.sendGameState({
            type: 'houseInteraction',
            success: true,
            map: state.map,
            score: state.score,
            candyHouseIndex: state.candyHouseIndex,
            activePlayerCharacter: state.multiplayer.activePlayerCharacter
          })
        }

        // After 5 seconds, switch roles and start new round
        setTimeout(() => {
          console.log('⏰ 5 seconds elapsed, closing overlay and switching roles')
          commit('setOverlay', { active: false, type: null, message: null })
          if (state.multiplayer.isMultiplayer) {
            console.log('🔄 Calling switchRolesAndContinue')
            dispatch('switchRolesAndContinue')
          } else {
            // Single player: just pick new candy house
            const houses = state.map.match(uppercaseHousesRegex)
            if (houses && houses.length > 0) {
              const randomHouseNum = Math.floor(Math.random() * houses.length)
              let houseCount = 0
              for (let i = 0; i < state.map.length; i++) {
                if (state.map[i].match(uppercaseHousesRegex)) {
                  if (houseCount === randomHouseNum) {
                    state.candyHouseIndex = i
                    break
                  }
                  houseCount++
                }
              }
            }
          }
        }, 5000)
      } else {
        // FAIL! Wrong house
        commit('setOverlay', {
          active: true,
          type: 'fail',
          message: 'Oh no! You got homework!'
        })

        // Lose a point
        state.score = Math.max(0, state.score - 1)

        // Broadcast fail via WebRTC
        if (state.multiplayer.isMultiplayer && state.multiplayer.webrtcConnected) {
          const webrtcService = require('./services/webrtcService').default
          webrtcService.sendGameState({
            type: 'houseInteraction',
            success: false,
            map: state.map,
            score: state.score,
            candyHouseIndex: state.candyHouseIndex,
            activePlayerCharacter: state.multiplayer.activePlayerCharacter
          })
        }

        // After 5 seconds, close overlay and continue
        setTimeout(() => {
          commit('setOverlay', { active: false, type: null, message: null })
        }, 5000)
      }
    }
  }
})
