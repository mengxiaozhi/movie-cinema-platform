import React,{useEffect,useRef,useState} from 'react';
import {Play,Pause,VolumeX,Volume2,ChevronLeft,ChevronRight} from 'lucide-react';
import {Modal,Field} from './ui.jsx';
import {Tooltip} from './feedback.jsx';
import {useConfirm} from './Confirmation.jsx';
import {DEFAULT_HOME,validateHome,MAX_HOME_SLIDES,HOME_CATEGORIES} from './homepage.js';
import {saveHomeDraft,publishHome,loadHomeDraft} from './firebase.js';
import {useRevealMotion} from './motion.js';
import YouTubeVideo from './YouTubeVideo.jsx';
import './home-media.css';
export function Hero({content=DEFAULT_HOME,preview=false}){
  const slides=content.slides.filter(s=>s.enabled),[index,setIndex]=useState(0),[paused,setPaused]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches),[muted,setMuted]=useState(true),[failed,setFailed]=useState(''),video=useRef(null);
  const slide=slides[index%slides.length]||DEFAULT_HOME.slides[0];
  const contentKey=JSON.stringify(content.slides.map(s=>[s.id,s.type,s.url,s.title,s.seconds,s.enabled,s.category||'',!!s.builtin,s.credit||'']));
  const frame=useRef(null);
  useRevealMotion(frame,{kind:'media',selector:'.screen-video',revision:`${slide.id}:${slide.url}:${failed}`,skipInitial:true});
  const change=delta=>{setIndex(i=>(i+delta+slides.length)%slides.length);setFailed('');};
  useEffect(()=>{setIndex(0);setFailed('');},[contentKey]);
  useEffect(()=>{if(paused||(slide.type==='youtube'&&!failed))return;const timer=setTimeout(()=>{setIndex(i=>(i+1)%slides.length);setFailed('');},failed?8000:slide.seconds*1000);return()=>clearTimeout(timer);},[slide,index,paused,slides.length,failed]);
  useEffect(()=>{const v=video.current;if(v){if(paused)v.pause();else v.play().catch(()=>setPaused(true));}},[slide,paused]);
  return <section ref={frame} className={`hero home-carousel ${slide.type==='youtube'?'has-youtube':''} ${preview?'home-preview':''}`} aria-roledescription="輪播" aria-label="首頁圖片與影片輪播">
    <div className="hero-film">
      <div className="hero-slide-meta"><span className="hero-category">{slide.category||'首頁精選'}</span><span className="hero-media-title">{slide.title}</span></div>
      <div className="cinema-scene">
        <img className="theater-backdrop" src="/media/theater-premium.png" alt="暖光木質影廳" width="1983" height="793" fetchPriority={preview?undefined:'high'} decoding="async"/>
        {!slide.builtin&&!failed&&(slide.type==='youtube'?<YouTubeVideo key={slide.id+slide.url} slide={slide} paused={paused} muted={muted} onEnded={()=>change(1)} onPlayback={playing=>setPaused(!playing)} onBlocked={()=>setPaused(true)} onError={setFailed}/>:slide.type==='video'?<video key={slide.id+slide.url} ref={video} className="screen-video" src={slide.url} muted={muted} playsInline preload="metadata" onEnded={()=>{if(!paused)change(1);}} onError={()=>setFailed('素材無法播放，請確認素材網址。')} aria-label={slide.title}/>:<img className="screen-video" src={slide.url} alt={slide.title} onError={()=>setFailed('素材無法顯示，請確認素材網址。')}/>)}
        {failed&&slide.type==='youtube'&&<div className="screen-video youtube-screen youtube-fallback"><p role="status">{failed}</p><a href={slide.url} target="_blank" rel="noopener noreferrer">在 YouTube 觀看「{slide.title}」</a></div>}
      </div>
      {failed&&slide.type!=='youtube'&&<span className="media-error" role="status">{failed}</span>}
      {slides.length>1&&<><button className="carousel-arrow previous" onClick={()=>change(-1)} aria-label="上一則素材"><ChevronLeft/></button><button className="carousel-arrow next" onClick={()=>change(1)} aria-label="下一則素材"><ChevronRight/></button></>}
      <div className="film-controls"><Tooltip text={paused?'繼續播放首頁素材':'暫停自動播放與輪播'}><button onClick={()=>setPaused(v=>!v)} aria-label={paused?'繼續輪播':'暫停輪播'}>{paused?<Play size={18}/>:<Pause size={18}/>}</button></Tooltip>{['video','youtube'].includes(slide.type)&&<Tooltip text={muted?'目前為靜音，按一下開啟聲音':'按一下將影片靜音'}><button onClick={()=>setMuted(v=>!v)} aria-label={muted?'開啟影片聲音':'關閉影片聲音'}>{muted?<VolumeX size={18}/>:<Volume2 size={18}/>}</button></Tooltip>}</div>
      {slide.credit&&<span className="film-credit">{slide.credit}</span>}
      <div className="carousel-dots">{slides.map((s,i)=><button key={s.id} aria-label={`切換至${s.title}`} aria-pressed={index%slides.length===i} onClick={()=>{setIndex(i);setFailed('');}}/>)}</div>
    </div>
  </section>;
}
export function HomepageAdmin({content,run,busy,notify}){
  const confirmAction=useConfirm();
  const [draft,setDraft]=useState(()=>structuredClone(content)),[preview,setPreview]=useState(false),[loaded,setLoaded]=useState(false);
  useEffect(()=>{let alive=true;loadHomeDraft().then(d=>{if(alive&&d)setDraft(d);}).catch(e=>notify(`讀取草稿失敗：${e.message}`,true)).finally(()=>{if(alive)setLoaded(true);});return()=>{alive=false;};},[]);
  const edit=(id,key,value)=>setDraft(d=>({...d,slides:d.slides.map(s=>s.id===id?{...s,[key]:value,...(key==='url'?{builtin:false}:{})}:s)}));
  const move=(i,delta)=>setDraft(d=>{const slides=[...d.slides];[slides[i],slides[i+delta]]=[slides[i+delta],slides[i]];return {...d,slides};});
  const removeSlide=async(slide,trigger)=>{if(await confirmAction({title:'刪除這則輪播素材？',description:`「${slide.title}」將從目前草稿移除，儲存或發布後才影響已保存內容。`,confirmLabel:'刪除素材',danger:true},trigger))setDraft(d=>({...d,slides:d.slides.filter(v=>v.id!==slide.id)}));};
  const save=async publish=>{
    let valid;try{valid=validateHome(draft);}catch(e){notify(e.message,true);return;}
    if(publish&&!await confirmAction({kind:'modal',title:'發布首頁內容？',description:`即將公開 ${valid.slides.filter(s=>s.enabled).length} 則啟用素材，所有訪客重新開啟首頁後會看到更新。`,confirmLabel:'確認發布'}))return;
    return run(async()=>{if(publish){await publishHome(valid);notify('首頁內容已發布，所有訪客重新開啟即可看到。');}else{await saveHomeDraft(valid);notify('草稿已儲存，尚未更動公開首頁。');}});
  };

  return <section className="home-admin panel wide"><h2>首頁內容管理</h2><p>素材只會出現在中央銀幕，影廳外框會保留。支援 HTTPS 圖片、MP4／WebM 直連網址及 YouTube 影片，最多 16 則。YouTube 影片播畢後接續下一則，無須下載或上傳影片。</p><p className="fine">草稿僅最高管理員可讀取，發布後才會公開。影片檔案需先放在可公開存取的主機，目前不提供影片上傳。</p>{draft.slides.map((s,i)=><article className="home-slide-editor" key={s.id}><div className="section-heading"><h3>素材 {i+1}</h3><div className="actions"><button disabled={busy||i===0} onClick={()=>move(i,-1)}>上移</button><button disabled={busy||i===draft.slides.length-1} onClick={()=>move(i,1)}>下移</button><button disabled={busy||draft.slides.length===1} onClick={e=>removeSlide(s,e.currentTarget)}>刪除</button></div></div><div className="form-grid"><label className="field"><span>素材名稱</span><input maxLength={100} value={s.title} onChange={e=>edit(s.id,'title',e.target.value)}/></label><Field label="類型"><select value={s.type} onChange={e=>edit(s.id,'type',e.target.value)}><option value="image">圖片</option><option value="video">影片直連</option><option value="youtube">YouTube</option></select></Field><Field label="分類"><select value={s.category||''} onChange={e=>edit(s.id,'category',e.target.value)}><option value="">首頁精選</option>{HOME_CATEGORIES.map(category=><option key={category}>{category}</option>)}</select></Field><label className="field"><span>素材網址</span><input value={s.url} onChange={e=>edit(s.id,'url',e.target.value)}/></label>{s.type==='youtube'?<div className="field"><span>播放方式</span><p className="fine">完整播放，播畢接續下一則。</p></div>:<label className="field"><span>播放秒數（3–120 秒）</span><input type="number" min="3" max="120" value={s.seconds} onChange={e=>edit(s.id,'seconds',Number(e.target.value))}/></label>}<label className="field"><span>授權標示（選填）</span><input maxLength={200} value={s.credit||''} onChange={e=>edit(s.id,'credit',e.target.value)}/></label><label className="check"><input type="checkbox" checked={s.enabled} onChange={e=>edit(s.id,'enabled',e.target.checked)}/>啟用這則素材</label></div></article>)}<div className="actions"><button disabled={busy||!loaded||draft.slides.length>=MAX_HOME_SLIDES} onClick={()=>setDraft(d=>({...d,slides:[...d.slides,{id:crypto.randomUUID(),title:'新素材',type:'image',url:'',seconds:8,enabled:true}]}))}>＋ 新增素材</button><button disabled={busy||!loaded} onClick={()=>{try{validateHome(draft);setPreview(true);}catch(e){notify(e.message,true);}}}>預覽</button><button disabled={busy||!loaded} onClick={()=>save(false)}>儲存草稿</button><button className="primary" disabled={busy||!loaded} onClick={()=>save(true)}>發布首頁</button></div>{preview&&<Modal title="首頁預覽" className="home-preview-modal" close={()=>setPreview(false)}><Hero content={draft} preview/></Modal>}</section>;
}
