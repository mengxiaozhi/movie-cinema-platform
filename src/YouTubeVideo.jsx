import React,{useEffect,useRef,useState} from 'react';
import {parseYouTubeURL} from './homepage.js';

let apiPromise;
function loadYouTubeAPI(){
  if(window.YT?.Player)return Promise.resolve(window.YT);
  if(apiPromise)return apiPromise;
  apiPromise=new Promise((resolve,reject)=>{
    const previous=window.onYouTubeIframeAPIReady,script=document.createElement('script');
    const fail=()=>{clearTimeout(timeout);script.remove();apiPromise=undefined;reject(new Error('YouTube 播放器暫時無法載入。'));};
    const timeout=setTimeout(fail,20000);
    window.onYouTubeIframeAPIReady=()=>{clearTimeout(timeout);if(typeof previous==='function')previous();resolve(window.YT);};
    script.src='https://www.youtube.com/iframe_api';script.async=true;script.onerror=fail;
    document.body.appendChild(script);
  });
  return apiPromise;
}

export default function YouTubeVideo({slide,paused,muted,onEnded,onPlayback,onBlocked,onError}){
  const mount=useRef(null),player=useRef(null),ready=useRef(false),latest=useRef(null);
  const [blocked,setBlocked]=useState(false),[loaded,setLoaded]=useState(false);
  latest.current={paused,muted,onEnded,onPlayback,onBlocked,onError};
  const youtube=parseYouTubeURL(slide.url);
  useEffect(()=>{
    let disposed=false,started=false,instance;
    ready.current=false;setBlocked(false);setLoaded(false);
    const watchdog=setTimeout(()=>{if(!disposed&&!ready.current)latest.current.onError('YouTube 載入逾時，可開啟原影片或切換下一則。');},30000);
    loadYouTubeAPI().then(YT=>{
      if(disposed||!mount.current)return;
      const holder=document.createElement('div');mount.current.appendChild(holder);
      instance=new YT.Player(holder,{
        host:'https://www.youtube-nocookie.com',width:'100%',height:'100%',videoId:youtube.id,
        playerVars:{autoplay:0,controls:0,playsinline:1,enablejsapi:1,rel:0,origin:window.location.origin,start:youtube.start},
        events:{
          onReady:({target})=>{
            if(disposed)return;
            clearTimeout(watchdog);ready.current=true;setLoaded(true);
            if(latest.current.muted)target.mute();else target.unMute();
            if(!latest.current.paused)target.playVideo();
          },
          onStateChange:({data})=>{
            if(disposed)return;
            if(data===1){started=true;setBlocked(false);latest.current.onPlayback(true);}
            else if(data===2&&started)latest.current.onPlayback(false);
            else if(data===0&&!latest.current.paused)latest.current.onEnded();
          },
          onAutoplayBlocked:()=>{if(!disposed){setBlocked(true);latest.current.onBlocked();}},
          onError:({data})=>{
            if(disposed)return;
            clearTimeout(watchdog);
            latest.current.onError([101,150].includes(data)?'這支影片未開放嵌入，可前往 YouTube 觀看。':data===100?'這支影片目前無法觀看，可切換下一則。':'YouTube 暫時無法播放，可開啟原影片或切換下一則。');
          }
        }
      });
      player.current=instance;
      const iframe=instance.getIframe();
      iframe.title=`${slide.category?`${slide.category}｜`:''}${slide.title}`;
      iframe.referrerPolicy='strict-origin-when-cross-origin';
      iframe.allow='autoplay; encrypted-media; picture-in-picture';
      iframe.allowFullscreen=true;
    }).catch(()=>{if(!disposed){clearTimeout(watchdog);latest.current.onError('YouTube 播放器暫時無法載入，可開啟原影片或切換下一則。');}});
    return()=>{disposed=true;clearTimeout(watchdog);ready.current=false;player.current=null;instance?.destroy();};
  },[youtube?.id,youtube?.start]);
  useEffect(()=>{
    const current=player.current;if(!ready.current||!current)return;
    if(paused)current.pauseVideo();
    else{if(current.getPlayerState()===0)current.seekTo(youtube.start,true);current.playVideo();}
  },[paused,youtube?.start]);
  useEffect(()=>{if(ready.current&&player.current){if(muted)player.current.mute();else player.current.unMute();}},[muted]);
  return <div className="screen-video youtube-screen"><div ref={mount} className="youtube-player"/>{!loaded&&<span className="youtube-loading">正在載入 YouTube 影片…</span>}{blocked&&<span className="youtube-play-hint" role="status">請按輪播右下方的「繼續輪播」播放</span>}</div>;
}
