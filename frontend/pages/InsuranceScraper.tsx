import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Play, Download, Database, SearchIcon, ClipboardList, Loader2, CheckCircle2, Info, AlertCircle, ShieldAlert, Zap, Hash, ArrowRight } from 'lucide-react';
import { CarrierData, InsurancePolicy } from '../types';
import { fetchInsuranceData } from '../services/mockService';
import { updateCarrierInsurance } from '../services/supabaseClient';
import {
  startInsuranceTask,
  stopInsuranceTask,
  getInsuranceStatus,
  TaskStatus,
} from '../services/backendService';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

interface InsuranceScraperProps {
  carriers: CarrierData[];
  onUpdateCarriers: (newData: CarrierData[]) => void;
  autoStart?: boolean;
}

export const InsuranceScraper: React.FC<InsuranceScraperProps> = ({ carriers, onUpdateCarriers, autoStart }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ total: 0, insFound: 0, insFailed: 0, dbSaved: 0 });
  
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  const [manualDot, setManualDot] = useState('');
  const [isManualLoading, setIsManualLoading] = useState(false);
  const [manualResult, setManualResult] = useState<{policies: InsurancePolicy[]} | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const isRunningRef = useRef(false);
  const hasAutoStarted = useRef(false);
  const taskIdRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevLogCountRef = useRef(0);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    if (autoStart && carriers.length > 0 && !isProcessing && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      startEnrichmentProcess(carriers);
    }
  }, [autoStart, carriers]);

  // Reconnect to active insurance task on mount
  useEffect(() => {
    const checkActiveTask = async () => {
      try {
        const resp = await fetch(`${BACKEND_URL}/api/tasks/active?task_type=insurance`);
        const data = await resp.json();
        if (data.task_id && data.task?.status === 'running') {
          taskIdRef.current = data.task_id;
          setIsProcessing(true);
          isRunningRef.current = true;
          setLogs(prev => [...prev, `\uD83D\uDD04 Reconnected to running insurance task ${data.task_id}...`]);
          startPolling(data.task_id);
        }
      } catch (_e) {
        // Backend not available
      }
    };
    checkActiveTask();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const startPolling = (taskId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const status: TaskStatus = await getInsuranceStatus(taskId);

        // Update logs
        if (status.logs && status.logs.length > prevLogCountRef.current) {
          const newLogs = status.logs.slice(prevLogCountRef.current);
          setLogs(prev => [...prev, ...newLogs]);
          prevLogCountRef.current = status.logs.length;
        }

        // Update progress & stats
        setProgress(status.progress || 0);
        setStats(prev => ({
          ...prev,
          insFound: status.insFound || 0,
          dbSaved: status.dbSaved || 0,
        }));

        // Task finished
        if (status.status === 'completed' || status.status === 'stopped') {
          setIsProcessing(false);
          isRunningRef.current = false;
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      } catch (_e) {
        // Network error, keep polling
      }
    }, 2000);
  };

  const startEnrichmentProcess = async (targetList: CarrierData[] = carriers) => {
    if (isProcessing) return;
    if (targetList.length === 0) {
      setLogs(prev => [...prev, "\u274C Error: No carriers found in range/database."]);
      return;
    }

    setIsProcessing(true);
    isRunningRef.current = true;
    prevLogCountRef.current = 0;
    setStats({ total: targetList.length, insFound: 0, insFailed: 0, dbSaved: 0 });
    
    const dotNumbers = targetList.map(c => c.dotNumber).filter(Boolean);
    setLogs([
      `\uD83D\uDE80 ENGINE INITIALIZED: Insurance Enrichment...`,
      `\uD83D\uDD0D Targeting: ${dotNumbers.length} USDOT records`,
      `\uD83D\uDD12 Tasks persist even if you close this page.`,
    ]);

    try {
      const result = await startInsuranceTask({ dotNumbers });
      taskIdRef.current = result.task_id;
      setLogs(prev => [...prev, `\u2705 Task ${result.task_id} started on server.`]);
      startPolling(result.task_id);
    } catch (e) {
      setLogs(prev => [...prev, `\u274C [Error] Could not start backend task: ${e}`]);
      setIsProcessing(false);
      isRunningRef.current = false;
    }
  };

  const handleStop = async () => {
    if (taskIdRef.current) {
      try {
        await stopInsuranceTask(taskIdRef.current);
        setLogs(prev => [...prev, '\u26D4 Stop signal sent to server...']);
      } catch (_e) {
        // ignore
      }
    }
    isRunningRef.current = false;
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsProcessing(false);
  };

  const handleRangeRun = () => {
    const start = parseInt(rangeStart);
    const end = parseInt(rangeEnd);
    if (isNaN(start) || isNaN(end)) return;

    const filtered = carriers.filter(c => {
      const mc = parseInt(c.mcNumber || "0");
      return mc >= start && mc <= end;
    });

    setLogs(prev => [...prev, `\uD83C\uDFAF Range identified: MC ${start} to ${end} (${filtered.length} found)`]);
    startEnrichmentProcess(filtered);
  };

  const handleManualCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDot) return;
    setIsManualLoading(true);
    try {
      const { policies } = await fetchInsuranceData(manualDot);
      setManualResult({ policies });
    } catch (error) { console.error(error); } 
    finally { setIsManualLoading(false); }
  };

  return (
    <div className="p-8 h-screen flex flex-col overflow-hidden bg-[#0a0c10] text-slate-200">
      {/* Header Container */}
      <div className="flex justify-between items-center mb-10 bg-slate-900/40 p-6 rounded-3xl border border-white/5 backdrop-blur-md">
        <div>
          <h1 className="text-4xl font-black text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-500">
            Insurance <span className="text-indigo-500">Intel</span>
          </h1>
          <p className="text-slate-500 font-medium mt-1">Batch Processing: FMCSA Insurance Filings with Supabase Sync</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => isProcessing ? handleStop() : startEnrichmentProcess()}
            className={`group flex items-center gap-3 px-10 py-4 rounded-2xl font-black transition-all ${
                isProcessing ? 'bg-red-500/10 text-red-500 border border-red-500/50' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
            }`}
          >
            {isProcessing ? <><Loader2 className="animate-spin" size={20} /> Stop Scraper</> : <><Zap size={20} /> Run Insurance Batch</>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8 flex-1 min-h-0">
        <div className="col-span-12 lg:col-span-4 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
          
          {/* Range Controller */}
          <div className="bg-slate-900/40 border border-white/5 p-6 rounded-[2rem]">
            <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
              <Hash size={16} /> MC Range Scraper
            </h3>
            <div className="flex items-center gap-3 mb-4">
              <input type="number" placeholder="Start MC" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none transition-all" />
              <ArrowRight size={20} className="text-slate-600 shrink-0" />
              <input type="number" placeholder="End MC" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none transition-all" />
            </div>
            <button onClick={handleRangeRun} disabled={isProcessing || !rangeStart || !rangeEnd} className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-30">
              Run Range Batch
            </button>
          </div>

          {/* Quick Lookup */}
          <div className="bg-slate-900/40 border border-white/5 p-6 rounded-[2rem]">
             <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                <SearchIcon size={16} className="text-indigo-400" /> Quick Policy Lookup
             </h3>
             <form onSubmit={handleManualCheck} className="relative group">
                <input type="text" value={manualDot} onChange={(e) => setManualDot(e.target.value)} placeholder="Enter USDOT Number" className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white outline-none focus:ring-2 ring-indigo-500/20 transition-all" />
                <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-indigo-500 rounded-xl text-white shadow-lg"><Play size={18} /></button>
             </form>
          </div>

          {/* Counter Display */}
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
            <h3 className="text-xs font-black text-white/60 uppercase tracking-[0.2em] mb-6 flex items-center gap-3"><Database size={16}/> Live Counters</h3>
            <div className="grid grid-cols-2 gap-6 relative z-10">
              <div>
                <span className="text-[10px] text-white/50 block uppercase font-bold mb-1">Insurance Found</span>
                <span className="text-3xl font-black text-white">{stats.insFound}</span>
              </div>
              <div>
                <span className="text-[10px] text-white/50 block uppercase font-bold mb-1">DB Updates</span>
                <span className="text-3xl font-black text-white">{stats.dbSaved}</span>
              </div>
            </div>
            <div className="mt-8">
              <div className="flex justify-between text-[10px] font-black text-white/60 mb-2 uppercase"><span>Batch Progress</span> <span>{progress}%</span></div>
              <div className="w-full bg-black/20 rounded-full h-3">
                <div className="bg-white h-3 rounded-full transition-all duration-500 shadow-[0_0_15px_rgba(255,255,255,0.5)]" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Logging Terminal */}
        <div className="col-span-12 lg:col-span-8 flex flex-col bg-black/40 rounded-[2.5rem] border border-white/5 overflow-hidden">
          <div className="bg-slate-900/40 p-5 border-b border-white/5 px-10 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
            Insurance Pipeline Stream
          </div>
          <div className="flex-1 overflow-y-auto p-10 font-mono text-[11px] space-y-3 custom-scrollbar">
            {logs.map((log, i) => (
              <div key={i} className={`flex gap-4 items-start p-3 rounded-xl transition-all ${
                log.includes('✨') || log.includes('✅') || log.includes('🎉') || log.includes('Success:') || log.includes('DB Sync:') || log.includes('ENRICHMENT COMPLETE')
                ? 'text-emerald-400 bg-emerald-500/5 border border-emerald-500/10' 
                : log.includes('❌') || log.includes('Fail:') || log.includes('[Error]') ? 'text-red-400 bg-red-500/5 border border-red-500/10' 
                : 'text-slate-400'
              }`}>
                <span className="text-slate-600 shrink-0 select-none">[{new Date().toLocaleTimeString().split(' ')[0]}]</span>
                <span className="leading-relaxed">{log}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};
