import React,{useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {Menu,ShieldCheck} from 'lucide-react';
import {ensurePopovers,isPopoverOpen} from './overlay-platform.js';

export default function SiteNavigation({view,member,admin}){
  const navRef=useRef(null),listRef=useRef(null),id=useId();
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    let active=true;
    ensurePopovers().then(()=>{if(active)setReady(true);});
    return()=>{active=false;};
  },[]);
  useLayoutEffect(()=>{
    const nav=navRef.current,list=listRef.current,header=nav.parentElement;
    let frame,lastWidth=-1,wide=false;
    const measure=()=>{
      const width=header.clientWidth;
      nav.style.setProperty('--site-nav-top',`${header.getBoundingClientRect().bottom+8}px`);
      if(!wide&&width<=lastWidth)return;
      lastWidth=width;
      const open=isPopoverOpen(list);
      header.classList.add('measuring-navigation');
      nav.classList.add('is-wide');
      list.removeAttribute('popover');
      wide=header.scrollWidth<=header.clientWidth;
      nav.classList.toggle('is-wide',wide);
      if(!wide){
        list.setAttribute('popover','auto');
        if(open&&ready)list.showPopover();
      }
      header.classList.remove('measuring-navigation');
      nav.style.setProperty('--site-nav-top',`${header.getBoundingClientRect().bottom+8}px`);
    };
    const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
    measure();
    const observer=new ResizeObserver(schedule);
    observer.observe(header);observer.observe(list);
    return()=>{observer.disconnect();cancelAnimationFrame(frame);};
  },[!!member,!!admin,ready]);
  const close=()=>{if(isPopoverOpen(listRef.current))listRef.current.hidePopover();};
  const link=(key,label,icon)=> <li key={key}><a href={key==='portal'?'#explore':`#${key}`} aria-current={view===key?'page':undefined} onClick={close}>{icon}{label}</a></li>;
  return <nav ref={navRef} className="site-navigation" aria-label="主要">
    <button className="site-menu-trigger" type="button" popoverTarget={id} aria-controls={id} disabled={!ready}><Menu size={21} aria-hidden="true"/>選單</button>
    <ul ref={listRef} id={id} className="site-navigation-list" popover="auto">
      {link('portal','探索影城')}
      {link('promotions','促銷活動')}
      {link('member','會員專區')}
      {member&&link('orders','我的委刊')}
      {admin&&link('admin','管理後台',<ShieldCheck size={17} aria-hidden="true"/>)}
    </ul>
  </nav>;
}
