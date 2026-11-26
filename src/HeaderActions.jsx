import React from 'react';
import {ShoppingCart,UserRound,LogOut} from 'lucide-react';
import {Tooltip} from './feedback.jsx';

export default function HeaderActions({user,member,roleLabel,authLoading,configured,busy,cartCount,cartPulse,cartOpen,loginOpen,onCart,onLogin,onLogout}){
  const name=member?.name||user?.displayName||'會員';
  const initial=Array.from(name.trim())[0]||'會';
  return <div className={`account header-actions${user?' is-signed-in':''}`} role="group" aria-label="選購與會員">
    <Tooltip text="查看影廳、檔期與估算金額">
      <button type="button" className="header-action header-cart" onClick={onCart} aria-haspopup="dialog" aria-expanded={cartOpen} aria-label={`開啟選購清單，已選 ${cartCount} 筆影廳`}>
        <span className="cart-glyph" key={cartPulse}><ShoppingCart size={21} aria-hidden="true"/></span>
        <span><span className="header-cart-prefix">選購</span>清單</span><span className={`header-cart-count${cartCount?' has-items':''}`} aria-hidden="true">{cartCount}</span>
      </button>
    </Tooltip>
    {user?<>
      <a href="#member" className="header-action header-member" aria-label={`會員專區：${name}，${roleLabel}`}>
        <span className="header-avatar" aria-hidden="true">{initial}</span>
        <span className="header-member-copy"><strong>{name}</strong><small>{roleLabel}</small></span>
      </a>
      <Tooltip text="登出目前帳號"><button type="button" className="header-action header-logout" aria-label="登出" disabled={busy} onClick={onLogout}><LogOut size={20} aria-hidden="true"/></button></Tooltip>
    </>:<button type="button" className="header-action header-login" disabled={authLoading||!configured} aria-busy={authLoading||undefined} aria-haspopup="dialog" aria-expanded={loginOpen} onClick={onLogin}><UserRound size={20} aria-hidden="true"/><span>{authLoading?'連線中…':'會員登入'}</span></button>}
  </div>;
}
