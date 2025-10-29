<template>
  <div class="lobby">
    <div class="lobby-container">
      <h1>🎃 Trick or Treat 🍬</h1>

      <!-- Initial Menu -->
      <div v-if="state === 'menu'" class="menu">
        <p>遊び方を選択してください</p>
        <button
          class="control options"
          @click="showCreateRoom"
        >Make Room</button>
        <button
          class="control options"
          @click="showJoinRoom"
        >Join Room</button>
      </div>

      <!-- Create Room -->
      <div v-if="state === 'create'" class="create-room">
        <h2>ルームを作成</h2>
        <p class="info-text">あなたは <strong>Player 1</strong> (ホスト) になります</p>
        <button
          class="control options"
          @click="createRoom"
        >Make Room</button>
        <button
          class="control options back-btn"
          @click="backToMenu"
        >Back</button>
      </div>

      <!-- Join Room -->
      <div v-if="state === 'join'" class="join-room">
        <h2>Join a Room</h2>
        <p class="info-text">You will be <strong>Player 2</strong> (Guest)</p>
        <input
          v-model="roomCodeInput"
          type="text"
          placeholder="Enter 5-digit room code"
          class="input-field"
          maxlength="5"
          @input="validateRoomCode"
        />
        <button
          class="control options"
          @click="joinRoom"
          :disabled="roomCodeInput.length !== 5"
        >Join Room</button>
        <button
          class="control options back-btn"
          @click="backToMenu"
        >Back</button>
        <p v-if="error" class="error">{{ error }}</p>
      </div>

      <!-- Waiting Room -->
      <div v-if="state === 'waiting'" class="waiting-room">
        <h2>Room Code: {{ currentRoomCode }}</h2>
        <p class="room-code-display">{{ currentRoomCode }}</p>
        <p v-if="isHost">もう一人のプレイヤーが参加するのを待っています...</p>
        <p v-else>接続しました！ホストがゲームを開始するのを待っています...</p>

        <div class="players-list">
          <div v-if="roomData && roomData.players">
            <div class="player-item" v-if="roomData.players.player1">
              <span>👻 {{ roomData.players.player1.name }}</span>
              <span v-if="roomData.players.player1.connected" class="status-connected">●</span>
            </div>
            <div class="player-item" v-if="roomData.players.player2">
              <span>👻 {{ roomData.players.player2.name }}</span>
              <span v-if="roomData.players.player2.connected" class="status-connected">●</span>
            </div>
            <div v-else class="player-item empty">
              <span>Player 2 を待っています...</span>
            </div>
          </div>
        </div>

        <button
          v-if="canStartGame"
          class="control options"
          @click="startGame"
        >Start Game</button>

        <button
          class="control options back-btn"
          @click="leaveRoom"
        >Leave Room</button>
      </div>

      <!-- Connecting -->
      <div v-if="state === 'connecting'" class="connecting">
        <h2>Establishing Connection...</h2>
        <p>Setting up peer-to-peer connection via WebRTC</p>
        <div class="spinner"></div>
      </div>
    </div>
  </div>
</template>

<script>
import roomService from '../services/roomService'
import webrtcService from '../services/webrtcService'

