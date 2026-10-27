// BGM 預設清單 · 用戶要先把 mp3/mp4 上傳到 Cloudinary 的 infuz/bgm/ 資料夾
// 然後把 public_id 填進這個清單
//
// 推薦下載來源 (全部無版權):
//   - https://pixabay.com/music/search/fashion/
//   - https://www.chosic.com/free-music/all/
//   - https://freepd.com/
//   - YouTube Audio Library (在 YT Studio 內)
//
// 上傳方法:
//   1. 進 https://console.cloudinary.com/console/media_library/folders
//   2. 建 infuz/bgm/ 資料夾
//   3. 拖曳 mp3 檔上傳 (選 resource_type: video, Cloudinary 會自動處理音訊檔)
//   4. 把檔名 (去掉副檔名) 填進下方 publicId

export const BGM_LIBRARY = [
  {
    key: 'fashion_pop',
    label: '🎵 時尚流行',
    mood: 'upbeat',
    hint: '明亮歡快 · 適合 OOTD / 新品',
    publicId: 'infuz/bgm/fashion_pop',    // 用戶上傳後對應的 Cloudinary public_id
    duration: 30,                           // 預估秒數 (實際以 Cloudinary 為準)
  },
  {
    key: 'chill_lofi',
    label: '🎧 Chill Lofi',
    mood: 'relaxed',
    hint: '輕鬆放鬆 · 日常/氛圍片',
    publicId: 'infuz/bgm/chill_lofi',
    duration: 60,
  },
  {
    key: 'cinematic_soft',
    label: '🎞️ 電影感柔和',
    mood: 'cinematic',
    hint: '氣質片 · 精品感 · 長裙適合',
    publicId: 'infuz/bgm/cinematic_soft',
    duration: 45,
  },
  {
    key: 'energetic_edm',
    label: '⚡ 動感 EDM',
    mood: 'high-energy',
    hint: '快剪廣告 · 年輕感',
    publicId: 'infuz/bgm/energetic_edm',
    duration: 30,
  },
  {
    key: 'acoustic_warm',
    label: '🎸 原聲溫暖',
    mood: 'warm',
    hint: '生活感 · 咖啡廳 · 民族風',
    publicId: 'infuz/bgm/acoustic_warm',
    duration: 60,
  },
  {
    key: 'minimal_tech',
    label: '🔮 極簡科技',
    mood: 'minimal',
    hint: '質感 · 現代都會',
    publicId: 'infuz/bgm/minimal_tech',
    duration: 45,
  },
];
