import {HOME_VIDEOS} from './data/home-videos.js';
export const MAX_HOME_SLIDES=16;
export const HOME_CATEGORIES=['電影預告','商業客戶'];
const ORIGINAL_SLIDES=[
  {id:'lake',type:'image',url:'/media/theater-premium.png',title:'山湖光影',seconds:9,enabled:true,builtin:true},
  {id:'film',type:'video',url:'/media/hero-h264.mp4',title:'電影短片',seconds:25,enabled:true,credit:'© 2008 Blender Foundation · CC BY 3.0'}
];
export const DEFAULT_HOME={schemaVersion:2,slides:[...HOME_VIDEOS,...ORIGINAL_SLIDES]};
export function parseYouTubeURL(value){
  try{
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
    let id;
    if(url.hostname==='youtu.be')id=url.pathname.slice(1);
    else if(['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(url.hostname)){
      if(url.pathname==='/watch')id=url.searchParams.get('v');
      else id=url.pathname.match(/^\/(?:embed|shorts)\/([\w-]{11})\/?$/)?.[1];
    }
    if(!/^[\w-]{11}$/.test(id||''))return null;
    const stamp=url.searchParams.get('start')??url.searchParams.get('t')??'0';
    const match=stamp.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    const start=/^\d+$/.test(stamp)?Number(stamp):match&&stamp?Number(match[1]||0)*3600+Number(match[2]||0)*60+Number(match[3]||0):NaN;
    if(!Number.isSafeInteger(start)||start<0||start>86400)return null;
    return {id,start,url:`https://www.youtube.com/watch?v=${id}${start?`&t=${start}s`:''}`};
  }catch{return null;}
}
export function mediaURL(value){
  if(typeof value!=='string'||value.length>2000)return false;
  if(/^\/media\/[a-zA-Z0-9._/-]+$/.test(value)&&!value.includes('..'))return true;
  try{return new URL(value).protocol==='https:';}catch{return false;}
}
export function validateHome(data){
  if(!Array.isArray(data?.slides)||data.slides.length<1||data.slides.length>MAX_HOME_SLIDES)throw new Error(`請設定 1–${MAX_HOME_SLIDES} 則輪播內容。`);
  if(data.schemaVersion!==undefined&&data.schemaVersion!==2)throw new Error('首頁內容版本不支援。');
  if(!data.slides.some(s=>s.enabled))throw new Error('至少啟用一則輪播內容。');
  const ids=new Set();
  const slides=data.slides.map(s=>{
    if(!s.id||ids.has(s.id))throw new Error('輪播識別碼重複。');ids.add(s.id);
    const youtube=s.type==='youtube'?parseYouTubeURL(s.url):null;
    if(!['image','video','youtube'].includes(s.type)||!mediaURL(s.url)||(s.type==='youtube'&&!youtube))throw new Error('請輸入有效的 HTTPS 圖片、影片直連或 YouTube 網址。');
    if(s.category!==undefined&&s.category!==''&&!HOME_CATEGORIES.includes(s.category))throw new Error('素材分類須為電影預告或商業客戶。');
    if(typeof s.title!=='string'||!s.title.trim()||s.title.length>100)throw new Error('請填寫 100 字內的素材名稱。');
    if(!Number.isInteger(s.seconds)||s.seconds<3||s.seconds>120)throw new Error('播放秒數須為 3–120 秒。');
    return {id:s.id,type:s.type,url:youtube?.url||s.url,title:s.title.trim(),seconds:s.seconds,enabled:!!s.enabled,...(s.category?{category:s.category}:{}),...(s.builtin&&s.url==='/media/theater-premium.png'?{builtin:true}:{}),...(s.credit?{credit:String(s.credit).slice(0,200)}:{})};
  });return {...(data.schemaVersion===2?{schemaVersion:2}:{}),slides};
}
// Upgrade only the known original homepage; keep custom content and v2 edits intact.
export function upgradeHome(data){
  const clean=validateHome(data);
  const original=clean.schemaVersion===undefined&&clean.slides.length===ORIGINAL_SLIDES.length&&clean.slides.every((s,i)=>s.id===ORIGINAL_SLIDES[i].id&&s.url===ORIGINAL_SLIDES[i].url);
  return original?validateHome({schemaVersion:2,slides:[...HOME_VIDEOS,...clean.slides]}):clean;
}
