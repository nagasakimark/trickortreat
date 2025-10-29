import { database } from './firebase'

class RoomService {
  constructor () {
    this.roomRef = null
    this.playerId = null
    this.roomCode = null
    this.ROOM_MAX_AGE_MS = 60 * 60 * 1000 // 1 hour
  }

  // Generate a random 5-digit room code
  generateRoomCode () {
    return Math.floor(10000 + Math.random() * 90000).toString()
  }

  // Check if a room code already exists and is active
  async isRoomCodeTaken (roomCode) {
    const roomRef = database.ref(`rooms/${roomCode}`)
    const snapshot = await roomRef.once('value')
    if (!snapshot.exists()) {
      return false
    }
    
    const roomData = snapshot.val()
    const now = Date.now()
    const roomAge = now - roomData.createdAt
    
    // Room is considered "taken" if it exists and is less than 1 hour old
    // and has at least one connected player
    if (roomAge < this.ROOM_MAX_AGE_MS) {
      const hasConnectedPlayer = (roomData.players && roomData.players.player1 && roomData.players.player1.connected) || 
                                 (roomData.players && roomData.players.player2 && roomData.players.player2.connected)
      return hasConnectedPlayer
    }
    
    // Room is old/stale, can be reused
    return false
  }

  // Clean up old/stale rooms (only for known room codes)
  // Note: We can't list all rooms due to Firebase permissions, so this only cleans up
  // rooms the client knows about. For global cleanup, use Cloud Functions.
  async cleanupOldRooms () {
    // Since we can't read all rooms from /rooms (permission denied),
    // we only clean up rooms we have direct references to.
    // For production, set up a Cloud Function for global cleanup.
    // This function is kept for future use when Cloud Functions are implemented.
    return
  }

