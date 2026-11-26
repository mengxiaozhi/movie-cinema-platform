import {weeklyTotal} from './weekly-pricing.js';
export const MAX_CART_ITEMS=1000;
export const sameRange=(item,range)=>item.startDate===range.startDate&&item.endDate===range.endDate;
export const itemKey=i=>JSON.stringify([i.cinemaId,i.hallId,i.startDate,i.endDate]);
export function addUniqueItems(cart,items){
  const next=[...cart],keys=new Set(cart.map(itemKey));
  for(const item of items){const key=itemKey(item);if(keys.has(key))continue;keys.add(key);next.push({...item,cartId:crypto.randomUUID()});}
  if(next.length>MAX_CART_ITEMS)throw new Error(`每次最多選購 ${MAX_CART_ITEMS} 筆影廳。`);
  return next;
}
export function cartItem(cinema,hall,range,remaining=hall.capacity??12){
  if(remaining<1)throw new Error('這個檔期已滿，請選擇其他影廳或日期。');
  const days=(Date.parse(range.endDate)-Date.parse(range.startDate))/86400000+1;
  return {cinemaId:cinema.id,cinemaName:cinema.name,hallId:hall.id,hallName:hall.name,...range,weeklyPrice:hall.weeklyPrice,maxSlots:remaining,slotsCount:1,totalAmount:weeklyTotal(hall.weeklyPrice,1,days)};
}
export function updateQuantity(cart,id,quantity){
  return cart.map(item=>{
    if(item.cartId!==id)return item;
    if(!Number.isInteger(quantity)||quantity<1||quantity>item.maxSlots)throw new Error(`檔數須為 1–${item.maxSlots} 檔。`);
    const days=(Date.parse(item.endDate)-Date.parse(item.startDate))/86400000+1;
    return {...item,slotsCount:quantity,totalAmount:weeklyTotal(item.weeklyPrice,quantity,days)};
  });
}
export function cinemaSelection(cart,cinema,range){
  const selected=cinema.halls.filter(h=>cart.some(i=>i.cinemaId===cinema.id&&i.hallId===h.id&&sameRange(i,range))).length;
  return {count:selected,total:cinema.halls.length,full:cinema.halls.length>0&&selected===cinema.halls.length,partial:selected>0&&selected<cinema.halls.length};
}