export default {
  name: 'Lobby',
  data () {
    return {
      state: 'menu', // menu, create, join, waiting, connecting
      roomCodeInput: '',
      currentRoomCode: null,
      isHost: false,
      error: null,
      roomData: null,
      currentRoomData: null,
      webrtcConnected: false,
      webrtcInitialized: false,
      otherPlayerWasConnected: false, // Track if other player was previously connected
      webrtcConnectedAt: null // Track when WebRTC connected to add grace period
    }
  },
  computed: {
    canStartGame () {
      if (!this.roomData) return false
      const hasPlayer1 = this.roomData.players && this.roomData.players.player1
      const hasPlayer2 = this.roomData.players && this.roomData.players.player2
      return this.isHost && hasPlayer1 && hasPlayer2
    }
  },
  methods: {
    showCreateRoom () {
      this.state = 'create'
      this.error = null
    },
    showJoinRoom () {
      this.state = 'join'
      this.error = null
    },
    backToMenu () {
      this.state = 'menu'
      this.error = null
      this.roomCodeInput = ''
    },
    validateRoomCode () {
      this.roomCodeInput = this.roomCodeInput.replace(/\D/g, '').slice(0, 5)
    },
    async createRoom () {
      try {
        this.error = null
        const playerName = 'Player 1'
        const { roomCode, playerId } = await roomService.createRoom(playerName)
        this.currentRoomCode = roomCode
        this.isHost = true
        this.state = 'waiting'

        // Listen for room updates
        roomService.onRoomUpdate(this.handleRoomUpdate)

        // Store multiplayer info in Vuex
        this.$store.dispatch('setMultiplayerInfo', {
          isMultiplayer: true,
          isHost: true,
          playerId,
          roomCode,
          playerName
        })
      } catch (error) {
        this.error = error.message
        console.error('Error creating room:', error)
      }
    },
    async joinRoom () {
      try {
        this.error = null
        const playerName = 'Player 2'
        const { roomCode, playerId } = await roomService.joinRoom(
          this.roomCodeInput,
          playerName
        )
        this.currentRoomCode = roomCode
        this.isHost = false
        this.state = 'waiting'

        // Listen for room updates
        roomService.onRoomUpdate(this.handleRoomUpdate)

        // Store multiplayer info in Vuex
        this.$store.dispatch('setMultiplayerInfo', {
          isMultiplayer: true,
          isHost: false,
          playerId,
          roomCode,
          playerName
        })
      } catch (error) {
        this.error = error.message
        console.error('Error joining room:', error)
      }
    },
    async handleRoomUpdate (data) {
      this.roomData = data

      // Only check for disconnection if:
      // 1. We're not actively connecting
      // 2. We have a WebRTC connection established
      // 3. At least 3 seconds have passed since WebRTC connected (grace period for initialization)
      const gracePeriodMs = 3000
      const timeSinceConnect = this.webrtcConnectedAt ? Date.now() - this.webrtcConnectedAt : Infinity
      
      if (this.state !== 'connecting' && this.webrtcConnected && timeSinceConnect > gracePeriodMs) {
        const myPlayerId = this.isHost ? 'player1' : 'player2'
        const otherPlayerId = this.isHost ? 'player2' : 'player1'
        
        if (data.players && data.players[otherPlayerId]) {
          const otherPlayerConnected = data.players[otherPlayerId].connected
          
          // If other player was previously connected but is now disconnected, show error
          if (this.otherPlayerWasConnected && !otherPlayerConnected) {
            console.log('⚠️ Other player disconnected')
            
            // Clean up connections
            webrtcService.destroy()
            await roomService.disconnect()
            if (this.isHost) {
              await roomService.deleteRoom()
            }
            
            // Reset multiplayer state
            this.$store.dispatch('resetMultiplayer')
            
            // Return to lobby with error message
            this.error = '接続が切断されました'
            this.state = 'menu'
            this.webrtcConnected = false
            this.webrtcInitialized = false
            this.currentRoomCode = null
            this.isHost = false
            this.otherPlayerWasConnected = false
            this.webrtcConnectedAt = null
            
            // Also return to lobby mode if we're in game
            if (this.$store.state.mode === 'play') {
              this.$store.dispatch('mode', 'lobby')
            }
            
            return
          }
          
          // Update tracking of other player's connection state
          if (otherPlayerConnected) {
            this.otherPlayerWasConnected = true
          }
        } else if (this.otherPlayerWasConnected && data.players) {
          // Other player disappeared from room data (disconnected and removed)
          console.log('⚠️ Other player disconnected (removed from room)')
          
          // Clean up connections
          webrtcService.destroy()
          await roomService.disconnect()
          if (this.isHost) {
            await roomService.deleteRoom()
          }
          
          // Reset multiplayer state
          this.$store.dispatch('resetMultiplayer')
          
          // Return to lobby with error message
          this.error = '接続が切断されました'
          this.state = 'menu'
          this.webrtcConnected = false
          this.webrtcInitialized = false
          this.currentRoomCode = null
          this.isHost = false
          this.otherPlayerWasConnected = false
          this.webrtcConnectedAt = null
          
          // Also return to lobby mode if we're in game
          if (this.$store.state.mode === 'play') {
            this.$store.dispatch('mode', 'lobby')
          }
          
          return
        }
      } else if (data.players) {
        // During initial connection or before WebRTC is established, track connection state
        const otherPlayerId = this.isHost ? 'player2' : 'player1'
        if (data.players[otherPlayerId] && data.players[otherPlayerId].connected) {
          this.otherPlayerWasConnected = true
        }
      }

      // Check if both players are present and roles are assigned
      if (
        data.players.player1 &&
        data.players.player2 &&
        data.players.player1.role &&
        data.players.player2.role &&
        data.gameState.status === 'ready' &&
        !this.webrtcInitialized
      ) {
        // Start WebRTC connection
        this.webrtcInitialized = true
        await this.initWebRTC(data)
      }

      // Update Vuex store with room data
      this.$store.dispatch('updateMultiplayerRoom', data)
    },
    async initWebRTC (roomData) {
      this.state = 'connecting'

      // Store roomData and store reference for callbacks to persist after component destruction
      this.currentRoomData = roomData
      const store = this.$store

      try {
        // Short delay to ensure Firebase is ready
        await new Promise(resolve => setTimeout(resolve, 500))

        if (this.isHost) {
          // Player 1 is the initiator
          console.log('Initializing as host (initiator)')
          webrtcService.initAsInitiator()
        } else {
          // Player 2 is the receiver
          console.log('Initializing as guest (receiver)')
          webrtcService.initAsReceiver()
        }

        // Handle outgoing signals
        webrtcService.onSignal(async (signal) => {
          console.log('Sending signal:', signal.type || 'candidate')

          try {
            if (signal.type === 'offer') {
              await roomService.setRTCOffer(signal)
            } else if (signal.type === 'answer') {
              await roomService.setRTCAnswer(signal)
            } else {
              await roomService.addICECandidate(signal)
            }
          } catch (err) {
            console.error('Error sending signal:', err)
          }
        })

        // Handle incoming signals from Firebase
        if (this.isHost) {
          // Host waits for guest's answer
          console.log('Host: Waiting for answer...')
          roomService.roomRef.child('players/player2/rtcAnswer').on('value', (snapshot) => {
            const answer = snapshot.val()
            if (answer && !this.webrtcConnected) {
              console.log('Host: Received answer, signaling...')
              webrtcService.signal(answer)
            }
          })

          // Also listen for ICE candidates
          roomService.roomRef.child('players/player2/iceCandidates').on('child_added', (snapshot) => {
            const candidate = snapshot.val()
            if (candidate && !this.webrtcConnected) {
              console.log('Host: Received ICE candidate')
              webrtcService.signal(candidate)
            }
          })
        } else {
          // Guest waits for host's offer
          console.log('Guest: Waiting for offer...')
          roomService.roomRef.child('players/player1/rtcOffer').on('value', (snapshot) => {
            const offer = snapshot.val()
            if (offer && !this.webrtcConnected) {
              console.log('Guest: Received offer, signaling...')
              webrtcService.signal(offer)
            }
          })

          // Also listen for ICE candidates
          roomService.roomRef.child('players/player1/iceCandidates').on('child_added', (snapshot) => {
            const candidate = snapshot.val()
            if (candidate && !this.webrtcConnected) {
              console.log('Guest: Received ICE candidate')
              webrtcService.signal(candidate)
            }
          })
        }

        // Handle connection established
        webrtcService.onConnected(() => {
          console.log('✅ WebRTC connection established!')
          this.webrtcConnected = true
          this.webrtcConnectedAt = Date.now() // Record connection time
          store.dispatch('setWebRTCConnected', true)
          
          // Mark other player as connected now that we have WebRTC connection
          if (this.currentRoomData && this.currentRoomData.players) {
            const otherPlayerId = this.isHost ? 'player2' : 'player1'
            if (this.currentRoomData.players[otherPlayerId] && this.currentRoomData.players[otherPlayerId].connected) {
              this.otherPlayerWasConnected = true
            }
          }

          // Get my player info
          const myPlayerId = this.isHost ? 'player1' : 'player2'
          const myPlayerData = this.currentRoomData.players[myPlayerId]

          // Determine which player has the 'player' role and set activePlayerCharacter
          const player1Data = this.currentRoomData.players.player1
          const player2Data = this.currentRoomData.players.player2
          const activePlayerCharacter = player1Data.role === 'player' ? player1Data.character : player2Data.character

          store.dispatch('setPlayerRole', myPlayerData.role)
          store.commit('selectCharacter', myPlayerData.character)
          store.commit('setMultiplayerInfo', {
            ...store.state.multiplayer,
            activePlayerCharacter
          })
          
          // Only the player starts the level and picks candy house
          if (myPlayerData.role === 'player') {
            store.dispatch('startLevel', 0)
            store.dispatch('mode', 'play')
            
            // Send initial game state to guide with candy house index
            // Use a longer delay to ensure the guide's message handler is ready
            setTimeout(() => {
              const webrtcService = require('../services/webrtcService').default
              console.log('📤 Player sending initialSync with candyHouseIndex:', store.state.candyHouseIndex)
              console.log('📤 Full initialSync data:', {
                type: 'initialSync',
                level: 0,
                candyHouseIndex: store.state.candyHouseIndex,
                map: store.state.map ? 'map exists' : 'no map',
                score: store.state.score,
                facing: store.state.facing
              })
              webrtcService.sendGameState({
                type: 'initialSync',
                level: 0,
                candyHouseIndex: store.state.candyHouseIndex,
                map: store.state.map,
                score: store.state.score,
                facing: store.state.facing,
                activePlayerCharacter: store.state.multiplayer.activePlayerCharacter
              })
            }, 500)
          } else {
            // Guide: Set mode to play immediately (map will load when initialSync arrives)
            store.dispatch('mode', 'play')
          }
        })

        // Handle incoming messages - store reference persists after component destruction
        webrtcService.onMessage((message) => {
          console.log('🎯 Lobby: Message callback triggered')
          store.dispatch('handleMultiplayerMessage', message)
        })

        // Handle disconnection
        webrtcService.onDisconnected(() => {
          console.log('⚠️ WebRTC disconnected')
          this.webrtcConnected = false
          store.dispatch('setWebRTCConnected', false)
          
          // Return to lobby with error message
          this.handleDisconnection()
        })

        // Fallback: Start game even if WebRTC fails (game state will use Firebase only)
        setTimeout(() => {
          if (!this.webrtcConnected && this.state === 'connecting') {
            console.log('⚠️ WebRTC timeout - starting without P2P')
            const myPlayerId = this.isHost ? 'player1' : 'player2'
            const myPlayerData = this.currentRoomData.players[myPlayerId]

            // Determine which player has the 'player' role and set activePlayerCharacter
            const player1Data = this.currentRoomData.players.player1
            const player2Data = this.currentRoomData.players.player2
            const activePlayerCharacter = player1Data.role === 'player' ? player1Data.character : player2Data.character

            store.dispatch('setPlayerRole', myPlayerData.role)
            store.commit('selectCharacter', myPlayerData.character)
            store.commit('setMultiplayerInfo', {
              ...store.state.multiplayer,
              activePlayerCharacter
            })
            
            // Only player starts level in fallback mode too
            if (myPlayerData.role === 'player') {
              store.dispatch('startLevel', 0)
              store.dispatch('mode', 'play')
            } else {
              // Guide in fallback mode - just start with level 0 (no sync available)
              store.dispatch('startLevel', 0)
              store.dispatch('mode', 'play')
            }
          }
        }, 10000) // 10 second timeout
      } catch (error) {
        console.error('Error initializing WebRTC:', error)
        this.error = 'Connection setup failed: ' + error.message
      }
    },
    async startGame () {
      if (!this.canStartGame) return

      try {
        // Assign roles and characters randomly
        await roomService.assignRolesAndCharacters()
      } catch (error) {
        console.error('Error starting game:', error)
        this.error = 'Failed to start game'
      }
    },
    async leaveRoom () {
      await roomService.disconnect()
      if (this.isHost) {
        await roomService.deleteRoom()
      }
      webrtcService.destroy()
      this.$store.dispatch('resetMultiplayer')
      this.backToMenu()
    },
    async handleDisconnection () {
      // Clean up connections
      webrtcService.destroy()
      await roomService.disconnect()
      if (this.isHost) {
        await roomService.deleteRoom()
      }
      
      // Reset multiplayer state
      this.$store.dispatch('resetMultiplayer')
      
      // Return to lobby with error message
      this.error = '接続が切断されました'
      this.state = 'menu'
      this.webrtcConnected = false
      this.webrtcInitialized = false
      this.currentRoomCode = null
      this.isHost = false
      
      // Also return to lobby mode if we're in game
      if (this.$store.state.mode === 'play') {
        this.$store.dispatch('mode', 'lobby')
      }
    }
  },
  beforeDestroy () {
    // Clean up Firebase listeners
    roomService.disconnect()

    // Only destroy WebRTC if we're NOT connected or game hasn't started
    // Keep WebRTC alive if connection succeeded and game is starting
    if (!this.webrtcConnected) {
      console.log('Lobby destroyed, cleaning up WebRTC (not connected)')
      webrtcService.destroy()
    } else {
      console.log('Lobby destroyed, keeping WebRTC alive for game')
    }
  }
}
</script>

