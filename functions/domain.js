export const ROLES = ['buyer', 'super_admin', 'reviewer', 'cinema_manager'];
export const DEFAULT_SETTINGS = {defaultCapacity:12, maxBookingDays:90, slotSeconds:30};
export class BusinessError extends Error {
  constructor(message, status=400) { super(message); this.status=status; }
}
export function requireRole(role, allowed) {
  if (!allowed.includes(role)) throw new BusinessError('你的帳號沒有這項操作權限。',403);
}
export function canBootstrap(verified, email, alreadyClaimed) {
  return !alreadyClaimed && !!email && verified.email_verified===true && verified.firebase?.sign_in_provider==='google.com' && verified.email?.toLowerCase()===email.toLowerCase();
}
export function bookingDates(start, end, limit=90, today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'})) {
  const valid = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s;
  if (!valid(start)||!valid(end)||start>end||start<today) throw new BusinessError('投放日期必須為今天以後，結束日不可早於開始日。');
  const n=(Date.parse(end)-Date.parse(start))/86400000+1;
  if (n>limit) throw new BusinessError(`每筆委刊最多 ${limit} 天。`);
  return Array.from({length:n},(_,i)=>new Date(Date.parse(start)+i*86400000).toISOString().slice(0,10));
}
export function calculatePrice(dailyPrice, slots, days) {
  if (!Number.isSafeInteger(dailyPrice)||dailyPrice<=0||!Number.isSafeInteger(slots)||slots<1||!Number.isSafeInteger(days)||days<1) throw new BusinessError('價格尚未設定，或檔數不正確。');
  const total=dailyPrice*slots*days;
  if (!Number.isSafeInteger(total)) throw new BusinessError('金額超出可處理範圍。');
  return total;
}
export function reserve(hall, dates, slots, defaultCapacity) {
  const capacity=hall.capacity??defaultCapacity;
  const booked={...hall.bookedSlots};
  for (const day of dates) {
    if ((booked[day]||0)+slots>capacity) throw new BusinessError(`${day}「${hall.name}」可用檔數不足，請協調日期或檔數。`,409);
    booked[day]=(booked[day]||0)+slots;
  }
  return {...hall,bookedSlots:booked};
}
export function release(hall, dates, slots) {
  const booked={...hall.bookedSlots};
  for (const day of dates) booked[day]=Math.max(0,(booked[day]||0)-slots);
  return {...hall,bookedSlots:booked};
}
export function editHall(existing, input, role) {
  requireRole(role,['super_admin','cinema_manager']);
  if(role!=='super_admin' && ('dailyPrice' in input || 'weeklyPrice' in input || 'capacity' in input)) throw new BusinessError('價格與容量只能由最高管理員修改。',403);
  return {...existing,...input,...('weeklyPrice'in input?{weeklyPrice:input.weeklyPrice}:{}),bookedSlots:existing?.bookedSlots||{},dailyPrice:role==='super_admin'?(input.dailyPrice??existing?.dailyPrice??null):(existing?.dailyPrice??null),capacity:role==='super_admin'?(input.capacity===undefined?(existing?.capacity??null):input.capacity):(existing?.capacity??null)};
}
