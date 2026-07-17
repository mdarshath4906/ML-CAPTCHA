/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { CaptchaType, CaptchaAttempt } from './types';
import { BehavioralCaptcha } from './components/BehavioralCaptcha';
import { PatternCaptcha } from './components/PatternCaptcha';
import { PuzzleCaptcha } from './components/PuzzleCaptcha';
import { AnimatePresence, motion } from 'motion/react';
import {
  Cpu,
  ShieldCheck,
  ShieldAlert,
  Settings,
  Activity,
  FileText,
  Brain,
  Trash2,
  HelpCircle,
  CheckCircle2,
  Lock,
  Unlock,
  FileCode,
  Sliders,
  AlertTriangle,
  Flame,
  MousePointer
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<CaptchaType>('behavioral');

  // Interactive Refinement Parameters
  const [sensitivity, setSensitivity] = useState<number>(50); // Behavioral bot threshold
  const [requiredConfidence, setRequiredConfidence] = useState<number>(55); // Drawing neural threshold
  const [alignmentThreshold, setAlignmentThreshold] = useState<number>(5); // Puzzle pixel offset tolerance

  // Global Transaction Logs (Simulating Backend Storage)
  const [attempts, setAttempts] = useState<CaptchaAttempt[]>([
    {
      id: 'init-1',
      timestamp: new Date(Date.now() - 3600 * 1000),
      type: 'behavioral',
      passed: true,
      score: 94,
      botProbability: 6,
      details: 'System diagnostic sweep: human signature verified successfully.'
    }
  ]);

  const [activeTabSuccess, setActiveTabSuccess] = useState<boolean | null>(null);
  const [activeScore, setActiveScore] = useState<number | null>(null);

  // Triggered whenever a sub-CAPTCHA evaluates an action
  const handleVerifyResult = (passed: boolean, score: number, details: string) => {
    setActiveTabSuccess(passed);
    setActiveScore(score);

    const newAttempt: CaptchaAttempt = {
      id: `attempt-${Date.now()}`,
      timestamp: new Date(),
      type: activeTab,
      passed,
      score,
      botProbability: 100 - score,
      details
    };

    setAttempts(prev => [newAttempt, ...prev]);
  };

  const handleTabChange = (tab: CaptchaType) => {
    setActiveTab(tab);
    setActiveTabSuccess(null);
    setActiveScore(null);
  };

  const clearLogs = () => {
    setAttempts([]);
  };

  // Derived dashboard analytics
  const totalAttempts = attempts.length;
  const passedAttempts = attempts.filter(a => a.passed).length;
  const blockedAttempts = totalAttempts - passedAttempts;
  const preventionRate = totalAttempts > 0 ? Math.round((blockedAttempts / totalAttempts) * 100) : 100;

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col font-sans" id="app-root-container">
      {/* Top Header Section */}
      <header className="border-b border-slate-850 bg-[#0c1220] py-4 px-6 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-sky-500 to-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Brain className="w-5.5 h-5.5 text-slate-950 stroke-[2]" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                AI CAPTCHA Lab
                <span className="text-[9px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.5 rounded font-mono uppercase tracking-widest font-bold">
                  EDGE ML v1.4
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Self-Contained Browser Neural Classification & Trajectory Analysis Playground
              </p>
            </div>
          </div>

          {/* Quick status badges */}
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-900/50">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
              ALL ML IN FRONTEND MODULES
            </span>
            <span className="flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded-full border border-slate-800">
              CLIENT COMPUTE ONLY
            </span>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Controls, Metrics and Active CAPTCHA Stage (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Dashboard Stats Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="dashboard-stats-grid">
            {/* Stat 1: Threat Mitigations */}
            <div className="bg-[#0c1220] border border-slate-800/80 rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-rose-500/10 text-rose-400 rounded-lg flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Automated Threats Blocked</div>
                <div className="text-lg font-bold text-slate-100 font-mono">{blockedAttempts}</div>
                <div className="text-[9px] text-slate-400">Prevention Rate: {preventionRate}%</div>
              </div>
            </div>

            {/* Stat 2: Verified Humans */}
            <div className="bg-[#0c1220] border border-slate-800/80 rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-500/10 text-emerald-400 rounded-lg flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Verified Human Sweeps</div>
                <div className="text-lg font-bold text-slate-100 font-mono">{passedAttempts}</div>
                <div className="text-[9px] text-slate-400">Out of {totalAttempts} total events</div>
              </div>
            </div>

            {/* Stat 3: Dynamic Threshold Security */}
            <div className="bg-[#0c1220] border border-slate-800/80 rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-sky-500/10 text-sky-400 rounded-lg flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Dynamic Risk Shield</div>
                <div className="text-lg font-bold text-sky-400 font-mono">
                  {activeTabSuccess === null ? (
                    'SECURE'
                  ) : activeTabSuccess ? (
                    <span className="text-emerald-400 flex items-center gap-1 text-sm">
                      <Lock className="w-4 h-4" /> COMPLIANT
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1 text-sm">
                      <AlertTriangle className="w-4 h-4" /> RISK HIGH
                    </span>
                  )}
                </div>
                <div className="text-[9px] text-slate-400">
                  {activeScore !== null ? `Evaluation confidence: ${activeScore}%` : 'Awaiting input signature'}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive CAPTCHA Stage Tabs Menu */}
          <div className="bg-[#0c1220] border border-slate-800 rounded-xl overflow-hidden shadow-md">
            {/* Tab buttons */}
            <div className="flex border-b border-slate-800/80 bg-slate-900/40">
              <button
                onClick={() => handleTabChange('behavioral')}
                className={`flex-1 py-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition ${
                  activeTab === 'behavioral'
                    ? 'border-sky-500 text-sky-400 bg-slate-900/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
                }`}
                id="tab-behavioral"
              >
                <MousePointer className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Behavioral</span> Mouse Tracker
              </button>
              <button
                onClick={() => handleTabChange('pattern')}
                className={`flex-1 py-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition ${
                  activeTab === 'pattern'
                    ? 'border-emerald-500 text-emerald-400 bg-slate-900/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
                }`}
                id="tab-pattern"
              >
                <Brain className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Pattern</span> Gesture Neural Net
              </button>
              <button
                onClick={() => handleTabChange('puzzle')}
                className={`flex-1 py-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition ${
                  activeTab === 'puzzle'
                    ? 'border-amber-500 text-amber-400 bg-slate-900/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
                }`}
                id="tab-puzzle"
              >
                <Sliders className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Adaptive</span> Slider Puzzle
              </button>
            </div>

            {/* Active Content Stage */}
            <div className="p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === 'behavioral' && (
                    <BehavioralCaptcha onVerify={handleVerifyResult} sensitivity={sensitivity} />
                  )}
                  {activeTab === 'pattern' && (
                    <PatternCaptcha onVerify={handleVerifyResult} requiredConfidence={requiredConfidence} />
                  )}
                  {activeTab === 'puzzle' && (
                    <PuzzleCaptcha onVerify={handleVerifyResult} difficultyThreshold={alignmentThreshold} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Configuration Parameters Sidebar & Local Audit Logs (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Refinement settings card */}
          <div className="bg-[#0c1220] border border-slate-800 rounded-xl p-5 shadow-md" id="security-threshold-parameters">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4 text-sky-400" />
              Dynamic Security Refinements
            </h3>

            <div className="space-y-4 text-xs">
              {/* Setting 1 */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-slate-400 font-medium">Trajectory Anomaly Jitter (Scale):</label>
                  <span className="font-mono text-sky-400 font-bold">{sensitivity}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={sensitivity}
                  onChange={(e) => setSensitivity(parseInt(e.target.value))}
                  className="w-full accent-sky-500 cursor-ew-resize"
                  id="sensitivity-slider"
                />
                <p className="text-[10px] text-slate-500">
                  Increases anti-macro tracking. Higher values flag linear mathematical vectors and perfect speeds.
                </p>
              </div>

              {/* Setting 2 */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-slate-400 font-medium">Neural Confidence Cutoff:</label>
                  <span className="font-mono text-emerald-400 font-bold">{requiredConfidence}%</span>
                </div>
                <input
                  type="range"
                  min="25"
                  max="95"
                  value={requiredConfidence}
                  onChange={(e) => setRequiredConfidence(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 cursor-ew-resize"
                  id="confidence-slider"
                />
                <p className="text-[10px] text-slate-500">
                  Sets required gesture density target match threshold for MLP shape activation approval.
                </p>
              </div>

              {/* Setting 3 */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-slate-400 font-medium">Slide Jigsaw Pixel Offset:</label>
                  <span className="font-mono text-amber-400 font-bold">{alignmentThreshold} px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={alignmentThreshold}
                  onChange={(e) => setAlignmentThreshold(parseInt(e.target.value))}
                  className="w-full accent-amber-500 cursor-ew-resize"
                  id="threshold-slider"
                />
                <p className="text-[10px] text-slate-500">
                  Defines margin bounds for alignment match before executing trajectory velocity check.
                </p>
              </div>
            </div>
          </div>

          {/* Audit Logs panel */}
          <div className="bg-[#0c1220] border border-slate-800 rounded-xl p-5 shadow-md flex flex-col h-[380px]" id="audit-logstream-panel">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-400" />
                Frontend Audit Logstream
              </h3>
              <button
                onClick={clearLogs}
                id="btn-clear-logs"
                className="text-slate-500 hover:text-slate-300 transition"
                title="Purge transaction logs"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
              {attempts.length > 0 ? (
                attempts.map(attempt => (
                  <div
                    key={attempt.id}
                    className={`p-3 rounded-lg border text-xs font-mono transition-all duration-300 ${
                      attempt.passed
                        ? 'bg-[#0a1f1b]/30 border-emerald-900/40 text-slate-300'
                        : 'bg-[#291017]/30 border-rose-900/40 text-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        attempt.passed ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                      }`}>
                        {attempt.passed ? 'Passed' : 'Blocked'}
                      </span>
                      <span className="text-[9px] text-slate-500">
                        {attempt.timestamp.toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-[11px] leading-relaxed mb-1.5">{attempt.details}</p>

                    <div className="flex justify-between text-[10px] border-t border-slate-800/50 pt-1 text-slate-500">
                      <span>Module: <strong className="text-slate-400">{attempt.type}</strong></span>
                      <span>Bot Index: <strong className={attempt.botProbability > 50 ? 'text-rose-400' : 'text-emerald-400'}>{attempt.botProbability}%</strong></span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center p-4">
                  <FileCode className="w-8 h-8 mb-2 text-slate-700" />
                  <p className="text-xs">No verification events have been logged yet. Complete challenges to record trace audits.</p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-between items-center text-[10px] text-slate-500 font-mono">
              <span>Audits Simulated: {attempts.length}</span>
              <span className="text-sky-400 animate-pulse">● Storage Active</span>
            </div>
          </div>

        </div>
      </main>

      {/* Footer Section */}
      <footer className="border-t border-slate-850 bg-[#070b13] py-4 text-center text-xs text-slate-500 font-mono">
        <p>© 2026 AI CAPTCHA Lab • Secured with Decentralized Edge Neural Networks</p>
      </footer>
    </div>
  );
}
