<script lang="ts">
    import {onDestroy, onMount} from "svelte";

    let innerWidth, innerHeight, canvas, ctx, img, scrollY, filt = 0, c2;
    let isMobile = false;
    let snow = [], circle = [];
    let _iimg = {};
    let intv;

    $: isMobile = innerWidth < 1024;
    const filterLv = isMobile ? 8 : 14, bright = [0.98, 0.97, 0.89];

    $: {
        if (canvas) {
            canvas.width = innerWidth;
            canvas.height = innerHeight;
        }
    }


    $: filt = Math.max(Math.min(filterLv, Math.round((scrollY - 20) / (innerHeight - 200) * filterLv)), 0);


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
            radgrad.addColorStop(0, `rgba(${i.fill}, ${0.05 * i.o * (1 - filt / filterLv * 0.3)})`);
            radgrad.addColorStop(0.8, `rgba(${i.fill}, ${0.01 * i.o * (1 - filt / filterLv * 0.3)})`);
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
            for (let o of bright) {
                _iimg[o] = [];
                _ctx.clearRect(0, 0, c2.width, c2.height);
                _ctx.drawImage(img, 15, 15, c2.width - 30, c2.height - 30);
                await new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        for (let i = 0; i <= filterLv; i++) {
                            _iimg[o][i] = (img);
                        }
                        resolve();
                    }
                    img.src = c2.toDataURL();
                })

            }
            (async () => {
                for (let o of bright) {
                    for (let i = 0; i <= filterLv; i++) {
                        _ctx.clearRect(0, 0, c2.width, c2.height);
                        _ctx.filter = `blur(${i}px)`;
                        _ctx.drawImage(img, 15, 15, c2.width - 30, c2.height - 30);
                        await new Promise((resolve) => {
                            const img = new Image();
                            img.onload = () => {
                                _iimg[o][i] = (img);
                                resolve();
                            }
                            img.src = c2.toDataURL();
                        })
                    }
                }

                c2.style.display = 'none';
            })().then();

            let t = 0;
            ctx = canvas.getContext("2d");
            for (let i = 0; i < Math.sqrt(document.scrollingElement.scrollHeight) / 4; i++) {
                if (t > 10000) break;
                const w = isMobile ? (Math.random() * 250 + 100) : (Math.random() * 300 + 400),
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
                    o: bright[Math.floor(Math.random() * bright.length)],
                    speed: Math.random() * 0.2 + 0.02,
                    parallax: Math.random() * 0.4 + 0.4
                });
            }
            for (let i = 0; i < Math.sqrt(document.scrollingElement.scrollHeight * innerWidth) / 8; i++) {
                const r = Math.random() * 50 + 200,
                    x = Math.random() * (innerWidth - r + 400) - 200,
                    y = Math.random() * (document.scrollingElement.scrollHeight + 400) - 200
                circle.push({
                    x, y, r,
                    o: Math.random(),
                    d: Math.random() * 0.001 - 0.002,
                    speedx: Math.random() * 2 - 1,
                    speedy: Math.random() * 2 - 1,
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
            }, 200)
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
