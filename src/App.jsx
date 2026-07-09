import React, { useState, useMemo } from 'react';
import {
  Brain, History, Calendar, Settings2, BarChart3, Sparkles, RefreshCw,
  Dna, Database, Activity, Search, PartyPopper, Zap, Minus, Plus, Info, ChevronRight,
  AlertTriangle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BIG_LOTTO_DRAWS, SUPER_LOTTO_DRAWS } from './data/draws';

// 工具：合併 Tailwind class
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// ===== 統計抽樣工具（真實貝氏抽樣核心）=====

// 標準常態亂數（Box-Muller 轉換）
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Gamma 分佈抽樣（Marsaglia-Tsang 法；shape < 1 時用 Weibull 轉換保護）
function sampleGamma(shape) {
  if (shape < 1) {
    return sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  // 反覆抽樣直到接受（期望迭代次數 < 1.1 次）
  for (;;) {
    let x, v;
    do {
      x = randn();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

// Beta 分佈抽樣：真正湯普森抽樣的核心（由兩個 Gamma 樣本合成）
function sampleBeta(alpha, beta) {
  const x = sampleGamma(alpha);
  const y = sampleGamma(beta);
  return x / (x + y);
}

/**
 * 台灣樂透 & 貝氏機器學習演算法
 * 所有數據從 draws.js 動態計算，每次 GitHub Actions 更新後自動反映最新資料
 */

// 動態年份：避免跨年後「今年」範圍過期
const CURRENT_YEAR = String(new Date().getFullYear());

// --- 動態計算 DATA CUTOFF 日期（取所有資料中最新的日期）---
function getDataCutoff() {
  const allDates = [
    ...BIG_LOTTO_DRAWS.map(d => d.date),
    ...SUPER_LOTTO_DRAWS.map(d => d.date)
  ];
  return allDates.sort().pop() || 'N/A';
}

const DATA_CUTOFF_DATE = getDataCutoff();

// 資料時效檢查：大樂透（二、五）與威力彩（一、四）開獎最長間隔約 3 天，
// 超過 4 天沒有新資料代表自動更新異常、或本機忘了 git pull
const DATA_AGE_DAYS = (() => {
  const cutoff = new Date(DATA_CUTOFF_DATE.replace(/\//g, '-'));
  if (isNaN(cutoff.getTime())) return 0; // 日期解析失敗時不誤報
  return Math.floor((Date.now() - cutoff.getTime()) / 86400000);
})();
const IS_DATA_STALE = DATA_AGE_DAYS > 4;

// --- 動態計算頻率種子數據 ---
function computeFrequency(draws, type, yearFilter) {
  const filtered = yearFilter
    ? draws.filter(d => d.date.startsWith(yearFilter))
    : draws;

  const mainCounts = {};
  const specialCounts = {};

  filtered.forEach(draw => {
    if (type === 'BIG_LOTTO') {
      draw.main.forEach(n => {
        const key = String(n).padStart(2, '0');
        mainCounts[key] = (mainCounts[key] || 0) + 1;
      });
      if (draw.special != null) {
        const key = String(draw.special).padStart(2, '0');
        specialCounts[key] = (specialCounts[key] || 0) + 1;
      }
    } else {
      draw.zone1.forEach(n => {
        const key = String(n).padStart(2, '0');
        mainCounts[key] = (mainCounts[key] || 0) + 1;
      });
      if (draw.zone2 != null) {
        const key = String(draw.zone2).padStart(2, '0');
        specialCounts[key] = (specialCounts[key] || 0) + 1;
      }
    }
  });

  return type === 'BIG_LOTTO'
    ? { main: mainCounts, special: specialCounts }
    : { zone1: mainCounts, zone2: specialCounts };
}

// --- 大樂透 / 威力彩：從 draws.js 動態計算 ---
const BIG_LOTTO_SEED_ALL = computeFrequency(BIG_LOTTO_DRAWS, 'BIG_LOTTO', null);
const BIG_LOTTO_SEED_YEAR = computeFrequency(BIG_LOTTO_DRAWS, 'BIG_LOTTO', CURRENT_YEAR);
const SUPER_LOTTO_SEED_ALL = computeFrequency(SUPER_LOTTO_DRAWS, 'SUPER_LOTTO', null);
const SUPER_LOTTO_SEED_YEAR = computeFrequency(SUPER_LOTTO_DRAWS, 'SUPER_LOTTO', CURRENT_YEAR);

const LOTTO_TYPES = {
  BIG_LOTTO: {
    id: 'BIG_LOTTO',
    name: '大樂透',
    max: 49,
    count: 6,
    seeds: { all: BIG_LOTTO_SEED_ALL, year: BIG_LOTTO_SEED_YEAR },
    zoneName: '一般號',
    specialName: '特別號',
    hasSpecialSelection: false
  },
  SUPER_LOTTO: {
    id: 'SUPER_LOTTO',
    name: '威力彩',
    max: 38,
    count: 6,
    seeds: { all: SUPER_LOTTO_SEED_ALL, year: SUPER_LOTTO_SEED_YEAR },
    zoneName: '第一區',
    specialName: '第二區',
    hasSpecialSelection: true,
    specialMax: 8
  }
};

// AI 策略清單（描述誠實反映實際行為）
const ALGORITHMS = [
  { id: 'thompson', name: 'Thompson Sampling', short: 'Thompson', desc: '貝氏後驗抽樣・熱門號機率較高' },
  { id: 'ucb1', name: 'Cold Rebound 冷號回補', short: '冷號回補', desc: '反向貝氏抽樣・冷門號優先' },
  { id: 'epsilon', name: 'ε-Greedy (0.2)', short: 'ε-Greedy', desc: '80% 追熱門・20% 隨機探索' }
];

// 底部導航分頁
const TABS = [
  { id: 'predict', name: '預測', icon: Sparkles },
  { id: 'stats', name: '統計', icon: BarChart3 },
  { id: 'settings', name: '設定', icon: Settings2 }
];

// 開獎球元件（手機尺寸 + 彈跳進場動畫）
const LottoBall = ({ num, isSpecial, delay = 0 }) => {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-full font-black shadow-2xl",
        isSpecial ? "w-12 h-12 text-lg" : "w-10 h-10 text-base",
        isSpecial
          ? "bg-gradient-to-br from-red-500 via-red-600 to-red-900 border-2 border-red-400/50 text-white shadow-red-500/20"
          : "bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-900 border-2 border-cyan-400/30 text-white shadow-cyan-500/20"
      )}
      style={{ animation: `ball-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms backwards` }}
    >
      <span className="relative z-10 drop-shadow-md">{String(num).padStart(2, '0')}</span>

      {/* 高光 */}
      <div className="absolute top-0 left-0 w-full h-full rounded-full bg-gradient-to-tr from-white/40 to-transparent opacity-50" />

      {/* 光暈 */}
      <div className={cn(
        "absolute -inset-1.5 rounded-full blur-md opacity-40 animate-pulse",
        isSpecial ? "bg-red-500" : "bg-cyan-400"
      )} />
    </div>
  );
};

// 統計頁資訊小卡
const StatCard = ({ icon: Icon, label, value, tint }) => (
  <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
    <div className={cn("w-10 h-10 shrink-0 rounded-xl flex items-center justify-center", tint)}>
      <Icon className="w-5 h-5" />
    </div>
    <div className="min-w-0">
      <div className="text-slate-400 text-[10px] font-medium uppercase tracking-wider mb-0.5 truncate">{label}</div>
      <div className="text-xs font-bold text-white font-mono truncate">{value}</div>
    </div>
  </div>
);

const App = () => {
  const [activeTab, setActiveTab] = useState('predict');
  const [lottoType, setLottoType] = useState('BIG_LOTTO');
  const [algorithm, setAlgorithm] = useState('thompson');
  const [dataScope, setDataScope] = useState('year');
  const [recentN, setRecentN] = useState(10);
  const [viewMode, setViewMode] = useState('main');
  const [recommendation, setRecommendation] = useState({ main: [], special: null });
  const [expertAnalysis, setExpertAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisN, setAnalysisN] = useState(0); // 本次分析實際使用的期數

  // 目前資料範圍的「實際期數」— 貝氏後驗的試驗次數必須用真實樣本數，
  // 不能用硬編碼的假數字，否則後驗分佈的不確定性會被嚴重低估
  const scopeDrawCount = useMemo(() => {
    const rawDraws = lottoType === 'BIG_LOTTO' ? BIG_LOTTO_DRAWS : SUPER_LOTTO_DRAWS;
    if (dataScope === 'all') return rawDraws.length;
    if (dataScope === 'year') return rawDraws.filter(d => d.date.startsWith(CURRENT_YEAR)).length;
    return Math.min(recentN, rawDraws.length);
  }, [lottoType, dataScope, recentN]);

  const currentSeeds = useMemo(() => {
    const config = LOTTO_TYPES[lottoType];

    if (dataScope === 'recent') {
      const rawDraws = lottoType === 'BIG_LOTTO' ? BIG_LOTTO_DRAWS : SUPER_LOTTO_DRAWS;
      const selectedDraws = rawDraws.slice(0, recentN);

      const mainCounts = {};
      const specialCounts = {};

      const maxMain = config.max;
      const maxSpecial = config.specialMax || (lottoType === 'SUPER_LOTTO' ? 8 : 49);

      for (let i = 1; i <= maxMain; i++) mainCounts[String(i).padStart(2, '0')] = 0;
      for (let i = 1; i <= maxSpecial; i++) specialCounts[String(i).padStart(2, '0')] = 0;

      selectedDraws.forEach(draw => {
        if (lottoType === 'BIG_LOTTO') {
          draw.main.forEach(n => mainCounts[String(n).padStart(2, '0')] = (mainCounts[String(n).padStart(2, '0')] || 0) + 1);
          if (draw.special) specialCounts[String(draw.special).padStart(2, '0')] = (specialCounts[String(draw.special).padStart(2, '0')] || 0) + 1;
        } else {
          draw.zone1.forEach(n => mainCounts[String(n).padStart(2, '0')] = (mainCounts[String(n).padStart(2, '0')] || 0) + 1);
          if (draw.zone2) specialCounts[String(draw.zone2).padStart(2, '0')] = (specialCounts[String(draw.zone2).padStart(2, '0')] || 0) + 1;
        }
      });

      return { main: mainCounts, special: specialCounts };
    }

    const raw = config.seeds[dataScope];
    return lottoType === 'BIG_LOTTO'
      ? { main: raw.main, special: raw.special }
      : { main: raw.zone1, special: raw.zone2 };
  }, [lottoType, dataScope, recentN]);

  const chartData = useMemo(() => {
    const config = LOTTO_TYPES[lottoType];
    const dataSource = viewMode === 'main' ? currentSeeds.main : currentSeeds.special;
    const maxNum = viewMode === 'main' ? config.max : (lottoType === 'SUPER_LOTTO' ? 8 : 49);

    const data = [];
    for (let i = 1; i <= maxNum; i++) {
      const key = String(i).padStart(2, '0');
      data.push({
        num: i,
        count: dataSource[key] || 0,
        displayName: key
      });
    }
    return data.sort((a, b) => b.count - a.count); // 依頻率排序，圖表較易讀
  }, [lottoType, viewMode, currentSeeds]);

  const runAnalysis = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      const config = LOTTO_TYPES[lottoType];
      const N = scopeDrawCount; // 實際期數（貝氏後驗的真實試驗次數）

      // 依演算法計算單一號碼分數
      // 貝氏 Bernoulli 模型：號碼在 N 期中開出 success 次 → 後驗為 Beta(1+success, 1+N-success)
      const scoreNumber = (success, trials, alg) => {
        const alpha = 1 + success;
        const beta = 1 + Math.max(0, trials - success);
        if (alg === 'thompson') {
          // 真正的湯普森抽樣：直接從 Beta 後驗分佈抽一個樣本
          // （每次點擊都是獨立抽樣，熱門號機率較高但保有正確的不確定性）
          return sampleBeta(alpha, beta);
        } else if (alg === 'ucb1') {
          // 冷號回補：反向湯普森抽樣 —— 抽樣「未開出率」的後驗分佈，
          // 越少開出的號碼分數期望越高，同樣保有隨機性
          return sampleBeta(beta, alpha);
        }
        // ε-greedy：這裡回傳純頻率（貪婪值），探索行為在挑號階段處理
        return alpha / (alpha + beta);
      };

      // 對 1..maxNum 全部號碼評分並由高至低排序
      const scoreAll = (freqMap, maxNum, trials) => {
        const arr = [];
        for (let i = 1; i <= maxNum; i++) {
          const key = String(i).padStart(2, '0');
          arr.push({ num: i, score: scoreNumber(freqMap[key] || 0, trials, algorithm) });
        }
        return arr.sort((a, b) => b.score - a.score);
      };

      // 挑出前 k 名；ε-greedy 採正統作法：每個名額有 ε 機率改為隨機探索
      const pickTopK = (ranked, k, maxNum) => {
        if (algorithm !== 'epsilon') return ranked.slice(0, k).map(x => x.num);
        const EPSILON = 0.2;
        const picked = new Set();
        const queue = ranked.map(x => x.num);
        while (picked.size < k) {
          if (Math.random() < EPSILON) {
            // 探索：隨機挑一個尚未選過的號碼
            let n;
            do { n = 1 + Math.floor(Math.random() * maxNum); } while (picked.has(n));
            picked.add(n);
          } else {
            // 利用：取頻率最高且尚未選過的號碼
            picked.add(queue.find(x => !picked.has(x)));
          }
        }
        return [...picked];
      };

      // 一般號評分：大樂透的特別號與一般號同池開出（第七顆球），
      // 故該號碼的實際出現次數 = 一般號次數 + 特別號次數
      const mainFreq = {};
      for (let i = 1; i <= config.max; i++) {
        const key = String(i).padStart(2, '0');
        mainFreq[key] = (currentSeeds.main[key] || 0) +
          (lottoType === 'BIG_LOTTO' ? (currentSeeds.special[key] || 0) : 0);
      }

      const mainRanked = scoreAll(mainFreq, config.max, N);
      const mainPicks = pickTopK(mainRanked, config.count, config.max).sort((a, b) => a - b);

      // 威力彩第二區：每期只開 1 個號碼（1~8），試驗次數同為 N
      let specialPick = null;
      if (config.hasSpecialSelection) {
        const spRanked = scoreAll(currentSeeds.special, config.specialMax, N);
        specialPick = pickTopK(spRanked, 1, config.specialMax)[0];
      }

      setRecommendation({ main: mainPicks, special: specialPick });
      setAnalysisN(N);

      const scopeText = dataScope === 'all' ? "全歷史數據" : (dataScope === 'recent' ? `近 ${recentN} 期數據` : `${CURRENT_YEAR} 年數據`);
      const summaries = {
        thompson: `基於${scopeText}（實際 ${N} 期），以 Beta 後驗分佈進行湯普森抽樣：頻率較高的號碼中選機率較高，且每次抽樣皆具隨機性。提醒：每期開獎相互獨立，歷史頻率不影響未來機率，本結果僅供娛樂參考。`,
        ucb1: `基於${scopeText}（實際 ${N} 期），以反向貝氏抽樣優先挑選近期較少開出的冷門號碼。提醒：「冷號回補」在統計上並無依據（賭徒謬誤），本結果僅供娛樂參考。`,
        epsilon: `基於${scopeText}（實際 ${N} 期），每個名額 80% 依歷史頻率取熱門號、20% 隨機探索。提醒：任何選號策略的實際中獎機率皆相同，本結果僅供娛樂參考。`
      };
      setExpertAnalysis(summaries[algorithm]);
      setIsAnalyzing(false);
    }, 800); // 模擬運算的過場動畫延遲
  };

  const config = LOTTO_TYPES[lottoType];
  const currentAlg = ALGORITHMS.find(a => a.id === algorithm);
  const scopeLabel = dataScope === 'all' ? '全歷史' : (dataScope === 'recent' ? `近${recentN}期` : `${CURRENT_YEAR}年`);

  return (
    <div className="h-dvh w-full bg-slate-950 text-slate-100 selection:bg-indigo-500/30 flex justify-center overflow-hidden">

      {/* 背景光暈 */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[-20%] w-[70%] h-[45%] bg-indigo-600/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-15%] w-[60%] h-[40%] bg-cyan-600/10 rounded-full blur-[90px]" />
        <div className="absolute top-[45%] left-[70%] w-[35%] h-[25%] bg-amber-600/10 rounded-full blur-[70px]" />
      </div>

      {/* 手機 App 外殼（桌面瀏覽時置中顯示為手機寬度）*/}
      <div className="relative z-10 w-full max-w-md h-full flex flex-col sm:border-x sm:border-white/5">

        {/* 內容捲動區 */}
        <main className="flex-1 overflow-y-auto momentum-scroll hide-scrollbar safe-top">

          {/* ============ 預測分頁 ============ */}
          {activeTab === 'predict' && (
            <div key="predict" className="tab-enter px-5 pb-8 space-y-5">

              {/* 品牌列 */}
              <header className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute -inset-1.5 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-2xl opacity-40 blur-md animate-pulse" />
                    <div className="relative bg-slate-950 p-2 rounded-xl border border-white/10">
                      <Brain className="text-cyan-400 w-5 h-5" />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">
                      LOTTO<span className="text-cyan-400 text-shadow-glow">AI</span>
                    </h1>
                    <p className="text-[9px] text-cyan-500/60 font-mono tracking-[0.2em] uppercase">Bayesian Model</p>
                  </div>
                </div>
                <div className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full border",
                  IS_DATA_STALE
                    ? "bg-amber-950/40 border-amber-500/40"
                    : "bg-slate-900/70 border-white/10"
                )}>
                  <Calendar className={cn("w-3 h-3", IS_DATA_STALE ? "text-amber-400" : "text-indigo-400")} />
                  <span className={cn("text-[10px] font-mono", IS_DATA_STALE ? "text-amber-300" : "text-slate-300")}>{DATA_CUTOFF_DATE}</span>
                </div>
              </header>

              {/* 資料過期警告：無論本機忘了同步、或雲端自動更新故障都會在此顯示 */}
              {IS_DATA_STALE && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    開獎資料已 <span className="font-bold">{DATA_AGE_DAYS} 天</span>未更新（截止 {DATA_CUTOFF_DATE}）。
                    本機版請執行「開始預測.bat」自動同步；若線上版看到此訊息，請檢查 GitHub Actions 執行狀態。
                  </p>
                </div>
              )}

              {/* 遊戲切換（iOS Segmented Control 風格）*/}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900/70 rounded-2xl border border-white/5">
                {Object.keys(LOTTO_TYPES).map(k => (
                  <button
                    key={k}
                    onClick={() => { setLottoType(k); setRecommendation({ main: [], special: null }); setViewMode('main'); }}
                    className={cn(
                      "py-3 rounded-xl text-sm font-bold transition-all duration-300",
                      lottoType === k
                        ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/25"
                        : "text-slate-400 active:bg-white/5"
                    )}
                  >
                    {LOTTO_TYPES[k].name}
                  </button>
                ))}
              </div>

              {/* 目前策略摘要（點擊前往設定）*/}
              <button
                onClick={() => setActiveTab('settings')}
                className="w-full glass-card rounded-2xl p-4 flex items-center justify-between active:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <Dna className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-white">{currentAlg.name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{scopeLabel}・{scopeDrawCount} 期樣本</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>

              {/* 執行預測按鈕 */}
              <button
                onClick={runAnalysis}
                disabled={isAnalyzing}
                className="w-full relative h-14 rounded-2xl font-black text-sm uppercase tracking-widest overflow-hidden shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-transform disabled:opacity-70"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite]" />
                <span className="relative z-10 text-white flex items-center justify-center gap-2">
                  {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {isAnalyzing ? '運算中...' : '開始預測'}
                </span>
              </button>

              {/* 結果卡片 */}
              <div className="glass-card rounded-[28px] p-6 min-h-[300px] flex flex-col justify-center relative overflow-hidden">
                {recommendation.main.length > 0 ? (
                  <div className="relative z-10 w-full">
                    <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                      <div>
                        <div className="text-cyan-400 text-[10px] font-bold uppercase tracking-[0.25em] mb-1.5 flex items-center gap-1.5">
                          <PartyPopper className="w-3.5 h-3.5" /> Recommended
                        </div>
                        <h2 className="text-xl font-black text-white">{config.name} 推薦組合</h2>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-amber-400 text-shadow-gold text-[9px] font-bold uppercase tracking-widest mb-0.5">Sample</div>
                        <div className="text-lg font-mono font-bold text-white">{analysisN} 期</div>
                      </div>
                    </div>

                    {/* 一般號 */}
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">{config.zoneName}</div>
                    <div className="flex flex-wrap justify-center gap-1.5 mb-5">
                      {recommendation.main.map((n, i) => (
                        <LottoBall key={`${n}-${i}`} num={n} delay={i * 100} />
                      ))}
                    </div>

                    {/* 特別號 / 第二區 */}
                    {recommendation.special && (
                      <div className="flex flex-col items-center gap-1.5 mb-5 pt-4 border-t border-white/5">
                        <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest">{config.specialName}</span>
                        <LottoBall num={recommendation.special} isSpecial delay={700} />
                      </div>
                    )}

                    {/* AI 分析說明 */}
                    <div className="bg-gradient-to-r from-indigo-900/40 to-slate-900/40 border border-indigo-500/20 rounded-2xl p-4 backdrop-blur-sm">
                      <h4 className="text-indigo-300 text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        <Search className="w-3 h-3" /> AI Analysis
                      </h4>
                      <p className="text-slate-300 text-xs leading-relaxed">{expertAnalysis}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center relative z-10 opacity-40 py-10">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-5">
                      <Zap className="w-9 h-9" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1.5">準備就緒</h3>
                    <p className="text-xs max-w-[240px] mx-auto leading-relaxed">選擇遊戲與策略後，點擊「開始預測」產生貝氏機率推薦組合。</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============ 統計分頁 ============ */}
          {activeTab === 'stats' && (
            <div key="stats" className="tab-enter px-5 pb-8 space-y-5">
              <h2 className="text-3xl font-black pt-4 tracking-tight">統計</h2>

              {/* 資訊卡 2x2 */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={Calendar} label="Data Cutoff" value={DATA_CUTOFF_DATE} tint="bg-indigo-500/10 text-indigo-400" />
                <StatCard icon={Database} label="樣本期數" value={`${scopeDrawCount} 期`} tint="bg-amber-500/10 text-amber-400" />
                <StatCard icon={Activity} label="演算法" value={currentAlg.short} tint="bg-cyan-500/10 text-cyan-400" />
                <StatCard icon={History} label="資料範圍" value={scopeLabel} tint="bg-emerald-500/10 text-emerald-400" />
              </div>

              {/* 頻率分佈圖 */}
              <div className="glass-card rounded-[28px] p-5">
                <div className="flex items-center justify-between mb-5 gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400 shrink-0">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-white text-sm truncate">頻率分佈</h3>
                      <p className="text-[10px] text-slate-400 truncate">{config.name}・歷史出現次數</p>
                    </div>
                  </div>

                  <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/5 shrink-0">
                    <button onClick={() => setViewMode('main')} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all", viewMode === 'main' ? "bg-white/10 text-white" : "text-slate-500")}>
                      {config.zoneName}
                    </button>
                    <button onClick={() => setViewMode('special')} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all", viewMode === 'special' ? "bg-white/10 text-white" : "text-slate-500")}>
                      {config.specialName}
                    </button>
                  </div>
                </div>

                {/* 號碼多時可左右滑動查看 */}
                <div className="h-[260px] w-full overflow-x-auto momentum-scroll hide-scrollbar">
                  <div className="h-full" style={{ width: '100%', minWidth: `${chartData.length * 13}px` }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 0, left: -24, bottom: 0 }}>
                        <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#818cf8" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#818cf8" stopOpacity={0.1} />
                          </linearGradient>
                          <linearGradient id="barGradientHighlight" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22d3ee" stopOpacity={1} />
                            <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.2} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff08" />
                        <XAxis
                          dataKey="displayName"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 9, fill: '#64748b' }}
                          interval={0}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 9, fill: '#64748b' }}
                          width={30}
                        />
                        <Tooltip
                          cursor={{ fill: '#ffffff05' }}
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#1e293b',
                            borderRadius: '12px',
                            color: '#f8fafc',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                          }}
                          itemStyle={{ color: '#38bdf8' }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={recommendation.main.includes(entry.num) || recommendation.special === entry.num
                                ? "url(#barGradientHighlight)"
                                : "url(#barGradient)"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <p className="text-[10px] text-slate-600 text-center mt-2">← 左右滑動查看全部號碼 →</p>
              </div>
            </div>
          )}

          {/* ============ 設定分頁 ============ */}
          {activeTab === 'settings' && (
            <div key="settings" className="tab-enter px-5 pb-8 space-y-6">
              <h2 className="text-3xl font-black pt-4 tracking-tight">設定</h2>

              {/* 資料範圍 */}
              <section className="space-y-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <History className="w-3 h-3" /> 資料範圍
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'all', label: '全歷史' },
                    { id: 'year', label: `${CURRENT_YEAR}年` },
                    { id: 'recent', label: '近期' }
                  ].map(scope => (
                    <button
                      key={scope.id}
                      onClick={() => setDataScope(scope.id)}
                      className={cn(
                        "relative py-3.5 rounded-xl border transition-all flex items-center justify-center overflow-hidden",
                        dataScope === scope.id
                          ? "bg-indigo-600/20 border-indigo-500/50 text-white"
                          : "bg-slate-900/50 border-white/5 text-slate-500 active:border-white/10"
                      )}
                    >
                      <span className="text-xs font-bold relative z-10 whitespace-nowrap">{scope.label}</span>
                      {dataScope === scope.id && <div className="absolute inset-0 bg-indigo-500/10 animate-pulse z-0" />}
                    </button>
                  ))}
                </div>

                {/* 近期期數：+/- 步進器（觸控友善）*/}
                {dataScope === 'recent' && (
                  <div className="tab-enter flex items-center justify-between glass-card rounded-2xl p-3">
                    <span className="text-xs text-slate-400 font-bold pl-2">最近期數</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setRecentN(n => Math.max(5, n - 5))}
                        className="w-11 h-11 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-center text-slate-300 active:bg-white/10 transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-10 text-center font-mono font-bold text-lg text-white">{recentN}</span>
                      <button
                        onClick={() => setRecentN(n => Math.min(50, n + 5))}
                        className="w-11 h-11 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-center text-slate-300 active:bg-white/10 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* AI 策略 */}
              <section className="space-y-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Dna className="w-3 h-3" /> AI 模型策略
                </label>
                <div className="space-y-2.5">
                  {ALGORITHMS.map(alg => (
                    <button
                      key={alg.id}
                      onClick={() => setAlgorithm(alg.id)}
                      className={cn(
                        "w-full p-4 rounded-2xl border transition-all flex items-center justify-between",
                        algorithm === alg.id
                          ? "bg-cyan-950/30 border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.1)]"
                          : "bg-slate-900/50 border-white/5 active:border-white/10"
                      )}
                    >
                      <div className="text-left">
                        <div className={cn("text-sm font-bold", algorithm === alg.id ? "text-cyan-400" : "text-slate-400")}>{alg.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{alg.desc}</div>
                      </div>
                      {algorithm === alg.id && <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] shrink-0" />}
                    </button>
                  ))}
                </div>
              </section>

              {/* 免責聲明 */}
              <div className="glass-card rounded-2xl p-4 flex gap-3">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  每期開獎皆為獨立隨機事件，歷史頻率不影響未來開獎機率。本工具僅供統計娛樂參考，請理性購彩。
                </p>
              </div>
            </div>
          )}
        </main>

        {/* ============ 底部導航列（iOS Tab Bar）============ */}
        <nav className="shrink-0 bg-slate-950/85 backdrop-blur-2xl border-t border-white/10">
          <div className="flex safe-bottom">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex-1 flex flex-col items-center gap-1 pt-3 pb-2 transition-colors"
                >
                  <Icon className={cn(
                    "w-6 h-6 transition-all duration-300",
                    isActive ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)] scale-110" : "text-slate-500"
                  )} />
                  <span className={cn(
                    "text-[10px] font-bold transition-colors",
                    isActive ? "text-cyan-400" : "text-slate-500"
                  )}>{tab.name}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default App;
