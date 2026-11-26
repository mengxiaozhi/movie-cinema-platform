import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalService,LOCAL_KEY} from '../src/local-service.js';
const owner={uid:'owner',email:'shiaufeng68@gmail.com',emailVerified:true,displayName:'Owner',providerData:[{providerId:'google.com'}]};
const buyer={uid:'buyer',email:'buyer@example.com',emailVerified:true,displayName:'Buyer',providerData:[{providerId:'google.com'}]};
function setup(){
  const map=new Map();const storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
  let user=null,n=0;const now=()=>Date.parse('2026-10-15T04:00:00Z');
  const service=createLocalService({storage,getUser:()=>user,now,uuid:()=>`id-${++n}`});
  return {request:service.request,as:u=>{user=u;},storage,map,reopen:()=>createLocalService({storage,getUser:()=>user,now}).request};
}
const billing={companyName:'測試公司',taxId:'12345678',contactPerson:'測試聯絡人',phone:'0912345678',email:'buyer@example.com'};
const item={cinemaId:'c-xinyi',hallId:'h-xy-1',startDate:'2026-11-01',endDate:'2026-11-07',slotsCount:2};
const submit=(request,requestId='req1',items=[item])=>request('/orders',{method:'POST',body:{requestId,billing,items}});
test('公開影城可匿名瀏覽，訂單與會員操作需登入',async()=>{
  const s=setup();const c=await s.request('/cinemas');assert.equal(c.cinemas.length,32);assert.equal(c.cinemas[0].halls[0].bookedSlots,undefined);assert.equal((await s.request('/config')).lineEnabled,false);
  await assert.rejects(()=>s.request('/orders'),/Google/);await assert.rejects(()=>s.request('/me'),/Google/);
});
test('只有已驗證且使用 Google 登入的指定帳號取得本機最高管理員身分',async()=>{
  for(const [u,role] of [[owner,'super_admin'],[{...owner,uid:'unverified',emailVerified:false},'buyer'],[{...owner,uid:'other-provider',providerData:[{providerId:'custom'}]},'buyer'],[buyer,'buyer']]){const s=setup();s.as(u);assert.equal((await s.request('/me')).role,role);}
});
test('委刊重新計價、重試不重複，重新建立服務仍可讀取紀錄',async()=>{
  const s=setup();s.as(buyer);const first=await submit(s.request);const retry=await submit(s.request);assert.deepEqual(first,retry);
  const o=(await s.reopen()('/orders')).orders;assert.equal(o.length,1);assert.equal(o[0].totalAmount,21000*2);assert.equal(o[0].ownerId,buyer.uid);assert.equal(o[0].status,'PENDING_APPROVAL');
});
test('訂單互相隔離，瀏覽器內不同帳號無法讀取他人的委刊',async()=>{
  const s=setup();s.as(buyer);const {orderIds}=await submit(s.request);s.as({...buyer,uid:'buyer2',email:'two@example.com'});
  assert.equal((await s.request('/orders')).orders.length,0);await assert.rejects(()=>s.request(`/orders/${orderIds[0]}/material`,{method:'POST',body:{}}),/無法存取/);
});
test('最高管理員可分派本機角色，影城管理員不能改價格、容量或審核',async()=>{
  const s=setup();s.as(buyer);await s.request('/me');s.as(owner);await s.request('/users/buyer',{method:'PUT',body:{role:'cinema_manager',disabled:false}});s.as(buyer);
  const data={name:'改名影廳',screenType:'2K',seats:200,active:true};const path='/cinemas/c-xinyi/halls/h-xy-1';
  await s.request(path,{method:'PUT',body:data});await assert.rejects(()=>s.request(path,{method:'PUT',body:{...data,dailyPrice:1}}),/最高管理員/);await assert.rejects(()=>s.request(path,{method:'PUT',body:{...data,capacity:100}}),/最高管理員/);
  const {orderIds}=await submit(s.request);await assert.rejects(()=>s.request(`/orders/${orderIds[0]}/decision`,{method:'POST',body:{decision:'APPROVED'}}),/權限/);
  const c=(await s.request('/admin/cinemas')).cinemas.find(c=>c.id==='c-xinyi');assert.equal(c.halls[0].weeklyPrice,21000);
});
test('審核者可核准，不能編輯影城、影廳或全站設定',async()=>{
  const s=setup();s.as(buyer);await s.request('/me');const {orderIds}=await submit(s.request);s.as(owner);await s.request('/users/buyer',{method:'PUT',body:{role:'reviewer',disabled:false}});s.as(buyer);
  await s.request(`/orders/${orderIds[0]}/decision`,{method:'POST',body:{decision:'APPROVED'}});
  await assert.rejects(()=>s.request('/settings',{method:'PUT',body:{defaultCapacity:100,maxBookingDays:90}}),/權限/);
  await assert.rejects(()=>s.request('/cinemas',{method:'POST',body:{}}),/權限/);
});
test('核准占用所有日期、拒絕超賣；取消釋出，調整容量立即套用',async()=>{
  const s=setup();s.as(buyer);const a=await submit(s.request,'a',[{...item,slotsCount:8}]);const b=await submit(s.request,'b',[{...item,slotsCount:5}]);s.as(owner);
  const decide=(key,decision,reason='')=>s.request(`/orders/${key}/decision`,{method:'POST',body:{decision,reason}});
  await decide(a.orderIds[0],'APPROVED');await assert.rejects(()=>decide(b.orderIds[0],'APPROVED'),/不足/);
  await decide(a.orderIds[0],'APPROVED');let c=(await s.request('/admin/cinemas')).cinemas[0];assert.equal(c.halls[0].bookedSlots['2026-11-03'],8);
  await s.request('/settings',{method:'PUT',body:{defaultCapacity:16,maxBookingDays:90}});await decide(b.orderIds[0],'APPROVED');
  await decide(a.orderIds[0],'CANCELLED','客戶改期');c=(await s.request('/admin/cinemas')).cinemas[0];assert.equal(c.halls[0].bookedSlots['2026-11-01'],5);
});
test('素材只記錄 metadata，須通過完整檢核才會出現在排片表',async()=>{
  const s=setup();s.as(buyer);const {orderIds:[key]}=await submit(s.request);s.as(owner);await s.request(`/orders/${key}/decision`,{method:'POST',body:{decision:'APPROVED'}});s.as(buyer);
  const material={path:'local-material/ab12-34',filename:'test.mp4',size:100,type:'video/mp4',spec:{duration:29.97,width:1920,height:1080}};await s.request(`/orders/${key}/material`,{method:'POST',body:material});s.as(owner);
  const path='/cuesheet?cinemaId=c-xinyi&hallId=h-xy-1&date=2026-11-02';assert.equal((await s.request(path)).rows.length,0);
  const qc={status:'QC_PASS',notes:'',materialPath:material.path,checks:{resolution:true,audio:false,frameRate:true,culturePermit:'test-001',cplName:'TEST_CPL'}};
  await assert.rejects(()=>s.request(`/orders/${key}/qc`,{method:'POST',body:qc}),/檢核/);
  qc.checks.audio=true;await s.request(`/orders/${key}/qc`,{method:'POST',body:qc});assert.equal((await s.request(path)).rows.length,2);
});
test('儲存失敗不得回傳成功，無效申請不寫入半筆資料',async()=>{
  const s=setup();s.as(buyer);await s.request('/me');await assert.rejects(()=>submit(s.request,'bad',[item,{...item,hallId:'missing'}]));assert.equal((await s.request('/orders')).orders.length,0);
  s.storage.setItem=()=>{throw new Error('QuotaExceededError');};await assert.rejects(()=>submit(s.request),/未儲存/);assert.equal((await s.request('/orders')).orders.length,0);
});
test('部署包含 Hosting、Google 登入與首頁規則，不含付費後端',async()=>{
  const {readFile}=await import('node:fs/promises');const config=JSON.parse(await readFile(new URL('../firebase.json',import.meta.url),'utf8'));
  assert.ok(config.auth.providers.googleSignIn);assert.equal(config.functions,undefined);assert.equal(config.storage,undefined);assert.ok(config.hosting.rewrites.every(r=>!r.function));
  assert.equal(config.firestore.rules,'firestore.rules');
});

