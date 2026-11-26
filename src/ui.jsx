import React,{createContext,useContext,useEffect,useId,useRef,useState} from 'react';
import {Film,X} from 'lucide-react';
import {Alert} from './feedback.jsx';
import {useSurfaceMotion} from './motion.js';
export const FeedbackContext=createContext(null);
const ValidationContext=createContext(()=>{});
export function FormFeedback({children}){
  const [announcement,setAnnouncement]=useState(''),timer=useRef(null);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  const announce=text=>{
    clearTimeout(timer.current);setAnnouncement('');
    if(text)timer.current=setTimeout(()=>setAnnouncement(text),500);
  };
  return <ValidationContext.Provider value={announce}>{children}<div className="visually-hidden" role="status" aria-atomic="true">{announcement}</div></ValidationContext.Provider>;
}
export const money=n=>Number.isFinite(n)?`NT$ ${n.toLocaleString()}`:'待設定價格';
export const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'});
export function Field({label,children,hint,errorMessage,...props}){
  const generatedId=useId(),[error,setError]=useState(''),announce=useContext(ValidationContext),frame=useRef(null),lastAnnounced=useRef('');
  const control=children||<input {...props}/>,native=React.isValidElement(control)&&['input','select','textarea'].includes(control.type);
  const settings=native?control.props:{},id=settings.id||generatedId,errorId=`${id}-error`,hintId=`${id}-hint`;
  const constrained=settings.required||settings.pattern||settings.min!=null||settings.max!=null||settings.minLength||['email','url'].includes(settings.type);
  useEffect(()=>()=>cancelAnimationFrame(frame.current),[]);
  const sync=(element,shouldAnnounce=false,submitted=false)=>{
    cancelAnimationFrame(frame.current);
    // The browser updates :user-invalid after blur/invalid dispatch, so read it in the next frame.
    frame.current=requestAnimationFrame(()=>{
      if(!element.isConnected)return;
      const message=element.matches(':user-invalid')?(errorMessage||element.validationMessage):'';
      setError(message);
      if(submitted)lastAnnounced.current=message; // Native invalid-submit focus reads the description.
      if(shouldAnnounce&&message&&message!==lastAnnounced.current){announce(`${label}：${message}`);lastAnnounced.current=message;}
      if(!message){lastAnnounced.current='';if(error)announce('');}
    });
  };
  const describedBy=[settings['aria-describedby'],hint&&hintId,error&&errorId].filter(Boolean).join(' ')||undefined;
  const input=native?React.cloneElement(control,{
    id,'aria-invalid':error?'true':settings['aria-invalid']||'false','aria-describedby':describedBy,
    onBlur:e=>{settings.onBlur?.(e);sync(e.currentTarget,true);},
    onChange:e=>{settings.onChange?.(e);sync(e.currentTarget);},
    onInvalid:e=>{settings.onInvalid?.(e);sync(e.currentTarget,false,true);}
  }):control;
  return <div className="field"><label htmlFor={id}>{label}{settings.required&&<small className="required-mark" aria-hidden="true">必填</small>}</label>{hint&&<small className="field-hint" id={hintId}>{hint}</small>}{input}{constrained&&<small className={`field-error ${error?'is-visible':''}`} id={errorId}>{error||'\u00a0'}</small>}</div>;
}
export function Empty({children}){return <div className="empty"><Film/><p>{children}</p></div>;}
export function Modal({title,close,children,canClose=true,className=''}){
  const box=useRef(null),closeRef=useRef(close),canCloseRef=useRef(canClose),pressedOutside=useRef(null),titleId=useId(),feedback=useContext(FeedbackContext);
  const motion=useSurfaceMotion(box,'modal');
  closeRef.current=close;canCloseRef.current=canClose;
  const requestClose=()=>{
    if(!canCloseRef.current)return;
    const finish=()=>{if(canCloseRef.current)box.current?.close();else motion.current?.reset();};
    if(motion.current)motion.current.exit(finish);else finish();
  };
  useEffect(()=>{
    const dialog=box.current;
    // A cleanup close event may arrive after Strict Mode has reopened the same element.
    const closed=()=>{if(dialog.open)return;dialog.returnValue='';closeRef.current();};
    const cancel=e=>{e.preventDefault();requestClose();};
    dialog.addEventListener('close',closed);dialog.addEventListener('cancel',cancel);
    dialog.showModal();motion.current?.enter();
    return()=>{dialog.removeEventListener('close',closed);dialog.removeEventListener('cancel',cancel);dialog.close();};
  },[]);
  const outside=e=>{const r=box.current.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
  return <dialog ref={box} className={`modal ${className}`} aria-labelledby={titleId} closedby={canClose?'any':'none'}
    onPointerDown={e=>{if(!('closedBy' in HTMLDialogElement.prototype))pressedOutside.current=outside(e)?e.pointerId:null;}}
    onPointerUp={e=>{if(!('closedBy' in HTMLDialogElement.prototype)&&canClose&&pressedOutside.current===e.pointerId&&outside(e))requestClose();pressedOutside.current=null;}}
    onPointerCancel={()=>{pressedOutside.current=null;}}>
    <header><h2 id={titleId}>{title}</h2><button type="button" className="icon" disabled={!canClose} autoFocus onClick={requestClose} aria-label="關閉"><X size={20} aria-hidden="true"/></button></header>
    <FormFeedback>{feedback?.notice?.error&&<Alert title="操作未完成" onDismiss={feedback.dismiss}>{feedback.notice.text}</Alert>}{children}{feedback?.busy&&<p role="status">處理中，請稍候…</p>}</FormFeedback>
  </dialog>;
}
export function SelectionCheck({state,...props}){const ref=useRef(null);useEffect(()=>{if(ref.current)ref.current.indeterminate=!!state.partial;},[state.partial]);return <input ref={ref} type="checkbox" checked={state.full} aria-checked={state.partial?'mixed':state.full} {...props}/>;}
