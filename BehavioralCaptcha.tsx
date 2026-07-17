/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { extractBehavioralMetrics, classifyBehavior, generateBotPath } from '../lib/mlEngine';
import { MousePoint, BehavioralMetrics } from '../types';
import { MousePointer, ShieldCheck, ShieldAlert, Cpu, RefreshCw, Info, HelpCircle } from 'lucide-react';

interface BehavioralCaptchaProps {
  onVerify: (passed: boolean, score: number, details: string) => void;
  sensitivity: number; // threshold multiplier (e.g. 1-100)
}

export const BehavioralCaptcha: React.FC<BehavioralCaptchaProps> = ({ onVerify, sensitivity }) => {
  const [points, setPoints] = useState<MousePoint[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [metrics, setMetrics] = useState<BehavioralMetrics | null>(null);
  const [classification, setClassification] = useState<{
    botProbability: number;
    isBot: boolean;
    reasons: string[];
  } | null>(null);

  const [hasSufficientData, setHasSufficientData] = useState(false);
  const [activeSimulation, setActiveSimulation] = useState<'linear' | 'bezier' | 'jittery' | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Clear tracking board
  const resetBoard = () => {
    setPoints([]);
    setIsRecording(false);
    setMetrics(null);
    setClassification(null);
    setHasSufficientData(false);
    setActiveSimulation(null);

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Draw coordinate points on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (points.length < 2) return;

    // Draw trajectory path
    ctx.beginPath();
    ctx.strokeStyle = classification ? (classification.isBot ? '#ef4444' : '#10b981') : '#3b82f6';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // Highlight start point (Blue)
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();

    // Highlight end point (Green)
    ctx.beginPath();
    ctx.arc(points[points.length - 1].x, points[points.length - 1].y, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#10b981';
    ctx.fill();
  }, [points, classification]);

  // Handle manual tracking mouse coordinates
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeSimulation) return; // Ignore input during simulation
    if (!isRecording) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newPoint: MousePoint = { x, y, t: Date.now() };
    const updatedPoints = [...points, newPoint];
    setPoints(updatedPoints);

    // Dynamic metrics calculation
    if (updatedPoints.length > 5) {
      const derivedMetrics = extractBehavioralMetrics(updatedPoints);
      setMetrics(derivedMetrics);
      const decision = classifyBehavior(derivedMetrics);

      // Apply dynamic threshold/sensitivity adjusting
      const adjustedProb = Math.min(decision.botProbability * (sensitivity / 50), 0.99);
      setClassification({
        ...decision,
        botProbability: adjustedProb,
        isBot: adjustedProb > 0.5,
      });

      if (derivedMetrics.totalDistance > 80) {
        setHasSufficientData(true);
      }
    }
  };

  const startTracking = (e: React.MouseEvent<HTMLDivElement>) => {
    resetBoard();
    setIsRecording(true);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPoints([{ x, y, t: Date.now() }]);
  };

  const stopTracking = () => {
    if (!isRecording) return;
    setIsRecording(false);

    if (points.length > 5 && metrics) {
      const decision = classifyBehavior(metrics);
      const adjustedProb = Math.min(decision.botProbability * (sensitivity / 50), 0.99);
      const finalBotState = adjustedProb > 0.5;

      setClassification({
        ...decision,
        botProbability: adjustedProb,
        isBot: finalBotState,
      });

      onVerify(!finalBotState, Math.round((1 - adjustedProb) * 100), `Behavioral sweep: ${finalBotState ? 'BOT' : 'HUMAN'} (${Math.round((1 - adjustedProb)*100)}% confidence)`);
    }
  };

  // Run a programmatic Bot Path simulation
  const runSimulation = (botType: 'linear' | 'bezier' | 'jittery') => {
    resetBoard();
    setActiveSimulation(botType);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const start = { x: 30, y: canvas.height - 40 };
    const end = { x: canvas.width - 30, y: 40 };

    const simulatedPath = generateBotPath(botType, start, end, botType === 'jittery' ? 400 : 250);

    // Playback simulated path frames incrementally to mimic realistic input events
    let index = 0;
    const interval = setInterval(() => {
      if (index >= simulatedPath.length) {
        clearInterval(interval);
        setActiveSimulation(null);

        // Run final classifier assessment
        const finalMetrics = extractBehavioralMetrics(simulatedPath);
        setMetrics(finalMetrics);
        const decision = classifyBehavior(finalMetrics);

        const adjustedProb = Math.min(decision.botProbability * (sensitivity / 50), 0.99);
        const finalBotState = adjustedProb > 0.5;

        setClassification({
          ...decision,
          botProbability: adjustedProb,
          isBot: finalBotState,
        });
        setHasSufficientData(true);

        onVerify(!finalBotState, Math.round((1 - adjustedProb) * 100), `Simulated ${botType} bot sweep: detected with ${Math.round(adjustedProb * 100)}% accuracy`);
        return;
      }

      setPoints(prev => [...prev, simulatedPath[index]]);
      index++;
    }, 15);
  };

  return (
    <div className="space-y-6" id="behavioral-container">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-2">
          <MousePointer className="w-4 h-4 text-sky-400" />
          Interactive Tracking Grid
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Click and hold to draw a natural path from the <span className="text-sky-400 font-semibold">Blue Start</span> to any direction, or click a Bot simulation button below to test the AI detection model.
        </p>

        {/* Canvas Board */}
        <div
          ref={containerRef}
          id="tracking-grid-board"
          className="relative h-60 bg-slate-950 rounded-lg border border-slate-800 cursor-crosshair overflow-hidden group shadow-inner"
          onMouseDown={startTracking}
          onMouseMove={handleMouseMove}
          onMouseUp={stopTracking}
          onMouseLeave={stopTracking}
        >
          {/* Subtle grid pattern background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] opacity-25"></div>

          <canvas
            ref={canvasRef}
            width={480}
            height={240}
            className="absolute inset-0 w-full h-full"
          />

          {!isRecording && points.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-500">
              <MousePointer className="w-8 h-8 mb-2 animate-bounce text-slate-600" />
              <p className="text-xs font-mono">DRAG MOUSE OR RUN BOT SIMULATION</p>
            </div>
          )}

          {isRecording && (
            <div className="absolute top-3 right-3 bg-red-500/20 border border-red-500/40 px-2 py-1 rounded text-[10px] text-red-400 font-mono animate-pulse flex items-center gap-1.5">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              RECORDING COORDINATES...
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-2 mt-4 items-center justify-between">
          <button
            onClick={resetBoard}
            id="btn-reset-board"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition flex items-center gap-1.5 font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Clear
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => runSimulation('linear')}
              disabled={isRecording || !!activeSimulation}
              className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-950/80 border border-rose-900/50 text-rose-300 rounded text-xs transition font-mono"
            >
              Simulate Linear Bot
            </button>
            <button
              onClick={() => runSimulation('bezier')}
              disabled={isRecording || !!activeSimulation}
              className="px-2.5 py-1.5 bg-amber-950/40 hover:bg-amber-950/80 border border-amber-900/50 text-amber-300 rounded text-xs transition font-mono"
            >
              Simulate Spline Bot
            </button>
            <button
              onClick={() => runSimulation('jittery')}
              disabled={isRecording || !!activeSimulation}
              className="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-950/80 border border-red-900/50 text-red-300 rounded text-xs transition font-mono"
            >
              Simulate Jittery Bot
            </button>
          </div>
        </div>
      </div>

      {/* Feature Vector Dashboard & ML Prediction Output */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Realtime ML Metrics */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5" id="feature-vectors-panel">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-emerald-400" />
            Extracted Feature Vectors
          </h4>

          {metrics ? (
            <div className="space-y-2 text-xs font-mono text-slate-300">
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-500">Total Distance:</span>
                <span>{metrics.totalDistance.toFixed(1)} px</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-500 flex items-center gap-1">
                  Straightness Index
                  <span className="group relative cursor-help text-slate-600">
                    <HelpCircle className="w-3 h-3" />
                    <span className="absolute bottom-4 left-1/2 -translate-x-1/2 hidden group-hover:block w-48 bg-slate-950 border border-slate-800 text-[10px] text-slate-400 p-2 rounded shadow-xl z-20 font-sans">
                      Straight displacement divided by actual path length. Perfect lines yield 1.0.
                    </span>
                  </span>
                </span>
                <span className={metrics.straightnessRatio > 0.98 ? 'text-red-400 font-semibold' : 'text-slate-300'}>
                  {metrics.straightnessRatio.toFixed(3)}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-500">Average Velocity:</span>
                <span>{metrics.averageVelocity.toFixed(1)} px/s</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-500">Movement Tremor (Jitter):</span>
                <span className={metrics.jitteriness < 0.05 ? 'text-red-400' : 'text-slate-300'}>
                  {metrics.jitteriness.toFixed(3)}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-500">Interaction Time:</span>
                <span>{(metrics.totalTime * 1000).toFixed(0)} ms</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-slate-500">Abrupt Angle Shifts:</span>
                <span>{metrics.directionChanges}</span>
              </div>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center border border-dashed border-slate-800 rounded bg-slate-950 text-slate-500 text-center p-4">
              <p className="text-xs">Draw a curve above or launch simulations to populate real-time behavioral features.</p>
            </div>
          )}
        </div>

        {/* Security Classification Prediction */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between" id="ml-classification-panel">
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              Classifier Decision Matrix
            </h4>

            {classification && hasSufficientData ? (
              <div className="space-y-4">
                {/* Result Indicator Badge */}
                <div className={`p-3 rounded-lg border flex items-center gap-3 ${
                  classification.isBot
                    ? 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                    : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                }`}>
                  {classification.isBot ? (
                    <ShieldAlert className="w-8 h-8 text-rose-500 shrink-0" />
                  ) : (
                    <ShieldCheck className="w-8 h-8 text-emerald-500 shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide">
                      {classification.isBot ? 'Bot Threat Detected' : 'Verified Human Pattern'}
                    </div>
                    <div className="text-[11px] opacity-80">
                      Bot Probability Score: {(classification.botProbability * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Heuristic/Anomaly Reasons list */}
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Detection Logs:</div>
                  <ul className="text-[11px] font-mono list-disc pl-4 space-y-1 text-slate-400">
                    {classification.reasons.map((r, idx) => (
                      <li key={idx} className={classification.isBot ? 'text-rose-400/90' : 'text-emerald-400/90'}>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center border border-dashed border-slate-800 rounded bg-slate-950 text-slate-500 text-center p-4">
                <p className="text-xs">Draw a complete stroke to calculate bot versus human probabilities.</p>
              </div>
            )}
          </div>

          {/* Quick Informational footer */}
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-1.5 text-[10px] text-slate-400">
            <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>Unlike older static text-entry systems, modern behavioral CAPTCHAs calculate natural motor speed variances and path angles completely locally.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
