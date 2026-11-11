<script lang="ts">
	import Container from '../components/Container.svelte';
</script>

<Container id="about" index="01" title="Where I've been">
	<p>
		I graduated from <a href="https://iasa.icehs.kr/">Incheon Academy of Science and Arts</a> and am
		currently studying Computer Science at <a href="https://kaist.ac.kr">KAIST</a>, which I entered
		in 2022.
	</p>
	<p>
		I worked as a developer at <a href="https://dimension.company/">The Dimension Company</a> from December
		2022 to August 2023, building a metaverse community called PLAT.
	</p>
	<p>
		I interned on the ML team at <a href="https://ringleplus.com/">Ringle Education Co., Ltd.</a> from
		July 2024 to November 2024.
	</p>
	<p>
		I served as president of the <a href="https://vlab-kaist.github.io/">AI club VLAB</a> from September
		2023 to May 2024 and remain an active member.
	</p>
	<p>
		I worked at <a href="https://casyslab.kaist.ac.kr/">CASYS Lab</a> as a research intern from December
		2024 to February 2025, researching multi-tier memory systems.
	</p>
	<p>
		I am serving in the AI Systems Development Unit of the Republic of Korea Air Force's Intelligent
		Information Systems Management Group (April 2025–January 2027).
	</p>
</Container>

<Container id="projects" index="02" title="What I've built">
	<p>I build all kinds of software, from algorithmic tooling to production websites.</p>

	<article>
		<h3><a href="https://jungol.co.kr" target="_blank" rel="noreferrer">Jungol</a></h3>
		<p>I rebuilt the algorithm training website run by HancomEducation.</p>
		<ul>
			<li>Redeveloped every service, including the online judge.</li>
			<li>The frontend is an MPA built with Svelte.</li>
			<li>
				Supports serverless execution of source code on WebAssembly. C is compiled on-device with
				WebAssembly builds of GCC and ld, and Python runs via Pyodide.
			</li>
			<li>Added LSP-style code intelligence in the web editor.</li>
			<li>
				The backend uses Node.js/TypeScript with the Hono framework, wrapped with my own <a
					href="https://github.com/HancomAC/bedrock"
					target="_blank"
					rel="noreferrer">framework</a
				> to simplify MSA builds.
			</li>
			<li>
				Built my own API query framework similar to TanStack Query with end-to-end type safety and
				optional SSR.
			</li>
			<li>Adopted a microservices architecture.</li>
			<li>Uses message queues to offload heavy tasks asynchronously.</li>
			<li>
				I also developed the <a
					href="https://github.com/HancomAC/crunchy"
					target="_blank"
					rel="noreferrer">deployment tool</a
				>. It automatically deploys to a beta server when code is pushed to GitHub and ships to
				production with one click.
			</li>
			<li>
				The problem judge was implemented in-house. A fork named <a
					href="https://github.com/HancomAC/hana"
					target="_blank"
					rel="noreferrer">HANA</a
				>
				is distributed under the MIT license.
			</li>
			<li>
				The service runs on Google Cloud, actively using features like Pub/Sub, Arc, and GKE rather
				than only Compute Engine.
			</li>
			<li>I use Terraform to manage Infrastructure as Code.</li>
			<li>I use Sentry to collect error logs automatically and fix them quickly.</li>
		</ul>
	</article>

	<article>
		<h3><a href="https://codepass.co.kr" target="_blank" rel="noreferrer">codepass</a></h3>
		<p>Enterprise version of Jungol.</p>
		<p>
			Companies such as Samsung Electronics' DS division (including overseas), Samsung Display,
			SEMES, and STECO use it for algorithm training.
		</p>
	</article>

	<article>
		<h3>
			<a href="https://github.com/seo-rii/kaporido_v2" target="_blank" rel="noreferrer">kaporido</a>
		</h3>
		<p>
			GUI implementation of Puoribor, the official game environment in the AI division of the 2023
			KAIST-POSTECH student competition.
		</p>
		<p>
			You can find the <a href="https://github.com/seo-rii/loq2">SDK</a> here. It provides a Python API
			and is fast since it's written in C++.
		</p>
	</article>

	<article>
		<h3><a href="https://ttl.seorii.page" target="_blank" rel="noreferrer">TTL</a></h3>
		<p>A timetable creation website for KAIST.</p>
		<p>It automatically crawls and updates timetables from the academic system.</p>
		<p>About 2,000 weekly active users (WAU) during course registration week.</p>
		<p>Peaked at 1,400 concurrent users (30-minute window).</p>
	</article>

	<article>
		<h3>
			<a href="https://www.ringleplus.com" target="_blank" rel="noreferrer">Ringle AI Tutor</a>
		</h3>
		<p>I developed the AI Tutor feature for Ringle.</p>
		<ul>
			<li>Built with React, React Native, and Ruby on Rails.</li>
			<li>Handled streaming and audio processing workloads.</li>
		</ul>
		<p>Improved the AI evaluation system.</p>
		<ul>
			<li>
				Optimized Python code to run about five times faster, enabling real-time speech assessment.
			</li>
			<li>Worked on infrastructure such as processing pipelines and k8s deployment.</li>
		</ul>
	</article>

	<article>
		<h3>PLAT</h3>
		<p>
			Metaverse community originally developed by HereWe Co. (now <a
				href="https://dimension.company/">The Dimension Company</a
			>).
		</p>
		<ul>
			<li>
				Three.js-based metaverse application. We developed a helper library for 3D object placement
				and operations.
			</li>
			<li>I implemented video calls using WebRTC.</li>
			<li>I implemented a horizontally scalable WebSocket system using message queues.</li>
			<li>I implemented a Svelte-based plugin system.</li>
		</ul>
	</article>

	<article>
		<h3>HyperCLOVA X</h3>
		<p>
			Prepared text data for training HyperCLOVA X, a large language model from NAVER, in a format
			optimized for learning.
		</p>
		<p>Processed and provided at least 150 GB of data across at least 10 million text files.</p>
	</article>
