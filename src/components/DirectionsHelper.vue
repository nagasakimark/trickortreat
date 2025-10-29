<template>
  <div class="directions-helper">
    <div class="helper-header">
      <h3>方向の伝え方</h3>
    </div>
    <div class="helper-content">
      <div class="direction-item">
        <img :src="baseUrl + 'gostraight.png'" alt="Go straight" class="icon" />
        <span class="text">Go straight for <strong>〇 block(s)</strong></span>
      </div>
      <div class="direction-item">
        <img :src="baseUrl + 'gostraightlittle.png'" alt="Go straight a little" class="icon" />
        <span class="text">Go straight for <strong>a little bit</strong></span>
      </div>
      <div class="direction-item">
        <img :src="baseUrl + 'turnright.png'" alt="Turn right" class="icon" />
        <span class="text"><strong>Turn right</strong></span>
      </div>
      <div class="direction-item">
        <img :src="baseUrl + 'turnleft.png'" alt="Turn left" class="icon" />
        <span class="text"><strong>Turn left</strong></span>
      </div>
      <div class="direction-item">
        <img :src="baseUrl + 'seeleft.png'" alt="See left" class="icon" />
        <span class="text">You can see it on your <strong>left</strong></span>
      </div>
      <div class="direction-item">
        <img :src="baseUrl + 'seeright.png'" alt="See right" class="icon" />
        <span class="text">You can see it on your <strong>right</strong></span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DirectionsHelper',
  computed: {
    baseUrl () {
      return process.env.BASE_URL
    }
  }
}
</script>

<style lang="scss" scoped>
.directions-helper {
  position: fixed;
  top: 50%;
  left: 1rem;
  right: 1rem;
  transform: translateY(-50%);
  max-width: 25rem;
  background-color: rgba(56, 36, 64, 0.95);
  border-radius: 1rem;
  padding: 1rem;
  z-index: 999;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

  .helper-header {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 0.5rem;

    h3 {
      margin: 0;
      font-size: 1.25rem;
      color: #fa0;
      font-family: 'Stick', sans-serif;
      text-align: center;
      width: 100%;
    }

  }

  .helper-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .direction-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem;
    background-color: rgba(64, 64, 138, 0.3);
    border-radius: 0.5rem;
    transition: background-color 0.2s;

    &:hover {
      background-color: rgba(64, 64, 138, 0.5);
    }

    .icon {
      width: 2rem;
      height: 2rem;
      flex-shrink: 0;
      object-fit: contain;
    }

    .text {
      font-size: 1rem;
      color: #ddd;
      font-family: 'Underdog', sans-serif;
      line-height: 1.4;

      strong {
        color: #fa0;
        font-weight: normal;
      }
    }
  }
}

@media (max-width: 768px) {
  .directions-helper {
    top: 50%;
    transform: translateY(-50%);
    left: 0.5rem;
    right: 0.5rem;
    padding: 0.75rem;

    .helper-header h3 {
      font-size: 1rem;
    }

    .direction-item {
      padding: 0.4rem;
      gap: 0.5rem;

      .icon {
        width: 1.5rem;
        height: 1.5rem;
      }

      .text {
        font-size: 0.875rem;
      }
    }
  }
}
</style>

