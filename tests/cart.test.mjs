import test from 'node:test';import assert from 'node:assert/strict';
import {cartItem,addUniqueItems,updateQuantity,cinemaSelection,sameRange} from '../src/cart.js';
import {INITIAL_TAIWAN_CINEMAS} from '../src/data/cinemas.js';
const cinema=INITIAL_TAIWAN_CINEMAS[0],range={startDate:'2026-11-01',endDate:'2026-11-07'};
test('影城全選一次加入全廳各1檔；再次全選不重複也不覆寫已調整檔數',()=>{
  const items=cinema.halls.map(h=>cartItem(cinema,h,range,12));
  let cart=addUniqueItems([],items);assert.equal(cart.length,15);assert.ok(cart.every(i=>i.slotsCount===1&&i.totalAmount===21000));
  cart=updateQuantity(cart,cart[0].cartId,3);cart=addUniqueItems(cart,items);
  assert.equal(cart.length,15);assert.equal(cart[0].slotsCount,3);assert.equal(cart[0].totalAmount,63000);assert.equal(cinemaSelection(cart,cinema,range).full,true);
});
test('逐廳取消會變為部分選取；全選補齊，其他日期的選擇保持獨立',()=>{
  const items=cinema.halls.map(h=>cartItem(cinema,h,range,12)),later={startDate:'2026-11-08',endDate:'2026-11-14'};
  let cart=addUniqueItems([],items);cart=cart.slice(1);assert.equal(cinemaSelection(cart,cinema,range).partial,true);assert.equal(cinemaSelection(cart,cinema,range).count,14);
  cart=addUniqueItems(cart,items);assert.equal(cart.length,15);cart=addUniqueItems(cart,cinema.halls.map(h=>cartItem(cinema,h,later,12)));assert.equal(cart.length,30);
  const remaining=cart.filter(i=>!sameRange(i,range));assert.equal(remaining.length,15);assert.equal(cinemaSelection(remaining,cinema,range).count,0);assert.equal(cinemaSelection(remaining,cinema,later).full,true);
});
test('購物車增減依週價更新總額，拒絕零檔及超過可用檔數',()=>{
  const period={startDate:'2026-11-01',endDate:'2026-11-14'};let cart=addUniqueItems([],[cartItem(cinema,cinema.halls[0],period,3)]),id=cart[0].cartId;
  assert.equal(cart[0].totalAmount,42000);cart=updateQuantity(cart,id,3);assert.equal(cart[0].totalAmount,126000);cart=updateQuantity(cart,id,1);assert.equal(cart[0].totalAmount,42000);
  for(const n of [0,-1,4,1.5])assert.throws(()=>updateQuantity(cart,id,n));assert.equal(cart[0].slotsCount,1);
});
test('全台333廳可批次加入；同影廳不同日期保留不同筆，相同日期不重複',()=>{
  const items=INITIAL_TAIWAN_CINEMAS.flatMap(c=>c.halls.map(h=>cartItem(c,h,range,12)));
  const cart=addUniqueItems([],items);assert.equal(cart.length,333);assert.equal(addUniqueItems(cart,items).length,333);
});
