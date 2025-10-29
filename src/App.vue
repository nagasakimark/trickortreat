<template>
  <div id="app">
    <GameThree />
    <Lobby v-if="mode === 'lobby'" />
    <Controls v-if="mode === 'play'" />
    <LevelSelect v-if="mode === 'levelSelect'" />
    <LevelWin v-if="mode === 'levelWin'" />
    <CharacterSelect v-if="mode === 'characterSelect'" />
    <MapEditor v-if="mode === 'mapEditor'" />
    <InteractionOverlay />
    
    <!-- QR Code Button - Only visible on lobby/pause screens -->
    <div v-if="showQRButton" class="qr-code-button" @click.stop="toggleQRCode">
      <img src="/qricon.png" alt="QR Code" class="qr-icon" />
    </div>
    
    <!-- QR Code Modal -->
    <div v-if="showQR" class="qr-modal" @click="toggleQRCode">
      <div class="qr-content" @click.stop>
        <div class="qr-placeholder">
          <img src="/qrcode.png" alt="QR Code" />
        </div>
        <button class="close-qr" @click="toggleQRCode">Close</button>
      </div>
    </div>
    
    <!-- Directions Helper -->
    <DirectionsHelper v-if="mode === 'lobby'" />
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import Controls from './components/Controls'
import LevelSelect from './components/LevelSelect'
import LevelWin from './components/LevelWin'
import GameThree from './components/GameThree'
import CharacterSelect from './components/CharacterSelect'
import MapEditor from './components/MapEditor'
import Lobby from './components/Lobby'
import InteractionOverlay from './components/InteractionOverlay'
import DirectionsHelper from './components/DirectionsHelper'
import roomService from './services/roomService'

export default {
  name: 'app',
  components: {
    CharacterSelect,
    Controls,
    LevelSelect,
    LevelWin,
    GameThree,
    MapEditor,
    Lobby,
    InteractionOverlay,
    DirectionsHelper
  },
  data () {
    return {
      showQR: false
    }
  },
  async mounted () {
    this.$store.dispatch('loadLevels')
    // Start periodic cleanup of old/stale rooms (runs every 10 minutes)
    roomService.startPeriodicCleanup(10)
  },
  methods: {
    toggleQRCode () {
      this.showQR = !this.showQR
    },
  },
  computed: {
    ...mapGetters([
      'mode'
    ]),
    showQRButton () {
      // Show QR code button only on lobby or pause (levelSelect) screens
      return this.mode === 'lobby' || this.mode === 'levelSelect'
    }
  }
}
</script>

<style lang="scss">
html, body {
  padding: 0;
  margin: 0;
}
body {
  background-color: #5d3758;
}

body *,
body *:before,
body *:after {
  box-sizing: border-box;
}
#app {
  font-family: 'Underdog', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #ccc;
  height: 100%;
}

.control {
  display: inline-block;
  margin: 0.5rem;
  cursor: pointer;
  position: relative;
  text-align: center;
  line-height: 3.5rem;
  font-size: 3rem;
  border-radius: 1rem;
  background-color: #40408a;
  color: #ddd;
  width: 4rem;
  height: 4rem;
  -moz-appearance: none;
  -webkit-appearance: none;
  border: none;
  outline: none;
  font-family: 'Underdog', sans-serif;

  &.active,
  &:active {
    background-color: #ddd;
    color: #fa0;
    outline: none;

    svg {
      path {
        fill: #fa0;
      }
    }
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;

    path {
      fill: #ddd;
    }
  }
}

.qr-code-button {
  position: fixed;
  bottom: 1rem;
  left: 1rem;
  width: 3rem;
  height: 3rem;
  background-color: #40408a;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1000;
  transition: background-color 0.2s;

  .qr-icon {
    width: 2rem;
    height: 2rem;
    object-fit: contain;
  }

  &:hover {
    background-color: #5555aa;
  }
}

.qr-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;

  .qr-content {
    background-color: #382440;
    border-radius: 1rem;
    padding: 2rem;
    max-width: 20rem;
    text-align: center;

    .qr-placeholder {
      background-color: white;
      padding: 1rem;
      border-radius: 0.5rem;
      margin: 0 0 1rem 0;
      display: flex;
      justify-content: center;
      align-items: center;

      img {
        max-width: 100%;
        height: auto;
      }
    }

    .close-qr {
      background-color: #40408a;
      color: #ddd;
      border: none;
      padding: 0.75rem 2rem;
      border-radius: 0.5rem;
      font-family: 'Underdog', sans-serif;
      font-size: 1rem;
      cursor: pointer;
      margin-top: 0;

      &:hover {
        background-color: #5555aa;
      }
    }
  }
}
</style>
