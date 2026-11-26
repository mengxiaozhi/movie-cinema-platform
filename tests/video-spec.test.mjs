import test from 'node:test';
import assert from 'node:assert/strict';
import {validateVideoSpec,MAX_VIDEO_BYTES,videoSeconds} from '../src/video-spec.js';
const base={duration:29.96,width:1920,height:1080,size:10000,type:'video/mp4'};
test('影片片長無30秒上限，仍須為可辨識的有限正數',()=>{
  for(const duration of [29.96,29.999,30,30.001,60,120,3600])assert.equal(validateVideoSpec({...base,duration}).duration,duration);
  for(const duration of [0,-1,NaN,Infinity])assert.throws(()=>validateVideoSpec({...base,duration}));
  assert.equal(videoSeconds(30),'30 秒');assert.equal(videoSeconds(60),'60 秒');
  assert.equal(videoSeconds(29.9999999),'30 秒');
});
test('拒絕缺失規格、不正確解析度、超大或不支援檔案',()=>{
  assert.throws(()=>validateVideoSpec(null));
  for(const change of [{width:0},{height:0},{width:1.5},{size:0},{size:MAX_VIDEO_BYTES+1},{type:'text/html'}])assert.throws(()=>validateVideoSpec({...base,...change}));
  assert.equal(validateVideoSpec({...base,size:MAX_VIDEO_BYTES}).size,MAX_VIDEO_BYTES);
});
