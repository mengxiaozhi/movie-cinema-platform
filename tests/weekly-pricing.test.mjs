import test from 'node:test';import assert from 'node:assert/strict';
import {weeklyTotal,previewWeeklyTotal} from '../src/weekly-pricing.js';
import {confirmFilters,emptyFilters} from '../src/catalog.js';
import {INITIAL_TAIWAN_CINEMAS} from '../src/data/cinemas.js';
import {migrateCatalog} from '../src/catalog-migration.js';
test('週價依檔數及整週計算，不可誤乘7天',()=>{
  assert.equal(weeklyTotal(21000,1,7),21000);assert.equal(weeklyTotal(18500,2,14),74000);
  for(const days of [1,6,8,13,15,0,-7])assert.throws(()=>weeklyTotal(21000,1,days),/7 天的倍數/);
  assert.equal(previewWeeklyTotal(21000,0,7),null);assert.equal(previewWeeklyTotal(null,1,7),null);
});
test('搜尋預設完整一週，拒絕未滿一週及非7天倍數',()=>{
  const d=emptyFilters('2026-10-19');assert.equal(d.endDate,'2026-10-25');assert.equal(confirmFilters(d,'2026-10-19').endDate,'2026-10-25');
  for(const endDate of ['2026-10-19','2026-10-24','2026-10-26'])assert.throws(()=>confirmFilters({...d,endDate},'2026-10-19'),/7 天的倍數/);
  assert.equal(confirmFilters({...d,endDate:'2026-11-01'},'2026-10-19').endDate,'2026-11-01');
});
test('使用者價目表共32間333廳，影廳依序命名且無捏造座位或放映規格',()=>{
  assert.equal(INITIAL_TAIWAN_CINEMAS.length,32);assert.equal(INITIAL_TAIWAN_CINEMAS.reduce((n,c)=>n+c.halls.length,0),333);
  for(const c of INITIAL_TAIWAN_CINEMAS){assert.deepEqual(c.halls.map(h=>h.name),Array.from({length:c.halls.length},(_,i)=>`第${i+1}廳`));assert.ok(c.halls.every(h=>h.weeklyPrice===c.halls[0].weeklyPrice&&h.seats===null));}
  assert.equal(INITIAL_TAIWAN_CINEMAS.find(c=>c.id==='c-nangang').halls.length,25);
  assert.equal(INITIAL_TAIWAN_CINEMAS.find(c=>c.id==='c-tainan').halls[0].weeklyPrice,21000);
  assert.equal(INITIAL_TAIWAN_CINEMAS.find(c=>c.id==='c-kaohsiung-library').halls[0].weeklyPrice,11000);
});
test('升級舊本機資料保留委刊報價、庫存與容量，且只套用價目表一次',()=>{
  const db={cinemas:[{id:'c-xinyi',active:true,halls:[{id:'h-xy-1',name:'舊廳',dailyPrice:18000,capacity:8,bookedSlots:{'2026-11-01':3}}]},{id:'c-xinxin',active:true,halls:[]},{id:'custom',active:true,halls:[]}],orders:[{id:'old',totalAmount:108000,hallName:'舊廳'}]};
  const oldOrder=structuredClone(db.orders[0]);assert.equal(migrateCatalog(db),true);
  const c=db.cinemas.find(c=>c.id==='c-xinyi');assert.equal(c.halls.length,15);assert.equal(c.halls[0].name,'第1廳');assert.equal(c.halls[0].weeklyPrice,21000);assert.equal(c.halls[0].capacity,8);assert.equal(c.halls[0].bookedSlots['2026-11-01'],3);assert.deepEqual(db.orders[0],oldOrder);
  assert.equal(db.cinemas.find(c=>c.id==='c-xinxin').active,false);assert.equal(db.cinemas.find(c=>c.id==='custom').active,true);
  c.halls[0].weeklyPrice=22000;assert.equal(migrateCatalog(db),false);assert.equal(c.halls[0].weeklyPrice,22000);
});
