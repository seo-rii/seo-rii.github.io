import {sveltekit} from '@sveltejs/kit/vite';
import path from "path";
import svg from "@poppanator/sveltekit-svg";

/** @type {import('vite').UserConfig} */
const config = {
    plugins: [sveltekit(), svg()],
};

export default config;
