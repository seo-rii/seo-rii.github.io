import { mount } from 'svelte';
import Portfolio from '../src/components/Portfolio.svelte';
import '../src/app.css';

const target = document.getElementById('portfolio');
if (!target) throw new Error('Missing portfolio mount point');
mount(Portfolio, { target });
