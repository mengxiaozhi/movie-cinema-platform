import React,{useEffect,useState} from 'react';
import {ArrowRight,FileText,Film,ShieldCheck,ShoppingCart,UserRound} from 'lucide-react';
import {api} from './firebase.js';
import {Alert} from './feedback.jsx';
import StatsAccordion from './StatsAccordion.jsx';
import './pages.css';

const ROLES={buyer:'廣告主',super_admin:'最高管理員',reviewer:'審核人員',cinema_manager:'影城管理人員'};

function OrderOverview({uid,revision}){
  const [result,setResult]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;
    setResult(null);setError('');
    api('/orders').then(({orders})=>{
      if(!active)return;
      const own=orders.filter(order=>order.ownerId===uid);
      const approved=own.filter(order=>order.status==='APPROVED');
      setResult({total:own.length,pending:own.filter(order=>order.status==='PENDING_APPROVAL').length,approved:approved.length,rejected:own.filter(order=>order.status==='REJECTED').length,cancelled:own.filter(order=>order.status==='CANCELLED').length,material:approved.filter(order=>order.qcStatus!=='QC_PASS').length,upload:approved.filter(order=>order.qcStatus==='WAITING_UPLOAD').length,review:approved.filter(order=>order.qcStatus==='WAITING_REVIEW').length,returned:approved.filter(order=>order.qcStatus==='QC_REJECTED').length});
    }).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[uid,revision,retry]);
  return <section className="page-surface member-overview">
    <div className="page-section-heading"><h2>我的委刊概況</h2><a className="page-text-link" href="#orders">我的委刊<ArrowRight size={17} aria-hidden="true"/></a></div>
    {error?<Alert title="無法載入委刊概況" actions={<button type="button" onClick={()=>setRetry(value=>value+1)}>重試</button>}>{error}</Alert>:!result?<p className="member-secondary">正在讀取委刊紀錄…</p>:<>
      <StatsAccordion label="我的委刊統計" items={[
        {id:'total',label:'全部委刊',value:result.total,unit:'筆',description:'目前這台裝置中，屬於你的委刊紀錄。',rows:[{label:'待審核',value:result.pending,unit:'筆'},{label:'已核准',value:result.approved,unit:'筆'},{label:'已駁回',value:result.rejected,unit:'筆'},{label:'已取消',value:result.cancelled,unit:'筆'}]},
        {id:'pending',label:'待審核',value:result.pending,unit:'筆',description:'申請已送出，等待管理人員審核；核准後才保留檔期。',children:<a className="page-text-link" href="#orders">查看委刊進度<ArrowRight size={17} aria-hidden="true"/></a>},
        {id:'material',label:'素材待完成',value:result.material,unit:'筆',description:'已核准且素材尚未通過的委刊，包含待上傳、待審查及退件。',rows:[{label:'待上傳',value:result.upload,unit:'筆'},{label:'待審查',value:result.review,unit:'筆'},{label:'素材退件',value:result.returned,unit:'筆'}]}
      ]}/>
      <p className="member-secondary">{result.total?'查看「我的委刊」可追蹤進度、選擇素材與查看審查結果。':'尚無委刊紀錄。先探索影城，選擇適合的投放地點與檔期。'}</p>
    </>}
  </section>;
}

export default function MemberArea({user,member,authLoading,configured,onLogin,onCart,cartCount,onPrivacy,onRetryMember,revision}){
  const signedIn=!!user,ready=signedIn&&!!member&&!authLoading,showDetails=signedIn&&!authLoading;
  return <main className="content-page member-page">
    <div className="content-page-inner">
      <header className="content-page-heading">
        <p className="content-page-kicker" lang="en">MEMBER CENTER</p>
        <h1 id="main-heading" tabIndex={-1}>會員專區</h1>
        <p>{signedIn?'管理你的帳戶，接續每一次投放計畫。':'登入後，一站查看委刊進度與素材審查結果。'}</p>
      </header>
      <div className={`member-layout${showDetails?'':' member-layout-single'}`}>
        <section className="member-identity">
          <span className="member-avatar" aria-hidden="true"><UserRound size={32}/></span>
          <p className="content-page-kicker">{signedIn?'歡迎回來':'專屬你的投放空間'}</p>
          <h2>{signedIn?member?.name||user.displayName||'會員':'從這裡，開始你的投放計畫。'}</h2>
          <p>{signedIn?user.email||member?.email||'未提供電子郵件':'使用 Google 帳號登入，串起影廳選購、委刊申請與素材管理。'}</p>
          {authLoading?<p className="member-auth-status">正在確認登入狀態…</p>:!signedIn?<>
            <button className="page-button page-button-light" type="button" onClick={onLogin} disabled={!configured} aria-describedby={!configured?'member-login-help':undefined}>使用 Google 帳號登入<ArrowRight size={18} aria-hidden="true"/></button>
            {!configured&&<p id="member-login-help" className="member-auth-status">會員登入尚未開放，請稍後再試。仍可探索影城與規劃投放。</p>}
          </>:<span className="member-role"><ShieldCheck size={16} aria-hidden="true"/>{ROLES[member?.role]||'帳戶資料待確認'}</span>}
          <button className="page-text-link" type="button" onClick={onPrivacy}>資料使用說明<ArrowRight size={17} aria-hidden="true"/></button>
        </section>
        {showDetails&&<div className="member-details">
          {ready?<>
            <section className="page-surface member-account">
              <div className="page-section-heading"><h2>帳戶資訊</h2><span>Google 登入</span></div>
              <dl className="member-account-fields"><div><dt>顯示名稱</dt><dd>{member.name||user.displayName||'會員'}</dd></div><div><dt>電子郵件</dt><dd>{user.email||member.email||'未提供'}</dd></div><div><dt>帳號身分</dt><dd>{ROLES[member.role]||'會員'}</dd></div><div><dt>電子郵件驗證</dt><dd>{user.emailVerified?'已驗證':'尚未驗證'}</dd></div></dl>
            </section>
            <OrderOverview uid={member.uid} revision={revision}/>
          </>:<Alert title="帳戶資料暫時無法讀取" actions={<button type="button" onClick={onRetryMember}>重新讀取帳戶</button>}>請重新讀取帳戶資料後，再查看委刊紀錄。</Alert>}
        </div>}
      </div>
      <section className="member-shortcuts">
        <h2>常用入口</h2>
        <div className="member-shortcut-grid">
          <a href="#explore"><Film size={23} aria-hidden="true"/><span><b>探索影城</b><small>查詢影廳與投放檔期</small></span><ArrowRight size={19} aria-hidden="true"/></a>
          <button type="button" onClick={onCart}><ShoppingCart size={23} aria-hidden="true"/><span><b>委刊清單</b><small>{cartCount?`已選 ${cartCount} 筆影廳`:'確認本次選購內容'}</small></span><ArrowRight size={19} aria-hidden="true"/></button>
          <a href="#promotions"><FileText size={23} aria-hidden="true"/><span><b>促銷活動</b><small>查看最新活動公告</small></span><ArrowRight size={19} aria-hidden="true"/></a>
          {ready&&member.role!=='buyer'&&<a href="#admin"><ShieldCheck size={23} aria-hidden="true"/><span><b>管理後台</b><small>依帳號權限處理營運工作</small></span><ArrowRight size={19} aria-hidden="true"/></a>}
        </div>
      </section>
      <p className="page-footnote">委刊與聯絡資料目前保存在這台裝置的瀏覽器，不會同步到其他裝置；清除網站資料會移除本機紀錄。</p>
    </div>
  </main>;
}
