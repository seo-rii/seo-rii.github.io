<script lang="ts">
    import Ripple from "./Ripple.svelte";

    export let raised = false,
        primary = false,
        size: ('small' | 'medium' | 'large') = 'medium';
</script>

<style lang="scss">
  $button-radius: 50px;
  $small-padding: 10px 16px;
  $medium-padding: 11px 20px;
  $large-padding: 12px 24px;

  button {
    font-family: 'Nunito Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-weight: 700;
    border: 0;
    border-radius: $button-radius;
    cursor: pointer;
    display: inline-block;
    line-height: 1;
    z-index: 2;
    position: relative;
    overflow: hidden;

    -webkit-tap-highlight-color: transparent;
    outline: none;
    -ms-touch-action: manipulation;
    touch-action: manipulation;

    &.raised {
      box-shadow: rgba(100, 100, 111, 0.2) 0px 7px 29px 0px;
    }

    &.primary {
      color: white;
      background-color: var(--mt-primary);

      & :global(*) {
        color: white;
      }
    }

    &.secondary {
      color: #333;
      background-color: transparent;
      box-shadow: rgba(0, 0, 0, 0.15) 0px 0px 0px 1px inset;
    }


    &.small {
      font-size: 12px;
      padding: $small-padding;
    }

    &.medium {
      font-size: 14px;
      padding: $medium-padding;
    }

    &.large {
      font-size: 16px;
      padding: $large-padding;
    }
  }
</style>

<button type="button" class:raised class:primary class:secondary={!primary} class="{size}">
    <slot/>
    <Ripple {primary}/>
</button>
