import React,{useEffect,useRef,useState} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {cityColor,pinSVG,located} from './map-markers.js';

export default function CinemaMap({cinemas,selected,onToggle,onSelectMany,focusId,selectionReady=true,partial=[]}){
  const host=useRef(null),map=useRef(null),layer=useRef(null),markers=useRef(new Map()),callbacks=useRef({onToggle,onSelectMany}),[tileError,setTileError]=useState(false);
  callbacks.current={onToggle,onSelectMany};
  useEffect(()=>{
    const m=L.map(host.current,{scrollWheelZoom:true,dragging:true,doubleClickZoom:true,touchZoom:true,keyboard:true}).setView([23.8,121],7);map.current=m;
    L.tileLayer(import.meta.env.VITE_MAP_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'}).on('tileerror',()=>setTileError(true)).addTo(m);
    layer.current=L.layerGroup().addTo(m);const observer=new ResizeObserver(()=>m.invalidateSize());observer.observe(host.current);
    return()=>{observer.disconnect();m.remove();map.current=null;};
  },[]);
  // Fit only when search results change, so selecting a marker preserves the map position.
  const locations=cinemas.filter(located),key=locations.map(c=>`${c.id}:${c.lat}:${c.lng}`).join('|');
  useEffect(()=>{if(locations.length)map.current.fitBounds(locations.map(c=>[c.lat,c.lng]),{padding:[45,45],maxZoom:13});},[key]);
  useEffect(()=>{
    const openId=[...markers.current].find(([,m])=>m.isPopupOpen())?.[0];
    layer.current.clearLayers();
    markers.current.clear();
    locations.forEach(c=>{
      const chosen=selected.includes(c.id),mixed=partial.includes(c.id),popup=document.createElement('div');popup.className='map-popup';
      const title=document.createElement('strong');title.textContent=c.name;popup.append(title);
      const text=document.createElement('p');text.textContent=`${c.city} ${c.district} · ${c.halls.length} 個影廳`;popup.append(text);
      const address=document.createElement('p');address.textContent=c.address;popup.append(address);
      const button=document.createElement('button');button.type='button';button.disabled=!selectionReady;button.textContent=chosen?'✓ 全廳已加入・取消全廳':mixed?'＋ 補齊本影城影廳':'＋ 全部影廳各加入 1 檔';button.setAttribute('aria-pressed',String(chosen));button.onclick=()=>callbacks.current.onToggle(c.id);popup.append(button);if(mixed){const cancel=document.createElement('button');cancel.textContent='取消本影城全部';cancel.type='button';cancel.onclick=()=>callbacks.current.onToggle(c.id,false);popup.append(cancel);}
      const marker=L.marker([c.lat,c.lng],{title:`${c.name}（${c.city}）`,alt:c.name,icon:L.divIcon({className:`cinema-pin-host ${chosen?'is-chosen':''}`,html:pinSVG(c.city,chosen,mixed),iconSize:[42,54],iconAnchor:[21,51],popupAnchor:[0,-46]})}).bindPopup(popup).addTo(layer.current);
      marker.getElement()?.setAttribute('aria-label',`${c.name}，${c.city}，${chosen?'全廳已加入':mixed?'部分影廳已加入':'未選取'}`);
      markers.current.set(c.id,marker);if(c.id===openId)marker.openPopup();
    });
  },[key,selected,selectionReady,partial]);
  useEffect(()=>{const marker=markers.current.get(focusId?.id);if(marker){marker.openPopup();map.current.panTo(marker.getLatLng());}},[focusId,key]);
  return <div className="map-panel"><div className="map-wrap"><div className="cinema-map" ref={host} role="region" aria-label="影城多選地圖"/><button className="map-select-area" disabled={!selectionReady} onClick={()=>callbacks.current.onSelectMany(locations.filter(c=>map.current.getBounds().contains([c.lat,c.lng])).map(c=>c.id))}>選取此範圍影城</button>{tileError&&<div className="map-warning" role="status">底圖暫時無法載入，仍可使用左側清單選擇影城。</div>}</div><div className="map-legend" aria-label="縣市圖釘顏色">{[...new Set(locations.map(c=>c.city))].map(city=><span key={city}><i style={{background:cityColor(city)}}/>{city}</span>)}<span className="legend-selected">✓ 全廳已加入　− 部分已加入</span></div><p className="map-help"><span className="desktop-map-help">滾輪縮放 · 按住拖曳移動 · 雙擊放大</span><span className="mobile-map-help">雙指縮放 · 拖曳移動</span></p></div>;
}
