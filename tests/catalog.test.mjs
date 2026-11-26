import test from 'node:test';
import assert from 'node:assert/strict';
import {filterCinemas,emptyFilters,confirmFilters} from '../src/catalog.js';
import {INITIAL_TAIWAN_CINEMAS} from '../src/data/cinemas.js';
test('受眾複選採任一符合，並與縣市、行政區及文字搜尋共同篩選',()=>{
  const rows=filterCinemas(INITIAL_TAIWAN_CINEMAS,{city:'台北市',tags:['t3','t12']});
  assert.deepEqual(rows.map(c=>c.id),['c-miramar']);
  assert.deepEqual(filterCinemas(INITIAL_TAIWAN_CINEMAS,{city:'台北市',district:'信義區',tags:['t3']}),[]);
  assert.equal(filterCinemas(INITIAL_TAIWAN_CINEMAS,{tags:['t5'],search:'巨城'})[0].id,'c-hsinchu');
  assert.equal(filterCinemas(INITIAL_TAIWAN_CINEMAS).length,32);
});
test('指定影城與地區、受眾條件共同生效',()=>{
  assert.deepEqual(filterCinemas(INITIAL_TAIWAN_CINEMAS,{cinemaId:'c-hsinchu'}).map(c=>c.id),['c-hsinchu']);
  assert.equal(filterCinemas(INITIAL_TAIWAN_CINEMAS,{cinemaId:'c-hsinchu',city:'台北市'}).length,0);
});
test('確認條件為獨立快照，之後編輯日期與標籤不改變已套用結果',()=>{
  const draft={...emptyFilters('2026-10-16'),city:'台北市',tags:['t3']};
  const applied=confirmFilters(draft,'2026-10-16');
  draft.tags.push('t12');draft.startDate='2026-11-01';draft.city='新竹市';
  assert.deepEqual(applied.tags,['t3']);assert.equal(applied.startDate,'2026-10-16');assert.equal(applied.city,'台北市');
  assert.deepEqual(filterCinemas(INITIAL_TAIWAN_CINEMAS,applied).map(c=>c.id),['c-miramar']);
});
test('無效、過去、反向與超長日期不能套用；清除條件還原完整影城',()=>{
  for(const dates of [['2026-10-15','2026-10-16'],['2026-11-02','2026-11-01'],['2026-02-30','2026-11-01'],['2026-11-01','2027-11-01']])assert.throws(()=>confirmFilters({...emptyFilters('2026-10-16'),startDate:dates[0],endDate:dates[1]},'2026-10-16'));
  assert.equal(filterCinemas(INITIAL_TAIWAN_CINEMAS,emptyFilters('2026-10-16')).length,32);
});
