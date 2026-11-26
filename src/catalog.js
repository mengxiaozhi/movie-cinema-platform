import {wholeWeeks} from './weekly-pricing.js';
export function filterCinemas(cinemas,{city='',district='',cinemaId='',search='',tags=[]}={}){
  return cinemas.filter(c=>(!city||c.city===city)&&(!district||c.district===district)&&(!cinemaId||c.id===cinemaId)&&(!search.trim()||`${c.name}${c.address}${c.description}`.includes(search.trim()))&&(!tags.length||tags.some(t=>c.tagIds?.includes(t))));
}
export const addDays=(day,n)=>new Date(Date.parse(day)+n*86400000).toISOString().slice(0,10);
export const emptyFilters=(day)=>({city:'',district:'',cinemaId:'',startDate:day,endDate:addDays(day,6),tags:[]});
export function confirmFilters(draft,today,maxDays=90){
  const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
  if(!valid(draft.startDate)||!valid(draft.endDate)||draft.startDate<today||draft.endDate<draft.startDate)throw new Error('請選擇有效的投放日期，結束日不可早於開始日。');
  const days=(Date.parse(draft.endDate)-Date.parse(draft.startDate))/86400000+1;
  wholeWeeks(days);
  if(days>maxDays)throw new Error(`每筆投放期間最多 ${maxDays} 天。`);
  return {...draft,tags:[...draft.tags]};
}
