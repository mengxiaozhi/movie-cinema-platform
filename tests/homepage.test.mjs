import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_HOME,validateHome,mediaURL,parseYouTubeURL,upgradeHome,MAX_HOME_SLIDES} from '../src/homepage.js';
const image=DEFAULT_HOME.slides.find(s=>s.type==='image');
test('首頁素材只接受 HTTPS 或本站媒體，阻擋可執行與不安全網址',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,x','http://example.com/v.mp4','/media/../config','//example.com/v.mp4'])assert.equal(mediaURL(url),false);
  assert.ok(mediaURL('https://example.com/v.mp4'));assert.ok(mediaURL('/media/hero-h264.mp4'));
});
test('首頁發布驗證數量、啟用狀態、重複識別碼與秒數',()=>{
  assert.deepEqual(validateHome(DEFAULT_HOME),DEFAULT_HOME);
  assert.throws(()=>validateHome({slides:[]}));assert.throws(()=>validateHome({slides:DEFAULT_HOME.slides.map(s=>({...s,enabled:false}))}));
  assert.throws(()=>validateHome({slides:[DEFAULT_HOME.slides[0],DEFAULT_HOME.slides[0]]}));
  for(const seconds of [0,2,121,3.5])assert.throws(()=>validateHome({slides:[{...image,seconds}]}));
});
test('發布產生獨立資料並移除未知欄位與假冒內建素材標記',()=>{
  const input={slides:[{...image,url:'https://example.com/x.jpg',unknown:'x'}]};
  const clean=validateHome(input);assert.equal(clean.slides[0].builtin,undefined);assert.equal(clean.slides[0].unknown,undefined);
  input.slides[0].title='changed';assert.notEqual(clean.slides[0].title,'changed');
});
test('十支 YouTube 影片依提供順序交錯分類，並保留原本兩則素材',()=>{
  const slides=validateHome(DEFAULT_HOME).slides;
  assert.deepEqual(slides.slice(0,10).map(s=>parseYouTubeURL(s.url).id),['nu1nZjItHHw','qBCCrx_OTuY','Ixu7w6mTvvk','xtNnw3rjyx8','yKoD02D_8mI','90vBGUGNaO8','Upn2ejyAvnM','ibiYoDKaKYY','f6Y2SgaHyCw','_oE3CtTO3sw']);
  assert.deepEqual(slides.slice(0,10).map(s=>s.category),Array.from({length:10},(_,i)=>i%2?'商業客戶':'電影預告'));
  assert.deepEqual(slides.slice(10).map(s=>s.id),['lake','film']);
  assert.equal(parseYouTubeURL(slides[2].url).start,1);
});
test('YouTube 只接受明確主機及影片識別碼，時間戳記正規化後保存',()=>{
  for(const url of ['https://youtu.be/nu1nZjItHHw?t=1m2s','https://www.youtube.com/embed/nu1nZjItHHw?start=62','https://m.youtube.com/shorts/nu1nZjItHHw?t=62'])assert.deepEqual(parseYouTubeURL(url),{id:'nu1nZjItHHw',start:62,url:'https://www.youtube.com/watch?v=nu1nZjItHHw&t=62s'});
  for(const url of ['https://www.youtube.com.evil.example/watch?v=nu1nZjItHHw','https://evil.example/watch?v=nu1nZjItHHw','javascript:alert(1)','http://youtube.com/watch?v=nu1nZjItHHw','https://youtube.com/watch?v=bad','https://youtube.com/watch?v=nu1nZjItHHw&t=-1','https://user:password@youtube.com/watch?v=nu1nZjItHHw']){
    assert.equal(parseYouTubeURL(url),null);
    assert.throws(()=>validateHome({slides:[{...DEFAULT_HOME.slides[0],url}]}));
  }
  assert.throws(()=>validateHome({slides:[{...DEFAULT_HOME.slides[0],category:'其他客戶'}]}));
});
test('只升級已知舊首頁，升級為新版本後刪除的素材不會重加',()=>{
  const legacy={slides:DEFAULT_HOME.slides.slice(10)};
  assert.deepEqual(upgradeHome(legacy),DEFAULT_HOME);
  assert.deepEqual(legacy.slides.map(s=>s.id),['lake','film']);
  const removed={schemaVersion:2,slides:[...legacy.slides]};
  assert.deepEqual(upgradeHome(removed),removed);
  const custom={slides:[{...image,id:'custom'}]};assert.deepEqual(upgradeHome(custom),custom);
  assert.throws(()=>validateHome({schemaVersion:3,slides:[image]}));
});
test('新增素材上限為16則，超過即拒絕',()=>{
  const slides=Array.from({length:MAX_HOME_SLIDES},(_,i)=>({...image,id:`slide-${i}`}));
  assert.equal(validateHome({slides}).slides.length,16);
  assert.throws(()=>validateHome({slides:[...slides,{...image,id:'extra'}]}),/1–16/);
});
