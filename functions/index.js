import express from 'express';
import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret,defineString} from 'firebase-functions/params';
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue,Timestamp} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';
import {randomBytes,createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {BusinessError,DEFAULT_SETTINGS,ROLES,bookingDates,calculatePrice,reserve,release,editHall,requireRole,canBootstrap} from './domain.js';

initializeApp();
const db=getFirestore(), auth=getAuth();
const lineSecret=defineSecret('LINE_CHANNEL_SECRET');
const lineId=defineString('LINE_CHANNEL_ID',{default:''});
const publicOrigin=defineString('PUBLIC_ORIGIN',{default:''});
const lineEnabled=defineString('LINE_ENABLED',{default:'false'});
const initialAdmin=defineString('INITIAL_ADMIN_EMAIL',{default:''});
export const apiApp=express();
apiApp.disable('x-powered-by');
apiApp.use(express.json({limit:'96kb'}));
apiApp.use((req,res,next)=>{
  res.set('Cache-Control','no-store'); res.set('X-Content-Type-Options','nosniff');
  const origin=publicOrigin.value();
  if(!['GET','HEAD'].includes(req.method) && req.headers.origin!==origin && process.env.FUNCTIONS_EMULATOR!=='true') return res.status(403).json({error:'請從本站進行操作。'});
  next();
});
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
const roles=(req,allowed)=>requireRole(req.member.role,allowed);
const getSettings=async tx=>({...DEFAULT_SETTINGS,...(await (tx?tx.get(db.doc('settings/booking')):db.doc('settings/booking').get())).data()});
const audit=(tx,req,action,id)=>tx.create(db.collection('audit').doc(),{actor:req.member.uid,role:req.member.role,action,entityId:id,createdAt:FieldValue.serverTimestamp()});
const id=z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const name=z.string().trim().min(1).max(150);
const cinemaSchema=z.object({name,city:name,district:name,address:z.string().trim().min(1).max(250),description:z.string().max(1000).default(''),active:z.boolean().default(true)}).strict();
const hallSchema=z.object({name,screenType:name,seats:z.number().int().min(1).max(2000),active:z.boolean().default(true),dailyPrice:z.number().int().min(1).max(10000000).optional(),capacity:z.number().int().min(1).max(120).nullable().optional()}).strict();
const billingSchema=z.object({companyName:name,taxId:z.string().regex(/^\d{8}$/,'統一編號須為 8 位數字'),contactPerson:name,phone:z.string().trim().min(6).max(30),email:z.email().max(200)}).strict();
const itemSchema=z.object({cinemaId:id,hallId:id,startDate:z.string(),endDate:z.string(),slotsCount:z.number().int().min(1).max(120)}).strict();
const hasManagement=role=>['super_admin','reviewer'].includes(role);
const serialize=doc=>({id:doc.id,...doc.data()});
const cookie=(req,key)=>(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(key+'='))?.slice(key.length+1);
const hash=s=>createHash('sha256').update(s).digest('hex');
const secureCookie={httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:600000};
async function limitAction(uid) {
  const ref=db.doc(`rateLimits/${uid}`);
  await db.runTransaction(async tx=>{
    const previous=(await tx.get(ref)).data(); const now=Date.now();
    const count=previous && now-previous.window<60000?previous.count+1:1;
    if(count>40) throw new BusinessError('操作太頻繁，請稍後再試。',429);
    tx.set(ref,{window:count===1?now:previous.window,count,expiresAt:Timestamp.fromMillis(now+3600000)});
  });
}
apiApp.get('/api/health',(_req,res)=>res.json({service:'MOVIE',ok:true}));
apiApp.get('/api/config',wrap(async(_req,res)=>res.json({settings:await getSettings(),lineEnabled:lineEnabled.value()==='true'})));
apiApp.get('/api/cinemas',wrap(async(_req,res)=>{
  const docs=await db.collection('cinemas').where('active','==',true).limit(200).get();
  res.json({cinemas:docs.docs.map(d=>{const c=serialize(d);return {...c,halls:c.halls.filter(h=>h.active).map(({bookedSlots,...h})=>h)};})});
}));

// OAuth uses unpredictable state, browser binding, nonce, and single-use sessions.
apiApp.get('/api/auth/line/start',wrap(async(req,res)=>{
  if(lineEnabled.value()!=='true'||!lineId.value()||!publicOrigin.value()) throw new BusinessError('LINE 登入尚未由管理員啟用。',503);
  const state=randomBytes(32).toString('hex'),nonce=randomBytes(32).toString('hex');
  await db.doc(`oauthStates/${hash(state)}`).create({nonce,expiresAt:Timestamp.fromMillis(Date.now()+600000)});
  // Firebase Hosting forwards only the __session cookie to Functions.
  res.cookie('__session',`state.${state}`,secureCookie);
  const q=new URLSearchParams({response_type:'code',client_id:lineId.value(),redirect_uri:`${publicOrigin.value()}/api/auth/line/callback`,state,scope:'openid profile',nonce});
  res.redirect(`https://access.line.me/oauth2/v2.1/authorize?${q}`);
}));
apiApp.get('/api/auth/line/callback',wrap(async(req,res)=>{
  const state=z.string().regex(/^[a-f0-9]{64}$/).parse(req.query.state);
  if(cookie(req,'__session')!==`state.${state}`) throw new BusinessError('LINE 登入驗證失敗，請重新登入。',403);
  const ref=db.doc(`oauthStates/${hash(state)}`);
  const oauth=await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists||snap.data().expiresAt.toMillis()<Date.now()) throw new BusinessError('LINE 登入已過期。');tx.delete(ref);return snap.data();});
  if(req.query.error) {res.clearCookie('__session',secureCookie);return res.redirect('/?login_error=line_cancelled');}
  const code=z.string().min(1).max(3000).parse(req.query.code);
  const tokenResponse=await fetch('https://api.line.me/oauth2/v2.1/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:`${publicOrigin.value()}/api/auth/line/callback`,client_id:lineId.value(),client_secret:lineSecret.value()}),signal:AbortSignal.timeout(15000)});
  const tokens=await tokenResponse.json();
  if(!tokenResponse.ok||!tokens.id_token) throw new BusinessError('LINE 授權交換失敗，請重新登入。',401);
  const check=await fetch('https://api.line.me/oauth2/v2.1/verify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({id_token:tokens.id_token,client_id:lineId.value(),nonce:oauth.nonce}),signal:AbortSignal.timeout(15000)});
  const profile=await check.json();
  if(!check.ok||!profile.sub||profile.nonce!==oauth.nonce||profile.aud!==lineId.value()) throw new BusinessError('LINE 身分驗證失敗。',401);
  const uid=`line_${profile.sub}`;
  const userInfo={displayName:String(profile.name||'LINE 會員').slice(0,100)};
  if(profile.picture?.startsWith('https://')) userInfo.photoURL=profile.picture;
  try {await auth.updateUser(uid,userInfo);} catch(e) {if(e.code!=='auth/user-not-found') throw e;await auth.createUser({uid,...userInfo});}
  const ticket=randomBytes(32).toString('hex');
  await db.doc(`loginTickets/${hash(ticket)}`).create({uid,expiresAt:Timestamp.fromMillis(Date.now()+60000)});
  res.cookie('__session',`ticket.${ticket}`,{...secureCookie,maxAge:60000});
  res.redirect('/?line_login=1');
}));
apiApp.post('/api/auth/line/session',wrap(async(req,res)=>{
  const raw=cookie(req,'__session');
  if(!raw||!/^ticket\.[a-f0-9]{64}$/.test(raw)) throw new BusinessError('登入已過期，請重新登入。',401);
  const ref=db.doc(`loginTickets/${hash(raw.slice(7))}`);
  const uid=await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists||snap.data().expiresAt.toMillis()<Date.now()) throw new BusinessError('登入已過期。',401);tx.delete(ref);return snap.data().uid;});
  res.clearCookie('__session',secureCookie);
  res.json({token:await auth.createCustomToken(uid)});
}));

