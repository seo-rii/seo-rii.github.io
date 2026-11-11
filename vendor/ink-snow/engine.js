import { DEFAULT_SETTINGS, normalizeSettings, serializeSettings, parseSettings } from './settings.js';
import { TEMPLATE } from './template.js';
import { STYLES } from './styles.js';
import { createViewerHTML } from './viewer-export.js';
let instanceCounter=0;
export function mountInkSnow(root, options={}) {
  if (!root || root.nodeType !== 1) throw new TypeError('A mounted HTMLElement is required.');
  if (root.dataset.ready) throw new Error('InkSnow already mounted on this element.');
  const document=root.ownerDocument,window=document.defaultView;
  let destroyed=false,layoutRaf=0,resizing=false;
  const readOnly=options.readOnly===true;
  if(readOnly)options.controls=false;
  const listeners=[],observers=[];
  // GPU/2D caches are disposable; scene time, particles and layer samples are not.
  const assetPainters=new Map(),lostSurfaces=new Set();
  let rendererReady=false,suspended=false,recoveryNeeded=false,recovering=false;
  let assetsDirty=false,probeAssets=false,recoveryTimer=0,recoveryCount=0;
  let lastRecoveryReason='',assetRestoreCount=0;
  function listen(target,type,handler,options){target.addEventListener(type,handler,options);listeners.push([target,type,handler,options]);}
  root.innerHTML=TEMPLATE;
  root.classList.add('ink-snow');root.dataset.ready='true';
  const uid='ink-snow-'+(++instanceCounter)+'-';
  const getControl=key=>root.querySelector('[data-control="'+key+'"]');
  for(const el of root.querySelectorAll('[data-control]'))el.id=uid+el.dataset.control;
  for(const el of root.querySelectorAll('[data-for]'))el.htmlFor=uid+el.dataset.for;
  for(const el of root.querySelectorAll('[data-describedby]'))el.setAttribute('aria-describedby',uid+el.dataset.describedby);
  for(const el of root.querySelectorAll('label')){const input=el.querySelector('input,select');if(input&&input.id)el.htmlFor=input.id;}
  const style=document.createElement('style');style.textContent=STYLES;root.prepend(style);
  const canvas=root.querySelector('canvas'),screen=canvas.getContext('2d',{alpha:false});
  const foregroundRoot=options.foregroundRoot||null;
  let foregroundCanvas=null,foregroundScreen=null;
  if(foregroundRoot){
    foregroundRoot.innerHTML='';
    foregroundCanvas=document.createElement('canvas');
    foregroundCanvas.className='ink-snow-foreground-canvas';
    foregroundCanvas.setAttribute('aria-hidden','true');
    foregroundCanvas.style.display='block';
    foregroundCanvas.style.width='100%';
    foregroundCanvas.style.height='100%';
    foregroundCanvas.style.pointerEvents='none';
    foregroundRoot.appendChild(foregroundCanvas);
    foregroundScreen=foregroundCanvas.getContext('2d',{alpha:true});
    watchSurface(foregroundCanvas);
  }
  let ctx,output;
  const windLeftButton=getControl('windLeft');
  const windRightButton=getControl('windRight');
  const pause=getControl('pause');
  const status=getControl('status');
  const observeButton=getControl('observe'),inspect=getControl('inspect');
  const lookControl=getControl('look'),fpsControl=getControl('fps');
  const filmControl=getControl('film');
  const stage=getControl('stage'),fullscreenButton=getControl('fullscreen');
  const pointerWindControl=getControl('pointerWind');
  const scrollWindControl=getControl('scrollWind'),scrollModeControl=getControl('scrollMode'),scrollBothControl=getControl('scrollBothDirections'),scrollStrengthControl=getControl('scrollStrength');
  const exitFullscreenButton=getControl('exitFullscreen');
  const viewMessage=getControl('viewMessage'),viewerFullscreenButton=getControl('viewerFullscreen');
  const softSnowControl=getControl('softSnowBlur'),softSnowMixControl=getControl('softSnowMix'),smoothGrainControl=getControl('smoothGrain');
  const shortAutoControl=getControl('shortAuto'),shortActual=getControl('shortActual');
  const temporalControl=getControl('temporal');
  const finishControl=getControl('finish'),fallbackNotice=getControl('fallback');
  const rendererControl=getControl('renderer'),layerControl=getControl('layer');
  const layerTimingControl=getControl('layerTiming');
  const settings=normalizeSettings(options.settings||{});
  softSnowControl.checked=settings.softSnowBlur;smoothGrainControl.checked=settings.smoothGrain;
  const looks={
    original:{fps:0,shutter:1,grain:0,weave:0,flicker:0,warm:0,vignette:0,mix:0},
    cinema:{fps:24,shutter:.86,grain:.055,weave:.18,flicker:.006,warm:.035,vignette:.075,mix:0},
    vintage:{fps:18,shutter:.7,grain:.16,weave:1.05,flicker:.027,warm:.18,vignette:.17,mix:0},
    anime:{fps:12,shutter:.18,grain:.025,weave:0,flicker:0,warm:0,vignette:0,mix:0},
    dream:{fps:30,shutter:1,grain:.035,weave:.15,flicker:.006,warm:0,vignette:.07,mix:.24}
  };
  if(!screen){status.className='';status.textContent='이 브라우저에서는 그림을 표시할 수 없습니다.';return;}
  const W=896,TAU=Math.PI*2;let H=Math.round(W*settings.aspectHeight/settings.aspectWidth);
  function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let a=Math.imul(seed^seed>>>15,1|seed);a=a+Math.imul(a^a>>>7,61|a)^a;return((a^a>>>14)>>>0)/4294967296;};}
  function watchSurface(c){
    listen(c,'contextlost',()=>{
      lostSurfaces.add(c);assetsDirty=assetsDirty||assetPainters.has(c);
      recoveryNeeded=true;lastRecoveryReason='2d-context-lost';
      if(rendererReady)stopAnimation();
      // Do not preventDefault: Canvas2D should restore its backing store.
    });
    listen(c,'contextrestored',()=>{
      lostSurfaces.delete(c);assetsDirty=assetsDirty||assetPainters.has(c);
      requestRecovery('2d-context-restored');
    });
  }
  function surface(w=W,h=H){
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const g=c.getContext('2d');watchSurface(c);return[c,g];
  }
  function rememberAsset(c,paint){
    assetPainters.set(c,paint);paint();return c;
  }
  function restoreAssets(){
    // Insertion order is dependency order: paint -> tinted paint, flake -> blur.
    for(const [c,paint] of assetPainters){c.width=c.width;paint();}
    assetsDirty=false;assetRestoreCount++;
  }
  watchSurface(canvas);
  const [scene,sceneContext]=surface(),[snow,snowContext]=surface();
  const [backgroundFrame,backgroundContext]=surface();
  const [cloudExposure,cloudExposureContext]=surface(),[cloudSample,cloudSampleContext]=surface();
  const [tintedSnow,tintContext]=surface();
  const [history,historyContext]=surface(),[blend,blendContext]=surface();ctx=sceneContext;
  const [filmFrame,filmContext]=surface(),[previousFrame,previousContext]=surface();output=filmContext;
  const [smoothGrainTile,smoothGrainContext]=surface(128,128);
  const shaderSources={
    vertex:`
attribute vec2 aPosition;
varying vec2 vUv;
void main(){
  vUv=aPosition*0.5+0.5;
  gl_Position=vec4(aPosition,0.0,1.0);
}`,
    wash:`
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uImage;
uniform vec2 uResolution;
uniform float uTime;
uniform float uStrength;
uniform float uFlow;
uniform float uPigment;
uniform vec3 uBaseColor;
float hash21(vec2 p){
  vec3 q=fract(vec3(p.xyx)*0.1031);
  q+=dot(q,q.yzx+33.33);
  return fract((q.x+q.y)*q.z);
}
float valueNoise(vec2 p){
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.0-2.0*f);
  return mix(mix(hash21(i),hash21(i+vec2(1.0,0.0)),f.x),
             mix(hash21(i+vec2(0.0,1.0)),hash21(i+vec2(1.0,1.0)),f.x),f.y);
}
float fbm(vec2 p){
  float n=0.0,a=0.57;
  mat2 turn=mat2(0.8,-0.6,0.6,0.8);
  for(int i=0;i<3;i++){
    n+=a*valueNoise(p);
    p=turn*p*2.03+vec2(3.7,8.2);
    a*=0.5;
  }
  return n;
}
vec3 densityAt(vec2 uv){
  return -log(max(texture2D(uImage,clamp(uv,vec2(0.0),vec2(1.0))).rgb,vec3(0.015))) + log(max(uBaseColor,vec3(0.015)));
}
void main(){
  vec2 ref=vec2(896.0,896.0*uResolution.y/uResolution.x),p=vUv*vec2(uResolution.x/uResolution.y,1.0);
  // Motion comes from the watercolor shapes. Keep paper, pigment and flow
  // coordinates stable so they do not add their own brightness modulation.
  float t=0.0;
  vec2 drift=vec2(t*0.32,t*0.13);
  vec2 field=vec2(fbm(p*3.4+drift),fbm(p*3.1+vec2(8.1,2.7)-drift.yx))-0.48;
  vec2 small=vec2(valueNoise(p*14.0+drift),valueNoise(p*13.0+vec2(3.2,9.4)-drift))-0.5;
  vec2 uv=vUv+(field*25.0+small*3.0)/ref*uFlow*uStrength;
  vec3 d=densityAt(uv);
  vec2 texel=1.0/ref;
  vec3 surrounding=(densityAt(uv+vec2(texel.x*2.4,0.0))+
                    densityAt(uv-vec2(texel.x*2.4,0.0))+
                    densityAt(uv+vec2(0.0,texel.y*2.4))+
                    densityAt(uv-vec2(0.0,texel.y*2.4)))*0.25;
  vec2 paper=vUv*ref;
  float tooth=valueNoise(paper*0.31);
  float fibre=valueNoise(paper*vec2(0.10,0.61)+vec2(21.0,6.0));
  float pools=fbm(p*8.5+field*0.75+drift*0.4);
  float granulation=(tooth-0.5)*0.50+(fibre-0.5)*0.17+(pools-0.48)*0.58;
  vec3 rim=sign(d)*max(abs(d)-abs(surrounding),vec3(0.0));
  d=mix(d,surrounding,0.13*uPigment*uStrength);
  d*=1.0+uPigment*uStrength*(0.24+granulation);
  d+=rim*(1.7*uPigment*uStrength);
  gl_FragColor=vec4(exp(-max(d-log(max(uBaseColor,vec3(0.015))),vec3(0.0))),1.0);
}`,
    lens:`
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uImage;
uniform vec2 uResolution;
uniform float uStrength;
uniform float uDiffusion;
vec3 lightAt(vec2 uv){
  return pow(max(texture2D(uImage,clamp(uv,vec2(0.0),vec2(1.0))).rgb,vec3(0.0)),vec3(2.2));
}
void main(){
  vec2 texel=1.0/vec2(896.0,896.0*uResolution.y/uResolution.x);
  vec2 r=texel*(2.0+uDiffusion*2.5);
  vec3 original=lightAt(vUv);
  vec3 soft=original*0.28;
  soft+=(lightAt(vUv+vec2(r.x,0.0))+lightAt(vUv-vec2(r.x,0.0))+
         lightAt(vUv+vec2(0.0,r.y))+lightAt(vUv-vec2(0.0,r.y)))*0.12;
  soft+=(lightAt(vUv+r)+lightAt(vUv-r)+
         lightAt(vUv+vec2(r.x,-r.y))+lightAt(vUv+vec2(-r.x,r.y)))*0.06;
  vec2 wide=texel*(8.0+uDiffusion*5.0);
  vec3 air=(lightAt(vUv+vec2(wide.x,0.0))+lightAt(vUv-vec2(wide.x,0.0))+
            lightAt(vUv+vec2(0.0,wide.y))+lightAt(vUv-vec2(0.0,wide.y)))*0.25;
  float a=uStrength*uDiffusion;
  vec3 result=mix(original,soft,0.55*a);
  result=mix(result,air,0.12*a);
  gl_FragColor=vec4(pow(max(result,vec3(0.0)),vec3(1.0/2.2)),1.0);
}`
  };
  function createShaderFinish(){
    const target=document.createElement('canvas');let gl=null,lost=false,failed=false,disposed=false;
    let programs={},texture=null,buffer=null,uploadedWidth=0,uploadedHeight=0;
    try{gl=target.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,premultipliedAlpha:false,preserveDrawingBuffer:false,powerPreference:'low-power'});}catch(error){}
    function release(){
      if(!gl||lost)return;
      for(const entry of Object.values(programs))gl.deleteProgram(entry.program);
      if(texture)gl.deleteTexture(texture);if(buffer)gl.deleteBuffer(buffer);
      programs={};texture=null;buffer=null;
    }
    function compile(type,source){
      const shader=gl.createShader(type);if(!shader)throw Error('Shader allocation failed');
      gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const reason=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw Error(reason||'Shader compile failed');
      }
      return shader;
    }
    function program(fragment){
      let vertex=null,pixel=null,p=null;
      try{
        vertex=compile(gl.VERTEX_SHADER,shaderSources.vertex);pixel=compile(gl.FRAGMENT_SHADER,fragment);
        p=gl.createProgram();if(!p)throw Error('Program allocation failed');
        gl.attachShader(p,vertex);gl.attachShader(p,pixel);gl.bindAttribLocation(p,0,'aPosition');gl.linkProgram(p);
        if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p)||'Shader link failed');
        const uniforms={};
        for(const name of ['uImage','uResolution','uTime','uStrength','uFlow','uPigment','uDiffusion','uBaseColor'])uniforms[name]=gl.getUniformLocation(p,name);
        return{program:p,uniforms};
      }catch(error){if(p)gl.deleteProgram(p);throw error;}
      finally{if(vertex)gl.deleteShader(vertex);if(pixel)gl.deleteShader(pixel);}
    }
    function initialize(){
      programs.wash=program(shaderSources.wash);programs.lens=program(shaderSources.lens);
      buffer=gl.createBuffer();texture=gl.createTexture();if(!buffer||!texture)throw Error('Texture allocation failed');
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.disable(gl.DITHER);
      uploadedWidth=0;uploadedHeight=0;
    }
    if(gl){try{initialize();}catch(error){failed=true;release();}}
    function unavailable(){failed=true;release();syncFinishControls();}
    const api={
      get available(){return !!gl&&!lost&&!failed&&!disposed;},
      get lost(){return lost;},
      apply(pass,source,destination,time){
        if(!api.available||settings.finish==='none'||settings.shaderStrength<=0)return false;
        try{
          if(gl.isContextLost()){lost=true;syncFinishControls();return false;}
          const width=source.width,height=source.height;
          if(target.width!==width||target.height!==height){target.width=width;target.height=height;}
          gl.viewport(0,0,width,height);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
          const resized=uploadedWidth!==width||uploadedHeight!==height;
          if(resized){
            gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);uploadedWidth=width;uploadedHeight=height;
          }else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,source);
          const entry=programs[pass],u=entry.uniforms;gl.useProgram(entry.program);
          gl.uniform1i(u.uImage,0);gl.uniform2f(u.uResolution,width,height);gl.uniform1f(u.uTime,time);
          gl.uniform1f(u.uStrength,settings.shaderStrength);gl.uniform1f(u.uFlow,settings.flow);
          if(u.uBaseColor)gl.uniform3fv(u.uBaseColor,hexRGB(settings.backgroundColor).map(x=>x/255));
          gl.uniform1f(u.uPigment,settings.pigment);gl.uniform1f(u.uDiffusion,settings.diffusion);
          gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
          gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
          if(gl.isContextLost()){lost=true;syncFinishControls();return false;}
          if(resized||!entry.checked){
            if(gl.getError()!==gl.NO_ERROR)throw Error('Shader rendering failed');
            entry.checked=true;
          }
          // Copy synchronously: the WebGL drawing buffer need not be preserved between frames.
          destination.save();
          try{
            destination.setTransform(1,0,0,1,0,0);destination.globalAlpha=1;destination.globalCompositeOperation='source-over';
            destination.drawImage(target,0,0);
          }finally{destination.restore();}
          return true;
        }catch(error){unavailable();return false;}
      },
      dispose(){if(disposed)return;release();disposed=true;}
    };
    if(gl&&target.addEventListener){
      listen(target,'webglcontextlost',event=>{
        event.preventDefault();lost=true;programs={};texture=null;buffer=null;syncFinishControls();requestRecovery('webgl-context-lost');
      });
      listen(target,'webglcontextrestored',()=>{
        if(disposed)return;lost=false;failed=false;
        try{initialize();}catch(error){failed=true;release();}
        syncFinishControls();requestRecovery('webgl-context-restored');
      });
    }
    return api;
  }
  const shaderFinish=createShaderFinish();
  function normal(r){return Math.sqrt(-2*Math.log(Math.max(.0001,r())))*Math.cos(TAU*r());}
  function outline(g,points){g.beginPath();g.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)g.lineTo(points[i][0],points[i][1]);g.closePath();}
  function soften(points,r,variance){const next=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];next.push(a,[(a[0]+b[0])/2+normal(r)*variance,(a[1]+b[1])/2+normal(r)*variance*.65]);}return next;}
  function wash(seed,rx,ry,rgb){
    const [c,g]=surface(1000,680);
    rememberAsset(c,()=>{const r=rng(seed);let original=[];
    for(let i=0;i<22;i++){const a=TAU*i/22,k=.82+r()*.28;original.push([500+Math.cos(a)*rx*k,340+Math.sin(a)*ry*k]);}
    for(let i=0;i<3;i++)original=soften(original,r,11/Math.pow(1.6,i));
    for(let layer=0;layer<34;layer++){
      let points=original.map(([x,y])=>[x+normal(r)*13,y+normal(r)*8]);
      for(let i=0;i<2;i++)points=soften(points,r,6/Math.pow(2,i));
      g.fillStyle='rgba('+rgb+','+(.009+r()*.005)+')';outline(g,points);g.fill();
      if(layer%7===0){g.strokeStyle='rgba('+rgb+',.017)';g.lineWidth=.7;g.stroke();}
    }
    g.globalCompositeOperation='destination-out';
    for(let i=0;i<1900;i++){g.fillStyle='rgba(0,0,0,'+(r()*.13)+')';g.fillRect(500+normal(r)*rx*.57,340+normal(r)*ry*.5,.35+r()*.9,.35+r()*.8);}
    });return c;
  }
  const washes=[
    {image:wash(7,372,206,'47,112,159'),x:740,y:15,sx:1,sy:1,weight:.8,rotation:-.17},
    {image:wash(83,350,182,'69,130,169'),x:790,y:70,sx:.84,sy:.91,weight:.54,rotation:.07},
    {image:wash(111,368,150,'89,139,171'),x:-80,y:80,sx:.96,sy:.83,weight:.4,rotation:-.21},
    {image:wash(148,390,125,'98,144,170'),x:135,y:590,sx:.92,sy:1,weight:.35,rotation:.09}
  ];
  function createWatercolorDrift(washes, options = {}) {
    const finite = (value, fallback) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    };
    const width = Math.max(1, finite(options.width, 896));
    const height = Math.max(1, finite(options.height, 560));
    const speed = Math.max(0, finite(options.speed, 28));
    const gap = Math.max(2, finite(options.gap, 96));
    const rates = options.rates || [1, .86, .72, .9];
    const TAU = Math.PI * 2;
    // Full-strength bounds. At the 45% UI default all three are less than half.
    const stretchLimit = .05, horizontalShearLimit = .10, verticalShearLimit = .055;
    const maximumStretch = Math.exp(stretchLimit);
    const aa = maximumStretch * (1 + horizontalShearLimit * verticalShearLimit);
    const ab = maximumStretch * horizontalShearLimit;
    const ac = maximumStretch * verticalShearLimit;
    const ad = maximumStretch;
    const pigmentPivot = image => {
      try {
        const context = image.getContext && image.getContext('2d');
        if (!context || !context.getImageData) return {x:0,y:0};
        const data = context.getImageData(0, 0, image.width, image.height).data;
        let mass = 0, mx = 0, my = 0;
        for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
          const alpha = data[(y * image.width + x) * 4 + 3];
          mass += alpha; mx += alpha * (x + .5); my += alpha * (y + .5);
        }
        return mass > 0 ? {x:mx/mass-image.width/2,y:my/mass-image.height/2} : {x:0,y:0};
      } catch (_) {
        // Generated application canvases are readable. Other image types can
        // still use their geometric center without changing their source pixels.
        return {x:0,y:0};
      }
    };
    const layers = washes.map((source, index) => {
      if (!source.image || !(source.image.width > 0) || !(source.image.height > 0)) {
        throw new TypeError('Each watercolor wash needs an existing image');
      }
      const image = source.image;
      const x = finite(source.x, 0), y = finite(source.y, 0);
      const sx = finite(source.sx, 1), sy = finite(source.sy, 1);
      const rotation = finite(source.rotation, 0);
      const weight = Math.max(0, Math.min(1, finite(source.weight, 1)));
      const c = Math.cos(rotation), s = Math.sin(rotation);
      const pivot = pigmentPivot(image);
      const radiusX = image.width / 2 + Math.abs(pivot.x);
      const radiusY = image.height / 2 + Math.abs(pivot.y);
      const localX = Math.abs(pivot.x) + aa * radiusX + ab * radiusY;
      const localY = Math.abs(pivot.y) + ac * radiusX + ad * radiusY;
      const extentX = Math.abs(c * sx) * localX + Math.abs(s * sy) * localY;
      const extentY = Math.abs(s * sx) * localX + Math.abs(c * sy) * localY;
      const rate = Math.max(0, finite(rates[index], 1));
      // A moving material point cannot reverse its horizontal drift. Bounding
      // the derivative of the full deformation gives an explicit conservative
      // limit. Shape time scales with transport velocity, including velocity=0.
      const omegaS = TAU / (74 + 11 * index);
      const omegaH = TAU / (91 + 7 * index);
      const omegaV = TAU / (63 + 13 * index);
      const ds = stretchLimit * .5 * omegaS;
      const dh = horizontalShearLimit * .5 * omegaH;
      const dv = verticalShearLimit * .5 * omegaV;
      const da = maximumStretch * (ds * (1 + horizontalShearLimit * verticalShearLimit) + dh * verticalShearLimit + horizontalShearLimit * dv);
      const db = maximumStretch * (dh + horizontalShearLimit * ds);
      const dc = maximumStretch * (dv + verticalShearLimit * ds);
      const dd = maximumStretch * ds;
      const sourceVX = da * radiusX + db * radiusY;
      const sourceVY = dc * radiusX + dd * radiusY;
      const deformationVX = Math.abs(c * sx) * sourceVX + Math.abs(s * sy) * sourceVY;
      const velocity = speed * rate;
      const clockScale = velocity > 0 ? velocity / Math.max(28, 5 * deformationVX) : 0;
      return { index, image, x, y, sx, sy, rotation, weight, extentX, extentY,
        pivotX:pivot.x, pivotY:pivot.y, velocity, clockScale, omegaS, omegaH, omegaV,
        minimumPointVX:velocity-clockScale*deformationVX };
    });
    let minimumPeriod = width + 2 * gap;
    for (const layer of layers) {
      minimumPeriod = Math.max(minimumPeriod,
        2 * layer.extentX + gap,
        layer.x + layer.extentX + gap,
        width - layer.x + layer.extentX + gap);
    }
    const period = Math.ceil(Math.max(minimumPeriod, finite(options.period, minimumPeriod)));
    const amountFor = morph => Math.max(0, Math.min(1, finite(morph, 1)));
    const sampleTime = time => finite(time, 0);
    const shapeAt = (layer, time, amount) => {
      if (amount === 0 || time === 0 || layer.clockScale === 0) {
        return {a:1,b:0,c:0,d:1,pivotX:layer.pivotX,pivotY:layer.pivotY,identity:true};
      }
      const t = time * layer.clockScale;
      const ps = .53 + layer.index * 1.19;
      const ph = 1.10 + layer.index * 1.71;
      const pv = 2.40 + layer.index * .83;
      const s = amount * stretchLimit * .5 * (Math.sin(t * layer.omegaS + ps) - Math.sin(ps));
      const h = amount * horizontalShearLimit * .5 * (Math.sin(t * layer.omegaH + ph) - Math.sin(ph));
      const v = amount * verticalShearLimit * .5 * (Math.sin(t * layer.omegaV + pv) - Math.sin(pv));
      const stretch = Math.exp(s);
      return { a:stretch*(1+h*v), b:h/stretch, c:stretch*v, d:1/stretch,
        pivotX:layer.pivotX, pivotY:layer.pivotY,
        identity:s===0&&h===0&&v===0 };
    };
    const deformationFor = (index, time, morph = 1) => {
      if (!Number.isInteger(index) || index < 0 || index >= layers.length) throw new RangeError('Invalid wash index');
      return shapeAt(layers[index], sampleTime(time), amountFor(morph));
    };
    const cloudParallax=[.82,.96,.69,1.04];
    const recordsAt = (time, morph, scrollY=0) => {
      const t=sampleTime(time),amount=amountFor(morph),result=[];
      for(const layer of layers){
        if(layer.weight<=0)continue;
        const shift=scrollY*cloudParallax[layer.index%cloudParallax.length];
        const deformation=shapeAt(layer,t,amount);
        const rows=[{y:layer.y,row:0,x:0}];
        // Additional seeded rows start wholly outside the initial viewport.
        // Their spacing depends on wash support, not viewport height, so tall
        // mobile screens cannot expose a band of unallocated background.
        const spacing=Math.max(190,layer.extentY*.80),margin=layer.extentY+32;
        for(const sign of [-1,1]){
          const origin=sign<0?-margin:height+margin;
          const a=(-layer.extentY-2-shift-origin)/(sign*spacing);
          const b=(height+layer.extentY+2-shift-origin)/(sign*spacing);
          const lo=Math.max(0,Math.ceil(Math.min(a,b))),hi=Math.floor(Math.max(a,b));
          for(let i=lo;i<=hi;i++){
            const row=sign*(i+1);
            const seed=rng((Math.imul(row,1597334677)^Math.imul(layer.index+1,3812015801))>>>0);
            rows.push({y:origin+sign*i*spacing,row,x:(seed()-.5)*width*.8});
          }
        }
        for(const row of rows){
          const y=row.y+shift;
          if(y+layer.extentY< -2||y-layer.extentY>height+2)continue;
          const raw=layer.x+row.x+layer.velocity*t,cycle=Math.floor(raw/period),phase=raw-cycle*period;
          const first=Math.ceil((-2-layer.extentX-phase)/period),last=Math.floor((width+2+layer.extentX-phase)/period);
          for(let copy=first;copy<=last;copy++)result.push({layer,x:phase+copy*period,y,row:row.row,copyIndex:copy-cycle,deformation});
        }
      }
      return result;
    };
    const instances=(time,morph=1,scrollY=0)=>recordsAt(time,morph,scrollY).map(({layer,x,y,row,copyIndex,deformation})=>({
      layer:layer.index,copyIndex,row,x,y,vx:layer.velocity,parallax:cloudParallax[layer.index%cloudParallax.length],
      rotation:layer.rotation,sx:layer.sx,sy:layer.sy,weight:layer.weight,
      extentX:layer.extentX,extentY:layer.extentY,minimumPointVX:layer.minimumPointVX,deformation
    }));
    const draw=(context,time,morph=1,scrollY=0)=>{
      const list=recordsAt(time,morph,scrollY),inheritedAlpha=context.globalAlpha;
      context.save();context.globalCompositeOperation='source-over';
      for(const {layer,x,y,deformation:m} of list){
        context.save();context.globalAlpha=inheritedAlpha*layer.weight;
        context.translate(x,y);context.rotate(layer.rotation);context.scale(layer.sx,layer.sy);
        if(!m.identity){context.translate(m.pivotX,m.pivotY);context.transform(m.a,m.c,m.b,m.d,0,0);context.translate(-m.pivotX,-m.pivotY);}
        context.drawImage(layer.image,-layer.image.width/2,-layer.image.height/2);context.restore();
      }
      context.restore();return list.length;
    };
    return Object.freeze({width,height,speed,period,draw,instances,deformationFor});
  }
  const tintedWashes=[];
  let watercolorDrift;
  rebuildWatercolor();
  const [paper,pg]=surface();
  function rebuildPaper(){
    paper.width=W;paper.height=H;const pr=rng(1024),pixels=pg.createImageData(W,H);
    for(let i=0;i<pixels.data.length;i+=4){const v=pr()<.11?249+Math.floor(pr()*6):255;pixels.data[i]=v;pixels.data[i+1]=v;pixels.data[i+2]=v;pixels.data[i+3]=255;}
    pg.putImageData(pixels,0,0);pg.strokeStyle='rgba(45,48,50,.026)';pg.lineWidth=.45;
    for(let i=0;i<2500*H/560;i++){const x=pr()*W,y=pr()*H;pg.beginPath();pg.moveTo(x,y);pg.lineTo(x+pr()*3,y+(pr()-.5)*1.3);pg.stroke();}
  }
  rememberAsset(paper,rebuildPaper);
  const atlas=[];
  for(let k=0;k<16;k++){
    const [c,g]=surface(96,96);rememberAsset(c,()=>{const r=rng(200+k*113);let points=[];
    const squash=.86+r()*.14,phase=r()*TAU,lobes=[{x:-1,y:1,r:18.3+r()*1.4}];
    for(let j=0;j<3;j++){const a=phase+j*TAU/3+(r()-.5)*.35,d=10+r()*4;lobes.push({x:Math.cos(a)*d,y:Math.sin(a)*d,r:9+r()*4});}
    for(let i=0;i<64;i++){
      const a=TAU*i/64,dx=Math.cos(a),dy=Math.sin(a);let radius=0;
      for(const lobe of lobes){const dot=lobe.x*dx+lobe.y*dy,q=dot*dot+lobe.r*lobe.r-lobe.x*lobe.x-lobe.y*lobe.y;if(q>0)radius=Math.max(radius,dot+Math.sqrt(q));}
      radius+=(r()-.5)*1.25;points.push([48+dx*radius,48+dy*radius*squash]);
    }
    points=soften(points,r,.28);
    for(let j=0;j<11;j++){g.save();g.translate((r()-.5)*3.4,(r()-.5)*3.4);g.fillStyle='rgba(12,16,20,.075)';outline(g,points);g.fill();g.restore();}
    g.fillStyle='rgba(8,12,15,.68)';outline(g,points);g.fill();g.globalCompositeOperation='destination-out';
    for(let j=0;j<125;j++){g.fillStyle='rgba(0,0,0,'+(r()*.2)+')';g.fillRect(23+r()*50,25+r()*46,.6+r()*1.8,.5+r()*1.4);}
    });atlas.push(c);
  }
  const crystals=[];
  for(let k=0;k<4;k++){
    const [c,g]=surface(112,112);rememberAsset(c,()=>{const r=rng(911+k*41);g.translate(56,56);g.rotate(r()*TAU);g.lineCap='round';
    for(let arm=0;arm<6;arm++){
      g.save();g.rotate(arm*TAU/6+(r()-.5)*.065);const length=34+r()*8;
      g.strokeStyle='rgba(12,17,21,.8)';g.lineWidth=2.8+r();g.beginPath();g.moveTo(0,2);g.quadraticCurveTo((r()-.5)*3,-length*.45,(r()-.5)*1.5,-length);g.stroke();
      for(let twig=0;twig<2;twig++){const y=-length*(.43+twig*.28),len=8+r()*4-twig*2;g.lineWidth=2+r()*.7;for(const sign of [-1,1]){g.beginPath();g.moveTo(0,y);g.quadraticCurveTo(sign*len*.5,y-len*.25,sign*len*.8,y-len*.85);g.stroke();}}
      g.restore();
    }
    });crystals.push(c);
  }
  // Cached Gaussian levels are blended in premultiplied alpha. There are no depth bands.
  const spriteSide=224,focusLevels=[0,.9,1.8,3.4,5.8,9,14,21];
  function focusCache(source,diameter){
    const [base,g]=surface(spriteSide,spriteSide);rememberAsset(base,()=>g.drawImage(source,(spriteSide-source.width)/2,(spriteSide-source.height)/2));
    const levels=[base];
    for(let i=1;i<focusLevels.length;i++){const [c,b]=surface(spriteSide,spriteSide);rememberAsset(c,()=>{b.filter='blur('+focusLevels[i]+'px)';b.drawImage(base,0,0);b.filter='none';});levels.push(c);}
    return{levels,diameter};
  }
  const inkFocus=atlas.map(c=>focusCache(c,44)),crystalFocus=crystals.map(c=>focusCache(c,84));
  const [focusTile,ftg]=surface(spriteSide,spriteSide);
  const [tile,tg]=surface(640,640),tileCenter=320;
  const CAMERA={focal:620,near:2.6,far:10.8};
  let depthRange={from:[settings.zMin,settings.zMax,settings.nearZ],to:[settings.zMin,settings.zMax,settings.nearZ],start:0,duration:1.2};
  const FIELD={x:-210,y:-160,width:W+420,height:H+320};
  const exposure=.085;
  let lastTileHalf=0,elapsed=0,backgroundTime=0,last=0,raf=0,visible=true,gustStart=-100,gustDirection=1,compact=false,cssWidth=736;
  let pointerWind=0,pointerWindTarget=0,lastPointerX=NaN,pointerInside=false,lastPointerTime=0;
  let scrollImpulse=0,scrollAir=0,scrollMagnitudeImpulse=0,scrollMagnitudeAir=0,scrollCount=0,scrollIgnored=0;
  // Camera translation is integrated into the physical particles, not applied to
  // old display frames. The goal is monotonic between real scroll events: no spring-back.
  let scrollCameraGoal=0,scrollCameraApplied=0,scrollCameraVelocity=0;
  let scrollCameraDirty=false,lastCameraApplyMs=NaN,scrollInputMs=NaN;
  let scrollReprojectionCount=0,reservoirWrapCount=0,lastScrollResponseMs=0;
  let lastRenderMs=0,renderTotalMs=0,renderSamples=0;
  let reservoirChecks=0;
  let scrollContainer=null,previousScrollTop=NaN,lastScrollEventMs=NaN;
  // Display-rate camera exposure is separate from held snow/layer captures.
  // These values never change particle coordinates or their birth sequence.
  let scrollCloudY=0,pendingCloudY=0,scrollCloudVelocity=0,scrollExposureVelocity=0;
  let renderedScrollEffects='',cloudBlurPasses=0;
  function scrollFrameSeconds(now){
    return last&&now>last&&now-last<200?Math.max(1/240,(now-last)/1000):1/60;
  }
  function scrollBlurSeconds(){return settings.scrollWind?settings.scrollBlur/60:0;}
  function extraScrollTrace(p,f){
    const seconds=scrollBlurSeconds();if(!seconds)return 0;
    const velocity=isCameraScrollMode()?-scrollExposureVelocity*CAMERA.focal/p.z:
      f.fall*settings.speed*(compact?1.25:1)*scrollSpeedFactor()*CAMERA.focal/p.z;
    const trace=velocity*seconds;return Math.abs(trace)<.015?0:trace;
  }
  function cloudScrollTrace(){
    const trace=settings.scrollClouds?scrollCloudVelocity*scrollBlurSeconds():0;
    return Math.abs(trace)<.015?0:trace;
  }
  function scrollEffectKey(){
    if(!scrollBlurSeconds())return '0';
    const motion=isCameraScrollMode()?scrollExposureVelocity:scrollSpeedFactor();
    return [settings.scrollBlur,Math.round(motion*1000),Math.round(cloudScrollTrace()*1000)].join('/');
  }
  function updateScrollEffects(now,cameraChanged){
    const dt=scrollFrameSeconds(now),decay=Math.exp(-dt*28);
    if(!cameraChanged)scrollExposureVelocity*=decay;
    let cloudChanged=false;
    if(pendingCloudY!==0){
      const delta=pendingCloudY;pendingCloudY=0;scrollCloudY+=delta;
      scrollCloudVelocity=delta/dt;cloudChanged=true;backgroundCacheKey='';
    }else scrollCloudVelocity*=decay;
    if(Math.abs(scrollExposureVelocity)<.001)scrollExposureVelocity=0;
    if(Math.abs(scrollCloudVelocity)<.001)scrollCloudVelocity=0;
    return cloudChanged;
  }
  const PHYSICS_STEP=1/120;
  let physicsTime=0,physicsTick=0,backgroundPhysics=0;
  let backgroundCacheKey='',backgroundCaptureCount=0,filmSampleTime=0;
  let backgroundShownPhase=NaN,backgroundRateTime=0,backgroundRatePhase=0;
  let captureOrigin=0,captureIndex=0,captureCount=0,historyValid=false,historyTime=-1,displayedAt=0;
  let presentationCount=0,captureReady=false,transitionReady=false,latestCaptureTime=0,previousCaptureTime=0,screenBlend=1;
  let lastSnowFrame=null,lastFilmTime=0,lastFilmSeed=0;
  let presentationTime=NaN,presentationPoses=[];
  let latestParticles=new Map(),previousParticles=new Map();
  let displayPose={x:0,y:0,angle:0,zoom:1};
  const displayedParticles=new Map();
  let observing=false,tracked=null,trackedGeneration=-1,lastInspect=-1;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');let paused=typeof options.paused==='boolean'?options.paused:reduced.matches;
  const random=rng(4567),flakes=[];
  const grainFrames=[],grainSamples=[];
  for(let k=0;k<8;k++){
    const [c,g]=surface(128,128),r=rng(3181+k*947),data=g.createImageData(128,128);
    for(let i=0;i<data.data.length;i+=4){
      const value=Math.max(62,Math.min(194,128+normal(r)*24));
      data.data[i]=value;data.data[i+1]=value;data.data[i+2]=value;data.data[i+3]=255;
    }
    rememberAsset(c,()=>{g.putImageData(data,0,0);grainFrames[k]=output.createPattern(c,'repeat');});
    const count=128*128,samples=new Float32Array(count);let sum=0,sum2=0;
    for(let i=0;i<count;i++){const value=data.data[i*4];sum+=value;sum2+=value*value;}
    const mean=sum/count,sigma=Math.sqrt(Math.max(1e-8,sum2/count-mean*mean));
    for(let i=0;i<count;i++)samples[i]=(data.data[i*4]-mean)/sigma;
    grainSamples.push(samples);
  }
  const smoothGrainPixels=smoothGrainContext.createImageData(128,128);
  const grainBlendA=new Float32Array(128*128),grainBlendB=new Float32Array(128*128);
  let grainBlendCache=null;
  function frameRandom(n){return rng(Math.imul(n+1,15485863)^81721);}
  function blendedGrain(time){
    const position=time*3,slot=Math.floor(position),u=position-slot,blend=u*u*(3-2*u);
    if(!grainBlendCache||grainBlendCache.slot!==slot){
      const source=[];
      for(let layer=0;layer<2;layer++){
        const r=frameRandom(slot+layer+71011),x=Math.floor(r()*128),y=Math.floor(r()*128);
        source.push({x,y,data:grainSamples[Math.floor(r()*grainSamples.length)]});
      }
      let aa=0,bb=0,ab=0;
      for(let y=0;y<128;y++)for(let x=0;x<128;x++){
        const i=y*128+x,a=source[0],b=source[1];
        const va=a.data[((y+a.y)&127)*128+((x+a.x)&127)];
        const vb=b.data[((y+b.y)&127)*128+((x+b.x)&127)];
        grainBlendA[i]=va;grainBlendB[i]=vb;aa+=va*va;bb+=vb*vb;ab+=va*vb;
      }
      grainBlendCache={slot,aa:aa/(128*128),bb:bb/(128*128),ab:ab/(128*128)};
    }
    const a=1-blend,b=blend,m=grainBlendCache;
    // Ordinary crossfades lose half their variance at the midpoint. Center
    // both fields and normalize the actual variance, including correlation,
    // so the hard-light grain keeps a steady strength on bright watercolor.
    const gain=24/Math.sqrt(Math.max(1e-8,a*a*m.aa+b*b*m.bb+2*a*b*m.ab));
    const pixels=smoothGrainPixels.data;
    for(let i=0;i<grainBlendA.length;i++){
      const value=128+gain*(a*grainBlendA[i]+b*grainBlendB[i]),q=i*4;
      pixels[q]=value;pixels[q+1]=value;pixels[q+2]=value;pixels[q+3]=255;
    }
    smoothGrainContext.setTransform(1,0,0,1,0,0);
    smoothGrainContext.putImageData(smoothGrainPixels,0,0);
    return output.createPattern(smoothGrainTile,'repeat');
  }
  function smooth(a,b,value){const t=Math.max(0,Math.min(1,(value-a)/(b-a)));return t*t*(3-2*t);}
  function triggerWind(direction=1){gustDirection=direction<0?-1:1;gustStart=elapsed;}
  function resetPointerWindTracking(){lastPointerX=NaN;pointerInside=false;}
  // Real page movement only: scrollTop deltas are never used as absolute camera offsets.
  function scrollPosition(target){
    if(!target)return NaN;
    if(target===window)return Number(window.scrollY??document.scrollingElement?.scrollTop??0);
    return Number(target.scrollTop);
  }
  function scrollViewportHeight(target){
    return target===window?window.innerHeight:target.clientHeight;
  }
  function resetScrollMotion(){
    scrollImpulse=0;scrollAir=0;scrollMagnitudeImpulse=0;scrollMagnitudeAir=0;
    scrollCameraGoal=scrollCameraApplied;scrollCameraVelocity=0;scrollCameraDirty=false;lastCameraApplyMs=NaN;scrollInputMs=NaN;
    pendingCloudY=0;scrollCloudVelocity=0;scrollExposureVelocity=0;
    previousScrollTop=scrollPosition(scrollContainer);
    lastScrollEventMs=window.performance?.now?.()??Date.now();
  }
  function isCameraScrollMode(){return settings.scrollMode==='camera'||settings.scrollMode==='cameraSame';}
  function onPageScroll(){
    const top=scrollPosition(scrollContainer);
    if(!Number.isFinite(top))return;
    const now=window.performance?.now?.()??Date.now();
    const delta=top-previousScrollTop;
    const gap=now-lastScrollEventMs;
    previousScrollTop=top;
    lastScrollEventMs=now;
    if(!settings.scrollWind||paused||suspended||document.hidden||!visible)return;
    // A resumed page, hash navigation or browser-back jump must not create a gust.
    if(!Number.isFinite(delta)||!Number.isFinite(gap)||gap<0)return;
    const limit=Math.max(1200,scrollViewportHeight(scrollContainer)*1.8);
    if(Math.abs(delta)>limit){scrollIgnored++;return;}
    // No per-event, accumulated-impulse, or positive velocity ceiling.
    // Large discontinuous jumps are still filtered above, but ordinary wheel
    // and trackpad gestures remain proportional to their actual travel.
    if(isCameraScrollMode()){
      // Default: downward page scroll moves the view downward, snow upward.
      // cameraSame: reverse the simulated camera displacement so snow follows
      // the scroll direction. Both retain continuous inverse-z parallax.
      const direction=settings.scrollMode==='cameraSame'?-1:1;
      // Convert CSS scroll pixels to this canvas's logical camera units.
      const pixelScale=W/Math.max(1,cssWidth);
      scrollCameraGoal+=direction*delta*pixelScale*(6/CAMERA.focal)*0.72*settings.scrollStrength;
      if(delta!==0&&settings.scrollStrength>0){
        if(!scrollCameraDirty)scrollInputMs=now;
        scrollCameraDirty=true;
      }
    }else{
      scrollImpulse+=delta*1.5;
      // In speed mode, reversals must not cancel separate acceleration gestures.
      scrollMagnitudeImpulse+=Math.abs(delta)*1.5;
    }
    if(settings.scrollClouds&&settings.scrollCloudStrength>0){
      const signed=settings.scrollMode==='camera'?-delta:
        settings.scrollMode==='speed'&&settings.scrollBothDirections?Math.abs(delta):delta;
      pendingCloudY+=signed*(W/Math.max(1,cssWidth))*.72*settings.scrollCloudStrength;
    }
    scrollCount++;
  }
  function setScrollContainer(target=window){
    const next=target||window;
    if(typeof next.addEventListener!=='function'||!Number.isFinite(scrollPosition(next)))
      throw new TypeError('scrollContainer는 Window 또는 스크롤 가능한 HTMLElement여야 합니다.');
    if(scrollContainer===next)return;
    if(scrollContainer)scrollContainer.removeEventListener('scroll',onPageScroll);
    scrollContainer=next;
    scrollContainer.addEventListener('scroll',onPageScroll,{passive:true});
    resetScrollMotion();
  }
  function applyScrollCamera(now){
    if(!scrollCameraDirty||!settings.scrollWind||!isCameraScrollMode())return false;
    const step=scrollCameraGoal-scrollCameraApplied;
    scrollCameraDirty=false;
    if(Math.abs(step)<1e-12)return false;
    const dt=Number.isFinite(lastCameraApplyMs)?Math.max(1/120,Math.min(.1,(now-lastCameraApplyMs)/1000)):1/60;
    scrollCameraApplied=scrollCameraGoal;scrollCameraVelocity=step/dt;lastCameraApplyMs=now;
    scrollExposureVelocity=step/scrollFrameSeconds(now);
    for(const f of flakes){
      if(!snowIsActive(f))continue;
      f.y-=step;
      recycleReservoir(f,projectParticle(f));
    }
    // Stored poses belong to the held film frame. Translate them at their own
    // depths; neither its animation time nor its exposure mixture is changed.
    historyValid=false;transitionReady=false;
    return true;
  }
  function reservoirBounds(p){
    // The full defocus + shutter footprint must leave the screen before wrap.
    const support=p.size*4+p.coc*2+24;
    const gx=Math.max(210,support),gy=Math.max(160,support);
    return {x:-gx,y:-gy,width:W+2*gx,height:H+2*gy};
  }
  function recycleReservoir(f,p){
    reservoirChecks++;
    let box=reservoirBounds(p);
    if(p.x>=box.x&&p.x<box.x+box.width&&p.y>=box.y&&p.y<box.y+box.height)return false;
    const lens=settings.nearLens&&f.lensRank<settings.nearFraction;
    if(f.lens!==lens){
      // Retain the existing projected position while changing depth class,
      // exclusively beyond the larger of the old and new optical footprints.
      const old=f.lens;f.lens=lens;updateDepth(f,0);
      let next=projectParticle(f);const nextBox=reservoirBounds(next);
      const safe=p.x<Math.min(box.x,nextBox.x)||p.x>Math.max(box.x+box.width,nextBox.x+nextBox.width)||
        p.y<Math.min(box.y,nextBox.y)||p.y>Math.max(box.y+box.height,nextBox.y+nextBox.height);
      if(!safe){f.lens=old;updateDepth(f,0);return false;}
      f.x+=(p.x-next.x)*next.z/CAMERA.focal;f.y+=(p.y-next.y)*next.z/CAMERA.focal;
      p=projectParticle(f);box=reservoirBounds(p);f.generation++;
    }
    // Modulo transport retains overshoot and the tangential coordinate. Fast
    // scroll therefore fills the newly exposed strip instead of depositing
    // all recycled particles on one edge or waiting for a guessed entry path.
    const x=box.x+((p.x-box.x)%box.width+box.width)%box.width;
    const y=box.y+((p.y-box.y)%box.height+box.height)%box.height;
    const dx=(x-p.x)*p.z/CAMERA.focal,dy=(y-p.y)*p.z/CAMERA.focal;
    f.x+=dx;f.y+=dy;f.wrapX=(f.wrapX||0)+dx;f.wrapY=(f.wrapY||0)+dy;
    reservoirWrapCount++;
    return true;
  }
  function birthPosition(f,initial=false,exit=null){
    // Births alone choose a less crowded route. Nothing pushes or teleports a
    // visible flake, and neither the render clock nor the layer caches enter
    // this calculation. Keep a separate stream so material/depth seeds survive.
    const r=rng(0x1be7a03d^Math.imul(f.id+1,0x9e3779b1)^Math.imul(f.generation+2,0x85ebca6b));
    const horizons=[0,1.2,2.4],base=horizons.map(t=>projectParticle(f,t));
    const ratios=base.map(p=>base[0].z/p.z);
    const radial=horizons.map((t,i)=>base[i].vz/base[i].z);
    const neighbors=horizons.map(t=>{
      // Spacing is geometric: focus, aperture, blur, and film never alter births.
      const list=[],rows=new Map();let maxBody=0;
      for(const other of flakes)if(other!==f&&snowIsActive(other)){
        const p=projectParticle(other,t),body=1.05*p.baseSize,index=list.length;
        list.push(p.x,p.y,body);maxBody=Math.max(maxBody,body);
        const x=Math.floor(p.x/128),y=Math.floor(p.y/128);
        if(!rows.has(x))rows.set(x,new Map());
        const row=rows.get(x);if(!row.has(y))row.set(y,[]);row.get(y).push(index);
      }
      return{list,rows,maxBody};
    });
    const preferred=!exit?'top':exit.y>=FIELD.y+FIELD.height?'top':exit.y<FIELD.y?'bottom':
      exit.x>=FIELD.x+FIELD.width?'left':'right';
    const sidePoint=side=>{
      // The outer part of the reservoir keeps roughly 120 visible flakes;
      // broad tangential choices avoid feeding a narrow lane into the scene.
      const along=r(),padding=2+r()*18,extra=f.lens?Math.max(0,Math.max(...base.map(p=>p.size*2.5+p.coc*2))-120):0;
      if(side==='top')return{x:FIELD.x+along*FIELD.width,y:FIELD.y-extra+padding,side};
      if(side==='bottom')return{x:FIELD.x+along*FIELD.width,y:FIELD.y+FIELD.height+extra-padding,side};
      if(side==='left')return{x:FIELD.x-extra+padding,y:FIELD.y+along*FIELD.height,side};
      return{x:FIELD.x+FIELD.width+extra-padding,y:FIELD.y+along*FIELD.height,side};
    };
    const inward=(p,side)=>side==='top'?p.vy:side==='bottom'?-p.vy:side==='left'?p.vx:-p.vx;
    const beforeEntry=(p,side)=>side==='top'?p.y<0:side==='bottom'?p.y>H:side==='left'?p.x<0:p.x>W;
    function crossesView(a,b){
      // Segment/expanded-viewport intersection also catches a fast crossing
      // between lookahead samples, instead of rejecting an otherwise good inlet.
      let low=0,high=1;
      for(const [v,d,min,max] of [[a.x,b.x-a.x,-32,W+32],[a.y,b.y-a.y,-32,H+32]]){
        if(Math.abs(d)<1e-8){if(v<min||v>max)return false;continue;}
        const t0=(min-v)/d,t1=(max-v)/d;
        low=Math.max(low,Math.min(t0,t1));high=Math.min(high,Math.max(t0,t1));
        if(low>high)return false;
      }
      return true;
    }
    let best=null,bestScore=-Infinity;
    const count=initial?24:32;
    for(let k=0;k<count;k++){
      let candidate;
      if(initial)candidate={x:FIELD.x+r()*FIELD.width,y:FIELD.y+r()*FIELD.height,side:null};
      else{
        // A side exit can be caused by radial expansion: wrapping it to the
        // opposite side would immediately point outward again. Always offer
        // top routes as well, and test flow at the candidate, not at the exit.
        const side=k<20?preferred:'top';
        candidate=sidePoint(side);
        if(k===count-1){candidate.x=W*(.35+r()*.3);candidate.y=FIELD.y+3;}
      }
      const dx=candidate.x-base[0].x,dy=candidate.y-base[0].y;
      const poses=base.map((p,i)=>({...p,x:p.x+dx*ratios[i],y:p.y+dy*ratios[i],
        vx:p.vx-dx*ratios[i]*radial[i],vy:p.vy-dy*ratios[i]*radial[i]}));
      if(!initial){
        if(inward(poses[0],candidate.side)<4)continue;
        if(poses.some((p,i)=>i>0&&beforeEntry(p,candidate.side)&&inward(p,candidate.side)<-4))continue;
        const crosses=crossesView(poses[0],poses[1])||crossesView(poses[1],poses[2]);
        // Slow, distant flakes may arrive after the last sample. Accept those
        // only when their remaining forward route can still reach the view.
        const last=poses[2],later={x:last.x+last.vx*3,y:last.y+last.vy*3};
        if(!crosses&&!crossesView(last,later))continue;
      }
      let score=0;
      for(let h=0;h<poses.length;h++){
        const p=poses[h],near=neighbors[h],list=near.list,body=1.05*p.baseSize;
        const reach=Math.ceil(2.3*Math.max(22,body+near.maxBody)/128);
        const gx=Math.floor(p.x/128),gy=Math.floor(p.y/128);
        let nearest=2.3,penalty=0,close=0;
        // Scores saturate at 2.3 radii, so distant cells cannot change the
        // winning candidate. Query only nearby buckets, retaining the metric.
        for(let bx=gx-reach;bx<=gx+reach;bx++){
          const row=near.rows.get(bx);if(!row)continue;
          for(let by=gy-reach;by<=gy+reach;by++){
            const bucket=row.get(by);if(!bucket)continue;
            for(const i of bucket){
              const radius=Math.max(22,body+list[i+2]),dx=p.x-list[i],dy=p.y-list[i+1];
              if(dx*dx+dy*dy>=5.29*radius*radius)continue;
              const distance=Math.hypot(dx,dy)/radius;
              nearest=Math.min(nearest,distance);
              if(distance<1.2){penalty+=(1.2-distance)*(1.2-distance);if(distance<1)close++;}
            }
          }
        }
        const weight=initial?[.65,.22,.13][h]:[.15,.45,.4][h];
        score+=weight*(nearest-2*penalty-4*Math.max(0,close-1));
      }
      if(score>bestScore){bestScore=score;best=candidate;}
    }
    if(!best)return false;
    f.x+=(best.x-base[0].x)*base[0].z/CAMERA.focal;
    f.y+=(best.y-base[0].y)*base[0].z/CAMERA.focal;
    return true;
  }
  function spawn(f,initial=false){
    f.generation++;f.lens=settings.nearLens&&f.lensRank<settings.nearFraction;
    if(initial){
      f.depthCenter=6.6+(random()-.5)*.3;
      f.depthAmplitude=2.15+random()*.95;
      f.depthFrequency=.24+random()*.17;
      f.depthPhase=random()*TAU;
      updateDepth(f,0);
    }
    const sx=FIELD.x+random()*FIELD.width,sy=FIELD.y+random()*FIELD.height;
    f.x=(sx-W/2)*f.z/CAMERA.focal-Math.sin(elapsed*f.flutter+f.phase)*f.flutterAmp;
    f.y=(sy-H/2)*f.z/CAMERA.focal-Math.sin(elapsed*.7+f.phase)*.018;
    const rate=settings.speed*(compact?1.25:1);
    f.vx=.75*f.drift*rate;f.vy=f.fall*rate;
    birthPosition(f,true);
  }
  function updateDepth(f,dt){
    f.depthPhase+=f.depthFrequency*settings.zmotion*dt;
    const sample=depthAt(f,elapsed,f.depthPhase);f.z=sample.z;f.vz=sample.vz;
  }
  const particleCount=Math.round(120*FIELD.width*FIELD.height/(W*H));
  const maxParticleCount=particleCount*2;
  // Keep the original cohort and its seed/order intact at 100%. Reserve only
  // small bookkeeping arrays for 200%; extra geometry is made on demand.
  const amountRanks=Array.from({length:particleCount},(_,id)=>id);
  const amountRandom=rng(0x65b31ad7);
  for(let i=amountRanks.length-1;i>0;i--){
    const j=Math.floor(amountRandom()*(i+1));
    [amountRanks[i],amountRanks[j]]=[amountRanks[j],amountRanks[i]];
  }
  const lensRanks=Array.from({length:particleCount},(_,id)=>id),lensRandom=rng(0x727a19);
  for(let i=lensRanks.length-1;i>0;i--){const j=Math.floor(lensRandom()*(i+1));[lensRanks[i],lensRanks[j]]=[lensRanks[j],lensRanks[i]];}
  function snowPresence(f,time=elapsed){
    if(!f)return 0;
    const to=f.amountTarget===undefined?1:f.amountTarget;
    const from=f.amountFrom===undefined?to:f.amountFrom;
    if(from===to)return to;
    const u=Math.max(0,Math.min(1,(time-f.amountStart)/f.amountDuration));
    return from+(to-from)*u*u*(3-2*u);
  }
  function snowIsActive(f,time=elapsed){
    return (f.amountTarget===undefined?1:f.amountTarget)>0||snowPresence(f,time)>0;
  }
  function makeFlake(i,amount=1){
    const f={id:i,generation:-1,lensRank:(lensRanks[i%particleCount]+.5)/particleCount,lens:false,worldSize:.042+random()*.045,fall:1.35+random()*.8,drift:.8+random()*.4,
      baseVz:(random()<.5?-1:1)*(.55+random()*.75),alpha:.78+random()*.2,
      phase:random()*TAU,flutter:.55+random()*.4,flutterAmp:.045+random()*.065,
      spin:(random()-.5)*.6,angle:random()*TAU,atlas:Math.floor(random()*atlas.length),
      crystal:i%37===17,crystalIndex:Math.floor(random()*crystals.length),
      amountRank:i<particleCount?amountRanks[i]:i,
      amountFrom:amount,amountTarget:amount,amountStart:elapsed,amountDuration:.8};
    spawn(f,true);flakes.push(f);return f;
  }
  for(let i=0;i<particleCount;i++)makeFlake(i);
  function setSnowAmount(value){
    const numeric=Number(value);
    const ratio=Number.isFinite(numeric)?Math.max(0,Math.min(2,numeric)):1;
    settings.snowAmount=ratio;
    const target=Math.round(particleCount*ratio);
    const shownTime=settings.renderer==='field'&&Number.isFinite(presentationTime)?presentationTime:elapsed;
    // Lazily extend the reservoir. Existing particles, layer capture times,
    // short-exposure ranks, and already displayed poses are never reset.
    while(flakes.length<target){
      const f=makeFlake(flakes.length,0);
      f.amountTarget=1;
      f.amountStart=shownTime+.25*rng(0x137abc^Math.imul(f.id+1,8191))();
      if(paused)f.amountFrom=1;
      if(Number.isFinite(presentationTime))presentationPoses[f.id]={
        pose:projectParticle(f,presentationTime-elapsed),generation:f.generation,camera:scrollCameraApplied,wrapX:f.wrapX||0,wrapY:f.wrapY||0};
    }
    for(const f of flakes){
      const wanted=f.amountRank<target?1:0;
      const current=snowPresence(f,shownTime);
      if(wanted===f.amountTarget){
        if(paused){f.amountFrom=wanted;f.amountStart=shownTime;}
        continue;
      }
      const wasDormant=!snowIsActive(f);
      // Hidden particles may be re-seeded; visible particles never are.
      if(wanted&&wasDormant){
        if(birthPosition(f,true))f.generation++;
        if(Number.isFinite(presentationTime))presentationPoses[f.id]={
          pose:projectParticle(f,presentationTime-elapsed),generation:f.generation,camera:scrollCameraApplied,wrapX:f.wrapX||0,wrapY:f.wrapY||0};
      }
      f.amountFrom=paused?wanted:current;f.amountTarget=wanted;
      f.amountStart=shownTime+.25*rng(0x137abc^Math.imul(f.id+1,8191))();
      f.amountDuration=wanted?.9:.65;
    }
    // Histories are not cleared. Their contribution is gated per particle at
    // the shared presentation time, preventing old marks from surviving 0%.
    render(true);
  }
  function defocusFor(z,size){
    const raw=38*settings.aperture*Math.abs(1/z-1/settings.focus),limit=size*.32+.65;
    return limit*Math.tanh(raw/limit);
  }
  function projectParticle(f,offset=0,cameraExposure=false){
    const t=elapsed+offset,stateOffset=t-physicsTime,phase=f.depthPhase+f.depthFrequency*settings.zmotion*stateOffset;
    const depth=depthAt(f,t,phase),z=depth.z,vz=depth.vz;
    const x=f.x+f.vx*stateOffset+Math.sin(t*f.flutter+f.phase)*f.flutterAmp;
    // Treat camera motion as a real velocity over the short shutter interval.
    // Long lookahead samples must not extrapolate an already-decaying impulse.
    const cameraVy=Math.abs(stateOffset)<.21&&settings.scrollWind&&isCameraScrollMode()?scrollCameraVelocity:0;
    const y=f.y+f.vy*stateOffset-(cameraExposure?cameraVy*offset:0)+Math.sin(t*.7+f.phase)*.018;
    const vx=f.vx+Math.cos(t*f.flutter+f.phase)*f.flutter*f.flutterAmp;
    const vy=f.vy-cameraVy+Math.cos(t*.7+f.phase)*.0126;
    const scale=CAMERA.focal/z,baseSize=f.worldSize*scale*(compact?1.25:1),baseSizeRate=-baseSize*vz/z;
    const size=baseSize*settings.snowSize;
    return{x:W/2+x*scale,y:H/2+y*scale,z,vz,nearLens:f.lens,size,baseSize,baseSizeRate,
      vx:CAMERA.focal*(vx*z-x*vz)/(z*z),vy:CAMERA.focal*(vy*z-y*vz)/(z*z),
      sizeRate:baseSizeRate*settings.snowSize,coc:defocusFor(z,size),
      angle:f.angle+Math.sin(t*.36+f.phase)*.28+t*f.spin+f.vx*.15,
      width:.72+.28*(.5+.5*Math.cos(t*.65+f.phase))};
  }
  function scrollSpeedFactor(){
    if(!settings.scrollWind||isCameraScrollMode())return 0;
    const impulse=settings.scrollBothDirections?scrollMagnitudeAir:scrollAir;
    // No upper cap: sustained faster scrolling can continue to accelerate.
    // Directional legacy mode has only a floor, never reversing falling snow.
    return Math.max(settings.scrollBothDirections?0:-0.95,impulse*settings.scrollStrength/230);
  }
  function update(dt){
    physicsTime+=dt;elapsed=physicsTime;backgroundPhysics+=dt*settings.background;backgroundTime=backgroundPhysics;
    const age=elapsed-gustStart;
    const gust=(age>=0&&age<7?115*Math.sin(Math.min(1,age/1.1)*Math.PI/2)*Math.exp(-Math.max(0,age-1.1)/2):0)*gustDirection;
    pointerWindTarget*=Math.exp(-dt*2.4);
    if(elapsed-lastPointerTime>.18)pointerWindTarget*=Math.exp(-dt*3.8);
    pointerWind+=(pointerWindTarget-pointerWind)*(1-Math.exp(-dt*8));
    // Fixed-step, damped response. Above and below scroll have the same
    // acceleration when enabled. Do not clamp positive velocity to a plateau.
    const decay=Math.exp(-dt*5.3),blend=1-Math.exp(-dt*11);
    scrollImpulse*=decay;
    scrollMagnitudeImpulse*=decay;
    scrollAir+=(scrollImpulse-scrollAir)*blend;
    scrollMagnitudeAir+=(scrollMagnitudeImpulse-scrollMagnitudeAir)*blend;
    const scrollFactor=scrollSpeedFactor();
    // Camera position is applied once per browser frame before this fixed-step
    // simulation. Only its exposure velocity decays; position never springs back.
    scrollCameraVelocity*=Math.exp(-dt*28);
    // Cloud translation is applied at display rate, independently of wash time.
    const shared=(64+42*Math.sin(elapsed*.38)+18*Math.sin(elapsed*.19+.6)+gust+pointerWind)/100;
    const flowScale=settings.speed*(compact?1.25:1);
    for(const f of flakes){
      if(!snowIsActive(f))continue;
      const air=.13*Math.sin(f.y*.9+elapsed*.6)+.09*Math.cos(f.x*.8-elapsed*.32);
      const target=(shared*f.drift+air)*flowScale;
      f.vx+=(target-f.vx)*(1-Math.exp(-dt*2));f.vy=f.fall*flowScale*(1+scrollFactor);
      f.x+=f.vx*dt;f.y+=f.vy*dt;updateDepth(f,dt);
      recycleReservoir(f,projectParticle(f));
    }
  }
  function drawBackground(){
    clearBackdrop(ctx);
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.fillStyle=settings.backgroundColor;ctx.fillRect(0,0,W,H);
    const trace=cloudScrollTrace();cloudBlurPasses=0;
    if(Math.abs(trace)<.25){
      watercolorDrift.draw(ctx,backgroundTime,settings.cloudMorph,scrollCloudY);
    }else{
      // Average whole opaque background samples in premultiplied light rather
      // than repeatedly source-overing translucent pigment (which darkens it).
      const scale=canvas.width/W,nodes=[-.4,-.2,0,.2,.4],weights=[1/16,4/16,6/16,4/16,1/16];
      cloudExposureContext.setTransform(1,0,0,1,0,0);cloudExposureContext.clearRect(0,0,cloudExposure.width,cloudExposure.height);
      cloudExposureContext.globalCompositeOperation='lighter';
      for(let i=0;i<nodes.length;i++){
        cloudSampleContext.setTransform(scale,0,0,scale,0,0);cloudSampleContext.globalAlpha=1;
        cloudSampleContext.globalCompositeOperation='source-over';cloudSampleContext.fillStyle=settings.backgroundColor;
        cloudSampleContext.fillRect(0,0,W,H);
        watercolorDrift.draw(cloudSampleContext,backgroundTime,settings.cloudMorph,scrollCloudY+trace*nodes[i]);
        cloudExposureContext.globalAlpha=weights[i];cloudExposureContext.drawImage(cloudSample,0,0);cloudBlurPasses++;
      }
      cloudExposureContext.globalAlpha=1;cloudExposureContext.globalCompositeOperation='source-over';
      ctx.drawImage(cloudExposure,0,0,W,H);
    }
    backgroundShownPhase=backgroundTime;
  }
