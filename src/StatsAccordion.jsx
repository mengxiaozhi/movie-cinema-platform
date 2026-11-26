import React,{useRef} from 'react';
import {ChevronDown} from 'lucide-react';
import './stats-accordion.css';

/**
 * items: [{id, label, value, unit?, description?, rows?: [{label, value, unit?}], children?}]
 * Use stable item IDs. defaultOpenIds sets the initial state; native details owns
 * subsequent toggles, including keyboard activation and find-in-page reveals.
 */
export default function StatsAccordion({items=[],label='Statistics',defaultOpenIds=[],className=''}){
  const initiallyOpen=useRef(new Set(defaultOpenIds));
  const closing=useRef(new WeakMap());
  const handleToggle=event=>{
    const details=event.currentTarget,content=details.querySelector(':scope > .stats-accordion-content'),token={};
    closing.current.set(details,token);
    if(!details.open&&content.contains(document.activeElement))details.querySelector('summary').focus();
    content.inert=!details.open;
    if(details.open)return;
    // Closing content stays painted for the transition, but its controls must
    // leave the tab order immediately. Restore native find-in-page afterwards.
    const finish=()=>{
      if(!details.isConnected||closing.current.get(details)!==token)return;
      if(getComputedStyle(details,'::details-content').contentVisibility!=='hidden'&&content.getBoundingClientRect().height>0){requestAnimationFrame(finish);return;}
      content.inert=false;
    };
    requestAnimationFrame(finish);
  };
  const prepareToggle=event=>{
    const summary=event.currentTarget,details=summary.parentElement,content=details.querySelector(':scope > .stats-accordion-content');
    if(details.open&&content.contains(document.activeElement))summary.focus();
    content.inert=details.open;
  };
  return <div className={`stats-accordion ${className}`.trim()} role="group" aria-label={label}>
    {items.map(item=><details key={item.id} className="stats-accordion-item" open={initiallyOpen.current.has(item.id)} onToggle={handleToggle}>
      <summary className="stats-accordion-trigger" onClick={prepareToggle}>
        <ChevronDown className="stats-accordion-chevron" size={18} aria-hidden="true" focusable="false"/>
        <span className="stats-accordion-label">{item.label}</span>
        <span className="stats-accordion-value">{item.value}{item.unit&&<small>{item.unit}</small>}</span>
      </summary>
      <div className="stats-accordion-content">
        <div className="stats-accordion-body">
          {item.description&&<p>{item.description}</p>}
          {!!item.rows?.length&&<dl className="stats-accordion-breakdown">{item.rows.map(row=><div key={row.label}>
            <dt>{row.label}</dt><dd>{row.value}{row.unit&&<small>{row.unit}</small>}</dd>
          </div>)}</dl>}
          {item.children&&<div className="stats-accordion-extra">{item.children}</div>}
        </div>
      </div>
    </details>)}
  </div>;
}
