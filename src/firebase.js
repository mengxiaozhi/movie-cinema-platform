import {initializeApp} from 'firebase/app';
import {getAuth,connectAuthEmulator} from 'firebase/auth';
import {getFirestore,doc,getDoc,setDoc,onSnapshot} from 'firebase/firestore';
import {DEFAULT_HOME,validateHome,upgradeHome} from './homepage.js';
import {createLocalService} from './local-service.js';
import {validateVideoSpec} from './video-spec.js';
const env=import.meta.env;
const config={apiKey:env.VITE_FIREBASE_API_KEY,authDomain:env.VITE_FIREBASE_AUTH_DOMAIN,projectId:env.VITE_FIREBASE_PROJECT_ID,appId:env.VITE_FIREBASE_APP_ID};
export const configured=Object.values(config).every(Boolean);
const app=configured?initializeApp(config):null;
export const auth=app?getAuth(app):null;
const db=app?getFirestore(app):null;
export function watchHome(next,error){if(!db){next(DEFAULT_HOME);return()=>{};}return onSnapshot(doc(db,'siteContent','home'),s=>{try{next(s.exists()?upgradeHome(s.data()):DEFAULT_HOME);}catch(e){error(e);}},error);}
export async function loadHomeDraft(){const s=await getDoc(doc(db,'siteDrafts','home'));return s.exists()?upgradeHome(s.data()):null;}
export async function saveHomeDraft(content){await setDoc(doc(db,'siteDrafts','home'),validateHome(content));}
export async function publishHome(content){await setDoc(doc(db,'siteContent','home'),validateHome(content));}
if(app&&env.DEV&&env.VITE_USE_EMULATORS==='true') connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
const service=createLocalService({storage:window.localStorage,getUser:()=>auth?.currentUser});
export async function api(path,options={}) {
  if(options.method && options.method!=='GET' && navigator.locks) return navigator.locks.request('movie-local-data',()=>service.request(path,options));
  return service.request(path,options);
}
const materialPreviews=new Map();
export async function selectMaterial(order,file,metadata){
  const spec=validateVideoSpec({...metadata,size:file.size,type:file.type});
  const path=`local-material/${crypto.randomUUID()}`;
  await api(`/orders/${order.id}/material`,{method:'POST',body:{path,filename:file.name,size:file.size,type:file.type,spec}});
  const old=materialPreviews.get(order.id);if(old) URL.revokeObjectURL(old.url);
  materialPreviews.set(order.id,{path,url:URL.createObjectURL(file)});
}
export function materialPreview(order){
  const preview=materialPreviews.get(order.id);
  if(!preview||preview.path!==order.material.path)throw new Error('請重新選取這支影片以開啟預覽。');
  return preview.url;
}
auth&&auth.onAuthStateChanged(()=>{for(const v of materialPreviews.values())URL.revokeObjectURL(v.url);materialPreviews.clear();});
