import React from 'react';
import {ArrowRight,Ticket} from 'lucide-react';
import './pages.css';

export default function Promotions(){
  return <main className="content-page promotions-page">
    <div className="content-page-inner">
      <header className="content-page-heading">
        <p className="content-page-kicker" lang="en">NEWS & OFFERS</p>
        <h1 id="main-heading" tabIndex={-1}>促銷活動</h1>
        <p>影城廣告投放的最新活動與優惠資訊，都在這裡。</p>
      </header>
      <section className="page-surface promotion-board">
          <div className="page-section-heading"><h2>最新活動</h2><span>0 則活動</span></div>
          <div className="promotion-empty">
            <span className="page-symbol"><Ticket size={34} aria-hidden="true"/></span>
            <h3>目前尚無已發布的促銷活動</h3>
            <p>後續優惠與適用條件將於此公告。<br/>你可以先探索影城，規劃投放地點與檔期。</p>
            <a className="page-button" href="#explore">探索影城<ArrowRight size={18} aria-hidden="true"/></a>
          </div>
      </section>
      <p className="page-footnote">影廳價格與可用檔期以「探索影城」查詢結果為準；委刊申請須經審核確認後才成立。</p>
    </div>
  </main>;
}
