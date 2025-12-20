import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Eye, Skull, Shield, Siren, AlertTriangle, 
  Terminal, Play, RotateCcw, MapPin, Activity, 
  Search, XCircle, Zap, LogOut, ChevronDown, ChevronUp, FileText,
  MessageSquareQuote, Check, X
} from 'lucide-react';

// ==========================================
// 1. 常量与配置
// ==========================================

const LOCATIONS = [
  { id: 1, name: "食堂 (Cafeteria)", x: 50, y: 10, color: "text-blue-400" },
  { id: 2, name: "医疗室 (MedBay)", x: 30, y: 30, color: "text-green-400" },
  { id: 3, name: "配电房 (Electrical)", x: 30, y: 60, color: "text-yellow-400" },
  { id: 4, name: "监控室 (Security)", x: 20, y: 45, color: "text-red-400" },
  { id: 5, name: "反应堆 (Reactor)", x: 10, y: 50, color: "text-cyan-400" },
  { id: 6, name: "导航室 (Navigation)", x: 90, y: 45, color: "text-purple-400" },
  { id: 7, name: "武器室 (Weapons)", x: 80, y: 20, color: "text-orange-400" },
  { id: 8, name: "护盾 (Shields)", x: 80, y: 70, color: "text-indigo-400" },
  { id: 9, name: "管理室 (Admin)", x: 60, y: 50, color: "text-pink-400" },
];

const COLORS = [
  { name: "Red", hex: "#C51111", bg: "bg-red-600" },
  { name: "Blue", hex: "#132ED1", bg: "bg-blue-600" },
  { name: "Green", hex: "#117F2D", bg: "bg-green-600" },
  { name: "Pink", hex: "#ED54BA", bg: "bg-pink-500" },
  { name: "Orange", hex: "#EF7D0D", bg: "bg-orange-500" },
  { name: "Yellow", hex: "#F5F557", bg: "bg-yellow-400" },
  { name: "Black", hex: "#3F474E", bg: "bg-gray-800" },
  { name: "White", hex: "#D6E0F0", bg: "bg-gray-200" },
  { name: "Purple", hex: "#6B2FBC", bg: "bg-purple-600" },
  { name: "Cyan", hex: "#38FEDC", bg: "bg-cyan-400" },
];

// ==========================================
// 2. 后端 API 连接逻辑
// ==========================================

const toSimplified = (text) => {
  if (typeof text !== 'string') return text;
  return text
    .replace(/撒謊/g, "撒谎").replace(/與/g, "与").replace(/實/g, "实")
    .replace(/偽裝/g, "伪装").replace(/內鬼/g, "内鬼").replace(/說/g, "说")
    .replace(/邏輯/g, "逻辑").replace(/潛在/g, "潜在").replace(/約束/g, "约束")
    .replace(/檢測/g, "检测").replace(/網絡/g, "网络").replace(/連/g, "连")
    .replace(/換/g, "换").replace(/擬/g, "拟").replace(/備/g, "备")
    .replace(/確/g, "确").replace(/據/g, "据").replace(/誤/g, "误");
};

// [修改] 计算用于进度条显示的“置信度”，但核心保留 score (代价)
const calculateVisualConfidence = (data) => {
  if (!data || data.length === 0) return [];

  // 1. 计算适应度 (Fitness) = 1 / (1 + score)
  let totalFitness = 0;
  const dataWithFitness = data.map(item => {
    // 如果后端没传 score，用 rank 估算一个
    const score = item.score !== undefined ? item.score : (item.rank - 1) * 10; 
    const fitness = 1.0 / (1.0 + score);
    totalFitness += fitness;
    return { ...item, score, fitness };
  });

  // 2. 计算 visualProbability 供 UI 进度条使用
  return dataWithFitness.map(item => {
    let finalDetails = [];

    // 情况 A: 后端返回了详细日志
    if (item.details && Array.isArray(item.details)) {
        finalDetails = item.details.map(d => ({
            ...d,
            content: toSimplified(d.content),
            fact_check: toSimplified(d.fact_check)
        }));
    } 
    // 情况 B: 后端只返回了简单原因
    else if (item.reason && Array.isArray(item.reason)) {
        finalDetails = item.reason.map(r => ({
            speaker: "System",
            role: "Info",
            content: toSimplified(r),
            is_truth: !r.includes("撒谎") && !r.includes("❌"),
            fact_check: ""
        }));
    }

    return {
        ...item,
        // 代价越低，适应度越高，进度条越长
        visualProbability: (item.fitness / totalFitness) * 100,
        details: finalDetails
    };
  });
};

