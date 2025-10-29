<template>
  <div class="level-win">
    <h1>{{ winTitle }}</h1>
    <score />

    <!-- Multiplayer role switch info -->
    <div v-if="isMultiplayer" class="multiplayer-info">
      <p class="role-message">{{ roleMessage }}</p>
      <p v-if="!bothPlayersReady" class="waiting-text">Waiting for other player...</p>
      <p v-else class="ready-text">Both players ready! Switching roles...</p>
    </div>

    <div class="controls">
      <button
        v-if="!isMultiplayer"
        class="control options"
        type="button"
        @mousedown="$store.dispatch('startLevel', $store.getters.currentLevel)"
        @touchstart.prevent.stop="$store.dispatch('startLevel', $store.getters.currentLevel)"
      >Replay</button>
      <button
        v-if="!isMultiplayer"
        class="control options"
        type="button"
        @mousedown="$store.dispatch('nextLevel')"
        @touchstart.prevent.stop="$store.dispatch('nextLevel')"
      >Next Level</button>

      <!-- Multiplayer ready button -->
      <button
        v-if="isMultiplayer && !isReady"
        class="control options"
        type="button"
        @mousedown="markReady"
        @touchstart.prevent.stop="markReady"
      >Ready for Next Round</button>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import Score from './Score'

export default {
  components: {
    Score
  },
  data () {
    return {
      isReady: false
    }
  },
  computed: {
    ...mapGetters([
      'isMultiplayer',
      'playerRole',
      'isPlayer',
      'isGuide',
      'roomData'
    ]),
    winTitle () {
      if (this.isMultiplayer) {
        return this.isPlayer ? 'Level Complete!' : 'Player Won!'
      }
      return 'You Win!'
    },
    roleMessage () {
      if (this.isPlayer) {
        return 'Next round, you will be the Guide'
      } else {
        return 'Next round, you will be the Player'
      }
    },
    bothPlayersReady () {
      if (!this.roomData || !this.roomData.gameState) return false
      return this.roomData.gameState.player1Ready && this.roomData.gameState.player2Ready
    }
  },
  methods: {
    async markReady () {
      this.isReady = true
      await this.$store.dispatch('switchRolesAndContinue')
    }
  },
  watch: {
    bothPlayersReady (newVal) {
      if (newVal) {
        // Both players are ready, roles will switch automatically
        setTimeout(() => {
          this.isReady = false
        }, 1000)
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.level-win {
  position: absolute;
  z-index: 1;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 20rem;
  min-height: 23rem;
  margin: auto;
  background-color: #382440;
  border-radius: 1rem;
  padding: 1rem;

  h1{
    padding: 0 1rem;
    margin: 0;
    line-height: 4rem;
    font-size: 2.5rem;
  }

  .multiplayer-info {
    padding: 1rem;
    margin: 1rem 0;

    .role-message {
      font-size: 1.25rem;
      color: #fa0;
      margin: 0.5rem 0;
    }

    .waiting-text {
      font-size: 1rem;
      color: #ccc;
      margin: 0.5rem 0;
      animation: pulse 1.5s ease-in-out infinite;
    }

    .ready-text {
      font-size: 1rem;
      color: #4caf50;
      margin: 0.5rem 0;
      font-weight: bold;
    }
  }

  .close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    .control {
      line-height: 2rem;
      font-size: 1.5rem;
      width: 2rem;
      height: 2rem;
      border-radius: 0.25rem;
    }
  }
  .controls {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 2rem;
    width: 18rem;
    margin: auto;
  }
  .options {
    width: 16rem;
    font-size: 1.5rem;
    margin: 0.5rem auto;
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
