export const INITIAL_TAIWAN_CINEMAS = [
  {
    id: 'c-xinyi',
    name: '台北信義威秀影城',
    city: '台北市',
    district: '信義區',
    address: '台北市信義區松壽路 20 號',
    tagIds: ['t1', 't2', 't6', 't9', 't13', 't15'],
    lat: 25.0356,
    lng: 121.5675,
    description: '全台票房指標旗艦影城，信義商圈高消費力年輕潮流與都會白領核心。',
    halls: [
      { id: 'h-xy-1', name: '第 1 影廳 (4DX動感)', screenType: '4DX 沉浸動感', seats: 320, dailyPrice: 18000, bookedSlots: { '2026-11-01': 10, '2026-11-02': 8 } },
      { id: 'h-xy-2', name: '第 2 影廳 (Titan旗艦)', screenType: 'Titan 4K 巨幕', seats: 388, dailyPrice: 20000, bookedSlots: { '2026-11-01': 12, '2026-11-02': 11 } },
      { id: 'h-xy-3', name: '第 3 影廳 (標準數位)', screenType: '數位 2K', seats: 190, dailyPrice: 11000, bookedSlots: { '2026-11-01': 3, '2026-11-02': 2 } },
      { id: 'h-xy-4', name: '第 6 影廳 (標準數位)', screenType: '數位 2K', seats: 215, dailyPrice: 12000, bookedSlots: { '2026-11-01': 5, '2026-11-02': 3 } }
    ]
  },
  {
    id: 'c-miramar',
    name: '大直美麗華影城',
    city: '台北市',
    district: '中山區',
    address: '台北市中山區敬業三路 22 號 6 樓',
    tagIds: ['t3', 't5', 't9', 't13', 't15'],
    lat: 25.0835,
    lng: 121.5574,
    description: '指標商業雷射 IMAX 巨幕，內湖科技園區工程師與大直高資產家庭聚落首選。',
    halls: [
      { id: 'h-mm-imax', name: 'IMAX 旗艦巨幕廳', screenType: 'IMAX 雷射巨幕', seats: 402, dailyPrice: 22000, bookedSlots: { '2026-11-01': 9, '2026-11-02': 9 } },
      { id: 'h-mm-1', name: '第 1 影廳 (杜比巨幕)', screenType: 'Dolby Atmos 4K', seats: 260, dailyPrice: 14000, bookedSlots: { '2026-11-01': 4, '2026-11-02': 1 } },
      { id: 'h-mm-2', name: '第 2 影廳 (標準數位)', screenType: '數位 2K', seats: 180, dailyPrice: 9500, bookedSlots: { '2026-11-01': 2, '2026-11-02': 0 } }
    ]
  },
  {
    id: 'c-xinxin',
    name: '台北欣欣秀泰影城',
    city: '台北市',
    district: '中山區',
    address: '台北市中山區林森北路 247 號',
    tagIds: ['t1', 't2', 't12', 't16'],
    lat: 25.0538,
    lng: 121.5262,
    description: '中山南西核心商圈，夜生活娛樂聚落，高頻觀影與深夜年輕潮流客首選。',
    halls: [
      { id: 'h-xx-1', name: '第 1 影廳 (旗艦巨幕)', screenType: 'Titan 4K 巨幕', seats: 350, dailyPrice: 16000, bookedSlots: { '2026-11-01': 11, '2026-11-02': 7 } },
      { id: 'h-xx-2', name: '第 2 影廳 (標準數位)', screenType: '標準 2K', seats: 180, dailyPrice: 9500, bookedSlots: { '2026-11-01': 4, '2026-11-02': 3 } },
      { id: 'h-xx-3', name: '第 3 影廳 (標準數位)', screenType: '標準 2K', seats: 160, dailyPrice: 8500, bookedSlots: { '2026-11-01': 1, '2026-11-02': 1 } }
    ]
  },
  {
    id: 'c-banciao',
    name: '板橋大遠百威秀影城',
    city: '新北市',
    district: '板橋區',
    address: '新北市板橋區新站路 28 號 10 樓',
    tagIds: ['t1', 't3', 't9', 't10', 't15'],
    lat: 25.0135,
    lng: 121.4655,
    description: '新北三鐵共構核心樞紐，連通大遠百百貨，家庭親子與雙薪白領主力消費圈。',
    halls: [
      { id: 'h-bc-1', name: '第 1 影廳 (IMAX)', screenType: '數位 IMAX', seats: 410, dailyPrice: 19000, bookedSlots: { '2026-11-01': 7, '2026-11-02': 6 } },
      { id: 'h-bc-2', name: '第 2 影廳 (標準數位)', screenType: '標準 2K', seats: 190, dailyPrice: 11000, bookedSlots: { '2026-11-01': 2, '2026-11-02': 1 } },
      { id: 'h-bc-3', name: '第 3 影廳 (標準數位)', screenType: '標準 2K', seats: 180, dailyPrice: 10500, bookedSlots: { '2026-11-01': 0, '2026-11-02': 0 } }
    ]
  },
  {
    id: 'c-hsinchu',
    name: '新竹巨城威秀影城',
    city: '新竹市',
    district: '東區',
    address: '新竹市東區中央路 229 號 4 樓',
    tagIds: ['t1', 't3', 't5', 't9', 't11', 't13'],
    lat: 24.8093,
    lng: 120.9754,
    description: '緊鄰新竹科學園區，全台含金量最高百貨巨城核心，科技新貴與高收入家庭聚集地。',
    halls: [
      { id: 'h-hc-1', name: '第 1 影廳 (IMAX)', screenType: '雷射 IMAX', seats: 395, dailyPrice: 18500, bookedSlots: { '2026-11-01': 8, '2026-11-02': 5 } },
      { id: 'h-hc-2', name: '第 2 影廳 (標準數位)', screenType: '標準 4K', seats: 220, dailyPrice: 11500, bookedSlots: { '2026-11-01': 3, '2026-11-02': 2 } }
    ]
  },
  {
    id: 'c-taichung',
    name: '台中大遠百威秀影城',
    city: '台中市',
    district: '西屯區',
    address: '台中市西屯區臺灣大道三段 251 號 13 樓',
    tagIds: ['t1', 't2', 't6', 't9', 't13', 't15'],
    lat: 24.1648,
    lng: 120.6434,
    description: '台中七期重劃區旗艦核心，新光大遠百雙聚落，中台灣頂級高消費客戶首選。',
    halls: [
      { id: 'h-tc-1', name: '第 1 影廳 (IMAX)', screenType: '數位 IMAX', seats: 430, dailyPrice: 18000, bookedSlots: { '2026-11-01': 9, '2026-11-02': 8 } },
      { id: 'h-tc-2', name: '第 2 影廳 (4DX動感)', screenType: '4DX 沉浸動態', seats: 240, dailyPrice: 16500, bookedSlots: { '2026-11-01': 6, '2026-11-02': 4 } },
      { id: 'h-tc-3', name: '第 3 影廳 (標準數位)', screenType: '標準 2K', seats: 200, dailyPrice: 10500, bookedSlots: { '2026-11-01': 1, '2026-11-02': 0 } }
    ]
  },
  {
    id: 'c-tainan',
    name: '台南南紡威秀影城',
    city: '台南市',
    district: '東區',
    address: '台南市東區中華東路一段 366 號 5 樓',
    tagIds: ['t1', 't3', 't4', 't9', 't15'],
    lat: 22.9904,
    lng: 120.2312,
    description: '南紡購物中心商圈旗艦，大台南年輕潮流聚會與家庭假日觀影重鎮。',
    halls: [
      { id: 'h-tn-1', name: '第 1 影廳 (IMAX)', screenType: '雷射 IMAX', seats: 390, dailyPrice: 16500, bookedSlots: { '2026-11-01': 5, '2026-11-02': 4 } },
      { id: 'h-tn-2', name: '第 2 影廳 (標準數位)', screenType: '標準 2K', seats: 195, dailyPrice: 9500, bookedSlots: { '2026-11-01': 2, '2026-11-02': 1 } }
    ]
  },
  {
    id: 'c-kaohsiung',
    name: '高雄大遠百威秀影城',
    city: '高雄市',
    district: '苓雅區',
    address: '高雄市苓雅區三多四路 21 號 13 樓',
    tagIds: ['t1', 't2', 't4', 't9', 't10', 't15'],
    lat: 22.6133,
    lng: 120.3045,
    description: '高雄三多商圈捷運直通樞紐，南台灣唯一擁有 IMAX 與 4DX 雙旗艦配置影城。',
    halls: [
      { id: 'h-ks-1', name: '第 1 影廳 (IMAX)', screenType: '數位 IMAX', seats: 398, dailyPrice: 17000, bookedSlots: { '2026-11-01': 6, '2026-11-02': 5 } },
      { id: 'h-ks-2', name: '第 2 影廳 (4DX動感)', screenType: '4DX 沉浸動態', seats: 240, dailyPrice: 15000, bookedSlots: { '2026-11-01': 4, '2026-11-02': 3 } },
      { id: 'h-ks-3', name: '第 3 影廳 (標準數位)', screenType: '標準 2K', seats: 180, dailyPrice: 9000, bookedSlots: { '2026-11-01': 0, '2026-11-02': 0 } }
    ]
  }
];


