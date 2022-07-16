<script lang="ts">
    import {onDestroy, onMount} from "svelte";

    let innerWidth, innerHeight, canvas, ctx, img, scrollY, filt = 0, c2;
    let isMobile = false;
    let snow = [], circle = [];
    let _iimg = {};
    let intv;

    $: {
        if (canvas) {
            canvas.width = innerWidth;
            canvas.height = innerHeight;
        }
    }

    $: isMobile = innerWidth < 1024;

    $: filt = Math.max(Math.min(12, Math.round((scrollY - 20) / (innerHeight - 200) * 12)), 0);


    function snowdrop() {
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        for (let i of circle) {
            i.o += i.d;
            if (i.o > 1) {
                i.o = 1;
                i.d = -i.d;
            }
            if (i.o < 0) {
                i.o = 0;
                i.d = -i.d;
            }
            i.x += i.speedx;
            i.y += i.speedy;
            if (i.x + i.r < 0) i.x = innerWidth + i.r;
            if (i.y + i.r < 0) i.y = document.scrollingElement.scrollHeight + i.r;
            if (i.x - i.r > innerWidth) i.x = -i.r;
            if (i.y - i.r > document.scrollingElement.scrollHeight) i.y = -i.r;

            const radgrad = ctx.createRadialGradient(i.x, i.y - scrollY * i.parallax, 0, i.x, i.y - scrollY * i.parallax, i.r);
            radgrad.addColorStop(0, `rgba(${i.fill}, ${0.05 * i.o * ((36 - filt) / 36)})`);
            radgrad.addColorStop(0.8, `rgba(${i.fill}, ${0.01 * i.o * ((36 - filt) / 36)})`);
            radgrad.addColorStop(1, `rgba(${i.fill}, 0)`);
            ctx.beginPath();
            ctx.arc(i.x, i.y - scrollY * i.parallax, i.r, 0, 2 * Math.PI);
            ctx.fillStyle = radgrad;
            ctx.fill();
        }
        for (let i of snow) {
            i.y += i.speed;
            if (i.y > document.scrollingElement.scrollHeight) {
                i.y = -i.h;
            }

            ctx.drawImage(_iimg[i.o][filt], i.x, i.y - scrollY * i.parallax, i.w, i.h);
        }
        if (intv) requestAnimationFrame(snowdrop);
    }

    onMount(async () => {
        img = new Image();
        img.src = "seorii.png";
        img.onload = async () => {
            c2.width = 400;
            c2.height = 400;
            let _ctx = c2.getContext('2d');
            for (let o of [0.98, 0.97, 0.89]) {
                _iimg[o] = [];
                for (let i = 0; i <= 12; i++) {
                    _ctx.clearRect(0, 0, c2.width, c2.height);
                    _ctx.filter = `blur(${i}px)`;
                    _ctx.drawImage(img, 10, 10, c2.width - 20, c2.height - 20);
                    await new Promise(resolve => setTimeout(resolve, 0));

                    await new Promise((resolve) => {
                        const img = new Image();
                        img.onload = () => {
                            _iimg[o].push(img);
                            resolve();
                        }
                        img.src = c2.toDataURL();
                    })
                }
            }

            c2.style.display = 'none';

            let t = 0;
            ctx = canvas.getContext("2d");
            for (let i = 0; i < 12; i++) {
                if (t > 10000) break;
                const w = isMobile ? (Math.random() * 200 + 100) : (Math.random() * 300 + 400),
                    h = w / img.width * img.height,
                    x = Math.random() * (innerWidth - w + 400) - 200,
                    y = Math.random() * (document.scrollingElement.scrollHeight + 400) - 200

                let fl = false;
                for (let j of snow) {
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
                    o: [0.98, 0.97, 0.89][Math.floor(Math.random() * 3)],
                    speed: Math.random() * 0.2 + 0.02,
                    parallax: Math.random() * 0.4 + 0.4
                });
            }
            for (let i = 0; i < Math.sqrt(innerHeight * innerWidth) / 5; i++) {
                const r = Math.random() * 50 + 200,
                    x = Math.random() * (innerWidth - r + 400) - 200,
                    y = Math.random() * (document.scrollingElement.scrollHeight + 400) - 200
                circle.push({
                    x, y, r,
                    o: Math.random(),
                    d: Math.random() * 0.001 - 0.002,
                    speedx: Math.random() + 0.02,
                    speedy: Math.random() + 0.02,
                    fill: ['72, 117, 237', '72, 117, 237', '66, 66, 66'][Math.floor(Math.random() * 3)],
                    parallax: Math.random() * 0.2 + 0.7
                });
            }
            intv = setInterval(() => {
                for (let i of circle) {
                    i.speedx += Math.random() * 0.1 - 0.05;
                    i.speedy += Math.random() * 0.1 - 0.05;
                    i.speedx = Math.min(i.speedx, 1);
                    i.speedy = Math.min(i.speedy, 1);
                    i.speedx = Math.max(i.speedx, -1);
                    i.speedy = Math.max(i.speedy, -1);
                }
            }, 1000)
            snowdrop();
        };
    });

    onDestroy(() => {
        clearInterval(intv);
    });
</script>

<style>
    canvas {
        position: fixed;
        top: 0;
        left: 0;
    }
</style>

<title>서리</title>

<canvas bind:this={c2} style="opacity: 0;"></canvas>
<svelte:window bind:innerWidth bind:innerHeight bind:scrollY/>
<canvas bind:this={canvas}></canvas>
