<script lang="ts">
    import Ko from "./Ko.svelte";
    import En from "./En.svelte";
    import {browser} from "$app/environment";

    let supportKo = false;
    if (browser) supportKo = navigator.languages?.includes('ko');
</script>

<main>
    {#if supportKo}
        <Ko/>
    {:else}
        <En/>
    {/if}
</main>

<style lang="scss">
  main {
    position: relative;
    height: 100%;

    :global {
      .link {
        width: 100%;

        & a {
          width: calc(100% - 20px);
          margin: 10px;
          text-decoration: underline;
        }
      }

      h1 :global(svg) {
        margin: 0 10px -6px 0;
      }

      h3 {
        font-weight: 700;
      }

      * {
        line-height: 1.4;
      }
    }
  }
</style>