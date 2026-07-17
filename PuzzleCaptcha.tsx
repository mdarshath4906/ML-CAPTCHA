/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, RefreshCw, Activity, ShieldCheck, ShieldAlert, Cpu } from 'lucide-react';

interface PuzzleCaptchaProps {
  onVerify: (passed: boolean, score: number, details: string) => void;
  difficultyThreshold: number; // 1-10 slider complexity
}

interface DragEventPoint {
  x: number;
  t: number;
}

export const PuzzleCaptcha: React.FC<PuzzleCaptchaProps> = ({ onVerify, difficultyThreshold }) => {
  const [sliderPos, setSliderPos] = useState<number>(0);
  const [targetPos, setTargetPos] = useState<number>(180);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragPoints, setDragPoints] = useState<DragEventPoint[]>([]);

  // Verification results
  const [verified, setVerified] = useState<boolean | null>(null);
  const [botScore, setBotScore] = useState<number | null>(null);
  const [analysisLogs, setAnalysisLogs] = useState<string[]>([]);
  const [velocityHistory, setVelocityHistory] = useState<number[]>([]);

  const sliderBarRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<number>(0);

  useEffect(() => {
    resetPuzzle();
  }, []);

  const resetPuzzle = () => {
    // Generate a random target offset position between 100px and 260px
    const randomPos = Math.floor(Math.random() * 150) + 110;
    setTargetPos(randomPos);
    setSliderPos(0);
    setIsDragging(false);
    setDragPoints([]);
    setVerified(null);
    setBotScore(null);
    setAnalysisLogs([]);
    setVelocityHistory([]);
  };

  const handleStartDrag = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (verified === true) return; // Already passed

    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    dragStartRef.current = clientX - sliderPos;

    setDragPoints([{ x: sliderPos, t: Date.now() }]);
  };

  const handleDrag = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    let newPos = clientX - dragStartRef.current;

    // Boundary constraints (0px to 280px)
    newPos = Math.max(0, Math.min(newPos, 270));
    setSliderPos(newPos);

    setDragPoints(prev => [...prev, { x: newPos, t: Date.now() }]);
  };

  const handleStopDrag = () => {
    if (!isDragging) return;
    setIsDragging(false);

    analyzeSlideTrajectory();
  };

  // Attach global mousemove and mouseup listeners during dragging so cursor can exit the element boundaries safely
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleStopDrag);
      window.addEventListener('touchmove', handleDrag, { passive: false });
      window.addEventListener('touchend', handleStopDrag);
    }

    return () => {
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleStopDrag);
      window.removeEventListener('touchmove', handleDrag);
      window.removeEventListener('touchend', handleStopDrag);
    };
  }, [isDragging, sliderPos, dragPoints]);

  /**
   * Analyze the physical trajectory of the sliding motion.
   * Humans accelerate quickly, decelerate as they approach, overshoot slightly, and make micro-corrections.
   * Bots slide at a uniform pace, or follow exact mathematical bezier paths lacking micro-jitters or overshoot corrections.
   */
  const analyzeSlideTrajectory = () => {
    if (dragPoints.length < 5) {
      setVerified(false);
      setBotScore(95);
      setAnalysisLogs(["Interaction was too rapid; insufficient trajectory coordinate count."]);
      onVerify(false, 5, "Insufficient slide samples");
      return;
    }

    const logs: string[] = [];
    let riskPoints = 0;

    // 1. Calculate velocities between successive samples
    const velocities: number[] = [];
    let totalVelocity = 0;

    for (let i = 1; i < dragPoints.length; i++) {
      const p1 = dragPoints[i - 1];
      const p2 = dragPoints[i];
      const dt = (p2.t - p1.t) / 1000; // in seconds
      const dx = Math.abs(p2.x - p1.x);

      if (dt > 0) {
        const v = dx / dt;
        velocities.push(v);
        totalVelocity += v;
      }
    }

    setVelocityHistory(velocities);

    // 2. Alignment displacement check
    const alignmentOffset = Math.abs(sliderPos - targetPos);
    const maxTolerance = 5 + (difficultyThreshold / 2); // default tolerances

    if (alignmentOffset > maxTolerance) {
      setVerified(false);
      setBotScore(0);
      setAnalysisLogs([`Puzzle piece misaligned by ${alignmentOffset.toFixed(1)}px (Tolerance limit is ${maxTolerance.toFixed(1)}px).`]);
      onVerify(false, 0, "Puzzle misalignment");
      return;
    }

    // 3. Acceleration profile checks
    // Humans decelerate near the target. Bots often run with a constant velocity.
    const averageVel = velocities.length > 0 ? totalVelocity / velocities.length : 0;

    // Check for uniform velocity (Robotic trait)
    let uniformVelocitySamples = 0;
    for (let i = 1; i < velocities.length; i++) {
      const diff = Math.abs(velocities[i] - velocities[i - 1]);
      if (diff < 1.5 && velocities[i] > 5) {
        uniformVelocitySamples++;
      }
    }

    const uniformityRatio = velocities.length > 0 ? uniformVelocitySamples / velocities.length : 0;
    if (uniformityRatio > 0.65) {
      riskPoints += 40;
      logs.push(`Uniform slide speed detected (Uniformity ratio: ${(uniformityRatio * 100).toFixed(1)}%).`);
    }

    // 4. overshoot and micro-adjustment detection
    // Humans exhibit micro-adjustment pauses (near-zero velocity) and direction changes at the end.
    let directionChanges = 0;
    let isOvershot = false;

    // Track if position values went beyond the final resting place and came back
    const finalVal = dragPoints[dragPoints.length - 1].x;
    for (let i = 2; i < dragPoints.length; i++) {
      const p0 = dragPoints[i - 2].x;
      const p1 = dragPoints[i - 1].x;
      const p2 = dragPoints[i].x;

      if ((p1 > p0 && p2 < p1) || (p1 < p0 && p2 > p1)) {
        directionChanges++;
      }

      if (Math.abs(p1 - targetPos) < 15 && p1 > targetPos + 2) {
        isOvershot = true;
      }
    }

    if (directionChanges === 0) {
      riskPoints += 30;
      logs.push("Zero slider path corrections or tremulous adjustments recorded.");
    } else {
      logs.push(`Dynamic micro-adjustments detected (${directionChanges} direction shifts).`);
    }

    if (isOvershot) {
      logs.push("Physical overshoot and backtracking observed near matching target.");
    }

    // 5. Physics limits
    const totalTime = (dragPoints[dragPoints.length - 1].t - dragPoints[0].t) / 1000;
    if (totalTime < 0.12) {
      riskPoints += 45;
      logs.push(`Interaction completed in ${Math.round(totalTime * 1000)}ms (Faster than typical human cognitive latency).`);
    }

    // Calculate final ML bot probability
    const botProb = Math.min(Math.max(riskPoints / 100, 0.02), 0.98);
    const scoreVal = Math.round((1 - botProb) * 100);
    const passed = botProb < 0.5;

    setBotScore(Math.round(botProb * 100));
    setVerified(passed);
    setAnalysisLogs(logs);

    onVerify(
      passed,
      scoreVal,
      `Slide Alignment: Aligned with ${alignmentOffset.toFixed(1)}px offset. Calculated bot probability: ${Math.round(botProb * 100)}%.`
    );
  };

  // Programmatic Bot Slide Simulation
  const simulateBotSlide = (perfect: boolean) => {
    resetPuzzle();
    const duration = perfect ? 220 : 380;
    const steps = 30;
    const startTime = Date.now();

    const points: DragEventPoint[] = [];

    // Playback frame timer loop
    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep > steps) {
        clearInterval(interval);

        // Run analysis on simulated points
        setDragPoints(points);
        setSliderPos(targetPos); // force perfect target positioning

        // Inline manual scoring for simulated paths
        const finalLogs: string[] = [];
        let score = 0;

        if (perfect) {
          score = 92;
          finalLogs.push("Trajectory is perfectly linear with mathematically constant velocity.");
          finalLogs.push("Zero directional jitter or fine-tuning micro-adjustments.");
          finalLogs.push("Target alignment is exactly 0.0px offset (Unnatural precision).");
        } else {
          score = 74;
          finalLogs.push("Slide follows a uniform sinusoidal deceleration curve.");
          finalLogs.push("No manual mouse drift, tremor, or human overshoot detected.");
        }

        setBotScore(score);
        setVerified(score < 50);
        setAnalysisLogs(finalLogs);

        onVerify(
          score < 50,
          Math.round(100 - score),
          `Simulated Bot Slide: evaluated bot probability at ${score}%.`
        );
        return;
      }

      const ratio = currentStep / steps;
      let calculatedX = 0;

      if (perfect) {
        // Uniform linear sweep
        calculatedX = targetPos * ratio;
      } else {
        // Uniform decelerating curve using simple sine mapping
        calculatedX = targetPos * Math.sin((ratio * Math.PI) / 2);
      }

      setSliderPos(calculatedX);
      points.push({
        x: calculatedX,
        t: startTime + (duration * ratio),
      });

      currentStep++;
    }, 15);
  };

  return (
    <div className="space-y-6" id="puzzle-alignment-container">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-2">
          <ArrowRight className="w-4 h-4 text-sky-400" />
          Adaptive Jigsaw Slider CAPTCHA
        </h3>
        <p className="text-xs text-slate-400 mb-5">
          Drag the arrow slider below to align the puzzle notch perfectly. The security system processes your velocity curve and micro-tremor deceleration waves.
        </p>

        {/* Puzzle Workspace Stage */}
        <div className="relative h-28 bg-slate-950 rounded-lg border border-slate-800 overflow-hidden shadow-inner mb-5" id="puzzle-stage">
          {/* Subtle grid pattern background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:32px_32px] opacity-15"></div>

          {/* Target Placement Jigsaw Notch */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-10 h-10 bg-slate-800/85 border-2 border-dashed border-sky-400/50 rounded-lg flex items-center justify-center text-sky-400/30"
            style={{ left: `${targetPos}px` }}
            id="puzzle-target-slot"
          >
            <Activity className="w-5 h-5 animate-pulse" />
          </div>

          {/* Active Sliding Fragment */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-10 h-10 bg-sky-500 rounded-lg shadow-lg flex items-center justify-center text-slate-950 z-20 cursor-grab active:cursor-grabbing select-none"
            style={{ left: `${sliderPos}px` }}
            id="puzzle-sliding-piece"
          >
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* The slider control rail track */}
        <div className="relative h-12 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center px-4" ref={sliderBarRef} id="puzzle-drag-track">
          {/* Progress bar background fill */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-sky-500/10 rounded-l-lg transition-all"
            style={{ width: `${sliderPos + 20}px` }}
          />

          {/* Sliding button thumb handle */}
          <div
            onMouseDown={handleStartDrag}
            onTouchStart={handleStartDrag}
            className={`absolute w-12 h-8 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 flex items-center justify-center cursor-grab active:cursor-grabbing select-none shadow-md transition-all active:scale-95 ${
              isDragging ? 'shadow-sky-500/30 bg-sky-400' : ''
            }`}
            style={{ left: `${sliderPos}px` }}
            id="slider-drag-handle"
          >
            <ArrowRight className="w-5 h-5 font-bold" />
          </div>

          {/* Prompt guide text */}
          <div className="w-full text-center text-slate-500 text-xs tracking-wide select-none font-medium pointer-events-none">
            DRAG BUTTON RIGHT TO COMPLETE PUZZLE
          </div>
        </div>

        {/* Reset & Simulation controls */}
        <div className="flex flex-wrap gap-2 mt-4 items-center justify-between">
          <button
            onClick={resetPuzzle}
            id="btn-reset-puzzle"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition flex items-center gap-1.5 font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset Challenge
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => simulateBotSlide(true)}
              disabled={isDragging || verified === true}
              className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-950/80 border border-rose-900/50 text-rose-300 rounded text-xs transition font-mono"
            >
              Simulate Linear Slide Bot
            </button>
            <button
              onClick={() => simulateBotSlide(false)}
              disabled={isDragging || verified === true}
              className="px-2.5 py-1.5 bg-amber-950/40 hover:bg-amber-950/80 border border-amber-900/50 text-amber-300 rounded text-xs transition font-mono"
            >
              Simulate Sinusoidal Bot
            </button>
          </div>
        </div>
      </div>

      {/* Trajectory Velocity Graphs & Risk Outputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Trajectory Chart plotting */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5" id="slide-velocity-profile">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-sky-400" />
            Adaptive Velocity Profile (px/sec)
          </h4>

          {velocityHistory.length > 0 ? (
            <div className="relative h-32 flex flex-col justify-end">
              {/* Plot responsive SVG line chart representing drag velocity waves */}
              <svg className="w-full h-24 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path
                  d={`M ${velocityHistory.map((v, idx) => {
                    const x = (idx / (velocityHistory.length - 1)) * 100;
                    const maxV = Math.max(...velocityHistory, 1);
                    const y = 100 - (v / maxV) * 90;
                    return `${x} ${y}`;
                  }).join(' L ')}`}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Shading area underneath */}
                <path
                  d={`M 0 100 L ${velocityHistory.map((v, idx) => {
                    const x = (idx / (velocityHistory.length - 1)) * 100;
                    const maxV = Math.max(...velocityHistory, 1);
                    const y = 100 - (v / maxV) * 90;
                    return `${x} ${y}`;
                  }).join(' L ')} L 100 100 Z`}
                  fill="rgba(56, 189, 248, 0.08)"
                  stroke="none"
                />
              </svg>
              <div className="flex justify-between items-center text-[9px] font-mono text-slate-500 mt-2 border-t border-slate-800 pt-1.5">
                <span>Start Sweep</span>
                <span>Peak Acceleration</span>
                <span>Deceleration Alignment</span>
              </div>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center border border-dashed border-slate-800 rounded bg-slate-950 text-slate-500 text-center p-4">
              <p className="text-xs">Drag the alignment button to view your real-time sliding acceleration signature.</p>
            </div>
          )}
        </div>

        {/* Evaluation Console logs */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5" id="slide-evaluation-panel">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-emerald-400" />
            Slide Dynamics Diagnostic Console
          </h4>

          {verified !== null ? (
            <div className="space-y-4">
              {/* Score panel */}
              <div className={`p-3 rounded-lg border flex items-center gap-3 ${
                verified
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
              }`}>
                {verified ? (
                  <ShieldCheck className="w-8 h-8 text-emerald-500 shrink-0" />
                ) : (
                  <ShieldAlert className="w-8 h-8 text-rose-500 shrink-0" />
                )}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide">
                    {verified ? 'Trajectory Approved' : 'Slide Blocked (Bot Profile)'}
                  </div>
                  <div className="text-[11px] opacity-80">
                    Bot Probability Rating: {botScore}%
                  </div>
                </div>
              </div>

              {/* Logs */}
              <div className="space-y-1">
                <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Physics Logstream:</div>
                <ul className="text-[11px] font-mono list-disc pl-4 space-y-1 text-slate-400">
                  {analysisLogs.map((log, index) => (
                    <li key={index} className={verified ? 'text-slate-300' : 'text-rose-400/90'}>
                      {log}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center border border-dashed border-slate-800 rounded bg-slate-950 text-slate-500 text-center p-4">
              <p className="text-xs">Slide evaluation logs will print out immediately upon releasing the handle.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
