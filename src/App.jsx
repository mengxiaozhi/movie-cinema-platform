import {ProfileEditor,TagManager} from './Introduction.jsx';
import BrandLogo from './BrandLogo.jsx';
import SiteNavigation from './SiteNavigation.jsx';
import Promotions from './Promotions.jsx';
import MemberArea from './MemberArea.jsx';
import HeaderActions from './HeaderActions.jsx';
import {usePageNavigation} from './page-navigation.js';
import React,{useEffect,useId,useRef,useState} from 'react';
import {onAuthStateChanged,GoogleAuthProvider,signInWithPopup,signOut} from 'firebase/auth';
import {Film,MapPin,ShieldCheck,Plus,FileText,Upload,Calendar,Settings,Users,Menu,X,Play,Pause,Volume2,VolumeX,ChevronLeft,ChevronRight,ArrowRight} from 'lucide-react';
import {auth,api,configured,selectMaterial,materialPreview,watchHome} from './firebase.js';
import {HomepageAdmin} from './HomeContent.jsx';
import {Alert,Toast} from './feedback.jsx';
import {ConfirmationProvider,useConfirm} from './Confirmation.jsx';
import {DEFAULT_HOME} from './homepage.js';
import Catalog from './Catalog.jsx';
import BookingCart from './BookingCart.jsx';
import {Field,Modal,Empty,money,today,FeedbackContext,FormFeedback} from './ui.jsx';
import {addUniqueItems,updateQuantity,sameRange} from './cart.js';
import {MaterialSpec,MaterialUpload} from './MaterialSpec.jsx';
import {validateVideoSpec} from './video-spec.js';
import {weeklyTotal,previewWeeklyTotal} from './weekly-pricing.js';
import {AVAILABLE_TAGS} from './data/tags.js';
import {filterCinemas,emptyFilters,confirmFilters,addDays} from './catalog.js';

const ROLE={buyer:'廣告主',super_admin:'最高管理員',reviewer:'審核人員',cinema_manager:'影城管理人員'};
const STATUS={PENDING_APPROVAL:'待審核',APPROVED:'已核准',REJECTED:'已駁回',CANCELLED:'已取消',WAITING_UPLOAD:'待上傳',WAITING_REVIEW:'待素材審核',QC_PASS:'素材通過',QC_REJECTED:'素材退件'};
const dateTime=v=>v?new Date(v._seconds*1000).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'';
function Badge({status}){return <span className={`badge ${status==='APPROVED'||status==='QC_PASS'?'green':status==='REJECTED'||status==='QC_REJECTED'?'red':''}`}>{STATUS[status]||status}</span>;}

