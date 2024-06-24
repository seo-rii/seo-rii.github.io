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
    <h1>이 세상의 어떤 것을 만듭니다.</h1>
    <h4>이서현, KAIST 22</h4>
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
        다닌 곳
    </h1>
    <p>인천과학예술영재학교를 나왔고, 현재 한국과학기술원 전산학부 22학번으로 재학하고 있습니다.</p>
    <p>주식회사 여기우리에서 개발자로 근무하고 있으며, 한글과컴퓨터학원에서도 조교 및 개발자로 근무하고 있습니다.</p>
</Container>
<Container>
    <h1>
        <ToolSvg width="40" height="40" viewBox="0 0 512 512"/>
        만든 것
    </h1>
    <p>여러 프로그램을 만듭니다. 알고리즘 문제 해결용 코드부터 웹사이트까지 가리지 않고 만듭니다.</p>
    <a href="https://jungol.co.kr" target="_blank"><h3>Jungol</h3></a>
    <p>한글과컴퓨터학원에서 운영하는 온라인 저지를 리뉴얼 했습니다.</p>
    <ul>
        <li>채점기를 포함한 모든 서비스를 재개발했습니다.</li>
        <li>프론트엔드는 스벨트를 사용한 SPA입니다. PWA도 지원합니다. 처음에는 리액트로 개발하다 스벨트로 전환했습니다.</li>
        <li>웹어셈블리 기반으로 작성한 소스 코드 실행을 서버 없이 지원합니다.</li>
        <li>백엔드는 node와 typescript를 사용하여 제작했습니다. express 프레임워크를 사용했으며, 더욱 쉬운 MSA 개발을 위해 이를 래핑하는 <a
                href="https://github.com/HancomAC/bedrock" target="_blank">프레임워크</a>를 만들었습니다.
        </li>
        <li>MSA 구조를 채용했으며, 메시지 큐를 이용하여 무거운 작업을 비동기적으로 처리합니다.</li>
        <li><a href="https://github.com/HancomAC/crunchy" target="_blank">배포 도구</a> 역시 자체 개발했습니다. Github에 배포 시 자동으로 베타
            서버에 배포되며, 버튼 클릭으로 이를 Production 서버에 배포할 수 있도록 자동화 했습니다.
        </li>
        <li>문제 채점기는 직접 구현했습니다. 이 채점기에서 일부 기능이 빠진 버전이 <a href="https://github.com/HancomAC/hana" target="_blank">HANA</a>라는
            이름으로 오픈소스로 공개되어 있습니다.
        </li>
        <li>서비스는 구글 클라우드 플랫폼에서 이루어지며, Compute Engine같은 단순한 기능만이 아닌 Pubsub, Arc, GKE와 같은 기능을 적극적으로 활용했습니다.</li>
    </ul>
    <a href="https://codepass.co.kr" target="_blank"><h3>codepass</h3></a>
    <p>Jungol의 B2B 버전입니다..</p>
    <p>삼성전자 DS부서, 삼성 디스플레이, Semes, and Steco와 같은 회사에서 알고리즘 교육용으로 사용되고 있습니다.</p>
    <a href="//github.com/vlab-kaist/kaporido" target="_blank"><h3>kaporido</h3></a>
    <p>카이스트-포스텍 학생대제전 인공지능부문 게임인 puoribor의 GUI 구현체입니다.</p>
    <p>대회 안내 영상 제작에 사용되었습니다.</p>
    <span href="" target="_blank"><h3>AfterSchool</h3></span>
    <p>문제 저장 및 포맷팅 프로그램입니다.</p>
    <p>현재 개발 중입니다.</p>
    <span href="" target="_blank"><h3>낮달</h3></span>
    <p>논문 뷰어 서비스입니다.</p>
    <p>현재 개발 중입니다.</p>
</Container>
<Container>
    <h1>
        <GearSvg width="40" height="40" viewBox="0 0 32 32"/>
        오픈소스
    </h1>
    <p>몇 가지 오픈소스를 만들었습니다. 저 또한 많은 오픈소스를 이용하고 있기에, 저도 다른 사람들을 위해 코드를 공유하려 합니다.</p>
    <a href="https://github.com/seo-rii/electron-acrylic-window" target="_blank"><h3>electron-acrylic-window
        (deprecated)</h3></a>
    <ul>
        <li>윈도우 10/11에서 electron 프로그램의 배경에 아크릴 효과를 부여하는 모듈입니다.</li>
    </ul>
    <a href="https://seorii.page/tiptap" target="_blank"><h3>@seorii/tiptap</h3></a>
    <ul>
        <li>tiptap 기반으로 여러 모듈을 추가한 WYSIWYG 에디터입니다.</li>
    </ul>
    <a href="https://seorii.page/nunui" target="_blank"><h3>nunui</h3></a>
    <ul>
        <li>Material 3 기반 스벨트 컴포넌트 라이브러리입니다.</li>
        <li>Jungol 등 다양한 프로젝트에 사용되었습니다.</li>
    </ul>
    <a href="https://seorii.page/wasm-idle" target="_blank"><h3>wasm-idle</h3></a>
    <ul>
        <li>웹어셈블리 기반으로 작성한 소스 코드 실행기입니다.</li>
        <li>C++, Python 코드를 서버 없이 실행시킬 수 있습니다.</li>
    </ul>
</Container>
<Container>
    <h1>
        <Age1Svg width="40" height="40" viewBox="0 0 1024 1024"/>
        받은 상
    </h1>
    <p>알고리즘 문제 해결을 좋아합니다. 몇 가지 상도 받았습니다.</p>
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