/*
 * Compact snow exposure. All motion components share one presentation center.
 * No offset samples or long shutter path are generated.
 *
 * compactSnowMotion(p, exposureSeconds, preservation=.35):
 *   haloMix, motion={xx,xy,yy} (screen-space covariance in logical px^2),
 *   length/radial/trace/maxSize/duration (bounded legacy/observer metadata).
 *
 * A production field uses two stamps at p:
 *   {p,center:p,weight:1-haloMix,...}                  // existing 3 lobes
 *   {p,center:p,weight:haloMix,motion,singleLobe:true} // one broad halo
 * Keep each stamp's ordinary density unchanged: their masses sum to one.
 * q=1 short exposure keeps the existing fresh one-stamp, three-lobe path.
 *
 * compactMotionAxes(p,sigma2,motion,singleLobe) adds analytic motion covariance
 * to the material body and optical sigma2 to the diagonal. Store 10*sigma2
 * separately in kernel[6] so existing pose re-projection keeps optical blur
 * isotropic, while the material body and motion halo transform together.
 */
function compactSnowMotion(p, exposureSeconds, preservation=.35) {
  const diameter=Math.max(.1,Number(p.size)||.1);
  const vx=Number(p.vx)||0,vy=Number(p.vy)||0,speed=Math.hypot(vx,vy);
  const sizeSpeed=Math.abs(Number(p.sizeRate)||0)*.5;
  const requested=Math.max(0,Number(exposureSeconds)||0);
  const m=Math.max(0,Math.min(1,Number(preservation)||0));
  const travel=(speed+sizeSpeed)*requested;
  const activity=-Math.expm1(-.90*travel/diameter);
  const haloMix=(.64-.20*m)*activity;
  const along=diameter*(.30-.055*m)*Math.sqrt(activity);
  const across=along*(speed>1e-8?.55:1);
  const ux=speed>1e-8?vx/speed:1,uy=speed>1e-8?vy/speed:0;
  const a2=along*along,b2=across*across,difference=a2-b2;
  const motion={xx:b2+difference*ux*ux,xy:difference*ux*uy,yy:b2+difference*uy*uy};
  const trace=2*along;
  return {haloMix,motion,activity,requested,maxSize:diameter,
    length:speed>1e-8?trace:0,radial:speed>1e-8?0:trace,trace,
    duration:speed+sizeSpeed>1e-8?trace/(speed+sizeSpeed):0,
    preserve:true,haloSigma:0,sampleCount:haloMix>1e-8?2:1};
}

