import test from 'node:test';
import assert from 'node:assert/strict';
import {bookingDates,calculatePrice,reserve,release,editHall,requireRole,canBootstrap} from '../functions/domain.js';
test('日期包含首尾，拒絕過去日期、無效日期、反向日期及超長檔期',()=>{
  assert.deepEqual(bookingDates('2026-11-01','2026-11-03',90,'2026-10-15'),['2026-11-01','2026-11-02','2026-11-03']);
  for(const [s,e] of [['2026-10-14','2026-10-15'],['2026-02-30','2026-03-01'],['2026-11-03','2026-11-01'],['bad','2026-11-01'],['2026-11-01','2027-11-01']])assert.throws(()=>bookingDates(s,e,90,'2026-10-15'));
});
test('報價使用伺服器價格，拒絕零價、負數、浮點數與溢位',()=>{
  assert.equal(calculatePrice(10000,2,3),60000);
  for(const args of [[null,1,1],[0,1,1],[-1,1,1],[10000,1.2,1],[Number.MAX_SAFE_INTEGER,120,90]])assert.throws(()=>calculatePrice(...args));
});
test('核准必須檢查每一天，不只檢查開始日，且不修改原資料',()=>{
  const hall={name:'一廳',bookedSlots:{'2026-11-01':2,'2026-11-02':11}};
  assert.throws(()=>reserve(hall,['2026-11-01','2026-11-02'],2,12),/2026-11-02/);
  assert.equal(hall.bookedSlots['2026-11-01'],2);
  assert.equal(reserve(hall,['2026-11-01'],10,12).bookedSlots['2026-11-01'],12);
});
test('自訂影廳容量優先，調低容量不接受新核准，取消正確釋出',()=>{
  const h={name:'一廳',capacity:16,bookedSlots:{'2026-11-01':12}};
  assert.equal(reserve(h,['2026-11-01'],4,12).bookedSlots['2026-11-01'],16);
  assert.throws(()=>reserve({...h,capacity:10},['2026-11-01'],1,12));
  assert.equal(release(h,['2026-11-01'],2).bookedSlots['2026-11-01'],10);
});
test('影城管理員可改影廳資料，但不能透過額外欄位修改價格與容量',()=>{
  const h={id:'hall1',dailyPrice:10000,capacity:12,bookedSlots:{'2026-11-01':8}};
  const edited=editHall(h,{name:'新名稱'},'cinema_manager');assert.equal(edited.dailyPrice,10000);assert.equal(edited.capacity,12);assert.equal(edited.bookedSlots['2026-11-01'],8);
  assert.throws(()=>editHall(h,{dailyPrice:1},'cinema_manager'),/最高管理員/);
  assert.throws(()=>editHall(h,{capacity:100},'cinema_manager'),/最高管理員/);
  assert.equal(editHall(null,{name:'新廳'},'cinema_manager').dailyPrice,null);
  assert.equal(editHall(h,{dailyPrice:18000},'super_admin').dailyPrice,18000);
  assert.throws(()=>editHall(h,{name:'x'},'reviewer'));
});
test('審核與管理權限互斥，前端角色值不能授權',()=>{
  assert.throws(()=>requireRole('cinema_manager',['super_admin','reviewer']));
  assert.throws(()=>requireRole('reviewer',['super_admin','cinema_manager']));
  assert.throws(()=>requireRole('buyer',['super_admin']));
});
test('首次最高管理員僅能由指定、已驗證的 Google 帳號取得，且只能啟用一次',()=>{
  const v={email:'owner@example.com',email_verified:true,firebase:{sign_in_provider:'google.com'}};
  assert.equal(canBootstrap(v,'owner@example.com',false),true);
  assert.equal(canBootstrap(v,'owner@example.com',true),false);
  assert.equal(canBootstrap({...v,email_verified:false},'owner@example.com',false),false);
  assert.equal(canBootstrap({...v,firebase:{sign_in_provider:'custom'}},'owner@example.com',false),false);
  assert.equal(canBootstrap(v,'other@example.com',false),false);
});
