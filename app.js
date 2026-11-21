/* =========================================================
   糯糯 Mochi · 原型交互
   说明：这是产品概念的可交互原型，应用1 / 应用2 为模拟接入。
   ========================================================= */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => min + Math.random() * (max - min);

/* ---------------- 数据 ---------------- */
const STORE_KEY = 'mochi-deskpet-v1';

const DEFAULT_STATE = {
  name: '糯糯',
  level: 3,
  xp: 120,
  coins: 18,
  stamina: 80,
  items: { pudding: 1, ball: 1, feather: 1 },
  economyVersion: 3,
  streak: 0,
  bestStreak: 3,
  todayXp: 0,
  answered: 0,
  correct: 0,
  intimacy: 68,
  hunger: 72,
  mood: 82,
  theme: 'strawberry',
  eye: 'violet',
  species: 'mochi',
  accessories: ['bow', 'sprout'],
  outfit: 'mochi',
  customSkin: '',
  ownedOutfits: ['mochi'],
  size: 100,
  sound: true,
  chatter: true,
  topmost: true,
  clickThrough: false,
  wrongBook: [],
  todayDate: new Date().toISOString().slice(0, 10),
  todayAnswered: 0,
  todayInteractions: 0
};

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_STATE };
    return {
      ...DEFAULT_STATE,
      ...raw,
      species: raw.species || 'mochi',
      accessories: Array.isArray(raw.accessories) ? raw.accessories : ['bow', 'sprout'],
      wrongBook: Array.isArray(raw.wrongBook) ? raw.wrongBook : [],
      items: (raw.items && typeof raw.items === 'object') ? raw.items : { ...DEFAULT_STATE.items }
    };
  } catch (err) {
    return { ...DEFAULT_STATE };
  }
}

let state = loadState();
if (state.economyVersion !== 4) {
  state.coins = 18;
  state.stamina = 80;
  state.items = { pudding: 1, ball: 1, feather: 1 };
  state.todayInteractions = 0;
  state.economyVersion = 4;
}
if (!Array.isArray(state.ownedOutfits)) {
  state.ownedOutfits = ['mochi'];
  if (state.outfit && state.outfit !== 'mochi') state.ownedOutfits.push(state.outfit);
}
if (!state.ownedOutfits.includes('mochi')) state.ownedOutfits.unshift('mochi');
state.coins = Math.max(0, Number(state.coins) || 0);
state.stamina = clamp(Number(state.stamina) || 80, 0, 100);
const TODAY = new Date().toISOString().slice(0, 10);
if (state.todayDate !== TODAY) {
  state.todayDate = TODAY;
  state.todayAnswered = 0;
  state.todayInteractions = 0;
  state.todayXp = 0;
}
let qIndex = 0;
let answered = false;
let usedHint = false;
let currentTip = '';
let qStartTime = 0;
let sleeping = false;
let playing = false;
let focusTimer = null;
let focusEnd = 0;
let bubbleTimer = null;
let exprTimer = null;
let zzzTimer = null;
let lastInteract = Date.now();
let pettingCount = 0;
let lastPetMove = 0;
let pos = { x: 0, y: 0 };
let tiltX = 0;
let tiltY = 0;
let dragState = null;
let audioCtx = null;
let speakingToken = 0;
let speakTimer = null;
let listenTimer = null;
let callMode = 'idle';
let recognition = null;
let recognizing = false;
let gotSpeech = false;
let muted = false;
let subtitles = true;
let parkVisitors = [];
let mpPeer = null;
let mpConn = null;
let mpIsHost = false;

/* ---------------- 题目库（模拟应用1） ---------------- */
const QUESTIONS = [
  {
    subject: '数学 · 二次函数',
    difficulty: 3,
    stem: '二次函数 y = x² − 4x + 3 的最小值是？',
    options: ['−1', '0', '1', '3'],
    answer: 0,
    hint: '先把它配成 y = (x − ?)² + ? 的形式，再看顶点。',
    tip: '二次函数求最值，第一步永远是配方；顶点纵坐标就是答案。',
    explain: '配方得 y = (x − 2)² − 1，所以当 x = 2 时取最小值 −1。'
  },
  {
    subject: '英语 · 被动语态',
    difficulty: 2,
    stem: 'The novel Life ___ by Lu Yao and published in 1982.',
    options: ['was written', 'wrote', 'is written', 'has written'],
    answer: 0,
    hint: '小说是“被写”的；再看 published 的时间。',
    tip: '看到 by + 过去时间，先锁定“过去被动”：was / were + done。',
    explain: '小说与 write 是被动关系，1982 是过去时间，所以用一般过去时的被动语态 was written。'
  },
  {
    subject: '物理 · 平面镜成像',
    difficulty: 2,
    stem: '人逐渐靠近平面镜时，镜中像的大小会怎样变化？',
    options: ['变大', '变小', '不变', '先变大后变小'],
    answer: 2,
    hint: '像与物永远等大。你感觉到的“变大”，变的是视角。',
    tip: '平面镜成像记八个字：等大、等距、对称、虚像。',
    explain: '平面镜所成的像与物体大小相等。靠近镜子只会让视角变大，像本身并没有变大。'
  },
  {
    subject: '语文 · 古诗哲理',
    difficulty: 3,
    stem: '“山重水复疑无路，柳暗花明又一村”最想表达的是？',
    options: ['山路难行', '困境中孕育转机', '乡村景色优美', '离别的不舍'],
    answer: 1,
    hint: '抓住“疑无路”和“又一村”之间的转折。',
    tip: '古诗哲理题：先找转折词，再问“作者想鼓励读者相信什么”。',
    explain: '前一句写困境，后一句写转机，表达的是绝境中往往藏着新的可能。'
  },
  {
    subject: '化学 · 溶液 pH',
    difficulty: 4,
    stem: '常温下，pH = 3 的溶液与 pH = 5 的溶液相比，前者 H⁺ 浓度是后者的？',
    options: ['2 倍', '20 倍', '100 倍', '1000 倍'],
    answer: 2,
    hint: 'pH 每相差 1，H⁺ 浓度相差 10 倍。',
    tip: 'pH 是对数坐标：相差 2，就是 10² = 100 倍。',
    explain: 'pH 相差 2，H⁺ 浓度相差 10² = 100 倍；pH 越小，H⁺ 浓度越大。'
  },
  {
    subject: '英语 · 虚拟语气',
    difficulty: 3,
    stem: 'He suggested that we ___ the meeting until next Monday.',
    options: ['postponed', 'postpone', 'postponing', 'to postpone'],
    answer: 1,
    hint: 'suggest 表示“建议”时，后面的 that 从句有固定用法。',
    tip: 'suggest / insist / demand + that 从句，谓语用 (should) + 动词原形。',
    explain: 'suggest 表“建议”时，that 从句用虚拟语气 (should) postpone，should 可以省略，所以选 postpone。'
  }
];

const THEMES = [
  {
    id: 'strawberry', name: '草莓奶昔', desc: '软乎乎的日常', lv: 1,
    swatch: 'linear-gradient(145deg,#fff8fc,#ffd9e8 55%,#f2dcff)'
  },
  {
    id: 'peach', name: '蜜桃乌龙', desc: '暖洋洋的下午', lv: 1,
    swatch: 'linear-gradient(145deg,#fff9f4,#ffe1cd 55%,#ffc9d9)'
  },
  {
    id: 'mint', name: '薄荷苏打', desc: '清醒一点', lv: 2,
    swatch: 'linear-gradient(145deg,#fbfffd,#c9f6e6 55%,#d8f2ff)'
  },
  {
    id: 'ocean', name: '海盐芝士', desc: '安静的深蓝', lv: 2,
    swatch: 'linear-gradient(145deg,#f7fdff,#d8f2ff 55%,#c4e4ff)'
  },
  {
    id: 'lemon', name: '柠檬布丁', desc: '甜甜的元气', lv: 3,
    swatch: 'linear-gradient(145deg,#fffef7,#fff1bd 55%,#ffe1a1)'
  },
  {
    id: 'night', name: '星夜巡游', desc: '陪你熬夜', lv: 4,
    swatch: 'linear-gradient(145deg,#f8f5ff,#ddd2ff 55%,#c3b0f7)'
  }
];

const ACCESSORIES = [
  { id: 'sprout', name: '小芽', icon: '🌱', lv: 1 },
  { id: 'bow', name: '草莓蝴蝶结', icon: '🎀', lv: 1 },
  { id: 'scarf', name: '草莓围巾', icon: '🧣', lv: 2 },
  { id: 'star', name: '星星发夹', icon: '⭐', lv: 4 },
  { id: 'headphones', name: '学习耳机', icon: '🎧', lv: 5 },
  { id: 'halo', name: '小天使光环', icon: '😇', lv: 6 }
];

const SPECIES = [
  { id: 'mochi', name: '糯米团', icon: '🍡', lv: 1, desc: '最经典的软糯圆球，呆毛会随心情晃。' },
  { id: 'cat', name: '猫猫团', icon: '🐱', lv: 1, desc: '耳朵会抖，尾巴藏不住开心。' },
  { id: 'bunny', name: '兔兔团', icon: '🐰', lv: 2, desc: '长耳朵接收你的好心情。' },
  { id: 'deer', name: '小鹿团', icon: '🦌', lv: 4, desc: '鹿角上挂着一点点森林。' },
  { id: 'star', name: '星灵团', icon: '✨', lv: 6, desc: '头顶一颗小星星，夜里会发光。' }
];

