<template>
  <div v-if="overlayActive" class="interaction-overlay">
    <div class="overlay-content">
      <h1 class="overlay-message">{{ overlayMessage }}</h1>
      <div class="animation-container" ref="animationContainer"></div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import lottie from 'lottie-web'

export default {
  name: 'InteractionOverlay',
  data () {
    return {
      animation: null
    }
  },
  computed: {
    ...mapGetters(['overlayActive', 'overlayType', 'overlayMessage'])
  },
  watch: {
    overlayActive (newVal) {
      if (newVal) {
        this.$nextTick(() => {
          this.loadAnimation()
        })
      } else {
        this.cleanup()
      }
    }
  },
  methods: {
    loadAnimation () {
      if (!this.$refs.animationContainer) return

      // Determine which animation to load
      const animationPath = this.overlayType === 'success' 
        ? 'lottie/candy.json' 
        : 'lottie/homework.json'

      // Load and play the Lottie animation
      this.animation = lottie.loadAnimation({
        container: this.$refs.animationContainer,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: animationPath
      })
    },
    cleanup () {
      if (this.animation) {
        this.animation.destroy()
        this.animation = null
      }
    }
  },
  beforeDestroy () {
    this.cleanup()
  }
}
</script>

<style scoped>
.interaction-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.overlay-content {
  text-align: center;
  color: white;
}

.overlay-message {
  font-size: 3rem;
  margin-bottom: 2rem;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
}

.animation-container {
  width: 300px;
  height: 300px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0 auto;
}
</style>
