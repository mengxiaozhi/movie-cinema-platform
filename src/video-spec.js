export const MAX_VIDEO_BYTES=500*1024*1024;
export function validateVideoSpec(spec){
  if(!spec||!Number.isFinite(spec.duration)||spec.duration<=0||!Number.isInteger(spec.width)||spec.width<1||!Number.isInteger(spec.height)||spec.height<1)throw new Error('無法確認影片片長或解析度，請重新選擇可辨識的影片。');
  if(!Number.isSafeInteger(spec.size)||spec.size<1||spec.size>MAX_VIDEO_BYTES)throw new Error('影片大小須為 500 MB 以下。');
  if(!['video/mp4','video/quicktime'].includes(spec.type))throw new Error('請選擇 MP4 或 MOV 影片。');
  return {duration:spec.duration,width:spec.width,height:spec.height,size:spec.size,type:spec.type};
}
export function readVideoSpec(file){
  return new Promise((resolve,reject)=>{
    const video=document.createElement('video'),url=URL.createObjectURL(file);
    const finish=(error)=>{clearTimeout(timer);video.onloadedmetadata=null;video.onerror=null;const result={duration:video.duration,width:video.videoWidth,height:video.videoHeight,size:file.size,type:file.type};video.removeAttribute('src');video.load();URL.revokeObjectURL(url);error?reject(error):resolve(result);};
    const timer=setTimeout(()=>finish(new Error('讀取影片逾時，請更換影片或確認檔案完整。')),15000);
    video.preload='metadata';video.muted=true;
    video.onloadedmetadata=()=>finish();video.onerror=()=>finish(new Error('瀏覽器無法讀取這支影片，請改用可播放的 MP4 或 MOV。'));
    video.src=url;
  });
}
export const videoSeconds=n=>Number.isFinite(n)?`${Number(n.toFixed(6))} 秒`:'未讀取';
export const videoSize=n=>Number.isFinite(n)?`${(n/1024/1024).toFixed(2)} MB`:'未讀取';