function compactMotionAxes(p,sigma2,motion=null,singleLobe=false) {
  const lobeScale=singleLobe?1:.77;
  const bx=p.size*.75*p.width*lobeScale,by=p.size*.75*lobeScale;
  const optical=10*Math.max(0,sigma2);
  if(!motion)return {rx:Math.sqrt(bx*bx+optical),ry:Math.sqrt(by*by+optical),angle:p.angle};
  const c=Math.cos(p.angle),s=Math.sin(p.angle),x2=bx*bx,y2=by*by;
  const xx=c*c*x2+s*s*y2+10*motion.xx+optical;
  const xy=c*s*(x2-y2)+10*motion.xy;
  const yy=s*s*x2+c*c*y2+10*motion.yy+optical;
  const root=Math.hypot(xx-yy,2*xy),sum=xx+yy;
  return {rx:Math.sqrt(Math.max(1e-10,(sum+root)*.5)),
    ry:Math.sqrt(Math.max(1e-10,(sum-root)*.5)),angle:.5*Math.atan2(2*xy,xx-yy)};
}

// Affine for drawing an existing sprite at the same center. Coefficients use
// x'=a*x+b*y, y'=c*x+d*y. Canvas setTransform(a,c,b,d,...) uses that basis.
// Apply halo globalAlpha = haloMix/areaScale, original core = 1-haloMix.
// The SPD square root keeps material orientation continuous as velocity turns;
// a raw ellipse eigenbasis would arbitrarily rotate the source at axis swaps.
function compactSpriteBasis(p,motion){
  const c=Math.cos(p.angle),s=Math.sin(p.angle),r=Math.max(.0001,p.size*.75);
  if(!motion)return{a:c*p.width,b:-s,c:s*p.width,d:c,areaScale:1};
  const x2=r*r*p.width*p.width,y2=r*r;
  const xx=c*c*x2+s*s*y2+10*motion.xx,xy=c*s*(x2-y2)+10*motion.xy;
  const yy=s*s*x2+c*c*y2+10*motion.yy;
  const determinantRoot=Math.sqrt(Math.max(1e-20,xx*yy-xy*xy));
  const denominator=Math.sqrt(Math.max(1e-20,xx+yy+2*determinantRoot));
  const h00=(xx+determinantRoot)/denominator,h01=xy/denominator,h11=(yy+determinantRoot)/denominator;
  return{a:(h00*c+h01*s)/r,b:(-h00*s+h01*c)/r,
    c:(h01*c+h11*s)/r,d:(-h01*s+h11*c)/r,
    areaScale:determinantRoot/Math.max(1e-20,r*r*p.width)};
}


  // These weights integrate one continuous exposure; they are not images of
  // earlier displayed frames. Fixed sample positions avoid sample-count pops.
  const sweepNodes=[-.4,-.2,0,.2,.4];
  const sweepWeights=[1/16,4/16,6/16,4/16,1/16];
  function shutterFor(f,center){
    const improved=(settings.temporal!=='legacy'||isStaggered())&&settings.fps>0;
    let requested;
    if(improved)requested=Math.min(settings.coverage/settings.fps*settings.blur,.18);
    else requested=Math.min(.18,exposure*settings.blur*(1+(looks[settings.look].shutter-1)*settings.film));
    const m=settings.softSnowBlur?settings.softSnowMix:0;
    const compact=compactSnowMotion(center,requested,m);
    if(settings.motionStyle==='compact')return {...compact,improved,style:'compact'};
    const rate=Math.hypot(center.vx,center.vy)+Math.abs(center.sizeRate)*.5;
    const diameter=Math.max(.1,center.size);
    // Leave ordinary exposures unchanged. Only unusually long traces receive
    // a continuous size-relative cap; never collapse travel to a single dot.
    const travel=rate*requested,limit=diameter*7+6;
    const bounded=travel/Math.pow(1+Math.pow(travel/limit,4),.25);
    const duration=rate>1e-8?bounded/rate:requested;
    const a=projectParticle(f,-duration*.5,true),b=projectParticle(f,duration*.5,true);
    const length=Math.hypot(b.x-a.x,b.y-a.y),radial=Math.abs(b.size-a.size)*.5;
    return {...compact,style:'swept',improved,requested,duration,length,radial,
      trace:length+radial,maxSize:Math.max(center.size,a.size,b.size),
      preservation:m,compact,sampleCount:5+(m>1e-8?2:0)};
  }
  function blurFor(f,center=projectParticle(f)){
    const shutter=shutterFor(f,center);
    return {...shutter,components:[{...shutter,mix:1}]};
  }
  function motionSamples(f,center,blur){
    if(blur.style==='compact'){
      const samples=[{p:center,weight:1-blur.haloMix}];
      if(blur.haloMix>1e-8)samples.push({p:center,weight:blur.haloMix,motion:blur.motion,singleLobe:true});
      return samples;
    }
    if(blur.trace<1e-5)return[{p:center,weight:1}];
    const m=blur.preservation,samples=[];
    if(m<1-1e-8){
      for(let i=0;i<sweepNodes.length;i++){
        const p=projectParticle(f,sweepNodes[i]*blur.duration,true);
        // Integrate the unsampled time inside each bin analytically. This
        // connects the five real path samples without a dotted/sharp streak.
        const variance=Math.pow(blur.duration/5,2)/12;
        const radial=Math.pow(p.sizeRate*blur.duration/10,2)/12;
        const skirt=Math.pow(p.size*.06*Math.sqrt(blur.activity),2)+radial;
        const motion={xx:p.vx*p.vx*variance+skirt,
          xy:p.vx*p.vy*variance,yy:p.vy*p.vy*variance+skirt};
        samples.push({p,weight:(1-m)*sweepWeights[i],motion,singleLobe:true});
      }
    }
    if(m>1e-8){
      const compact=blur.compact;
      samples.push({p:center,weight:m*(1-compact.haloMix)});
      if(compact.haloMix>1e-8)samples.push({p:center,weight:m*compact.haloMix,
        motion:compact.motion,singleLobe:true});
    }
    return samples;
  }

  function focusedSprite(f,p){
    const source=f.crystal?crystalFocus[f.crystalIndex]:inkFocus[f.atlas];
    const sigma=Math.min(focusLevels[focusLevels.length-1],p.coc*source.diameter/p.size);
    let low=0;while(low+1<focusLevels.length&&focusLevels[low+1]<=sigma)low++;
    if(low===focusLevels.length-1||sigma-focusLevels[low]<.001)return{image:source.levels[low],span:spriteSide/source.diameter};
    const a=focusLevels[low],b=focusLevels[low+1],weight=(sigma*sigma-a*a)/(b*b-a*a);
    ftg.setTransform(1,0,0,1,0,0);ftg.clearRect(0,0,spriteSide,spriteSide);ftg.globalCompositeOperation='lighter';
    ftg.globalAlpha=1-weight;ftg.drawImage(source.levels[low],0,0);ftg.globalAlpha=weight;ftg.drawImage(source.levels[low+1],0,0);
    ftg.globalAlpha=1;ftg.globalCompositeOperation='source-over';
    return{image:focusTile,span:spriteSide/source.diameter};
  }
  // A render-only representation. It has no access to particle positions, integration,
  // random spawning, or the clock. Capture supplies projected density stamps.
  class DensityLayers {
    constructor(near,far){
      this.count=5;this.width=0;this.height=0;this.layers=[];this.displayLayers=null;this.composedLayers=[];this.total=null;
      this.near=near;this.far=far;
      this.depths=Array.from({length:this.count},(_,i)=>1/(1/far+i/(this.count-1)*(1/near-1/far)));
      [this.canvas,this.context]=surface(1,1);
      this.alphaLut=new Float32Array(16385);
      for(let i=0;i<this.alphaLut.length;i++)this.alphaLut[i]=255*(-Math.expm1(-i/1024));
      this.lastStampCount=0;this.lastKernelCount=0;
    }
    resize(outputWidth){
      const width=Math.max(320,Math.min(1024,Math.round(outputWidth),Math.floor(Math.sqrt(650000*W/H)))),height=Math.round(width*H/W);
      if(width===this.width&&height===this.height)return;
      this.width=width;this.height=height;this.scale=width/W;
      this.layers=Array.from({length:this.count},()=>new Float32Array(width*height));
      this.composedLayers=Array.from({length:this.count},()=>new Float32Array(width*height));
      this.displayLayers=null;
      this.total=new Float32Array(width*height);
      this.canvas.width=width;this.canvas.height=height;
      this.image=this.context.createImageData(width,height);
      this.tooth=new Float32Array(width*height);
      const r=rng(92031);
      for(let i=0;i<this.tooth.length;i++){
        this.tooth[i]=.94+r()*.12;
        const q=i*4;this.image.data[q]=9;this.image.data[q+1]=14;this.image.data[q+2]=19;
      }
    }
    weights(z){
      const t=Math.max(0,Math.min(this.count-1,(1/z-1/this.far)/(1/this.near-1/this.far)*(this.count-1)));
      const lo=Math.min(this.count-2,Math.floor(t)),u=t-lo,w=u*u*(3-2*u);
      return[{index:lo,weight:1-w},{index:lo+1,weight:w}];
    }
    clear(){
      this.displayLayers=null;
      for(const layer of this.layers)layer.fill(0);
      if(this.total)this.total.fill(0);
      this.lastStampCount=0;this.lastKernelCount=0;
    }
    kernel(layer,x,y,rx,ry,angle,mass,grid=null){
      // Compact poly6: integral = pi*rx*ry/4. 'mass' omits the common pi/4.
      // Expanding the support for defocus changes area, never the supplied ink mass.
      const s=grid?grid.scale:this.scale,c=Math.cos(angle),sn=Math.sin(angle);
      const width=grid?grid.width:this.width,height=grid?grid.height:this.height;
      x=(x-(grid?grid.x:0))*s-.5;y=(y-(grid?grid.y:0))*s-.5;rx*=s;ry*=s;
      const ix=1/(rx*rx),iy=1/(ry*ry),amplitude=mass*s*s/(rx*ry);
      const extentX=Math.sqrt(rx*rx*c*c+ry*ry*sn*sn),extentY=Math.sqrt(rx*rx*sn*sn+ry*ry*c*c);
      const x0=Math.max(0,Math.ceil(x-extentX)),x1=Math.min(width-1,Math.floor(x+extentX));
      const y0=Math.max(0,Math.ceil(y-extentY)),y1=Math.min(height-1,Math.floor(y+extentY));
      if(x0>x1||y0>y1||amplitude===0)return;
      const a=c*c*ix+sn*sn*iy,b=2*c*sn*(ix-iy),d=sn*sn*ix+c*c*iy;
      for(let py=y0;py<=y1;py++){
        const dy=py-y,dx=x0-x;
        let q=a*dx*dx+b*dx*dy+d*dy*dy,step=a*(2*dx+1)+b*dy;
        let idx=py*width+x0;
        for(let px=x0;px<=x1;px++,idx++){
          if(q<1){const k=1-(q<0?0:q);layer[idx]+=amplitude*k*k*k;}
          q+=step;step+=2*a;
        }
      }
      this.lastKernelCount++;
    }
    capture(stamps,options){
      this.clear();this.lastStampCount=stamps.length;
      for(const stamp of stamps){
        const p=stamp.p,assign=this.weights(p.z);
        const baseX=p.size*.75*p.width,baseY=p.size*.75;
        const mass=stamp.density*stamp.weight*baseX*baseY;
        for(const {index,weight} of assign){
          if(weight<1e-8)continue;
          const z=this.depths[index],raw=38*options.aperture*Math.abs(1/(p.nearLens?p.z:z)-1/options.focus);
          const limit=p.size*.32+.65,coc=limit*Math.tanh(raw/limit);
          const sigma2=coc*coc+Math.pow(options.spread*p.size*.24,2)+Math.pow(.32/this.scale,2)+(stamp.haloVariance||0);
          // Three overlapping kernels form one irregular ink mark; the material is
          // reconstructed only after every physical particle has contributed.
          const shape=compactMotionAxes(p,sigma2,stamp.motion,stamp.singleLobe);
          for(let lobe=0;lobe<(stamp.singleLobe?1:3);lobe++){
            const fraction=stamp.singleLobe?1:lobe===0?.66:.17,theta=stamp.phase+(lobe-1)*2.8;
            const distance=lobe===0?0:p.size*.23;
            const lx=Math.cos(theta)*distance*p.width,ly=Math.sin(theta)*distance;
            const c=Math.cos(p.angle),sn=Math.sin(p.angle);
            const x=p.x+c*lx-sn*ly,y=p.y+sn*lx+c*ly;
            this.kernel(this.layers[index],x,y,shape.rx,shape.ry,shape.angle,mass*weight*fraction);
          }
        }
      }
      const n=this.total.length;
      for(const layer of this.layers)for(let i=0;i<n;i++)this.total[i]+=layer[i];
    }
    shade(opacity,selectedLayer=-1){
      const density=selectedLayer<0?this.total:(this.displayLayers||this.layers)[selectedLayer],pixels=this.image.data;
      for(let i=0;i<density.length;i++){
        // A single nonlinear response after linear accumulation avoids a brightness
        // dip at depth handoffs. User opacity is applied to final coverage exactly once.
        const value=density[i]*this.tooth[i]*1024;
        const q=value<=0?0:value>=16384?16384:(value+.5)|0;
        pixels[i*4+3]=(this.alphaLut[q]*opacity+.5)|0;
      }
      this.context.putImageData(this.image,0,0);
      return this.canvas;
    }
    totalMass(){let sum=0;for(const d of this.total)sum+=d;return sum/(this.scale*this.scale);}
  }
  const fields=new DensityLayers(
    settings.zMin+(Math.min(...flakes.map(f=>f.depthCenter-f.depthAmplitude))-CAMERA.near)/(CAMERA.far-CAMERA.near)*(settings.zMax-settings.zMin),
    settings.zMin+(Math.max(...flakes.map(f=>f.depthCenter+f.depthAmplitude))-CAMERA.near)/(CAMERA.far-CAMERA.near)*(settings.zMax-settings.zMin)
  );
  function fieldStamps(includeOffscreen=false){
    const stamps=[];
    for(const f of flakes){
      if(!snowIsActive(f))continue;
      const center=projectParticle(f),blur=blurFor(f,center);
      const margin=center.size*3+blur.trace*.6+24;
      if(!includeOffscreen&&(center.x< -margin||center.x>W+margin||center.y< -margin||center.y>H+margin))continue;
      const density=-Math.log(1-Math.min(.985,f.alpha*.985));
      const common={id:f.id,generation:f.generation,center,density,phase:f.phase};
      for(const sample of motionSamples(f,center,blur))stamps.push({...common,...sample});
    }
    return stamps;
  }
  function createShortExposureSelector(particleCount, options = {}) {
    if (!Number.isSafeInteger(particleCount) || particleCount < 0) {
      throw new RangeError('particleCount must be a nonnegative safe integer');
    }
    const finite = (value, fallback) => {
      const result = Number(value);
      return Number.isFinite(result) ? result : fallback;
    };
    const clamp01 = value => Math.max(0, Math.min(1, value));
    const requestedCycle = finite(options.cycleSeconds, 3.6);
    const cycleSeconds = requestedCycle > 0 ? requestedCycle : 3.6;
    const requestedFade = finite(options.fadeSeconds, .18);
    // A positive compact ramp gives continuous weights even for tiny ratios.
    const fadeSeconds = Math.min(cycleSeconds * .25,
      Math.max(cycleSeconds * 1e-6, requestedFade > 0 ? requestedFade : .18));
    const fadePhase = fadeSeconds / cycleSeconds;
    const seed = finite(options.seed, 0x51c0a7e1) >>> 0;
    const ranks = new Uint32Array(particleCount);
    const phases = new Float64Array(particleCount);
    for (let id = 0; id < particleCount; id++) ranks[id] = id;
  
    // Deterministic Fisher-Yates permutation: no Math.random or mutable state
    // remains in the weight/fill sampling path.
    let randomState = seed;
    const random = () => {
      randomState = (randomState + 0x6d2b79f5) >>> 0;
      let z = randomState;
      z = Math.imul(z ^ (z >>> 15), z | 1);
      z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
      return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
    for (let id = particleCount - 1; id > 0; id--) {
      const swap = Math.floor(random() * (id + 1));
      const rank = ranks[id]; ranks[id] = ranks[swap]; ranks[swap] = rank;
    }
    for (let id = 0; id < particleCount; id++) {
      phases[id] = (ranks[id] + .5) / particleCount;
    }
  
    const phaseFor = id => {
      if (!Number.isInteger(id) || id < 0 || id >= particleCount) {
        throw new RangeError('id must identify an existing particle');
      }
      return phases[id];
    };
    const ratioFor = ratio => clamp01(finite(ratio, .6));
    const turnFor = time => {
      // Modulo before division avoids losing sub-cycle precision at large times.
      let turn = (finite(time, 0) % cycleSeconds) / cycleSeconds;
      if (turn < 0) turn += 1;
      return turn;
    };
    const cdf = value => {
      const u = value / fadePhase + .5;
      return u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
    };
    const samplePhase = (phase, turn, ratio) => {
      let x = phase + turn;
      if (x >= 1) x -= 1;
      // Integral over the interval [0,ratio], plus its neighboring wraps.
      // Keeping a fixed kernel width (rather than shrinking it near endpoints)
      // preserves continuity when the ratio slider approaches 0 or 1.
      return clamp01(cdf(x) - cdf(x - ratio) + cdf(x - 1) - cdf(x - 1 - ratio)
        + 1 - cdf(x + 1 - ratio));
    };
    const weight = (id, time, ratio = .6) => {
      const phase = phaseFor(id), fraction = ratioFor(ratio);
      if (fraction === 0 || fraction === 1) return fraction;
      return samplePhase(phase, turnFor(time), fraction);
    };
    const fill = (time, ratio = .6, output) => {
      const result = output || new Float32Array(particleCount);
      if (result.length < particleCount) throw new RangeError('output is too short');
      const fraction = ratioFor(ratio);
      if (fraction === 0 || fraction === 1) {
        for (let id = 0; id < particleCount; id++) result[id] = fraction;
        return result;
      }
      const turn = turnFor(time);
      for (let id = 0; id < particleCount; id++) {
        result[id] = samplePhase(phases[id], turn, fraction);
      }
      return result;
    };
    return Object.freeze({ particleCount, seed, cycleSeconds, fadeSeconds,
      phaseFor, weight, fill });
  }

  const shortSelector=createShortExposureSelector(particleCount);
  const extraShortSelector=createShortExposureSelector(particleCount,{seed:0x3ea71c42});
  const shortWeights=new Float32Array(maxParticleCount);
  const extraShortWeights=shortWeights.subarray(particleCount);
  let shortAutoOrigin=0,effectiveShortExposure=settings.shortExposure;
  function shortSampleTime(time=elapsed){
    return settings.fps>0?captureOrigin+Math.floor((time-captureOrigin)*settings.fps+1e-8)/settings.fps:time;
  }
  function shortAmplitude(){return Math.min(.25,settings.shortExposure,1-settings.shortExposure);}
  function shortRatioAt(time=elapsed){
    if(!settings.shortAuto)return settings.shortExposure;
    // The existing capture clock controls the variation, including pause.
    // No extra rendering, random seeds, or intermediate frames are introduced.
    return Math.max(0,Math.min(1,settings.shortExposure+shortAmplitude()*Math.sin((shortSampleTime(time)-shortAutoOrigin)*TAU/10)));
  }
  function updateShortReadout(){
    shortActual.hidden=!settings.shortAuto||settings.renderer!=='field';
    if(shortActual.hidden)return;
    const amount=shortAmplitude(),pct=value=>Math.round(value*100)+'%';
    const text='현재 '+pct(effectiveShortExposure)+' · '+Math.round((settings.shortExposure-amount)*100)+'–'+pct(settings.shortExposure+amount)+' · 10초 주기';
    if(shortActual.textContent!==text)shortActual.textContent=text;
  }
  function currentShortFrame(held=false){
    const time=held&&Number.isFinite(presentationTime)?presentationTime:shortSampleTime();
    if(!Number.isFinite(presentationTime)||Math.abs(presentationTime-time)>1e-9){
      presentationTime=time;
      presentationPoses=flakes.map(f=>({pose:projectParticle(f,time-elapsed),generation:f.generation,camera:scrollCameraApplied,wrapX:f.wrapX||0,wrapY:f.wrapY||0}));
    }
    effectiveShortExposure=shortRatioAt(time);updateShortReadout();
    shortSelector.fill(time,effectiveShortExposure,shortWeights);
    extraShortSelector.fill(time,effectiveShortExposure,extraShortWeights);
    const stamps=[];
    for(const f of flakes){
      if(!snowIsActive(f,time))continue;
      let shown=presentationPoses[f.id];
      if(!shown||shown.generation!==f.generation){
        shown=presentationPoses[f.id]={pose:projectParticle(f,time-elapsed),generation:f.generation,
          camera:scrollCameraApplied,wrapX:f.wrapX||0,wrapY:f.wrapY||0};
      }
      const dx=(f.wrapX||0)-(shown.wrapX||0);
      const dy=(f.wrapY||0)-(shown.wrapY||0)-(scrollCameraApplied-(shown.camera??scrollCameraApplied));
      const p=dx===0&&dy===0?shown.pose:{...shown.pose,
        x:shown.pose.x+dx*CAMERA.focal/shown.pose.z,y:shown.pose.y+dy*CAMERA.focal/shown.pose.z};
      stamps.push({id:f.id,generation:shown.generation,p,center:p,weight:1,
        density:-Math.log(1-Math.min(.985,f.alpha*.985)),phase:f.phase});
    }
    return{stamps,weights:shortWeights,time:presentationTime};
  }
  function mixedStamps(frame){
    const stamps=[];
    for(const stamp of fieldStamps()){
      const weight=1-frame.weights[stamp.id];
      if(weight>0)stamps.push({...stamp,weight:stamp.weight*weight});
    }
    for(const stamp of frame.stamps)stamps.push({...stamp,weight:frame.weights[stamp.id]});
    return stamps;
  }
  // Layer captures store ink shapes in their own capture coordinates.
  // Presentation always registers every shape to one shared display pose.
  class LayerTimeline {
    constructor(fields,particleCount){
      this.fields=fields;this.particleCount=particleCount;this.count=fields.count;
      this.times=new Float64Array(this.count);this.previousTimes=new Float64Array(this.count);
      this.counts=new Uint32Array(this.count);
      this.current=new Array(this.count).fill(null);this.previous=new Array(this.count).fill(null);
      this.allocations=Array.from({length:this.count},()=>new Float64Array(particleCount));
      this.weightSums=new Float64Array(particleCount);this.invS=new Float64Array(particleCount);
      this.shortRecords=null;this.shortTime=0;
      this.shortMix=new Float32Array(particleCount);
      this.shortValidInv=new Float64Array(particleCount);
      this.shortReferences=new Array(particleCount).fill(null);
      this.registrationTile=new Float32Array(0);this.registrationOffsets=new Array(particleCount).fill(null);
      this.registeredCache=new Array(particleCount).fill(null);this.reprojectionReady=false;
      this.trail=0;this.ready=false;this.dirty=false;this.cachedRasterDirty=true;
      this.times.fill(NaN);this.previousTimes.fill(NaN);
      this.lastCorrectedParticles=0;this.lastCorrectionKernels=0;this.lastCaptureKernels=0;
    }
    trailFor(options){
      if(!(options.fps>0))return 0;
      const staggerTrail=options.layerTiming==='trail'?Number(options.trail)||0:0;
      const dreamTrail=(looks[options.look]||looks.original).mix*(Number(options.film)||0);
      const softTrail=options.layerTiming==='sync'&&options.temporal==='soft'?.5*(Number(options.transition)||0):0;
      return Math.max(0,Math.min(.55,Math.max(staggerTrail,dreamTrail,softTrail)));
    }
    clear(){
      this.current.fill(null);this.previous.fill(null);
      for(const a of this.allocations)a.fill(0);
      this.weightSums.fill(0);this.invS.fill(0);this.counts.fill(0);
      this.shortRecords=null;this.shortMix.fill(0);this.shortValidInv.fill(0);
      this.shortReferences.fill(null);this.registrationOffsets.fill(null);this.fields.displayLayers=null;
      this.registeredCache.fill(null);this.reprojectionReady=false;
      this.times.fill(NaN);this.previousTimes.fill(NaN);
      this.ready=false;this.dirty=false;this.trail=0;this.cachedRasterDirty=true;
      this.lastCorrectedParticles=0;this.lastCorrectionKernels=0;this.lastCaptureKernels=0;
      this.fields.clear();
    }
    factors(index){
      return this.previous[index]?[1-this.trail,this.trail]:[1,0];
    }
    buildRecords(index,stamps,options,time){
      const fields=this.fields,groups=Array.from({length:this.particleCount},()=>[]);
      for(const stamp of stamps){
        if(!Number.isInteger(stamp.id)||stamp.id<0||stamp.id>=this.particleCount)throw Error('Invalid density particle id');
        groups[stamp.id].push(stamp);
      }
      const records=new Array(this.particleCount).fill(null),z=fields.depths[index];
      const aperture=Math.max(0,Number(options.aperture)||0),spread=Math.max(0,Number(options.spread)||0);
      const focus=Math.max(.0001,Number(options.focus)||6),scale=fields.scale;
      for(let id=0;id<groups.length;id++){
        const samples=groups[id];if(!samples.length)continue;
        // Both shutter branches carry the same true center even when their
        // concatenated samples are not in chronological order.
        const central=samples[Math.floor(samples.length/2)];
        const record={id,time,generation:central.generation,pose:{...(central.center||central.p)},allocation:0,kernels:[]};
        records[id]=record;
        for(const stamp of samples){
          const p=stamp.p;
          const pair=fields.weights(p.z).find(value=>value.index===index);
          const depthWeight=pair?pair.weight:0,weight=stamp.weight*depthWeight;
          record.allocation+=weight;
          if(weight<=0)continue;
          const baseX=p.size*.75*p.width,baseY=p.size*.75;
          const mass=stamp.density*weight*baseX*baseY;
          const raw=38*aperture*Math.abs(1/(p.nearLens?p.z:z)-1/focus),limit=p.size*.32+.65;
          const coc=limit*Math.tanh(raw/limit);
          const sigma2=coc*coc+Math.pow(spread*p.size*.24,2)+Math.pow(.32/scale,2)+(stamp.haloVariance||0);
          const shape=compactMotionAxes(p,sigma2,stamp.motion,stamp.singleLobe);
          const {rx,ry}=shape;
          const c=Math.cos(p.angle),sn=Math.sin(p.angle);
          for(let lobe=0;lobe<(stamp.singleLobe?1:3);lobe++){
            const fraction=stamp.singleLobe?1:lobe===0?.66:.17,theta=stamp.phase+(lobe-1)*2.8;
            const distance=lobe===0?0:p.size*.23;
            const lx=Math.cos(theta)*distance*p.width,ly=Math.sin(theta)*distance;
            const x=p.x+c*lx-sn*ly,y=p.y+sn*lx+c*ly;
            // Keep the complete footprint. It may move into view when
            // reprojected, and clipping must not change its registration.
            record.kernels.push([x,y,rx,ry,shape.angle,mass*fraction,10*sigma2]);
          }
        }
        let mass=0,cx=0,cy=0;
        for(const k of record.kernels){mass+=k[5];cx+=k[0]*k[5];cy+=k[1]*k[5];}
        record.center=mass>1e-12?{x:cx/mass,y:cy/mass}:{x:record.pose.x,y:record.pose.y};
      }
      return records;
    }
    rasterRecord(target,record,multiplier,reference=null){
      if(!record||multiplier===0)return 0;
      if(!reference){
        for(const k of record.kernels)this.fields.kernel(target,k[0],k[1],k[2],k[3],k[4],k[5]*multiplier);
        return record.kernels.length;
      }
      if(record.generation!==reference.generation)return 0;
      const from=record.pose,to=reference.pose;
      const srcX=from.size*from.width,srcY=from.size;
      if(Math.abs(srcX)<1e-8||Math.abs(srcY)<1e-8)return 0;
      const sx=to.size*to.width/srcX,sy=to.size/srcY;
      const cf=Math.cos(from.angle),sf=Math.sin(from.angle);
      const ct=Math.cos(to.angle),st=Math.sin(to.angle);
      const a=ct*sx*cf+st*sy*sf,b=ct*sx*sf-st*sy*cf;
      const c=st*sx*cf-ct*sy*sf,d=st*sx*sf+ct*sy*cf;
      const area=Math.abs(a*d-b*c);
      for(const k of record.kernels){
        const center=record.center||from,dx=k[0]-center.x,dy=k[1]-center.y;
        const x=to.x+a*dx+b*dy,y=to.y+c*dx+d*dy;
        // Preserve the original, circular depth-of-field/AA variance while
        // positioning the same ink body at the shared exposure pose.
        const variance=k[6]||0;
        const bodyX=Math.sqrt(Math.max(0,k[2]*k[2]-variance));
        const bodyY=Math.sqrt(Math.max(0,k[3]*k[3]-variance));
        const cs=Math.cos(k[4]),sn=Math.sin(k[4]);
        const e00=(a*cs+b*sn)*bodyX,e10=(c*cs+d*sn)*bodyX;
        const e01=(-a*sn+b*cs)*bodyY,e11=(-c*sn+d*cs)*bodyY;
        const xx=e00*e00+e01*e01+variance,xy=e00*e10+e01*e11;
        const yy=e10*e10+e11*e11+variance;
        const root=Math.hypot(xx-yy,2*xy),trace=xx+yy;
        const rx=Math.sqrt(Math.max(1e-10,(trace+root)*.5));
        const ry=Math.sqrt(Math.max(1e-10,(trace-root)*.5));
        const angle=.5*Math.atan2(2*xy,xx-yy);
        if(target.kernels)target.kernels.push([x,y,rx,ry,angle,k[5]*multiplier*area]);
        else this.fields.kernel(target,x,y,rx,ry,angle,k[5]*multiplier*area);
      }
      return record.kernels.length;
    }
    rasterContribution(index,id,multiplier,target=this.fields.layers[index],reference=null){
      if(multiplier===0)return 0;
      const [now,old]=this.factors(index);
      let kernels=this.rasterRecord(target,this.current[index]&&this.current[index][id],multiplier*now,reference);
      if(old)kernels+=this.rasterRecord(target,this.previous[index][id],multiplier*old,reference);
      return kernels;
    }
    updateAllocations(index){
      const [now,old]=this.factors(index),allocation=this.allocations[index];
      for(let id=0;id<this.particleCount;id++){
        const current=this.current[index]&&this.current[index][id];
        const previous=this.previous[index]&&this.previous[index][id];
        allocation[id]=now*(current?current.allocation:0)+old*(previous?previous.allocation:0);
      }
    }
    rebuildCached(){
      // Used only when explicitly changing the trail coefficient or seeding.
      // This reuses stored geometry and performs no new captures.
      this.weightSums.fill(0);
      for(let index=0;index<this.count;index++){
        this.updateAllocations(index);
        for(let id=0;id<this.particleCount;id++)this.weightSums[id]+=this.allocations[index][id];
      }
      for(let id=0;id<this.particleCount;id++)this.invS[id]=this.weightSums[id]>1e-12?1/this.weightSums[id]:0;
      // Captures retain geometry. Registered presentation renders that
      // geometry directly, so a raw screen-space raster is only a fallback.
      this.cachedRasterDirty=true;this.dirty=true;
    }
    ensureCachedRaster(){
      if(!this.cachedRasterDirty)return;
      for(let index=0;index<this.count;index++){
        this.fields.layers[index].fill(0);
        for(let id=0;id<this.particleCount;id++)this.rasterContribution(index,id,this.invS[id]);
      }
      this.cachedRasterDirty=false;this.dirty=true;
    }
    setShortFrame(frame,options,time){
      const trail=this.trailFor(options);
      if(this.ready&&trail!==this.trail){this.trail=trail;this.rebuildCached();}
      this.shortTime=time;
      this.selectedLayer=Number.isInteger(options.layer)?options.layer:-1;
      this.shortReferences.fill(null);
      this.shortValidInv.fill(0);
      this.shortMix.set(frame.weights);
      // An empty current frame is meaningful (zero snow), not a request to
      // fall back to old cached layers.
      this.shortRecords=Array.from({length:this.count},(_,index)=>this.buildRecords(index,frame.stamps,options,time));
      this.dirty=true;
    }
    visibleOffset(groups,pose,complete=false){
      const kernels=[];
      for(let index=0;index<this.count;index++){
        if(this.selectedLayer>=0&&index!==this.selectedLayer)continue;
        for(const k of groups[index].kernels)if(k[5]>0)kernels.push(k);
      }
      if(!kernels.length)return{x:0,y:0};
      let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
      for(const k of kernels){
        const c=Math.cos(k[4]),s=Math.sin(k[4]);
        const ex=Math.hypot(k[2]*c,k[3]*s),ey=Math.hypot(k[2]*s,k[3]*c);
        left=Math.min(left,k[0]-ex);right=Math.max(right,k[0]+ex);
        top=Math.min(top,k[1]-ey);bottom=Math.max(bottom,k[1]+ey);
      }
      const spanX=right-left,spanY=bottom-top;
      if(!complete&&(pose.x+spanX<0||pose.y+spanY<0||pose.x-spanX>W||pose.y-spanY>H))return{x:0,y:0,deferred:true};
      // Measure the complete combined mark, before viewport clipping. The
      // local grid follows the particle, so registration itself cannot snap
      // when the particle crosses a screen pixel boundary.
      const scale=Math.max(1,this.fields.scale);
      const x=pose.x+(Math.floor((left-pose.x)*scale)-1)/scale;
      const y=pose.y+(Math.floor((top-pose.y)*scale)-1)/scale;
      const width=Math.ceil((right-x)*scale)+2,height=Math.ceil((bottom-y)*scale)+2;
      const length=width*height;
      if(this.registrationTile.length<length)this.registrationTile=new Float32Array(2**Math.ceil(Math.log2(length)));
      const tile=this.registrationTile;tile.fill(0,0,length);
      const grid={x,y,width,height,scale};
      for(const k of kernels)this.fields.kernel(tile,k[0],k[1],k[2],k[3],k[4],k[5],grid);
      let mass=0,mx=0,my=0;
      for(let py=0;py<height;py++)for(let px=0;px<width;px++){
        const value=tile[py*width+px]*1024;
        const q=value<=0?0:value>=16384?16384:(value+.5)|0;
        const alpha=this.fields.alphaLut[q];
        mass+=alpha;mx+=alpha*(x+(px+.5)/scale-pose.x);my+=alpha*(y+(py+.5)/scale-pose.y);
      }
      // The nonlinear ink response changes the optical center as blur mixes.
      // Compensate that residual without moving the display/physics target.
      return mass>1e-8?{x:-mx/mass,y:-my/mass}:{x:0,y:0};
    }
    paintRegistered(id,p,total,layers){
      const cache=this.registeredCache[id];if(!cache)return;
      const dx=p.x-cache.pose.x,dy=p.y-cache.pose.y;
      const trace=extraScrollTrace(p,flakes[id]);
      let groups=cache.groups,offset=cache.offset;
      if(trace!==0){
        const length=Math.abs(trace),variance=10*length*length/12;
        // Preserve mass and center; convolve only the vertical screen motion.
        // The same geometry is used by full captures and 4fps reprojection.
        if(!cache.scrollBlur||Math.abs(cache.scrollBlur.length-length)>1e-7){
          groups=cache.groups.map(group=>({kernels:group.kernels.map(k=>{
            const c=Math.cos(k[4]),s=Math.sin(k[4]),a=k[2]*k[2],b=k[3]*k[3];
            const xx=c*c*a+s*s*b,xy=c*s*(a-b),yy=s*s*a+c*c*b+variance;
            const d=Math.hypot(xx-yy,2*xy),sum=xx+yy;
            return [k[0],k[1],Math.sqrt(Math.max(1e-10,(sum+d)/2)),Math.sqrt(Math.max(1e-10,(sum-d)/2)),.5*Math.atan2(2*xy,xx-yy),k[5]];
          })}));
          const margin=p.size*12+length*1.1+32;
          const visible=p.x>-margin&&p.x<W+margin&&p.y>-margin&&p.y<H+margin;
          // Re-register optical ink too, not just geometry. Blur changes must
          // not move the perceived center of an asymmetric, saturated mark.
          offset=visible?this.visibleOffset(groups,cache.pose,true):cache.offset;
          cache.scrollBlur={length,groups,offset,measured:visible};
        }else{
          ({groups,offset}=cache.scrollBlur);
          if(!cache.scrollBlur.measured&&p.x> -p.size*12-length&&p.x<W+p.size*12+length&&p.y> -p.size*12-length&&p.y<H+p.size*12+length){
            offset=this.visibleOffset(groups,cache.pose,true);cache.scrollBlur.offset=offset;cache.scrollBlur.measured=true;
          }
        }
      }else if(offset.deferred&&p.x>-p.size*12&&p.x<W+p.size*12&&p.y>-p.size*12&&p.y<H+p.size*12){
        offset=cache.offset=this.visibleOffset(groups,cache.pose,true);
      }
      for(let index=0;index<this.count;index++){
        if(this.selectedLayer>=0&&this.selectedLayer!==index)continue;
        const target=this.selectedLayer<0?total:layers[index];
        for(const k of groups[index].kernels)this.fields.kernel(target,k[0]+dx+offset.x,k[1]+dy+offset.y,k[2],k[3],k[4],k[5]);
      }
    }
    composeShortFrame(){
      const layers=this.fields.composedLayers;
      const total=this.fields.total;total.fill(0);
      if(this.selectedLayer>=0)layers[this.selectedLayer].fill(0);
      this.registeredCache.fill(null);this.reprojectionReady=false;
      this.shortReferences.fill(null);
      this.registrationOffsets.fill(null);
      for(let id=0;id<this.particleCount;id++){
        const presence=snowPresence(flakes[id],this.shortTime);
        if(presence<=0)continue;
        let q=this.shortMix[id];
        let fresh=null;
        for(let index=0;index<this.count;index++){
          const record=this.shortRecords[index][id];
          if(record&&record.allocation>1e-10&&(!fresh||record.allocation>fresh.allocation))fresh=record;
        }
        if(!fresh){this.shortMix[id]=0;continue;}
        let valid=0;
        for(let index=0;index<this.count;index++){
          const [now,prior]=this.factors(index);
          for(const [record,factor] of [[this.current[index]&&this.current[index][id],now],
            [this.previous[index]&&this.previous[index][id],prior]]){
            if(!record||factor<=0||record.allocation*factor<=1e-12)continue;
            if(record.generation!==fresh.generation)continue;
            valid+=record.allocation*factor;
          }
        }
        if(valid<=1e-10)q=1;
        this.shortMix[id]=q;
        // q never chooses a clock or a position. Every exposure, including
        // q=0, uses the same capture pose with no hold/release state machine.
        const reference={pose:fresh.pose,generation:fresh.generation,time:this.shortTime};
        this.shortReferences[id]=reference;
        this.shortValidInv[id]=valid>1e-10?1/valid:0;
        const groups=Array.from({length:this.count},()=>({kernels:[]}));
        for(let index=0;index<this.count;index++){
          const target=groups[index];
          if(q<1)this.rasterContribution(index,id,(1-q)*this.shortValidInv[id],target,reference);
          this.rasterRecord(target,this.shortRecords[index][id],q,reference);
        }
        // Apply visibility to both fresh and historical ink, then register
        // the optical center. A fade must not move a flake's visible center.
        if(presence!==1)for(const group of groups)for(const k of group.kernels)k[5]*=presence;
        const offset=this.visibleOffset(groups,reference.pose);this.registrationOffsets[id]=offset;
        this.registeredCache[id]={groups,offset,pose:reference.pose,generation:reference.generation};
        this.paintRegistered(id,reference.pose,total,layers);
      }
      this.fields.displayLayers=layers;this.reprojectionReady=true;
      this.dirty=false;
      return total;
    }
    reprojectFrame(frame){
      if(!this.reprojectionReady)return false;
      // No new shutter samples, no layer capture, and no optical-center scans
      // for existing visible marks. Only project cached density footprints.
      for(const stamp of frame.stamps){
        const cache=this.registeredCache[stamp.id];
        if(!cache||cache.generation!==stamp.generation)return false;
      }
      const layers=this.fields.composedLayers,total=this.fields.total;
      total.fill(0);if(this.selectedLayer>=0)layers[this.selectedLayer].fill(0);
      for(const stamp of frame.stamps){
        const cache=this.registeredCache[stamp.id],p=stamp.p;
        if(this.shortReferences[stamp.id])this.shortReferences[stamp.id]={pose:p,generation:stamp.generation,time:this.shortTime};
        this.paintRegistered(stamp.id,p,total,layers);
      }
      this.fields.displayLayers=layers;return true;
    }
    initialize(stamps,options,time){
      if(!this.fields.width||!this.fields.height)throw Error('Resize density fields before initializing the timeline');
      this.clear();this.trail=this.trailFor(options);
      for(let index=0;index<this.count;index++){
        this.current[index]=this.buildRecords(index,stamps,options,time);
        this.times[index]=time;
      }
      // counts intentionally excludes this shared seed. Each captureLayer call
      // increments exactly one count; previous is null until the first update.
      this.ready=true;this.rebuildCached();
    }
    captureLayer(index,stamps,options,time){
      if(!Number.isInteger(index)||index<0||index>=this.count)throw Error('Invalid density layer');
      if(!this.ready){this.initialize(stamps,options,time);return;}
      const requestedTrail=this.trailFor(options);
      if(requestedTrail!==this.trail){this.trail=requestedTrail;this.rebuildCached();}
      const nextRecords=this.buildRecords(index,stamps,options,time);
      const priorAllocation=this.allocations[index].slice(),priorInverse=this.invS.slice();
      this.previous[index]=this.current[index];this.previousTimes[index]=this.times[index];
      this.current[index]=nextRecords;this.times[index]=time;this.counts[index]++;
      this.updateAllocations(index);
      const affected=[];
      for(let id=0;id<this.particleCount;id++){
        const change=this.allocations[index][id]-priorAllocation[id];
        if(change===0)continue;
        this.weightSums[id]=Math.max(0,this.weightSums[id]+change);
        this.invS[id]=this.weightSums[id]>1e-12?1/this.weightSums[id]:0;
        if(this.invS[id]!==priorInverse[id])affected.push(id);
      }
      this.lastCaptureKernels=0;this.lastCorrectionKernels=0;
      this.lastCorrectedParticles=affected.length;
      this.cachedRasterDirty=true;this.dirty=true;
    }
    refreshTotal(){
      if(this.shortRecords)return this.composeShortFrame();
      this.fields.displayLayers=null;
      this.ensureCachedRaster();
      if(!this.dirty)return this.fields.total;
      const total=this.fields.total;total.fill(0);
      for(const layer of this.fields.layers)for(let i=0;i<total.length;i++)total[i]+=layer[i];
      this.dirty=false;
      return total;
    }
    contributionsFor(id,selectedLayer=-1){
      if(!Number.isInteger(id)||id<0||id>=this.particleCount)return [];
      const reference=this.shortReferences[id],q=reference?this.shortMix[id]:0;
      const contributions=[],normalization=reference?this.shortValidInv[id]:this.invS[id];
      for(let index=0;index<this.count;index++){
        if(selectedLayer>=0&&selectedLayer!==index)continue;
        const [now,old]=this.factors(index);
        const entries=[[this.current[index]&&this.current[index][id],now,false],
          [this.previous[index]&&this.previous[index][id],old,true]];
        for(const [record,factor,previous] of entries){
          if(!record||factor<=0||(reference&&record.generation!==reference.generation))continue;
          const weight=record.allocation*factor*normalization*(1-q);
          if(weight>1e-10)contributions.push({index,weight,time:record.time,generation:record.generation,previous,pose:reference?reference.pose:record.pose});
        }
        const fresh=reference&&this.shortRecords[index][id];
        const freshWeight=fresh?fresh.allocation*q:0;
        if(freshWeight>1e-10)contributions.push({index,weight:freshWeight,time:this.shortTime,
          generation:fresh.generation,previous:false,shortExposure:true,pose:reference.pose});
      }
      return contributions;
    }
    poseFor(id,selectedLayer=-1){
      const contributions=this.contributionsFor(id,selectedLayer);if(!contributions.length)return null;
      let dominant=contributions[0];
      for(const contribution of contributions)if(contribution.weight>dominant.weight)dominant=contribution;
      const reference=this.shortReferences[id];
      return {...(reference?reference.pose:dominant.pose),generation:dominant.generation,
        time:reference?reference.time:dominant.time,shortExposure:reference?this.shortMix[id]:0,
        index:dominant.index,weight:dominant.weight,
        contributions:contributions.map(({index,weight,time,generation,previous})=>({index,weight,time,generation,previous}))};
    }
  }

  const timeline=new LayerTimeline(fields,maxParticleCount);
  const layerSchedule={ready:false,origin:0,phaseSlots:[0,2,4,1,3],cycles:new Int32Array(5),nextTimes:new Float64Array(5)};
  function isStaggered(){return settings.renderer==='field'&&settings.fps>0&&settings.layerTiming!=='sync';}
  function invalidateLayers(){
    layerSchedule.ready=false;layerSchedule.nextTimes.fill(Infinity);timeline.clear();
  }
  function ensureLayerSchedule(){
    const oldWidth=fields.width;fields.resize(canvas.width);
    if(oldWidth!==fields.width)layerSchedule.ready=false;
    if(layerSchedule.ready)return;
    timeline.initialize(fieldStamps(true),settings,elapsed);
    layerSchedule.origin=elapsed;
    for(let j=0;j<5;j++){
      const phase=layerSchedule.phaseSlots[j]*settings.stagger/5;
      layerSchedule.cycles[j]=phase>1e-9?0:1;
      layerSchedule.nextTimes[j]=elapsed+(layerSchedule.cycles[j]+phase)/settings.fps;
    }
    layerSchedule.ready=true;
  }
  function advanceLayerSchedule(target){
    ensureLayerSchedule();let changed=false;
    for(;;){
      let due=Infinity;
      for(const t of layerSchedule.nextTimes)due=Math.min(due,t);
      if(due>target+1e-8)break;
      advanceTo(due);const stamps=fieldStamps(true);
      for(let j=0;j<5;j++)if(Math.abs(layerSchedule.nextTimes[j]-due)<1e-8){
        timeline.captureLayer(j,stamps,settings,due);
        layerSchedule.cycles[j]++;
        const phase=layerSchedule.phaseSlots[j]*settings.stagger/5;
        layerSchedule.nextTimes[j]=layerSchedule.origin+(layerSchedule.cycles[j]+phase)/settings.fps;
      }
      changed=true;
    }
    advanceTo(target);
    return changed;
  }
  function drawCachedBackground(){
    const rate=settings.fps||60,tick=Math.floor((elapsed-captureOrigin)*rate+1e-8);
    const key=[canvas.width,canvas.height,tick,captureOrigin,settings.background,settings.cloudMorph,settings.finish,settings.shaderStrength,settings.flow,settings.pigment,scrollCloudY,Math.round(cloudScrollTrace()*1000)].join('/');
    if(key!==backgroundCacheKey){
      const savedTime=backgroundTime,savedCtx=ctx;
      filmSampleTime=captureOrigin+tick/rate;
      // A rate edit starts at the last visible wash, not an unseen fractional
      // physics state. Older held film ticks reuse that phase; new ticks move
      // forward from the edit time without extrapolating the new rate backward.
      backgroundTime=backgroundRatePhase+Math.max(0,filmSampleTime-backgroundRateTime)*settings.background;
      ctx=backgroundContext;const scale=canvas.width/W;ctx.setTransform(scale,0,0,scale,0,0);drawBackground();
      if(settings.finish==='watercolor'||settings.finish==='combined')shaderFinish.apply('wash',backgroundFrame,backgroundContext,backgroundTime);
      backgroundTime=savedTime;ctx=savedCtx;backgroundCacheKey=key;backgroundCaptureCount++;
    }
    ctx.drawImage(backgroundFrame,0,0,W,H);
  }
  function drawPhysics(){
    const unit=W/cssWidth;
    ctx.save();ctx.globalAlpha=settings.opacity;ctx.fillStyle='#173a4c';
    for(const f of flakes){
      const presence=snowPresence(f);if(presence<=0)continue;
      ctx.globalAlpha=settings.opacity*presence;
      const p=projectParticle(f);if(p.x< -20||p.x>W+20||p.y< -20||p.y>H+20)continue;
      ctx.beginPath();ctx.arc(p.x,p.y,Math.max(1.25*unit,p.size*.12),0,TAU);ctx.fill();
    }
    ctx.restore();
  }
  function drawSnow(reproject=false){
    if(settings.renderer==='sprites'){drawSpriteSnow();return;}
    if(settings.renderer==='particles'){drawPhysics();return;}
    fields.resize(canvas.width);
    const frame=currentShortFrame(reproject);
    if(reproject&&timeline.reprojectFrame(frame)){
      const image=fields.shade(settings.opacity,settings.layer);
      ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.drawImage(image,0,0,W,H);ctx.restore();return;
    }
    if(isStaggered()){
      ensureLayerSchedule();
    }else{
      if(!timeline.ready)timeline.initialize(fieldStamps(true),settings,elapsed);
      else if(frame.time>timeline.times[0]+1e-9){
        const stamps=fieldStamps(true);
        for(let index=0;index<fields.count;index++)timeline.captureLayer(index,stamps,settings,elapsed);
      }
    }
    timeline.setShortFrame(frame,settings,frame.time);timeline.refreshTotal();
    const image=fields.shade(settings.opacity,settings.layer);
    ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.drawImage(image,0,0,W,H);ctx.restore();
  }
  function drawSpriteSnow(filter=null,targetCtx=ctx,targetScale=canvas.width/W,poseMap=null){
    if(settings.opacity<=0)return;
    const scale=targetScale;
    const order=flakes.filter(f=>snowPresence(f)>0&&(!filter||filter(f,(poseMap&&poseMap.get(f.id))||projectParticle(f)))).sort((a,b)=>b.z-a.z);
    for(const f of order){
      const presence=snowPresence(f);
      const center=(poseMap&&poseMap.get(f.id))||projectParticle(f);
      const edge=Math.max(0,Math.min(1,(center.y+50)/50,(H+50-center.y)/50,(center.x+50)/50,(W+50-center.x)/50));
      if(!edge)continue;
      const sprite=focusedSprite(f,center),size=center.size*sprite.span;
      const blur=blurFor(f,center);
      const scrollTrace=extraScrollTrace(center,f),scrollVariance=scrollTrace*scrollTrace/12;
      if((blur.style==='swept'&&blur.trace>1e-5)||scrollVariance>0){
        const samples=motionSamples(f,center,blur).map(sample=>{
          const motion=scrollVariance>0?{xx:sample.motion?.xx||0,xy:sample.motion?.xy||0,yy:(sample.motion?.yy||0)+scrollVariance}:sample.motion;
          const basis=compactSpriteBasis(sample.p,motion);
          const drawSize=sample.p.size*sprite.span*scale;
          const dx=(sample.p.x-center.x)*scale,dy=(sample.p.y-center.y)*scale;
          return {...sample,basis,drawSize,dx,dy};
        });
        let needed=0;
        for(const sample of samples){
          const b=sample.basis,r=sample.drawSize*.5;
          needed=Math.max(needed,Math.abs(sample.dx)+r*(Math.abs(b.a)+Math.abs(b.b)),
            Math.abs(sample.dy)+r*(Math.abs(b.c)+Math.abs(b.d)));
        }
        const half=Math.min(tileCenter-1,Math.ceil(needed+4));
        const clearHalf=Math.max(half,lastTileHalf);lastTileHalf=half;
        tg.setTransform(1,0,0,1,0,0);tg.clearRect(tileCenter-clearHalf,tileCenter-clearHalf,clearHalf*2,clearHalf*2);
        tg.globalCompositeOperation='lighter';
        for(const sample of samples){
          const b=sample.basis,d=sample.drawSize;
          tg.globalAlpha=sample.weight/Math.max(1,b.areaScale);
          tg.setTransform(b.a,b.c,b.b,b.d,tileCenter+sample.dx,tileCenter+sample.dy);
          tg.drawImage(sprite.image,-d*.5,-d*.5,d,d);
        }
        tg.setTransform(1,0,0,1,0,0);tg.globalAlpha=1;tg.globalCompositeOperation='source-over';
        targetCtx.save();targetCtx.setTransform(1,0,0,1,0,0);targetCtx.globalAlpha=f.alpha*edge*settings.opacity*presence;
        targetCtx.drawImage(tile,tileCenter-half,tileCenter-half,half*2,half*2,
          center.x*scale-half,center.y*scale-half,half*2,half*2);targetCtx.restore();
        continue;
      }
      if(blur.haloMix<=1e-8){
        targetCtx.save();targetCtx.globalAlpha=f.alpha*edge*settings.opacity*presence;targetCtx.translate(center.x,center.y);targetCtx.rotate(center.angle);targetCtx.scale(center.width,1);
        targetCtx.drawImage(sprite.image,-size/2,-size/2,size,size);targetCtx.restore();continue;
      }
      // Two images at one center: the unchanged ink body and a short, broad
      // directional halo. Its affine determinant normalizes the added area,
      // so speed changes breadth/contrast without creating a sampled line.
      const core=compactSpriteBasis(center,null),halo=compactSpriteBasis(center,blur.motion);
      const drawSize=size*scale;
      const extent=Math.max(Math.abs(core.a)+Math.abs(core.b),Math.abs(core.c)+Math.abs(core.d),
        Math.abs(halo.a)+Math.abs(halo.b),Math.abs(halo.c)+Math.abs(halo.d));
      const half=Math.min(tileCenter-1,Math.ceil(drawSize*extent*.5+4));
      const clearHalf=Math.max(half,lastTileHalf);lastTileHalf=half;
      tg.setTransform(1,0,0,1,0,0);tg.clearRect(tileCenter-clearHalf,tileCenter-clearHalf,clearHalf*2,clearHalf*2);
      tg.globalCompositeOperation='lighter';
      tg.globalAlpha=1-blur.haloMix;
      tg.setTransform(core.a,core.c,core.b,core.d,tileCenter,tileCenter);
      tg.drawImage(sprite.image,-drawSize/2,-drawSize/2,drawSize,drawSize);
      tg.globalAlpha=blur.haloMix/Math.max(1,halo.areaScale);
      tg.setTransform(halo.a,halo.c,halo.b,halo.d,tileCenter,tileCenter);
      tg.drawImage(sprite.image,-drawSize/2,-drawSize/2,drawSize,drawSize);
      tg.globalAlpha=1;tg.globalCompositeOperation='source-over';
      targetCtx.save();targetCtx.setTransform(1,0,0,1,0,0);targetCtx.globalAlpha=f.alpha*edge*settings.opacity*presence;
      targetCtx.drawImage(tile,tileCenter-half,tileCenter-half,half*2,half*2,center.x*scale-half,center.y*scale-half,half*2,half*2);targetCtx.restore();
    }
  }
  function isForegroundParticle(f,p){
    if(!foregroundScreen||!p)return false;
    if(p.nearLens)return true;
    if(settings.renderer==='field'){
      const weights=fields.weights(p.z);
      const nearest=weights[weights.length-1];
      return !!nearest&&nearest.weight>=0.52;
    }
    const t=settings.zMin+(settings.zMax-settings.zMin)*0.22;
    return p.z<=t;
  }
  function drawForegroundOverlay(){
    if(!foregroundScreen||!foregroundCanvas)return;
    foregroundScreen.setTransform(1,0,0,1,0,0);
    foregroundScreen.clearRect(0,0,foregroundCanvas.width,foregroundCanvas.height);
    if(!captureReady)return;
    const scale=foregroundCanvas.width/W;
    foregroundScreen.setTransform(scale,0,0,scale,0,0);
    drawSpriteSnow((f,p)=>isForegroundParticle(f,p),foregroundScreen,scale,displayedParticles);
    foregroundScreen.setTransform(1,0,0,1,0,0);
  }
  function chooseTracked(x=W*.47,y=H*.27,nearest=false){
    let best=null,bestScore=Infinity;
    for(const f of flakes){
      if(snowPresence(f,Number.isFinite(presentationTime)?presentationTime:elapsed)<=0)continue;
      if(settings.renderer==='field'&&settings.layer>=0&&fields.weights(f.z).every(v=>v.index!==settings.layer||v.weight<.05))continue;
      const stored=displayedParticles.get(f.id);
      if(nearest&&(!stored||stored.generation!==f.generation))continue;
      const p=stored||projectParticle(f);
      if(nearest){if(p.x<0||p.x>W||p.y<0||p.y>H)continue;}
      else if(p.x<30||p.x>W-30||p.y<15||p.y>H*.75||p.z<3.3||p.z>9.5)continue;
      const score=Math.hypot(p.x-x,p.y-y)+(nearest?0:25*Math.abs(p.z-settings.focus)-8*Math.abs(f.vz));
      if(score<bestScore){best=f;bestScore=score;}
    }
    tracked=best;trackedGeneration=tracked?tracked.generation:-1;lastInspect=-1;
  }
  function drawObservation(force=false){
    if(!observing)return;
    if(!tracked||tracked.generation!==trackedGeneration||!displayedParticles.has(tracked.id))chooseTracked();
    if(!tracked){inspect.textContent='현재 표시되는 눈이 없습니다.';return;}
    let p=displayedParticles.get(tracked.id)||projectParticle(tracked);
    if(p.y>H+10||p.x< -10||p.x>W+10){
      chooseTracked();if(!tracked){inspect.textContent='현재 표시되는 눈이 없습니다.';return;}
      p=displayedParticles.get(tracked.id)||projectParticle(tracked);
    }
    const cssScale=cssWidth/W,blurLength=p.blur===undefined?blurFor(tracked,p).length:p.blur;
    const radius=Math.max(10/cssScale,p.size/2+p.coc*2+4/cssScale);
    ctx.save();ctx.globalAlpha=.85;ctx.strokeStyle='#315e7b';ctx.lineWidth=1.2/cssScale;
    ctx.beginPath();ctx.arc(p.x,p.y,radius,0,TAU);ctx.stroke();ctx.restore();
    if(force||lastInspect<0||displayedAt-lastInspect>.18){
      let layers='';
      if(settings.renderer==='field'){
        if(isStaggered()&&p.time!==undefined)layers=' · 층 '+(p.index+1)+' · '+Math.max(0,Math.round((displayedAt-p.time)*1000))+'ms 전 모습';
        else layers=' · '+fields.weights(p.z).filter(v=>v.weight>.005).map(v=>'층 '+(v.index+1)+' '+Math.round(v.weight*100)+'%').join(' / ');
      }
      inspect.textContent='#'+(tracked.id+1)+' · z '+p.z.toFixed(2)+' · 크기 '+(p.size*cssScale).toFixed(1)+'px'+layers;
      lastInspect=displayedAt;
    }
  }
  function render(force=false,reproject=false){
    const renderStart=window.performance.now();
    clearBackdrop(sceneContext);
    const scale=canvas.width/W;
    const staggered=isStaggered();
    if(captureReady&&!force&&!staggered&&!reproject){
      previousContext.setTransform(1,0,0,1,0,0);previousContext.globalAlpha=1;previousContext.drawImage(filmFrame,0,0);
      previousParticles=latestParticles;previousCaptureTime=latestCaptureTime;transitionReady=true;
    }else transitionReady=false;
    ctx=sceneContext;ctx.setTransform(scale,0,0,scale,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    if(staggered)drawCachedBackground();
    else{
      drawBackground();
      if(settings.finish==='watercolor'||settings.finish==='combined')shaderFinish.apply('wash',scene,sceneContext,backgroundTime);
    }
    ctx=snowContext;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,snow.width,snow.height);
    ctx.setTransform(scale,0,0,scale,0,0);drawSnow(reproject);
    // Field history is blended above as registered shapes. Blending old
    // screen images here would put the same flake at two different positions.
    const look=looks[settings.look],mix=settings.renderer==='field'?0:look.mix*settings.film*(settings.temporal==='soft'?.5:1);
    const canMix=mix>0&&historyValid&&!force&&elapsed>historyTime&&elapsed-historyTime<.16;
    let snowFrame=snow;
    if(canMix){
      blendContext.setTransform(1,0,0,1,0,0);blendContext.clearRect(0,0,blend.width,blend.height);
      blendContext.globalCompositeOperation='lighter';
      blendContext.globalAlpha=1-mix;blendContext.drawImage(snow,0,0);
      blendContext.globalAlpha=mix;blendContext.drawImage(history,0,0);
      blendContext.globalAlpha=1;blendContext.globalCompositeOperation='source-over';snowFrame=blend;
    }
    lastSnowFrame=snowFrame;
    ctx=sceneContext;ctx.setTransform(scale,0,0,scale,0,0);ctx.globalAlpha=1;ctx.drawImage(colorSnow(snowFrame),0,0,W,H);
    ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.5;ctx.drawImage(paper,0,0);
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
    if(mix>0){
      historyContext.setTransform(1,0,0,1,0,0);historyContext.clearRect(0,0,history.width,history.height);historyContext.drawImage(snow,0,0);
      historyValid=true;historyTime=elapsed;
    }else historyValid=false;
    if(settings.renderer!=='particles'&&(settings.finish==='diffusion'||settings.finish==='combined')&&settings.diffusion>0)shaderFinish.apply('lens',scene,sceneContext,backgroundTime);
    presentFrame(look,staggered?filmSampleTime:(settings.renderer==='field'&&Number.isFinite(presentationTime)?presentationTime:elapsed));
    latestParticles=new Map();
    const c=Math.cos(displayPose.angle),s=Math.sin(displayPose.angle);
    for(const f of flakes){
      const visibilityTime=settings.renderer==='field'&&Number.isFinite(presentationTime)?presentationTime:elapsed;
      if(snowPresence(f,visibilityTime)<=0)continue;
      const p=(settings.renderer==='field'?timeline.poseFor(f.id,settings.layer):null)||projectParticle(f);
      const dx=(p.x-W/2)*displayPose.zoom,dy=(p.y-H/2)*displayPose.zoom;
      const shortWeight=settings.renderer==='field'?timeline.shortMix[f.id]:0;
      latestParticles.set(f.id,{...p,x:W/2+displayPose.x+c*dx-s*dy,y:H/2+displayPose.y+s*dx+c*dy,
        generation:p.generation===undefined?f.generation:p.generation,
        shortExposure:shortWeight,blur:blurFor(f,p).length*(1-shortWeight)});
    }
    latestCaptureTime=settings.renderer==='field'&&Number.isFinite(presentationTime)?presentationTime:elapsed;captureReady=true;
    renderedScrollEffects=scrollEffectKey();
    if(reproject)scrollReprojectionCount++;else captureCount++;
    lastRenderMs=window.performance.now()-renderStart;renderTotalMs+=lastRenderMs;renderSamples++;
    if(force)presentOutput(elapsed,true);
  }
  function presentOutput(now,force=false){
    if(!captureReady)return;
    const smoothing=settings.renderer!=='field'&&settings.temporal==='soft'&&settings.fps>0&&transitionReady&&!force;
    const phase=Math.max(0,Math.min(1,(now-latestCaptureTime)*settings.fps));
    screenBlend=smoothing?smooth(1-settings.transition,1,phase):1;
    screen.setTransform(1,0,0,1,0,0);screen.globalCompositeOperation='source-over';screen.globalAlpha=1;
    if(screenBlend<1){screen.drawImage(previousFrame,0,0);screen.globalAlpha=screenBlend;screen.drawImage(filmFrame,0,0);}
    else screen.drawImage(filmFrame,0,0);
    screen.globalAlpha=1;displayedParticles.clear();
    for(const [id,current] of latestParticles){
      const prior=smoothing?previousParticles.get(id):null;let p=current;
      if(prior&&prior.generation===current.generation){
        p={...current};for(const key of ['x','y','z','size','coc','blur'])p[key]=prior[key]+(current[key]-prior[key])*screenBlend;
      }
      displayedParticles.set(id,p);
    }
    displayedAt=smoothing?previousCaptureTime+(latestCaptureTime-previousCaptureTime)*screenBlend:latestCaptureTime;
    ctx=screen;ctx.save();const scale=canvas.width/W;ctx.setTransform(scale,0,0,scale,0,0);drawObservation(force);ctx.restore();ctx=sceneContext;
    drawForegroundOverlay();
    presentationCount++;
  }
  function applyFilmPose(g){
    const p=displayPose;g.translate(W/2+p.x,H/2+p.y);g.rotate(p.angle);g.scale(p.zoom,p.zoom);g.translate(-W/2,-H/2);
  }
  function presentFrame(look,frameTime=isStaggered()?filmSampleTime:elapsed,frameSeed=captureIndex){
    lastFilmTime=frameTime;lastFilmSeed=frameSeed;
    const r=frameRandom(frameSeed),scale=canvas.width/W;
    // Vintage is a separate appearance mix. It does not change shutter,
    // exposure selection, physics, capture cadence, or temporal history.
    const base=settings.look==='vintage'?looks.original:look,vintage=settings.vintageMix;
    const appearance={};
    for(const key of ['grain','weave','flicker','warm','vignette'])
      appearance[key]=base[key]*settings.film*(1-vintage)+looks.vintage[key]*vintage;
    const weave=appearance.weave;
    displayPose={x:weave*(Math.sin(frameTime*3.7)*.55+Math.sin(frameTime*1.13+.4)*.18),
      y:weave*(Math.sin(frameTime*2.9+.6)*.35+Math.sin(frameTime*1.41+.9)*.14),
      angle:weave*.00032*Math.sin(frameTime*2.3),zoom:1+weave*.006};
    output.setTransform(1,0,0,1,0,0);output.globalAlpha=1;output.globalCompositeOperation='source-over';output.fillStyle=settings.backgroundColor;output.fillRect(0,0,canvas.width,canvas.height);
    output.save();output.setTransform(scale,0,0,scale,0,0);applyFilmPose(output);output.drawImage(scene,0,0,W,H);output.restore();
    output.save();output.setTransform(scale,0,0,scale,0,0);
    if(appearance.warm){output.globalCompositeOperation='multiply';output.globalAlpha=appearance.warm;output.fillStyle='#eedcbd';output.fillRect(0,0,W,H);}
    if(appearance.vignette){
      // An image-space ellipse, not a width-sized circle cropped by a portrait.
      // Even the strongest vintage preset reaches only a soft corner shading.
      output.save();output.translate(W*.5,H*.5);output.scale(W*.5,H*.5);
      const gradient=output.createRadialGradient(0,0,.35,0,0,1.5);
      gradient.addColorStop(0,'rgba(17,25,32,0)');
      gradient.addColorStop(.45,'rgba(17,25,32,.04)');
      gradient.addColorStop(.75,'rgba(17,25,32,.16)');
      gradient.addColorStop(1,'rgba(17,25,32,.5)');
      output.globalCompositeOperation='source-over';output.globalAlpha=appearance.vignette;
      output.fillStyle=gradient;output.fillRect(-1,-1,2,2);output.restore();
    }
    if(appearance.flicker){
      // Keep the film's mean tint without pulsing the entire photograph.
      const value=.6*appearance.flicker;
      r(); // Preserve the existing frame seed sequence for unsmoothed grain.
      output.globalCompositeOperation='source-over';output.globalAlpha=value;output.fillStyle='#25282b';output.fillRect(0,0,W,H);
    }
    output.restore();
    if(appearance.grain>0){
      output.save();
      if(settings.smoothGrain){output.setTransform(1,0,0,1,0,0);output.fillStyle=blendedGrain(frameTime);}
      else{output.setTransform(1,0,0,1,Math.floor(r()*128)-128,Math.floor(r()*128)-128);output.fillStyle=grainFrames[Math.floor(r()*grainFrames.length)];}
      output.globalCompositeOperation='hard-light';output.globalAlpha=appearance.grain;
      output.fillRect(0,0,canvas.width+256,canvas.height+256);output.restore();
    }
    output.globalAlpha=1;output.globalCompositeOperation='source-over';
  }
  function redrawBackgroundAppearance(){
    clearBackdrop(sceneContext);
    if(!captureReady||!lastSnowFrame){render(true);return;}
    // Background controls edit the held photograph. Reuse the exact snow
    // image, including any sprite history, instead of resampling layer caches
    // that may already have advanced between displayed frames.
    const heldPhase=Number.isFinite(backgroundShownPhase)?backgroundShownPhase:backgroundTime;
    const savedTime=backgroundTime,savedCtx=ctx,scale=canvas.width/W;
    const frameTime=lastFilmTime,frameSeed=lastFilmSeed;
    try{
      backgroundTime=heldPhase;ctx=backgroundContext;
      ctx.setTransform(scale,0,0,scale,0,0);drawBackground();
      if(settings.finish==='watercolor'||settings.finish==='combined')shaderFinish.apply('wash',backgroundFrame,backgroundContext,heldPhase);
      backgroundCaptureCount++;
      ctx=sceneContext;ctx.setTransform(scale,0,0,scale,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
      ctx.drawImage(backgroundFrame,0,0,W,H);ctx.drawImage(colorSnow(lastSnowFrame),0,0,W,H);
      ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.5;ctx.drawImage(paper,0,0);
      ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
      if(settings.renderer!=='particles'&&(settings.finish==='diffusion'||settings.finish==='combined')&&settings.diffusion>0)shaderFinish.apply('lens',scene,sceneContext,heldPhase);
      presentFrame(looks[settings.look],frameTime,frameSeed);
    }finally{
      backgroundTime=savedTime;ctx=savedCtx;
    }
    presentOutput(elapsed,true);
  }
  function redrawFilmAppearance(){
    if(!captureReady){render(true);return;}
    const before=displayPose;
    presentFrame(looks[settings.look],isStaggered()?filmSampleTime:latestCaptureTime);
    const after=displayPose,bc=Math.cos(before.angle),bs=Math.sin(before.angle);
    const ac=Math.cos(after.angle),as=Math.sin(after.angle);
    // Reproject observation positions from the already captured image.
    // Re-sampling physics here would put the overlay ahead of a held frame.
    for(const [id,p] of latestParticles){
      const dx=p.x-W/2-before.x,dy=p.y-H/2-before.y;
      const x=(bc*dx+bs*dy)/before.zoom,y=(-bs*dx+bc*dy)/before.zoom;
      latestParticles.set(id,{...p,x:W/2+after.x+(ac*x-as*y)*after.zoom,
        y:H/2+after.y+(as*x+ac*y)*after.zoom});
    }
    // A slider edit refreshes the held photograph, not the snow/history.
    // Resume temporal interpolation with the next normal capture.
    transitionReady=false;presentOutput(elapsed,true);
  }
  function advanceTo(target){
    if(target<elapsed-1e-8)return;
    const due=Math.floor(target/PHYSICS_STEP+1e-8);
    while(physicsTick<due){update(PHYSICS_STEP);physicsTick++;physicsTime=physicsTick*PHYSICS_STEP;}
    elapsed=target;backgroundTime=backgroundPhysics+(target-physicsTime)*settings.background;
  }
  function resetCadence(){
    captureOrigin=elapsed;captureIndex=0;historyValid=false;captureReady=false;transitionReady=false;
    presentationTime=NaN;presentationPoses=[];
    backgroundCacheKey='';invalidateLayers();
  }
  function animate(now){
    raf=0;if(destroyed||root.isConnected===false)return;
    if(paused||!visible||document.hidden||suspended||lostSurfaces.size){last=0;return;}
    if(recoveryNeeded){flushRecovery();if(recoveryNeeded){last=0;return;}}
    const cameraChanged=applyScrollCamera(now);
    const cloudChanged=updateScrollEffects(now,cameraChanged);
    let captured=false;
    if(last){
      const target=elapsed+Math.min(.2,Math.max(0,(now-last)/1000));
      if(isStaggered()){
        const due=Math.floor((target-captureOrigin)*settings.fps+1e-7);
        if(due>captureIndex){
          // Sample all display poses at the exact film tick, before physics
          // advances further. Layer capture phases still run independently.
          advanceLayerSchedule(captureOrigin+due/settings.fps);
          captureIndex=due;render();captured=true;
        }
        advanceLayerSchedule(target);
      }else if(settings.fps>0){
        const due=Math.floor((target-captureOrigin)*settings.fps+1e-7);
        if(due>captureIndex){
          advanceTo(captureOrigin+due/settings.fps);captureIndex=due;render();captured=true;
        }
        advanceTo(target);
      }else{advanceTo(target);captureIndex++;render();captured=true;}
    }
    if((cameraChanged||cloudChanged||renderedScrollEffects!==scrollEffectKey())&&!captured){render(false,true);captured=true;}
    if(captured||(!isStaggered()&&settings.temporal==='soft'&&settings.fps>0&&transitionReady))presentOutput(elapsed);
    if(cameraChanged&&Number.isFinite(scrollInputMs))lastScrollResponseMs=window.performance.now()-scrollInputMs;
    last=now;raf=requestAnimationFrame(animate);
  }
  function stopAnimation(){if(raf){window.cancelAnimationFrame(raf);raf=0;}last=0;}
  function suspendRendering(reason){
    if(destroyed)return;
    resetScrollMotion();
    suspended=true;recoveryNeeded=true;probeAssets=true;lastRecoveryReason=reason;
    stopAnimation();
    if(recoveryTimer){window.clearTimeout(recoveryTimer);recoveryTimer=0;}
  }
  function requestRecovery(reason){
    if(destroyed)return;
    recoveryNeeded=true;lastRecoveryReason=reason;
    if(!rendererReady||document.hidden||suspended||!visible||lostSurfaces.size)return;
    if(!recoveryTimer)recoveryTimer=window.setTimeout(()=>{
      recoveryTimer=0;flushRecovery();schedule();
    },0);
  }
  function missingPaint(){
    // A few known opaque/inked texels detect silently cleared source canvases.
    // This runs only on resume, never in the render loop.
    const sources=[paper,...washes.map(w=>w.image),...tintedWashes,atlas[0],crystals[0]];
    for(const source of sources){
      if(!source)continue;
      try{
        const g=source.getContext('2d');
        if(g.isContextLost?.())return true;
        if(!g.getImageData(source.width>>1,source.height>>1,1,1).data[3])return true;
      }catch(_){return true;}
    }
    return false;
  }
  function flushRecovery(){
    if(!rendererReady||!recoveryNeeded||recovering||destroyed||document.hidden||suspended||!visible||lostSurfaces.size)return;
    const bounds=canvas.getBoundingClientRect();
    if(bounds.width<2||bounds.height<2)return;
    recovering=true;
    try{
      if(assetsDirty||(probeAssets&&missingPaint()))restoreAssets();
      probeAssets=false;
      // Regenerate disposable images at the same simulation time. Do NOT reset
      // captureOrigin, physicsTick, layer phases, or the particles on re-entry.
      backgroundCacheKey='';historyValid=false;transitionReady=false;
      last=0;
      const resized=resize();
      if(!resized)render(true);
      recoveryNeeded=false;recoveryCount++;
    }finally{recovering=false;}
  }
  function resumeRendering(reason){
    if(destroyed)return;
    resetScrollMotion();
    stopAnimation();suspended=false;probeAssets=true;
    requestRecovery(reason);
  }
  function schedule(){
    if(!destroyed&&!raf&&!paused&&visible&&!document.hidden&&!suspended&&!lostSurfaces.size){
      if(recoveryNeeded){requestRecovery(lastRecoveryReason||'schedule');return;}
      raf=window.requestAnimationFrame(animate);
    }
  }
  let viewControlsTimer=0,viewWasFullscreen=false,viewWasObserving=false;
  const nativeFullscreen=()=>document.fullscreenElement===stage||document.webkitFullscreenElement===stage;
  function refreshViewButton(){
    viewerFullscreenButton.hidden=!readOnly;
    if(readOnly){
      exitFullscreenButton.hidden=true;
      viewerFullscreenButton.textContent=nativeFullscreen()?'전체화면 나가기':'전체화면';
      viewerFullscreenButton.setAttribute('aria-pressed',String(nativeFullscreen()));
    }
  }
  function showViewControls(){
    if(root.dataset.renderOnly!=='true')return;
    stage.dataset.controls='true';refreshViewButton();
    window.clearTimeout(viewControlsTimer);
    viewControlsTimer=window.setTimeout(()=>{stage.dataset.controls='false';viewMessage.hidden=true;},2400);
  }
  function leaveRenderView(){
    // Exported viewers never reveal editor controls, including after Escape.
    root.dataset.renderOnly=String(readOnly);stage.dataset.controls='false';viewMessage.hidden=true;
    fullscreenButton.setAttribute('aria-pressed','false');
    observing=readOnly?false:viewWasObserving;inspect.hidden=!observing;
    observeButton.setAttribute('aria-pressed',String(observing));
    window.clearTimeout(viewControlsTimer);refreshViewButton();queueLayout();
    presentOutput(elapsed,true);
  }
  async function enterRenderView(){
    if(destroyed)return;
    if(root.dataset.renderOnly!=='true')viewWasObserving=observing;
    observing=false;inspect.hidden=true;
    root.dataset.renderOnly='true';fullscreenButton.setAttribute('aria-pressed','true');
    presentOutput(elapsed,true);showViewControls();queueLayout();
    if(nativeFullscreen())return;
    try{
      // Invoke in this user gesture, before awaiting any other work.
      if(stage.requestFullscreen)await stage.requestFullscreen();
      else if(stage.webkitRequestFullscreen)await stage.webkitRequestFullscreen();
      else throw Error('Fullscreen unavailable');
      viewWasFullscreen=true;
    }catch(error){
      viewWasFullscreen=false;viewMessage.hidden=false;
      viewMessage.textContent='전체화면 권한이 없어 창 전체에 그림을 표시합니다.';
      showViewControls();
    }
    refreshViewButton();queueLayout();
  }
  listen(fullscreenButton,'click',()=>{void enterRenderView();});
  async function exitRenderView(){
    try{
      if(document.fullscreenElement===stage&&document.exitFullscreen)await document.exitFullscreen();
      else if(document.webkitFullscreenElement===stage&&document.webkitExitFullscreen)await document.webkitExitFullscreen();
      else leaveRenderView();
    }catch(_){leaveRenderView();}
    queueLayout();
  }
  listen(exitFullscreenButton,'click',()=>{void exitRenderView();});
  listen(viewerFullscreenButton,'click',()=>{void(nativeFullscreen()?exitRenderView():enterRenderView());});
  const fullscreenChanged=()=>{
    if(nativeFullscreen()){viewWasFullscreen=true;showViewControls();}
    else if(viewWasFullscreen){viewWasFullscreen=false;leaveRenderView();}
    refreshViewButton();queueLayout();
  };
  listen(document,'fullscreenchange',fullscreenChanged);listen(document,'webkitfullscreenchange',fullscreenChanged);
  listen(document,'keydown',event=>{
    if(event.key==='Escape'&&root.dataset.renderOnly==='true')void exitRenderView();
    if(readOnly&&(event.key==='f'||event.key==='F')&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
      event.preventDefault();void(nativeFullscreen()?exitRenderView():enterRenderView());
    }
  });
  listen(stage,'dblclick',()=>{if(readOnly)void(nativeFullscreen()?exitRenderView():enterRenderView());});
  listen(stage,'pointermove',showViewControls);listen(stage,'pointerdown',showViewControls);listen(stage,'focusin',showViewControls);
  function queueLayout(){
    if(destroyed||!rendererReady||layoutRaf)return;
    layoutRaf=window.requestAnimationFrame(()=>{layoutRaf=0;resize();});
  }
  function updateLogicalHeight(next){
    if(next===H)return false;
    const old=H;H=next;
    for(const f of flakes)f.y*=H/old;
    FIELD.height=H+320;rebuildWatercolor();rebuildPaper();
    backgroundCacheKey='';captureReady=false;return true;
  }
  function announce(){pause.textContent=paused?'재생':'일시정지';pause.setAttribute('aria-pressed',String(paused));windLeftButton.disabled=paused;windRightButton.disabled=paused;status.textContent=paused?'일시정지':'재생 중';root.dataset.running=String(!paused);options.onPausedChange?.(paused);}
  function resize(){
    if(resizing||destroyed)return false;
    const box=(settings.aspectMode==='auto'?stage:canvas).getBoundingClientRect();
    // Preserve backing stores when hidden or frozen. Layout is remeasured on resume.
    if(box.width<2||box.height<2||document.hidden||suspended||lostSurfaces.size){recoveryNeeded=true;return false;}
    resizing=true;
    try{
      const ratio=settings.aspectMode==='auto'?box.width/box.height:settings.aspectWidth/settings.aspectHeight;
      const heightChanged=updateLogicalHeight(Math.max(1,Math.round(W/ratio)));
      root.style.setProperty('--snow-aspect',String(W/H));
      const width=box.width,dpr=Math.min(1.5,window.devicePixelRatio||1,Math.sqrt(850000*W/H)/width);
      compact=width<440;cssWidth=width;
      const pw=Math.max(1,Math.round(width*dpr)),ph=Math.max(1,Math.round(width*H/W*dpr));
      if(!heightChanged&&canvas.width===pw&&canvas.height===ph&&captureReady){
        if(recoveryNeeded&&!recovering)requestRecovery('visible-size');return false;
      }
      for(const f of flakes)f.vy=f.fall*settings.speed*(compact?1.25:1);
      for(const c of [canvas,scene,snow,history,blend,filmFrame,previousFrame,backgroundFrame,tintedSnow,cloudExposure,cloudSample]){c.width=pw;c.height=ph;}
      if(foregroundCanvas){foregroundCanvas.width=pw;foregroundCanvas.height=ph;}
      resetCadence();render(true);
      if(recoveryNeeded&&!recovering)requestRecovery('resize');
      return true;
    }finally{resizing=false;}
  }
  listen(pause,'click',()=>{
    paused=!paused;last=0;historyValid=false;resetScrollMotion();
    if(paused){if(raf){cancelAnimationFrame(raf);raf=0;}presentOutput(elapsed,true);}
    else if(!isStaggered())resetCadence();
    announce();schedule();
  });
  listen(windLeftButton,'click',()=>{triggerWind(-1);status.textContent='눈 전체에 왼쪽 바람이 지나갑니다.';});
  listen(windRightButton,'click',()=>{triggerWind(1);status.textContent='눈 전체에 오른쪽 바람이 지나갑니다.';});
  listen(observeButton,'click',()=>{
    observing=!observing;observeButton.setAttribute('aria-pressed',String(observing));inspect.hidden=!observing;
    if(observing){chooseTracked();status.textContent='눈송이 하나의 깊이, 크기, 모션 블러와 초점 흐림을 관찰합니다.';}
    presentOutput(elapsed,true);
  });
  listen(canvas,'pointerdown',event=>{
    if(root.dataset.renderOnly==='true'){showViewControls();return;}
    const bounds=canvas.getBoundingClientRect();observing=true;inspect.hidden=false;observeButton.setAttribute('aria-pressed','true');
    const x=(event.clientX-bounds.left)*W/bounds.width,y=(event.clientY-bounds.top)*H/bounds.height;
    chooseTracked(x,y,true);
    status.textContent='선택한 눈송이의 깊이와 표시 시점을 확인합니다.';presentOutput(elapsed,true);
  });
  listen(pointerWindControl,'change',()=>{settings.pointerWind=pointerWindControl.checked;if(!settings.pointerWind){pointerWind=0;pointerWindTarget=0;resetPointerWindTracking();}status.textContent=settings.pointerWind?'마우스 좌우 이동의 델타로 바람을 더합니다.':'마우스 연동 바람을 끕니다.';notify();});
  function syncScrollMode(){
    const speed=settings.scrollMode==='speed';
    // Keep old speed-mode booleans in JSON and API. Display all four choices
    // directly, without hiding the original behind a second checkbox.
    scrollModeControl.value=speed&&settings.scrollBothDirections?'speedBoth':settings.scrollMode;
    const both=getControl('scrollBothWrap');if(both)both.hidden=true;
    scrollModeControl.disabled=!settings.scrollWind;
    scrollStrengthControl.disabled=!settings.scrollWind;
    scrollBothControl.disabled=true;
    getControl('scrollClouds').disabled=!settings.scrollWind;
    getControl('scrollCloudStrength').disabled=!settings.scrollWind||!settings.scrollClouds;
    getControl('scrollBlur').disabled=!settings.scrollWind;
  }
  listen(scrollWindControl,'change',()=>{
    settings.scrollWind=scrollWindControl.checked;resetScrollMotion();syncScrollMode();
    status.textContent=settings.scrollWind?'페이지 스크롤 연동을 켰습니다.':'페이지 스크롤 연동을 껐습니다.';
    notify();
  });
  listen(scrollModeControl,'change',()=>{
    const mode=scrollModeControl.value;
    settings.scrollMode=mode==='speedBoth'?'speed':mode;
    if(mode==='speed'||mode==='speedBoth')settings.scrollBothDirections=mode==='speedBoth';
    resetScrollMotion();syncScrollMode();
    status.textContent=mode==='camera'?'아래로 스크롤하면 눈은 위로 움직입니다.':
      mode==='cameraSame'?'아래로 스크롤하면 눈도 아래로 움직입니다.':
      mode==='speedBoth'?'위·아래 스크롤 모두 낙하가 빨라집니다.':'원래 방식: 아래로 스크롤하면 가속, 위로 스크롤하면 감속합니다.';
    notify();
  });
  listen(scrollBothControl,'change',()=>{
    settings.scrollBothDirections=scrollBothControl.checked;syncScrollMode();
    status.textContent=settings.scrollBothDirections?'위아래 스크롤 모두 눈을 빠르게 합니다.':'기존처럼 위로 스크롤하면 눈이 느려집니다.';
    notify();
  });
  listen(scrollStrengthControl,'input',()=>{
    settings.scrollStrength=Number(scrollStrengthControl.value);
    getControl('scrollStrength-value').textContent=settings.scrollStrength.toFixed(1)+'×';
    notify();
  });
  listen(getControl('scrollClouds'),'change',()=>guardedUpdate({scrollClouds:getControl('scrollClouds').checked}));
  for(const key of ['scrollCloudStrength','scrollBlur'])listen(getControl(key),'input',()=>guardedUpdate({[key]:Number(getControl(key).value)}));
  function consumePointerWind(event){
    if(!settings.pointerWind||paused)return;
    const bounds=stage.getBoundingClientRect();
    if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom){resetPointerWindTracking();return;}
    const x=event.clientX;
    if(!pointerInside||!Number.isFinite(lastPointerX)){pointerInside=true;lastPointerX=x;lastPointerTime=elapsed;return;}
    let dx=Number.isFinite(event.movementX)&&Math.abs(event.movementX)<=160?event.movementX:x-lastPointerX;
    lastPointerX=x;lastPointerTime=elapsed;
    if(!Number.isFinite(dx)||Math.abs(dx)>Math.max(180,bounds.width*0.35))return;
    pointerWindTarget=Math.max(-140,Math.min(140,pointerWindTarget+dx*1.35));
  }
  listen(stage,'pointerenter',()=>{pointerInside=false;lastPointerX=NaN;});
  listen(stage,'pointerleave',()=>{resetPointerWindTracking();});
  listen(stage,'pointercancel',()=>{resetPointerWindTracking();});
  listen(stage,'pointermove',consumePointerWind);
  listen(window,'blur',()=>{resetPointerWindTracking();pointerWindTarget=0;resetScrollMotion();});
  const snowAmountControl=getControl('snowAmount');
  listen(snowAmountControl,'input',()=>{
    const percent=Math.max(0,Math.min(200,Number(snowAmountControl.value)||0));
    getControl('snowAmount-value').textContent=percent+'%';
    snowAmountControl.setAttribute('aria-valuetext',percent===0?'눈 없음':percent+'%');
    setSnowAmount(percent/100);
    status.textContent='눈 양 '+percent+'% · 기존 눈의 궤적과 촬영 시점은 유지합니다.';
  });
  listen(getControl('motionStyle'),'change',event=>{
    settings.motionStyle=event.target.value;
    invalidateLayers();historyValid=false;render(true);
    status.textContent=settings.motionStyle==='swept'?'이동 경로를 따라 잔상을 남깁니다.':'직전 버전의 같은 위치 번짐과 비교합니다.';
  });
  listen(softSnowControl,'change',()=>{
    settings.softSnowBlur=softSnowControl.checked;softSnowMixControl.disabled=!settings.softSnowBlur;
    invalidateLayers();historyValid=false;render(true);
    status.textContent=settings.softSnowBlur?'부드러운 방향성 블러에서 눈의 형태를 '+Math.round(settings.softSnowMix*100)+'% 비율로 유지합니다.':'부드러운 방향성 블러로 표시합니다.';
  });
  listen(smoothGrainControl,'change',()=>{
    settings.smoothGrain=smoothGrainControl.checked;redrawFilmAppearance();
    status.textContent=settings.smoothGrain?'필름 노이즈를 서서히 교체합니다.':'필름 노이즈를 촬영 프레임마다 교체합니다.';
  });
  for(const key of ['speed','blur','background','zmotion','focus','aperture','opacity','film','coverage','transition','shaderStrength','flow','pigment','diffusion','spread','stagger','trail','shortExposure','vintageMix','softSnowMix','snowSize','cloudMorph']){
    const control=getControl(key),value=getControl(key+'-value');
    listen(control,'input',()=>{
      const percent=['opacity','film','coverage','transition','shaderStrength','flow','pigment','diffusion','spread','stagger','trail','shortExposure','vintageMix','softSnowMix','snowSize','cloudMorph'].includes(key);
      const nextValue=Number(control.value)/(percent?100:1);
      if(key==='background'){
        const held=Number.isFinite(backgroundShownPhase)?backgroundShownPhase:backgroundTime;
        backgroundRateTime=elapsed;backgroundRatePhase=held;backgroundTime=held;
        backgroundPhysics=held-(elapsed-physicsTime)*nextValue;
      }
      settings[key]=nextValue;
      value.textContent=key==='snowSize'?settings.snowSize.toFixed(2)+'×':percent?Math.round(settings[key]*100)+'%':settings[key].toFixed(1)+(key==='focus'?'':'×');
      if(key==='vintageMix'){redrawFilmAppearance();return;}
      if(key==='background'||key==='cloudMorph'){
        backgroundCacheKey='';redrawBackgroundAppearance();return;
      }
      if(key==='snowSize')for(const shown of presentationPoses){
        if(!shown)continue;
        const p=shown.pose;p.size=p.baseSize*settings.snowSize;p.sizeRate=p.baseSizeRate*settings.snowSize;p.coc=defocusFor(p.z,p.size);
      }
      for(const f of flakes){f.vy=f.fall*settings.speed*(compact?1.25:1);if(key==='zmotion')updateDepth(f,0);}
      historyValid=false;
      if(['blur','focus','aperture','coverage','spread','stagger','softSnowMix','snowSize'].includes(key))invalidateLayers();
      if(key==='trail'&&isStaggered()&&timeline.ready){timeline.trail=timeline.trailFor(settings);timeline.rebuildCached();}
      if(['shaderStrength','flow','pigment'].includes(key))backgroundCacheKey='';
      render(true);
    });
  }
  listen(shortAutoControl,'change',()=>{
    settings.shortAuto=shortAutoControl.checked;shortAutoOrigin=shortSampleTime();
    render(true);updateShortReadout();
    status.textContent=settings.shortAuto?'선명하게 잡히는 눈의 비율이 10초 주기로 변화합니다.':'선명하게 잡히는 눈의 비율을 기준값으로 고정했습니다.';
  });
  listen(lookControl,'change',()=>{
    settings.look=lookControl.value;settings.fps=looks[settings.look].fps;fpsControl.value=String(settings.fps);
    const fpsOut=getControl('fps-value');if(fpsOut)fpsOut.textContent=settings.fps?settings.fps+'fps':'무제한';
    if(settings.look==='vintage'&&settings.vintageMix===0){
      settings.vintageMix=.7;getControl('vintageMix').value='70';
      getControl('vintageMix-value').textContent='70%';
    }
    filmControl.disabled=settings.look==='original'||settings.look==='vintage';resetCadence();syncTimingControls();render(true);
    status.textContent='영화 느낌을 변경했습니다. '+(settings.fps?settings.fps+'프레임으로 재생합니다.':'프레임 제한 없이 재생합니다.');
  });
  const fpsOut=getControl('fps-value');
  listen(fpsControl,'input',()=>{
    settings.fps=Math.round(Number(fpsControl.value)||0);if(settings.fps<4&&settings.fps!==0)settings.fps=4;fpsControl.value=String(settings.fps);
    if(fpsOut)fpsOut.textContent=settings.fps?settings.fps+'fps':'무제한';
    resetCadence();syncTimingControls();render(true);
    status.textContent=settings.fps?'초당 '+settings.fps+'장의 화면으로 재생합니다.':'프레임 제한을 해제했습니다.';
  });
  function syncTimingControls(){
    const staggered=isStaggered();
    getControl('shortExposure').disabled=settings.renderer!=='field';
    shortAutoControl.disabled=settings.renderer!=='field';updateShortReadout();
    temporalControl.disabled=staggered;temporalControl.value=staggered?'shutter':settings.temporal;
    layerTimingControl.disabled=settings.renderer!=='field'||settings.fps===0;
    getControl('stagger').disabled=!staggered;
    getControl('trail').disabled=!staggered||settings.layerTiming!=='trail';
    getControl('coverage').disabled=settings.fps===0||(!staggered&&settings.temporal==='legacy');
    getControl('transition').disabled=staggered||settings.fps===0||settings.temporal!=='soft';
  }
  function syncFinishControls(){
    const unavailable=!shaderFinish.available,off=settings.finish==='none';
    const wash=settings.finish==='watercolor'||settings.finish==='combined';
    const lens=settings.finish==='diffusion'||settings.finish==='combined';
    finishControl.disabled=unavailable;
    getControl('shaderStrength').disabled=unavailable||off;
    getControl('flow').disabled=unavailable||!wash;
    getControl('pigment').disabled=unavailable||!wash;
    getControl('diffusion').disabled=unavailable||!lens;
    fallbackNotice.hidden=!unavailable;
    fallbackNotice.textContent=unavailable?(shaderFinish.lost?'물감과 렌즈 효과를 복구하고 있습니다.':'이 환경에서는 물감과 렌즈 효과 없이 표시합니다.'):'';
    root.dataset.shader=unavailable?'fallback':'active';
  }
  listen(finishControl,'change',()=>{
    settings.finish=finishControl.value;syncFinishControls();backgroundCacheKey='';render(true);
    status.textContent=settings.finish==='none'?'원본 표면으로 표시합니다.':'표면과 빛 효과를 변경했습니다.';
  });
  listen(temporalControl,'change',()=>{
    settings.temporal=temporalControl.value;resetCadence();syncTimingControls();render(true);
    status.textContent=settings.temporal==='soft'?'낮은 촬영 프레임 사이를 짧게 혼합합니다.':'각 촬영 프레임을 다음 프레임까지 유지합니다.';
  });
  listen(rendererControl,'change',()=>{
    settings.renderer=rendererControl.value;layerControl.disabled=settings.renderer!=='field';
    getControl('spread').disabled=settings.renderer!=='field';
    resetCadence();syncTimingControls();render(true);
    status.textContent=settings.renderer==='field'?'동일한 입자를 다섯 깊이층의 밀도로 그립니다.':settings.renderer==='sprites'?'동일한 입자를 기존 이미지로 그립니다.':'동일한 입자의 중심 위치를 표시합니다.';
  });
  listen(layerControl,'change',()=>{
    settings.layer=Number(layerControl.value);render(true);
    status.textContent=settings.layer<0?'다섯 깊이층을 합성합니다.':(settings.layer+1)+'번째 깊이층을 표시합니다.';
  });
  listen(layerTimingControl,'change',()=>{
    settings.layerTiming=layerTimingControl.value;resetCadence();syncTimingControls();render(true);
    status.textContent=settings.layerTiming==='sync'?'다섯 층을 함께 갱신합니다.':settings.layerTiming==='stagger'?'각 층을 시간차를 두고 갱신합니다.':'각 층을 시간차를 두고 갱신하며 이전 모습을 짧게 남깁니다.';
  });
  listen(document,'visibilitychange',()=>{
    if(document.hidden)suspendRendering('hidden');else resumeRendering('visible');
  });
  listen(window,'pagehide',()=>suspendRendering('pagehide'));
  listen(window,'pageshow',()=>resumeRendering('pageshow'));
  listen(document,'freeze',()=>suspendRendering('freeze'));
  listen(document,'resume',()=>resumeRendering('resume'));
  listen(window,'focus',()=>{if(!document.hidden)resumeRendering('focus');});
  if(reduced.addEventListener)listen(reduced,'change',()=>{paused=reduced.matches;last=0;if(!isStaggered())resetCadence();if(paused&&raf){cancelAnimationFrame(raf);raf=0;}announce();if(paused)presentOutput(elapsed,true);schedule();});
  function clearBackdrop(g){
    g.save();g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';
    g.fillStyle=settings.backgroundColor;g.fillRect(0,0,g.canvas.width,g.canvas.height);g.restore();
  }
  function hexRGB(value){return [1,3,5].map(i=>parseInt(value.slice(i,i+2),16));}
  function effectiveSnowColor(){
    const snow=hexRGB(settings.snowColor),bg=hexRGB(settings.backgroundColor);
    return '#'+snow.map((s,i)=>Math.max(0,Math.min(255,Math.round(bg[i]+(s-bg[i])*settings.contrast))).toString(16).padStart(2,'0')).join('');
  }
  function colorSnow(source){
    if(settings.snowColor===DEFAULT_SETTINGS.snowColor&&settings.contrast===1)return source;
    tintContext.setTransform(1,0,0,1,0,0);tintContext.globalAlpha=1;
    tintContext.globalCompositeOperation='source-over';tintContext.clearRect(0,0,tintedSnow.width,tintedSnow.height);
    tintContext.drawImage(source,0,0);
    tintContext.globalCompositeOperation='source-in';tintContext.fillStyle=effectiveSnowColor();
    tintContext.fillRect(0,0,tintedSnow.width,tintedSnow.height);tintContext.globalCompositeOperation='source-over';
    return tintedSnow;
  }
  function rebuildWatercolor(){
    const tinted=washes.map((w,index)=>{
      // Keep the default palette zero-copy; allocate tinted buffers on demand.
      if(settings.washColor===DEFAULT_SETTINGS.washColor)return {...w,y:w.y*H/560};
      let c=tintedWashes[index];
      if(!c){
        let g;[c,g]=surface(w.image.width,w.image.height);tintedWashes[index]=c;
        rememberAsset(c,()=>{
          g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';
          g.clearRect(0,0,c.width,c.height);g.drawImage(w.image,0,0);
          if(settings.washColor!==DEFAULT_SETTINGS.washColor){
            g.globalCompositeOperation='source-in';g.fillStyle=settings.washColor;g.fillRect(0,0,c.width,c.height);
          }
          g.globalCompositeOperation='source-over';
        });
      }else assetPainters.get(c)();
      return {...w,image:c,y:w.y*H/560};
    });
    watercolorDrift=createWatercolorDrift(tinted,{width:W,height:H});
  }
  function depthStateAt(time){
    const u=Math.max(0,Math.min(1,(time-depthRange.start)/depthRange.duration));
    const s=u*u*(3-2*u),ds=(u>0&&u<1)?6*u*(1-u)/depthRange.duration:0;
    return {values:depthRange.from.map((v,i)=>v+(depthRange.to[i]-v)*s),
      rates:depthRange.from.map((v,i)=>(depthRange.to[i]-v)*ds)};
  }
  function depthAt(f,time,phase){
    const state=depthStateAt(time),[lo,hi,near]=state.values,[dlo,dhi,dnear]=state.rates;
    const angular=f.depthFrequency*settings.zmotion;
    const sin=Math.sin(phase),cos=Math.cos(phase);
    if(f.lens){
      // A small fixed cohort traverses the near lens volume. No on-screen spawning or alpha pulse.
      const upper=Math.min(hi,Math.max(lo+1,4.2));
      const dupper=upper===hi?dhi:lo+1>=4.2?dlo:0;
      const u=(sin+1)*.5,du=cos*angular*.5;
      return{z:Math.max(.1,near+(upper-near)*u),vz:dnear+(dupper-dnear)*u+(upper-near)*du};
    }
    const u=(f.depthCenter+f.depthAmplitude*sin-CAMERA.near)/(CAMERA.far-CAMERA.near);
    const du=f.depthAmplitude*cos*angular/(CAMERA.far-CAMERA.near);
    return{z:Math.max(.1,lo+(hi-lo)*u),vz:dlo+(dhi-dlo)*u+(hi-lo)*du};
  }
  function changeDepthRange(){
    const from=depthStateAt(elapsed).values;
    depthRange={from,to:[settings.zMin,settings.zMax,settings.nearZ],start:elapsed,duration:paused?.001:1.2};
    if(paused){depthRange.from=depthRange.to.slice();}
    // Layers remain an allocation mechanism; exceptional near flakes use their own optical depth.
    fields.near=settings.zMin+(Math.min(...flakes.map(f=>f.depthCenter-f.depthAmplitude))-CAMERA.near)/(CAMERA.far-CAMERA.near)*(settings.zMax-settings.zMin);
    fields.far=settings.zMin+(Math.max(...flakes.map(f=>f.depthCenter+f.depthAmplitude))-CAMERA.near)/(CAMERA.far-CAMERA.near)*(settings.zMax-settings.zMin);
    fields.depths=Array.from({length:fields.count},(_,i)=>1/(1/fields.far+i/(fields.count-1)*(1/fields.near-1/fields.far)));
    for(const f of flakes)updateDepth(f,0);
    invalidateLayers();
  }
  const percentKeys=new Set(['snowAmount','opacity','film','coverage','transition','shaderStrength','flow','pigment','diffusion','spread','stagger','trail','shortExposure','vintageMix','softSnowMix','snowSize','cloudMorph','contrast','nearFraction']);
  const appearanceKeys=new Set(['theme','snowColor','backgroundColor','washColor','contrast']);
  let lastNotified='',api=null;
  function notify(){
    if(destroyed)return;
    const text=JSON.stringify(settings);if(text===lastNotified)return;lastNotified=text;
    options.onSettingsChange?.({...settings});
    root.dispatchEvent(new CustomEvent('ink-snow-settings',{detail:{...settings}}));
  }
  function message(text,error=false){
    const el=getControl('message');el.hidden=!text;el.textContent=text;el.dataset.error=String(error);
  }
  function applyLayout(){
    root.dataset.theme=settings.theme;
    root.dataset.aspectMode=settings.aspectMode;root.dataset.readOnly=String(readOnly);
    if(readOnly)root.dataset.renderOnly='true';
    root.style.setProperty('--snow-aspect',String(settings.aspectMode==='auto'?W/H:settings.aspectWidth/settings.aspectHeight));
    root.style.setProperty('--snow-background',settings.backgroundColor);
    root.dataset.controlsVisible=String(options.controls!==false);
  }
  function syncUI(){
    for(const [key,value] of Object.entries(settings)){
      const el=getControl(key);if(!el)continue;
      if(el.type==='checkbox')el.checked=value;
      else el.value=String(percentKeys.has(key)?Math.round(value*10000)/100:value);
      const out=getControl(key+'-value');
      if(out)out.textContent=key==='snowSize'?value.toFixed(2)+'×':['scrollCloudStrength','scrollBlur'].includes(key)?value.toFixed(2)+'×':key==='scrollStrength'?value.toFixed(1)+'×':key==='nearFraction'?(value*100).toFixed(1)+'%':key==='fps'?(value?value+'fps':'무제한'):percentKeys.has(key)?Math.round(value*100)+'%':
        ['zMin','zMax','nearZ','focus'].includes(key)?value.toFixed(key==='nearZ'?2:1):value.toFixed(1)+'×';
    }
    getControl('darkMode').checked=settings.theme==='dark';
    const ratio=settings.aspectWidth/settings.aspectHeight;
    const preset=settings.aspectMode==='auto'?'auto':['8:5','16:9','21:9','4:3','1:1','9:16'].find(v=>{const [a,b]=v.split(':').map(Number);return Math.abs(a/b-ratio)<1e-6;})||'custom';
    getControl('aspectPreset').value=preset;getControl('customAspect').hidden=preset!=='custom';
    getControl('zMin').max=String(Math.min(20,settings.zMax-.5));getControl('zMin').min=String(Math.max(.5,settings.nearZ+.05));
    getControl('zMax').min=String(settings.zMin+.5);getControl('nearZ').max=String(Math.min(2,settings.zMin-.05));
    filmControl.disabled=settings.look==='original'||settings.look==='vintage';
    softSnowMixControl.disabled=!settings.softSnowBlur;
    layerControl.disabled=settings.renderer!=='field';getControl('spread').disabled=settings.renderer!=='field';
    syncTimingControls();syncFinishControls();syncScrollMode();applyLayout();
  }
  function setPaused(value){
    if(typeof value!=='boolean')return;
    if(paused===value)return;
    paused=value;last=0;
    resetScrollMotion();
    if(paused&&raf){cancelAnimationFrame(raf);raf=0;}
    announce();presentOutput(elapsed,true);schedule();
  }
  function updateSettings(patch){
    if(destroyed)throw new Error('InkSnow instance has been destroyed.');
    const next=normalizeSettings(patch,settings),changed=Object.keys(next).filter(k=>next[k]!==settings[k]);
    if(!changed.length)return {...settings};
    const oldAmount=settings.snowAmount;
    if(changed.includes('background')){
      const held=Number.isFinite(backgroundShownPhase)?backgroundShownPhase:backgroundTime;
      backgroundRateTime=elapsed;backgroundRatePhase=held;backgroundTime=held;
      backgroundPhysics=held-(elapsed-physicsTime)*next.background;
    }
    Object.assign(settings,next);
    if(changed.includes('scrollWind')||changed.includes('scrollMode')||changed.includes('scrollBothDirections'))resetScrollMotion();
    if(changed.includes('shortAuto'))shortAutoOrigin=shortSampleTime();
    if(changed.includes('scrollClouds')){pendingCloudY=0;scrollCloudVelocity=0;}
    if(changed.includes('scrollBlur'))backgroundCacheKey='';
    if(changed.some(k=>['zMin','zMax','nearZ'].includes(k)))changeDepthRange();
    if(changed.some(k=>['aspectMode','aspectWidth','aspectHeight'].includes(k))){
      applyLayout();captureReady=false;resize();queueLayout();
    }
    if(changed.includes('washColor'))rebuildWatercolor();
    if(changed.includes('snowSize'))for(const shown of presentationPoses){
      if(!shown)continue;const p=shown.pose;p.size=p.baseSize*settings.snowSize;p.sizeRate=p.baseSizeRate*settings.snowSize;p.coc=defocusFor(p.z,p.size);
    }
    for(const f of flakes)f.vy=f.fall*settings.speed*(compact?1.25:1);
    const timing=changed.some(k=>['fps','look','temporal','renderer','layerTiming'].includes(k));
    if(timing)resetCadence();
    else if(changed.some(k=>['motionStyle','softSnowBlur','blur','focus','aperture','coverage','spread','stagger','softSnowMix','snowSize'].includes(k)))invalidateLayers();
    if(changed.includes('trail')&&timeline.ready){timeline.trail=timeline.trailFor(settings);timeline.rebuildCached();}
    backgroundCacheKey='';
    syncUI();
    if(settings.snowAmount!==oldAmount)setSnowAmount(settings.snowAmount);
    else if(changed.every(k=>appearanceKeys.has(k)||k==='cloudMorph'||k==='background'))redrawBackgroundAppearance();
    else if(changed.every(k=>k==='smoothGrain'||k==='vintageMix'))redrawFilmAppearance();
    else if(changed.every(k=>['scrollWind','scrollMode','scrollStrength','scrollBothDirections','scrollClouds','scrollCloudStrength','scrollBlur'].includes(k))){render(false,true);presentOutput(elapsed,true);}
    else render(true);
    notify();return {...settings};
  }
  function guardedUpdate(patch){try{updateSettings(patch);message('');}catch(error){syncUI();message(error.message,true);}}
  function downloadSettings(filename='ink-snow-settings.json'){
    const blob=new Blob([serializeSettings(settings)],{type:'application/json'}),url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download=filename;link.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);message('현재 설정을 JSON 파일로 내보냈습니다.');
  }
  for(const key of ['contrast','zMin','zMax','nearFraction','nearZ'])listen(getControl(key),'input',()=>guardedUpdate({[key]:Number(getControl(key).value)/(percentKeys.has(key)?100:1)}));
  for(const key of ['snowColor','backgroundColor','washColor'])listen(getControl(key),'input',()=>guardedUpdate({[key]:getControl(key).value}));
  listen(getControl('nearLens'),'change',()=>guardedUpdate({nearLens:getControl('nearLens').checked}));
  listen(getControl('darkMode'),'change',()=>{
    guardedUpdate(getControl('darkMode').checked?{theme:'dark',snowColor:'#e5eff8',backgroundColor:'#101923',washColor:'#355c80'}:
      {theme:'light',snowColor:DEFAULT_SETTINGS.snowColor,backgroundColor:DEFAULT_SETTINGS.backgroundColor,washColor:DEFAULT_SETTINGS.washColor});
  });
  listen(getControl('aspectPreset'),'change',()=>{
    if(getControl('aspectPreset').value==='auto'){guardedUpdate({aspectMode:'auto'});return;}
    if(getControl('aspectPreset').value==='custom'){getControl('customAspect').hidden=false;return;}
    const [aspectWidth,aspectHeight]=getControl('aspectPreset').value.split(':').map(Number);guardedUpdate({aspectMode:'fixed',aspectWidth,aspectHeight});
  });
  listen(getControl('applyAspect'),'click',()=>guardedUpdate({aspectMode:'fixed',aspectWidth:Number(getControl('aspectWidth').value),aspectHeight:Number(getControl('aspectHeight').value)}));
  listen(getControl('export'),'click',()=>downloadSettings());
  async function exportHTML(){
    // Capture settings before the asynchronous lazy import; later edits do not leak in.
    const snapshot={...settings};return createViewerHTML(snapshot);
  }
  async function downloadHTML(filename='ink-snow-viewer.html'){
    const button=getControl('exportHTML');button.disabled=true;
    try{
      const html=await exportHTML();if(destroyed)return;
      const url=window.URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
      const link=document.createElement('a');link.href=url;link.download=filename;
      document.body.appendChild(link);link.click();link.remove();
      window.setTimeout(()=>window.URL.revokeObjectURL(url),1000);
      message('현재 설정을 담은 보기 전용 HTML을 내보냈습니다. 파일을 열면 창 전체에서 재생됩니다.');
    }finally{if(!destroyed)button.disabled=false;}
  }
  listen(getControl('exportHTML'),'click',()=>{downloadHTML().catch(error=>{if(!destroyed)message(error.message,true);});});
  listen(getControl('import'),'click',()=>getControl('importFile').click());
  listen(getControl('importFile'),'change',async()=>{
    const file=getControl('importFile').files?.[0];if(!file)return;
    try{if(file.size>65536)throw new Error('설정 파일은 64KB 이하만 허용합니다.');const parsed=parseSettings(await file.text());if(destroyed)return;updateSettings(parsed);message('설정을 불러왔습니다. 현재 재생 위치는 유지합니다.');}
    catch(error){if(!destroyed)message(error.message,true);}
    finally{if(!destroyed)getControl('importFile').value='';}
  });
  listen(getControl('reset'),'click',()=>{guardedUpdate(DEFAULT_SETTINGS);message('초기 설정으로 되돌렸습니다.');});
  listen(root,'input',notify);listen(root,'change',notify);
  if('IntersectionObserver'in window){
    const observer=new IntersectionObserver(entries=>{
      const wasVisible=visible;visible=entries[0].isIntersecting;
      if(!visible){resetScrollMotion();stopAnimation();recoveryNeeded=true;probeAssets=true;}
      else if(!wasVisible){resetScrollMotion();last=0;requestRecovery('intersection');}
      schedule();
    },{threshold:.01});observer.observe(canvas);observers.push(observer);
  }
  const resizeObserver=new window.ResizeObserver(queueLayout);
  resizeObserver.observe(stage);resizeObserver.observe(canvas);observers.push(resizeObserver);
  listen(window,'resize',queueLayout);listen(window,'orientationchange',queueLayout);
  if(window.visualViewport)listen(window.visualViewport,'resize',queueLayout);
  setScrollContainer(options.scrollContainer||window);
  rendererReady=true;syncUI();announce();refreshViewButton();resize();
  if(readOnly){viewMessage.textContent='F 키 또는 전체화면 버튼 · Esc로 나가기';viewMessage.hidden=false;showViewControls();}
  if(settings.snowAmount!==1)setSnowAmount(settings.snowAmount);
  schedule();
  api={
    getSettings:()=>({...settings}),update:updateSettings,
    exportJSON:()=>serializeSettings(settings),downloadSettings,exportHTML,downloadHTML,
    importJSON:value=>updateSettings(parseSettings(value)),
    setPaused,get paused(){return paused;},
    setControls(value){options.controls=readOnly?false:!!value;applyLayout();queueLayout();},
    setScrollContainer,
    wind(direction='right'){triggerWind(direction==='left'||direction<0?-1:1);},
    fullscreen:enterRenderView,
    snapshot:()=>canvas.toDataURL('image/png'),
    get canvas(){return canvas;},
    get foregroundCanvas(){return foregroundCanvas;},
    diagnostics(detail={}){return {aspectMode:settings.aspectMode,readOnly,renderOnly:root.dataset.renderOnly==='true',time:elapsed,width:canvas.width,height:canvas.height,logicalWidth:W,logicalHeight:H,shader:root.dataset.shader,
      active:flakes.filter(f=>snowIsActive(f)).length,lensCohort:flakes.filter(f=>f.lens&&snowIsActive(f)).length,
      nearVisible:flakes.filter(f=>{if(!f.lens||!snowIsActive(f))return false;const p=projectParticle(f);return p.x>=0&&p.x<W&&p.y>=0&&p.y<H;}).length,
      particles:detail.particles===false?undefined:flakes.filter(f=>snowIsActive(f)).map(f=>({id:f.id,generation:f.generation,lens:f.lens,...projectParticle(f)})),
      displayedParticles:detail.displayed?[...displayedParticles].map(([id,p])=>({id,...p})):undefined,
      performance:{lastRenderMs,meanRenderMs:renderSamples?renderTotalMs/renderSamples:0,renderSamples,scrollReprojections:scrollReprojectionCount,lastScrollResponseMs,reservoirWraps:reservoirWrapCount,reservoirChecks},
      captureCount,presentationCount,layerTimes:[...timeline.times],
      scroll:{enabled:settings.scrollWind,mode:settings.scrollMode,selection:settings.scrollMode==='speed'&&settings.scrollBothDirections?'speedBoth':settings.scrollMode,bothDirections:settings.scrollBothDirections,strength:settings.scrollStrength,motion:scrollAir,impulse:scrollImpulse,magnitudeMotion:scrollMagnitudeAir,magnitudeImpulse:scrollMagnitudeImpulse,fallMultiplier:1+scrollSpeedFactor(),cameraPosition:scrollCameraApplied,cameraTarget:scrollCameraGoal,cameraVelocity:scrollCameraVelocity,projectedCameraVelocityAtZ6:scrollCameraVelocity*CAMERA.focal/6,backgroundOffset:scrollCloudY,cloudsEnabled:settings.scrollClouds,cloudStrength:settings.scrollCloudStrength,cloudVelocity:scrollCloudVelocity,blur:settings.scrollBlur,exposureVelocity:scrollExposureVelocity,extraSnowTraceAtZ6:extraScrollTrace({z:6},{fall:1}),cloudTrace:cloudScrollTrace(),cloudBlurPasses,events:scrollCount,ignoredJumps:scrollIgnored},
      recoveryCount,assetRestoreCount,lastRecoveryReason,recoveryPending:recoveryNeeded,suspended,
      cloudInstances:detail.clouds?watercolorDrift.instances(Number.isFinite(backgroundShownPhase)?backgroundShownPhase:backgroundTime,settings.cloudMorph,scrollCloudY):undefined,
      backgroundPhase:backgroundShownPhase,backgroundCaptureCount,lostSurfaces:lostSurfaces.size};},
    destroy(){
      if(destroyed)return;destroyed=true;
      if(raf)cancelAnimationFrame(raf);raf=0;window.clearTimeout(viewControlsTimer);
      if(recoveryTimer)window.clearTimeout(recoveryTimer);recoveryTimer=0;
      if(layoutRaf)window.cancelAnimationFrame(layoutRaf);layoutRaf=0;
      assetPainters.clear();lostSurfaces.clear();
      if(scrollContainer)scrollContainer.removeEventListener('scroll',onPageScroll);
      for(const [target,type,handler,opts] of listeners)target.removeEventListener(type,handler,opts);
      for(const observer of observers)observer.disconnect();
      shaderFinish.dispose();
      if(document.fullscreenElement===stage)document.exitFullscreen?.().catch(()=>{});
      if(foregroundRoot)foregroundRoot.innerHTML='';
      delete root.dataset.ready;delete root.dataset.renderOnly;root.innerHTML='';
    }
  };
  if(options.debug){
    root.inkSnow=api;
    api.testScroll=(pixels)=>{
      if(!Number.isFinite(pixels))throw Error('pixels must be finite');
      previousScrollTop=scrollPosition(scrollContainer)-pixels;lastScrollEventMs=window.performance.now()-16;
      onPageScroll();
    };
    api.step=(seconds)=>{if(!paused)throw Error('Pause before manual stepping.');if(!Number.isFinite(seconds)||seconds<0||seconds>2)throw Error('step must be between 0 and 2 seconds');
      const target=elapsed+seconds;
      if(isStaggered())advanceLayerSchedule(target);else advanceTo(target);
      captureIndex=Math.floor((target-captureOrigin)*(settings.fps||60)+1e-8);render(true);
    };
  }
  notify();options.onReady?.(api);return api;

}