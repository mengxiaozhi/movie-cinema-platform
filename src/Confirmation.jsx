import React,{createContext,useCallback,useContext,useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {CircleAlert} from 'lucide-react';
import {Modal} from './ui.jsx';
import {ensurePopovers,isPopoverOpen,useOverlayPosition} from './overlay-platform.js';
import {useSurfaceMotion} from './motion.js';

const ConfirmationContext=createContext(null);
export const useConfirm=()=>useContext(ConfirmationContext);
export function ConfirmationProvider({children}){
  const [request,setRequest]=useState(null),pending=useRef(null);
  const finish=useCallback(value=>{const current=pending.current;pending.current=null;setRequest(null);current?.resolve(value);},[]);
  const ask=useCallback((options,source)=>new Promise(resolve=>{
    pending.current?.resolve(false);
    const trigger=source instanceof HTMLElement?source:document.activeElement;
    const item={...options,trigger,host:trigger?.closest('dialog[open]')||document.body,resolve};
    pending.current=item;setRequest(item);
  }),[]);
  useEffect(()=>()=>pending.current?.resolve(false),[]);
  return <ConfirmationContext.Provider value={ask}>{children}{request&&createPortal(request.kind==='modal'?<Modal title={request.title} close={()=>finish(false)}>
    <p className="confirmation-description">{request.description}</p><div className="confirmation-actions"><button type="button" onClick={()=>finish(false)}>取消</button><button type="button" className={request.danger?'danger-button':'primary'} onClick={()=>finish(true)}>{request.confirmLabel||'確認'}</button></div>
  </Modal>:<Popconfirm request={request} finish={finish}/>,request.host)}</ConfirmationContext.Provider>;
}
function Popconfirm({request,finish}){
  const ref=useRef(null),cancel=useRef(null),id=useId(),anchor=`--confirm-${id.replace(/[^a-z0-9-]/gi,'')}`,[open,setOpen]=useState(false);
  const motion=useSurfaceMotion(ref,'popover');
  const choose=value=>{if(motion.current)motion.current.exit(()=>finish(value));else finish(value);};
  useOverlayPosition(request.trigger,ref.current,open);
  useEffect(()=>{
    const popup=ref.current,trigger=request.trigger;let active=true;
    const originalAnchor=trigger?.style.anchorName,controls=trigger?.getAttribute('aria-controls'),expanded=trigger?.getAttribute('aria-expanded');
    if(trigger){trigger.style.anchorName=anchor;trigger.setAttribute('aria-controls',id);trigger.setAttribute('aria-expanded','true');}
    const sync=e=>{setOpen(e.newState==='open');if(e.newState==='closed'&&active)finish(false);};
    const parentClosed=()=>finish(false);
    popup.addEventListener('toggle',sync);request.host.addEventListener('close',parentClosed);
    ensurePopovers().then(()=>{if(active&&trigger?.isConnected){popup.showPopover({source:trigger});motion.current?.enter();cancel.current?.focus();setOpen(true);}else if(active)finish(false);});
    return()=>{
      active=false;popup.removeEventListener('toggle',sync);request.host.removeEventListener('close',parentClosed);
      const restoreFocus=popup.contains(document.activeElement)||document.activeElement===document.body;
      if(isPopoverOpen(popup))popup.hidePopover();
      if(trigger){trigger.style.anchorName=originalAnchor||'';for(const [key,value] of [['aria-controls',controls],['aria-expanded',expanded]]){if(value==null)trigger.removeAttribute(key);else trigger.setAttribute(key,value);}}
      if(restoreFocus){if(trigger?.isConnected)trigger.focus();else if(request.host.isConnected&&request.host!==document.body)request.host.querySelector('button:not(:disabled)')?.focus();}
    };
  },[request,finish,id,anchor]);
  return <div ref={ref} id={id} popover="auto" className="ui-popconfirm anchored-overlay" role="dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} style={{positionAnchor:anchor}}>
    <div className="popconfirm-heading"><CircleAlert size={21} aria-hidden="true"/><h2 id={`${id}-title`}>{request.title}</h2></div><p id={`${id}-description`}>{request.description}</p>
    <div className="confirmation-actions"><button ref={cancel} type="button" onClick={()=>choose(false)}>保留</button><button type="button" className={request.danger?'danger-button':'primary'} onClick={()=>choose(true)}>{request.confirmLabel||'確認'}</button></div>
  </div>;
}
