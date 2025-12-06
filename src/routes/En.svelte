<script lang="ts">
    import Grid from "../components/Grid.svelte";
    import Region from "../components/Region.svelte";
    import Container from "../components/Container.svelte";
    import Age1Svg from "../assets/1st.svg";
    import MailSvg from "../assets/mail.svg";
    import LetterSvg from "../assets/letter.svg";
    import ToolSvg from "../assets/tool.svg";
    import SchoolSvg from "../assets/school.svg";
    import GearSvg from "../assets/gear.svg";
</script>

<Container full>
    <h1>Makes something in the world.</h1>
    <h4>Seohyun Lee, KAIST '22</h4>
    <div class="link">
        <Grid max="3" width="300">
            <a href="//github.com/seo-rii" target="_blank">
                <Region>
                    <img src="github.png" alt="github" height="50">
                    <p>Github <span>@seo-rii</span></p>
                </Region>
            </a>
            <a href="//log.seorii.page" target="_blank">
                <Region>
                    <MailSvg width="50" height="50" viewBox="0 0 512 512"/>
                    <p>Blog <span>log.seorii.page</span></p>
                </Region>
            </a>
            <a href="mailto:me@seorii.page">
                <Region>
                    <LetterSvg width="50" height="50" viewBox="0 0 32 32"/>
                    <p>Mail <span>me@seorii.page</span></p>
                </Region>
            </a>
        </Grid>
    </div>
</Container>
<Container>
    <h1>
        <SchoolSvg width="40" height="40" viewBox="0 0 512 512"/>
        Where I was
    </h1>
    <p>I graduated from <a href="https://iasa.icehs.kr/">Incheon Academy of Science and Arts</a> and am currently studying Computer Science at <a href="https://kaist.ac.kr">KAIST</a>, class of '22.</p>
    <p>I worked as a developer at <a href="https://dimension.company/">The Dimension Company</a> from December 2022 to August 2023, building a metaverse community called PLAT.</p>
    <p>I interned on the ML team at <a href="https://ringleplus.com/">Ringle Education Co., Ltd.</a> from July 2024 to November 2024.</p>
    <p>I served as president of the <a href="https://vlab-kaist.github.io/">AI club VLAB</a> from September 2023 to May 2024 and remain an active member.</p>
    <p>I worked at <a href="https://casyslab.kaist.ac.kr/">CASYS Lab</a> as a research intern from December 2024 to February 2025, researching multi-tier memory systems.</p>
    <p>I will serve in the Republic of Korea Air Force from April 2025 to January 2027.</p>
</Container>
<Container>
    <h1>
        <ToolSvg width="40" height="40" viewBox="0 0 512 512"/>
        What I made
    </h1>
    <p>I build all kinds of software, from algorithmic tooling to production websites.</p>
    <a href="https://jungol.co.kr" target="_blank"><h3>Jungol</h3></a>
    <p>I rebuilt the algorithm training website run by HancomEducation.</p>
    <ul>
        <li>Redeveloped every service, including the online judge.</li>
        <li>Frontend is an MPA built with Svelte.</li>
        <li>Supports serverless execution of source code on WASM. C is compiled on-device with the wasm build of gcc/ld, and Python runs via Pyodide.</li>
        <li>Added LSP-style code intelligence in the web editor.</li>
        <li>Backend uses Node.js with the HonoJS framework.</li>
        <li>Built my own API query framework similar to TanStack Query with end-to-end type safety and optional SSR.</li>
        <li>Adopted a microservices architecture.</li>
        <li><a href="https://github.com/HancomAC/crunchy" target="_blank">Deployment tool</a> is also self-developed. It automatically creates dev previews on GitHub and ships to production with one click.
        </li>
        <li>The problem judge was implemented in-house. A fork named <a
                href="https://github.com/HancomAC/hana" target="_blank">HANA</a>
            is distributed under MIT license.
        </li>
        <li>The service runs on Google Cloud, actively using features like Pub/Sub, Arc, and GKE rather than only Compute Engine.
        </li>
        <li>I use Terraform to manage Infrastructure as Code.</li>
        <li>I use Sentry to collect error logs automatically and fix them quickly.</li>
    </ul>
    <a href="https://codepass.co.kr" target="_blank"><h3>codepass</h3></a>
    <p>Enterprise version of Jungol.</p>
    <p>Companies such as Samsung Electronics' DS division (including overseas), Samsung Display, Semes, and Steco use it for algorithm
        training.</p>
    <a href="//github.com/seo-rii/kaporido_v2" target="_blank"><h3>kaporido</h3></a>
    <p>GUI implementation of Puoribor, the official game environment in the AI division of the 2023 KAIST-POSTECH
        student competition.</p>
    <p>You can find the <a href="//github.com/seo-rii/loq2">SDK</a> here. It provides a Python API and is fast since it's written in C++.</p>
    <a href="https://ttl.seorii.page" target="_blank"><h3>TTL</h3></a>
    <p>A timetable creation website for KAIST.</p>
    <p>It automatically crawls and updates timetables from the academic system.</p>
    <p>About 2,000 WAU during the course registration week.</p>
    <p>Peaked at 1,400 concurrent users (30-minute window).</p>
    <a href="https://www.ringleplus.com" target="_blank"><h3>Ringle AI Tutor</h3></a>
    <p>I developed the AI Tutor feature for Ringle.</p>
    <ul>
            <li>Built with React, React Native, and Ruby on Rails.</li>
            <li>Handled streaming and audio processing workloads.</li>
    </ul>
    <p>Improved the AI evaluation system.</p>
    <ul>
            <li>Optimized Python code for about 5x speedup, enabling real-time voice diagnosis.</li>
            <li>Worked on infrastructure such as processing pipelines and k8s deployment.</li>
    </ul>
    <h3>PLAT</h3>
    <p>Metaverse community originally developed by HereWe Co. (now The Dimension Company).</p>
    <ul>
        <li>Three.js-based metaverse application. We developed a helper library for 3D object placement and
            operations.
        </li>
        <li>I implemented video calls using WebRTC.</li>
        <li>I implemented a horizontally scalable WebSocket system using message queues.</li>
        <li>I implemented a Svelte-based plugin system.</li>
    </ul>
    <h3>HyperCLOVA X</h3>
    <p>Prepared text data for training HyperclovaX, a large language model from Naver, in a format optimized for learning.</p>
    <p>Processed over 150GB across 10 million text entries.</p>
