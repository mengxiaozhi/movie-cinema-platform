import {useLayoutEffect,useRef} from 'react';
import {gsap} from 'gsap';
import {CustomEase} from 'gsap/CustomEase';

gsap.registerPlugin(CustomEase);
const ease=CustomEase.create('cinema-ui-out','0.23,1,0.32,1');
const profiles={
  content:{duration:.2,y:8},
  media:{duration:.24},
  alert:{duration:.16},
  modal:{duration:.24,y:12,scale:.98},
  popover:{duration:.16,y:6},
  toast:{duration:.2,y:8}
};

// Each surface owns its tweens. Reverting restores its original inline styles,
// including anchor positioning, instead of leaving animation transforms behind.
function surfaceMotion(element,kind,delay=0){
  const profile=profiles[kind],preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  let context,tween,goal,disposed=false;
  const restore=()=>{context?.revert();context=null;tween=null;};
  const animate=(opening,done)=>{
    if(disposed)return;
    if(opening&&goal==='open')return;
    if(!opening&&goal==='closed')return;
    const keyboard=document.activeElement?.matches(':focus-visible');
    const moving=!preference.matches;
    const current=tween?.isActive()?{
      opacity:Number(gsap.getProperty(element,'opacity')),
      ...(profile.y?{y:Number(gsap.getProperty(element,'y'))}:{}),
      ...(profile.scale?{scale:Number(gsap.getProperty(element,'scaleX'))}:{})
    }:null;
    restore();goal=opening?'open':'closed';
    if(keyboard||(!opening&&getComputedStyle(element).display==='none')){done?.();return;}
    const rest={opacity:1,...(profile.y?{y:0}:{}),...(profile.scale?{scale:1}:{})};
    const hidden={opacity:0,...(profile.y?{y:moving?profile.y:0}:{}),...(profile.scale?{scale:moving?profile.scale:1}:{})};
    context=gsap.context(()=>{
      tween=gsap.fromTo(element,current||(opening?hidden:rest),{
        ...(opening?rest:hidden),duration:preference.matches?.1:opening?profile.duration:.16,
        delay:opening&&!current&&!preference.matches?delay:0,ease,overwrite:'auto',
        onComplete:()=>{restore();done?.();}
      });
    },element);
  };
  // A live preference change settles the current state, including pending exits.
  const settle=()=>tween?.progress(1);
  preference.addEventListener('change',settle);
  return {
    enter:()=>animate(true),
    exit:done=>animate(false,done),
    reset:()=>{restore();goal=null;},
    dispose:()=>{disposed=true;preference.removeEventListener('change',settle);restore();}
  };
}

export function useSurfaceMotion(ref,kind){
  const motion=useRef(null);
  useLayoutEffect(()=>{
    if(!ref.current)return;
    const instance=surfaceMotion(ref.current,kind);motion.current=instance;
    return()=>{instance.dispose();motion.current=null;};
  },[ref,kind]);
  return motion;
}

export function useRevealMotion(ref,{kind='content',selector,revision,skipInitial=false,stagger=0}={}){
  const previous=useRef(revision);
  useLayoutEffect(()=>{
    if(skipInitial&&previous.current===revision)return;
    previous.current=revision;
    if(!ref.current)return;
    const targets=selector?[...ref.current.querySelectorAll(selector)]:[ref.current];
    const instances=targets.map((element,index)=>surfaceMotion(element,kind,Math.min(index,2)*stagger));
    instances.forEach(instance=>instance.enter());
    return()=>instances.forEach(instance=>instance.dispose());
  },[ref,kind,selector,revision,skipInitial,stagger]);
}
