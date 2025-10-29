<template>
  <div class="level-select-overlay" @click.stop.prevent="closeMenu">
    <div class="level-select" @click.stop>
      <h1>🎃 Trick or Treat 🍬</h1>
      <div class="close">
        <button
          class="control"
          type="button"
          @click.stop.prevent="closeMenu"
          @touchstart.stop.prevent="closeMenu"
        >
          <svg viewBox="0 0 32 32">
            <path d="M25.749,21.72c-1.507-1.994-3.014-3.988-4.521-5.982 c0.666-0.794,1.331-1.588,1.997-2.382c1.294-1.544,2.674-3.404,2.246-5.372c-0.059-0.272-0.159-0.548-0.359-0.742 c-0.704-0.687-1.457-1.33-2.444-1.6c-0.167-0.046-0.34-0.088-0.511-0.058c-0.21,0.037-0.384,0.179-0.547,0.317 c-1.615,1.374-3.072,2.924-4.396,4.58c-0.967-1.217-1.977-2.4-3.11-3.467c-0.741-0.697-1.936-2.02-2.955-2.275 C9.874,4.419,8.777,5.666,8.209,6.622c-0.866,1.456-1.339,2.4-0.244,3.887c1.41,1.915,2.838,3.824,4.308,5.696 c-2.26,2.054-4.247,4.387-6.227,6.712c-0.101,0.119-0.207,0.25-0.215,0.405c-0.01,0.196,0.138,0.361,0.278,0.5 c1.071,1.065,2.232,2.04,3.466,2.911c0.356,0.251,0.734,0.501,1.165,0.563c1.225,0.178,2.079-1.117,2.759-2.151 c0.577-0.877,1.253-1.684,1.928-2.489c0.386-0.461,0.772-0.921,1.158-1.382c0.795,0.852,1.596,1.698,2.447,2.497 c0.91,0.855,1.865,1.686,2.549,2.731c0.115,0.176,0.23,0.365,0.414,0.468c0.253,0.141,0.569,0.082,0.841-0.017 c1.515-0.552,2.411-2.089,3.1-3.547c0.128-0.27,0.256-0.557,0.228-0.855C26.135,22.239,25.939,21.97,25.749,21.72z" />
          </svg>
        </button>
      </div>
      <div class="controls">
      <div class="directions-section">
        <h3>方向の伝え方</h3>
        <div class="direction-item">
          <img src="/gostraight.png" alt="Go straight" class="icon" />
          <span class="text">Go straight for <strong>〇 block(s)</strong></span>
        </div>
        <div class="direction-item">
          <img src="/gostraightlittle.png" alt="Go straight a little" class="icon" />
          <span class="text">Go straight for <strong>a little bit</strong></span>
        </div>
        <div class="direction-item">
          <img src="/turnright.png" alt="Turn right" class="icon" />
          <span class="text"><strong>Turn right</strong></span>
        </div>
        <div class="direction-item">
          <img src="/turnleft.png" alt="Turn left" class="icon" />
          <span class="text"><strong>Turn left</strong></span>
        </div>
        <div class="direction-item">
          <img src="/seeleft.png" alt="See left" class="icon" />
          <span class="text">You can see it on your <strong>left</strong></span>
        </div>
        <div class="direction-item">
          <img src="/seeright.png" alt="See right" class="icon" />
          <span class="text">You can see it on your <strong>right</strong></span>
        </div>
      </div>
      <button
        class="control quit-btn"
        type="button"
        @mousedown="quitGame"
        @touchstart.prevent.stop="quitGame"
      >Quit Game</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  methods: {
    closeMenu (event) {
      if (event) {
        event.stopPropagation()
        event.preventDefault()
      }
      this.$store.dispatch('mode', this.$store.getters.modePrevious)
    },
    quitGame () {
      // Reset to lobby
      this.$store.dispatch('resetMultiplayer')
      this.$store.dispatch('mode', 'lobby')
      this.$store.dispatch('modePrevious', 'lobby')
    }
  }
}
</script>

<style lang="scss" scoped>
.level-select-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.level-select {
  position: relative;
  width: 90%;
  max-width: 30rem;
  padding: 1.5rem;
  box-sizing: border-box;
  background-color: rgba(56, 36, 64, 0.95);
  border-radius: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  
  h1{
    text-align: center;
    padding: 0;
    margin: 0 0 1rem 0;
    line-height: 1.5;
    font-size: 1.75rem;
    flex-shrink: 0;
    width: 100%;
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
    position: relative;
    width: 100%;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .directions-section {
    margin-bottom: 1rem;
    padding: 1rem;
    background-color: rgba(64, 64, 138, 0.3);
    border-radius: 0.5rem;
    width: 100%;

    h3 {
      margin: 0 0 0.75rem 0;
      font-size: 1.4rem;
      color: #fa0;
      font-family: 'Stick', sans-serif;
      text-align: center;
    }

    .direction-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem;
      margin: 0.3rem 0;
      font-size: 1.1rem;
      color: #ddd;
      font-family: 'Underdog', sans-serif;

      .icon {
        width: 2rem;
        height: 2rem;
        flex-shrink: 0;
        object-fit: contain;
      }

      .text {
        line-height: 1.3;

        strong {
          color: #fa0;
          font-weight: normal;
        }
      }
    }
  }

  .quit-btn {
    width: 100%;
    max-width: 20rem;
    font-size: 1.5rem;
    background-color: #8b1538;
    color: white;
    margin: 1rem auto 0;
    display: block;
    flex-shrink: 0;

    &:hover {
      background-color: #a01a42;
    }
  }
}
</style>
