import{F as G,S as R,i as O,s as b,G as M,e as x,c as v,a as k,d as u,b as h,g as y,H as N,n as w,I as V,w as W,J as Y,f as j,K as J,L as K,M as L,r as p,p as _,N as X,x as B,k as Q,y as U,m as Z,z as ee,q as te,C as ae,O as le,P as oe,o as se}from"../chunks/index-33f9161c.js";function $(n,{delay:s=0,duration:d=400,easing:l=G}={}){const r=+getComputedStyle(n).opacity;return{delay:s,duration:d,easing:l,css:i=>`opacity: ${i*r}`}}function ne(n){let s=!1,d=()=>{s=!1},l,r,i,t,a;return M(n[5]),M(n[6]),{c(){r=x("canvas"),this.h()},l(o){r=v(o,"CANVAS",{style:!0,class:!0}),k(r).forEach(u),this.h()},h(){h(r,"style",i=`filter:blur(${n[4]}px);`),h(r,"class","svelte-alvyvv")},m(o,f){y(o,r,f),n[7](r),t||(a=[N(window,"resize",n[5]),N(window,"scroll",()=>{s=!0,clearTimeout(l),l=setTimeout(d,100),n[6]()})],t=!0)},p(o,[f]){f&8&&!s&&(s=!0,clearTimeout(l),scrollTo(window.pageXOffset,o[3]),l=setTimeout(d,100)),f&16&&i!==(i=`filter:blur(${o[4]}px);`)&&h(r,"style",i)},i:w,o:w,d(o){o&&u(r),n[7](null),t=!1,V(a)}}}function re(n,s,d){let l,r,i,t,a,o,f=0,g=[],S=[];function C(){t.filter="",t.clearRect(0,0,l,r);for(let e of S){if(isNaN(e.x))continue;const c=t.createRadialGradient(e.x,e.y-o*e.parallax,0,e.x,e.y-o*e.parallax,e.r);c.addColorStop(0,`rgba(${e.fill}, ${.05*e.o})`),c.addColorStop(.8,`rgba(${e.fill}, ${.01*e.o})`),c.addColorStop(1,`rgba(${e.fill}, 0)`),t.beginPath(),t.arc(e.x,e.y-o*e.parallax,e.r,0,2*Math.PI),t.fillStyle=c,t.fill(),e.o+=e.d,e.o>1&&(e.o=1,e.d=-e.d),e.o<0&&(e.o=0,e.d=-e.d),e.x+=e.speedx,e.y+=e.speedy,e.speedx+=Math.random()*.1-.05,e.speedy+=Math.random()*.1-.05,e.speedx=Math.min(e.speedx,1),e.speedy=Math.min(e.speedy,1),e.speedx=Math.max(e.speedx,-1),e.speedy=Math.max(e.speedy,-1),e.x+e.r<0&&(e.x=l+e.r),e.y+e.r<0&&(e.y=document.scrollingElement.scrollHeight+e.r),e.x-e.r>l&&(e.x=-e.r),e.y-e.r>document.scrollingElement.scrollHeight&&(e.y=-e.r)}t.globalAlpha=1;for(let e of g)e.y+=e.speed,e.y>document.scrollingElement.scrollHeight&&(e.y=-e.h),t.filter=`brightness(${e.o})`,t.drawImage(a,e.x,e.y-o*e.parallax,e.w,e.h);requestAnimationFrame(C)}W(()=>{a=new Image,a.src="seorii.png",a.onload=()=>{let e=0;t=i.getContext("2d");for(let c=0;c<12&&!(e>1e4);c++){const m=Math.random()*300+400,E=m/a.width*a.height,H=Math.random()*(l-m+400)-200,I=Math.random()*(document.scrollingElement.scrollHeight+400)-200;let T=!1;for(let A of g)if(Math.abs(A.x-H)<m&&Math.abs(A.y-I)<E){T=!0;break}if(T){c--,e++;continue}g.push({x:H,y:I,w:m,h:E,o:[.98,.97,.89][Math.floor(Math.random()*2)],speed:Math.random()*.2+.02,parallax:Math.random()*.4+.4})}for(let c=0;c<r*l/1e4;c++)S.push({x:Math.random()*l,y:Math.random()*document.scrollingElement.scrollHeight,r:Math.random()*50+200,o:Math.random(),d:Math.random()*.001-.002,speedx:Math.random()*1+.02,speedy:Math.random()*1+.02,fill:["72, 117, 237","99, 99, 99"][Math.floor(Math.random()*2)],parallax:Math.random()*.2+.7});C()}});function P(){d(0,l=window.innerWidth),d(1,r=window.innerHeight)}function D(){d(3,o=window.pageYOffset)}function F(e){Y[e?"unshift":"push"](()=>{i=e,d(2,i),d(0,l),d(1,r)})}return n.$$.update=()=>{n.$$.dirty&7&&i&&(d(2,i.width=l,i),d(2,i.height=r,i)),n.$$.dirty&8&&d(4,f=Math.min(15,Math.round((o-20)/30)))},[l,r,i,o,f,P,D,F]}class ie extends R{constructor(s){super(),O(this,s,re,ne,b,{})}}function q(n){let s,d,l,r;const i=n[2].default,t=le(i,n,n[1],null);return{c(){s=x("div"),t&&t.c(),this.h()},l(a){s=v(a,"DIV",{style:!0});var o=k(s);t&&t.l(o),o.forEach(u),this.h()},h(){j(s,"height","100%")},m(a,o){y(a,s,o),t&&t.m(s,null),r=!0},p(a,o){n=a,t&&t.p&&(!r||o&2)&&J(t,i,n,n[1],r?L(i,n[1],o,null):K(n[1]),null)},i(a){r||(p(t,a),M(()=>{l&&l.end(1),d=oe(s,$,{duration:1,delay:z}),d.start()}),r=!0)},o(a){_(t,a),d&&d.invalidate(),l=X(s,$,{duration:z}),r=!1},d(a){a&&u(s),t&&t.d(a),a&&l&&l.end()}}}function de(n){let s,d,l,r=n[0],i;s=new ie({});let t=q(n);return{c(){B(s.$$.fragment),d=Q(),l=x("main"),t.c(),this.h()},l(a){U(s.$$.fragment,a),d=Z(a),l=v(a,"MAIN",{class:!0});var o=k(l);t.l(o),o.forEach(u),this.h()},h(){h(l,"class","svelte-1vekqzl")},m(a,o){ee(s,a,o),y(a,d,o),y(a,l,o),t.m(l,null),i=!0},p(a,[o]){o&1&&b(r,r=a[0])?(se(),_(t,1,1,w),te(),t=q(a),t.c(),p(t,1),t.m(l,null)):t.p(a,o)},i(a){i||(p(s.$$.fragment,a),p(t),i=!0)},o(a){_(s.$$.fragment,a),_(t),i=!1},d(a){ae(s,a),a&&u(d),a&&u(l),t.d(a)}}}const ue=async({url:n})=>({props:{url:n}}),z=200;function ce(n,s,d){let{$$slots:l={},$$scope:r}=s,{url:i}=s;return n.$$set=t=>{"url"in t&&d(0,i=t.url),"$$scope"in t&&d(1,r=t.$$scope)},[i,r,l]}class me extends R{constructor(s){super(),O(this,s,ce,de,b,{url:0})}}export{me as default,ue as load};