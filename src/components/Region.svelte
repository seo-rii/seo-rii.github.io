<script lang="ts">
    import Ripple from "$comp/Ripple.svelte";
</script>

<style lang="scss">
  main {
    padding: 10px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: #99999922;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    position: relative;
    transition: all 0.3s;

    & > :global(p) {
      margin: 10px 0;
      font-weight: 700;
    }

    & > * {
      margin: 5px;
    }

    &:hover {
      background: #99999944;
      padding: 12px;
      margin: -2px;
    }

    &:active {
      background: #99999944;
      padding: 16px;
      margin: -6px;
    }
  }
</style>

<main>
    <slot/>
    <Ripple primary={false}/>
</main>
