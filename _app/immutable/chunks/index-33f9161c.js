function E(){}const V=t=>t;function ht(t,e){for(const n in e)t[n]=e[n];return t}function X(t){return t()}function J(){return Object.create(null)}function x(t){t.forEach(X)}function B(t){return typeof t=="function"}function Lt(t,e){return t!=t?e==e:t!==e||t&&typeof t=="object"||typeof t=="function"}let N;function Tt(t,e){return N||(N=document.createElement("a")),N.href=e,t===N.href}function mt(t){return Object.keys(t).length===0}function Wt(t,e,n,i){if(t){const r=Y(t,e,n,i);return t[0](r)}}function Y(t,e,n,i){return t[1]&&i?ht(n.ctx.slice(),t[1](i(e))):n.ctx}function Bt(t,e,n,i){if(t[2]&&i){const r=t[2](i(n));if(e.dirty===void 0)return r;if(typeof r=="object"){const c=[],o=Math.max(e.dirty.length,r.length);for(let l=0;l<o;l+=1)c[l]=e.dirty[l]|r[l];return c}return e.dirty|r}return e.dirty}function Ft(t,e,n,i,r,c){if(r){const o=Y(e,n,i,c);t.p(o,r)}}function It(t){if(t.ctx.length>32){const e=[],n=t.ctx.length/32;for(let i=0;i<n;i++)e[i]=-1;return e}return-1}function Ht(t){const e={};for(const n in t)n[0]!=="$"&&(e[n]=t[n]);return e}const Z=typeof window<"u";let tt=Z?()=>window.performance.now():()=>Date.now(),F=Z?t=>requestAnimationFrame(t):E;const g=new Set;function et(t){g.forEach(e=>{e.c(t)||(g.delete(e),e.f())}),g.size!==0&&F(et)}function nt(t){let e;return g.size===0&&F(et),{promise:new Promise(n=>{g.add(e={c:t,f:n})}),abort(){g.delete(e)}}}let O=!1;function pt(){O=!0}function yt(){O=!1}function gt(t,e,n,i){for(;t<e;){const r=t+(e-t>>1);n(r)<=i?t=r+1:e=r}return t}function xt(t){if(t.hydrate_init)return;t.hydrate_init=!0;let e=t.childNodes;if(t.nodeName==="HEAD"){const s=[];for(let u=0;u<e.length;u++){const f=e[u];f.claim_order!==void 0&&s.push(f)}e=s}const n=new Int32Array(e.length+1),i=new Int32Array(e.length);n[0]=-1;let r=0;for(let s=0;s<e.length;s++){const u=e[s].claim_order,f=(r>0&&e[n[r]].claim_order<=u?r+1:gt(1,r,d=>e[n[d]].claim_order,u))-1;i[s]=n[f]+1;const a=f+1;n[a]=s,r=Math.max(a,r)}const c=[],o=[];let l=e.length-1;for(let s=n[r]+1;s!=0;s=i[s-1]){for(c.push(e[s-1]);l>=s;l--)o.push(e[l]);l--}for(;l>=0;l--)o.push(e[l]);c.reverse(),o.sort((s,u)=>s.claim_order-u.claim_order);for(let s=0,u=0;s<o.length;s++){for(;u<c.length&&o[s].claim_order>=c[u].claim_order;)u++;const f=u<c.length?c[u]:null;t.insertBefore(o[s],f)}}function it(t,e){t.appendChild(e)}function rt(t){if(!t)return document;const e=t.getRootNode?t.getRootNode():t.ownerDocument;return e&&e.host?e:t.ownerDocument}function wt(t){const e=I("style");return bt(rt(t),e),e.sheet}function bt(t,e){it(t.head||t,e)}function $t(t,e){if(O){for(xt(t),(t.actual_end_child===void 0||t.actual_end_child!==null&&t.actual_end_child.parentElement!==t)&&(t.actual_end_child=t.firstChild);t.actual_end_child!==null&&t.actual_end_child.claim_order===void 0;)t.actual_end_child=t.actual_end_child.nextSibling;e!==t.actual_end_child?(e.claim_order!==void 0||e.parentNode!==t)&&t.insertBefore(e,t.actual_end_child):t.actual_end_child=e.nextSibling}else(e.parentNode!==t||e.nextSibling!==null)&&t.appendChild(e)}function Gt(t,e,n){O&&!n?$t(t,e):(e.parentNode!==t||e.nextSibling!=n)&&t.insertBefore(e,n||null)}function st(t){t.parentNode.removeChild(t)}function I(t){return document.createElement(t)}function vt(t){return document.createElementNS("http://www.w3.org/2000/svg",t)}function H(t){return document.createTextNode(t)}function Jt(){return H(" ")}function Kt(){return H("")}function K(t,e,n,i){return t.addEventListener(e,n,i),()=>t.removeEventListener(e,n,i)}function kt(t,e,n){n==null?t.removeAttribute(e):t.getAttribute(e)!==n&&t.setAttribute(e,n)}function Qt(t,e){for(const n in e)kt(t,n,e[n])}function Ut(t,e,n){t.setAttributeNS("http://www.w3.org/1999/xlink",e,n)}function Et(t){return Array.from(t.childNodes)}function At(t){t.claim_info===void 0&&(t.claim_info={last_index:0,total_claimed:0})}function ot(t,e,n,i,r=!1){At(t);const c=(()=>{for(let o=t.claim_info.last_index;o<t.length;o++){const l=t[o];if(e(l)){const s=n(l);return s===void 0?t.splice(o,1):t[o]=s,r||(t.claim_info.last_index=o),l}}for(let o=t.claim_info.last_index-1;o>=0;o--){const l=t[o];if(e(l)){const s=n(l);return s===void 0?t.splice(o,1):t[o]=s,r?s===void 0&&t.claim_info.last_index--:t.claim_info.last_index=o,l}}return i()})();return c.claim_order=t.claim_info.total_claimed,t.claim_info.total_claimed+=1,c}function ct(t,e,n,i){return ot(t,r=>r.nodeName===e,r=>{const c=[];for(let o=0;o<r.attributes.length;o++){const l=r.attributes[o];n[l.name]||c.push(l.name)}c.forEach(o=>r.removeAttribute(o))},()=>i(e))}function Vt(t,e,n){return ct(t,e,n,I)}function Xt(t,e,n){return ct(t,e,n,vt)}function Nt(t,e){return ot(t,n=>n.nodeType===3,n=>{const i=""+e;if(n.data.startsWith(i)){if(n.data.length!==i.length)return n.splitText(i.length)}else n.data=i},()=>H(e),!0)}function Yt(t){return Nt(t," ")}function Zt(t,e){e=""+e,t.wholeText!==e&&(t.data=e)}function te(t,e,n,i){n===null?t.style.removeProperty(e):t.style.setProperty(e,n,i?"important":"")}let S;function St(){if(S===void 0){S=!1;try{typeof window<"u"&&window.parent&&window.parent.document}catch{S=!0}}return S}function ee(t,e){getComputedStyle(t).position==="static"&&(t.style.position="relative");const i=I("iframe");i.setAttribute("style","display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; border: 0; opacity: 0; pointer-events: none; z-index: -1;"),i.setAttribute("aria-hidden","true"),i.tabIndex=-1;const r=St();let c;return r?(i.src="data:text/html,<script>onresize=function(){parent.postMessage(0,'*')}<\/script>",c=K(window,"message",o=>{o.source===i.contentWindow&&e()})):(i.src="about:blank",i.onload=()=>{c=K(i.contentWindow,"resize",e)}),it(t,i),()=>{(r||c&&i.contentWindow)&&c(),st(i)}}function ne(t,e,n){t.classList[n?"add":"remove"](e)}function Ct(t,e,{bubbles:n=!1,cancelable:i=!1}={}){const r=document.createEvent("CustomEvent");return r.initCustomEvent(t,n,i,e),r}const M=new Map;let R=0;function jt(t){let e=5381,n=t.length;for(;n--;)e=(e<<5)-e^t.charCodeAt(n);return e>>>0}function zt(t,e){const n={stylesheet:wt(e),rules:{}};return M.set(t,n),n}function lt(t,e,n,i,r,c,o,l=0){const s=16.666/i;let u=`{
`;for(let m=0;m<=1;m+=s){const A=e+(n-e)*c(m);u+=m*100+`%{${o(A,1-A)}}
`}const f=u+`100% {${o(n,1-n)}}
}`,a=`__svelte_${jt(f)}_${l}`,d=rt(t),{stylesheet:_,rules:h}=M.get(d)||zt(d,t);h[a]||(h[a]=!0,_.insertRule(`@keyframes ${a} ${f}`,_.cssRules.length));const p=t.style.animation||"";return t.style.animation=`${p?`${p}, `:""}${a} ${i}ms linear ${r}ms 1 both`,R+=1,a}function T(t,e){const n=(t.style.animation||"").split(", "),i=n.filter(e?c=>c.indexOf(e)<0:c=>c.indexOf("__svelte")===-1),r=n.length-i.length;r&&(t.style.animation=i.join(", "),R-=r,R||Mt())}function Mt(){F(()=>{R||(M.forEach(t=>{const{stylesheet:e}=t;let n=e.cssRules.length;for(;n--;)e.deleteRule(n);t.rules={}}),M.clear())})}let v;function $(t){v=t}function P(){if(!v)throw new Error("Function called outside component initialization");return v}function ie(t){P().$$.on_mount.push(t)}function re(t){P().$$.after_update.push(t)}function se(t){P().$$.on_destroy.push(t)}function oe(t,e){return P().$$.context.set(t,e),e}const b=[],Q=[],j=[],U=[],ut=Promise.resolve();let W=!1;function at(){W||(W=!0,ut.then(ft))}function ce(){return at(),ut}function k(t){j.push(t)}const L=new Set;let C=0;function ft(){const t=v;do{for(;C<b.length;){const e=b[C];C++,$(e),Rt(e.$$)}for($(null),b.length=0,C=0;Q.length;)Q.pop()();for(let e=0;e<j.length;e+=1){const n=j[e];L.has(n)||(L.add(n),n())}j.length=0}while(b.length);for(;U.length;)U.pop()();W=!1,L.clear(),$(t)}function Rt(t){if(t.fragment!==null){t.update(),x(t.before_update);const e=t.dirty;t.dirty=[-1],t.fragment&&t.fragment.p(t.ctx,e),t.after_update.forEach(k)}}let w;function dt(){return w||(w=Promise.resolve(),w.then(()=>{w=null})),w}function D(t,e,n){t.dispatchEvent(Ct(`${e?"intro":"outro"}${n}`))}const z=new Set;let y;function le(){y={r:0,c:[],p:y}}function ue(){y.r||x(y.c),y=y.p}function Dt(t,e){t&&t.i&&(z.delete(t),t.i(e))}function ae(t,e,n,i){if(t&&t.o){if(z.has(t))return;z.add(t),y.c.push(()=>{z.delete(t),i&&(n&&t.d(1),i())}),t.o(e)}else i&&i()}const _t={duration:0};function fe(t,e,n){let i=e(t,n),r=!1,c,o,l=0;function s(){c&&T(t,c)}function u(){const{delay:a=0,duration:d=300,easing:_=V,tick:h=E,css:p}=i||_t;p&&(c=lt(t,0,1,d,a,_,p,l++)),h(0,1);const m=tt()+a,A=m+d;o&&o.abort(),r=!0,k(()=>D(t,!0,"start")),o=nt(q=>{if(r){if(q>=A)return h(1,0),D(t,!0,"end"),s(),r=!1;if(q>=m){const G=_((q-m)/d);h(G,1-G)}}return r})}let f=!1;return{start(){f||(f=!0,T(t),B(i)?(i=i(),dt().then(u)):u())},invalidate(){f=!1},end(){r&&(s(),r=!1)}}}function de(t,e,n){let i=e(t,n),r=!0,c;const o=y;o.r+=1;function l(){const{delay:s=0,duration:u=300,easing:f=V,tick:a=E,css:d}=i||_t;d&&(c=lt(t,1,0,u,s,f,d));const _=tt()+s,h=_+u;k(()=>D(t,!1,"start")),nt(p=>{if(r){if(p>=h)return a(0,1),D(t,!1,"end"),--o.r||x(o.c),!1;if(p>=_){const m=f((p-_)/u);a(1-m,m)}}return r})}return B(i)?dt().then(()=>{i=i(),l()}):l(),{end(s){s&&i.tick&&i.tick(1,0),r&&(c&&T(t,c),r=!1)}}}function _e(t,e){const n={},i={},r={$$scope:1};let c=t.length;for(;c--;){const o=t[c],l=e[c];if(l){for(const s in o)s in l||(i[s]=1);for(const s in l)r[s]||(n[s]=l[s],r[s]=1);t[c]=l}else for(const s in o)r[s]=1}for(const o in i)o in n||(n[o]=void 0);return n}function he(t){return typeof t=="object"&&t!==null?t:{}}function me(t){t&&t.c()}function pe(t,e){t&&t.l(e)}function Ot(t,e,n,i){const{fragment:r,on_mount:c,on_destroy:o,after_update:l}=t.$$;r&&r.m(e,n),i||k(()=>{const s=c.map(X).filter(B);o?o.push(...s):x(s),t.$$.on_mount=[]}),l.forEach(k)}function Pt(t,e){const n=t.$$;n.fragment!==null&&(x(n.on_destroy),n.fragment&&n.fragment.d(e),n.on_destroy=n.fragment=null,n.ctx=[])}function qt(t,e){t.$$.dirty[0]===-1&&(b.push(t),at(),t.$$.dirty.fill(0)),t.$$.dirty[e/31|0]|=1<<e%31}function ye(t,e,n,i,r,c,o,l=[-1]){const s=v;$(t);const u=t.$$={fragment:null,ctx:null,props:c,update:E,not_equal:r,bound:J(),on_mount:[],on_destroy:[],on_disconnect:[],before_update:[],after_update:[],context:new Map(e.context||(s?s.$$.context:[])),callbacks:J(),dirty:l,skip_bound:!1,root:e.target||s.$$.root};o&&o(u.root);let f=!1;if(u.ctx=n?n(t,e.props||{},(a,d,..._)=>{const h=_.length?_[0]:d;return u.ctx&&r(u.ctx[a],u.ctx[a]=h)&&(!u.skip_bound&&u.bound[a]&&u.bound[a](h),f&&qt(t,a)),d}):[],u.update(),f=!0,x(u.before_update),u.fragment=i?i(u.ctx):!1,e.target){if(e.hydrate){pt();const a=Et(e.target);u.fragment&&u.fragment.l(a),a.forEach(st)}else u.fragment&&u.fragment.c();e.intro&&Dt(t.$$.fragment),Ot(t,e.target,e.anchor,e.customElement),yt(),ft()}$(s)}class ge{$destroy(){Pt(this,1),this.$destroy=E}$on(e,n){const i=this.$$.callbacks[e]||(this.$$.callbacks[e]=[]);return i.push(n),()=>{const r=i.indexOf(n);r!==-1&&i.splice(r,1)}}$set(e){this.$$set&&!mt(e)&&(this.$$.skip_bound=!0,this.$$set(e),this.$$.skip_bound=!1)}}export{_e as A,he as B,Pt as C,ht as D,ce as E,V as F,k as G,K as H,x as I,Q as J,Ft as K,It as L,Bt as M,de as N,Wt as O,fe as P,$t as Q,ee as R,ge as S,ne as T,se as U,vt as V,Xt as W,Ut as X,Qt as Y,Ht as Z,Tt as _,Et as a,kt as b,Vt as c,st as d,I as e,te as f,Gt as g,Nt as h,ye as i,Zt as j,Jt as k,Kt as l,Yt as m,E as n,le as o,ae as p,ue as q,Dt as r,Lt as s,H as t,oe as u,re as v,ie as w,me as x,pe as y,Ot as z};