const OUTFITS = [
  { id: 'mochi', name: '糯米团', tag: '基础', icon: '🍡', price: 0, palette: null },
  { id: 'wind', name: '吟游风', tag: '自由之诗', icon: '🎐', price: 25, palette: { p1: '#eafdf5', p2: '#bfeee0', p3: '#7fd4bf', line: '#6fbca9', inner: '#b8f2e2' } },
  { id: 'spark', name: '火花骑士', tag: '红色冒险', icon: '🍀', price: 30, palette: { p1: '#fff4ec', p2: '#ffd7c2', p3: '#ff9e8a', line: '#e58a6f', inner: '#ffc8b0' } },
  { id: 'dragon', name: '奶团小龙', tag: '软乎乎的龙', icon: '🐉', price: 30, palette: { p1: '#fffdf6', p2: '#ffedb8', p3: '#ffd978', line: '#e6bd5f', inner: '#ffe9a0' } },
  { id: 'detective', name: '小小侦探', tag: '真相只有一个', icon: '🔍', price: 35, palette: { p1: '#f2f7ff', p2: '#cfe0ff', p3: '#8fb4f0', line: '#6b93d6', inner: '#bfd8ff' } },
  { id: 'thunder', name: '雷光之影', tag: '紫电一闪', icon: '⚡', price: 40, palette: { p1: '#f7f4ff', p2: '#dcd2ff', p3: '#a98ef0', line: '#8a6fd6', inner: '#cfc2ff' } },
  { id: 'geo', name: '岩之契约', tag: '沉稳金', icon: '🟡', price: 45, palette: { p1: '#fdf8ef', p2: '#f3ddb4', p3: '#e2b86e', line: '#c2974f', inner: '#f5d9a2' } },
  { id: 'stellar', name: '星灵之辉', tag: '自创星团', icon: '✨', price: 50, palette: { p1: '#f7f5ff', p2: '#ddd1ff', p3: '#b59ef0', line: '#8f74d8', inner: '#cdbfff' } },
  { id: 'firelord', name: '火之执政', tag: '赤焰冠冕', icon: '🔥', price: 60, palette: { p1: '#fff1e6', p2: '#ffc9a3', p3: '#ff7a4d', line: '#d9532f', inner: '#ffb08a' } },
  { id: 'hydro', name: '水之舞台', tag: '海盐咏叹', icon: '🎩', price: 60, palette: { p1: '#f0faff', p2: '#c4e8ff', p3: '#6fc4f0', line: '#4d9fd6', inner: '#b8e4ff' } },
  { id: 'dendro', name: '草之智慧', tag: '新芽王冠', icon: '🌿', price: 55, palette: { p1: '#f4fdf3', p2: '#c9f0cf', p3: '#7fd0a0', line: '#4fa877', inner: '#b4ecd0' } },
  { id: 'tide', name: '水之刃', tag: '蓝刃浪花', icon: '🌊', price: 55, palette: { p1: '#f2f8ff', p2: '#c8e0ff', p3: '#5c9ce0', line: '#3f7cc0', inner: '#a8d2ff' } },
  { id: 'spider', name: '蛛网侠', tag: '红蓝织网', icon: '🕸️', price: 60, palette: { p1: '#fff0f0', p2: '#ffc2c2', p3: '#ff5f5f', line: '#d63f3f', inner: '#ff9c9c' } },
  { id: 'penguin', name: '小企鹅', tag: '燕尾摇摆', icon: '🐧', price: 40, palette: { p1: '#f6fbff', p2: '#cfe6f5', p3: '#8fb8d6', line: '#5f86a8', inner: '#b8dcee' } },
  { id: 'knight', name: '白羽骑士', tag: '银铠羽饰', icon: '🛡️', price: 45, palette: { p1: '#fbfcff', p2: '#e4ecff', p3: '#b8c8f0', line: '#8a9ad0', inner: '#d4e0ff' } },
  { id: 'witch', name: '星夜魔女', tag: '月轮斗篷', icon: '🌙', price: 50, palette: { p1: '#faf6ff', p2: '#e3d4ff', p3: '#b28ef0', line: '#8a6cd6', inner: '#d0bcff' } }
];

const ITEMS = [
  { id: 'pudding', name: '布丁', icon: '🍮', price: 4, desc: '饱食+24 · 心情+6 · 体力+4', fx: { hunger: 24, mood: 6, stamina: 4 } },
  { id: 'berry', name: '草莓', icon: '🍓', price: 3, desc: '饱食+14 · 心情+5', fx: { hunger: 14, mood: 5 } },
  { id: 'dango', name: '小团子', icon: '🍡', price: 2, desc: '饱食+8 · 亲密+3', fx: { hunger: 8, intimacy: 3 } },
  { id: 'drink', name: '精力饮料', icon: '🧃', price: 5, desc: '体力+40 · 心情+4', fx: { stamina: 40, mood: 4 } },
  { id: 'ball', name: '玩具球', icon: '🎾', price: 3, desc: '心情+10 · 体力-6', fx: { mood: 10, stamina: -6 } },
  { id: 'feather', name: '羽毛逗猫棒', icon: '🪶', price: 3, desc: '亲密+6 · 心情+6', fx: { intimacy: 6, mood: 6 } },
  { id: 'book', name: '故事书', icon: '📖', price: 4, desc: '心情+8 · 亲密+2', fx: { mood: 8, intimacy: 2 } },
  { id: 'pillow', name: '软抱枕', icon: '🛏️', price: 3, desc: '体力+20 · 心情+3', fx: { stamina: 20, mood: 3 } }
];

const ACTION_ITEM = { pet: 'feather', feed: 'pudding', play: 'ball', tickle: 'feather', story: 'book', sleep: null, focus: null, talk: null };

const EYES = [
  { id: 'violet', name: '葡萄紫', color: 'radial-gradient(circle at 35% 28%,#b9a6ff,#6d55d6 55%,#281d47)' },
  { id: 'ocean', name: '海盐蓝', color: 'radial-gradient(circle at 35% 28%,#a8efff,#2e8fc4 55%,#0f2c45)' },
  { id: 'amber', name: '蜂蜜金', color: 'radial-gradient(circle at 35% 28%,#ffe5a3,#e48f33 55%,#472612)' },
  { id: 'rose', name: '玫瑰粉', color: 'radial-gradient(circle at 35% 28%,#ffc9da,#dd5d8e 55%,#431a2d)' }
];

const EVOLUTION = [
  { lv: 1, name: '种子团' },
  { lv: 3, name: '嫩芽团' },
  { lv: 4, name: '星星团' },
  { lv: 6, name: '云朵团' },
  { lv: 8, name: '月牙团' },
  { lv: 10, name: '银河团' }
];

const UNLOCKS = {
  4: { acc: 'star', theme: 'night', species: 'deer', label: '星星发夹 + 星夜主题 + 小鹿团' },
  5: { acc: 'headphones', label: '学习耳机' },
  6: { acc: 'halo', species: 'star', label: '小天使光环 + 星灵团' }
};

const DEMO_PROMPTS = [
  '这道题为什么选 B？',
  '给我一个解题技巧',
  '我有点累了',
  '帮我把这题讲简单一点'
];

const IDLE_LINES = [
  '做了这么久，要不要伸个懒腰？',
  '我把错题本翻好了，随时可以复盘。',
  '今天也在一颗一颗地变厉害。',
  '卡住的话，点我一下，我给你一点提示。',
  '水杯空了吧？去接杯水再回来。'
];

const PET_LINES = [
  '嘿嘿，好舒服～',
  '再摸一下也不是不行。',
  '我在这里陪着你呢。',
  '今天的你也有认真发光。',
  '唔……头要被揉圆啦。'
];

const FEED_LINES = [
  '布丁！是布丁！',
  '啊呜——好甜。',
  '吃饱才有力气做题。',
  '这一口是草莓味的。'
];

const TICKLE_LINES = [
  '哈哈哈……痒！',
  '别挠啦，尾巴要打结了！',
  '再挠我就钻进题本里。',
  '救命——好痒好痒！'
];

const STORY_LINES = [
  '从前有一颗小糯米团，把每天的错题折成纸船，放进抽屉里。后来抽屉打开，里面是一整条会发光的小河。',
  '星星掉进题本里，糯糯把它擦成一颗小灯。灯不大，但刚好照亮下一道题。',
  '有一只小芽长在书页的空白处。它说：慢慢来，我会等你长高。',
  '数学题里的 x 迷路了，糯糯给它画了一条数轴。x 顺着数轴走回家，回头说了声谢谢。'
];

const FEEDBACK_OK = ['答对啦！', '漂亮！', '就是这样做～', '思路很稳。'];
const FEEDBACK_NO = ['差一点点～', '没关系，这题记下来。', '这次是陷阱，下次不会了。'];

const VISITORS = [
  { id: 'peach', name: '桃桃', icon: '🍑', color: '#ffc9b8', hi: ['嗨，一起晒太阳吧～', '今天天气好好，来做题吗？'], gift: ['哇，谢谢你的小团子！', '这个礼物我收下啦，改天回礼。'] },
  { id: 'mint', name: '薄荷', icon: '🌿', color: '#bfeedf', hi: ['风好凉快呀～', '要不要去草地滚一圈？'], gift: ['薄荷味的礼物，喜欢！', '谢谢～好清新。'] },
  { id: 'pudding', name: '布丁', icon: '🍮', color: '#ffe2a8', hi: ['我带了布丁，分你一半。', '软软的，好想睡觉…'], gift: ['给我布丁？那我就不客气啦！'] },
  { id: 'star', name: '星仔', icon: '⭐', color: '#ffe9a8', hi: ['晚上一起看星星呀。', '你最近好像又变厉害了。'], gift: ['星星收下啦，祝你闪闪发光！'] },
  { id: 'cloud', name: '云云', icon: '☁️', color: '#e8f0ff', hi: ['我飘过来看看你～', '累了就躺云上吧。'], gift: ['软绵绵的谢礼，谢谢你～'] },
  { id: 'berry', name: '莓莓', icon: '🍓', color: '#ffc9d4', hi: ['草莓季到啦！', '要不要一起做果酱？'], gift: ['酸酸甜甜，和你的心意一样！'] }
];

/* ---------------- DOM ---------------- */
const el = {
  app: $('#app'),
  stage: $('#stage'),
  stageTip: $('#stageTip'),
  petSvg: $('#petSvg'),
  petPosition: $('#petPosition'),
  petScale: $('#petScale'),
  bubble: $('#bubble'),
  bubbleText: $('#bubbleText'),
  lvPillNum: $('#lvPillNum'),
  lvPillForm: $('#lvPillForm'),
  nameLabel: $('#nameLabel'),
  formLabel: $('#formLabel'),
  xpFill: $('#xpFill'),
  xpText: $('#xpText'),
  coinCount: $('#coinCount'),
  staminaMini: $('#staminaMini'),
  shopCoins: $('#shopCoins'),
  bagGrid: $('#bagGrid'),
  shopGrid: $('#shopGrid'),
  parkVisitors: $('#parkVisitors'),
  parkLog: $('#parkLog'),
  parkRefresh: $('#parkRefresh'),
  parkPhotoBtn: $('#parkPhotoBtn'),
  rpsResult: $('#rpsResult'),
  mpHost: $('#mpHost'),
  mpJoin: $('#mpJoin'),
  mpCode: $('#mpCode'),
  mpStatus: $('#mpStatus'),
  mpPeers: $('#mpPeers'),
  mpActions: $('#mpActions'),
  valStamina: $('#valStamina'),
  barStamina: $('#barStamina'),
  panel: $('#panel'),
  panelBody: $('#panelBody'),
  panelName: $('#panelName'),
  panelSub: $('#panelSub'),
  levelBadge: $('#levelBadge'),
  panelXpFill: $('#panelXpFill'),
  panelXpText: $('#panelXpText'),
  speciesGrid: $('#speciesGrid'),
  themeGrid: $('#themeGrid'),
  accGrid: $('#accGrid'),
  outfitGrid: $('#outfitGrid'),
  customSkinInput: $('#customSkinInput'),
  customSkinClear: $('#customSkinClear'),
  eyeRow: $('#eyeRow'),
  dailyCard: $('#dailyCard'),
  dailyCount: $('#dailyCount'),
  dailyRing: $('#dailyRing'),
  dailyPct: $('#dailyPct'),
  dailyBest: $('#dailyBest'),
  dailyXp: $('#dailyXp'),
  desktopClock: $('#desktopClock'),
  desktopTime: $('#desktopTime'),
  desktopDate: $('#desktopDate'),
  desktopEntry: $('#desktopEntry'),
  downloadModal: $('#downloadModal'),
  sizeRange: $('#sizeRange'),
  sizeOut: $('#sizeOut'),
  nameInput: $('#nameInput'),
  evoTrack: $('#evoTrack'),
  wrongList: $('#wrongList'),
  wrongCount: $('#wrongCount'),
  streakStat: $('#streakStat'),
  todayXp: $('#todayXp'),
  accuracyStat: $('#accuracyStat'),
  qSubject: $('#qSubject'),
  qIndex: $('#qIndex'),
  qStem: $('#qStem'),
  options: $('#options'),
  hintBtn: $('#hintBtn'),
  nextBtn: $('#nextBtn'),
  feedback: $('#feedback'),
  fbIcon: $('#fbIcon'),
  fbTitle: $('#fbTitle'),
  fbText: $('#fbText'),
  tipText: $('#tipText'),
  barIntimacy: $('#barIntimacy'),
  barHunger: $('#barHunger'),
  barMood: $('#barMood'),
  valIntimacy: $('#valIntimacy'),
  valHunger: $('#valHunger'),
  valMood: $('#valMood'),
  sleepLabel: $('#sleepLabel'),
  focusLabel: $('#focusLabel'),
  callStage: $('#callStage'),
  callBtn: $('#callBtn'),
  callState: $('#callState'),
  wave: $('#wave'),
  transcript: $('#transcript'),
  muteBtn: $('#muteBtn'),
  subBtn: $('#subBtn'),
  levelup: $('#levelup'),
  levelupNum: $('#levelupNum'),
  levelupTitle: $('#levelupTitle'),
  levelupText: $('#levelupText'),
  levelupRewards: $('#levelupRewards'),
  confetti: $('#confetti'),
  toast: $('#toast'),
  fx: $('#fx'),
  reopenBtn: $('#reopenBtn')
};

