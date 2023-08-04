var rt=Object.defineProperty;var ot=(t,e,n)=>e in t?rt(t,e,{enumerable:!0,configurable:!0,writable:!0,value:n}):t[e]=n;var $=(t,e,n)=>(ot(t,typeof e!="symbol"?e+"":e,n),n);import{n as x,r as N,m as H,c as S,i as F,p as I,q as lt,v as at,w as ct,x as ft,y as O,z as ut,A as dt,B as _t}from"./scheduler.7af425b0.js";const V=typeof window<"u";let J=V?()=>window.performance.now():()=>Date.now(),D=V?t=>requestAnimationFrame(t):x;const w=new Set;function K(t){w.forEach(e=>{e.c(t)||(w.delete(e),e.f())}),w.size!==0&&D(K)}function Q(t){let e;return w.size===0&&D(K),{promise:new Promise(n=>{w.add(e={c:t,f:n})}),abort(){w.delete(e)}}}let k=!1;function ht(){k=!0}function mt(){k=!1}function pt(t,e,n,i){for(;t<e;){const s=t+(e-t>>1);n(s)<=i?t=s+1:e=s}return t}function yt(t){if(t.hydrate_init)return;t.hydrate_init=!0;let e=t.childNodes;if(t.nodeName==="HEAD"){const l=[];for(let a=0;a<e.length;a++){const u=e[a];u.claim_order!==void 0&&l.push(u)}e=l}const n=new Int32Array(e.length+1),i=new Int32Array(e.length);n[0]=-1;let s=0;for(let l=0;l<e.length;l++){const a=e[l].claim_order,u=(s>0&&e[n[s]].claim_order<=a?s+1:pt(1,s,d=>e[n[d]].claim_order,a))-1;i[l]=n[u]+1;const f=u+1;n[f]=l,s=Math.max(f,s)}const r=[],o=[];let c=e.length-1;for(let l=n[s]+1;l!=0;l=i[l-1]){for(r.push(e[l-1]);c>=l;c--)o.push(e[c]);c--}for(;c>=0;c--)o.push(e[c]);r.reverse(),o.sort((l,a)=>l.claim_order-a.claim_order);for(let l=0,a=0;l<o.length;l++){for(;a<r.length&&o[l].claim_order>=r[a].claim_order;)a++;const u=a<r.length?r[a]:null;t.insertBefore(o[l],u)}}function U(t,e){t.appendChild(e)}function X(t){if(!t)return document;const e=t.getRootNode?t.getRootNode():t.ownerDocument;return e&&e.host?e:t.ownerDocument}function $t(t){const e=z("style");return e.textContent="/* empty */",gt(X(t),e),e.sheet}function gt(t,e){return U(t.head||t,e),e.sheet}function wt(t,e){if(k){for(yt(t),(t.actual_end_child===void 0||t.actual_end_child!==null&&t.actual_end_child.parentNode!==t)&&(t.actual_end_child=t.firstChild);t.actual_end_child!==null&&t.actual_end_child.claim_order===void 0;)t.actual_end_child=t.actual_end_child.nextSibling;e!==t.actual_end_child?(e.claim_order!==void 0||e.parentNode!==t)&&t.insertBefore(e,t.actual_end_child):t.actual_end_child=e.nextSibling}else(e.parentNode!==t||e.nextSibling!==null)&&t.appendChild(e)}function xt(t,e,n){t.insertBefore(e,n||null)}function vt(t,e,n){k&&!n?wt(t,e):(e.parentNode!==t||e.nextSibling!=n)&&t.insertBefore(e,n||null)}function v(t){t.parentNode&&t.parentNode.removeChild(t)}function z(t){return document.createElement(t)}function Y(t){return document.createElementNS("http://www.w3.org/2000/svg",t)}function R(t){return document.createTextNode(t)}function jt(){return R(" ")}function It(){return R("")}function W(t,e,n,i){return t.addEventListener(e,n,i),()=>t.removeEventListener(e,n,i)}function bt(t,e,n){n==null?t.removeAttribute(e):t.getAttribute(e)!==n&&t.setAttribute(e,n)}function Ot(t,e){for(const n in e)bt(t,n,e[n])}function Wt(t){return t.dataset.svelteH}function Nt(t){return Array.from(t.childNodes)}function Z(t){t.claim_info===void 0&&(t.claim_info={last_index:0,total_claimed:0})}function tt(t,e,n,i,s=!1){Z(t);const r=(()=>{for(let o=t.claim_info.last_index;o<t.length;o++){const c=t[o];if(e(c)){const l=n(c);return l===void 0?t.splice(o,1):t[o]=l,s||(t.claim_info.last_index=o),c}}for(let o=t.claim_info.last_index-1;o>=0;o--){const c=t[o];if(e(c)){const l=n(c);return l===void 0?t.splice(o,1):t[o]=l,s?l===void 0&&t.claim_info.last_index--:t.claim_info.last_index=o,c}}return i()})();return r.claim_order=t.claim_info.total_claimed,t.claim_info.total_claimed+=1,r}function et(t,e,n,i){return tt(t,s=>s.nodeName===e,s=>{const r=[];for(let o=0;o<s.attributes.length;o++){const c=s.attributes[o];n[c.name]||r.push(c.name)}r.forEach(o=>s.removeAttribute(o))},()=>i(e))}function qt(t,e,n){return et(t,e,n,z)}function Gt(t,e,n){return et(t,e,n,Y)}function Et(t,e){return tt(t,n=>n.nodeType===3,n=>{const i=""+e;if(n.data.startsWith(i)){if(n.data.length!==i.length)return n.splitText(i.length)}else n.data=i},()=>R(e),!0)}function Ft(t){return Et(t," ")}function q(t,e,n){for(let i=n;i<t.length;i+=1){const s=t[i];if(s.nodeType===8&&s.textContent.trim()===e)return i}return-1}function Vt(t,e){const n=q(t,"HTML_TAG_START",0),i=q(t,"HTML_TAG_END",n+1);if(n===-1||i===-1)return new G(e);Z(t);const s=t.splice(n,i-n+1);v(s[0]),v(s[s.length-1]);const r=s.slice(1,s.length-1);for(const o of r)o.claim_order=t.claim_info.total_claimed,t.claim_info.total_claimed+=1;return new G(e,r)}function Jt(t,e){e=""+e,t.data!==e&&(t.data=e)}function Kt(t,e,n,i){n==null?t.style.removeProperty(e):t.style.setProperty(e,n,i?"important":"")}let A;function At(){if(A===void 0){A=!1;try{typeof window<"u"&&window.parent&&window.parent.document}catch{A=!0}}return A}function Qt(t,e){getComputedStyle(t).position==="static"&&(t.style.position="relative");const i=z("iframe");i.setAttribute("style","display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; border: 0; opacity: 0; pointer-events: none; z-index: -1;"),i.setAttribute("aria-hidden","true"),i.tabIndex=-1;const s=At();let r;return s?(i.src="data:text/html,<script>onresize=function(){parent.postMessage(0,'*')}<\/script>",r=W(window,"message",o=>{o.source===i.contentWindow&&e()})):(i.src="about:blank",i.onload=()=>{r=W(i.contentWindow,"resize",e),e()}),U(t,i),()=>{(s||r&&i.contentWindow)&&r(),v(i)}}function Ut(t,e,n){t.classList.toggle(e,!!n)}function Tt(t,e,{bubbles:n=!1,cancelable:i=!1}={}){return new CustomEvent(t,{detail:e,bubbles:n,cancelable:i})}class St{constructor(e=!1){$(this,"is_svg",!1);$(this,"e");$(this,"n");$(this,"t");$(this,"a");this.is_svg=e,this.e=this.n=null}c(e){this.h(e)}m(e,n,i=null){this.e||(this.is_svg?this.e=Y(n.nodeName):this.e=z(n.nodeType===11?"TEMPLATE":n.nodeName),this.t=n.tagName!=="TEMPLATE"?n:n.content,this.c(e)),this.i(i)}h(e){this.e.innerHTML=e,this.n=Array.from(this.e.nodeName==="TEMPLATE"?this.e.content.childNodes:this.e.childNodes)}i(e){for(let n=0;n<this.n.length;n+=1)xt(this.t,this.n[n],e)}p(e){this.d(),this.h(e),this.i(this.a)}d(){this.n.forEach(v)}}class G extends St{constructor(n=!1,i){super(n);$(this,"l");this.e=this.n=null,this.l=i}c(n){this.l?this.n=this.l:super.c(n)}i(n){for(let i=0;i<this.n.length;i+=1)vt(this.t,this.n[i],n)}}function Xt(t,e){return new t(e)}const C=new Map;let L=0;function Ct(t){let e=5381,n=t.length;for(;n--;)e=(e<<5)-e^t.charCodeAt(n);return e>>>0}function Lt(t,e){const n={stylesheet:$t(e),rules:{}};return C.set(t,n),n}function nt(t,e,n,i,s,r,o,c=0){const l=16.666/i;let a=`{
`;for(let y=0;y<=1;y+=l){const p=e+(n-e)*r(y);a+=y*100+`%{${o(p,1-p)}}
`}const u=a+`100% {${o(n,1-n)}}
}`,f=`__svelte_${Ct(u)}_${c}`,d=X(t),{stylesheet:_,rules:h}=C.get(d)||Lt(d,t);h[f]||(h[f]=!0,_.insertRule(`@keyframes ${f} ${u}`,_.cssRules.length));const m=t.style.animation||"";return t.style.animation=`${m?`${m}, `:""}${f} ${i}ms linear ${s}ms 1 both`,L+=1,f}function B(t,e){const n=(t.style.animation||"").split(", "),i=n.filter(e?r=>r.indexOf(e)<0:r=>r.indexOf("__svelte")===-1),s=n.length-i.length;s&&(t.style.animation=i.join(", "),L-=s,L||Mt())}function Mt(){D(()=>{L||(C.forEach(t=>{const{ownerNode:e}=t.stylesheet;e&&v(e)}),C.clear())})}let b;function it(){return b||(b=Promise.resolve(),b.then(()=>{b=null})),b}function M(t,e,n){t.dispatchEvent(Tt(`${e?"intro":"outro"}${n}`))}const T=new Set;let g;function Yt(){g={r:0,c:[],p:g}}function Zt(){g.r||N(g.c),g=g.p}function Ht(t,e){t&&t.i&&(T.delete(t),t.i(e))}function te(t,e,n,i){if(t&&t.o){if(T.has(t))return;T.add(t),g.c.push(()=>{T.delete(t),i&&(n&&t.d(1),i())}),t.o(e)}else i&&i()}const st={duration:0};function ee(t,e,n){const i={direction:"in"};let s=e(t,n,i),r=!1,o,c,l=0;function a(){o&&B(t,o)}function u(){const{delay:d=0,duration:_=300,easing:h=F,tick:m=x,css:y}=s||st;y&&(o=nt(t,0,1,_,d,h,y,l++)),m(0,1);const p=J()+d,E=p+_;c&&c.abort(),r=!0,S(()=>M(t,!0,"start")),c=Q(P=>{if(r){if(P>=E)return m(1,0),M(t,!0,"end"),a(),r=!1;if(P>=p){const j=h((P-p)/_);m(j,1-j)}}return r})}let f=!1;return{start(){f||(f=!0,B(t),H(s)?(s=s(i),it().then(u)):u())},invalidate(){f=!1},end(){r&&(a(),r=!1)}}}function ne(t,e,n){const i={direction:"out"};let s=e(t,n,i),r=!0,o;const c=g;c.r+=1;let l;function a(){const{delay:u=0,duration:f=300,easing:d=F,tick:_=x,css:h}=s||st;h&&(o=nt(t,1,0,f,u,d,h));const m=J()+u,y=m+f;S(()=>M(t,!1,"start")),"inert"in t&&(l=t.inert,t.inert=!0),Q(p=>{if(r){if(p>=y)return _(0,1),M(t,!1,"end"),--c.r||N(c.c),!1;if(p>=m){const E=d((p-m)/f);_(1-E,E)}}return r})}return H(s)?it().then(()=>{s=s(i),a()}):a(),{end(u){u&&"inert"in t&&(t.inert=l),u&&s.tick&&s.tick(1,0),r&&(o&&B(t,o),r=!1)}}}function ie(t){t&&t.c()}function se(t,e){t&&t.l(e)}function kt(t,e,n){const{fragment:i,after_update:s}=t.$$;i&&i.m(e,n),S(()=>{const r=t.$$.on_mount.map(ut).filter(H);t.$$.on_destroy?t.$$.on_destroy.push(...r):N(r),t.$$.on_mount=[]}),s.forEach(S)}function zt(t,e){const n=t.$$;n.fragment!==null&&(ct(n.after_update),N(n.on_destroy),n.fragment&&n.fragment.d(e),n.on_destroy=n.fragment=null,n.ctx=[])}function Pt(t,e){t.$$.dirty[0]===-1&&(dt.push(t),_t(),t.$$.dirty.fill(0)),t.$$.dirty[e/31|0]|=1<<e%31}function re(t,e,n,i,s,r,o,c=[-1]){const l=ft;O(t);const a=t.$$={fragment:null,ctx:[],props:r,update:x,not_equal:s,bound:I(),on_mount:[],on_destroy:[],on_disconnect:[],before_update:[],after_update:[],context:new Map(e.context||(l?l.$$.context:[])),callbacks:I(),dirty:c,skip_bound:!1,root:e.target||l.$$.root};o&&o(a.root);let u=!1;if(a.ctx=n?n(t,e.props||{},(f,d,..._)=>{const h=_.length?_[0]:d;return a.ctx&&s(a.ctx[f],a.ctx[f]=h)&&(!a.skip_bound&&a.bound[f]&&a.bound[f](h),u&&Pt(t,f)),d}):[],a.update(),u=!0,N(a.before_update),a.fragment=i?i(a.ctx):!1,e.target){if(e.hydrate){ht();const f=Nt(e.target);a.fragment&&a.fragment.l(f),f.forEach(v)}else a.fragment&&a.fragment.c();e.intro&&Ht(t.$$.fragment),kt(t,e.target,e.anchor),mt(),lt()}O(l)}class oe{constructor(){$(this,"$$");$(this,"$$set")}$destroy(){zt(this,1),this.$destroy=x}$on(e,n){if(!H(n))return x;const i=this.$$.callbacks[e]||(this.$$.callbacks[e]=[]);return i.push(n),()=>{const s=i.indexOf(n);s!==-1&&i.splice(s,1)}}$set(e){this.$$set&&!at(e)&&(this.$$.skip_bound=!0,this.$$set(e),this.$$.skip_bound=!1)}}const Bt="4";typeof window<"u"&&(window.__svelte||(window.__svelte={v:new Set})).v.add(Bt);export{ne as A,wt as B,Qt as C,Ut as D,Y as E,Gt as F,Vt as G,G as H,Ot as I,oe as S,vt as a,Zt as b,Ft as c,Ht as d,It as e,v as f,z as g,qt as h,re as i,Nt as j,bt as k,Kt as l,R as m,Et as n,Jt as o,Yt as p,Xt as q,ie as r,jt as s,te as t,se as u,kt as v,zt as w,Wt as x,W as y,ee as z};
