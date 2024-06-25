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
    <h4>Seohyun Lee, KAIST 22</h4>
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
    <p>I am currently attending the School of Computing,
        Korea Advanced Institute of Science and Technology since 2022.</p>
    <p>I graduated Incheon Academy of Science and Arts.</p>
    <p>From December 2021 to August 22, I worked as a developer at Herewe, Inc. At there, I developed PLAT, a metaverse
        based community tool.</p>
    <p>I work as an teaching assistant and developer at the HancomEducation.</p>
</Container>
<Container>
    <h1>
        <ToolSvg width="40" height="40" viewBox="0 0 512 512"/>
        What I made
    </h1>
    <p>Makes various programs. They create everything from algorithmic troubleshooting code to websites.</p>
    <a href="https://jungol.co.kr" target="_blank"><h3>Jungol</h3></a>
    <p>I renewed algorithm training website run by HancomEducation.</p>
    <ul>
        <li>I've redeveloped all services, including judger.</li>
        <li>The frontend is a SPA using a Svelte.</li>
        <li>Supports serverless execution of source code created based on WASM.</li>
        <li>Implemented LSP functionality to support intelligence in web editors.</li>
        <li>Backend was built using nodejs. It uses HonoJS framework.</li>
        <li>I adopted the MSA structure.</li>
        <li><a href="https://github.com/HancomAC/crunchy" target="_blank">Deployment tool</a> is also
            self-developed. It automatically creates dev preview when deployed on Github.
            I have automated entire system so that it can be distributed to the Production
            server with just one click of a button.
        </li>
        <li>The problem judger has been implemented by myself. Forked version named <a
                href="https://github.com/HancomAC/hana" target="_blank">HANA</a>
            is distributed under MIT license.
        </li>
        <li>The service is on the Google Cloud platform, and it actively utilized features like Pubsub, Arc, and GKE,
            not simple features like Compute Engine.
        </li>
    </ul>
    <a href="https://codepass.co.kr" target="_blank"><h3>codepass</h3></a>
    <p>Enterprise service version of Jungol.</p>
    <p>Companies such as Samsung Electronics' DS division, Samsung Display, Semes, and Steco are using it for algorithm
        training.</p>
    <a href="//github.com/seo-rii/kaporido_v2" target="_blank"><h3>kaporido</h3></a>
    <p>This is the GUI implementation of puoribor, a official game environment in the AI division of 2023 KAIST-POSTECH
        student competition.</p>
    <p>You can find <a href="//github.com/seo-rii/loq2">SDK</a> over here. It is an API for python env, and it's fast
        since it's written in C++.</p>
    <span href="" target="_blank"><h3>Naddal</h3></span>
    <p>Paper viewer service.</p>
    <p>It is currently being developed.</p>
</Container>
<Container>
    <h1>
        <GearSvg width="40" height="40" viewBox="0 0 32 32"/>
        Opensources I made
    </h1>
    <p>I've made some open source libraries. I also use a lot of open sources, so I'm going to share the code for
        others.</p>
    <a href="https://github.com/seo-rii/electron-acrylic-window" target="_blank"><h3>electron-acrylic-window
        (deprecated)</h3></a>
    <ul>
        <li>A module that gives acrylic effects to the background of the electron program in Windows 10/11.</li>
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
        <li>C++, Python code can be executed without a server.</li>
    </ul>
</Container>
<Container>
    <h1>
        <Age1Svg width="40" height="40" viewBox="0 0 1024 1024"/>
        Awards I got
    </h1>
    <p>I like to solve algorithm problems. I've got some awards from them.</p>
    <ul>
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
    </ul>
</Container>
