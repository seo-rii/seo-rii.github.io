/** Versioned, data-only settings. No renderer or browser objects are serialized. */
export const DEFAULT_SETTINGS = Object.freeze({
  snowAmount:1,motionStyle:'swept',speed:1,blur:1,background:1,zmotion:1,focus:6,aperture:1,
  opacity:1,film:.7,fps:24,look:'original',temporal:'shutter',coverage:1,transition:.8,
  finish:'combined',shaderStrength:.7,flow:.7,pigment:.65,diffusion:.55,renderer:'field',
  layer:-1,spread:.3,layerTiming:'trail',stagger:1,trail:.25,shortExposure:.60,shortAuto:false,
  vintageMix:0,softSnowBlur:true,softSnowMix:.35,snowSize:1,cloudMorph:.45,smoothGrain:false,
  theme:'light',aspectMode:'auto',aspectWidth:8,aspectHeight:5,snowColor:'#090e13',backgroundColor:'#ffffff',
  washColor:'#4f87ad',contrast:1,zMin:2.6,zMax:10.8,nearLens:true,nearFraction:.008,nearZ:.45,
  pointerWind:false,scrollWind:true,scrollMode:'camera',scrollBothDirections:true,scrollStrength:1,
  scrollClouds:true,scrollCloudStrength:.35,scrollBlur:0
});
export const SETTING_RANGES = Object.freeze({
  snowAmount:[0,2], speed:[.5,2.5],blur:[0,2.5],background:[0,2.5],zmotion:[0,2.5],focus:[.2,40],aperture:[0,2.5],
  opacity:[0,1],film:[0,1],fps:[0,30],scrollStrength:[0,5],scrollCloudStrength:[0,2.5],scrollBlur:[0,3],coverage:[.4,1.5],transition:[.15,1],shaderStrength:[0,1],flow:[0,1],pigment:[0,1],
  diffusion:[0,1],spread:[0,1],stagger:[0,1],trail:[0,.55],shortExposure:[0,1],vintageMix:[0,1],softSnowMix:[0,1],
  snowSize:[.5,2],cloudMorph:[0,1],aspectWidth:[1,32],aspectHeight:[1,32],contrast:[0,2],
  zMin:[.5,20],zMax:[1,40],nearFraction:[0,.03],nearZ:[.15,2]
});
const CHOICES={motionStyle:['swept','compact'],look:['original','cinema','vintage','anime','dream'],
  temporal:['soft','shutter','legacy'],finish:['none','watercolor','diffusion','combined'],renderer:['field','sprites','particles'],
  aspectMode:['auto','fixed'],layerTiming:['sync','stagger','trail'],scrollMode:['camera','cameraSame','speed'],theme:['light','dark'],layer:[-1,0,1,2,3,4]};
const FLAGS=['shortAuto','softSnowBlur','smoothGrain','nearLens','pointerWind','scrollWind','scrollBothDirections','scrollClouds'];
const COLORS=['snowColor','backgroundColor','washColor'];
/** Validate only known keys; malformed values throw rather than silently executing/coercing input. */
export function normalizeSettings(input={},base=DEFAULT_SETTINGS){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('설정은 JSON 객체여야 합니다.');
  const result={};
  for(const key of Object.keys(DEFAULT_SETTINGS))result[key]=base[key]??DEFAULT_SETTINGS[key];
  for(const key of Object.keys(DEFAULT_SETTINGS)){
    if(!Object.prototype.hasOwnProperty.call(input,key))continue;
    let value=input[key];
    if(key in SETTING_RANGES){
      if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError(`${key}: 유한한 숫자가 필요합니다.`);
      const [lo,hi]=SETTING_RANGES[key]; value=Math.max(lo,Math.min(hi,value));
      if(key==='fps')value=Math.round(value);
    }else if(key in CHOICES){if(!CHOICES[key].includes(value))throw new RangeError(`${key}: 지원하지 않는 값입니다.`);}
    else if(FLAGS.includes(key)){if(typeof value!=='boolean')throw new TypeError(`${key}: true 또는 false가 필요합니다.`);}
    else if(COLORS.includes(key)){if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))throw new TypeError(`${key}: #RRGGBB 색상이 필요합니다.`);value=value.toLowerCase();}
    result[key]=value;
  }
  // Explicit width/height from older callers select the fixed-ratio mode.
  if(!Object.prototype.hasOwnProperty.call(input,'aspectMode')&&
     ['aspectWidth','aspectHeight'].some(k=>Object.prototype.hasOwnProperty.call(input,k)))result.aspectMode='fixed';
  if(result.zMax-result.zMin<.5)throw new RangeError('z 최대는 z 최소보다 0.5 이상 커야 합니다.');
  const aspect=result.aspectWidth/result.aspectHeight;
  if(aspect<1/3||aspect>3)throw new RangeError('화면 비율은 1:3부터 3:1까지 지원합니다.');
  if(result.nearZ>=result.zMin)throw new RangeError('근접 눈 z는 일반 눈 z 최소보다 작아야 합니다.');
  return result;
}
export function serializeSettings(settings){return JSON.stringify({format:'ink-snow-settings',version:1,settings:normalizeSettings(settings)},null,2);}
export function parseSettings(value){
  if(typeof value==='string'&&value.length>65536)throw new RangeError('설정 파일은 64KB 이하만 가져올 수 있습니다.');
  const data=typeof value==='string'?JSON.parse(value):value;
  if(!data||data.format!=='ink-snow-settings'||data.version!==1)throw new TypeError('지원하지 않는 설정 파일 형식 또는 버전입니다.');
  if(!data.settings||typeof data.settings!=='object'||Array.isArray(data.settings))throw new TypeError('설정 객체가 필요합니다.');
  // Version 1 presets made before auto-fit retain their original framing.
  return normalizeSettings({aspectMode:'fixed',...data.settings});
}
