import React,{useEffect,useState} from 'react';
import {Modal} from './ui.jsx';
import {Alert} from './feedback.jsx';
import {readVideoSpec,validateVideoSpec,videoSeconds,videoSize} from './video-spec.js';
export function MaterialSpec({material}){
  const spec=material?.spec;let error='';try{validateVideoSpec(spec);}catch(e){error=e.message;}
  return <section className="material-spec" aria-label="影片技術規格"><h3>影片基本規格</h3><dl><div><dt>片長</dt><dd>{videoSeconds(spec?.duration)}</dd></div><div><dt>檔案大小</dt><dd>{videoSize(material?.size??spec?.size)}</dd></div><div><dt>解析度</dt><dd>{spec?`${spec.width} × ${spec.height}`:'未讀取'}</dd></div><div><dt>格式</dt><dd>{spec?.type==='video/mp4'?'MP4':spec?.type==='video/quicktime'?'MOV':'未讀取'}</dd></div></dl><p className={error?'spec-fail':'spec-pass'} role="status">{error?`✕ ${error}`:'✓ 基本預檢符合：MP4／MOV，檔案不超過 500 MB。'}</p><p className="fine">影片片長不設上限；購買多檔代表重複投放。編碼、影格率、音訊與影城規格仍需人工確認。</p></section>;
}
export function MaterialUpload({order,file,close,confirm,busy}){
  const [spec,setSpec]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{let alive=true;readVideoSpec(file).then(data=>{if(!alive)return;setSpec(data);try{validateVideoSpec(data);}catch(e){setError(e.message);}}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[file]);
  return <Modal title="確認影片素材" close={close} canClose={!busy}><p>{order.cinemaName} · {order.hallName}</p><p className="material-filename">{file.name}</p>{loading?<p role="status">正在讀取影片片長與解析度…</p>:<>{spec&&<MaterialSpec material={{size:file.size,spec}}/>}{error&&<Alert title="素材無法提交">{error}</Alert>}</>}<p className="fine">確認後儲存本機素材資料，等待人工審核；影片檔案目前不會傳到雲端。</p><div className="actions"><button disabled={busy} onClick={close}>取消／重新選擇</button><button className="primary" disabled={busy||loading||!!error||!spec} onClick={()=>confirm(spec)}>確認提交素材</button></div></Modal>;
}
