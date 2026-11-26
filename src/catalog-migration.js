import {INITIAL_TAIWAN_CINEMAS} from './data/cinemas.js';
import {CATALOG_VERSION} from './data/price-list.js';
import {INITIAL_TAIWAN_CINEMAS as LEGACY} from './data/legacy-cinemas.js';
export function migrateCatalog(db){
  if(db.catalogVersion===CATALOG_VERSION)return false;
  const sourceIds=new Set(INITIAL_TAIWAN_CINEMAS.map(c=>c.id));
  const oldById=new Map(db.cinemas.map(c=>[c.id,c]));
  db.cinemas=INITIAL_TAIWAN_CINEMAS.map(c=>{
    const old=oldById.get(c.id),byHall=new Map(old?.halls?.map(h=>[h.id,h])||[]);
    return {...c,active:old?.active??true,halls:c.halls.map(h=>({...h,active:byHall.get(h.id)?.active??true,capacity:byHall.get(h.id)?.capacity??null,bookedSlots:byHall.get(h.id)?.bookedSlots??{}})),...(old?.lat!=null?{lat:old.lat,lng:old.lng,address:old.address,district:old.district}:{})};
  });
  // Preserve non-listed venues and hall identifiers for historical orders, without selling old demo prices.
  for(const old of oldById.values())if(!sourceIds.has(old.id))db.cinemas.push({...old,active:LEGACY.some(c=>c.id===old.id)?false:old.active});
  for(const c of db.cinemas){const old=oldById.get(c.id);for(const h of old?.halls||[])if(!c.halls.some(v=>v.id===h.id))c.halls.push({...h,active:false});}
  db.catalogVersion=CATALOG_VERSION;return true;
}