// [修改] Mock 数据增加 score 字段
const mockSolve = (players, logs) => {
  const suspects = {};
  players.forEach(p => suspects[p.name] = 0);
  
  // 生成 Mock Details
  const details = logs.map(log => {
    const isTruth = Math.random() > 0.3; 
    return {
      speaker: log.actor || "SYSTEM",
      role: isTruth ? "Crewmate" : "Impostor",
      content: log.text,
      is_truth: isTruth,
      fact_check: isTruth ? "" : "(Mock: 实情不符)"
    };
  });

  const sortedSuspects = Object.entries(suspects)
    .sort(([,a], [,b]) => b - a)
    .map(([name]) => name);

  // 模拟两个解：解1 分数0(完美)，解2 分数20(有点瑕疵)
  const solutions = [
    { 
      rank: 1, 
      impostors: [sortedSuspects[0] || 'Red', sortedSuspects[1] || 'Blue'],
      details: details.length > 0 ? details : [{speaker: "System", role: "SYSTEM", content: "网络连接失败，显示模拟数据", is_truth: false, fact_check: ""}],
      score: 0 
    },
    { 
      rank: 2, 
      impostors: [sortedSuspects[0], sortedSuspects[2] || sortedSuspects[1]].filter(Boolean),
      details: [],
      score: 20
    }
  ];
  
  return calculateVisualConfidence(solutions);
};

const solveLogic = async (players, logs, impostorCount) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch('https://backend-logic.zeabur.app/solve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        players,
        logs,
        impostorCount
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    return calculateVisualConfidence(data);

  } catch (error) {
    console.warn("API Connection Failed, switching to Mock Mode:", error);
    return mockSolve(players, logs);
  }
};

// ==========================================
// 3. UI 组件
// ==========================================

const PlayerAvatar = ({ player, size = "md", status = "alive", onClick, selected }) => {
  const sizeClasses = { sm: "w-8 h-8", md: "w-12 h-12", lg: "w-16 h-16" };
  const isDead = status === "dead";
  
  return (
    <div 
      onClick={() => onClick && onClick(player)}
      className={`
        relative flex flex-col items-center cursor-pointer transition-all duration-200
        ${selected ? "scale-110" : "hover:scale-105"}
        ${isDead ? "opacity-50 grayscale" : ""}
      `}
    >
      <div className={`
        ${sizeClasses[size]} rounded-full border-2 flex items-center justify-center overflow-hidden
        ${selected ? "border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.6)]" : "border-gray-600"}
        ${player.colorObj.bg}
      `}>
        <Users className="text-white/80 w-2/3 h-2/3" />
      </div>
      {isDead && (
        <Skull className="absolute top-0 right-0 text-red-500 w-5 h-5 bg-black rounded-full p-0.5" />
      )}
      <span className="text-xs mt-1 font-mono text-gray-300">{player.name}</span>
    </div>
  );
};

const LocationPin = ({ loc, onClick, selected }) => (
  <div 
    onClick={() => onClick(loc)}
    className={`
      absolute cursor-pointer flex flex-col items-center transition-all duration-300
      ${selected ? "scale-125 z-10" : "hover:scale-110 opacity-70 hover:opacity-100"}
    `}
    style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
  >
    <MapPin className={`w-6 h-6 ${loc.color} ${selected ? 'fill-current' : ''}`} />
    {selected && (
      <span className="absolute -bottom-6 text-[10px] whitespace-nowrap bg-black/80 px-2 py-1 rounded text-white border border-gray-700">
        {loc.name.split(' ')[0]}
      </span>
    )}
  </div>
);