/* ---------------- 工具 ---------------- */
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (err) { /* 忽略隐私模式下的写入失败 */ }
}

function formFor(level) {
  let name = '种子团';
  for (const item of EVOLUTION) {
    if (level >= item.lv) name = item.name;
  }
  return name;
}

function xpNeed(level) {
  return 80 + level * 30;
}

function toast(message, ms = 2300) {
  el.toast.textContent = message;
  el.toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => el.toast.classList.remove('show'), ms);
}

function setExpr(name, ms = 2200) {
  el.petSvg.dataset.expr = name;
  clearTimeout(exprTimer);
  if (name !== 'idle' && name !== 'sleep' && ms > 0) {
    exprTimer = setTimeout(() => {
      if (!sleeping) el.petSvg.dataset.expr = 'idle';
    }, ms);
  }
}

function say(text, ms = 6000) {
  el.bubbleText.textContent = text;
  el.bubble.classList.add('show');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => el.bubble.classList.remove('show'), ms);
}

function clip(text, max = 86) {
  const value = String(text || '').trim();
  if (value.length <= max) return value;
  const head = value.slice(0, max);
  const cut = Math.max(
    head.lastIndexOf('。'),
    head.lastIndexOf('！'),
    head.lastIndexOf('？'),
    head.lastIndexOf('，')
  );
  return `${cut > 24 ? head.slice(0, cut + 1) : head}…`;
}

/* ---------------- 音效 ---------------- */
function ensureAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (err) { return null; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

function tone(freq, dur = 0.09, type = 'sine', vol = 0.035, delay = 0) {
  if (!state.sound) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function popSound() {
  tone(720, 0.07, 'sine', 0.03);
  tone(1040, 0.06, 'sine', 0.018, 0.04);
}

function successSound() {
  tone(784, 0.1, 'sine', 0.03);
  tone(988, 0.12, 'sine', 0.028, 0.08);
  tone(1319, 0.18, 'sine', 0.025, 0.16);
}

function failSound() {
  tone(392, 0.12, 'triangle', 0.025);
  tone(311, 0.18, 'triangle', 0.02, 0.1);
}

function levelSound() {
  [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'sine', 0.03, i * 0.09));
}

/* ---------------- 渲染：成长与状态 ---------------- */
function renderHeader() {
  const need = xpNeed(state.level);
  const pct = clamp((state.xp / need) * 100, 0, 100);
  const form = formFor(state.level);

  el.lvPillNum.textContent = state.level;
  el.lvPillForm.textContent = form;
  el.nameLabel.textContent = state.name;
  el.formLabel.textContent = form;
  el.xpText.textContent = `${state.xp} / ${need} XP`;
  el.xpFill.style.width = `${pct}%`;
  el.coinCount.textContent = state.coins;
  renderEconomy();

  el.panelName.textContent = state.name;
  el.panelSub.textContent = `${form} · 今天也要加油`;
  el.levelBadge.textContent = `Lv.${state.level}`;
  el.panelXpText.textContent = `${state.xp} / ${need}`;
  el.panelXpFill.style.width = `${pct}%`;
}

function itemById(id) {
  return ITEMS.find((it) => it.id === id);
}

function itemCount(id) {
  return Number(state.items[id]) || 0;
}

function renderEconomy() {
  if (el.staminaMini) el.staminaMini.textContent = state.stamina;
  if (el.shopCoins) el.shopCoins.textContent = state.coins;
  renderBag();
  renderShop();
}

function renderBag() {
  if (!el.bagGrid) return;
  el.bagGrid.innerHTML = '';
  const owned = ITEMS.filter((it) => itemCount(it.id) > 0);
  if (!owned.length) {
    el.bagGrid.innerHTML = '<p class="empty">背包空空的，去商店买点道具吧～</p>';
    return;
  }
  owned.forEach((it) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'item-card';
    btn.innerHTML = `<span class="item-ico">${it.icon}</span><span class="item-info"><b>${it.name}</b><small>${it.desc}</small></span><span class="item-count">×${itemCount(it.id)}</span>`;
    btn.addEventListener('click', () => useItem(it.id));
    el.bagGrid.appendChild(btn);
  });
}

function renderShop() {
  if (!el.shopGrid) return;
  el.shopGrid.innerHTML = '';
  ITEMS.forEach((it) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const afford = state.coins >= it.price;
    btn.className = `item-card shop${afford ? '' : ' poor'}`;
    btn.innerHTML = `<span class="item-ico">${it.icon}</span><span class="item-info"><b>${it.name}</b><small>${it.desc}</small></span><span class="item-price">🌱${it.price}</span>`;
    btn.addEventListener('click', () => buyItem(it.id));
    el.shopGrid.appendChild(btn);
  });
}

function useItem(id) {
  const it = itemById(id);
  if (!it) return;
  if (itemCount(id) <= 0) {
    toast(`没有「${it.name}」了，去商店买一个吧`);
    return;
  }
  state.items[id] = itemCount(id) - 1;
  applyItemFx(it);
  renderEconomy();
  save();
}

function buyItem(id) {
  const it = itemById(id);
  if (!it) return;
  if (state.coins < it.price) {
    toast('星芽币不够，答对题就能赚啦');
    return;
  }
  state.coins -= it.price;
  state.items[id] = itemCount(id) + 1;
  renderEconomy();
  save();
  successSound();
  setExpr('happy', 1500);
  toast(`买到了「${it.name}」`);
}

function applyItemFx(it) {
  if (sleeping) wakeUp();
  let text = `用了「${it.name}」～`;
  if (it.fx.hunger) { bumpStat('hunger', it.fx.hunger); }
  if (it.fx.mood) { bumpStat('mood', it.fx.mood); }
  if (it.fx.intimacy) { bumpStat('intimacy', it.fx.intimacy); }
  if (it.fx.stamina) { bumpStat('stamina', it.fx.stamina); text += ' 体力恢复啦！'; }
  spawnItem(it.icon);
  popSound();
  setExpr('happy', 2000);
  if (it.id === 'book') say(pick(STORY_LINES), 9000);
  else if (it.id === 'drink') say('咕咚咕咚——满血复活！', 4200);
  else if (it.id === 'pillow') say('软乎乎的，好想就这样睡一觉。', 4600);
  else if (it.id === 'ball') say('来玩球！', 3200);
  else say(text, 4200);
}

function renderQuizStats() {
  const acc = state.answered ? `${Math.round((state.correct / state.answered) * 100)}%` : '—';
  el.streakStat.textContent = state.streak;
  el.todayXp.textContent = `+${state.todayXp}`;
  el.accuracyStat.textContent = acc;
}

function renderBars() {
  el.barIntimacy.style.width = `${state.intimacy}%`;
  el.barHunger.style.width = `${state.hunger}%`;
  el.barMood.style.width = `${state.mood}%`;
  el.valIntimacy.textContent = state.intimacy;
  el.valHunger.textContent = state.hunger;
  el.valMood.textContent = state.mood;
  if (el.barStamina) el.barStamina.style.width = `${state.stamina}%`;
  if (el.valStamina) el.valStamina.textContent = state.stamina;
}

function bumpStat(key, amount) {
  state[key] = clamp(Math.round(state[key] + amount), 0, 100);
  renderBars();
  save();
}

function addXp(amount) {
  const oldForm = formFor(state.level);
  state.xp += amount;
  state.todayXp += amount;

  const rewards = [];
  let leveled = false;
  let guard = 0;

  while (state.xp >= xpNeed(state.level) && guard < 6) {
    guard += 1;
    state.xp -= xpNeed(state.level);
    state.level += 1;
    state.coins += 20;
    leveled = true;
    const unlock = UNLOCKS[state.level];
    if (unlock) {
      if (unlock.acc && !state.accessories.includes(unlock.acc)) {
        state.accessories.push(unlock.acc);
        rewards.push(unlock.label || unlock.acc);
      } else if (unlock.label) {
        rewards.push(unlock.label);
      }
    }
  }

  renderHeader();
  renderQuizStats();
  renderDaily();
  renderDress();
  applyAppearance();
  save();

  if (leveled) {
    setTimeout(() => showLevelUp(rewards, oldForm), 420);
  }
}

/* ---------------- 渲染：学习 ---------------- */
function renderQuestion() {
  const q = QUESTIONS[qIndex % QUESTIONS.length];
  currentTip = '';
  answered = false;
  usedHint = false;
  qStartTime = performance.now();

  el.qSubject.textContent = q.subject;
  el.qIndex.textContent = `第 ${(qIndex % QUESTIONS.length) + 1} 题`;
  el.qStem.textContent = q.stem;
  el.options.innerHTML = '';

  q.options.forEach((text, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'option';
    btn.innerHTML = `<span class="key">${String.fromCharCode(65 + i)}</span><span class="opt-text">${text}</span>`;
    btn.addEventListener('click', () => chooseAnswer(i));
    el.options.appendChild(btn);
  });

  el.feedback.hidden = true;
  el.feedback.classList.remove('fail');
  el.nextBtn.disabled = true;
  el.hintBtn.disabled = false;
  el.hintBtn.textContent = '💡 糯糯提示';
  el.tipText.textContent = '先自己做，卡住了再点「糯糯提示」。答题后这里会留下这道题的技巧。';
  el.tipText.dataset.kind = 'neutral';
  setExpr('idle', 0);
}

