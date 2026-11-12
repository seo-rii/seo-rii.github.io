import { normalizeSettings } from './settings.js';

/** A renderer snapshot is loaded only on export, not in the animation hot path.
 * It is generated from source rather than Function#toString so exports still
 * work after Vite minification, bundling and SvelteKit SSR.
 */
export async function createViewerHTML(input = {}, { title = '수묵설 · 보기 전용' } = {}) {
  const settings = normalizeSettings(input);
  const { VIEWER_RUNTIME } = await import('./viewer-runtime.js');
  const safeTitle = String(title).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const data = JSON.stringify(settings).replace(/</g, '\\u003c');
  const code = VIEWER_RUNTIME.replace(/<\/script/gi, '<\\/script');
  const closeScript = '<' + '/script>';
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="${settings.theme}">
<title>${safeTitle}</title>
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${settings.backgroundColor}}#snow-viewer{position:fixed;inset:0;width:100%;height:100%;height:100dvh}</style>
</head><body><main id="snow-viewer" aria-label="수묵설 보기 전용 화면"></main>
<noscript>이 풍경을 재생하려면 JavaScript를 허용해 주세요.</noscript>
<script type="application/json" id="ink-snow-settings">${data}${closeScript}
<script>(()=>{\n${code}\nconst saved=JSON.parse(document.getElementById('ink-snow-settings').textContent);
mountInkSnow(document.getElementById('snow-viewer'),{settings:saved,readOnly:true,controls:false});
})();${closeScript}</body></html>`;
}