// [修改] 结果卡片组件 - 显示 Cost
const AnalysisResultCard = ({ result, players, index }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-gray-900/80 border border-gray-700 rounded-xl overflow-hidden transition-colors hover:border-cyan-500/50 relative group">
      {/* 进度条基于 visualProbability (置信度) */}
      <div 
        className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-cyan-900/10 to-transparent transition-all duration-1000 ease-out z-0" 
        style={{ width: `${result.visualProbability}%` }} 
      />

      <div 
        className="relative p-6 flex items-center cursor-pointer select-none z-10" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="text-4xl font-black text-gray-700 mr-6">#{result.rank}</div>
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-1 flex-wrap">
            <span className="text-red-400 font-bold uppercase tracking-wider text-sm">嫌疑人组合:</span>
            <div className="flex gap-2 flex-wrap">
              {result.impostors.map(name => {
                const p = players.find(x => x.name === name);
                return (
                  <div key={name} className={`px-3 py-1 rounded-full text-white text-sm font-bold flex items-center gap-2 ${p?.colorObj.bg || 'bg-gray-600'}`}>
                      {name}
                  </div>
                );
              })}
            </div>
          </div>
          {!isOpen && (
            <div className="text-xs text-gray-500 font-mono mt-2 flex items-center gap-1">
              <MessageSquareQuote size={12} /> 点击展开查看详细复盘日志 ({result.details?.length || 0})
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            {/* 显示 Cost 分数 */}
            <span className="block text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-orange-300 to-red-500">
              {result.score !== undefined ? result.score : '-'}<span className="text-sm align-top ml-1 text-gray-500 font-normal">pts</span>
            </span>
            <span className="text-xs text-gray-500 uppercase">Logic Cost</span>
          </div>
          <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown className="text-gray-400" />
          </div>
        </div>
      </div>

      <div className={`bg-black/30 border-t border-gray-800 transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[800px] opacity-100 overflow-y-auto custom-scrollbar' : 'max-h-0 opacity-0'} relative z-10`}>
        <div className="p-4 sm:p-6 pt-4">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <FileText size={12} /> 完整复盘日志
          </h4>
          <div className="space-y-2">
            {result.details?.map((item, i) => {
              const isImpostor = item.role === "Impostor";
              const isTruth = item.is_truth;
              const isSystem = item.role === "SYSTEM";
              
              let borderClass = 'border-gray-700/50';
              let bgClass = 'bg-gray-800/50';
              let icon = null;

              if (isSystem) {
                borderClass = 'border-cyan-900/50';
                bgClass = 'bg-cyan-900/10';
              } else if (!isTruth) {
                borderClass = 'border-red-900/50';
                bgClass = 'bg-red-900/10';
                icon = <XCircle size={14} className="text-red-500" />;
              } else if (isTruth && isImpostor) {
                borderClass = 'border-yellow-900/50';
                bgClass = 'bg-yellow-900/10';
                icon = <AlertTriangle size={14} className="text-yellow-500" />;
              } else {
                borderClass = 'border-green-900/30';
                bgClass = 'bg-green-900/5';
                icon = <Check size={14} className="text-green-500" />;
              }

              const p = players.find(x => x.name === item.speaker);
              const colorBg = p?.colorObj.bg || 'bg-gray-600';

              return (
                <div key={i} className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded border ${borderClass} ${bgClass}`}>
                  <div className="flex items-center gap-3 w-32 shrink-0">
                    {item.speaker !== "SYSTEM" && item.speaker !== "System" && (
                      <div className={`w-2 h-2 rounded-full ${colorBg}`} />
                    )}
                    <div className="flex flex-col">
                      <span className={`text-sm font-bold ${isImpostor ? 'text-red-400' : 'text-gray-300'}`}>
                        {item.speaker}
                      </span>
                      <span className="text-[10px] uppercase opacity-50 tracking-wider">
                        {item.role === "Impostor" ? "内鬼" : item.role === "Crewmate" ? "船员" : "系统"}
                      </span>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center justify-center w-8">
                    {icon}
                  </div>

                  <div className="flex-1 text-sm text-gray-300 font-mono">
                    "{item.content}"
                    {item.fact_check && (
                      <span className="block sm:inline sm:ml-2 text-red-400 text-xs font-bold">
                        {item.fact_check}
                      </span>
                    )}
                    {isImpostor && isTruth && (
                      <span className="block sm:inline sm:ml-2 text-yellow-500 text-xs opacity-70">
                        (伪装: 内鬼说真话)
                      </span>
                    )}
                    {!isTruth && !item.fact_check && (
                      <span className="block sm:inline sm:ml-2 text-red-500 text-xs opacity-70">
                        (判定为谎言)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {result.details?.length === 0 && (
                <div className="text-center text-gray-500 py-4 italic">暂无详细日志 (后端未返回 details 数据)</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 4. 独立视图组件
// ==========================================

const SetupView = ({ players, setPlayers, impostorCount, setImpostorCount, onStart }) => {
  const handleAddPlayer = (color) => {
    if (players.some(p => p.name === color.name)) return;
    setPlayers([...players, { id: Date.now(), name: color.name, colorObj: color, status: 'alive' }]);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 animate-fade-in overflow-y-auto">
      <div className="text-center space-y-2 mt-10">
        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 tracking-tighter">
          AMONG US <span className="text-white block text-2xl font-mono mt-2">LOGIC ENGINE v6.5</span>
        </h1>
        <p className="text-gray-400">基于 Z3 求解器的逻辑推理系统</p>
      </div>

      <div className="bg-gray-900/80 p-6 rounded-2xl border border-gray-700 w-full max-w-2xl backdrop-blur-sm">
        <div className="flex justify-between items-center mb-4">
          <span className="text-gray-300">选择内鬼数量:</span>
          <div className="flex space-x-2">
            {[1, 2, 3].map(n => (
              <button 
                key={n}
                onClick={() => setImpostorCount(n)}
                className={`w-10 h-10 rounded font-bold transition-colors ${impostorCount === n ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4 mb-8">
          {COLORS.map(color => {
            const added = players.some(p => p.name === color.name);
            return (
              <button
                key={color.name}
                disabled={added}
                onClick={() => handleAddPlayer(color)}
                className={`
                  h-14 rounded-lg flex items-center justify-center transition-all
                  ${added ? 'opacity-20 cursor-not-allowed' : 'hover:scale-110 hover:shadow-lg'}
                  ${color.bg}
                `}
              >
                <Users className="text-white/90" />
              </button>
            );
          })}
        </div>

        <div className="border-t border-gray-700 pt-4 flex flex-wrap gap-2 min-h-[60px]">
          {players.length === 0 && <span className="text-gray-500 italic">请点击上方颜色添加玩家...</span>}
          {players.map(p => (
            <div key={p.id} className="bg-gray-800 px-3 py-1 rounded-full flex items-center space-x-2 border border-gray-600">
              <div className={`w-3 h-3 rounded-full ${p.colorObj.bg}`} />
              <span className="text-sm text-gray-200">{p.name}</span>
              <button onClick={() => setPlayers(players.filter(x => x.id !== p.id))} className="text-gray-500 hover:text-red-400">×</button>
            </div>
          ))}
        </div>
      </div>

      <button 
        onClick={onStart}
        className="px-12 py-4 bg-cyan-600 hover:bg-cyan-500 text-black font-black text-xl rounded-full shadow-[0_0_20px_rgba(8,145,178,0.5)] transition-all hover:scale-105 active:scale-95 flex items-center space-x-3 mb-10"
      >
        <Play size={24} />
        <span>系统初始化</span>
      </button>
    </div>
  );
};

const GameView = ({ players, setPlayers, logs, setLogs, impostorCount, onSolve, onReset }) => {
  const [activeAction, setActiveAction] = useState(null);
  const [actor, setActor] = useState(null);
  const [target, setTarget] = useState(null);
  const [location, setLocation] = useState(null);
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const resetActionForm = () => {
    setActiveAction(null);
    setActor(null);
    setTarget(null);
    setLocation(null);
  };

  const executeAction = () => {
    let logEntry = null;
    const tName = target?.name;
    const aName = actor?.name;
    const locName = location?.name.split(' ')[0];

    switch (activeAction) {
      case 'saw': logEntry = { type: 'saw', text: `📍 [位置] ${aName} 说 ${tName} 在 ${locName}`, actor: aName, target: tName, loc: location.id }; break;
      case 'kill': logEntry = { type: 'kill', text: `🔪 [指控] ${aName} 指控 ${tName} 杀人/钻管道`, actor: aName, target: tName }; break;
      case 'sus': logEntry = { type: 'sus', text: `👀 [怀疑] ${aName} 怀疑 ${tName} (在尸体旁)`, actor: aName, target: tName }; break;
      case 'trust': logEntry = { type: 'trust', text: `🛡️ [担保] ${aName} 担保 ${tName} 是好人`, actor: aName, target: tName }; break;
      case 'scan': logEntry = { type: 'scan', text: `💉 [铁证] 大家看见 ${tName} 做任务 (金水)`, target: tName }; break;
      case 'body': 
        logEntry = { type: 'body', text: `📢 [报警] ${aName} 在 ${locName} 报告尸体`, actor: aName, target: tName, loc: location.id };
        setPlayers(ps => ps.map(p => p.name === tName ? { ...p, status: 'dead' } : p));
        break;
      default: break;
    }

    if (logEntry) {
      setLogs([...logs, logEntry]);
      resetActionForm();
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full p-4 md:p-8 overflow-hidden relative z-10">
      <div className="md:col-span-3 flex flex-col space-y-4">
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-5 flex-1 flex flex-col min-h-0">
          <h3 className="text-gray-400 font-mono text-xs uppercase tracking-widest mb-4 flex items-center gap-2 opacity-70">
            <Activity size={14} className="text-green-400" /> Biosign Monitor
          </h3>
          <div className="grid grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pr-2 custom-scrollbar">
            {players.map(p => (
              <PlayerAvatar key={p.id} player={p} size="sm" />
            ))}
          </div>
        </div>
        
        <div className="space-y-3">
           <button onClick={onSolve} className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all animate-pulse-slow">
             <Search /> 开始推理 (SOLVE)
           </button>
           <button onClick={onReset} className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-400 font-bold text-xs tracking-widest rounded-xl border border-white/5 transition-all">
             ABORT MISSION
           </button>
        </div>
      </div>

      <div className="md:col-span-6 flex flex-col space-y-4 h-full">
        <div className="bg-black/60 backdrop-blur-xl p-2 rounded-2xl flex justify-between shadow-2xl border border-white/5">
          {[
            { id: 'saw', label: 'SAW', icon: Eye, color: 'text-cyan-400', bg: 'hover:bg-cyan-500/20' },
            { id: 'kill', label: 'KILL', icon: Siren, color: 'text-red-500', bg: 'hover:bg-red-500/20' },
            { id: 'sus', label: 'SUS', icon: AlertTriangle, color: 'text-orange-400', bg: 'hover:bg-orange-500/20' },
            { id: 'trust', label: 'TRUST', icon: Shield, color: 'text-green-400', bg: 'hover:bg-green-500/20' },
            { id: 'body', label: 'BODY', icon: Skull, color: 'text-purple-400', bg: 'hover:bg-purple-500/20' },
            { id: 'scan', label: 'SCAN', icon: Zap, color: 'text-yellow-300', bg: 'hover:bg-yellow-500/20' },
          ].map(action => (
            <button
              key={action.id}
              onClick={() => { setActiveAction(action.id); setActor(null); setTarget(null); setLocation(null); }}
              className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl transition-all duration-300 ${activeAction === action.id ? 'bg-white/10 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]' : action.bg}`}
            >
              <action.icon size={22} className={`${action.color} drop-shadow-[0_0_8px_currentColor]`} />
              <span className={`text-[10px] font-bold tracking-wider ${activeAction === action.id ? 'text-white' : 'text-gray-500'}`}>{action.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 bg-black/40 backdrop-blur-md rounded-3xl border border-white/10 relative overflow-hidden group shadow-2xl">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
          
          {!activeAction ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20 select-none">
              <Terminal size={80} className="mb-6 opacity-30" />
              <p className="font-mono text-sm tracking-[0.3em] uppercase">System Ready</p>
              <p className="text-xs opacity-50 mt-2">Waiting for input...</p>
            </div>
          ) : (
            <div className="absolute inset-0 p-6 flex flex-col animate-fade-in-up z-10">
              <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                <h2 className="text-2xl font-black text-white flex items-center gap-3">
                  <span className="text-cyan-500 text-3xl">/</span> 
                  {activeAction.toUpperCase()}
                </h2>
                <button onClick={resetActionForm} className="text-white/30 hover:text-white transition-colors"><XCircle /></button>
              </div>

              {activeAction !== 'scan' && (
                <div className="mb-6">
                  <p className="text-[10px] text-cyan-400 mb-3 uppercase tracking-widest font-bold">Subject (Who?)</p>
                  <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                    {players.filter(p => p.status === 'alive').map(p => (
                      <PlayerAvatar key={p.id} player={p} size="sm" selected={actor?.id === p.id} onClick={setActor} />
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <p className="text-[10px] text-cyan-400 mb-3 uppercase tracking-widest font-bold">Target (Whom?)</p>
                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                  {players.map(p => (
                    <PlayerAvatar key={p.id} player={p} size="sm" selected={target?.id === p.id} onClick={setTarget} />
                  ))}
                </div>
              </div>

              {(activeAction === 'saw' || activeAction === 'body') && (
                <div className="flex-1 relative bg-black/60 rounded-2xl border border-white/10 overflow-hidden group/map">
                   <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 to-transparent h-[10%] w-full animate-scan-line pointer-events-none z-0" />
                   
                   {LOCATIONS.map(loc => (
                     <LocationPin key={loc.id} loc={loc} selected={location?.id === loc.id} onClick={setLocation} />
                   ))}
                   {!location && <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-white/30 font-mono">SELECT SECTOR</div>}
                </div>
              )}

              <button 
                disabled={!target || (activeAction !== 'scan' && !actor) || ((activeAction === 'saw' || activeAction === 'body') && !location)}
                onClick={executeAction}
                className="mt-6 w-full py-4 bg-cyan-600 disabled:bg-gray-800 disabled:text-gray-600 text-white font-black tracking-widest rounded-xl transition-all hover:bg-cyan-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] active:scale-[0.98]"
              >
                CONFIRM INPUT
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="md:col-span-3 bg-black/80 backdrop-blur-md rounded-xl border border-white/10 p-0 font-mono text-xs overflow-hidden flex flex-col relative shadow-2xl h-full min-h-[300px]">
        <div className="bg-white/5 p-3 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-cyan-500 flex items-center gap-2 font-bold tracking-wider">
            <Terminal size={14} /> COMM_LOGS
          </h3>
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500/50" />
            <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
            <div className="w-2 h-2 rounded-full bg-green-500/50" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
          {logs.length === 0 && <div className="text-gray-700 text-center mt-10 italic">No data stream...</div>}
          {logs.map((log, idx) => (
            <div key={idx} className="flex gap-3 animate-fade-in-up">
              <span className="text-gray-600 shrink-0">{(idx+1).toString().padStart(2,'0')}</span>
              <div className={`
                ${log.type === 'kill' ? 'text-red-400' : 
                  log.type === 'trust' ? 'text-green-400' : 
                  log.type === 'body' ? 'text-purple-400 font-bold' : 
                  log.type === 'scan' ? 'text-yellow-300' : 'text-cyan-300'}
              `}>
                <span className="opacity-70 mr-2 text-[10px] border border-current px-1 rounded uppercase">{log.type}</span>
                {log.text.split(' ').slice(1).join(' ')}
              </div>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
};

const AnalysisView = ({ analysisResults, players, onBack, onReset }) => {
  return (
    <div className="w-full h-full flex flex-col overflow-hidden animate-fade-in relative">
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar pb-32">
        <div className="max-w-4xl mx-auto min-h-full flex flex-col justify-center">
          {!analysisResults ? (
            <div className="text-center space-y-6 py-20">
              <div className="relative w-32 h-32 mx-auto">
                <div className="absolute inset-0 border-4 border-cyan-500/30 rounded-full animate-ping" />
                <div className="absolute inset-0 border-4 border-t-cyan-400 border-r-transparent border-b-cyan-400 border-l-transparent rounded-full animate-spin" />
              </div>
              <h2 className="text-3xl font-black text-white tracking-widest animate-pulse">PROCESSING...</h2>
              <div className="text-cyan-500/50 font-mono text-sm space-y-1">
                <p>Establishing Z3 constraints...</p>
                <p>Verifying alibis...</p>
                <p>Detecting contradictions...</p>
              </div>
            </div>
          ) : (
            <div className="w-full space-y-6">
              <div className="text-center mb-10 mt-10">
                <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-cyan-400 mb-2">VERDICT READY</h2>
                <p className="text-gray-500 font-mono tracking-[0.5em] text-xs">CALCULATION COMPLETE</p>
              </div>
              <div className="grid gap-6">
                {analysisResults.map((result, idx) => (
                  <AnalysisResultCard key={idx} result={result} players={players} index={idx} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {analysisResults && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/80 border-t border-white/10 p-6 backdrop-blur-xl z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <div className="flex gap-6 max-w-2xl mx-auto justify-center">
            <button onClick={onBack} className="flex-1 flex items-center justify-center gap-3 px-8 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl text-white font-bold transition-all border border-white/10 hover:border-white/30">
              <RotateCcw size={20} /> 返回控制台
            </button>
            <button onClick={onReset} className="flex-1 flex items-center justify-center gap-3 px-8 py-4 bg-red-600 hover:bg-red-500 rounded-xl text-white font-bold transition-all shadow-lg hover:shadow-red-900/50">
              <XCircle size={20} /> 结束游戏
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 5. App 入口
// ==========================================

export default function App() {
  const [gameState, setGameState] = useState('setup');
  const [players, setPlayers] = useState([]);
  const [impostorCount, setImpostorCount] = useState(2);
  const [logs, setLogs] = useState([]);
  const [analysisResults, setAnalysisResults] = useState(null);

  const handleStartGame = () => {
    if (players.length < 3) return alert("至少需要3名玩家");
    setLogs([{ type: 'sys', text: `🎮 游戏初始化 | 玩家: ${players.length} | 内鬼: ${impostorCount}` }]);
    setGameState('playing');
  };

  const handleResetGame = () => {
    if (confirm("确定要结束当前游戏并返回主菜单吗？")) {
      setLogs([]);
      setAnalysisResults(null);
      setGameState('setup');
      setPlayers(players.map(p => ({ ...p, status: 'alive' })));
    }
  };

  const handleSolve = async () => {
    setGameState('analyzing');
    setAnalysisResults(null);
    const results = await solveLogic(players, logs, impostorCount);
    setAnalysisResults(results);
  };

  return (
    <div className="w-full h-screen bg-[#050505] text-gray-200 overflow-hidden font-sans selection:bg-cyan-500/30">
      {/* 动态星空背景 */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black" />
        <div className="stars absolute inset-0 opacity-50" />
        <div className="twinkling absolute inset-0 opacity-30" />
      </div>

      <div className="relative z-10 h-full">
        {gameState === 'setup' && (
          <SetupView 
            players={players} setPlayers={setPlayers}
            impostorCount={impostorCount} setImpostorCount={setImpostorCount}
            onStart={handleStartGame}
          />
        )}
        {gameState === 'playing' && (
          <GameView 
            players={players} setPlayers={setPlayers}
            logs={logs} setLogs={setLogs}
            impostorCount={impostorCount}
            onSolve={handleSolve} onReset={handleResetGame}
          />
        )}
        {gameState === 'analyzing' && (
          <AnalysisView 
            analysisResults={analysisResults} players={players}
            onBack={() => setGameState('playing')} onReset={handleResetGame}
          />
        )}
      </div>

      <style>{`
        /* 动态背景动画 */
        .stars { background: url('https://s3-us-west-2.amazonaws.com/s.cdpn.io/1231630/stars.png') repeat; top: 0; bottom: 0; left: 0; right: 0; display: block; position: absolute; z-index: 0; }
        .twinkling { background: url('https://s3-us-west-2.amazonaws.com/s.cdpn.io/1231630/twinkling.png') repeat; top: 0; bottom: 0; left: 0; right: 0; display: block; position: absolute; z-index: 1; animation: move-twink-back 200s linear infinite; }
        @keyframes move-twink-back { from {background-position:0 0;} to {background-position:-10000px 5000px;} }
        @keyframes scan-line { 0% {top: -10%;} 100% {top: 110%;} }
        .animate-scan-line { animation: scan-line 3s linear infinite; }
        
        /* 滚动条美化 */
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4B5563; }
        
        .animate-fade-in { animation: fadeIn 0.6s ease-out; }
        .animate-fade-in-up { animation: fadeInUp 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
