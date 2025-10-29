import SimplePeer from 'simple-peer/simplepeer.min.js'

class WebRTCService {
  constructor () {
    this.peer = null
    this.connected = false
    this.dataChannel = null
    this.onMessageCallback = null
    this.onConnectedCallback = null
    this.onDisconnectedCallback = null
    this.instanceId = Math.random().toString(36).substr(2, 9)
    console.log('🔧 WebRTCService instance created:', this.instanceId)
  }

  // Initialize as initiator (player who creates the room)
  initAsInitiator () {
    console.log('🔧 [' + this.instanceId + '] Initializing as initiator')
    this.peer = new SimplePeer({
      initiator: true,
      trickle: true,
      channelName: 'halloween-game',
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    })

    this.setupPeerEvents()
    return this.peer
  }

  // Initialize as receiver (player who joins the room)
  initAsReceiver () {
    console.log('🔧 [' + this.instanceId + '] Initializing as receiver')
    this.peer = new SimplePeer({
      initiator: false,
      trickle: true,
      channelName: 'halloween-game',
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    })

    this.setupPeerEvents()
    return this.peer
  }

  // Setup peer event handlers
  setupPeerEvents () {
    if (!this.peer) return

    this.peer.on('signal', (signal) => {
      // Signal data will be sent through Firebase
      if (this.onSignalCallback) {
        this.onSignalCallback(signal)
      }
    })

    this.peer.on('connect', () => {
      console.log('WebRTC connection established!')
      this.connected = true

      // Wait a bit longer before testing and starting the game
      setTimeout(() => {
        // Test the connection by sending a ping
        try {
          this.peer.send(JSON.stringify({ type: 'ping' }))
          console.log('✅ Data channel is writable!')
        } catch (e) {
          console.error('❌ Data channel not ready:', e)
        }

        if (this.onConnectedCallback) {
          this.onConnectedCallback()
        }
      }, 500) // Increased delay to 500ms
    })

    this.peer.on('data', (data) => {
      console.log('📦 [' + this.instanceId + '] WebRTC received raw data:', data)
      try {
        const message = JSON.parse(data.toString())
        console.log('📦 [' + this.instanceId + '] WebRTC parsed message:', message)

        // Handle ping messages
        if (message.type === 'ping') {
          console.log('🏓 [' + this.instanceId + '] Received ping, data channel is working!')
          return
        }

        if (this.onMessageCallback) {
          this.onMessageCallback(message)
        } else {
          console.warn('⚠️ [' + this.instanceId + '] No message callback registered!')
        }
      } catch (error) {
        console.error('[' + this.instanceId + '] Error parsing WebRTC message:', error, data.toString())
      }
    })

    console.log('✅ [' + this.instanceId + '] Event listeners attached to peer')

    this.peer.on('error', (error) => {
      console.error('WebRTC error:', error)
      // Don't disconnect on stream errors, they're often non-fatal
      if (error.code === 'ERR_DATA_CHANNEL' || error.code === 'ERR_CONNECTION_FAILURE') {
        this.connected = false
        if (this.onDisconnectedCallback) {
          this.onDisconnectedCallback()
        }
      }
    })

    this.peer.on('close', () => {
      console.log('WebRTC connection closed')
      this.connected = false
      if (this.onDisconnectedCallback) {
        this.onDisconnectedCallback()
      }
    })
  }

  // Process signal from the other peer
  signal (signalData) {
    if (this.peer) {
      this.peer.signal(signalData)
    }
  }

  // Send game state update
  sendGameState (gameState) {
    const channelState = this.peer && this.peer._channel ? this.peer._channel.readyState : 'no-channel'
    console.log('📤 Attempting to send game state. Connected:', this.connected, 'Peer exists:', !!this.peer, 'Writable:', channelState)
    if (this.peer && this.connected) {
      try {
        const payload = {
          type: 'gameState',
          data: gameState
        }
        console.log('📤 Sending game state:', payload)
        const jsonStr = JSON.stringify(payload)
        console.log('📤 JSON string length:', jsonStr.length)
        this.peer.send(jsonStr)
        console.log('✅ Game state sent successfully')
      } catch (error) {
        console.error('❌ Error sending game state:', error)
        console.error('Peer state - destroyed:', this.peer ? this.peer.destroyed : 'no-peer', 'connected:', this.peer ? this.peer.connected : 'no-peer')
      }
    } else {
      console.warn('⚠️ Cannot send - peer not ready. Connected:', this.connected, 'Peer:', !!this.peer)
    }
  }

  // Send player action
  sendAction (action, payload) {
    if (this.peer && this.connected) {
      try {
        this.peer.send(JSON.stringify({
          type: 'action',
          action,
          payload
        }))
      } catch (error) {
        console.error('Error sending action:', error)
      }
    }
  }

  // Send chat message
  sendMessage (message) {
    if (this.peer && this.connected) {
      try {
        this.peer.send(JSON.stringify({
          type: 'message',
          data: message
        }))
      } catch (error) {
        console.error('Error sending message:', error)
      }
    }
  }

  // Register callback for when signal is generated
  onSignal (callback) {
    this.onSignalCallback = callback
  }

  // Register callback for incoming messages
  onMessage (callback) {
    console.log('🔧 [' + this.instanceId + '] Registering message callback')
    this.onMessageCallback = callback
  }

  // Register callback for connection established
  onConnected (callback) {
    this.onConnectedCallback = callback
  }

  // Register callback for disconnection
  onDisconnected (callback) {
    this.onDisconnectedCallback = callback
  }

  // Close connection
  destroy () {
    if (this.peer) {
      this.peer.destroy()
      this.peer = null
    }
    this.connected = false
  }

  // Check if connected
  isConnected () {
    return this.connected
  }
}

export default new WebRTCService()