function chooseAnswer(index) {
  if (answered) return;
  answered = true;

  const q = QUESTIONS[qIndex % QUESTIONS.length];
  const isCorrect = index === q.answer;
  const buttons = $$('.option', el.options);

  buttons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.answer) btn.classList.add('correct');
    if (i === index && !isCorrect) btn.classList.add('wrong');
  });

  state.answered += 1;
  state.todayAnswered = (Number(state.todayAnswered) || 0) + 1;
  state.correct += isCorrect ? 1 : 0;
  renderDaily();

  el.hintBtn.disabled = true;
  el.nextBtn.disabled = false;
  el.feedback.hidden = false;

  if (isCorrect) {
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    const base = 18 + q.difficulty * 7;
    const combo = 1 + Math.min(state.streak, 5) * 0.06;
    const penalty = usedHint ? 0.7 : 1;
    const gain = Math.round(base * combo * penalty);
    const elapsed = (performance.now() - qStartTime) / 1000;
    const timeBonus = elapsed <= 10 ? 3 : elapsed <= 20 ? 2 : elapsed <= 45 ? 1 : 0;
    const coinGain = 4 + q.difficulty * 2 + timeBonus;
    state.coins += coinGain;

    el.feedback.classList.remove('fail');
    el.fbIcon.textContent = '✓';
    el.fbTitle.textContent = pick(FEEDBACK_OK);
    el.fbText.textContent = `${q.explain}　+${gain} XP · +${coinGain} 🌱（难度 ${q.difficulty} · 用时 ${Math.round(elapsed)}s）`;
    el.tipText.textContent = q.tip;
    el.tipText.dataset.kind = 'tip';
    currentTip = q.tip;

    addXp(gain);
    renderQuizStats();
    spawnXp(gain);
    spawnCoin(coinGain);
    spawnHearts(5);
    setExpr(state.streak >= 3 ? 'excited' : 'happy', 2400);
    successSound();
    say(`${pick(['答对啦，思路很稳。', '漂亮，这题拿下。'])} ${q.tip}`, 7600);
  } else {
    state.streak = 0;
    el.feedback.classList.add('fail');
    el.fbIcon.textContent = '!';
    el.fbTitle.textContent = pick(FEEDBACK_NO);
    el.fbText.textContent = `正确答案是 ${String.fromCharCode(65 + q.answer)}。${q.explain}　+1 🌱`;
    el.tipText.textContent = `易错点：${q.tip}`;
    el.tipText.dataset.kind = 'tip';
    currentTip = q.tip;

    state.coins += 1;
    state.wrongBook.push({ qi: qIndex % QUESTIONS.length, chosen: index });
    if (state.wrongBook.length > 20) state.wrongBook.shift();
    renderWrongBook();
    renderQuizStats();
    renderHeader();
    spawnCoin(1);
    setExpr('sad', 2600);
    failSound();
    setTimeout(() => setExpr('thinking', 2200), 900);
    say(`没关系，这题记下了。正确答案是 ${String.fromCharCode(65 + q.answer)}。`, 6200);
  }

  save();
}

function useHint() {
  if (answered) return;
  const q = QUESTIONS[qIndex % QUESTIONS.length];
  usedHint = true;
  el.hintBtn.disabled = true;
  el.hintBtn.textContent = '已提示 · XP −30%';
  el.tipText.textContent = q.hint;
  el.tipText.dataset.kind = 'hint';
  currentTip = q.hint;
  setExpr('thinking', 3200);
  say(clip(`只给思路，不给答案：${q.hint}`, 82), 7600);
  popSound();
}

function nextQuestion() {
  qIndex += 1;
  if (sleeping) wakeUp();
  renderQuestion();
  el.panelBody.scrollTo({ top: 0, behavior: 'smooth' });
  say('下一题，慢慢来～', 3200);
}

function renderWrongBook() {
  const items = state.wrongBook.slice(-5).reverse();
  el.wrongCount.textContent = `${state.wrongBook.length} 题`;

  if (!items.length) {
    el.wrongList.innerHTML = '<p class="empty">还没有错题，继续保持～</p>';
    return;
  }

  el.wrongList.innerHTML = '';
  items.forEach((entry) => {
    const q = QUESTIONS[entry.qi % QUESTIONS.length];
    const details = document.createElement('details');
    details.className = 'wrong-item';
    const summary = document.createElement('summary');
    summary.textContent = q.stem.length > 24 ? `${q.stem.slice(0, 24)}…` : q.stem;
    const body = document.createElement('p');
    body.textContent = `你选了 ${String.fromCharCode(65 + entry.chosen)}，正确答案是 ${String.fromCharCode(65 + q.answer)}。${q.explain}`;
    details.append(summary, body);
    el.wrongList.appendChild(details);
  });
}

