import {sveltekit} from '@sveltejs/kit/vite';
import path from "path";
import svg from "@poppanator/sveltekit-svg";

/** @type {import('vite').UserConfig} */
const config = {
    plugins: [sveltekit(), svg()],
    resolve: {
        alias: {
            '$lib': path.resolve('./src/lib'),
            '$comp': path.resolve('./src/components'),
        }
    },
};

export default config;