test('影城座標可保存與清空，拒絕半組與超出範圍座標',async()=>{
  const s=setup();s.as(owner);const data={name:'測試影城',city:'台北市',district:'信義區',address:'測試地址',lat:25.03,lng:121.56};
  const {id}=await s.request('/cinemas',{method:'POST',body:data});
  assert.equal((await s.request('/cinemas')).cinemas.find(c=>c.id===id).lat,25.03);
  await assert.rejects(()=>s.request(`/cinemas/${id}`,{method:'PUT',body:{...data,lat:null}}),/緯度/);
  await assert.rejects(()=>s.request(`/cinemas/${id}`,{method:'PUT',body:{...data,lng:200}}),/緯度/);
  await s.request(`/cinemas/${id}`,{method:'PUT',body:{...data,lat:null,lng:null}});
  assert.equal((await s.request('/cinemas')).cinemas.find(c=>c.id===id).lat,null);
});

test('30秒及較長素材可提交審核，無效規格不覆蓋素材，排片顯示實際片長',async()=>{
  const s=setup();s.as(buyer);const {orderIds:[id]}=await submit(s.request);s.as(owner);await s.request(`/orders/${id}/decision`,{method:'POST',body:{decision:'APPROVED'}});s.as(buyer);
  const body={path:'local-material/abc-123',filename:'good.mp4',size:100,type:'video/mp4',spec:{duration:29.96,width:1920,height:1080}};
  await s.request(`/orders/${id}/material`,{method:'POST',body});
  for(const duration of [30,60])await s.request(`/orders/${id}/material`,{method:'POST',body:{...body,spec:{...body.spec,duration}}});
  await assert.rejects(()=>s.request(`/orders/${id}/material`,{method:'POST',body:{...body,spec:{...body.spec,duration:0}}}),/無法確認/);
  assert.equal((await s.request('/orders')).orders[0].material.spec.duration,60);
  // Old records and manipulated local metadata must be checked again on approval.
  const data=JSON.parse(s.storage.getItem(LOCAL_KEY));delete data.orders[0].material.spec;s.storage.setItem(LOCAL_KEY,JSON.stringify(data));
  const qc={status:'QC_PASS',materialPath:body.path,checks:{resolution:true,audio:true,frameRate:true,culturePermit:'p',cplName:'c'}};
  s.as(owner);await assert.rejects(()=>s.request(`/orders/${id}/qc`,{method:'POST',body:qc}),/重新選擇/);
  data.orders[0].material.spec={...body.spec,duration:60,size:body.size,type:body.type};s.storage.setItem(LOCAL_KEY,JSON.stringify(data));
  await s.request(`/orders/${id}/qc`,{method:'POST',body:qc});
  const rows=(await s.request('/cuesheet?cinemaId=c-xinyi&hallId=h-xy-1&date=2026-11-02')).rows;
  assert.equal(rows.length,2);assert.ok(rows.every(row=>row.seconds===60));
});

