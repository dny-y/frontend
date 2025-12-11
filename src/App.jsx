import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Eye, Skull, Shield, Siren, AlertTriangle, 
  Terminal, Play, RotateCcw, MapPin, Activity, 
  Search, XCircle, Zap, LogOut
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
// 2. 后端 API 连接逻辑 (包含本地模拟回退)
// ==========================================

// 辅助函数：简易繁简转换，确保即使后端返回繁体，前端也显示简体
const toSimplified = (text) => {
  if (typeof text !== 'string') return text;
  return text
    .replace(/撒謊/g, "撒谎").replace(/與/g, "与").replace(/實/g, "实")
    .replace(/偽裝/g, "伪装").replace(/內鬼/g, "内鬼").replace(/說/g, "说")
    .replace(/邏輯/g, "逻辑").replace(/潛在/g, "潜在").replace(/約束/g, "约束")
    .replace(/檢測/g, "检测").replace(/網絡/g, "网络").replace(/連/g, "连")
    .replace(/換/g, "换").replace(/擬/g, "拟").replace(/備/g, "备")
    .replace(/確/g, "确");
};

// 本地模拟算法 (当后端无法连接时使用)
const mockSolve = (players, logs) => {
  const suspects = {};
  players.forEach(p => suspects[p.name] = 0);

  logs.forEach(log => {
    if (log.type === 'kill') suspects[log.target] = (suspects[log.target] || 0) + 20;
    if (log.type === 'sus') suspects[log.target] = (suspects[log.target] || 0) + 8;
    if (log.type === 'scan') suspects[log.target] = (suspects[log.target] || 0) - 100;
    if (log.type === 'trust') suspects[log.target] = (suspects[log.target] || 0) - 5;
  });

  const sortedSuspects = Object.entries(suspects)
    .sort(([,a], [,b]) => b - a)
    .map(([name]) => name);

  return [
    { 
      rank: 1, 
      impostors: [sortedSuspects[0], sortedSuspects[1] || sortedSuspects[players.length-1]].filter(Boolean),
      reason: [`${sortedSuspects[0] || '?'} 嫌疑指数最高 (Mock)`, "检测到网络连接失败，已切换至本地模拟模式"]
    },
    { 
      rank: 2, 
      impostors: [sortedSuspects[0], sortedSuspects[2] || sortedSuspects[1]].filter(Boolean),
      reason: ["备选可能性分析 (Local Mode)", "请检查后端 API URL 是否正确"]
    },
  ];
};

const solveLogic = async (players, logs, impostorCount) => {
  try {
    // 设置 5 秒超时，避免后端休眠导致前端卡死
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // 请确保此处是您真实的后端地址，并保留 /solve 后缀
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
    
    // 关键修复：在这里对返回的数据进行繁简转换
    const simplifiedData = data.map(item => ({
      ...item,
      reason: item.reason.map(r => toSimplified(r))
    }));

    return simplifiedData;
  } catch (error) {
    console.warn("API Connection Failed, switching to Mock Mode:", error);
    // 发生错误时回退到本地模拟，保证 UI 可用
    return mockSolve(players, logs);
  }
};

// ==========================================
// 3. 子组件
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

// ==========================================
// 4. 主应用 (AmongUsUI)
// ==========================================