</Container>

<Container id="opensource" index="03" title="Open source">
	<p>I build and share open-source libraries while relying on many others.</p>

	<article>
		<h3>
			<a href="https://github.com/seo-rii/electron-acrylic-window" target="_blank" rel="noreferrer"
				>electron-acrylic-window (deprecated)</a
			>
		</h3>
		<ul>
			<li>
				A module that gives acrylic effects to the background of Electron programs on Windows 10/11.
			</li>
		</ul>
	</article>

	<article>
		<h3>
			<a href="https://seorii.page/tiptap" target="_blank" rel="noreferrer">@seorii/tiptap</a>
		</h3>
		<ul>
			<li>A WYSIWYG editor built on Tiptap with additional modules.</li>
		</ul>
	</article>

	<article>
		<h3><a href="https://seorii.page/nunui" target="_blank" rel="noreferrer">nunui</a></h3>
		<ul>
			<li>Material 3-based Svelte component library.</li>
			<li>It has been used for various projects such as Jungol.</li>
		</ul>
	</article>

	<article>
		<h3><a href="https://seorii.page/wasm-idle" target="_blank" rel="noreferrer">wasm-idle</a></h3>
		<ul>
			<li>A WebAssembly-based source code runner.</li>
			<li>C++ and Python code can be executed without a server.</li>
		</ul>
	</article>
</Container>

<Container id="awards" index="04" title="Awards">
	<p>I enjoy solving algorithmic problems. Here are some awards.</p>
	<ul>
		<li>Republic of Korea Air Force Startup Competition, Creativity Award</li>
		<li>Cryptanalysis Competition, 777th Command Commander's Award</li>
		<li>NASA Space Apps Challenge 2025, Global Finalist</li>
		<li>KAIST-Upstage LLM Project Hackathon, 1st</li>
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

		<li>Incheon Student SW Hackathon 2020, 1st</li>
	</ul>
</Container>