test('送出委刊拒絕非整週，並使用影廳週價重新報價',async()=>{
  const s=setup();s.as(buyer);await assert.rejects(()=>submit(s.request,'bad-week',[{...item,endDate:'2026-11-03'}]),/7 天的倍數/);
  assert.equal((await s.request('/orders')).orders.length,0);
  await submit(s.request,'two-weeks',[{...item,endDate:'2026-11-14',totalAmount:1}]);
  const order=(await s.request('/orders')).orders[0];assert.equal(order.totalAmount,84000);assert.equal(order.weeksCount,2);assert.equal(order.weeklyPrice,21000);
  s.as(owner);await s.request('/users/buyer',{method:'PUT',body:{role:'cinema_manager',disabled:false}});s.as(buyer);
  await assert.rejects(()=>s.request('/cinemas/c-xinyi/halls/h-xy-1',{method:'PUT',body:{name:'第1廳',screenType:'待確認',seats:null,weeklyPrice:1}}),/最高管理員/);
});

test('公開版位只回傳核准數量、不揭露客戶，跨週使用最少可用量',async()=>{
  const s=setup();s.as(buyer);const {orderIds:[id]}=await submit(s.request,'availability',[{...item,slotsCount:8}]);s.as(owner);await s.request(`/orders/${id}/decision`,{method:'POST',body:{decision:'APPROVED'}});s.as(null);
  const d=await s.request('/availability?startDate=2026-11-01&endDate=2026-11-14');const h=d.halls.find(h=>h.hallId==='h-xy-1');
  assert.equal(h.bookedMax,8);assert.equal(h.remaining,4);assert.equal(h.capacity,12);assert.deepEqual(Object.keys(h).sort(),['bookedMax','capacity','cinemaId','hallId','remaining']);
});
test('全廳批次委刊支援333筆，拒絕相同影廳日期重複且不寫入半筆',async()=>{
  const s=setup();s.as(buyer);await assert.rejects(()=>submit(s.request,'duplicate',[item,item]),/不可重複/);assert.equal((await s.request('/orders')).orders.length,0);
  const {cinemas}=await s.request('/cinemas');const items=cinemas.flatMap(c=>c.halls.map(h=>({...item,cinemaId:c.id,hallId:h.id,slotsCount:1})));
  const result=await submit(s.request,'all-halls',items);assert.equal(result.orderIds.length,333);assert.equal((await s.request('/orders')).orders.length,333);
});