</Container>
<Container>
    <h1>
        <GearSvg width="40" height="40" viewBox="0 0 32 32"/>
        Open source I made
    </h1>
    <p>I build and share open-source libraries while relying on many others.</p>
    <a href="https://github.com/seo-rii/electron-acrylic-window" target="_blank"><h3>electron-acrylic-window
        (deprecated)</h3></a>
    <ul>
        <li>A module that gives acrylic effects to the background of Electron programs in Windows 10/11.</li>
    </ul>
    <a href="https://seorii.page/tiptap" target="_blank"><h3>@seorii/tiptap</h3></a>
    <ul>
        <li>WYSIWYG editor with multiple modules added based on tiptap.</li>
    </ul>
    <a href="https://seorii.page/nunui" target="_blank"><h3>nunui</h3></a>
    <ul>
        <li>Material 3-based Svelte component library.</li>
        <li>It has been used for various projects such as Jungol.</li>
    </ul>
    <a href="https://seorii.page/wasm-idle" target="_blank"><h3>wasm-idle</h3></a>
    <ul>
        <li>Source code executor written based on WASM.</li>
        <li>C++ and Python code can be executed without a server.</li>
    </ul>
</Container>
<Container>
    <h1>
        <Age1Svg width="40" height="40" viewBox="0 0 1024 1024"/>
        Awards I got
    </h1>
    <p>I enjoy solving algorithm problems. Here are some awards.</p>
    <ul>
        <li>ICPC 2024 Seoul Regional, 64th</li>
        <li>ICPC 2024 Seoul Regional Qualification Round, 45th</li>
        <li>UCPC 2024 Final Round, 44th</li>
        <li>UCPC 2024 Qualification Round, 45th</li>
        <li>UCPC 2023 Final Round, 38th</li>
        <li>UCPC 2023 Qualification Round, 40th</li>
        <li>ICPC 2022 Seoul Regional, 40th</li>
        <li>ICPC 2022 Seoul Regional Qualification Round, 16th</li>
        <li>UCPC 2022 Final Round, 39th</li>
        <li>UCPC 2022 Qualification Round, 38th</li>
        <li>KOI 2021, Final Round, Silver Medal</li>
        <li>KOI 2021, Qualification Round, Silver Medal</li>
        <li>KOI 2019, Final Round, Bronze Medal</li>
        <li>KOI 2019, Qualification Round, Silver Medal</li>
        <li>KCF 2018, Final Round, 2nd place</li>
        <li>KOI 2018, Final Round, Silver Medal</li>
        <li>KOI 2018, Qualification Round, Silver Medal</li>

        <li>Incheon student SW hackathon 2020, 1st</li>
    </ul>
</Container>
