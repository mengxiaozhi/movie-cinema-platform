import {Introduction} from './Introduction.jsx';
import React,{lazy,Suspense,useEffect,useId,useRef,useState} from 'react';
import {MapPin,Film,Plus,ArrowRight,ShoppingCart,Info,CalendarDays,UsersRound,ChevronDown,X} from 'lucide-react';
import {api} from './firebase.js';
import {AVAILABLE_TAGS} from './data/tags.js';
import {filterCinemas,emptyFilters,confirmFilters,addDays} from './catalog.js';
import {cartItem,cinemaSelection,sameRange} from './cart.js';
import {previewWeeklyTotal} from './weekly-pricing.js';
import {Field,Empty,SelectionCheck,money,today} from './ui.jsx';
import {located} from './map-markers.js';
const CinemaMap=lazy(()=>import('./CinemaMap.jsx'));
import AudiencePicker from './AudiencePicker.jsx';
import {Alert,Tooltip} from './feedback.jsx';
import {Hero as HomeHero} from './HomeContent.jsx';
import {useRevealMotion} from './motion.js';

export default function Catalog({home,connectionNotice,cinemas,config,cart,onAdd,onRemove,onRemoveCinema,onClearRange,openCart,notify}){
  const page=useRef(null);
  useRevealMotion(page,{selector:'.location-filter-panel, .discovery-stage > .hero, .catalog-results > search',stagger:.04});
  const [intro,setIntro]=useState(null),[tagLibrary,setTagLibrary]=useState(AVAILABLE_TAGS);
  useEffect(()=>{api('/tags').then(d=>setTagLibrary(d.tags.filter(t=>t.active))).catch(e=>notify(e.message,true));},[cinemas]);
  const detail=useRef(null),cinemaList=useRef(null),tagTrigger=useRef(null),tagWasOpen=useRef(false),filterForm=useId(),dateErrorId=useId(),startInputId=useId(),endInputId=useId(),audienceInputId=useId(),cinemaListTitle=useId(),hallDetailId=useId(),hallTitleId=useId();
  const motion=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
  const [mode,setMode]=useState('list'),[booking,setBooking]=useState(false),[focus,setFocus]=useState(''),[cinemaId,setCinemaId]=useState('');
  const [filters,setFilters]=useState(()=>emptyFilters(today())),[validDates,setValidDates]=useState(()=>{const d=emptyFilters(today());return {startDate:d.startDate,endDate:d.endDate};});
  const {city,district,cinemaId:draftCinema,startDate:start,endDate:end,tags}=filters;
  const applied={...filters,...validDates};
  const [tagOpen,setTagOpen]=useState(false),[error,setError]=useState(''),[dateError,setDateError]=useState(''),[detailRevision,setDetailRevision]=useState(0);
  useEffect(()=>{
    if(tagWasOpen.current&&!tagOpen)tagTrigger.current?.focus({preventScroll:true});
    tagWasOpen.current=tagOpen;
  },[tagOpen]);
  const [availability,setAvailability]=useState({}),[ready,setReady]=useState(false);
  const range=validDates,days=(Date.parse(range.endDate)-Date.parse(range.startDate))/86400000+1;
  useEffect(()=>{let active=true;setReady(false);setError('');api(`/availability?${new URLSearchParams(range)}`).then(d=>{if(active){setAvailability(Object.fromEntries(d.halls.map(h=>[`${h.cinemaId}/${h.hallId}`,h])));setReady(true);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[cinemas,range.startDate,range.endDate]);
  useEffect(()=>{if(!detailRevision)return;const action=detail.current?.querySelector('.hall-action');detail.current?.querySelector('article')?.focus({preventScroll:true});action?.scrollIntoView({behavior:motion(),block:'center'});},[detailRevision]);
  const list=filterCinemas(cinemas,applied),choices=filterCinemas(cinemas,{city,district});
  const cities=[...new Set(cinemas.map(c=>c.city))],districts=[...new Set(cinemas.filter(c=>!city||c.city===city).map(c=>c.district).filter(Boolean))];
  const state=c=>cinemaSelection(cart,c,range),pickedCinemas=cinemas.filter(c=>state(c).count>0),fullIds=pickedCinemas.filter(c=>state(c).full).map(c=>c.id);
  const bookingList=booking?pickedCinemas:list,selected=bookingList.find(c=>c.id===cinemaId)||bookingList[0];
  useEffect(()=>{
    const scroller=cinemaList.current,current=scroller?.querySelector('[aria-pressed="true"]');
    if(!scroller||!current)return;
    const viewport=scroller.getBoundingClientRect(),item=current.closest('.cinema-choice').getBoundingClientRect();
    if(item.top<viewport.top)scroller.scrollTop+=item.top-viewport.top-12;
    else if(item.bottom>viewport.bottom)scroller.scrollTop+=item.bottom-viewport.bottom+12;
  },[selected?.id,mode,booking]);
  const dirty=start!==range.startDate||end!==range.endDate;
  const selectedTags=tags.map(id=>({id,name:tagLibrary.find(t=>t.id===id)?.name||id}));
  const tagSummary=selectedTags.length?selectedTags.map(t=>t.name).join('、'):'不限受眾';
  const updateFilters=patch=>{
    const next={...filters,...patch};
    setFilters(next);if('startDate' in patch||'endDate' in patch)setDateError('');setBooking(false);setCinemaId('');
    try{
      const valid=confirmFilters(next,today(),config?.settings.maxBookingDays??90);
      setDateError('');
      if(valid.startDate!==range.startDate||valid.endDate!==range.endDate){setReady(false);setValidDates({startDate:valid.startDate,endDate:valid.endDate});}
    }catch{/* Keep the last valid dates while the user is editing. Report errors on blur. */}
  };
  const validateDates=()=>{try{confirmFilters(filters,today(),config?.settings.maxBookingDays??90);setDateError('');}catch(e){setDateError(e.message);}};
  const stock=(c,h)=>availability[`${c.id}/${h.id}`];
  const itemsFor=c=>c.halls.filter(h=>(stock(c,h)?.remaining??0)>0&&previewWeeklyTotal(h.weeklyPrice,1,days)!==null).map(h=>cartItem(c,h,range,stock(c,h).remaining));
  const addCinemas=ids=>{if(!ready||dirty)return;const chosen=cinemas.filter(c=>ids.includes(c.id)),items=chosen.flatMap(itemsFor);if(!items.length){notify('這個檔期沒有可加入的影廳（可能已滿或尚未定價）。',true);return;}onAdd(items);const skipped=chosen.reduce((n,c)=>n+c.halls.length,0)-items.length;if(skipped)notify(`已加入可選影廳，另有 ${skipped} 廳已滿或尚未定價。`);};
  const toggle=(id,want,trigger)=>{const c=cinemas.find(c=>c.id===id);if(!c)return;const add=want??!state(c).full;if(add)addCinemas([id]);else onRemoveCinema(id,range,trigger);};
  const clear=()=>updateFilters(emptyFilters(today()));
  const showHalls=id=>{setCinemaId(id);setBooking(true);setDetailRevision(v=>v+1);};
  const selectControl=c=>{const s=state(c);return <><label className="cinema-choice-check"><SelectionCheck state={s} aria-label={`全選${c.name}的影廳`} disabled={!c.halls.length||((!ready||dirty)&&!s.full)} onChange={e=>toggle(c.id,e.target.checked,e.currentTarget)}/><span>{s.full?'已選全部影廳':s.partial?`已選 ${s.count}/${s.total} 廳`:'全選本影城影廳'}</span></label>{s.partial&&<button className="cancel-cinema" onClick={e=>onRemoveCinema(c.id,range,e.currentTarget)}>取消本影城全部</button>}</>;};
  return <main ref={page} id="explore" className="explore-page">{intro&&<Introduction {...intro} tags={tagLibrary} close={()=>setIntro(null)}/>}
    <div className="discovery-stage">
      <search className="location-filter-panel" aria-label="影城地點篩選">
        <div className="location-filter-heading"><h1 id="main-heading" tabIndex={-1}>探索影城</h1><p>選擇想投放的影城</p></div>
        <div className="location-filter-fields"><Field label="縣市"><select form={filterForm} name="city" value={city} onChange={e=>updateFilters({city:e.target.value,district:'',cinemaId:''})}><option value="">全台縣市</option>{cities.map(c=><option key={c}>{c}</option>)}</select></Field><Field label="行政區"><select form={filterForm} name="district" value={district} onChange={e=>updateFilters({district:e.target.value,cinemaId:''})}><option value="">全部行政區</option>{districts.map(d=><option key={d}>{d}</option>)}</select></Field><Field label="影城"><select form={filterForm} name="cinemaId" value={draftCinema} onChange={e=>updateFilters({cinemaId:e.target.value})}><option value="">選擇影城</option>{choices.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field></div>
      </search>
      <HomeHero content={home}/>
    </div>
    <div className="catalog-results">
    <search aria-label="影城與檔期">
      <form id={filterForm} className="filters" onSubmit={e=>{e.preventDefault();validateDates();}} aria-label="搜尋影城條件">
        <fieldset className="field date-field">
          <legend><span className="filter-title"><CalendarDays size={17} aria-hidden="true"/>投放日期（整週）</span><span className="filter-duration">{dirty?'日期待調整':`${days/7} 週 · ${days} 天`}</span></legend>
          <div className="date-range">
            <div className="date-control"><label htmlFor={startInputId}>開始日期</label><input id={startInputId} name="startDate" type="date" required min={today()} value={start} aria-invalid={dateError?'true':undefined} aria-describedby={dateError?dateErrorId:undefined} onBlur={validateDates} onChange={e=>updateFilters({startDate:e.target.value,...(e.target.value?{endDate:addDays(e.target.value,6)}:{})})}/></div>
            <ArrowRight className="date-separator" size={18} aria-hidden="true"/>
            <div className="date-control"><label htmlFor={endInputId}>結束日期</label><input id={endInputId} name="endDate" type="date" required step="7" min={start?addDays(start,6):undefined} value={end} aria-invalid={dateError?'true':undefined} aria-describedby={dateError?dateErrorId:undefined} onBlur={validateDates} onChange={e=>updateFilters({endDate:e.target.value})}/></div>
          </div>
          {dateError&&<Alert className="filter-date-alert" variant="warning"><span id={dateErrorId}>{dateError}</span></Alert>}
        </fieldset>
        <div className="field audience-field">
          <label htmlFor={audienceInputId} className="filter-title"><UsersRound size={17} aria-hidden="true"/>受眾標籤</label>
          <div className="audience-control">
            <button id={audienceInputId} ref={tagTrigger} type="button" className={`tag-trigger${tags.length?' has-selection':''}`} aria-label={`受眾標籤：${tagSummary}，開啟篩選`} aria-haspopup="dialog" aria-expanded={tagOpen} onClick={()=>setTagOpen(true)}>
              <span className="tag-trigger-summary">{tagSummary}</span>{tags.length>0&&<span className="tag-trigger-count" aria-hidden="true">{tags.length}</span>}<ChevronDown size={18} aria-hidden="true"/>
            </button>
          </div>
        </div>
      </form>
    </search>
    {connectionNotice&&<Alert className="catalog-connection-notice" variant="warning" title="會員登入尚未開通" announce={false}>{connectionNotice}</Alert>}
    {tags.length>0&&<div className="selected-tags" role="group" aria-label="已套用的受眾標籤">{selectedTags.map(({id,name})=><button key={id} type="button" aria-label={`移除受眾標籤：${name}`} onClick={()=>{tagTrigger.current?.focus({preventScroll:true});updateFilters({tags:tags.filter(t=>t!==id)});}}><span>{name}</span><X size={15} aria-hidden="true"/></button>)}{tags.length>1&&<button type="button" className="clear-audience" onClick={()=>{tagTrigger.current?.focus({preventScroll:true});updateFilters({tags:[]});}}>清除受眾</button>}</div>}{tagOpen&&<AudiencePicker tags={tagLibrary} selected={tags} apply={tags=>updateFilters({tags})} resultCount={list.length} close={()=>setTagOpen(false)}/ >}{error&&<Alert title="無法讀取版位">{error}</Alert>}
    <div id="search-results" className="map-mode-bar">
      <div className="results-summary">
        <div className="results-summary-line"><b role="status">{booking?'影廳與檔期':`${list.length} 間影城`}<span className="visually-hidden">，檔期 {range.startDate} 至 {range.endDate}</span></b><span className="fine results-date">{range.startDate} ～ {range.endDate}<Tooltip toggle text="勾選影城會將可選影廳各加入 1 檔。加入清單不保留庫存，委刊核准後才占用檔期。"><button type="button" className="help-button" aria-label="選購與版位說明"><Info size={17} aria-hidden="true"/></button></Tooltip></span></div>
        {dirty&&<p className="results-pending">請完成有效日期；目前結果暫用上次有效檔期，尚不可加入清單。</p>}
      </div>
      <div className="results-actions"><button className="clear-filters" onClick={clear}>清除條件</button><div className="tabs"><button className={mode==='list'?'active':''} aria-pressed={mode==='list'} onClick={()=>{setMode('list');setBooking(false);}}>列表</button><button className={mode==='map'?'active':''} aria-pressed={mode==='map'} onClick={()=>{setMode('map');setBooking(false);}}>地圖</button></div></div>
    </div>
    {mode==='map'&&!booking&&<div className="map-search-layout"><aside className="map-cinema-list">{list.map(c=><article className={state(c).count?'picked':''} key={c.id}>{selectControl(c)}<h3><button type="button" className="intro-name" aria-haspopup="dialog" aria-label={`${c.name}，查看影城簡介`} onClick={()=>setIntro({cinema:c})}>{c.name}</button></h3><p>{c.city} · {c.halls.length} 廳<br/>{c.address}</p><button disabled={!located(c)} onClick={()=>setFocus({id:c.id,at:Date.now()})}>{located(c)?'在地圖查看':'尚未設定座標'}</button><button onClick={()=>{setCinemaId(c.id);setMode('list');}}>逐廳查看</button></article>)}{!list.length&&<Empty>沒有符合條件的影城。</Empty>}</aside><Suspense fallback={<div className="map-panel map-loading" role="status">正在載入地圖…</div>}><CinemaMap cinemas={list} selected={fullIds} partial={pickedCinemas.filter(c=>state(c).partial).map(c=>c.id)} onToggle={toggle} onSelectMany={addCinemas} focusId={focus} selectionReady={ready&&!dirty}/></Suspense></div>}
    {(mode==='list'||booking)&&(selected?<div className="catalog-layout">
      <aside className="cinema-sidebar" aria-labelledby={cinemaListTitle}>
        <header className="cinema-sidebar-heading">
          <h2 id={cinemaListTitle}>選擇影城<small>{bookingList.length} 間</small></h2>
          <p>捲動列表，查看各影城影廳</p>
        </header>
        <div className="cinema-list" ref={cinemaList} role="region" aria-label="可捲動的影城列表" tabIndex={0}>
          {bookingList.map(c=><div className={`cinema-choice ${selected.id===c.id?'is-current':''}`} key={c.id}>
            {selectControl(c)}
            <button type="button" className={selected.id===c.id?'selected':''} aria-pressed={selected.id===c.id} aria-controls={hallDetailId} onClick={()=>{setCinemaId(c.id);if(booking)setDetailRevision(v=>v+1);}}>
              <span><MapPin size={15} aria-hidden="true"/>{c.city} · {c.district}</span><b>{c.name}</b>
              <small>{c.halls.length} 廳 · 已加入 {state(c).count} 廳</small>
              {selected.id===c.id&&<span className="cinema-viewing">目前查看<ArrowRight size={15} aria-hidden="true"/></span>}
            </button>
          </div>)}
        </div>
      </aside>
      <section className="cinema-detail" id={hallDetailId} ref={detail} aria-labelledby={hallTitleId}>
        <div className="cinema-heading">
          <p className="cinema-detail-step">選擇影廳<span className="cinema-hall-count">共 {selected.halls.length} 廳</span></p>
          <h2 id={hallTitleId}><button type="button" className="intro-name" aria-haspopup="dialog" aria-label={`${selected.name}，查看影城簡介`} onClick={()=>setIntro({cinema:selected})}>{selected.name}</button></h2>
          <p>{range.startDate} ～ {range.endDate}（{days/7} 週）</p><p><MapPin size={14}/>{selected.address}</p>
        </div><div className="hall-grid">{selected.halls.map(h=>{
      const entry=cart.find(i=>i.cinemaId===selected.id&&i.hallId===h.id&&sameRange(i,range)),s=stock(selected,h),amount=entry?.totalAmount??previewWeeklyTotal(h.weeklyPrice,1,days),available=ready&&s?.remaining>0&&amount!==null;
      return <article className={`hall-card ${entry?'in-cart':''}`} key={h.id} tabIndex={-1}><header className="hall-card-heading"><h3><button type="button" className="intro-name" aria-haspopup="dialog" aria-label={`${h.name}，查看影廳介紹`} onClick={()=>setIntro({cinema:selected,hall:h})}>{h.name}</button></h3><span><Film size={14}/>影片素材</span></header><div className="hall-card-content"><div className="hall-price"><strong>{money(h.weeklyPrice)}</strong><small>/ 檔 / 週 · 未稅</small></div><div className="hall-availability">{ready&&s?<><span>本期間每日最多已核准 <b>{s.bookedMax}</b> 檔 · 最少剩餘 <b>{s.remaining}</b> 檔</span><meter min="0" max={s.capacity} value={s.bookedMax} aria-label="本期間每日最大已核准檔數"/></>:<span>正在查詢版位…</span>}</div><div className="hall-estimate"><span>{entry?`清單合計（${entry.slotsCount} 檔）`:'預估合計（1 檔）'}</span><strong>{money(amount)}</strong></div></div><footer className="hall-action">{entry?<><span className="added-status">✓ 已加入清單</span><button className="cancel-hall" onClick={e=>onRemove(entry.cartId,e.currentTarget)}>取消</button></>:<button className="primary" disabled={!available||dirty} onClick={()=>onAdd([cartItem(selected,h,range,s.remaining)])}><Plus size={16}/>{ready&&s?.remaining===0?'本檔期已滿':'加入委刊清單'}</button>}</footer></article>;
    })}</div><p className="fine">檔數請在購物車增減。清單尚未保留庫存；核准時再次確認。版位數據依目前本機委刊紀錄。</p></section></div>:<Empty>沒有符合條件的影城。</Empty>)}
    {pickedCinemas.length>0&&<div className="selection-dock" aria-label="已選影城清單"><strong>本檔期已選 {pickedCinemas.length} 間影城</strong><div className="selection-chips">{pickedCinemas.map(c=><button key={c.id} onClick={e=>onRemoveCinema(c.id,range,e.currentTarget)} aria-label={`取消${c.name}全部影廳`}>{c.name}（{state(c).count} 廳）×</button>)}</div><button className="dock-clear" onClick={e=>onClearRange(range,e.currentTarget)}>清除此檔期</button><button className="primary" onClick={()=>showHalls(pickedCinemas[0].id)}>查看影廳與檔期 →</button><button className="dock-cart" onClick={openCart}><ShoppingCart size={19}/>購物車</button></div>}
  </div></main>;
}
