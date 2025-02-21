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
    <p><a href="https://dimension.company/">The Dimension Company</a>에서 22년 12월부터 23년 8월까지 개발자로 근무했었습니다. PLAT이라는 메타버스 커뮤니티를 개발했습니다.</p>
    <p>주식회사 링글에듀케이션에서 24년 7월부터 24년 11월까지 ML팀 인턴으로 근무했었습니다.</p>
    <p>인공지능 동아리 VLAB에서 23년 9월부터 24년 5월까지 회장직을 맡았습니다. 현재도 일반 회원으로써 계속 활동하고 있습니다.</p>
    <p><a href="https://casyslab.kaist.ac.kr/">CASYS Lab</a>에서 24년 12월부터 25년 3월까지 랩인턴으로 근무했습니다. Tiered Memory 시스템과 관련한 연구를 진행했습니다.</p>
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
        <li>프론트엔드는 스벨트를 사용한 MPA입니다.</li>
        <li>웹어셈블리 기반으로 작성한 소스 코드 실행을 서버 없이 지원합니다. gcc와 ld의 웹어셈블리를 이용하여 컴파일도 프론트엔드에서 수행합니다. 파이썬 실행은 pyodide를 이용합니다.</li>
        <li>LSP 서버를 구현해 웹에서 인텔리센스를 사용하여 코딩할 수 있습니다.</li>
        <li>백엔드는 node와 typescript를 사용하여 제작했습니다. honojs 프레임워크를 사용했으며, 더욱 쉬운 MSA 개발을 위해 이를 래핑하는 <a
                href="https://github.com/HancomAC/bedrock" target="_blank">프레임워크</a>를 만들었습니다.
        </li>
        <li>Tanstack Query와 유사한 자체 쿼리 프레임워크를 구현했습니다. E2E type safety를 지원하며, 간단한 설정으로 SSR에서 로딩할 데이터를 설정할 수도 있습니다.</li>
        <li>MSA 구조를 채용했으며, 메시지 큐를 이용하여 무거운 작업을 비동기적으로 처리합니다.</li>
        <li><a href="https://github.com/HancomAC/crunchy" target="_blank">배포 도구</a> 역시 자체 개발했습니다. Github에 배포 시 자동으로 베타
            서버에 배포되며, 버튼 클릭으로 이를 Production 서버에 배포할 수 있도록 자동화 했습니다.
        </li>
        <li>문제 채점기는 직접 구현했습니다. 이 채점기에서 일부 기능이 빠진 버전이 <a href="https://github.com/HancomAC/hana" target="_blank">HANA</a>라는
            이름으로 오픈소스로 공개되어 있습니다.
        </li>
        <li>서비스는 구글 클라우드 플랫폼에서 이루어지며, Compute Engine같은 단순한 기능만이 아닌 Pubsub, Arc, GKE와 같은 기능을 적극적으로 활용했습니다.</li>
        <li>Terraform으로 인프라를 관리합니다.</li>
        <li>Sentry를 사용하여 오류 로그를 자동으로 수집하여 대응하고 있습니다.</li>
    </ul>
    <a href="https://codepass.co.kr" target="_blank"><h3>codepass</h3></a>
    <p>Jungol의 B2B 버전입니다.</p>
    <p>현재 삼성전자 DS부서(Overseas 포함), 삼성 디스플레이, Semes, and Steco와 같은 회사에서 알고리즘 교육용으로 사용되고 있습니다.</p>
    <a href="//github.com/seo-rii/kaporido_v2" target="_blank"><h3>kaporido</h3></a>
    <p>2023년 카이스트-포스텍 학생대제전 인공지능부문 게임인 puoribor의 GUI 구현체입니다.</p>
    <p>SDK는 <a href="//github.com/seo-rii/loq2">여기</a> 있습니다. 파이썬에서 환경과 상호작용 할 수 있도록 만들어졌으며, C++으로 작성되어 빠르게 상호작용 할 수
        있습니다.</p>
    <a href="https://ttl.seorii.page" target="_blank"><h3>TTL</h3></a>
    <p>카이스트 시간표 작성 웹사이트입니다.</p>
    <p>학사시스템에서 자동으로 시간표를 크롤링하여 업데이트합니다.</p>
    <p>수강신청 주간에 평균 약 2,000명의 유저(WAU)가 사용합니다.</p>
    <p>최대 동시접속자(30분간 세션) 1,400명을 기록했습니다.</p>
    <a href="https://www.ringleplus.com" target="_blank"><h3>Ringle AI Tutor</h3></a>
    <p>링글의 AI Tutor 기능을 개발했습니다.</p>
    <ul>
        <li>리액트/리액트 네이티브/Ruby on Rails를 사용했습니다.</li>
        <li>스트리밍 처리/오디오 처리와 관련한 기술을 다뤘습니다.</li>
    </ul>
    <p>AI 평가 시스템을 개선했습니다.</p>
    <ul>
        <li>파이썬 코드를 최적화해 속도를 약 5배정도 향상시켰습니다. 이를 통해 실시간 음성 진단 기능을 구현했습니다.</li>
        <li>처리 파이프라인/k8s 배포와 같은 인프라 부분도 작업했습니다.</li>
    </ul>
    <h3>PLAT</h3>
    <p>메타버스 커뮤니티입니다. 여기우리(현 The Dimension Company)에서 초기에 개발했던 제품입니다.</p>
    <ul>
        <li>Three.js 기반의 메타버스 커뮤니티입니다. 3차원 객체 배치 및 연산을 위한 헬퍼 라이브러리를 자체 개발했습니다.</li>
        <li>WebRTC를 사용하여 화상 통화를 구현했습니다.</li>
        <li>메시지 큐를 사용하여 수평 확장 가능한 WS 시스템을 구현했습니다.</li>
        <li>스벨트 기반의 플러그인 시스템을 구현했습니다.</li>
    </ul>
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
