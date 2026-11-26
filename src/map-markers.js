export const located=c=>Number.isFinite(c.lat)&&Number.isFinite(c.lng)&&c.lat>=-90&&c.lat<=90&&c.lng>=-180&&c.lng<=180;
const cities=['台北市','新北市','桃園市','台中市','台南市','高雄市','基隆市','新竹市','新竹縣','苗栗縣','彰化縣','南投縣','雲林縣','嘉義市','嘉義縣','屏東縣','宜蘭縣','花蓮縣','台東縣','澎湖縣','金門縣','連江縣'];
const colors=['#d94841','#d69b16','#bf5b23','#3978c6','#259365','#8654b3','#b83d78','#1597a5','#536ab6','#9f6932','#a13e50','#648b2c','#557b83','#bc693a','#7c624a','#416f46','#497abd','#6d52a0','#2d8380','#985d91','#b47526','#626a94'];
export const cityColor=city=>colors[cities.indexOf(String(city).replaceAll('臺','台'))]||'#596d65';
export function pinSVG(city,selected,partial=false){
  const color=cityColor(city);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="54" viewBox="0 0 42 54" aria-hidden="true"><ellipse cx="21" cy="50" rx="10" ry="2.5" fill="#000" opacity=".16"/><path d="M21 1.5C10.5 1.5 2 10 2 20.5c0 13.2 19 30 19 30s19-16.8 19-30C40 10 31.5 1.5 21 1.5Z" fill="${color}" stroke="${selected?'#173d33':'#fff'}" stroke-width="${selected?3:2}"/><path d="M6 18C7 10 13 5 20 5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".4"/><circle cx="21" cy="20" r="10" fill="#fff"/>${selected?'<path d="m15.5 20 3.8 4 7.2-8" fill="none" stroke="#173d33" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>':partial?'<path d="M15 20h12" stroke="#173d33" stroke-width="3" stroke-linecap="round"/>':'<circle cx="21" cy="20" r="6.5" fill="'+color+'" opacity=".14"/>'}</svg>`;
}