export default function App() {
  const [gameState, setGameState] = useState('setup'); // setup, playing, analyzing
  const [players, setPlayers] = useState([]);
  const [impostorCount, setImpostorCount] = useState(2);
  const [logs, setLogs] = useState([]);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [activeAction, setActiveAction] = useState(null);
  
  const [actor, setActor] = useState(null);
  const [target, setTarget] = useState(null);
  const [location, setLocation] = useState(null);

  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // --- Handlers ---

  const handleAddPlayer = (color) => {
    if (players.some(p => p.name === color.name)) return;
    setPlayers([...players, { 
      id: Date.now(), 
      name: color.name, 
      colorObj: color, 
      status: 'alive' 
    }]);
  };

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

  const executeAction = () => {
    let logEntry = null;
    const tName = target?.name;
    const aName = actor?.name;
    const locName = location?.name.split(' ')[0];

    switch (activeAction) {
      case 'saw':
        logEntry = { type: 'saw', text: `📍 [位置] ${aName} 说 ${tName} 在 ${locName}`, actor: aName, target: tName, loc: location.id };
        break;
      case 'kill':
        logEntry = { type: 'kill', text: `🔪 [指控] ${aName} 指控 ${tName} 杀人/钻管道`, actor: aName, target: tName };
        break;
      case 'sus':
        logEntry = { type: 'sus', text: `👀 [怀疑] ${aName} 怀疑 ${tName} (在尸体旁)`, actor: aName, target: tName };
        break;
      case 'trust':
        logEntry = { type: 'trust', text: `🛡️ [担保] ${aName} 担保 ${tName} 是好人`, actor: aName, target: tName };
        break;
      case 'scan':
        logEntry = { type: 'scan', text: `💉 [铁证] 大家看见 ${tName} 做任务 (金水)`, target: tName };
        break;
      case 'body':
        logEntry = { type: 'body', text: `📢 [报警] ${aName} 在 ${locName} 报告 ${tName} 的尸体`, actor: aName, target: tName, loc: location.id };
        setPlayers(ps => ps.map(p => p.name === tName ? { ...p, status: 'dead' } : p));
        break;
      default: break;
    }

    if (logEntry) {
      setLogs([...logs, logEntry]);
      resetActionForm();
    }
  };

  const resetActionForm = () => {
    setActiveAction(null);
    setActor(null);
    setTarget(null);
    setLocation(null);
  };

  const handleSolve = async () => {
    setGameState('analyzing');
    setAnalysisResults(null);
    const results = await solveLogic(players, logs, impostorCount);
    setAnalysisResults(results);
  };

  // --- Renders ---

  const renderSetup = () => (
    <div className="flex flex-col items-center justify-center h-full space-y-8 animate-fade-in overflow-y-auto">
      <div className="text-center space-y-2 mt-10"> {/* Added margin-top for mobile */}
        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 tracking-tighter">
          AMONG US <span className="text-white block text-2xl font-mono mt-2">LOGIC ENGINE v6.2</span>
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
        onClick={handleStartGame}
        className="px-12 py-4 bg-cyan-600 hover:bg-cyan-500 text-black font-black text-xl rounded-full shadow-[0_0_20px_rgba(8,145,178,0.5)] transition-all hover:scale-105 active:scale-95 flex items-center space-x-3 mb-10"
      >
        <Play size={24} />
        <span>系统初始化</span>
      </button>
    </div>
  );

  const renderGame = () => (
    <div className="grid grid-cols-12 gap-4 h-full p-4 overflow-hidden">
      {/* Sidebar: Players & Status */}
      <div className="col-span-3 bg-gray-900/50 rounded-xl border border-gray-800 p-4 flex flex-col space-y-4">
        <h3 className="text-gray-400 font-mono text-sm uppercase flex items-center gap-2">
          <Activity size={16} /> Crew Status
        </h3>
        <div className="grid grid-cols-3 gap-3 overflow-y-auto max-h-[400px]">
          {players.map(p => (
            <PlayerAvatar key={p.id} player={p} size="sm" />
          ))}
        </div>
        
        <div className="mt-auto border-t border-gray-800 pt-4 space-y-3">
           <button 
             onClick={handleSolve}
             className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all animate-pulse-slow"
           >
             <Search /> 开始推理 (SOLVE)
           </button>
           <button 
             onClick={handleResetGame}
             className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
           >
             <LogOut size={16} /> 结束游戏
           </button>
        </div>
      </div>

      {/* Main: Interactive Map & Actions */}
      <div className="col-span-6 flex flex-col space-y-4 h-full">
        {/* Action Toolbar */}
        <div className="bg-gray-800/80 p-3 rounded-xl flex justify-around shadow-lg border border-gray-700">
          {[
            { id: 'saw', label: '看见', icon: Eye, color: 'text-cyan-400' },
            { id: 'kill', label: '指控', icon: Siren, color: 'text-red-500' },
            { id: 'sus', label: '怀疑', icon: AlertTriangle, color: 'text-orange-400' },
            { id: 'trust', label: '担保', icon: Shield, color: 'text-green-400' },
            { id: 'body', label: '报警', icon: Skull, color: 'text-purple-400' },
            { id: 'scan', label: '扫描', icon: Zap, color: 'text-yellow-300' },
          ].map(action => (
            <button
              key={action.id}
              onClick={() => { setActiveAction(action.id); setActor(null); setTarget(null); setLocation(null); }}
              className={`flex flex-col items-center space-y-1 p-2 rounded-lg transition-all ${activeAction === action.id ? 'bg-gray-700 scale-110 ring-2 ring-cyan-500/50' : 'hover:bg-gray-700/50'}`}
            >
              <div className={`p-2 rounded-full bg-gray-900 ${action.color}`}>
                <action.icon size={24} />
              </div>
              <span className="text-xs font-bold text-gray-300">{action.label}</span>
            </button>
          ))}
        </div>

        {/* Action Canvas (Dynamic) */}
        <div className="flex-1 bg-gray-950 rounded-2xl border border-gray-800 relative overflow-hidden group">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,20,1)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,20,1)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20 pointer-events-none" />
          
          {!activeAction ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600">
              <Terminal size={64} className="mb-4 opacity-50" />
              <p>等待指令输入...</p>
            </div>
          ) : (
            <div className="absolute inset-0 p-6 flex flex-col animate-fade-in-up">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  指令: <span className="text-cyan-400 uppercase">{activeAction}</span>
                </h2>
                <button onClick={resetActionForm} className="text-gray-500 hover:text-white"><XCircle /></button>
              </div>

              {/* Step 1: Select Actor (Who?) */}
              {activeAction !== 'scan' && (
                <div className="mb-4">
                  <p className="text-xs text-gray-400 mb-2 uppercase tracking-widest">Step 1: 发起人 (Who?)</p>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {players.filter(p => p.status === 'alive').map(p => (
                      <PlayerAvatar key={p.id} player={p} size="sm" selected={actor?.id === p.id} onClick={setActor} />
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Select Target (Whom?) */}
              <div className="mb-4">
                <p className="text-xs text-gray-400 mb-2 uppercase tracking-widest">Step 2: 目标 (Whom?)</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {players.map(p => (
                    <PlayerAvatar key={p.id} player={p} size="sm" selected={target?.id === p.id} onClick={setTarget} />
                  ))}
                </div>
              </div>

              {(activeAction === 'saw' || activeAction === 'body') && (
                <div className="flex-1 relative bg-gray-900/50 rounded-lg border border-gray-700 mt-2">
                   {LOCATIONS.map(loc => (
                     <LocationPin key={loc.id} loc={loc} selected={location?.id === loc.id} onClick={setLocation} />
                   ))}
                   {!location && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="text-xs text-gray-500">选择地点...</span></div>}
                </div>
              )}

              <button 
                disabled={!target || (activeAction !== 'scan' && !actor) || ((activeAction === 'saw' || activeAction === 'body') && !location)}
                onClick={executeAction}
                className="mt-4 w-full py-3 bg-cyan-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-lg transition-all"
              >
                确认输入 (ENTER)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right: Logs (Terminal) */}
      <div className="col-span-3 bg-black rounded-xl border border-gray-800 p-4 font-mono text-xs overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-cyan-500 shadow-[0_0_10px_#06b6d4]" />
        <h3 className="text-cyan-500 mb-2 flex items-center gap-2">
          <Terminal size={14} /> SYSTEM_LOG
        </h3>
        <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
          {logs.map((log, idx) => (
            <div key={idx} className={`p-2 rounded border-l-2 ${
              log.type === 'kill' ? 'border-red-500 bg-red-900/10 text-red-300' :
              log.type === 'trust' ? 'border-green-500 bg-green-900/10 text-green-300' :
              log.type === 'body' ? 'border-purple-500 bg-purple-900/10 text-purple-300' :
              log.type === 'scan' ? 'border-yellow-500 bg-yellow-900/10 text-yellow-300' :
              'border-cyan-500 bg-cyan-900/10 text-cyan-300'
            }`}>
              <span className="opacity-50">[{idx < 9 ? `0${idx+1}` : idx+1}]</span> {log.text}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );

  // 关键修改：renderAnalysis 现在是一个允许滚动的容器
  const renderAnalysis = () => (
    <div className="w-full h-full flex flex-col overflow-hidden animate-fade-in relative">
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar"> {/* 内容区域可滚动 */}
        <div className="max-w-4xl mx-auto min-h-full flex flex-col justify-center">
          {!analysisResults ? (
            <div className="text-center space-y-4 py-20">
              <div className="w-24 h-24 border-4 border-t-cyan-500 border-r-transparent border-b-cyan-500 border-l-transparent rounded-full animate-spin mx-auto" />
              <h2 className="text-2xl font-mono text-cyan-400 animate-pulse">正在重构逻辑链...</h2>
              <div className="text-gray-500 font-mono text-sm">
                CALCULATING Z3 CONSTRAINTS...<br/>
                DETECTING CONTRADICTIONS...<br/>
                OPTIMIZING MODELS...
              </div>
            </div>
          ) : (
            <div className="w-full space-y-6 pb-20"> {/* 底部留白给固定按钮 */}
              <div className="text-center mb-8 mt-10">
                <h2 className="text-4xl font-black text-white mb-2">分析完成</h2>
                <p className="text-cyan-400 font-mono">DETECTED {analysisResults.length} POSSIBLE SCENARIOS</p>
              </div>

              <div className="grid gap-6">
                {analysisResults.map((result, idx) => (
                  <div key={idx} className="bg-gray-900/80 border border-gray-700 rounded-xl p-6 flex items-center hover:border-cyan-500/50 transition-colors">
                    <div className="text-4xl font-black text-gray-700 mr-6">#{result.rank}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-3 flex-wrap">
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
                      <div className="text-gray-400 text-sm font-mono space-y-1">
                        {result.reason.map((r, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <AlertTriangle size={12} className="text-yellow-500 mt-1 shrink-0" />
                            <span>{r}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="h-12 w-1 bg-gray-800 mx-6 hidden sm:block" />
                    <div className="text-right hidden sm:block">
                      <span className="block text-2xl font-bold text-cyan-400">{(100 / (idx + 1)).toFixed(1)}%</span>
                      <span className="text-xs text-gray-500 uppercase">Probability</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 底部固定操作栏 - 确保永远可见 */}
      {analysisResults && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/90 border-t border-gray-800 p-4 backdrop-blur-md z-20">
          <div className="flex gap-4 max-w-4xl mx-auto justify-center">
            <button 
              onClick={() => setGameState('playing')}
              className="flex items-center gap-2 px-8 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-all border border-gray-600"
            >
              <RotateCcw size={18} /> 返回控制台
            </button>

            <button 
              onClick={handleResetGame}
              className="flex items-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-500 rounded-lg text-white transition-all shadow-lg"
            >
              <XCircle size={18} /> 结束游戏
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full h-screen bg-black text-gray-200 overflow-hidden font-sans selection:bg-cyan-500/30">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-blue-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-1/3 h-1/3 bg-red-900/10 blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 h-full">
        {gameState === 'setup' && renderSetup()}
        {gameState === 'playing' && renderGame()}
        {gameState === 'analyzing' && renderAnalysis()}
      </div>

      {/* CSS Animation Styles */}
      <style>{`
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        .animate-fade-in { animation: fadeIn 0.5s ease-out; }
        .animate-fade-in-up { animation: fadeInUp 0.3s ease-out; }
        .animate-pulse-slow { animation: pulse 3s infinite; }
        
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        /* Custom Scrollbar for nicer look */
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3); 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #374151; 
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #4B5563; 
        }
      `}</style>
    </div>
  );
}