test('簡介與標籤可維護且不修改價格庫存；標籤停用後不公開，買家不可編輯',async()=>{
 const s=setup();s.as(owner);const c=(await s.request('/cinemas')).cinemas[0],h=c.halls[0];
 await s.request('/tags',{method:'PUT',body:{name:'測試商圈',category:'商圈',source:'營運提供商圈資料',kind:'營運設定',active:true,externalCode:'area-v1'}});
 const tag=(await s.request('/tags')).tags.find(t=>t.name==='測試商圈');
 await s.request(`/cinemas/${c.id}/profile`,{method:'PUT',body:{description:'特色',tagIds:[tag.id],nowShowing:'測試片名',moviesSource:'影城提供',externalLocationId:'location-1'}});
 await s.request(`/cinemas/${c.id}/profile/${h.id}`,{method:'PUT',body:{description:'影廳介紹',seats:100,equipment:'待確認設備'}});
 const edited=(await s.request('/cinemas')).cinemas[0];assert.equal(edited.externalLocationId,'location-1');assert.equal(edited.halls[0].seats,100);assert.equal(edited.halls[0].weeklyPrice,h.weeklyPrice);assert.deepEqual(edited.tagIds,[tag.id]);
 await s.request('/tags',{method:'PUT',body:{...tag,active:false}});assert.deepEqual((await s.request('/cinemas')).cinemas[0].tagIds,[]);
 s.as(buyer);await assert.rejects(()=>s.request(`/cinemas/${c.id}/profile`,{method:'PUT',body:{tagIds:[]}}));await assert.rejects(()=>s.request('/tags',{method:'PUT',body:tag}));
});
test('簡介拒絕不安全照片網址與錯誤座位數',async()=>{const s=setup();s.as(owner);const c=(await s.request('/cinemas')).cinemas[0];await assert.rejects(()=>s.request(`/cinemas/${c.id}/profile`,{method:'PUT',body:{tagIds:[],photoUrl:'javascript:alert(1)'}}),/HTTPS/);await assert.rejects(()=>s.request(`/cinemas/${c.id}/profile/${c.halls[0].id}`,{method:'PUT',body:{seats:-1}}),/座位/);});

test('影廳可獨立指派標籤與切回沿用影城，不改價格且拒絕無效標籤',async()=>{
 const s=setup();s.as(owner);const c=(await s.request('/cinemas')).cinemas[0],h=c.halls[0],path=`/cinemas/${c.id}/profile/${h.id}`;
 assert.notEqual(h.inheritCinemaTags,false);
 await s.request(path,{method:'PUT',body:{seats:null,inheritCinemaTags:false,tagIds:['t3']}});
 let saved=(await s.request('/cinemas')).cinemas[0].halls[0];assert.equal(saved.inheritCinemaTags,false);assert.deepEqual(saved.tagIds,['t3']);assert.equal(saved.weeklyPrice,h.weeklyPrice);
 await assert.rejects(()=>s.request(path,{method:'PUT',body:{seats:null,inheritCinemaTags:false,tagIds:['missing']}}),/標籤/);
 await s.request(path,{method:'PUT',body:{seats:null,inheritCinemaTags:true,tagIds:['t3']}});
 saved=(await s.request('/cinemas')).cinemas[0].halls[0];assert.equal(saved.inheritCinemaTags,true);assert.deepEqual(saved.tagIds,['t3']);
});