<style lang="scss" scoped>
.lobby {
  position: absolute;
  z-index: 1;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;

  .lobby-container {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 25rem;
    background-color: #382440;
    border-radius: 1rem;
    padding: 2rem;
    box-sizing: border-box;

    h1 {
      margin: 0 0 1rem 0;
      font-size: 2rem;
      line-height: 2.5rem;
      color: #ddd;
    }

    h2 {
      margin: 0 0 1rem 0;
      font-size: 1.5rem;
      color: #ddd;
    }

    p {
      margin: 0.5rem 0;
      font-size: 1rem;
      color: #ccc;
    }

    .info-text {
      font-size: 1.1rem;
      color: #ddd;
      margin: 1rem 0;

      strong {
        color: #fa0;
      }
    }

    .input-field {
      width: 100%;
      padding: 0.75rem;
      margin: 0.5rem 0;
      font-size: 1.25rem;
      font-family: 'Underdog', sans-serif;
      background-color: #40408a;
      color: #ddd;
      border: 2px solid #555;
      border-radius: 0.5rem;
      box-sizing: border-box;
      text-align: center;

      &::placeholder {
        color: #999;
      }

      &:focus {
        outline: none;
        border-color: #fa0;
      }
    }

    .control.options {
      width: 100%;
      height: 3rem;
      line-height: 3rem;
      font-size: 1.5rem;
      margin: 0.5rem 0;

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      &.back-btn {
        background-color: #666;
        font-size: 1.25rem;
      }
    }

    .error {
      color: #ff6b6b;
      font-size: 0.9rem;
      margin-top: 0.5rem;
    }

    .room-code-display {
      font-size: 3rem;
      font-weight: bold;
      color: #fa0;
      margin: 1rem 0;
      letter-spacing: 0.5rem;
    }

    .players-list {
      margin: 1.5rem 0;

      .player-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem;
        margin: 0.5rem 0;
        background-color: #40408a;
        border-radius: 0.5rem;
        font-size: 1.25rem;

        &.empty {
          opacity: 0.5;
        }

        .status-connected {
          color: #4caf50;
          font-size: 1.5rem;
        }
      }
    }

    .spinner {
      width: 3rem;
      height: 3rem;
      margin: 2rem auto;
      border: 4px solid #555;
      border-top: 4px solid #fa0;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