apiApp.use('/api',async(req,res,next)=>{
  try {
    const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if(!token) throw new BusinessError('請先登入。',401);
    let verified;try {verified=await auth.verifyIdToken(token,true);} catch {throw new BusinessError('登入已失效，請重新登入。',401);}
    const ref=db.doc(`users/${verified.uid}`);
    await db.runTransaction(async tx=>{
      const [current,bootstrap]=await tx.getAll(ref,db.doc('system/adminBootstrap'));
      const promote=canBootstrap(verified,initialAdmin.value(),bootstrap.exists);
      if(promote){tx.set(ref,{role:'super_admin',name:verified.name||'',email:verified.email||'',disabled:false,...(!current.exists?{createdAt:FieldValue.serverTimestamp()}:{})},{merge:true});tx.create(db.doc('system/adminBootstrap'),{uid:verified.uid,createdAt:FieldValue.serverTimestamp()});}
      else if(!current.exists)tx.create(ref,{role:'buyer',name:verified.name||'',email:verified.email||'',createdAt:FieldValue.serverTimestamp()});
    });
    const user=(await ref.get()).data();
    if(user.disabled) throw new BusinessError('此帳號已停用。',403);
    req.member={...user,uid:verified.uid};
    if(req.method!=='GET') await limitAction(verified.uid);
    next();
  } catch(e) {next(e);}
});
apiApp.get('/api/me',(req,res)=>res.json(req.member));
apiApp.get('/api/admin/cinemas',wrap(async(req,res)=>{
  roles(req,['super_admin','cinema_manager','reviewer']);
  res.json({cinemas:(await db.collection('cinemas').limit(200).get()).docs.map(serialize)});
}));
apiApp.post('/api/cinemas',wrap(async(req,res)=>{
  roles(req,['super_admin','cinema_manager']); const data=cinemaSchema.parse(req.body);
  const ref=db.collection('cinemas').doc();
  await db.runTransaction(async tx=>{tx.create(ref,{...data,halls:[],createdAt:FieldValue.serverTimestamp()});audit(tx,req,'cinema.create',ref.id);});
  res.status(201).json({id:ref.id});
}));
apiApp.put('/api/cinemas/:id',wrap(async(req,res)=>{
  roles(req,['super_admin','cinema_manager']); const key=id.parse(req.params.id),data=cinemaSchema.parse(req.body);
  await db.runTransaction(async tx=>{const ref=db.doc(`cinemas/${key}`);if(!(await tx.get(ref)).exists) throw new BusinessError('找不到影城。',404);tx.update(ref,{...data,updatedAt:FieldValue.serverTimestamp()});audit(tx,req,'cinema.update',key);});
  res.json({ok:true});
}));
apiApp.post('/api/cinemas/:id/halls',wrap(async(req,res)=>{
  roles(req,['super_admin','cinema_manager']);const key=id.parse(req.params.id),data=hallSchema.parse(req.body);
  const hall=editHall(null,{...data,id:randomUUID()},req.member.role);
  await db.runTransaction(async tx=>{const ref=db.doc(`cinemas/${key}`),snap=await tx.get(ref);if(!snap.exists) throw new BusinessError('找不到影城。',404);if(snap.data().halls.length>=100) throw new BusinessError('每座影城最多 100 個影廳。');tx.update(ref,{halls:[...snap.data().halls,hall]});audit(tx,req,'hall.create',hall.id);});
  res.status(201).json({id:hall.id});
}));
apiApp.put('/api/cinemas/:id/halls/:hallId',wrap(async(req,res)=>{
  roles(req,['super_admin','cinema_manager']);const key=id.parse(req.params.id),hallId=id.parse(req.params.hallId),data=hallSchema.parse(req.body);
  await db.runTransaction(async tx=>{const ref=db.doc(`cinemas/${key}`),snap=await tx.get(ref);const halls=snap.data()?.halls;if(!halls?.some(h=>h.id===hallId)) throw new BusinessError('找不到影廳。',404);tx.update(ref,{halls:halls.map(h=>h.id===hallId?editHall(h,data,req.member.role):h)});audit(tx,req,'hall.update',hallId);});
  res.json({ok:true});
}));
apiApp.put('/api/settings',wrap(async(req,res)=>{
  roles(req,['super_admin']);const data=z.object({defaultCapacity:z.number().int().min(1).max(120),maxBookingDays:z.number().int().min(1).max(180)}).strict().parse(req.body);
  await db.runTransaction(async tx=>{tx.set(db.doc('settings/booking'),{...data,slotSeconds:30});audit(tx,req,'settings.update','booking');});res.json({ok:true});
}));

