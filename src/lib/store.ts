import {writable} from "svelte/store";
import {browser} from "$app/env";

function savable(name: string, value?: any) {
    const storedData = browser && localStorage.getItem("__svelte_" + name);
    const store = writable((storedData && JSON.parse(storedData)) || value);
    store.subscribe((value: any) => {
        browser && localStorage.setItem("__svelte_" + name, JSON.stringify(value));
    });
    return store;
}

export const age = savable('age', 0);

export const department = savable('department');
