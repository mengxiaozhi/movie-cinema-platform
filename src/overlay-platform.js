import {useEffect,useLayoutEffect,useState} from 'react';

let popoversReady,interestReady;
export function ensurePopovers(){
  return popoversReady??=Object.hasOwn(HTMLElement.prototype,'popover')?Promise.resolve():import('@oddbird/popover-polyfill');
}
export async function ensureInterest(){
  await ensurePopovers();
  return interestReady??=('interestForElement' in HTMLButtonElement.prototype)?Promise.resolve():import('interestfor');
}
export function isPopoverOpen(element){return !!element?.matches(':is(:popover-open, .\\:popover-open)');}
export function useModalPresence(){
  const [open,setOpen]=useState(()=>!!document.querySelector('dialog[open]'));
  useEffect(()=>{
    const update=()=>setOpen(!!document.querySelector('dialog[open]'));
    const observer=new MutationObserver(update);
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
    update();return()=>observer.disconnect();
  },[]);
  return open;
}
// Limit long overlays to the space on either side of the trigger; keep JS tethering as a fallback.
export function useOverlayPosition(trigger,popup,open){
  useLayoutEffect(()=>{
    if(!open||!trigger||!popup)return;
    const native=CSS.supports('position-area: block-end');
    const position=()=>{
      if(!trigger.isConnected)return;
      if(popup.classList.contains('ui-popconfirm')&&matchMedia('(max-width:650px)').matches){
        for(const property of ['left','top','max-block-size'])popup.style.removeProperty(property);
        return; // Narrow screens use the fixed confirmation sheet defined in CSS.
      }
      const r=trigger.getBoundingClientRect(),gap=12;
      popup.style.maxBlockSize=`${Math.max(80,Math.min(innerHeight-gap*2,Math.max(r.top,innerHeight-r.bottom)-gap*2))}px`;
      if(native)return;
      const p=popup.getBoundingClientRect();
      popup.style.left=`${Math.max(gap,Math.min(r.right-p.width,innerWidth-p.width-gap))}px`;
      popup.style.top=`${Math.max(gap,r.bottom+p.height+gap<innerHeight?r.bottom+gap:r.top-p.height-gap)}px`;
    };
    position();const resize=new ResizeObserver(position);resize.observe(popup);
    window.addEventListener('resize',position);window.addEventListener('scroll',position,true);
    return()=>{resize.disconnect();window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);};
  },[trigger,popup,open]);
}
