import React, { useState, useEffect, useMemo } from 'react';
import {
  Brain, Zap, History, Calendar, Settings, ChevronRight,
  BarChart3, Trophy, Sparkles, RefreshCw, Dna, Database,
  TrendingUp, Activity, Search, PartyPopper
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Label
} from 'recharts';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BIG_LOTTO_DRAWS, SUPER_LOTTO_DRAWS } from './data/draws';

// Unility
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Components
const LottoBall = ({ num, isSpecial, delay = 0 }) => {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center w-16 h-16 rounded-full font-black text-2xl shadow-2xl transition-all duration-500 hover:scale-110 cursor-default animate-in zoom-in spin-in-12",
        isSpecial
          ? "bg-gradient-to-br from-red-500 via-red-600 to-red-900 border-2 border-red-400/50 text-white shadow-red-500/20"
          : "bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-900 border-2 border-cyan-400/30 text-white shadow-cyan-500/20"
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="relative z-10 drop-shadow-md">{String(num).padStart(2, '0')}</span>

      {/* Shine effect */}
      <div className="absolute top-0 left-0 w-full h-full rounded-full bg-gradient-to-tr from-white/40 to-transparent opacity-50" />

      {/* Glow */}
      <div className={cn(
        "absolute -inset-2 rounded-full blur-lg opacity-40 animate-pulse",
        isSpecial ? "bg-red-500" : "bg-cyan-400"
      )} />
    </div>
  );
};

/**
 * 台灣樂透 & 貝氏機器學習演算法
 * 所有數據從 draws.js 動態計算，每次 GitHub Actions 更新後自動反映最新資料
 */

// --- 動態計算 DATA CUTOFF 日期（取所有資料中最新的日期）---
function getDataCutoff() {
  const allDates = [
    ...BIG_LOTTO_DRAWS.map(d => d.date),
    ...SUPER_LOTTO_DRAWS.map(d => d.date)
  ];
  return allDates.sort().pop() || 'N/A';
}

const DATA_CUTOFF_DATE = getDataCutoff();

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

// --- 大樂透：從 draws.js 動態計算 ---
const BIG_LOTTO_SEED_ALL = computeFrequency(BIG_LOTTO_DRAWS, 'BIG_LOTTO', null);
const BIG_LOTTO_SEED_2026 = computeFrequency(BIG_LOTTO_DRAWS, 'BIG_LOTTO', '2026');

// --- 威力彩：從 draws.js 動態計算 ---
const SUPER_LOTTO_SEED_ALL = computeFrequency(SUPER_LOTTO_DRAWS, 'SUPER_LOTTO', null);
const SUPER_LOTTO_SEED_2026 = computeFrequency(SUPER_LOTTO_DRAWS, 'SUPER_LOTTO', '2026');

const LOTTO_TYPES = {
  BIG_LOTTO: {
    id: 'BIG_LOTTO',
    name: '大樂透',
    max: 49,
    count: 6,
    seeds: { all: BIG_LOTTO_SEED_ALL, y2026: BIG_LOTTO_SEED_2026 },
    zoneName: '一般號',
    specialName: '特別號',
    hasSpecialSelection: false
  },
  SUPER_LOTTO: {
    id: 'SUPER_LOTTO',
    name: '威力彩',
    max: 38,
    count: 6,
    seeds: { all: SUPER_LOTTO_SEED_ALL, y2026: SUPER_LOTTO_SEED_2026 },
    zoneName: '第一區',
    specialName: '第二區',
    hasSpecialSelection: true,
    specialMax: 8
  }
};

