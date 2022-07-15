<script lang="ts">
    import {onMount} from "svelte";

    let innerWidth, innerHeight, canvas, ctx, img, scrollY;
    let snow = [], circle = [];

    $: {
        if (canvas) {
            canvas.width = innerWidth;
            canvas.height = innerHeight;
        }
    }

    function snowdrop() {
        ctx.filter = '';
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        for (let i of circle) {
            if (isNaN(i.x)) continue;
            const radgrad = ctx.createRadialGradient(i.x, i.y - scrollY * i.parallax, 0, i.x, i.y - scrollY * i.parallax, i.r);
            radgrad.addColorStop(0, `rgba(${i.fill}, .04)`);
            radgrad.addColorStop(0.8, `rgba(${i.fill}, .01)`);
            radgrad.addColorStop(1, `rgba(${i.fill}, 0)`);
            ctx.beginPath();
            ctx.arc(i.x, i.y - scrollY * i.parallax, i.r, 0, 2 * Math.PI);
            ctx.fillStyle = radgrad;
            ctx.fill();
            i.x += i.speedx;
            i.y += i.speedy;
            i.speedx += Math.random() * 0.1 - 0.05;
            i.speedy += Math.random() * 0.1 - 0.05;
            i.speedx = Math.min(i.speedx, 1);
            i.speedy = Math.min(i.speedy, 1);
            i.speedx = Math.max(i.speedx, -1);
            i.speedy = Math.max(i.speedy, -1);
            if (i.x + i.r < 0) i.x = innerWidth + i.r;
            if (i.y + i.r < 0) i.y = document.scrollingElement.scrollHeight + i.r;
            if (i.x - i.r > innerWidth) i.x = -i.r;
            if (i.y - i.r > document.scrollingElement.scrollHeight) i.y = -i.r;
        }
        ctx.globalAlpha = 1
        for (let i of snow) {
            i.y += i.speed;
            if (i.y > document.scrollingElement.scrollHeight) {
                i.y = -i.h;
            }
            ctx.filter = `brightness(${i.o})`;
            ctx.drawImage(img, i.x, i.y - scrollY * i.parallax, i.w, i.h);
        }
        requestAnimationFrame(snowdrop);
    }

    onMount(() => {
        img = new Image();
        img.src = "seorii.png";
        img.onload = () => {
            let t = 0;
            ctx = canvas.getContext("2d");
            for (let i = 0; i < 12; i++) {
                if (t > 10000) break;
                const w = Math.random() * 300 + 400, h = w / img.width * img.height,
                    x = Math.random() * (innerWidth - w + 400) - 200,
                    y = Math.random() * (document.scrollingElement.scrollHeight + 400) - 200

                let fl = false;
                for (let j of snow) {
                    //detect if overlap
                    if (Math.abs(j.x - x) < w && Math.abs(j.y - y) < h) {
                        fl = true;
                        break;
                    }
                }
                if (fl) {
                    i--;
                    t++;
                    continue;
                }

                snow.push({
                    x, y, w, h,
                    o: [0.98, 0.97, 0.89][Math.floor(Math.random() * 2)],
                    speed: Math.random() * 0.2 + 0.02,
                    parallax: Math.random() * 0.4 + 0.4
                });
            }
            for (let i = 0; i < innerHeight * innerWidth / 30000; i++) {
                circle.push({
                    x: Math.random() * innerWidth,
                    y: Math.random() * document.scrollingElement.scrollHeight,
                    r: Math.random() * 50 + 200,
                    o: Math.random() * 0.5 + 0.5,
                    speedx: Math.random() * 1 + 0.02,
                    speedy: Math.random() * 1 + 0.02,
                    fill: ['72, 117, 237', '99, 99, 99'][Math.floor(Math.random() * 2)],
                    parallax: Math.random() * 0.2 + 0.7
                });
            }
            snowdrop();
        };
    })
</script>

<style>
    canvas {
        position: fixed;
        top: 0;
        left: 0;
    }
</style>

<svelte:window bind:innerWidth bind:innerHeight bind:scrollY/>
<canvas bind:this={canvas}></canvas>