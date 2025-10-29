<template>
  <div class="controls">
    <div class="score-holder">
      <score />
    </div>

    <!-- Role indicator for multiplayer -->
    <div v-if="isMultiplayer" class="role-indicator" :class="playerRole">
      <span v-if="isPlayer">🎮 Player</span>
      <span v-else>👁️ Guide</span>
    </div>

    <div
      class="menu-toggle"
    >
      <button
        class="control"
        type="button"
        @click.stop.prevent="openMenu"
        @touchstart.stop.prevent="openMenu"
      >
        <svg viewBox="0 0 32 32">
          <path d="M23.374,8.626H8.626 c-0.393,0-0.712,0.319-0.712,0.712v1.508c0,0.393,0.319,0.712,0.712,0.712h14.747c0.393,0,0.712-0.319,0.712-0.712V9.338 C24.086,8.945,23.767,8.626,23.374,8.626z M23.374,14.534H8.626c-0.393,0-0.712,0.319-0.712,0.712v1.508 c0,0.393,0.319,0.712,0.712,0.712h14.747c0.393,0,0.712-0.319,0.712-0.712v-1.508C24.086,14.853,23.767,14.534,23.374,14.534z M23.374,20.441H8.626c-0.393,0-0.712,0.319-0.712,0.712v1.508c0,0.393,0.319,0.712,0.712,0.712h14.747 c0.393,0,0.712-0.319,0.712-0.712v-1.508C24.086,20.76,23.767,20.441,23.374,20.441z" />
        </svg>
      </button>
    </div>

    <!-- Trick-Or-Treat button (center of screen when facing a house) -->
    <div v-if="(!isMultiplayer || isPlayer) && canTrickOrTreat" class="trick-or-treat-container">
      <button
        class="trick-or-treat-button"
        type="button"
        @touchstart.prevent.stop="$store.dispatch('trickOrTreat')"
        @mousedown="$store.dispatch('trickOrTreat')"
      >
        🎃 Trick-Or-Treat! 🍬
      </button>
    </div>

    <!-- Show controls only for player role or single player -->
    <div v-if="!isMultiplayer || isPlayer" class="arrows">
      <div class="relative">
        <div
          v-for="item in $options.buttons"
          :key="item.action"
          class="control-spacer"
          :class="item.direction"
        >
          <button
            class="control"
            type="button"
            @touchstart.prevent.stop="$store.dispatch(item.action)"
            @mousedown="$store.dispatch(item.action)"
          >
            <svg viewBox="0 0 32 32">
              <path :d="item.path" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Guide info banner -->
    <div v-else-if="isGuide" class="guide-info">
      <p>👁️ 上から見て、パートナーをナビゲートするのを手伝ってください！</p>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import Score from './Score'

