import {INITIAL_TAIWAN_CINEMAS as LEGACY} from './legacy-cinemas.js';
import {PRICE_LIST} from './price-list.js';
export const INITIAL_TAIWAN_CINEMAS=PRICE_LIST.map(([id,name,city,count,weeklyPrice])=>{
  const old=LEGACY.find(c=>c.id===id);
  return {id,name,city,district:old?.district||'',address:old?.address||'地址待補',lat:old?.lat??null,lng:old?.lng??null,tagIds:old?.tagIds||[],description:'',halls:Array.from({length:count},(_,i)=>({id:old?.halls[i]?.id||id+'-hall-'+(i+1),name:'第'+(i+1)+'廳',screenType:'放映規格待確認',seats:null,weeklyPrice,bookedSlots:{}}))};
});