/* ---------------- 渲染：装扮 ---------------- */
function applyScale() {
  el.petScale.style.transform = `scale(${state.size / 100}) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
}

function applyAppearance() {
  document.body.dataset.theme = state.theme;
  document.body.dataset.eye = state.eye;
  el.petSvg.dataset.species = state.species;
  el.petSvg.dataset.acc = state.accessories.join(' ');
  el.petSvg.dataset.outfit = state.outfit;
  el.petSvg.dataset.custom = (state.outfit === 'custom' && state.customSkin) ? 'on' : '';
  if (state.outfit === 'custom' && state.customSkin) {
    const img = $('#customSkinImg');
    if (img) img.setAttribute('href', state.customSkin);
  }
  applyScale();
  el.sizeOut.textContent = `${state.size}%`;
  el.sizeRange.value = state.size;
}

function renderDaily() {
  const goal = 15;
  const count = Number(state.todayAnswered) || 0;
  const pct = clamp(Math.round((count / goal) * 100), 0, 100);
  el.dailyCount.textContent = `${count} / ${goal}`;
  el.dailyPct.textContent = `${pct}%`;
  el.dailyRing.style.setProperty('--p', pct);
  el.dailyBest.textContent = state.bestStreak;
  el.dailyXp.textContent = state.todayXp;
  el.dailyCard.classList.toggle('done', pct >= 100);
}

function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const week = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
  el.desktopTime.textContent = `${hh}:${mm}`;
  el.desktopDate.textContent = `${now.getMonth() + 1}月${now.getDate()}日 周${week}`;
}

function renderSpecies() {
  el.speciesGrid.innerHTML = '';
  SPECIES.forEach((species) => {
    const locked = state.level < species.lv;
    const active = state.species === species.id;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `species-card${active ? ' active' : ''}${locked ? ' locked' : ''}`;
    btn.title = species.desc;
    btn.innerHTML = `
      <span class="sp-icon">${species.icon}</span>
      <b>${species.name}</b>
      <small>${locked ? `Lv.${species.lv}` : active ? '当前形象' : '点击切换'}</small>
      ${locked ? `<span class="sp-lock">Lv.${species.lv}</span>` : ''}
    `;
    btn.addEventListener('click', () => {
      if (locked) {
        toast(`再升到 Lv.${species.lv} 就能变成「${species.name}」`);
        return;
      }
      if (state.species === species.id) return;
      state.species = species.id;
      applyAppearance();
      renderSpecies();
      setExpr('happy', 1800);
      popSound();
      toast(`换成「${species.name}」啦 · ${species.desc}`);
      save();
    });
    el.speciesGrid.appendChild(btn);
  });
}

function renderThemes() {
  el.themeGrid.innerHTML = '';
  THEMES.forEach((theme) => {
    const locked = state.level < theme.lv;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `theme-card${state.theme === theme.id ? ' active' : ''}${locked ? ' locked' : ''}`;
    btn.innerHTML = `
      <span class="theme-swatch" style="background:${theme.swatch}"></span>
      <span class="theme-name">${theme.name}<small>${locked ? `Lv.${theme.lv} 解锁` : theme.desc}</small></span>
      ${locked ? `<span class="lock-badge">Lv.${theme.lv}</span>` : ''}
    `;
    btn.addEventListener('click', () => {
      if (locked) {
        toast(`再升到 Lv.${theme.lv} 就可以换上「${theme.name}」啦`);
        return;
      }
      state.theme = theme.id;
      applyAppearance();
      renderThemes();
      setExpr('happy', 1600);
      popSound();
      save();
    });
    el.themeGrid.appendChild(btn);
  });
}

function renderAccessories() {
  el.accGrid.innerHTML = '';
  ACCESSORIES.forEach((acc) => {
    const locked = state.level < acc.lv;
    const active = state.accessories.includes(acc.id);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `acc-card${active ? ' active' : ''}${locked ? ' locked' : ''}`;
    btn.innerHTML = `
      <span class="acc-ico">${acc.icon}</span>
      <span><b>${acc.name}</b><small>${locked ? `Lv.${acc.lv} 解锁` : active ? '已戴上' : '点击戴上'}</small></span>
      <span class="acc-check">✓</span>
    `;
    btn.addEventListener('click', () => {
      if (locked) {
        toast(`再升到 Lv.${acc.lv} 就能解锁「${acc.name}」`);
        return;
      }
      if (state.accessories.includes(acc.id)) {
        state.accessories = state.accessories.filter((id) => id !== acc.id);
      } else {
        state.accessories.push(acc.id);
      }
      applyAppearance();
      renderAccessories();
      setExpr('happy', 1400);
      popSound();
      save();
    });
    el.accGrid.appendChild(btn);
  });
}

function renderOutfits() {
  if (!el.outfitGrid) return;
  el.outfitGrid.innerHTML = '';
  OUTFITS.forEach((o) => {
    const owned = state.ownedOutfits.includes(o.id);
    const active = state.outfit === o.id;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `outfit-card${active ? ' active' : ''}${owned ? '' : ' locked'}`;
    btn.innerHTML = `
      <span class="outfit-ico">${o.icon}</span>
      <span class="outfit-name"><b>${o.name}</b><small>${owned ? o.tag : `${o.price} 🌱 购买`}</small></span>
      ${owned ? '' : `<span class="price-badge">🌱${o.price}</span>`}
    `;
    btn.addEventListener('click', () => {
      if (!owned) {
        buyOutfit(o);
        return;
      }
      if (state.outfit === o.id) return;
      state.outfit = o.id;
      applyAppearance();
      renderOutfits();
      setExpr('happy', 1800);
      popSound();
      toast(`换上「${o.name}」啦`);
      save();
    });
    el.outfitGrid.appendChild(btn);
  });

  const custom = document.createElement('button');
  custom.type = 'button';
  custom.className = `outfit-card custom${state.outfit === 'custom' ? ' active' : ''}`;
  custom.innerHTML = `
    <span class="outfit-ico">🖼️</span>
    <span class="outfit-name"><b>自定义形象</b><small>${state.customSkin ? '已上传，点击使用' : '上传图片当皮肤'}</small></span>
  `;
  custom.addEventListener('click', () => {
    if (state.customSkin) {
      state.outfit = 'custom';
      applyAppearance();
      renderOutfits();
      toast('已换上自定义形象');
      save();
    } else {
      el.customSkinInput.click();
    }
  });
  el.outfitGrid.appendChild(custom);
}

function buyOutfit(o) {
  if (state.coins < o.price) {
    toast(`星芽币不够：还需 ${o.price - state.coins} 🌱，去答题赚币吧`);
    return;
  }
  state.coins -= o.price;
  state.ownedOutfits.push(o.id);
  state.outfit = o.id;
  applyAppearance();
  renderHeader();
  renderOutfits();
  save();
  successSound();
  setExpr('excited', 2200);
  spawnHearts(6);
  toast(`解锁「${o.name}」并换上啦！`);
}

function renderEyes() {
  el.eyeRow.innerHTML = '';
  EYES.forEach((eye) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `eye-dot${state.eye === eye.id ? ' active' : ''}`;
    btn.style.background = eye.color;
    btn.title = eye.name;
    btn.setAttribute('aria-label', eye.name);
    btn.addEventListener('click', () => {
      state.eye = eye.id;
      applyAppearance();
      renderEyes();
      popSound();
      save();
    });
    el.eyeRow.appendChild(btn);
  });
}

function renderEvolution() {
  const current = formFor(state.level);
  el.evoTrack.innerHTML = '';
  EVOLUTION.forEach((item) => {
    const node = document.createElement('div');
    const done = state.level >= item.lv;
    node.className = `evo-item${done ? ' done' : ''}${item.name === current ? ' now' : ''}`;
    node.innerHTML = `<span class="evo-orb"></span><small>${item.name}</small>`;
    el.evoTrack.appendChild(node);
  });
}

function renderDress() {
  renderSpecies();
  renderOutfits();
  renderThemes();
  renderAccessories();
  renderEyes();
  renderEvolution();
}

/* ---------------- 学习事件 ---------------- */
el.hintBtn.addEventListener('click', useHint);
el.nextBtn.addEventListener('click', nextQuestion);

el.options.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    const btn = e.target.closest('.option');
    if (btn) btn.click();
  }
});

$('#speakTip').addEventListener('click', () => {
  if (!currentTip) {
    toast('先答题或点提示，才有技巧可以读哦');
    return;
  }
  voiceSay(currentTip, () => setExpr('happy', 1200));
});

/* ---------------- 升级弹窗 ---------------- */
function showLevelUp(rewards, oldForm) {
  const nowForm = formFor(state.level);
  el.levelupNum.textContent = `Lv.${state.level}`;
  el.levelupTitle.textContent = nowForm !== oldForm ? `进化成「${nowForm}」` : '又长大一点点';
  el.levelupText.textContent = rewards.length
    ? '新的样子、新的配饰，都是你一道题一道题攒出来的。'
    : '离下一阶更近啦。今天的每一道题，都有好好算数。';

  const pills = ['+20 🌱 星芽币', ...rewards];
  el.levelupRewards.innerHTML = pills
    .map((text) => `<span class="reward-pill">${text}</span>`)
    .join('');

  el.confetti.innerHTML = '';
  const colors = ['#ff9dbd', '#b8a5f7', '#ffd86b', '#7fe0c5', '#ffc46b'];
  for (let i = 0; i < 28; i += 1) {
    const bit = document.createElement('i');
    bit.style.left = `${rand(2, 98)}%`;
    bit.style.background = pick(colors);
    bit.style.animationDelay = `${rand(0, 0.9)}s`;
    bit.style.animationDuration = `${rand(1.6, 2.8)}s`;
    bit.style.transform = `rotate(${rand(0, 180)}deg)`;
    el.confetti.appendChild(bit);
  }

  setExpr('excited', 0);
  el.levelup.classList.add('show');
  levelSound();
  spawnHearts(9);
}

$('#levelupBtn').addEventListener('click', () => {
  el.levelup.classList.remove('show');
  setExpr('happy', 1800);
  say('继续吧，我陪着你。', 4200);
  popSound();
});

/* ---------------- 通话 ---------------- */
function buildWave() {
  el.wave.innerHTML = '';
  for (let i = 0; i < 22; i += 1) {
    const bar = document.createElement('i');
    bar.style.animationDelay = `${-i * 0.07}s`;
    bar.style.animationDuration = `${rand(0.7, 1.15)}s`;
    bar.style.height = `${rand(6, 24)}px`;
    el.wave.appendChild(bar);
  }
}

function setCallMode(mode) {
  callMode = mode;
  el.callStage.classList.remove('listening', 'thinking', 'speaking');
  if (mode !== 'idle') el.callStage.classList.add(mode);
  el.callBtn.setAttribute('aria-pressed', mode === 'listening' ? 'true' : 'false');

  const texts = {
    idle: '轻触麦克风，和糯糯说说话',
    listening: '我在听… 说完可以停一下',
    thinking: '让我想一下…',
    speaking: '糯糯正在回答（点麦克风可打断）'
  };
  el.callState.textContent = texts[mode] || texts.idle;
}

function appendMsg(who, text, system = false) {
  const row = document.createElement('div');
  row.className = `msg ${who}`;

  if (system || who === 'system') {
    row.classList.add('system');
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;
    row.appendChild(bubble);
  } else {
    const avatar = document.createElement('span');
    avatar.className = 'msg-avatar';
    avatar.textContent = who === 'pet' ? '糯' : '你';
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;
    row.append(avatar, bubble);
  }

  el.transcript.appendChild(row);
  while (el.transcript.children.length > 24) {
    el.transcript.removeChild(el.transcript.firstElementChild);
  }
  el.transcript.scrollTop = el.transcript.scrollHeight;
}

function ensureRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  if (!recognition) {
    recognition = new SR();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      gotSpeech = true;
      clearTimeout(listenTimer);
      recognizing = false;
      const text = event.results?.[0]?.[0]?.transcript?.trim();
      if (text) handleUserText(text);
    };

    recognition.onerror = (event) => {
      recognizing = false;
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      clearTimeout(listenTimer);
      if (callMode === 'listening') {
        toast('没有拿到麦克风权限，先用示例问题演示');
        setTimeout(() => {
          if (callMode === 'listening') handleUserText(pick(DEMO_PROMPTS), true);
        }, 450);
      }
    };

    recognition.onend = () => {
      recognizing = false;
    };
  }
  return recognition;
}

function startListening() {
  if (sleeping) wakeUp();
  if (callMode === 'thinking') {
    toast('让我先想完这一句～');
    return;
  }
  if (callMode === 'speaking') stopSpeaking();

  gotSpeech = false;
  setCallMode('listening');

  const rec = ensureRecognition();
  let started = false;
  if (rec) {
    try {
      rec.start();
      started = true;
      recognizing = true;
    } catch (err) {
      started = false;
    }
  }

  clearTimeout(listenTimer);
  listenTimer = setTimeout(() => {
    if (callMode === 'listening' && !gotSpeech) {
      if (recognizing && rec) {
        try { rec.stop(); } catch (err) { /* 已结束 */ }
      }
      handleUserText(pick(DEMO_PROMPTS), true);
    }
  }, started ? 8000 : 1500);

  if (!started) {
    toast('此浏览器未启用麦克风，正在用示例问题演示');
  }
}

function stopListening() {
  clearTimeout(listenTimer);
  if (recognizing && recognition) {
    try { recognition.stop(); } catch (err) { /* 已结束 */ }
  }
  recognizing = false;
  if (callMode === 'listening') setCallMode('idle');
}

function makeReply(text) {
  const q = QUESTIONS[qIndex % QUESTIONS.length];
  const t = text.toLowerCase();

  if (/累|困|疲|不想|休息|歇/.test(t)) {
    return '那就先停三分钟吧。站起来伸个懒腰、喝口水，回来我陪你只做一道题。';
  }
  if (/你好|嗨|在吗|早上好|中午好|晚上好/.test(t)) {
    return '我在呀。今天想先做题，还是先聊两句？';
  }
  if (/谢谢|厉害|可爱|喜欢你/.test(t)) {
    return '被你夸到啦。那……再陪你做一道，就一道。';
  }
  if (/笑话|无聊|讲个/.test(t)) {
    return '一颗汤圆去考试，回来变成了糯米团——因为它被“煮”透了。';
  }
  if (/吃|布丁|饿/.test(t)) {
    return '布丁在冰箱里，我替你看着。先把手头这题收个尾？';
  }
  if (/技巧|方法|怎么学|窍门|思路/.test(t)) {
    return q.tip;
  }
  if (/为什么|这题|答案|选什么|怎么算|讲.*题/.test(t)) {
    return `${q.explain} 记住这句：${q.tip}`;
  }
  return '我听到啦。你可以问我这道题的思路，或者让我陪你休息一下。';
}

function handleUserText(text, demo = false) {
  const clean = String(text || '').trim();
  if (!clean) return;
  if (callMode === 'thinking' || callMode === 'speaking') return;

  clearTimeout(listenTimer);
  appendMsg('user', clean);
  setCallMode('thinking');
  if (demo) toast('演示模式：用示例问题代替语音输入');

  const reply = makeReply(clean);
  setTimeout(() => {
    if (callMode !== 'thinking') return;
    appendMsg('pet', reply);
    if (subtitles) say(clip(reply, 78), Math.min(9000, 2600 + reply.length * 90));
    speakCall(reply);
  }, 760);
}

function voiceSay(text, onEnd, opts = {}) {
  const token = ++speakingToken;
  clearTimeout(speakTimer);
  el.petSvg.classList.add('speaking');

  const duration = clamp(text.length * 145, 1600, 11000);
  let ended = false;

  const finish = () => {
    if (ended || token !== speakingToken) return;
    ended = true;
    clearTimeout(speakTimer);
    el.petSvg.classList.remove('speaking');
    if (typeof onEnd === 'function') onEnd();
  };

  const canSpeak = state.sound && !muted && 'speechSynthesis' in window;
  if (!canSpeak) {
    speakTimer = setTimeout(finish, Math.min(duration, 4200));
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'zh-CN';
    utter.pitch = opts.pitch || 1.5;
    utter.rate = opts.rate || 1.04;
    utter.volume = 0.92;

    const voices = window.speechSynthesis.getVoices();
    const zh = voices.find((v) => /zh[-_]CN/i.test(v.lang) && /xiaoxiao|huihui|yaoyao|tingting|female/i.test(v.name))
      || voices.find((v) => /zh/i.test(v.lang));
    if (zh) utter.voice = zh;

    utter.onend = finish;
    utter.onerror = finish;
    window.speechSynthesis.speak(utter);
    speakTimer = setTimeout(finish, duration + 1600);
  } catch (err) {
    speakTimer = setTimeout(finish, Math.min(duration, 4200));
  }
}

function speakCall(text) {
  setCallMode('speaking');
  voiceSay(text, () => {
    if (callMode === 'speaking') {
      setCallMode('idle');
      if (!sleeping) setExpr('happy', 1400);
    }
  });
}

function stopVoice() {
  speakingToken += 1;
  clearTimeout(speakTimer);
  el.petSvg.classList.remove('speaking');
  if ('speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch (err) { /* 忽略 */ }
  }
}

function stopSpeaking() {
  stopVoice();
  if (callMode === 'speaking') setCallMode('idle');
}

function interruptCall() {
  if (callMode !== 'speaking') {
    toast('现在没有在说话～');
    return;
  }
  stopVoice();
  appendMsg('system', '（已打断）', true);
  setCallMode('idle');
  el.callState.textContent = '已打断，点麦克风继续说';
  popSound();
}

el.callBtn.addEventListener('click', () => {
  ensureAudio();
  if (callMode === 'idle') startListening();
  else if (callMode === 'listening') stopListening();
  else if (callMode === 'speaking') interruptCall();
  else toast('让我先想完这一句～');
});

$('#interruptBtn').addEventListener('click', interruptCall);

el.muteBtn.addEventListener('click', () => {
  muted = !muted;
  el.muteBtn.textContent = muted ? '🔇 已静音' : '🔊 声音开';
  if (muted) {
    stopVoice();
    if (callMode === 'speaking') {
      setCallMode('idle');
      el.callState.textContent = '已静音，点麦克风继续';
    }
  }
  toast(muted ? '已静音，字幕还在' : '声音打开');
});

el.subBtn.addEventListener('click', () => {
  subtitles = !subtitles;
  el.subBtn.textContent = subtitles ? '💬 字幕开' : '💬 字幕关';
  if (!subtitles) el.bubble.classList.remove('show');
  else if (callMode === 'speaking') say('字幕已打开。', 2200);
  toast(subtitles ? '字幕已打开' : '字幕已关闭，语音仍会继续');
});

$$('#suggestRow .chip-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    ensureAudio();
    handleUserText(btn.textContent.trim());
  });
});

/* ---------------- 互动 ---------------- */
function wakeUp() {
  if (!sleeping) return;
  sleeping = false;
  el.petPosition.classList.remove('sleeping');
  el.sleepLabel.textContent = '哄睡';
  setExpr('happy', 1800);
  clearInterval(zzzTimer);
  zzzTimer = null;
  say('醒啦！我刚刚梦到你把错题都做对了。', 4600);
}

function toggleSleep() {
  if (sleeping) {
    wakeUp();
    return;
  }
  sleeping = true;
  stopSpeaking();
  el.petPosition.classList.add('sleeping');
  el.sleepLabel.textContent = '叫醒';
  setExpr('sleep', 0);
  say('那我眯一会儿…有事点我一下。', 4200);
  tone(440, 0.2, 'sine', 0.02);
  spawnZzz();
  clearInterval(zzzTimer);
  zzzTimer = setInterval(() => {
    if (sleeping) spawnZzz();
  }, 2200);
}

function petPet(big = true) {
  if (sleeping) wakeUp();
  setExpr(Math.random() > 0.45 ? 'love' : 'happy', 2200);
  spawnHearts(big ? 7 : 3);
  bumpStat('intimacy', big ? 3 : 1);
  bumpStat('mood', big ? 2 : 1);
  popSound();
  if (big) say(pick(PET_LINES), 5200);
}

function feed() {
  if (sleeping) wakeUp();
  if (state.hunger >= 98) {
    say('已经吃得圆滚滚啦，再吃就要变成大福了。', 4800);
    return;
  }
  bumpStat('hunger', 24);
  bumpStat('mood', 7);
  bumpStat('intimacy', 2);
  setExpr('happy', 2600);
  spawnCookie();
  successSound();
  say(pick(FEED_LINES), 4800);
}

function playBall() {
  if (playing) return;
  if (sleeping) wakeUp();
  playing = true;
  bumpStat('mood', 9);
  bumpStat('hunger', -4);
  bumpStat('stamina', -6);
  setExpr('excited', 3400);
  popSound();
  say('接住！', 2200);

  const rect = el.petSvg.getBoundingClientRect();
  const startX = rect.left + rect.width * 0.66;
  const startY = rect.top + rect.height * 0.74;
  const ball = document.createElement('div');
  ball.className = 'fx-ball';
  el.fx.appendChild(ball);

  const t0 = performance.now();
  const duration = 2400;

  function frame(now) {
    const p = Math.min((now - t0) / duration, 1);
    const x = startX + Math.sin(p * Math.PI * 3) * 92 + p * 26;
    const y = startY - Math.abs(Math.sin(p * Math.PI * 4)) * 118;
    ball.style.transform = `translate(${x - 13}px, ${y - 13}px)`;

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * 0.48;
    el.petSvg.style.setProperty('--px', `${clamp((x - cx) / 26, -4.5, 4.5)}px`);
    el.petSvg.style.setProperty('--py', `${clamp((y - cy) / 34, -3.5, 3.5)}px`);

    if (p < 1) {
      requestAnimationFrame(frame);
    } else {
      ball.remove();
      playing = false;
      el.petSvg.style.setProperty('--px', '0px');
      el.petSvg.style.setProperty('--py', '0px');
      setExpr('happy', 1800);
      spawnHearts(3);
      say('再来一次也可以！', 3200);
    }
  }
  requestAnimationFrame(frame);
}

function toggleFocus() {
  if (focusTimer) {
    clearInterval(focusTimer);
    focusTimer = null;
    el.focusLabel.textContent = '专注 25 分钟';
    toast('已取消专注计时');
    return;
  }

  focusEnd = Date.now() + 25 * 60 * 1000;
  say('25 分钟，我陪你。先做最重要的一件事。', 5200);
  toast('专注开始：25 分钟后我叫你');
  setExpr('happy', 1800);
  popSound();

  const tick = () => {
    const left = Math.max(0, focusEnd - Date.now());
    const total = Math.ceil(left / 1000);
    const mm = String(Math.floor(total / 60)).padStart(2, '0');
    const ss = String(total % 60).padStart(2, '0');
    el.focusLabel.textContent = `专注 ${mm}:${ss}`;
    if (left <= 0) {
      clearInterval(focusTimer);
      focusTimer = null;
      el.focusLabel.textContent = '专注 25 分钟';
      successSound();
      spawnHearts(8);
      setExpr('excited', 3200);
      say('时间到！起来走走，喝口水。', 7000);
      toast('专注完成，休息 5 分钟吧');
    }
  };
  tick();
  focusTimer = setInterval(tick, 1000);
}

function tickle() {
  if (sleeping) wakeUp();
  el.petPosition.classList.add('tickled');
  setTimeout(() => el.petPosition.classList.remove('tickled'), 620);
  setExpr('love', 2200);
  spawnHearts(5);
  bumpStat('intimacy', 2);
  bumpStat('mood', 4);
  popSound();
  say(pick(TICKLE_LINES), 4600);
}

function tellStory() {
  if (sleeping) wakeUp();
  setExpr('thinking', 1200);
  setTimeout(() => setExpr('happy', 4200), 1200);
  spawnHearts(3);
  bumpStat('mood', 6);
  bumpStat('intimacy', 1);
  tone(660, 0.12, 'sine', 0.025);
  say(pick(STORY_LINES), 10000);
}

function doAction(action) {
  lastInteract = Date.now();
  const itemId = ACTION_ITEM[action];
  if (itemId) {
    if (itemCount(itemId) <= 0) {
      const it = itemById(itemId);
      toast(`没有「${it.name}」啦，去「道具商店」买一个`);
      switchTab('interact');
      const shop = $('#shopGrid');
      if (shop) {
        shop.scrollIntoView({ behavior: 'smooth', block: 'center' });
        shop.classList.remove('need-item');
        void shop.offsetWidth;
        shop.classList.add('need-item');
        setTimeout(() => shop.classList.remove('need-item'), 700);
      }
      return;
    }
    state.items[itemId] = itemCount(itemId) - 1;
    state.todayInteractions += 1;
    renderEconomy();
    save();
  }
  switch (action) {
    case 'pet': petPet(true); break;
    case 'feed': feed(); break;
    case 'play': playBall(); break;
    case 'tickle': tickle(); break;
    case 'story': tellStory(); break;
    case 'sleep': toggleSleep(); break;
    case 'focus': toggleFocus(); break;
    case 'talk':
      switchTab('call');
      setPanelCollapsed(false);
      break;
    default: break;
  }
}

$$('[data-action]').forEach((btn) => {
  btn.addEventListener('click', () => doAction(btn.dataset.action));
});

/* ---------------- 特效 ---------------- */
function spawnHearts(count = 5) {
  const rect = el.petSvg.getBoundingClientRect();
  for (let i = 0; i < count; i += 1) {
    const node = document.createElement('span');
    node.className = 'fx-heart';
    node.textContent = pick(['💗', '💕', '✨', '💖']);
    node.style.left = `${rect.left + rect.width / 2 + rand(-58, 58)}px`;
    node.style.top = `${rect.top + rect.height * 0.38 + rand(-20, 30)}px`;
    node.style.setProperty('--dx', `${rand(-34, 34)}px`);
    node.style.fontSize = `${rand(11, 20)}px`;
    node.style.animationDelay = `${i * 55}ms`;
    el.fx.appendChild(node);
    setTimeout(() => node.remove(), 1900);
  }
}

function spawnXp(amount) {
  const rect = el.petSvg.getBoundingClientRect();
  const node = document.createElement('span');
  node.className = 'fx-xp';
  node.textContent = `+${amount} XP`;
  node.style.left = `${rect.left + rect.width / 2}px`;
  node.style.top = `${rect.top + rect.height * 0.34}px`;
  el.fx.appendChild(node);
  setTimeout(() => node.remove(), 1600);
}

function spawnCoin(amount) {
  const rect = el.petSvg.getBoundingClientRect();
  const node = document.createElement('span');
  node.className = 'fx-coin';
  node.textContent = `+${amount} 🌱 星芽币`;
  node.style.left = `${rect.left + rect.width / 2}px`;
  node.style.top = `${rect.top + rect.height * 0.27}px`;
  el.fx.appendChild(node);
  setTimeout(() => node.remove(), 1800);
}

function spawnCookie() {
  const rect = el.petSvg.getBoundingClientRect();
  const node = document.createElement('span');
  node.className = 'fx-cookie';
  node.textContent = '🍮';
  node.style.left = `${rect.left + rect.width * 0.55}px`;
  node.style.top = `${rect.top + rect.height * 0.52}px`;
  el.fx.appendChild(node);
  setTimeout(() => node.remove(), 1500);
}

function spawnItem(icon) {
  const rect = el.petSvg.getBoundingClientRect();
  const node = document.createElement('span');
  node.className = 'fx-item';
  node.textContent = icon;
  node.style.left = `${rect.left + rect.width / 2}px`;
  node.style.top = `${rect.top + rect.height * 0.5}px`;
  el.fx.appendChild(node);
  setTimeout(() => node.remove(), 1600);
}

function spawnZzz() {
  if (!sleeping) return;
  const rect = el.petSvg.getBoundingClientRect();
  const node = document.createElement('span');
  node.className = 'fx-zzz';
  node.textContent = pick(['z', 'Z', 'zz']);
  node.style.left = `${rect.left + rect.width * 0.66}px`;
  node.style.top = `${rect.top + rect.height * 0.26}px`;
  node.style.fontSize = `${rand(11, 18)}px`;
  el.fx.appendChild(node);
  setTimeout(() => node.remove(), 3600);
}

/* ---------------- 拖动 / 摸摸 ---------------- */
function applyPos() {
  el.petPosition.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
}

el.petPosition.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button')) return;
  lastInteract = Date.now();
  ensureAudio();
  dragState = {
    x: event.clientX,
    y: event.clientY,
    baseX: pos.x,
    baseY: pos.y,
    moved: false,
    id: event.pointerId
  };
  el.petPosition.classList.add('dragging');
  if (el.petPosition.setPointerCapture) {
    try { el.petPosition.setPointerCapture(event.pointerId); } catch (err) { /* 忽略 */ }
  }
});

el.petPosition.addEventListener('pointermove', (event) => {
  if (!dragState || event.pointerId !== dragState.id) return;
  const dx = event.clientX - dragState.x;
  const dy = event.clientY - dragState.y;
  if (Math.hypot(dx, dy) > 5) dragState.moved = true;
  if (!dragState.moved) return;

  const maxX = Math.max(40, el.stage.clientWidth / 2 - 150);
  const maxY = Math.max(40, el.stage.clientHeight / 2 - 170);
  pos.x = clamp(dragState.baseX + dx, -maxX, maxX);
  pos.y = clamp(dragState.baseY + dy, -maxY, maxY);
  applyPos();
});

function finishDrag(event) {
  if (!dragState) return;
  if (event && event.pointerId !== undefined && event.pointerId !== dragState.id) return;
  const moved = dragState.moved;
  dragState = null;
  el.petPosition.classList.remove('dragging');

  if (!moved) {
    if (document.body.classList.contains('desktop-mode')) {
      enterAppFromDesktop();
    } else if (itemCount('feather') > 0) {
      state.items.feather = itemCount('feather') - 1;
      state.todayInteractions += 1;
      renderEconomy();
      save();
      petPet(true);
    } else {
      toast('没有「羽毛逗猫棒」啦，去商店买一个');
    }
  } else {
    setExpr('happy', 1200);
    popSound();
    setTimeout(() => {
      pos = { x: 0, y: 0 };
      applyPos();
    }, 650);
  }
}

el.petPosition.addEventListener('pointerup', finishDrag);
el.petPosition.addEventListener('pointercancel', finishDrag);

el.petPosition.addEventListener('dblclick', (event) => {
  if (event.target.closest('button')) return;
  setPanelCollapsed(false);
  switchTab('interact');
  toast('面板打开啦');
});

el.petSvg.addEventListener('pointermove', (event) => {
  if (dragState) return;
  const now = performance.now();
  if (now - lastPetMove < 620) return;
  lastPetMove = now;

  const rect = el.petSvg.getBoundingClientRect();
  if (event.y > rect.top + rect.height * 0.48) return;

  pettingCount += 1;
  if (pettingCount % 3 === 0) {
    setExpr('love', 1200);
    spawnHearts(1);
  }
});

/* ---------------- 视线跟随 ---------------- */
el.stage.addEventListener('pointermove', (event) => {
  if (sleeping) return;
  const rect = el.petSvg.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height * 0.47;
  const dx = clamp((event.clientX - cx) / (rect.width * 0.62), -1, 1);
  const dy = clamp((event.clientY - cy) / (rect.height * 0.5), -1, 1);
  el.petSvg.style.setProperty('--px', `${(dx * 4.2).toFixed(1)}px`);
  el.petSvg.style.setProperty('--py', `${(dy * 3.4).toFixed(1)}px`);
  tiltY = dx * 10;
  tiltX = -dy * 9;
  applyScale();
});

el.stage.addEventListener('pointerleave', () => {
  el.petSvg.style.setProperty('--px', '0px');
  el.petSvg.style.setProperty('--py', '0px');
  tiltX = 0;
  tiltY = 0;
  applyScale();
});

/* ---------------- 面板 / Tab ---------------- */
function switchTab(name) {
  $$('.tab').forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  $$('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panel === name);
  });
  $$('.dock-btn[data-tab]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });
  if (name === 'park') renderPark();
  el.panelBody.scrollTop = 0;
}

$$('.tab').forEach((tab) => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

$$('.dock-btn[data-tab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setPanelCollapsed(false);
    switchTab(btn.dataset.tab);
  });
});

function setPanelCollapsed(collapsed) {
  el.app.classList.toggle('panel-collapsed', collapsed);
  el.reopenBtn.classList.toggle('show', collapsed);
  $('#panelToggleBtn').textContent = collapsed ? '打开面板' : '收起面板';
}

$('#panelToggleBtn').addEventListener('click', () => {
  setPanelCollapsed(!el.app.classList.contains('panel-collapsed'));
});
$('#panelClose').addEventListener('click', () => setPanelCollapsed(true));
$('#dockHide').addEventListener('click', () => setPanelCollapsed(true));
el.reopenBtn.addEventListener('click', () => setPanelCollapsed(false));

$('#desktopModeBtn').addEventListener('click', () => {
  document.body.classList.add('desktop-mode');
  setPanelCollapsed(false);
  updateClock();
  toast('桌面模式：点一下糯糯，就能回到知芽');
});

function enterAppFromDesktop() {
  if (!document.body.classList.contains('desktop-mode')) return;
  document.body.classList.remove('desktop-mode');
  setPanelCollapsed(false);
  switchTab('study');
  el.app.classList.add('entering');
  setTimeout(() => el.app.classList.remove('entering'), 720);
  setExpr('happy', 2000);
  spawnHearts(4);
  popSound();
  say('欢迎回来，今天想先做哪一题？', 5000);
  toast('已回到知芽');
}

$('#desktopExit').addEventListener('click', enterAppFromDesktop);
el.desktopEntry.addEventListener('click', enterAppFromDesktop);

/* ---------------- 下载 / 二维码 ---------------- */
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  const btn = $('#installBtn');
  if (btn) btn.classList.add('ready');
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const btn = $('#installBtn');
  if (btn) btn.style.display = 'none';
  toast('知芽已安装到主屏幕');
});

function openDownload() {
  el.downloadModal.classList.add('show');
}

function closeDownload() {
  el.downloadModal.classList.remove('show');
}

$('#downloadBtn').addEventListener('click', openDownload);
$('#downloadClose').addEventListener('click', closeDownload);
el.downloadModal.addEventListener('click', (event) => {
  if (event.target === el.downloadModal) closeDownload();
});

$('#installBtn').addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    try {
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') toast('正在安装知芽…');
      else toast('已取消安装，随时可以再点右上角「安装」');
    } catch (err) { /* 浏览器不支持时忽略 */ }
    deferredPrompt = null;
    return;
  }
  openDownload();
  toast(isIOS ? 'Safari：点底部分享 → 添加到主屏幕' : '浏览器菜单 → 安装应用 / 添加到主屏幕');
});

if (isStandalone) {
  const btn = $('#installBtn');
  if (btn) btn.style.display = 'none';
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

/* ---------------- 装扮事件 ---------------- */
el.sizeRange.addEventListener('input', () => {
  state.size = Number(el.sizeRange.value);
  applyAppearance();
  save();
});

$('#nameSave').addEventListener('click', () => {
  const value = el.nameInput.value.trim().slice(0, 8);
  if (!value) {
    toast('名字不能是空的哦');
    return;
  }
  state.name = value;
  renderHeader();
  save();
  toast(`以后就叫我「${value}」啦`);
  setExpr('happy', 1800);
});

el.nameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') $('#nameSave').click();
});

el.customSkinInput.addEventListener('change', (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (!/^image\//.test(file.type)) {
    toast('请选择一张图片文件');
    return;
  }
  if (file.size > 700 * 1024) {
    toast('图片有点大，请选 700KB 以内的');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    state.customSkin = reader.result;
    state.outfit = 'custom';
    applyAppearance();
    renderOutfits();
    save();
    toast('自定义形象已保存（仅存本地）');
    setExpr('happy', 1800);
  };
  reader.readAsDataURL(file);
  event.target.value = '';
});

el.customSkinClear.addEventListener('click', () => {
  state.customSkin = '';
  if (state.outfit === 'custom') state.outfit = 'mochi';
  applyAppearance();
  renderOutfits();
  save();
  toast('已清除自定义形象');
});

/* ---------------- 开关 / 重置 ---------------- */
$('#tgTop').addEventListener('change', (event) => {
  state.topmost = event.target.checked;
  save();
  toast(`桌面版：窗口置顶已${state.topmost ? '开启' : '关闭'}`);
});

$('#tgThrough').addEventListener('change', (event) => {
  state.clickThrough = event.target.checked;
  save();
  toast(state.clickThrough ? '桌面版：鼠标穿透已开启，按 Alt 可临时恢复点击' : '鼠标穿透已关闭');
});

$('#tgChatter').addEventListener('change', (event) => {
  state.chatter = event.target.checked;
  save();
  toast(state.chatter ? '空闲唠叨已打开' : '糯糯会安静陪你');
});

$('#tgSound').addEventListener('change', (event) => {
  state.sound = event.target.checked;
  save();
  if (!state.sound) {
    stopVoice();
    if (callMode === 'speaking') {
      setCallMode('idle');
      el.callState.textContent = '音效已关闭，点麦克风继续';
    }
  }
  toast(state.sound ? '音效已打开' : '音效已关闭');
});

$('#resetBtn').addEventListener('click', () => {
  if (window.confirm('要清空等级、错题和装扮，回到初始状态吗？')) {
    localStorage.removeItem(STORE_KEY);
    window.location.reload();
  }
});

/* ---------------- 循环 ---------------- */
function blinkLoop() {
  const delay = rand(2600, 5600);
  setTimeout(() => {
    const expr = el.petSvg.dataset.expr;
    if (!sleeping && expr !== 'sleep' && expr !== 'happy' && expr !== 'love') {
      el.petSvg.classList.add('blinking');
      setTimeout(() => el.petSvg.classList.remove('blinking'), 120);
    }
    blinkLoop();
  }, delay);
}

function idleChatter() {
  if (!state.chatter || sleeping || document.hidden) return;
  if (callMode !== 'idle') return;
  if (Date.now() - lastInteract < 42000) return;
  if (el.levelup.classList.contains('show')) return;
  say(pick(IDLE_LINES), 6200);
  setExpr(pick(['happy', 'thinking']), 2000);
}

/* ---------------- 宠物乐园（模拟联机） ---------------- */
function shuffleVisitors() {
  const arr = [...VISITORS];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, 3);
}

function parkLog(text, who = '') {
  if (!el.parkLog) return;
  const node = document.createElement('p');
  node.className = 'park-line';
  if (who) node.innerHTML = `<b>${who}</b>：${text}`;
  else node.textContent = text;
  el.parkLog.prepend(node);
  while (el.parkLog.children.length > 12) el.parkLog.removeChild(el.parkLog.lastElementChild);
}

function renderPark() {
  if (!el.parkVisitors) return;
  parkVisitors = shuffleVisitors();
  el.parkVisitors.innerHTML = '';
  parkVisitors.forEach((v) => {
    const card = document.createElement('div');
    card.className = 'park-visitor';
    card.style.setProperty('--vc', v.color);
    card.innerHTML = `
      <div class="pv-avatar">${v.icon}</div>
      <b>${v.name}</b>
      <div class="pv-btns">
        <button data-park="greet" title="打招呼">👋</button>
        <button data-park="gift" title="送小团子">🎁</button>
        <button data-park="rps" title="猜拳">✊</button>
      </div>
    `;
    card.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.park;
        if (act === 'greet') greetVisitor(v);
        else if (act === 'gift') giftVisitor(v);
        else if (act === 'rps') rpsRound(v, Object.keys(RPS)[Math.floor(Math.random() * 3)]);
      });
    });
    el.parkVisitors.appendChild(card);
  });
}

function greetVisitor(v) {
  setExpr('happy', 1800);
  popSound();
  say(pick(v.hi), 4200);
  parkLog(pick(v.hi), v.name);
}

function giftVisitor(v) {
  if (itemCount('dango') <= 0) {
    toast('送礼需要「小团子」，去商店买一个吧');
    return;
  }
  state.items.dango = itemCount('dango') - 1;
  renderEconomy();
  save();
  setExpr('love', 2000);
  spawnItem('🍡');
  successSound();
  const line = pick(v.gift);
  parkLog(line, v.name);
  say(line, 5000);
}

const RPS = { rock: '✊', paper: '✋', scissors: '✌️' };
function rpsWinner(a, b) {
  if (a === b) return 0;
  return (a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper') ? 1 : -1;
}

function rpsRound(v, me) {
  const hands = Object.keys(RPS);
  const foe = hands[Math.floor(Math.random() * 3)];
  const win = rpsWinner(me, foe);
  const text = `你出${RPS[me]}，${v.name}出${RPS[foe]} —— ${win === 1 ? '你赢啦 +2 🌱' : win === -1 ? `${v.name}赢啦` : '平局 +1 🌱'}`;
  el.rpsResult.textContent = text;
  parkLog(text, '猜拳');
  if (win >= 0) {
    state.coins += win === 1 ? 2 : 1;
    renderHeader();
    save();
    successSound();
  } else {
    failSound();
  }
  setExpr(win >= 0 ? 'excited' : 'sad', 1800);
}

function takePhoto() {
  const names = parkVisitors.map((v) => v.name).join('、');
  const line = `【知芽宠物乐园】糯糯和 ${names} 一起玩耍，拍了一张软乎乎的合照 📸`;
  const photo = document.createElement('div');
  photo.className = 'park-photo';
  photo.innerHTML = `
    <div class="park-photo-emojis">🫧 ${parkVisitors.map((v) => v.icon).join(' ')}</div>
    <small>${line}</small>
    <button class="soft-btn tiny" type="button">复制分享文案</button>
  `;
  photo.querySelector('button').addEventListener('click', () => {
    if (navigator.clipboard) navigator.clipboard.writeText(line).catch(() => {});
    toast('分享文案已复制');
  });
  el.parkLog.prepend(photo);
  setExpr('excited', 2200);
  spawnHearts(6);
  levelSound();
}

el.parkRefresh.addEventListener('click', () => {
  renderPark();
  parkLog('来了一批新朋友～');
  popSound();
});
el.parkPhotoBtn.addEventListener('click', takePhoto);
$$('#rpsRow .rps-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const v = parkVisitors[Math.floor(Math.random() * parkVisitors.length)];
    if (v) rpsRound(v, btn.dataset.hand);
  });
});

/* ---------------- 好友联机（PeerJS 点对点） ---------------- */
function mpSelf() {
  const outfit = OUTFITS.find((o) => o.id === state.outfit);
  return { name: state.name, skin: outfit ? outfit.name : '自定义', icon: outfit ? outfit.icon : '🖼️' };
}

function mpStatus(text) {
  if (el.mpStatus) el.mpStatus.textContent = text;
}

function mpAddPeer(info) {
  if (!el.mpPeers) return;
  const node = document.createElement('span');
  node.className = 'mp-peer';
  node.innerHTML = `<span class="mp-ico">${info.icon || '🫧'}</span>${info.name} · ${info.skin}`;
  el.mpPeers.appendChild(node);
}

function mpSend(obj) {
  if (mpConn && mpConn.open) {
    mpConn.send({ ...mpSelf(), ...obj });
  }
}

function mpBindConn(conn) {
  mpConn = conn;
  const onOpen = () => {
    if (el.mpActions) el.mpActions.hidden = false;
    mpStatus(mpIsHost ? '好友已加入！' : '已连上房间');
    mpSend({ type: 'hello' });
    popSound();
    parkLog('已建立点对点连接', '联机');
  };
  conn.on('open', onOpen);
  if (conn.open) onOpen();

  conn.on('data', (data) => {
    if (!data) return;
    if (data.type === 'hello') {
      mpAddPeer(data);
      mpStatus(`和 ${data.name} 在一起玩`);
      parkLog(`和「${data.name}」连上了～`, '联机');
      mpSend({ type: 'hello' });
    } else if (data.type === 'hi') {
      parkLog('👋 ' + data.text, data.name);
      say(`${data.name} 和你打招呼啦`, 4200);
    } else if (data.type === 'gift') {
      parkLog('🎁 ' + data.text, data.name);
      spawnItem('🎁');
    } else if (data.type === 'emoji') {
      parkLog(data.text, data.name);
      spawnHearts(4);
    } else if (data.type === 'chat') {
      parkLog(data.text, data.name);
      say(`${data.name}：${data.text}`, 5200);
    }
  });
  conn.on('close', () => { mpStatus('连接已断开'); if (el.mpActions) el.mpActions.hidden = true; });
  conn.on('error', (err) => {
    mpStatus('连接出错：' + ((err && (err.type || err.message)) || ''));
    parkLog('连接出错，可能网络环境不支持点对点', '联机');
  });
}

const MP_ICE = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }
  ]
};

function mpCreate() {
  if (!window.Peer) { toast('当前网络无法加载联机组件'); return; }
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  mpIsHost = true;
  mpPeer = new window.Peer('zhiya-' + code, { debug: 0, config: MP_ICE });
  mpPeer.on('open', () => { mpStatus(`房间已创建，房间码：${code}`); if (el.mpCode) el.mpCode.value = code; });
  mpPeer.on('connection', (conn) => mpBindConn(conn));
  mpPeer.on('disconnected', () => { mpStatus('与联机服务断开，正在重连…'); try { mpPeer.reconnect(); } catch (err) {} });
  mpPeer.on('error', (err) => mpStatus('联机出错：' + (err.type || err.message || '')));
}

function mpJoinRoom() {
  if (!window.Peer) { toast('当前网络无法加载联机组件'); return; }
  const code = (el.mpCode.value || '').trim().toUpperCase();
  if (!code) { toast('请先输入房间码'); return; }
  mpIsHost = false;
  mpPeer = new window.Peer({ debug: 0, config: MP_ICE });
  mpPeer.on('open', () => {
    mpStatus('正在加入房间 ' + code + ' …');
    const conn = mpPeer.connect('zhiya-' + code, { reliable: true });
    mpBindConn(conn);
  });
  mpPeer.on('disconnected', () => { mpStatus('与联机服务断开，正在重连…'); try { mpPeer.reconnect(); } catch (err) {} });
  mpPeer.on('error', (err) => mpStatus('联机出错：' + (err.type || err.message || '')));
}

el.mpHost.addEventListener('click', mpCreate);
el.mpJoin.addEventListener('click', mpJoinRoom);
$$('#mpActions [data-mp]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const kind = btn.dataset.mp;
    if (!mpConn || !mpConn.open) { toast('先创建或加入一个房间'); return; }
    if (kind === 'hi') mpSend({ type: 'hi', text: `${state.name} 向你打招呼啦` });
    else if (kind === 'gift') mpSend({ type: 'gift', text: `${state.name} 送了你一份礼物` });
    else if (kind === 'emoji') mpSend({ type: 'emoji', text: pick(['✨', '💗', '🎉', '🌟']) });
    else if (kind === 'chat') {
      const text = window.prompt('发给好友：');
      if (text && text.trim()) mpSend({ type: 'chat', text: text.trim().slice(0, 60) });
    }
    parkLog('已发送', state.name);
  });
});

/* ---------------- 启动 ---------------- */
function bindSwitch(id, value) {
  const node = $(id);
  if (node) node.checked = Boolean(value);
}

function init() {
  document.body.dataset.theme = state.theme;
  document.body.dataset.eye = state.eye;
  applyAppearance();
  renderHeader();
  renderQuizStats();
  renderDaily();
  renderBars();
  renderDress();
  renderPark();
  renderQuestion();
  renderWrongBook();
  buildWave();
  setCallMode('idle');

  bindSwitch('#tgTop', state.topmost);
  bindSwitch('#tgThrough', state.clickThrough);
  bindSwitch('#tgChatter', state.chatter);
  bindSwitch('#tgSound', state.sound);

  el.nameInput.value = state.name;
  el.sizeRange.value = state.size;
  el.muteBtn.textContent = muted ? '🔇 已静音' : '🔊 声音开';
  el.subBtn.textContent = '💬 字幕开';

  // 预热中文语音列表
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }

  blinkLoop();
  setInterval(idleChatter, 11000);
  updateClock();
  setInterval(updateClock, 30000);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeDownload();
      el.levelup.classList.remove('show');
    }
  });

  const hour = new Date().getHours();
  let greeting = '今天也一起加油吧～';
  if (hour < 6) greeting = '这么晚还没睡呀…做完这题就休息，好吗？';
  else if (hour < 11) greeting = '早上好！先做一道题热热身？';
  else if (hour < 14) greeting = '中午好，先吃饭再做题。';
  else if (hour < 18) greeting = '下午好，今天想先做哪一题？';
  else greeting = '晚上好，今天也辛苦啦。';

  setTimeout(() => say(greeting, 6500), 900);
  setTimeout(() => el.stageTip.classList.add('fade'), 7000);

  // 首次交互解锁音频
  const unlock = () => {
    ensureAudio();
    window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true });

  // 双击空白处不再选中文字
  document.addEventListener('selectstart', (event) => {
    if (event.target.closest('.pet-zone')) event.preventDefault();
  });
}

init();