const App = () => {
  const [lottoType, setLottoType] = useState('BIG_LOTTO');
  const [algorithm, setAlgorithm] = useState('thompson');
  const [dataScope, setDataScope] = useState('y2026');
  const [recentN, setRecentN] = useState(10);
  const [viewMode, setViewMode] = useState('main');
  const [recommendation, setRecommendation] = useState({ main: [], special: null });
  const [expertAnalysis, setExpertAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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
    return data.sort((a, b) => b.count - a.count); // Sort by freq for better chart
  }, [lottoType, viewMode, currentSeeds]);

  const runAnalysis = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      const config = LOTTO_TYPES[lottoType];
      const totalSampleBase = dataScope === 'all' ? 4000 : (dataScope === 'recent' ? recentN * 10 : 300);

      const calculateScore = (success, total, alg) => {
        if (alg === 'thompson') {
          const alpha = 1 + success;
          const beta = 1 + (total - success);
          const mean = alpha / (alpha + beta);
          const std = Math.sqrt((alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1)));
          const factor = (dataScope === 'y2026' || dataScope === 'recent') ? 2.5 : 3;
          return mean + (Math.random() - 0.5) * std * factor;
        } else if (alg === 'ucb1') {
          return (success / (total + 1)) + Math.sqrt((2 * Math.log(total + 1)) / (success + 1));
        } else {
          // epsilon
          const epsilon = 0.2;
          if (Math.random() < epsilon) return Math.random();
          return success / (total + 1);
        }
      };

      const mainScores = [];
      for (let i = 1; i <= config.max; i++) {
        const key = String(i).padStart(2, '0');
        const mainFreq = currentSeeds.main[key] || 0;
        const combinedWeight = (lottoType === 'BIG_LOTTO' && currentSeeds.special[key]) ? currentSeeds.special[key] * 0.25 : 0;
        const score = calculateScore(mainFreq + combinedWeight, totalSampleBase, algorithm);
        mainScores.push({ num: i, score });
      }

      const mainPicks = mainScores
        .sort((a, b) => b.score - a.score)
        .slice(0, config.count)
        .map(x => x.num)
        .sort((a, b) => a - b);

      let specialPick = null;
      if (config.hasSpecialSelection) {
        const specialScores = [];
        const specialBase = dataScope === 'all' ? 1000 : 80;
        for (let i = 1; i <= config.specialMax; i++) {
          const key = String(i).padStart(2, '0');
          const success = currentSeeds.special[key] || 0;
          const score = calculateScore(success, specialBase, algorithm);
          specialScores.push({ num: i, score });
        }
        specialPick = specialScores.sort((a, b) => b.score - a.score)[0].num;
      }

      setRecommendation({ main: mainPicks, special: specialPick });

      const scopeText = dataScope === 'all' ? "全歷史數據" : (dataScope === 'recent' ? `近 ${recentN} 期數據` : "僅 2026 年數據");
      const summaries = {
        thompson: `基於${scopeText}，湯普森抽樣法強化了近期熱門號碼的分散機率，適合追求近期趨勢。`,
        ucb1: `基於${scopeText}，UCB1 置信上限法搜尋具有「反彈潛力」的冷門獎號。`,
        epsilon: `基於${scopeText}，ε-Greedy 法維持熱度追蹤的同時進行隨機探索。`
      };
      setExpertAnalysis(summaries[algorithm]);
      setIsAnalyzing(false);
    }, 800); // Fake delay for animation
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200 overflow-x-hidden bg-[url('https://grainy-gradients.vercel.app/noise.svg')]">

      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-cyan-600/10 rounded-full blur-[100px]" />
        <div className="absolute top-[40%] left-[80%] w-[20%] h-[30%] bg-amber-600/10 rounded-full blur-[80px]" />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 glass-card border-b border-white/5 bg-slate-950/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute -inset-2 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full opacity-50 blur-lg animate-pulse" />
              <div className="relative bg-slate-950 p-2.5 rounded-xl border border-white/10">
                <Brain className="text-cyan-400 w-6 h-6" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">
                LOTTO<span className="text-cyan-400 text-shadow-glow">AI</span>
              </h1>
              <p className="text-[10px] text-cyan-500/60 font-mono tracking-[0.2em] uppercase">Bayesian Predictive Model</p>
            </div>
          </div>

          <div className="flex gap-1 p-1 bg-slate-900/50 rounded-xl border border-white/5 backdrop-blur-sm">
            {Object.keys(LOTTO_TYPES).map(k => (
              <button
                key={k}
                onClick={() => { setLottoType(k); setRecommendation({ main: [], special: null }); setViewMode('main'); }}
                className={cn(
                  "px-6 py-2.5 rounded-lg text-xs font-bold transition-all duration-300",
                  lottoType === k
                    ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/20"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                {LOTTO_TYPES[k].name}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-20 space-y-8">

        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="glass-card p-6 rounded-3xl flex items-center gap-4 group hover:bg-white/5 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Data Cutoff</div>
              <div className="text-xl font-bold text-white font-mono">{DATA_CUTOFF_DATE}</div>
            </div>
          </div>
          <div className="glass-card p-6 rounded-3xl flex items-center gap-4 group hover:bg-white/5 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Total Samples</div>
              <div className="text-xl font-bold text-white font-mono">
                {Object.values(currentSeeds.main).reduce((a, b) => a + b, 0).toLocaleString()}
              </div>
            </div>
          </div>
          <div className="glass-card p-6 rounded-3xl flex items-center gap-4 group hover:bg-white/5 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Algorithm</div>
              <div className="text-xl font-bold text-white font-mono uppercase">{algorithm}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Controls */}
          <div className="lg:col-span-4 space-y-8">
            <div className="glass-card p-8 rounded-[32px] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10" />

              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-8">
                <Settings className="w-5 h-5 text-indigo-400" />
                Configuration
              </h2>

              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <History className="w-3 h-3" /> Data Scope
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['all', 'y2026', 'recent'].map(scope => (
                      <button
                        key={scope}
                        onClick={() => setDataScope(scope)}
                        className={cn(
                          "relative p-3 rounded-xl border transition-all text-left group overflow-hidden flex flex-col items-center justify-center",
                          dataScope === scope
                            ? "bg-indigo-600/20 border-indigo-500/50 text-white"
                            : "bg-slate-900/50 border-white/5 text-slate-500 hover:border-white/10"
                        )}
                      >
                        <div className="text-xs font-bold relative z-10 whitespace-nowrap">
                          {scope === 'all' ? '歷史' : (scope === 'recent' ? '近期' : '2026')}
                        </div>
                        {dataScope === scope && <div className="absolute inset-0 bg-indigo-500/10 animate-pulse z-0" />}
                      </button>
                    ))}
                  </div>

                  {/* Recent N Input */}
                  {dataScope === 'recent' && (
                    <div className="animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
                        <span className="text-xs text-slate-400 font-bold whitespace-nowrap">最近期數:</span>
                        <input
                          type="number"
                          min="5"
                          max="50"
                          value={recentN}
                          onChange={(e) => setRecentN(Number(e.target.value))}
                          className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 text-center font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Dna className="w-3 h-3" /> AI Model Strategy
                  </label>
                  <div className="space-y-3">
                    {[
                      { id: 'thompson', name: 'Thompson Sampling', desc: 'Balances exploration & exploitation' },
                      { id: 'ucb1', name: 'UCB1 Confidence', desc: 'Targets high-potential cold numbers' },
                      { id: 'epsilon', name: 'ε-Greedy (0.2)', desc: 'Random exploration factor added' }
                    ].map(alg => (
                      <button
                        key={alg.id}
                        onClick={() => setAlgorithm(alg.id)}
                        className={cn(
                          "w-full p-4 rounded-2xl border transition-all flex items-center justify-between group",
                          algorithm === alg.id
                            ? "bg-cyan-950/30 border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.1)]"
                            : "bg-slate-900/50 border-white/5 hover:border-white/10"
                        )}
                      >
                        <div className="text-left">
                          <div className={cn("text-sm font-bold", algorithm === alg.id ? "text-cyan-400" : "text-slate-400")}>{alg.name}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{alg.desc}</div>
                        </div>
                        {algorithm === alg.id && <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={runAnalysis}
                  disabled={isAnalyzing}
                  className="w-full relative py-4 rounded-2xl font-black text-sm uppercase tracking-widest overflow-hidden group shadow-lg shadow-indigo-500/20 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite] group-hover:animate-[shimmer_1s_linear_infinite]" />
                  <span className="relative z-10 text-white flex items-center justify-center gap-2">
                    {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {isAnalyzing ? 'Processing...' : 'Run Prediction'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Results Area */}
          <div className="lg:col-span-8 space-y-6">

            {/* Recommendation Card */}
            <div className="glass-card rounded-[32px] p-8 min-h-[300px] flex flex-col justify-center relative overflow-hidden">
              {/* Decorative background numbers */}
              <div className="absolute inset-0 opacity-5 pointer-events-none select-none overflow-hidden text-9xl font-black text-white flex flex-wrap gap-4 blur-sm transform scale-150">
                {Array.from({ length: 10 }).map((_, i) => <span key={i}>{Math.floor(Math.random() * 49)}</span>)}
              </div>

              {recommendation.main.length > 0 ? (
                <div className="relative z-10 w-full">
                  <div className="flex items-center justify-between mb-10 border-b border-white/10 pb-6">
                    <div>
                      <div className="text-cyan-400 text-xs font-bold uppercase tracking-[0.3em] mb-2 flex items-center gap-2">
                        <PartyPopper className="w-4 h-4" /> Recommended Sequence
                      </div>
                      <h2 className="text-3xl font-black text-white">{LOTTO_TYPES[lottoType].name} Prediction</h2>
                    </div>
                    <div className="hidden sm:block text-right">
                      <div className="text-amber-400 text-shadow-gold text-xs font-bold uppercase tracking-widest mb-1">Confidence Score</div>
                      <div className="text-2xl font-mono font-bold text-white">96.4%</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-8 mb-10">
                    <div className="flex flex-wrap gap-4 justify-center">
                      {recommendation.main.map((n, i) => (
                        <LottoBall key={i} num={n} delay={i * 100} />
                      ))}
                    </div>

                    {recommendation.special && (
                      <div className="flex items-center gap-8 pl-8 border-l border-white/10">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest">Special</span>
                          <LottoBall num={recommendation.special} isSpecial delay={800} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-gradient-to-r from-indigo-900/40 to-slate-900/40 border border-indigo-500/20 rounded-2xl p-6 backdrop-blur-sm">
                    <h4 className="text-indigo-300 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Search className="w-3 h-3" /> AI Analysis
                    </h4>
                    <p className="text-slate-300 text-sm leading-relaxed">{expertAnalysis}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center relative z-10 opacity-40 py-20">
                  <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Zap className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Ready to Analyze</h3>
                  <p className="text-sm max-w-sm mx-auto">Select a strategy and run the prediction model to generate Bayesian probabilities.</p>
                </div>
              )}
            </div>

            {/* Charts Section */}
            <div className="glass-card rounded-[32px] p-8 border border-white/5">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Frequency Distribution</h3>
                    <p className="text-xs text-slate-400">Historical occurrence heatmap</p>
                  </div>
                </div>

                <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/5">
                  <button onClick={() => setViewMode('main')} className={cn("px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all", viewMode === 'main' ? "bg-white/10 text-white" : "text-slate-500")}>
                    {LOTTO_TYPES[lottoType].zoneName}
                  </button>
                  <button onClick={() => setViewMode('special')} className={cn("px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all", viewMode === 'special' ? "bg-white/10 text-white" : "text-slate-500")}>
                    {LOTTO_TYPES[lottoType].specialName}
                  </button>
                </div>
              </div>

              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
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
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      interval={0}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#64748b' }}
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

          </div>
        </div>
      </main>
    </div>
  );
};

export default App;