  // Create a new room
  async createRoom (playerName = 'Player 1') {
    // Clean up old rooms first (optional, can be done periodically)
    // await this.cleanupOldRooms()

    // Try up to 5 times to generate a unique room code
    let roomCode = null
    let attempts = 0
    const maxAttempts = 5

    while (!roomCode && attempts < maxAttempts) {
      const candidateCode = this.generateRoomCode()
      const isTaken = await this.isRoomCodeTaken(candidateCode)
      
      if (!isTaken) {
        roomCode = candidateCode
      } else {
        attempts++
        // Small delay to avoid hammering the database
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    if (!roomCode) {
      throw new Error('Failed to generate unique room code. Please try again.')
    }

    this.roomCode = roomCode
    this.playerId = 'player1'

    const roomData = {
      roomCode,
      createdAt: Date.now(),
      players: {
        player1: {
          id: 'player1',
          name: playerName,
          connected: true,
          role: null, // Will be assigned randomly when both players join
          character: null,
          rtcOffer: null,
          rtcAnswer: null,
          iceCandidates: []
        }
      },
      gameState: {
        status: 'waiting', // waiting, ready, playing, roundComplete
        currentRound: 0,
        player1Ready: false,
        player2Ready: false
      }
    }

    this.roomRef = database.ref(`rooms/${roomCode}`)
    await this.roomRef.set(roomData)

    return { roomCode, playerId: 'player1' }
  }

  // Join an existing room
  async joinRoom (roomCode, playerName = 'Player 2') {
    this.roomCode = roomCode
    this.playerId = 'player2'
    this.roomRef = database.ref(`rooms/${roomCode}`)

    // Check if room exists
    const snapshot = await this.roomRef.once('value')
    if (!snapshot.exists()) {
      throw new Error('Room not found')
    }

    const roomData = snapshot.val()
    const now = Date.now()

    // Check if room is too old (stale)
    if (!roomData.createdAt) {
      throw new Error('Invalid room data')
    }

    const roomAge = now - roomData.createdAt
    if (roomAge > this.ROOM_MAX_AGE_MS) {
      // Delete stale room and throw error
      await this.roomRef.remove()
      throw new Error('Room has expired. Please ask the host to create a new room.')
    }

    // Check if player1 exists and is connected
    if (!roomData.players || !roomData.players.player1) {
      throw new Error('Room is invalid - no host found')
    }

    if (!roomData.players.player1.connected) {
      throw new Error('Host has disconnected. Please ask them to create a new room.')
    }

    // Check if room is full
    if (roomData.players.player2) {
      throw new Error('Room is full')
    }

    // Check if room is in a valid state for joining (should be waiting)
    const gameStatus = roomData.gameState && roomData.gameState.status
    if (gameStatus && gameStatus !== 'waiting') {
      throw new Error('Game is already in progress. Please wait for the current game to finish.')
    }

    // Add player2 to the room
    await this.roomRef.child('players/player2').set({
      id: 'player2',
      name: playerName,
      connected: true,
      role: null,
      character: null,
      rtcOffer: null,
      rtcAnswer: null,
      iceCandidates: []
    })

    return { roomCode, playerId: 'player2' }
  }

  // Listen for room updates
  onRoomUpdate (callback) {
    if (!this.roomRef) return

    this.roomRef.on('value', (snapshot) => {
      const data = snapshot.val()
      if (data) {
        callback(data)
      }
    })
  }

  // Update player's WebRTC offer
  async setRTCOffer (offer) {
    if (!this.roomRef || !this.playerId) return
    await this.roomRef.child(`players/${this.playerId}/rtcOffer`).set(offer)
  }

  // Update player's WebRTC answer
  async setRTCAnswer (answer) {
    if (!this.roomRef || !this.playerId) return
    await this.roomRef.child(`players/${this.playerId}/rtcAnswer`).set(answer)
  }

  // Add ICE candidate
  async addICECandidate (candidate) {
    if (!this.roomRef || !this.playerId) return
    const candidatesRef = this.roomRef.child(`players/${this.playerId}/iceCandidates`)
    await candidatesRef.push(candidate)
  }

  // Update game state
  async updateGameState (updates) {
    if (!this.roomRef) return
    await this.roomRef.child('gameState').update(updates)
  }

  // Assign roles and characters randomly
  async assignRolesAndCharacters () {
    if (!this.roomRef) return

    const snapshot = await this.roomRef.once('value')
    const roomData = snapshot.val()

    // Check if both players are present
    if (!roomData.players.player1 || !roomData.players.player2) {
      return
    }

    // Randomly assign roles
    const roles = Math.random() < 0.5 ? ['player', 'guide'] : ['guide', 'player']
    const characters = Math.random() < 0.5 ? ['ghost', 'alien'] : ['alien', 'ghost']

    await this.roomRef.child('players/player1').update({
      role: roles[0],
      character: characters[0]
    })

    await this.roomRef.child('players/player2').update({
      role: roles[1],
      character: characters[1]
    })

    await this.updateGameState({ status: 'ready' })
  }

  // Switch roles after round completion
  async switchRoles () {
    if (!this.roomRef) return

    const snapshot = await this.roomRef.once('value')
    const roomData = snapshot.val()

    const player1Role = roomData.players.player1.role
    const player2Role = roomData.players.player2.role

    // Switch roles
    await this.roomRef.child('players/player1/role').set(player2Role)
    await this.roomRef.child('players/player2/role').set(player1Role)

    // Increment round counter
    const currentRound = roomData.gameState.currentRound || 0
    await this.updateGameState({
      currentRound: currentRound + 1,
      status: 'playing',
      player1Ready: false,
      player2Ready: false
    })
  }

  // Mark player as ready
  async setPlayerReady () {
    if (!this.roomRef || !this.playerId) return
    await this.roomRef.child(`gameState/${this.playerId}Ready`).set(true)
  }

  // Disconnect and cleanup
  async disconnect () {
    if (this.roomRef && this.playerId) {
      await this.roomRef.child(`players/${this.playerId}/connected`).set(false)
      this.roomRef.off()
      
      // If player1 disconnects and player2 is not connected, delete the room
      if (this.playerId === 'player1') {
        const snapshot = await this.roomRef.once('value')
        if (snapshot.exists()) {
          const roomData = snapshot.val()
          const player2Connected = roomData.players && roomData.players.player2 && roomData.players.player2.connected
          if (!player2Connected) {
            // No one is connected, delete the room
            await this.roomRef.remove()
          }
        }
      }
    }
    this.roomRef = null
    this.playerId = null
    this.roomCode = null
  }

  // Delete room (only for host)
  async deleteRoom () {
    if (this.roomRef && this.playerId === 'player1') {
      await this.roomRef.remove()
    }
  }

  // Periodic cleanup of old rooms (can be called on app start)
  // Note: Disabled because we can't list all rooms without special permissions.
  // For production, implement server-side cleanup via Cloud Functions.
  async startPeriodicCleanup (intervalMinutes = 10) {
    // Cleanup disabled - requires Cloud Functions for proper implementation
    // Individual room cleanup still happens on disconnect
    console.log('Room cleanup: Using individual room cleanup on disconnect. For global cleanup, use Cloud Functions.')
  }
}

export default new RoomService()