export default function App(){return <ConfirmationProvider><WorkspaceApp/></ConfirmationProvider>;}
function WorkspaceApp(){
  const confirmAction=useConfirm(),busyRef=useRef(false);
  const [home,setHome]=useState(DEFAULT_HOME);
  useEffect(()=>watchHome(setHome,e=>console.warn('首頁設定暫時無法讀取',e.code)),[]);
  const [user,setUser]=useState(null),[member,setMember]=useState(null),[authLoading,setAuthLoading]=useState(true);
  const [view,setView]=usePageNavigation();
  const [cinemas,setCinemas]=useState([]),[config,setConfig]=useState(null),[serviceError,setServiceError]=useState('');
  const [cart,setCart]=useState([]),[cartOpen,setCartOpen]=useState(false),[loginOpen,setLoginOpen]=useState(false),[notice,setNotice]=useState(null),[toast,setToast]=useState(null),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0),[privacy,setPrivacy]=useState(false);
  const refresh=()=>setRevision(v=>v+1);
  const notify=(text,error=false)=>{const message={id:crypto.randomUUID(),text,error};if(error)setNotice(message);else setToast(message);};
  const run=async(fn)=>{if(busyRef.current)return false;busyRef.current=true;setBusy(true);try{await fn();return true;}catch(e){notify(e.message,true);return false;}finally{busyRef.current=false;setBusy(false);}};
  const [cartPulse,setCartPulse]=useState(0);
  const openCart=()=>{setToast(null);setCartOpen(true);};
  const addItems=items=>{try{const next=addUniqueItems(cart,items),added=next.length-cart.length;setCart(next);if(added){setCartPulse(v=>v+1);notify(added===1?'已加入委刊清單':`已加入 ${added} 筆影廳，各 1 檔`);}else notify('這些影廳已在清單，未重複加入。');}catch(e){notify(e.message,true);}};
  const removeItem=async(id,trigger)=>{const item=cart.find(i=>i.cartId===id);if(!item)return;if(item.slotsCount>1&&!await confirmAction({title:'移除這筆影廳？',description:`${item.cinemaName}・${item.hallName}，共 ${item.slotsCount} 檔，估算 ${money(item.totalAmount)}。移除後可重新加入。`,confirmLabel:'移除影廳',danger:true},trigger))return;setCart(v=>v.filter(i=>i.cartId!==id));notify('影廳已從清單移除。');};
  const removeScope=async(predicate,message,trigger)=>{const items=cart.filter(predicate);if(!items.length)return;if((items.length>1||items.some(i=>i.slotsCount>1))&&!await confirmAction({title:message,description:`共 ${items.length} 廳、${items.reduce((n,i)=>n+i.slotsCount,0)} 檔，移除後可重新加入。`,confirmLabel:'移除全部',danger:true},trigger))return;setCart(v=>v.filter(i=>!predicate(i)));notify(`已從清單移除 ${items.length} 筆影廳。`);};
  const removeCinema=(id,range,trigger)=>removeScope(i=>i.cinemaId===id&&sameRange(i,range),'移除這個檔期內本影城的全部影廳？',trigger);
  const clearRange=(range,trigger)=>removeScope(i=>sameRange(i,range),'清除此檔期的全部影廳？',trigger);
  const changeQuantity=(id,n)=>{try{setCart(updateQuantity(cart,id,n));}catch(e){notify(e.message,true);}};
  useEffect(()=>{if(!configured){setAuthLoading(false);return;}let active=true;const unsubscribe=onAuthStateChanged(auth,async u=>{if(!active)return;setUser(u);setMember(null);setAuthLoading(true);try{if(u){const m=await api('/me');if(active&&auth.currentUser?.uid===u.uid)setMember(m);}}catch(e){if(active)notify(e.message,true);}finally{if(active)setAuthLoading(false);}});return()=>{active=false;unsubscribe();};},[]);
  useEffect(()=>{let active=true;Promise.all([api('/cinemas'),api('/config')]).then(([c,s])=>{if(active){setCinemas(c.cinemas);setConfig(s);setServiceError('');}}).catch(e=>{if(active)setServiceError(e.message);});return()=>{active=false;};},[revision]);
  useEffect(()=>{const onStorage=e=>{if(e.key==='movie-local-workspace-v1'){refresh();if(auth?.currentUser)api('/me').then(setMember).catch(()=>setMember(null));}};window.addEventListener('storage',onStorage);return()=>window.removeEventListener('storage',onStorage);},[]);
  const google=()=>run(async()=>{if(!auth)throw new Error('網站尚未完成 Firebase 設定。');try{const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await signInWithPopup(auth,provider);setLoginOpen(false);}catch(e){if(e.code==='auth/popup-closed-by-user'||e.code==='auth/cancelled-popup-request')return;const errors={'auth/popup-blocked':'瀏覽器阻擋了登入視窗，請允許本站彈出視窗後重試。','auth/unauthorized-domain':'這個網站網址尚未開通 Google 登入，請聯絡管理員。','auth/operation-not-allowed':'Google 登入尚未啟用，請聯絡管理員。','auth/network-request-failed':'登入時網路連線中斷，請重試。'};throw new Error(errors[e.code]||'Google 登入暫時無法完成，請稍後重試。');}});
  const admin=member&&member.role!=='buyer';
  return <FeedbackContext.Provider value={{notice,busy,dismiss:()=>setNotice(null)}}><FormFeedback>
    <a className="skip-link" href="#main-heading" onClick={e=>{e.preventDefault();document.getElementById('main-heading')?.focus();}}>跳至主要內容</a>
    <header className="topbar"><a href="#explore" className="brand"><BrandLogo mark/>亞加媒體通路</a><SiteNavigation view={view} member={member} admin={admin}/><HeaderActions user={user} member={member} roleLabel={ROLE[member?.role]||'驗證中'} authLoading={authLoading} configured={configured} busy={busy} cartCount={cart.length} cartPulse={cartPulse} cartOpen={cartOpen} loginOpen={loginOpen} onCart={openCart} onLogin={()=>setLoginOpen(true)} onLogout={()=>run(async()=>{await signOut(auth);setView('portal');setCart([]);})}/></header>
    <Toast message={toast} onDismiss={()=>setToast(null)}/>
    {notice&&<Alert className="page-alert" title="操作未完成" onDismiss={()=>setNotice(null)}>{notice.text}</Alert>}
    {serviceError&&<Alert className="page-alert" title="系統服務尚未就緒" actions={<button type="button" onClick={refresh}>重新連線</button>}>{serviceError}</Alert>}
    {!configured&&!['portal','promotions','member'].includes(view)&&<div className="service-error">尚未設定 Firebase 網站連線。請依部署說明設定環境變數後重新建置。</div>}
    {view==='portal'&&<Catalog home={home} connectionNotice={!configured?'尚未設定 Firebase 網站連線。請依部署說明設定環境變數後重新建置。':''} cinemas={cinemas} config={config} cart={cart} onAdd={addItems} onRemove={removeItem} onRemoveCinema={removeCinema} onClearRange={clearRange} openCart={openCart} notify={notify}/>}
    {view==='promotions'&&<Promotions/>}
    {(view==='member'||(view==='orders'&&!member)||(view==='admin'&&!admin))&&<MemberArea user={user} member={member} authLoading={authLoading} configured={configured} onLogin={()=>setLoginOpen(true)} onCart={openCart} cartCount={cart.length} onPrivacy={()=>setPrivacy(true)} onRetryMember={()=>run(async()=>setMember(await api('/me')))} revision={revision}/>}
    {view==='orders'&&member&&<main><PageTitle icon={<FileText/>} title="我的委刊" text="查詢委刊進度、選擇素材與查看審查結果。"/><Orders key={`own-${revision}`} own member={member} run={run} busy={busy} refresh={refresh} notify={notify}/></main>}
    {view==='admin'&&admin&&<Admin key={`admin-${revision}`} home={home} member={member} config={config} run={run} busy={busy} refresh={refresh} notify={notify}/>}
    <footer className="site-footer"><a className="brand" href="/" aria-label="亞加媒體通路首頁"><BrandLogo/></a><span>申請送出後，經審核確認檔期才成立委刊。</span><button onClick={()=>setPrivacy(true)}>資料使用說明</button><img className="footer-illustration" src="/media/firefly-couple.png" alt="越暗的地方你越亮" width="140" height="86" loading="lazy" decoding="async"/></footer>
    {loginOpen&&<Modal title="登入亞加媒體通路" close={()=>setLoginOpen(false)}><p className="muted">使用 Google 帳號管理委刊及素材。管理人員也使用相同登入入口。</p><button className="login-google" onClick={google} disabled={busy}>使用 Google 帳號登入</button></Modal>}
    {cartOpen&&<BookingCart cart={cart} remove={removeItem} changeQuantity={changeQuantity} close={()=>setCartOpen(false)} member={member} login={()=>{setCartOpen(false);setLoginOpen(true);}} run={run} busy={busy} submitted={()=>{setCart([]);setCartOpen(false);setView('orders');refresh();notify('委刊申請已送出。審核核准後才保留檔期，請至「我的委刊」查看進度。');}}/>}
    {privacy&&<Modal title="資料使用說明" close={()=>setPrivacy(false)}><p>Google 登入由 Firebase Authentication 處理。網站使用你的會員識別、顯示名稱及電子郵件辨識帳號。</p><p>首頁發布內容存放於 Firebase，所有訪客可讀取；地圖底圖由 OpenStreetMap 提供。影城設定、公司聯絡資料、委刊與審核紀錄保存在這台裝置的瀏覽器。這些資料不會同步到其他裝置；清除網站資料會移除本機紀錄。所選影片僅供本頁預覽，不會上傳至雲端。</p></Modal>}
    {busy&&<div className="busy" role="status">處理中，請稍候…</div>}
  </FormFeedback></FeedbackContext.Provider>;
}
function PageTitle({icon,title,text}){return <div className="page-title"><div className="eyebrow">亞加媒體通路 / 管理中心</div><h1 id="main-heading" tabIndex={-1}>{icon}{title}</h1><p>{text}</p></div>;}
function Orders({own=false,member,run,busy,refresh,notify}){
  const [uploadTarget,setUploadTarget]=useState(null),[decisionTarget,setDecisionTarget]=useState(null);
  const [orders,setOrders]=useState([]),[cursor,setCursor]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[qc,setQC]=useState(null),[progress,setProgress]=useState({});
  const load=async(after)=>{setLoading(true);try{const d=await api(`/orders${after?`?after=${after}`:''}`);setOrders(v=>after?[...v,...d.orders]:d.orders);setCursor(d.nextCursor);setError('');}catch(e){setError(e.message);}finally{setLoading(false);}};
  useEffect(()=>{load();},[]);
  const decide=(order,decision)=>setDecisionTarget({order,decision});
  const confirmDecision=async reason=>{
    const {order:o,decision}=decisionTarget;
    const saved=await run(async()=>{await api(`/orders/${o.id}/decision`,{method:'POST',body:{decision,reason}});if(decision==='APPROVED')setOrders(items=>items.map(item=>item.id===o.id?{...item,status:'APPROVED',decisionReason:''}:item));else refresh();notify('訂單狀態已更新。');});
    if(saved){setDecisionTarget(null);setTimeout(()=>document.getElementById(`order-${o.id}`)?.focus(),0);}
  };

  const upload=(order,file)=>{if(file)setUploadTarget({order,file});};
  const confirmUpload=spec=>run(async()=>{await selectMaterial(uploadTarget.order,uploadTarget.file,spec);setUploadTarget(null);refresh();notify('影片規格符合，素材已提交待審核。');});
  const openMaterial=o=>run(async()=>{const url=materialPreview(o);const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.click();});
  if(error)return <Alert title="無法載入委刊" actions={<button type="button" onClick={()=>load()}>重試</button>}>{error}</Alert>;
  return <>{!orders.length?<Empty>{loading?'正在載入委刊…':'尚無委刊紀錄。'}</Empty>:<div className="order-list">{orders.map(o=><article className="order-card" key={o.id} id={`order-${o.id}`} tabIndex={-1}><div className="order-head"><div><small className="mono">{o.id}</small><h3>{o.companyName}</h3><p>{o.cinemaName} · {o.hallName}</p></div><div><Badge status={o.status}/><Badge status={o.qcStatus}/></div></div><div className="order-summary"><span><Calendar size={15}/>{o.startDate} ～ {o.endDate}</span><span>{o.slotsCount} 檔 × {o.daysCount} 天</span><strong>{money(o.totalAmount)}<small> 未稅</small></strong></div><p className="fine">建立時間：{dateTime(o.createdAt)}　聯絡人：{o.contactPerson} / {o.phone} / {o.email}</p>{o.decisionReason&&<p className="order-note">處理說明：{o.decisionReason}</p>}{o.qcNotes&&<p className="order-note">素材審查備註：{o.qcNotes}</p>}{o.material&&<MaterialSpec material={o.material}/>}<div className="order-actions">{o.material&&<><span className="muted">{o.material.filename}</span><button disabled={busy} onClick={()=>openMaterial(o)}>檢視素材</button></>}{own&&o.ownerId===member.uid&&o.status==='APPROVED'&&o.qcStatus!=='QC_PASS'&&<label className="upload-button"><Upload size={15}/>{progress[o.id]!=null?`上傳 ${progress[o.id]}%`:'選擇 / 更換素材'}<input type="file" accept="video/mp4,video/quicktime" disabled={busy} onChange={e=>{upload(o,e.target.files[0]);e.target.value='';}}/></label>}{!own&&['super_admin','reviewer'].includes(member.role)&&<>{o.status==='PENDING_APPROVAL'&&<><button className="primary" disabled={busy} onClick={()=>decide(o,'APPROVED')}>核准委刊</button><button disabled={busy} onClick={()=>decide(o,'REJECTED')}>駁回</button></>}{o.status==='APPROVED'&&<><button disabled={busy} onClick={()=>decide(o,'CANCELLED')}>取消並釋出檔期</button>{o.material&&<button disabled={busy} onClick={()=>setQC(o)}>審核素材</button>}</>}</>}</div></article>)}</div>}{cursor&&<button disabled={loading} onClick={()=>load(cursor)}>{loading?'載入中…':'載入更多'}</button>}{decisionTarget&&<DecisionModal {...decisionTarget} busy={busy} close={()=>setDecisionTarget(null)} confirm={confirmDecision}/ >}{uploadTarget&&<MaterialUpload {...uploadTarget} close={()=>setUploadTarget(null)} confirm={confirmUpload} busy={busy}/ >}{qc&&<QC order={qc} close={()=>setQC(null)} run={run} busy={busy} done={()=>{setQC(null);refresh();notify('素材審核結果已儲存。');}}/>}</>;
}
export function DecisionModal({order,decision,close,confirm,busy}){
  const [reason,setReason]=useState(''),[error,setError]=useState(''),errorId=useId();
  const labels={APPROVED:'核准委刊',REJECTED:'駁回委刊',CANCELLED:'取消委刊並釋出檔期'},needsReason=decision!=='APPROVED';
  const submit=e=>{e.preventDefault();if(needsReason&&!reason.trim()){setError('請填寫處理原因，不能只輸入空白。');return;}confirm(reason.trim());};
  return <Modal title={labels[decision]} close={close} canClose={!busy}>
    <dl className="confirmation-summary"><div><dt>廣告主</dt><dd>{order.companyName}</dd></div><div><dt>影城／影廳</dt><dd>{order.cinemaName}・{order.hallName}</dd></div><div><dt>投放期間</dt><dd>{order.startDate} ～ {order.endDate}</dd></div><div><dt>檔數與未稅金額</dt><dd>{order.slotsCount} 檔・{money(order.totalAmount)}</dd></div></dl>
    <Alert variant="warning" announce={false}>{decision==='APPROVED'?'核准後會占用本訂單所有投放日期的庫存；取消委刊後才會釋出。':decision==='CANCELLED'?'確認取消後會釋出本委刊已保留的檔期，並記錄取消原因。':'駁回後會記錄處理原因，讓廣告主了解需要調整的內容。'}</Alert>
    <form onSubmit={submit}>{needsReason&&<Field label={decision==='CANCELLED'?'取消原因':'駁回原因'}><textarea name="reason" required maxLength={1000} value={reason} disabled={busy} aria-invalid={error?'true':undefined} aria-describedby={error?errorId:undefined} onChange={e=>{setReason(e.target.value);setError('');}}/></Field>}{error&&<div id={errorId}><Alert title="請補充原因">{error}</Alert></div>}<div className="confirmation-actions"><button type="button" disabled={busy} onClick={close}>返回</button><button type="submit" disabled={busy} className={needsReason?'danger-button':'primary'}>{busy?'處理中…':`確認${labels[decision]}`}</button></div></form>
  </Modal>;
}
function QC({order,close,run,busy,done}){
  let specValid=true;try{validateVideoSpec(order.material?.spec);}catch{specValid=false;}
  const [checks,setChecks]=useState(order.qcSpecCheck||{resolution:false,audio:false,frameRate:false,culturePermit:'',cplName:''}),[notes,setNotes]=useState(order.qcNotes||'');
  const save=status=>run(async()=>{await api(`/orders/${order.id}/qc`,{method:'POST',body:{status,checks,notes,materialPath:order.material.path}});done();});
  return <Modal title="素材品質人工審核" close={close} canClose={!busy}><h3>{order.companyName}</h3><p className="muted">{order.material.filename}</p><MaterialSpec material={order.material}/><p className="fine">以上為瀏覽器讀取的基本資訊，請搭配實際影片檢查。音訊、影格率與放映規格仍須逐項人工確認。</p>{[['resolution','解析度符合投放影廳規格'],['audio','音訊規格符合投放要求'],['frameRate','影格率符合放映要求']].map(([k,label])=><label className="check" key={k}><input type="checkbox" checked={checks[k]} onChange={e=>setChecks({...checks,[k]:e.target.checked})}/>{label}</label>)}<Field label="准播／審查許可證號" value={checks.culturePermit} onChange={e=>setChecks({...checks,culturePermit:e.target.value})}/><Field label="DCP / CPL 檔名代碼" value={checks.cplName} onChange={e=>setChecks({...checks,cplName:e.target.value})}/><Field label="審查備註 / 退件原因"><textarea value={notes} maxLength={2000} onChange={e=>setNotes(e.target.value)}/></Field><div className="actions"><button className="primary" disabled={busy||!specValid} onClick={()=>save('QC_PASS')}>通過審核</button><button disabled={busy} onClick={()=>save('QC_REJECTED')}>退件重傳</button></div></Modal>;
}
function Admin({member,config,home,run,busy,refresh,notify}){
  const superAdmin=member.role==='super_admin',review=superAdmin||member.role==='reviewer',manage=superAdmin||member.role==='cinema_manager';
  const tabs=[...(manage?[['cinemas','影城與影廳'],['tags','受眾標籤']]:[]),...(review?[['orders','委刊與素材審核'],['cue','每日排片表']]:[]),...(superAdmin?[['homepage','首頁管理'],['settings','容量設定'],['users','會員與權限']]:[])];
  const [tab,setTab]=useState(tabs[0][0]);
  return <main><PageTitle icon={<ShieldCheck/>} title="管理後台" text={ROLE[member.role]}/><div className="tabs">{tabs.map(([key,label])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}>{label}</button>)}</div>{tab==='cinemas'&&manage&&<CinemaAdmin member={member} run={run} busy={busy} refresh={refresh} notify={notify}/ >}{tab==='orders'&&review&&<Orders member={member} run={run} busy={busy} refresh={refresh} notify={notify}/ >}{tab==='tags'&&manage&&<TagManager run={run} busy={busy} notify={notify}/ >}{tab==='cue'&&review&&<Cue run={run} busy={busy}/ >}{tab==='homepage'&&superAdmin&&<HomepageAdmin content={home} run={run} busy={busy} notify={notify}/>}{tab==='settings'&&superAdmin&&<BookingSettings config={config} run={run} busy={busy} refresh={refresh} notify={notify}/ >}{tab==='users'&&superAdmin&&<UserAdmin member={member} run={run} busy={busy} notify={notify}/ >}</main>;
}
function CinemaAdmin({member,run,busy,refresh,notify}){
  const confirmAction=useConfirm();
  const [cinemas,setCinemas]=useState([]),[error,setError]=useState(''),[editor,setEditor]=useState(null),[profile,setProfile]=useState(null);
  const load=()=>api('/admin/cinemas').then(d=>{setCinemas(d.cinemas);setError('');}).catch(e=>setError(e.message));
  useEffect(()=>{load();},[]);
  const done=()=>{setEditor(null);load();notify('資料已儲存，前台重新整理後即可看到更新。');};
  const toggle=async(c,h,trigger)=>{const target=h||c,action=target.active?'停用':'啟用';if(!await confirmAction({title:`${action}「${target.name}」？`,description:target.active?'停用後將移除前台選購入口，既有委刊與歷史紀錄仍保留。':'啟用後會重新開放前台選購。',confirmLabel:action,danger:target.active},trigger))return;return run(async()=>{if(h){const {id,bookedSlots,dailyPrice,weeklyPrice,capacity,...body}=h;await api(`/cinemas/${c.id}/halls/${id}`,{method:'PUT',body:{...body,active:!h.active,...(member.role==='super_admin'?{...(weeklyPrice?{weeklyPrice}:{}),capacity}: {})}});}else{const {id,halls,createdAt,updatedAt,...body}=c;await api(`/cinemas/${id}`,{method:'PUT',body:{...body,active:!c.active}});}load();notify('狀態已更新。');});};
  return <><div className="section-heading"><p className="muted">停用會移除前台選購入口；保留訂單與歷史資料。{member.role!=='super_admin'?'價格及容量由最高管理員設定。':''}</p><button className="primary" onClick={()=>setEditor({type:'cinema'})}><Plus size={16}/>新增影城</button></div>{error&&<Alert title="無法載入資料">{error}</Alert>}{!cinemas.length&&<Empty>還沒有影城資料，請新增實際合作影城。</Empty>}{cinemas.map(c=><section className="admin-cinema" key={c.id}><div className="section-heading"><div><h2>{c.name} {!c.active&&<small className="red">已停用</small>}</h2><p className="muted">{c.city} · {c.district} · {c.address}</p></div><div className="actions"><button onClick={()=>setEditor({type:'cinema',data:c})}>編輯影城</button><button onClick={()=>setProfile({cinema:c})}>簡介管理</button><button onClick={e=>toggle(c,null,e.currentTarget)} disabled={busy}>{c.active?'停用':'啟用'}</button><button onClick={()=>setEditor({type:'hall',cinemaId:c.id})}>新增影廳</button></div></div><div className="table-wrap"><table><thead><tr><th>影廳</th><th>放映規格</th><th>座位</th><th>每週單檔定價</th><th>每日容量</th><th>狀態</th><th>操作</th></tr></thead><tbody>{c.halls.map(h=><tr key={h.id}><td>{h.name}</td><td>{h.screenType}</td><td>{h.seats??'待確認'}</td><td>{money(h.weeklyPrice)}</td><td>{h.capacity??'依全站設定'}</td><td>{h.active?'啟用':'停用'}</td><td className="actions"><button onClick={()=>setEditor({type:'hall',cinemaId:c.id,data:h})}>編輯</button><button onClick={()=>setProfile({cinema:c,hall:h})}>簡介管理</button><button disabled={busy} onClick={e=>toggle(c,h,e.currentTarget)}>{h.active?'停用':'啟用'}</button></td></tr>)}</tbody></table></div></section>)}{profile&&<ProfileEditor {...profile} close={()=>setProfile(null)} done={()=>{setProfile(null);load();refresh();notify('簡介已儲存。');}} run={run} busy={busy}/ >}{editor&&<EntityEditor editor={editor} superAdmin={member.role==='super_admin'} close={()=>setEditor(null)} run={run} busy={busy} done={done}/>}</>;
}
function EntityEditor({editor,superAdmin,close,run,busy,done}){
  const hall=editor.type==='hall';const initial=hall?{name:'',screenType:'放映規格待確認',seats:'',active:true,...(superAdmin?{weeklyPrice:'',capacity:''}:{})}:{name:'',city:'台北市',district:'',address:'',description:'',lat:'',lng:'',active:true};
  const [data,setData]=useState({...initial,...Object.fromEntries(Object.keys(initial).map(k=>[k,editor.data?.[k]??initial[k]]))});
  const save=e=>{e.preventDefault();run(async()=>{const body=hall?{...data,seats:data.seats===''?null:Number(data.seats),...(superAdmin?{...(data.weeklyPrice===''?{}:{weeklyPrice:Number(data.weeklyPrice)}),capacity:data.capacity===''?null:Number(data.capacity)}:{})}:{...data,lat:data.lat===''?null:Number(data.lat),lng:data.lng===''?null:Number(data.lng)};if(hall&&superAdmin&&body.weeklyPrice==='') delete body.weeklyPrice;const path=hall?`/cinemas/${editor.cinemaId}/halls${editor.data?`/${editor.data.id}`:''}`:`/cinemas${editor.data?`/${editor.data.id}`:''}`;await api(path,{method:editor.data?'PUT':'POST',body});done();});};
  const fields=hall?[['name','影廳名稱'],['screenType','放映規格'],['seats','座位數','number'],...(superAdmin?[['weeklyPrice','單檔每週價格（未稅，新影廳可先不設定）','number'],['capacity','每日檔數上限（留空使用全站預設）','number']]:[])]:[['name','影城名稱'],['city','縣市'],['district','行政區'],['address','地址'],['lat','地圖緯度（選填）','number'],['lng','地圖經度（選填）','number'],['description','影城與受眾介紹']];
  return <Modal title={`${editor.data?'編輯':'新增'}${hall?'影廳':'影城'}`} close={close} canClose={!busy}><form onSubmit={save}><div className="form-grid">{fields.map(([key,label,type='text'])=><Field key={key} label={label} type={type} required={!['description','capacity','weeklyPrice','seats','lat','lng'].includes(key)} step={['lat','lng'].includes(key)?'any':undefined} min={['lat','lng'].includes(key)?undefined:type==='number'?1:undefined} max={key==='capacity'?120:key==='seats'?2000:key==='weeklyPrice'?10000000:undefined} value={data[key]??''} onChange={e=>setData({...data,[key]:e.target.value})}/>)}</div><label className="check"><input type="checkbox" checked={data.active} onChange={e=>setData({...data,active:e.target.checked})}/>啟用</label><button className="primary" type="submit" disabled={busy}>儲存</button></form></Modal>;
}
function BookingSettings({config,run,busy,refresh,notify}){
  const [capacity,setCapacity]=useState(config?.settings.defaultCapacity??12),[days,setDays]=useState(config?.settings.maxBookingDays??90);
  return <section className="panel"><h2>廣告容量設定</h2><p className="muted">每日容量按檔數計算，可依營運需求調整；個別影廳設定優先於全站預設。</p><form onSubmit={e=>{e.preventDefault();run(async()=>{await api('/settings',{method:'PUT',body:{defaultCapacity:Number(capacity),maxBookingDays:Number(days)}});notify('全站容量已更新。');refresh();});}}><Field label="預設每廳每日檔數（1–120）" type="number" min="1" max="120" required value={capacity} onChange={e=>setCapacity(e.target.value)}/><p>合計 {Number(capacity)} 檔 / 日</p><Field label="每筆可申請的最長天數（1–180）" type="number" min="1" max="180" required value={days} onChange={e=>setDays(e.target.value)}/><p className="fine">調低容量不會取消既有核准委刊。當日已排檔數超過新上限時，系統將阻止再核准新的委刊。訂單金額保留申請時的報價。</p><button className="primary" disabled={busy}>儲存設定</button></form></section>;
}
function UserAdmin({member,run,busy,notify}){
  const confirmAction=useConfirm();
  const [users,setUsers]=useState([]),[cursor,setCursor]=useState(null),[error,setError]=useState('');
  const load=async after=>{try{const d=await api(`/users${after?`?after=${after}`:''}`);setUsers(v=>after?[...v,...d.users]:d.users);setCursor(d.nextCursor);}catch(e){setError(e.message);}};
  useEffect(()=>{load();},[]);
  const update=async(u,change,trigger)=>{const description=change.role?`將「${u.name||u.email}」的角色從${ROLE[u.role]}改為${ROLE[change.role]}，變更後會立即影響可使用的後台功能。`:`${change.disabled?'停用':'恢復'}「${u.name||u.email}」的會員存取權限。`;if(!await confirmAction({kind:'modal',title:'確認修改會員權限',description,confirmLabel:'確認變更',danger:!!change.disabled},trigger))return;run(async()=>{await api(`/users/${u.id}`,{method:'PUT',body:{role:u.role,disabled:!!u.disabled,...change}});await load();notify('會員權限已更新。');});};
  return <><p className="muted">會員必須先登入一次才會出現在清單。不能修改自己的角色或停用自己。</p>{error&&<Alert title="無法載入資料">{error}</Alert>}<div className="table-wrap"><table><thead><tr><th>會員</th><th>電子郵件</th><th>角色</th><th>狀態</th><th>操作</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td>{u.name||u.id}</td><td>{u.email||'LINE 會員未提供'}</td><td><select aria-label={`${u.name}的角色`} disabled={busy||u.id===member.uid} value={u.role} onChange={e=>update(u,{role:e.target.value},e.currentTarget)}>{Object.entries(ROLE).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></td><td>{u.disabled?'已停用':'正常'}</td><td><button disabled={busy||u.id===member.uid} onClick={e=>update(u,{disabled:!u.disabled},e.currentTarget)}>{u.disabled?'恢復':'停用'}</button></td></tr>)}</tbody></table></div>{cursor&&<button onClick={()=>load(cursor)}>載入更多</button>}</>;
}
function Cue({run,busy}){
  const [cinemas,setCinemas]=useState([]),[cinemaId,setCinema]=useState(''),[hallId,setHall]=useState(''),[date,setDate]=useState(today()),[rows,setRows]=useState(null),[error,setError]=useState('');
  useEffect(()=>{api('/admin/cinemas').then(d=>{setCinemas(d.cinemas);setCinema(d.cinemas[0]?.id||'');setHall(d.cinemas[0]?.halls[0]?.id||'');}).catch(e=>setError(e.message));},[]);
  const halls=cinemas.find(c=>c.id===cinemaId)?.halls||[];
  const load=()=>run(async()=>{const result=await api(`/cuesheet?${new URLSearchParams({cinemaId,hallId,date})}`);setRows(result.rows);});
  const csv=()=>{const cell=v=>'"'+String(v).replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';const content='\uFEFF'+[['檔次','秒數','委刊編號','廣告主','許可證號','CPL 代碼'],...rows.map(r=>[r.slot,r.seconds,r.orderId,r.companyName,r.culturePermit,r.cplName])].map(r=>r.map(cell).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=`MOVIE-${date}-${hallId}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  return <section className="panel wide"><h2>每日影廳排片表</h2><p className="muted">僅列出委刊已核准且素材通過的項目。此表供人工排片使用，尚未連接影城 TMS 放映系統。</p>{error&&<Alert title="無法載入資料">{error}</Alert>}<div className="filters"><Field label="影城"><select value={cinemaId} onChange={e=>{setCinema(e.target.value);setHall(cinemas.find(c=>c.id===e.target.value)?.halls[0]?.id||'');setRows(null);}}>{cinemas.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="影廳"><select value={hallId} onChange={e=>{setHall(e.target.value);setRows(null);}}>{halls.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></Field><Field label="日期" type="date" value={date} onChange={e=>{setDate(e.target.value);setRows(null);}}/><button disabled={busy||!hallId||!date} onClick={load}>查詢</button>{rows&&<button className="primary" onClick={csv}>匯出 CSV</button>}</div>{rows&&<div className="table-wrap"><table><thead><tr><th>檔次</th><th>秒數</th><th>廣告主</th><th>准播號</th><th>CPL 代碼</th></tr></thead><tbody>{rows.map(r=><tr key={r.slot}><td>{r.slot}</td><td>{r.seconds}</td><td>{r.companyName}</td><td>{r.culturePermit}</td><td>{r.cplName}</td></tr>)}</tbody></table>{!rows.length&&<Empty>此日期與影廳沒有已核准且素材通過的項目。</Empty>}</div>}</section>;
}