apiApp.get('/api/orders',wrap(async(req,res)=>{
  let q=db.collection('orders');
  if(!hasManagement(req.member.role)) q=q.where('ownerId','==',req.member.uid);
  q=q.orderBy('__name__','desc');
  if(req.query.after) q=q.startAfter(id.parse(req.query.after));
  const snap=await q.limit(51).get();const page=snap.docs.slice(0,50);
  res.json({orders:page.map(serialize),nextCursor:snap.size>50?page.at(-1).id:null});
}));
apiApp.post('/api/orders',wrap(async(req,res)=>{
  const data=z.object({requestId:z.uuid(),billing:billingSchema,items:z.array(itemSchema).min(1).max(20)}).strict().parse(req.body);
  const requestRef=db.doc(`requests/${req.member.uid}_${data.requestId}`);
  const ids=await db.runTransaction(async tx=>{
    const prior=await tx.get(requestRef);if(prior.exists) return prior.data().orderIds;
    const settings=await getSettings(tx);
    const unique=[...new Set(data.items.map(i=>i.cinemaId))];
    const cinemaSnaps=await tx.getAll(...unique.map(key=>db.doc(`cinemas/${key}`)));
    const cinemaMap=Object.fromEntries(cinemaSnaps.map(d=>[d.id,d.data()]));
    const orders=data.items.map(item=>{
      const cinema=cinemaMap[item.cinemaId],hall=cinema?.halls.find(h=>h.id===item.hallId);
      if(!cinema?.active||!hall?.active) throw new BusinessError('影城或影廳已停用，請重新選擇。');
      if(item.slotsCount>(hall.capacity??settings.defaultCapacity)) throw new BusinessError('檔數超過該影廳容量。');
      const dates=bookingDates(item.startDate,item.endDate,settings.maxBookingDays);
      const ref=db.collection('orders').doc();
      return {ref,order:{...item,...data.billing,ownerId:req.member.uid,cinemaName:cinema.name,hallName:hall.name,daysCount:dates.length,dailyPrice:hall.dailyPrice,totalAmount:calculatePrice(hall.dailyPrice,item.slotsCount,dates.length),slotSeconds:30,status:'PENDING_APPROVAL',qcStatus:'WAITING_UPLOAD',createdAt:FieldValue.serverTimestamp()}};
    });
    for(const {ref,order} of orders) {tx.create(ref,order);audit(tx,req,'order.create',ref.id);}
    const orderIds=orders.map(o=>o.ref.id);tx.create(requestRef,{orderIds,createdAt:FieldValue.serverTimestamp()});return orderIds;
  });res.status(201).json({orderIds:ids});
}));
apiApp.post('/api/orders/:id/decision',wrap(async(req,res)=>{
  roles(req,['super_admin','reviewer']);const key=id.parse(req.params.id);
  const data=z.object({decision:z.enum(['APPROVED','REJECTED','CANCELLED']),reason:z.string().trim().max(1000).default('')}).strict().parse(req.body);
  await db.runTransaction(async tx=>{
    const ref=db.doc(`orders/${key}`),snap=await tx.get(ref);if(!snap.exists) throw new BusinessError('找不到訂單。',404);
    const order=snap.data();if(order.status===data.decision) return;
    const cancel=order.status==='APPROVED'&&data.decision==='CANCELLED';
    if(!cancel && (order.status!=='PENDING_APPROVAL'||!['APPROVED','REJECTED'].includes(data.decision))) throw new BusinessError('此訂單無法執行這個狀態變更。',409);
    if(data.decision!=='APPROVED'&&!data.reason) throw new BusinessError('請填寫原因。');
    if(cancel && order.startDate<=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'})) throw new BusinessError('已開始投放的訂單無法取消。');
    if(data.decision==='APPROVED'||cancel) {
      const settings=await getSettings(tx),cRef=db.doc(`cinemas/${order.cinemaId}`),cSnap=await tx.get(cRef);const cinema=cSnap.data(),hall=cinema?.halls.find(h=>h.id===order.hallId);
      if(!hall) throw new BusinessError('影廳不存在。',409);
      if(!cancel && (!cinema.active||!hall.active)) throw new BusinessError('影城或影廳已停用。',409);
      const dates=bookingDates(order.startDate,order.endDate,180);
      const revised=cancel?release(hall,dates,order.slotsCount):reserve(hall,dates,order.slotsCount,settings.defaultCapacity);
      tx.update(cRef,{halls:cinema.halls.map(h=>h.id===hall.id?revised:h)});
    }
    tx.update(ref,{status:data.decision,decisionReason:data.reason,decidedBy:req.member.uid,updatedAt:FieldValue.serverTimestamp()});audit(tx,req,`order.${data.decision}`,key);
  });res.json({ok:true});
}));
apiApp.post('/api/orders/:id/material',wrap(async(req,res)=>{
  const key=id.parse(req.params.id);const data=z.object({path:z.string().max(500),filename:z.string().min(1).max(200)}).strict().parse(req.body);
  if(!new RegExp(`^materials/${req.member.uid}/${key}/[a-f0-9-]+$`).test(data.path)) throw new BusinessError('素材路徑不正確。');
  const [metadata]=await getStorage().bucket().file(data.path).getMetadata();
  if(!['video/mp4','video/quicktime'].includes(metadata.contentType)||Number(metadata.size)>524288000||Number(metadata.size)<1) throw new BusinessError('檔案規格不符合上傳限制。');
  await db.runTransaction(async tx=>{
    const ref=db.doc(`orders/${key}`),snap=await tx.get(ref),order=snap.data();
    if(!order||order.ownerId!==req.member.uid) throw new BusinessError('無權存取此訂單。',403);
    if(order.status!=='APPROVED'||order.qcStatus==='QC_PASS') throw new BusinessError('目前無法更換素材。',409);
    tx.update(ref,{material:{...data,size:Number(metadata.size)},qcStatus:'WAITING_REVIEW',qcSpecCheck:null,qcNotes:'',updatedAt:FieldValue.serverTimestamp()});audit(tx,req,'material.submit',key);
  });res.json({ok:true});
}));
apiApp.get('/api/orders/:id/material',wrap(async(req,res)=>{
  const order=(await db.doc(`orders/${id.parse(req.params.id)}`).get()).data();
  if(!order||(order.ownerId!==req.member.uid&&!hasManagement(req.member.role))) throw new BusinessError('無權存取此素材。',403);
  if(!order.material) throw new BusinessError('尚未上傳素材。',404);
  const [url]=await getStorage().bucket().file(order.material.path).getSignedUrl({action:'read',expires:Date.now()+300000});res.json({url});
}));
apiApp.post('/api/orders/:id/qc',wrap(async(req,res)=>{
  roles(req,['super_admin','reviewer']);const key=id.parse(req.params.id);
  const data=z.object({status:z.enum(['QC_PASS','QC_REJECTED']),notes:z.string().trim().max(2000),materialPath:z.string().min(1).max(500),checks:z.object({duration30s:z.boolean().optional(),resolution:z.boolean(),audio:z.boolean(),frameRate:z.boolean(),culturePermit:z.string().trim().max(150),cplName:z.string().trim().max(200)}).strict()}).strict().parse(req.body);
  if(data.status==='QC_PASS'&&(!data.checks.resolution||!data.checks.audio||!data.checks.frameRate||!data.checks.culturePermit||!data.checks.cplName)) throw new BusinessError('請完成每項人工檢核、准播號及 CPL 代碼，才可通過。');
  if(data.status==='QC_REJECTED'&&!data.notes) throw new BusinessError('請填寫退件原因。');
  await db.runTransaction(async tx=>{const ref=db.doc(`orders/${key}`),snap=await tx.get(ref),o=snap.data();if(!o?.material||o.status!=='APPROVED'||o.material.path!==data.materialPath) throw new BusinessError('訂單未核准或素材已更換，請重新載入。',409);tx.update(ref,{qcStatus:data.status,qcSpecCheck:data.checks,qcNotes:data.notes,qcBy:req.member.uid,updatedAt:FieldValue.serverTimestamp()});audit(tx,req,'material.'+data.status,key);});res.json({ok:true});
}));
apiApp.get('/api/cuesheet',wrap(async(req,res)=>{
  roles(req,['super_admin','reviewer']);const cinemaId=id.parse(req.query.cinemaId),hallId=id.parse(req.query.hallId),date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.query.date);
  const snap=await db.collection('orders').where('cinemaId','==',cinemaId).get();let slot=0;
  const rows=snap.docs.map(serialize).filter(o=>o.hallId===hallId&&o.status==='APPROVED'&&o.qcStatus==='QC_PASS'&&o.startDate<=date&&o.endDate>=date).sort((a,b)=>a.id.localeCompare(b.id)).flatMap(o=>Array.from({length:o.slotsCount},()=>({slot:++slot,seconds:o.material?.spec?.duration??o.slotSeconds,orderId:o.id,companyName:o.companyName,culturePermit:o.qcSpecCheck.culturePermit,cplName:o.qcSpecCheck.cplName})));
  res.json({rows,date,cinemaId,hallId});
}));
apiApp.get('/api/users',wrap(async(req,res)=>{
  roles(req,['super_admin']);let q=db.collection('users').orderBy('__name__');if(req.query.after) q=q.startAfter(id.parse(req.query.after));const snap=await q.limit(51).get();const page=snap.docs.slice(0,50);res.json({users:page.map(serialize),nextCursor:snap.size>50?page.at(-1).id:null});
}));
apiApp.put('/api/users/:id',wrap(async(req,res)=>{
  roles(req,['super_admin']);const uid=id.parse(req.params.id),data=z.object({role:z.enum(ROLES),disabled:z.boolean()}).strict().parse(req.body);
  if(uid===req.member.uid) throw new BusinessError('不能變更自己的角色或停用自己。');
  await db.runTransaction(async tx=>{const ref=db.doc(`users/${uid}`);if(!(await tx.get(ref)).exists) throw new BusinessError('找不到會員。',404);tx.update(ref,data);audit(tx,req,'user.permissions',uid);});res.json({ok:true});
}));
apiApp.use((_req,res)=>res.status(404).json({error:'找不到這個功能。'}));
apiApp.use((err,_req,res,_next)=>{
  if(err instanceof z.ZodError) return res.status(400).json({error:err.issues.map(i=>i.message).join('；')});
  if(err instanceof BusinessError) return res.status(err.status).json({error:err.message});
  // Avoid logging request tokens, OAuth codes, billing details or provider responses.
  console.error('API failure',{name:err.name,code:err.code||'unknown'});
  res.status(500).json({error:'系統暫時無法完成操作，請稍後再試。'});
});
// Secret is bound only when LINE is enabled, so Google-only deployment works first.
export const api=onRequest({region:'asia-east1',maxInstances:5,memory:'256MiB',timeoutSeconds:60,...(process.env.LINE_ENABLED==='true'?{secrets:[lineSecret]}:{})},apiApp);
