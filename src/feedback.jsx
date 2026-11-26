import React,{useEffect,useId,useRef,useState} from 'react';
import {CircleAlert,CircleCheck,Info,X} from 'lucide-react';
import {ensureInterest,ensurePopovers,isPopoverOpen,useModalPresence,useOverlayPosition} from './overlay-platform.js';
import {useRevealMotion,useSurfaceMotion} from './motion.js';

export function Alert({title,children,variant='error',onDismiss,actions,announce=true,className=''}){
  const ref=useRef(null);useRevealMotion(ref,{kind:'alert'});
  const Icon=variant==='error'||variant==='warning'?CircleAlert:Info;
  const dismiss=e=>{
    const focused=document.activeElement===e.currentTarget,scope=e.currentTarget.closest('dialog')||document;
    const fallback=scope.querySelector('input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')||document.querySelector('main [tabindex="-1"]');
    onDismiss();if(focused)requestAnimationFrame(()=>{if(document.activeElement===document.body)fallback?.focus();});
  };
  return <div ref={ref} className={`feedback-alert ${variant} ${className}`} role={announce?(variant==='error'?'alert':'status'):'note'}>
    <Icon size={21} aria-hidden="true"/><div className="alert-content">{title&&<strong>{title}</strong>}<div>{children}</div>{actions&&<div className="alert-actions">{actions}</div>}</div>
    {onDismiss&&<button type="button" className="feedback-close" onClick={dismiss} aria-label="關閉通知"><X size={18} aria-hidden="true"/></button>}
  </div>;
}

export function Tooltip({text,children,toggle=false}){
  const id=useId(),anchor=`--hint-${id.replace(/[^a-z0-9-]/gi,'')}`,[trigger,setTrigger]=useState(null),[popup,setPopup]=useState(null),[open,setOpen]=useState(false),[ready,setReady]=useState(false);
  const ownName=children.props['aria-label'],describedBy=[children.props['aria-describedby'],!toggle&&text!==ownName?id:null].filter(Boolean).join(' ')||undefined;
  useEffect(()=>{let active=true;ensureInterest().then(()=>{if(active)setReady(true);});return()=>{active=false;};},[]);
  useEffect(()=>{
    if(!popup)return;
    const sync=e=>setOpen(e.newState==='open');
    // Older Safari treats hint as manual; toggletips still need native light dismissal.
    const before=e=>{if(toggle&&e.newState==='open'&&popup.popover!=='hint')popup.setAttribute('popover','auto');};
    popup.addEventListener('toggle',sync);popup.addEventListener('beforetoggle',before);
    setOpen(isPopoverOpen(popup));
    return()=>{popup.removeEventListener('toggle',sync);popup.removeEventListener('beforetoggle',before);};
  },[popup,toggle]);
  useOverlayPosition(trigger,popup,open);
  return <>{React.cloneElement(children,{
    ref:setTrigger,interestfor:ready?id:undefined,
    ...(toggle?{popoverTarget:id,popoverTargetAction:'show','aria-expanded':open}:{}),
    'aria-describedby':describedBy,style:{...children.props.style,anchorName:anchor}
  })}<span ref={setPopup} id={id} className="ui-tooltip anchored-overlay" popover="hint" role="tooltip" style={{positionAnchor:anchor}}>{text}</span></>;
}

export function Toast({message,onDismiss,duration=4000}){
  const ref=useRef(null),dismissRef=useRef(onDismiss),previousFocus=useRef(null),remaining=useRef(duration),announced=useRef(null);
  const motion=useSurfaceMotion(ref,'toast'),lastMessage=useRef(message);
  if(message)lastMessage.current=message;
  const modalOpen=useModalPresence(),[visible,setVisible]=useState(false),[hover,setHover]=useState(false),[focus,setFocus]=useState(false),[hidden,setHidden]=useState(document.hidden),[announcement,setAnnouncement]=useState('');
  dismissRef.current=onDismiss;
  useEffect(()=>{const update=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
  useEffect(()=>{remaining.current=duration;},[message?.id,duration]);
  useEffect(()=>{
    const popup=ref.current;let active=true,timer;
    const hide=()=>{if(isPopoverOpen(popup))popup.hidePopover();setVisible(false);setAnnouncement('');};
    if(modalOpen){motion.current?.reset();hide();return;}
    if(!message){if(isPopoverOpen(popup)&&motion.current)motion.current.exit(hide);else hide();return;}
    ensurePopovers().then(()=>{
      if(!active)return;
      // Let native dialog focus restoration finish before announcing queued feedback.
      timer=setTimeout(()=>{
        if(!active||document.querySelector('dialog[open]'))return;
        previousFocus.current=document.activeElement;
        if(!isPopoverOpen(popup))popup.showPopover();motion.current?.enter();setVisible(true);
        if(announced.current!==message.id){
          announced.current=message.id;
          if(typeof document.ariaNotify==='function')document.ariaNotify(message.text,{priority:'normal'});
          else setAnnouncement(message.text);
        }
      },350);
    });
    return()=>{active=false;clearTimeout(timer);};
  },[message?.id,modalOpen]);
  useEffect(()=>{
    if(!message||!visible||hover||focus||hidden||modalOpen)return;
    const start=performance.now(),timer=setTimeout(()=>dismissRef.current(),remaining.current);
    return()=>{clearTimeout(timer);remaining.current=Math.max(0,remaining.current-(performance.now()-start));};
  },[message?.id,visible,hover,focus,hidden,modalOpen]);
  const dismiss=()=>{
    if(ref.current.contains(document.activeElement)){
      const previous=previousFocus.current;
      if(previous?.isConnected&&previous!==document.body)previous.focus();
      else document.querySelector('main [tabindex="-1"],main button')?.focus();
    }
    onDismiss();
  };
  return <><div className="visually-hidden" role="status" aria-atomic="true">{announcement}</div><div ref={ref} popover="manual" role="region" aria-label="操作通知" className="ui-toast"
    onPointerEnter={()=>setHover(true)} onPointerLeave={()=>setHover(false)} onFocusCapture={()=>setFocus(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setFocus(false);}}>
    <CircleCheck size={21} aria-hidden="true"/><span>{message?.text??lastMessage.current?.text}</span><button type="button" className="feedback-close" onClick={dismiss} aria-label="關閉通知"><X size={18} aria-hidden="true"/></button>
  </div></>;
}