const keyMap = {
  'ArrowUp': 'forward',
  'ArrowDown': 'forward',
  'ArrowLeft': 'turnLeftAction',
  'ArrowRight': 'turnRightAction',
  'w': 'forward',
  's': 'forward',
  'a': 'turnLeftAction',
  'd': 'turnRightAction',
  'W': 'forward',
  'S': 'forward',
  'A': 'turnLeftAction',
  'D': 'turnRightAction',
  '8': 'forward',
  '2': 'forward',
  '5': 'forward',
  '4': 'turnLeftAction',
  '6': 'turnRightAction',
  ' ': 'forward'
}
export default {
  name: 'Controls',
  components: {
    Score
  },
  methods: {
    openMenu (event) {
      if (event) {
        event.stopPropagation()
        event.preventDefault()
      }
      this.$store.dispatch('mode', 'levelSelect')
    },
    handleKeydown (event) {
      // Only handle keyboard input if player or single player
      if (this.isMultiplayer && !this.isPlayer) {
        return
      }

      const action = keyMap[event.key]
      if (action) {
        event.preventDefault()
        event.stopPropagation()
        this.$store.dispatch(action)
      }
    }
  },
  computed: {
    ...mapGetters([
      'isMultiplayer',
      'isPlayer',
      'isGuide',
      'playerRole',
      'canTrickOrTreat'
    ])
  },
  buttons: [
    {
      direction: 'up',
      action: 'forward',
      path: 'M23.497,12.822l-3.702,1.028 c-0.369,0.102-0.614,0.45-0.587,0.832l0.837,11.723c0.036,0.505-0.399,0.918-0.902,0.855l-5.956-0.744 c-0.402-0.05-0.704-0.392-0.704-0.798V13.436c0-0.393-0.284-0.728-0.672-0.793l-3.225-0.538c-0.694-0.116-0.915-1.003-0.357-1.431 l7.532-5.775c0.311-0.238,0.748-0.218,1.035,0.048l7.031,6.51C24.29,11.885,24.103,12.654,23.497,12.822z'
    },
    {
      direction: 'left',
      action: 'turnLeftAction',
      path: 'M16,4C9.383,4,4,9.383,4,16s5.383,12,12,12s12-5.383,12-12S22.617,4,16,4z M16,26c-5.514,0-10-4.486-10-10S10.486,6,16,6 s10,4.486,10,10S21.514,26,16,26z M12.293,15.293l3-3c0.391-0.391,1.023-0.391,1.414,0s0.391,1.023,0,1.414L15.414,15H20 c0.553,0,1,0.447,1,1s-0.447,1-1,1h-4.586l1.293,1.293c0.391,0.391,0.391,1.023,0,1.414C16.512,19.902,16.256,20,16,20 s-0.512-0.098-0.707-0.293l-3-3C11.902,16.316,11.902,15.684,12.293,15.293z'
    },
    {
      direction: 'right',
      action: 'turnRightAction',
      path: 'M16,4C9.383,4,4,9.383,4,16s5.383,12,12,12s12-5.383,12-12S22.617,4,16,4z M16,26c-5.514,0-10-4.486-10-10S10.486,6,16,6 s10,4.486,10,10S21.514,26,16,26z M19.707,15.293l-3-3c-0.391-0.391-1.023-0.391-1.414,0s-0.391,1.023,0,1.414L16.586,15H12 c-0.553,0-1,0.447-1,1s0.447,1,1,1h4.586l-1.293,1.293c-0.391,0.391-0.391,1.023,0,1.414C15.488,19.902,15.744,20,16,20 s0.512-0.098,0.707-0.293l3-3C20.098,16.316,20.098,15.684,19.707,15.293z'
    },
    {
      direction: 'down',
      action: 'shortForwardAction',
      path: 'M23.497,12.822l-3.702,1.028 c-0.369,0.102-0.614,0.45-0.587,0.832l0.837,7c0.036,0.505-0.399,0.918-0.902,0.855l-5.956-0.744 c-0.402-0.05-0.704-0.392-0.704-0.798V13.436c0-0.393-0.284-0.728-0.672-0.793l-3.225-0.538c-0.694-0.116-0.915-1.003-0.357-1.431 l7.532-5.775c0.311-0.238,0.748-0.218,1.035,0.048l7.031,6.51C24.29,11.885,24.103,12.654,23.497,12.822z'
    }
  ],
  mounted () {
    window.document.body.addEventListener('keydown', this.handleKeydown)
  },
  destroyed () {
    window.document.body.removeEventListener('keydown', this.handleKeydown)
  }
}
</script>

<style lang="scss" scoped>
.controls {
  .score-holder {
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
    border-radius: 1rem;
    background-color: #40408a;
  }

  .role-indicator {
    position: absolute;
    top: 0.5rem;
    left: 50%;
    transform: translateX(-50%);
    padding: 0.5rem 1rem;
    border-radius: 1rem;
    font-size: 1.25rem;
    font-weight: bold;

    &.player {
      background-color: #4caf50;
      color: #fff;
    }

    &.guide {
      background-color: #ff9800;
      color: #fff;
    }
  }

  .menu-toggle {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
  }

  .trick-or-treat-container {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10;
  }

  .trick-or-treat-button {
    font-family: 'Underdog', sans-serif;
    font-size: 2rem;
    padding: 1.5rem 3rem;
    background: linear-gradient(135deg, #ff6b6b 0%, #ffa500 100%);
    color: white;
    border: 4px solid #fff;
    border-radius: 2rem;
    cursor: pointer;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
    animation: pulse 1.5s ease-in-out infinite;

    &:hover {
      transform: scale(1.05);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
    }

    &:active {
      transform: scale(0.95);
    }
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }

  .arrows {
    position: absolute;
    bottom: 0.5rem;
    right: 0.5rem;
    overflow: hidden;
    z-index: 2;
    .relative {
      position: relative;
      height: 9.5rem;
      width: 14rem;
      .control-spacer {
        position: absolute;
        display: block;
        width: 5rem;
        height: 5rem;
        padding: 0.5rem;
        margin: auto;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        &.up { bottom: auto; }
        &.down { top: auto; }
        &.left { right: auto;  top: auto;}
        &.right { left: auto;  top: auto;}
      }
    }
  }

    .guide-info {
      position: absolute;
      bottom: 0.5rem;
      left: 50%;
      transform: translateX(-50%);
      background-color: rgba(64, 64, 138, 0.95);
      padding: 0.75rem 2.5rem;
      border-radius: 1rem;
      z-index: 2;
      white-space: nowrap;
      min-width: fit-content;

      p {
        margin: 0;
        font-size: 1.25rem;
        color: #ddd;
        text-align: center;
        font-family: 'Stick', sans-serif;
        white-space: nowrap;
      }
    }
}

@media (max-width: 768px) {
  .controls .guide-info {
    bottom: 0.5rem;
    padding: 0.75rem 1rem;

    p {
      font-size: 1rem;
    }
  }
}
</style>
