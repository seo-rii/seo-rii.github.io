export interface InkSnowSettings {
  snowAmount:number; motionStyle:'swept'|'compact'; speed:number; blur:number; background:number; zmotion:number;
  focus:number; aperture:number; opacity:number; film:number; fps:number;
  look:'original'|'cinema'|'vintage'|'anime'|'dream'; temporal:'shutter'|'soft'|'legacy'; coverage:number; transition:number;
  finish:'none'|'watercolor'|'diffusion'|'combined'; shaderStrength:number; flow:number; pigment:number; diffusion:number;
  renderer:'field'|'sprites'|'particles'; layer:-1|0|1|2|3|4; spread:number;
  layerTiming:'sync'|'stagger'|'trail'; stagger:number; trail:number; shortExposure:number; shortAuto:boolean;
  vintageMix:number; softSnowBlur:boolean; softSnowMix:number; snowSize:number; cloudMorph:number; smoothGrain:boolean;
  theme:'light'|'dark'; aspectMode:'auto'|'fixed'; aspectWidth:number; aspectHeight:number; snowColor:string; backgroundColor:string;
  washColor:string; contrast:number; zMin:number; zMax:number; nearLens:boolean; nearFraction:number; nearZ:number;
  pointerWind:boolean; scrollWind:boolean; scrollMode:'camera'|'cameraSame'|'speed'; scrollBothDirections:boolean; scrollStrength:number; scrollClouds:boolean; scrollCloudStrength:number; scrollBlur:number;
}
export interface InkSnowAPI {
  getSettings():InkSnowSettings;
  update(patch:Partial<InkSnowSettings>):InkSnowSettings;
  exportJSON():string;
  exportHTML():Promise<string>;
  downloadHTML(filename?:string):Promise<void>;
  importJSON(json:string|object):InkSnowSettings;
  downloadSettings(filename?:string):void;
  setPaused(value:boolean):void;
  readonly paused:boolean;
  setControls(value:boolean):void;
  setScrollContainer(target?:Window|HTMLElement|null):void;
  wind(direction?:'left'|'right'|number):void;
  fullscreen():Promise<void>;
  snapshot():string;
  readonly canvas:HTMLCanvasElement;
  readonly foregroundCanvas:HTMLCanvasElement | null;
  diagnostics(detail?:{particles?:boolean;displayed?:boolean}):Record<string,unknown>;
  destroy():void;
}
export interface InkSnowOptions {
  settings?:Partial<InkSnowSettings>;
  paused?:boolean;
  controls?:boolean;
  readOnly?:boolean;
  foregroundRoot?:HTMLElement;
  scrollContainer?:Window|HTMLElement|null;
  /** Capture follows fps; buffered adds a native-scroll plane only with aspectMode:'auto'. */
  scrollFrameRate?:'display'|'capture'|'buffered';
  debug?:boolean;
  onSettingsChange?:(settings:InkSnowSettings)=>void;
  onPausedChange?:(paused:boolean)=>void;
  /** Called after presentation. scrollTop anchors that bitmap; padding uses CSS pixels. */
  onPresent?:(frame:{scrollTop:number;padding:number;paused:boolean})=>void;
  onReady?:(api:InkSnowAPI)=>void;
}
export function mountInkSnow(root:HTMLElement,options?:InkSnowOptions):InkSnowAPI;
