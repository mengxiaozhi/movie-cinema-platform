import {AVAILABLE_TAGS} from './data/tags.js';
// Local business workflows only. Identity is supplied by Firebase Google Auth.
// This module is not an authorization boundary for a future shared backend.
import {INITIAL_TAIWAN_CINEMAS} from './data/cinemas.js';
import {migrateCatalog} from './catalog-migration.js';
import {CATALOG_VERSION} from './data/price-list.js';
import {weeklyTotal} from './weekly-pricing.js';
import {MAX_CART_ITEMS,itemKey} from './cart.js';
import {validateVideoSpec} from './video-spec.js';
import {DEFAULT_SETTINGS,ROLES,bookingDates,calculatePrice,reserve,release,editHall,requireRole,BusinessError} from '../functions/domain.js';
export const LOCAL_KEY='movie-local-workspace-v1';
const ADMIN_EMAIL='shiaufeng68@gmail.com';
const stamp=ms=>({_seconds:Math.floor(ms/1000)});
const clone=value=>JSON.parse(JSON.stringify(value));
const fail=(message,status=400)=>{throw new BusinessError(message,status);};
const text=(v,max=250)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max;
const staff=role=>['super_admin','reviewer'].includes(role);
function initial(){return {version:1,catalogVersion:CATALOG_VERSION,settings:{...DEFAULT_SETTINGS},cinemas:INITIAL_TAIWAN_CINEMAS.map(c=>({...c,active:true,halls:c.halls.map(h=>({...h,active:true,capacity:null,bookedSlots:{}}))})),orders:[],users:[],requests:{},audit:[]};}
export function createLocalService({storage,getUser,now=()=>Date.now(),uuid=()=>crypto.randomUUID()}){
  const load=()=>{try{const raw=storage.getItem(LOCAL_KEY);if(!raw)return initial();const data=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.orders)||!Array.isArray(data.cinemas)||!Array.isArray(data.users))fail('本機資料格式異常，請聯絡管理員。');return data;}catch(e){if(e instanceof BusinessError)throw e;fail('無法讀取瀏覽器資料，請允許本站儲存資料後重試。');}};
  const save=data=>{try{storage.setItem(LOCAL_KEY,JSON.stringify(data));}catch{fail('瀏覽器儲存空間不足或已停用，資料未儲存。');}};
  return {async request(path,{method='GET',body={}}={}){
    const db=load();if(migrateCatalog(db))save(db);const url=new URL(path,'https://movie.local'),route=url.pathname;
    db.audienceTags??=AVAILABLE_TAGS.map(t=>({...t,active:true,source:'既有網站分類，尚待實際資料驗證',kind:'推估',updatedAt:''}));
    if(route==='/tags'&&method==='GET')return {tags:clone(db.audienceTags)};
    if(route==='/cinemas'&&method==='GET')return {cinemas:clone(db.cinemas.filter(c=>c.active).map(c=>({...c,tagIds:(c.tagIds||[]).filter(id=>db.audienceTags.some(t=>t.id===id&&t.active)),halls:c.halls.filter(h=>h.active).map(({bookedSlots,...h})=>h)})))};
    if(route==='/config'&&method==='GET')return {settings:clone(db.settings),lineEnabled:false};
    if(route==='/availability'&&method==='GET'){
      const {startDate,endDate}=Object.fromEntries(url.searchParams),day=new Date(now()).toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'});
      const dates=bookingDates(startDate,endDate,db.settings.maxBookingDays,day);
      weeklyTotal(1,1,dates.length);
      return {halls:db.cinemas.filter(c=>c.active).flatMap(c=>c.halls.filter(h=>h.active).map(h=>{const capacity=h.capacity??db.settings.defaultCapacity,bookedMax=Math.max(0,...dates.map(d=>h.bookedSlots?.[d]||0));return {cinemaId:c.id,hallId:h.id,capacity,bookedMax,remaining:Math.max(0,capacity-bookedMax)};}))};
    }
    const user=getUser();if(!user)fail('請先使用 Google 帳號登入。',401);
    const isOwner=user.emailVerified===true&&user.providerData?.some(p=>p.providerId==='google.com')&&user.email?.toLowerCase()===ADMIN_EMAIL;
    let member=db.users.find(u=>u.id===user.uid);
    if(!member){member={id:user.uid,uid:user.uid,name:user.displayName||'會員',email:user.email||'',role:isOwner?'super_admin':'buyer',disabled:false};db.users.push(member);save(db);}
    if(isOwner){member.role='super_admin';member.disabled=false;}
    if(member.disabled)fail('此帳號已停用。',403);
    if(route==='/me')return clone(member);
    const permit=allowed=>requireRole(member.role,allowed);
    const audit=(action,entityId)=>{db.audit.push({actor:user.uid,action,entityId,createdAt:stamp(now())});db.audit=db.audit.slice(-500);};
    const done=(action,entityId,result={ok:true})=>{audit(action,entityId);save(db);return clone(result);};
    const findCinema=key=>{const c=db.cinemas.find(c=>c.id===key);if(!c)fail('找不到影城。',404);return c;};
    const findOrder=key=>{const o=db.orders.find(o=>o.id===key);if(!o)fail('找不到委刊。',404);if(o.ownerId!==user.uid&&!staff(member.role))fail('無法存取這筆委刊。',403);return o;};
    const today=new Date(now()).toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'});
    if(route==='/admin/cinemas'&&method==='GET'){permit(['super_admin','cinema_manager','reviewer']);return {cinemas:clone(db.cinemas)};}
    if(route==='/tags'&&method==='PUT'){
      permit(['super_admin','cinema_manager']);
      if(!text(body.name,60)||!text(body.category,60)||!text(body.source,300)||!['推估','實際統計','營運設定'].includes(body.kind))fail('請填寫標籤名稱、分類、來源及資料類型。');
      if(body.updatedAt&&!/^\d{4}-\d{2}-\d{2}$/.test(body.updatedAt))fail('資料更新日期格式不正確。');
      const old=body.id?db.audienceTags.find(t=>t.id===body.id):null;if(body.id&&!old)fail('找不到標籤。',404);
      const tag={id:old?.id||uuid(),name:body.name.trim(),category:body.category.trim(),source:body.source.trim(),kind:body.kind,active:body.active!==false,updatedAt:body.updatedAt||'',externalCode:String(body.externalCode||'').slice(0,100)};
      if(old)Object.assign(old,tag);else db.audienceTags.push(tag);return done('tag.save',tag.id);
    }
    const profileMatch=route.match(/^\/cinemas\/([^/]+)\/profile(?:\/([^/]+))?$/);
    if(profileMatch&&method==='PUT'){
      permit(['super_admin','cinema_manager']);const c=findCinema(profileMatch[1]),h=profileMatch[2]?c.halls.find(h=>h.id===profileMatch[2]):null;
      if(profileMatch[2]&&!h)fail('找不到影廳。',404);
      const data={description:String(body.description||'').slice(0,2000),photoUrl:String(body.photoUrl||'').slice(0,1000)};
      if(data.photoUrl&&!/^https:\/\//.test(data.photoUrl))fail('照片請使用 HTTPS 圖片網址。');
      if(h){
        if('inheritCinemaTags'in body&&typeof body.inheritCinemaTags!=='boolean')fail('請選擇是否沿用影城標籤。');
        if('tagIds'in body&&(!Array.isArray(body.tagIds)||body.tagIds.some(id=>!db.audienceTags.some(t=>t.id===id))))fail('標籤不存在。');
        if(body.seats!==null&&(!Number.isInteger(body.seats)||body.seats<1||body.seats>2000))fail('座位數須為 1–2000，未知請留空。');Object.assign(h,data,{seats:body.seats,equipment:String(body.equipment||'').slice(0,1000),materialRequirements:String(body.materialRequirements||'').slice(0,1000),...('inheritCinemaTags'in body?{inheritCinemaTags:body.inheritCinemaTags}:{}),...('tagIds'in body?{tagIds:[...new Set(body.tagIds)]}:{})});}
      else{
        if(!Array.isArray(body.tagIds)||body.tagIds.some(id=>!db.audienceTags.some(t=>t.id===id)))fail('標籤不存在。');
        Object.assign(c,data,{transport:String(body.transport||'').slice(0,1000),businessArea:String(body.businessArea||'').slice(0,200),nowShowing:String(body.nowShowing||'').slice(0,2000),moviesSource:String(body.moviesSource||'').slice(0,500),moviesUpdatedAt:String(body.moviesUpdatedAt||'').slice(0,10),tagIds:[...new Set(body.tagIds)],audienceSource:String(body.audienceSource||'').slice(0,500),audiencePeriod:String(body.audiencePeriod||'').slice(0,100),audienceUpdatedAt:String(body.audienceUpdatedAt||'').slice(0,10),audienceConfidence:String(body.audienceConfidence||'').slice(0,100),externalLocationId:String(body.externalLocationId||'').slice(0,100)});
      }return done('profile.save',h?.id||c.id);
    }
    if(route==='/settings'&&method==='PUT'){
      permit(['super_admin']);if(!Number.isInteger(body.defaultCapacity)||body.defaultCapacity<1||body.defaultCapacity>120||!Number.isInteger(body.maxBookingDays)||body.maxBookingDays<1||body.maxBookingDays>180)fail('請輸入範圍內的整數。');
      db.settings={defaultCapacity:body.defaultCapacity,maxBookingDays:body.maxBookingDays,slotSeconds:30};return done('settings.update','booking');
    }
    if((route==='/cinemas'&&method==='POST')||(/^\/cinemas\/[^/]+$/.test(route)&&method==='PUT')){
      permit(['super_admin','cinema_manager']);if(!['name','city','district','address'].every(k=>text(body[k])))fail('請填寫完整影城資料。');
      const data={name:body.name.trim(),city:body.city.trim(),district:body.district.trim(),address:body.address.trim(),description:String(body.description||'').slice(0,1000),active:body.active!==false};
      if('lat' in body||'lng' in body){
        if(body.lat===null&&body.lng===null){data.lat=null;data.lng=null;}
        else if(!Number.isFinite(body.lat)||!Number.isFinite(body.lng)||Math.abs(body.lat)>90||Math.abs(body.lng)>180)fail('請填寫有效的緯度與經度，或兩欄皆留空。');
        else{data.lat=body.lat;data.lng=body.lng;}
      }
      if(method==='POST'){const c={...data,id:uuid(),halls:[]};db.cinemas.push(c);return done('cinema.create',c.id,{id:c.id});}
      const c=findCinema(route.split('/')[2]);Object.assign(c,data);return done('cinema.update',c.id);
    }
    const hallMatch=route.match(/^\/cinemas\/([^/]+)\/halls(?:\/([^/]+))?$/);
    if(hallMatch&&['POST','PUT'].includes(method)){
      permit(['super_admin','cinema_manager']);const c=findCinema(hallMatch[1]);
      if(!text(body.name)||!text(body.screenType)||(body.seats!==null&&(!Number.isInteger(body.seats)||body.seats<1||body.seats>2000)))fail('請輸入影廳名稱、規格與正確座位數。');
      if(body.weeklyPrice!==undefined&&(!Number.isSafeInteger(body.weeklyPrice)||body.weeklyPrice<1))fail('週價須為正整數。');
      if(body.dailyPrice!==undefined&&(!Number.isSafeInteger(body.dailyPrice)||body.dailyPrice<1))fail('價格須為正整數。');
      if(body.capacity!==undefined&&body.capacity!==null&&(!Number.isInteger(body.capacity)||body.capacity<1||body.capacity>120))fail('影廳容量須為 1–120 檔。');
      const existing=method==='PUT'?c.halls.find(h=>h.id===hallMatch[2]):null;if(method==='PUT'&&!existing)fail('找不到影廳。',404);
      const input={name:body.name.trim(),screenType:body.screenType.trim(),seats:body.seats,active:body.active!==false,...('weeklyPrice'in body?{weeklyPrice:body.weeklyPrice}:{}),...('dailyPrice'in body?{dailyPrice:body.dailyPrice}:{}),...('capacity'in body?{capacity:body.capacity}:{})};
      const h=editHall(existing,input,member.role);h.id=existing?.id||uuid();
      if(existing)c.halls=c.halls.map(v=>v.id===h.id?h:v);else c.halls.push(h);
      return done('hall.save',h.id,{id:h.id});
    }
    if(route==='/orders'&&method==='GET')return {orders:clone(db.orders.filter(o=>staff(member.role)||o.ownerId===user.uid).slice().reverse()),nextCursor:null};
    if(route==='/orders'&&method==='POST'){
      const {billing,items,requestId}=body;
      if(!text(requestId,128))fail('缺少申請識別碼。');
      const prior=db.requests[`${user.uid}_${requestId}`];if(prior)return {orderIds:clone(prior)};
      if(!billing||!['companyName','contactPerson','phone'].every(k=>text(billing[k]))||!/^\d{8}$/.test(billing.taxId)||!/^\S+@\S+\.\S+$/.test(billing.email))fail('請填寫完整聯絡資料與八碼統一編號。');
      if(!Array.isArray(items)||items.length<1||items.length>MAX_CART_ITEMS)fail(`每次請選擇 1–${MAX_CART_ITEMS} 筆影廳委刊。`);
      if(new Set(items.map(itemKey)).size!==items.length)fail('同一影廳、相同日期不可重複加入。');
      const orders=items.map(i=>{const c=findCinema(i.cinemaId),h=c.halls.find(h=>h.id===i.hallId);if(!c.active||!h?.active)fail('影城或影廳已停用。');const dates=bookingDates(i.startDate,i.endDate,db.settings.maxBookingDays,today);if(i.slotsCount>(h.capacity??db.settings.defaultCapacity))fail('檔數超過影廳容量。');
        return {...billing,id:uuid(),ownerId:user.uid,cinemaId:c.id,hallId:h.id,cinemaName:c.name,hallName:h.name,startDate:i.startDate,endDate:i.endDate,slotsCount:i.slotsCount,daysCount:dates.length,weeklyPrice:h.weeklyPrice,priceUnit:'week',weeksCount:dates.length/7,totalAmount:weeklyTotal(h.weeklyPrice,i.slotsCount,dates.length),slotSeconds:30,status:'PENDING_APPROVAL',qcStatus:'WAITING_UPLOAD',createdAt:stamp(now())};});
      db.orders.push(...orders);const orderIds=orders.map(o=>o.id);db.requests[`${user.uid}_${requestId}`]=orderIds;return done('order.create',orderIds.join(','),{orderIds});
    }
    const orderMatch=route.match(/^\/orders\/([^/]+)\/(decision|material|qc)$/);
    if(orderMatch){const order=findOrder(orderMatch[1]),action=orderMatch[2];
      if(action==='decision'&&method==='POST'){
        permit(['super_admin','reviewer']);const decision=body.decision;
        if(!['APPROVED','REJECTED','CANCELLED'].includes(decision))fail('不正確的委刊狀態。');
        if(order.status===decision)return {ok:true};
        const cancel=order.status==='APPROVED'&&decision==='CANCELLED';
        if(!cancel&&(order.status!=='PENDING_APPROVAL'||decision==='CANCELLED'))fail('此委刊無法進行這項操作。',409);
        if(decision!=='APPROVED'&&!text(body.reason,1000))fail('請填寫處理原因。');
        if(cancel&&order.startDate<=today)fail('已開始的投放無法取消。');
        if(decision==='APPROVED'||cancel){const c=findCinema(order.cinemaId),h=c.halls.find(h=>h.id===order.hallId);if(!h||(!cancel&&(!c.active||!h.active)))fail('影城或影廳未啟用。');const dates=bookingDates(order.startDate,order.endDate,180,today);const revised=cancel?release(h,dates,order.slotsCount):reserve(h,dates,order.slotsCount,db.settings.defaultCapacity);c.halls=c.halls.map(v=>v.id===h.id?revised:v);}
        Object.assign(order,{status:decision,decisionReason:body.reason||'',updatedAt:stamp(now())});return done('order.'+decision,order.id);
      }
      if(action==='material'&&method==='POST'){
        if(order.ownerId!==user.uid)fail('只能選取自己委刊的素材。',403);
        if(order.status!=='APPROVED'||order.qcStatus==='QC_PASS')fail('目前無法更換素材。',409);
        if(!text(body.filename,200)||!['video/mp4','video/quicktime'].includes(body.type)||body.size<1||body.size>524288000||!/^local-material\/[a-f0-9-]+$/.test(body.path))fail('請選擇 500 MB 以下的 MP4 或 MOV 影片。');
        let spec;try{spec=validateVideoSpec({...body.spec,size:body.size,type:body.type});}catch(e){fail(e.message);}
        Object.assign(order,{material:{path:body.path,filename:body.filename,size:body.size,spec},qcStatus:'WAITING_REVIEW',qcSpecCheck:null,qcNotes:''});return done('material.select',order.id);
      }
      if(action==='qc'&&method==='POST'){
        permit(['super_admin','reviewer']);if(order.status!=='APPROVED'||!order.material||order.material.path!==body.materialPath)fail('素材或訂單狀態已變更，請重新載入。',409);
        if(!['QC_PASS','QC_REJECTED'].includes(body.status))fail('不正確的審查狀態。');
        const checks=body.checks||{};
        if(body.status==='QC_PASS'){try{validateVideoSpec(order.material.spec);}catch(e){fail(e.message);}}
        if(body.status==='QC_PASS'&&(!['resolution','audio','frameRate'].every(k=>checks[k]===true)||!text(checks.culturePermit,150)||!text(checks.cplName,200)))fail('請完成每項檢核、許可證號及 CPL 檔名。');
        if(body.status==='QC_REJECTED'&&!text(body.notes,2000))fail('請填寫退件原因。');
        Object.assign(order,{qcStatus:body.status,qcSpecCheck:clone(checks),qcNotes:String(body.notes||'').slice(0,2000)});return done('material.'+body.status,order.id);
      }
    }
    if(route==='/cuesheet'&&method==='GET'){
      permit(['super_admin','reviewer']);const {cinemaId,hallId,date}=Object.fromEntries(url.searchParams);let slot=0;
      const rows=db.orders.filter(o=>o.cinemaId===cinemaId&&o.hallId===hallId&&o.status==='APPROVED'&&o.qcStatus==='QC_PASS'&&o.startDate<=date&&o.endDate>=date).sort((a,b)=>a.id.localeCompare(b.id)).flatMap(o=>Array.from({length:o.slotsCount},()=>({slot:++slot,seconds:o.material?.spec?.duration??o.slotSeconds,orderId:o.id,companyName:o.companyName,culturePermit:o.qcSpecCheck.culturePermit,cplName:o.qcSpecCheck.cplName})));
      return {rows:clone(rows),cinemaId,hallId,date};
    }
    if(route==='/users'&&method==='GET'){permit(['super_admin']);return {users:clone(db.users),nextCursor:null};}
    const userMatch=route.match(/^\/users\/([^/]+)$/);
    if(userMatch&&method==='PUT'){
      permit(['super_admin']);if(userMatch[1]===user.uid)fail('不能修改自己的權限。');
      if(!ROLES.includes(body.role)||typeof body.disabled!=='boolean')fail('不正確的權限設定。');
      const target=db.users.find(u=>u.id===userMatch[1]);if(!target)fail('找不到會員。',404);
      Object.assign(target,{role:body.role,disabled:body.disabled});return done('user.permissions',target.id);
    }
    fail('找不到這項功能。',404);
  }};
}
