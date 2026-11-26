import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';

const TITLES={portal:'探索影城',promotions:'促銷活動',member:'會員專區',orders:'我的委刊',admin:'管理後台'};
function currentView(){
  const key=window.location.hash.slice(1);
  return Object.hasOwn(TITLES,key)?key:'portal';
}

export function usePageNavigation(){
  const [view,updateView]=useState(currentView);
  const previous=useRef(view);
  useEffect(()=>{
    const sync=()=>{
      const hash=window.location.hash.slice(1);
      // In-page anchors, including the skip link, must not change the page.
      if(!hash||hash==='explore'||Object.hasOwn(TITLES,hash))updateView(currentView());
    };
    window.addEventListener('hashchange',sync);
    return()=>window.removeEventListener('hashchange',sync);
  },[]);
  useLayoutEffect(()=>{
    document.title=`${TITLES[view]}｜亞加媒體通路`;
    if(previous.current===view)return;
    previous.current=view;
    document.getElementById('main-heading')?.focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'instant'});
  },[view]);
  const navigate=useCallback(next=>{
    if(!Object.hasOwn(TITLES,next))return;
    const hash=next==='portal'?'#explore':`#${next}`;
    if(window.location.hash!==hash)window.location.hash=hash;
    else updateView(next);
  },[]);
  return [view,navigate];
}
