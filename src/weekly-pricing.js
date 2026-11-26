export function wholeWeeks(days){
  if(!Number.isSafeInteger(days)||days<7||days%7!==0)throw new Error('投放期間只允許 7 天的倍數（7、14、21 天…）。');
  return days/7;
}
export function weeklyTotal(price,slots,days){
  const weeks=wholeWeeks(days);
  if(!Number.isSafeInteger(price)||price<1||!Number.isSafeInteger(slots)||slots<1||!Number.isSafeInteger(price*slots*weeks))throw new Error('價格尚未設定，或檔數不正確。');
  return price*slots*weeks;
}
export function previewWeeklyTotal(price,slots,days){try{return weeklyTotal(price,slots,days);}catch{return null;}}
