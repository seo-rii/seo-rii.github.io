<script context="module">
    /** @type {import('@sveltejs/kit').Load} */
    export const load = async ({url}) => ({props: {url}});
</script>

<script lang="ts">
    import {fade} from "svelte/transition";
    import SeoRii from "$comp/SeoRii.svelte";

    const pageTransitionDuration = 200;
    export let url;
</script>

<SeoRii/>
<main>
    {#key url}
        <div in:fade={{ duration: 1, delay: pageTransitionDuration }}
             out:fade={{ duration: pageTransitionDuration }} style="height: 100%;">
            <slot/>
        </div>
    {/key}
</main>

<style lang="scss">
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@100;300;400;500;700;900&display=swap');

  $primary: #6b67c7;
  $secondary: #00ff00;
  $surface: #eceef3;
  $on-primary: #ffffff;
  $on-surface: #000000;

  :root {
    --mt-primary: #{$primary};
    --mt-secondary: #{$secondary};
    --mt-surface: #{$surface};
    --mt-on-primary: #{$on-primary};
    --mt-on-surface: #{$on-surface};


    --mc-ripple-color: #000000;
    --mc-ripple-duration: 0.3s;
  }

  :global(body, html, body>div) {
    height: 100%;
    margin: 0;
    padding: 0;
    background: #f1f1f1;
  }

  :global(*) {
    font-family: 'Noto Sans KR', sans-serif;
    font-weight: 400;
    color: #444558;
    -webkit-tap-highlight-color: transparent;
  }

  :global(h1) {
    font-size: 2.5rem;
    font-weight: 700;
    line-height: 1.2;
    margin: 20px 0;
    padding: 0;
  }

  :global(h2) {
    font-size: 2rem;
    font-weight: 700;
    line-height: 1.2;
    margin: 16px 0;
    padding: 0;
  }

  :global(a) {
    color: inherit;
    text-decoration: none;
  }

  @keyframes -global-fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 1rem;
    width: 100%;
    height: 100%;
    //max-width: 1024px;
    margin: 0 auto;
    box-sizing: border-box;
    z-index: 1;
    position: absolute;
  }
</style>
