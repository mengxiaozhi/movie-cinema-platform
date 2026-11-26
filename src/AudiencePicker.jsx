import React,{useState} from 'react';
import {Field,Modal} from './ui.jsx';
import {AVAILABLE_TAGS} from './data/tags.js';
export default function AudiencePicker({selected,apply,close,resultCount,tags=AVAILABLE_TAGS}){
  const [query,setQuery]=useState(''),[category,setCategory]=useState('全部');
  const visible=tags.filter(t=>(category==='全部'||t.category===category)&&t.name.includes(query.trim()));
  return <Modal title="選擇受眾標籤" close={close}><Field label="搜尋受眾標籤" value={query} onChange={e=>setQuery(e.target.value)} placeholder="白領、親子、商圈…"/><div className="tag-categories">{['全部',...new Set(tags.map(t=>t.category))].map(c=><button key={c} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div><p className="fine">可複選，勾選即更新搜尋結果；符合任一已選標籤的影城都會列出。</p><p className="fine" role="status">已選 {selected.length} 個標籤，共 {resultCount} 間影城。</p><div className="tag-options">{visible.map(t=><label className="tag-option" key={t.id}><input type="checkbox" checked={selected.includes(t.id)} onChange={e=>apply(e.target.checked?[...selected,t.id]:selected.filter(id=>id!==t.id))}/><span>{t.name}<small>{t.category}</small></span></label>)}</div>{!visible.length&&<p>沒有符合的標籤。</p>}<div className="tag-actions"><button type="button" onClick={()=>apply([])}>清除選擇</button><button type="button" className="primary" onClick={close}>完成（{selected.length}）</button></div></Modal>;
}
