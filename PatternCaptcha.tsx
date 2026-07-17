/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { ShapeNeuralNetwork, normalizeDrawingToGrid } from '../lib/mlEngine';
import { Pencil, RefreshCw, Layers, Brain, CheckCircle2, AlertCircle, Info, Flame } from 'lucide-react';

interface PatternCaptchaProps {
  onVerify: (passed: boolean, score: number, details: string) => void;
  requiredConfidence: number; // minimum confidence required (e.g. 50%)
}

export const PatternCaptcha: React.FC<PatternCaptchaProps> = ({ onVerify, requiredConfidence }) => {
  const [targetShape, setTargetShape] = useState<string>('circle');
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [gridData, setGridData] = useState<number[]>(new Array(64).fill(0));

  // Network prediction states
  const [predictions, setPredictions] = useState<{ label: string; confidence: number }[]>([]);
  const [predictionDetail, setPredictionDetail] = useState<{
    outputs: number[];
    hidden: number[];
  } | null>(null);

  // Training state lab
  const [trainClass, setTrainClass] = useState<string>('circle');
  const [epochCount, setEpochCount] = useState<number>(0);
  const [latestLoss, setLatestLoss] = useState<number | null>(null);
  const [isTrainingBatch, setIsTrainingBatch] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nnInstanceRef = useRef<ShapeNeuralNetwork | null>(null);

  // Initialize ShapeNeuralNetwork instance once
  if (!nnInstanceRef.current) {
    nnInstanceRef.current = new ShapeNeuralNetwork();
  }

  // Set random shape prompt on mount/reset
  useEffect(() => {
    pickRandomTarget();
  }, []);

  const pickRandomTarget = () => {
    const shapes = ['circle', 'triangle', 'square', 'line'];
    const choice = shapes[Math.floor(Math.random() * shapes.length)];
    setTargetShape(choice);
    clearCanvas();
  };

  const clearCanvas = () => {
    setPoints([]);
    setGridData(new Array(64).fill(0));
    setPredictions([]);
    setPredictionDetail(null);

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  // Redraw path coordinates
  const handleStartDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setPoints([{ x, y }]);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(x, y);
    }
  };

  const handleDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setPoints(prev => [...prev, { x, y }]);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const handleStopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (points.length < 5) return;

    // 1. Map continuous stroke to normalized 8x8 ML density input grid
    const grid = normalizeDrawingToGrid(points);
    setGridData(grid);

    // 2. Perform feedforward prediction
    if (nnInstanceRef.current) {
      const { outputs, hidden } = nnInstanceRef.current.forward(grid);

      // Map output arrays to target labels
      const results = nnInstanceRef.current.classes.map((cls, idx) => ({
        label: cls,
        confidence: outputs[idx],
      })).sort((a, b) => b.confidence - a.confidence);

      setPredictions(results);
      setPredictionDetail({ outputs, hidden });

      // 3. Verify match against CAPTCHA goal
      const topPred = results[0];
      const targetPassed = topPred.label === targetShape && (topPred.confidence * 100) >= requiredConfidence;

      onVerify(
        targetPassed,
        Math.round(topPred.confidence * 100),
        `Pattern Classifier: Classified drawn shape as ${topPred.label.toUpperCase()} (${Math.round(topPred.confidence * 100)}% conf). Expected: ${targetShape.toUpperCase()}.`
      );
    }
  };

  // Live Backpropagation Training step in the browser
  const handleTrainStep = () => {
    if (points.length < 5) return;
    const grid = normalizeDrawingToGrid(points);

    if (nnInstanceRef.current) {
      const loss = nnInstanceRef.current.train(grid, trainClass, 0.2);
      setLatestLoss(loss);
      setEpochCount(prev => prev + 1);

      // Re-evaluate current drawing after weight modification
      const { outputs, hidden } = nnInstanceRef.current.forward(grid);
      const results = nnInstanceRef.current.classes.map((cls, idx) => ({
        label: cls,
        confidence: outputs[idx],
      })).sort((a, b) => b.confidence - a.confidence);

      setPredictions(results);
      setPredictionDetail({ outputs, hidden });
    }
  };

  // Run bulk backpropagation epoch simulation
  const handleBatchTrainSelf = () => {
    if (isTrainingBatch) return;
    setIsTrainingBatch(true);

    if (!nnInstanceRef.current) return;
    const nn = nnInstanceRef.current;

    // Generate simulated coordinates for quick batch learning
    const simulatedDataset: { grid: number[]; label: string }[] = [];

    // Circle generator
    for (let i = 0; i < 15; i++) {
      const pts: { x: number; y: number }[] = [];
      const steps = 16;
      const rx = 80 + Math.random() * 10;
      const ry = rx;
      const cx = 100;
      const cy = 100;
      for (let s = 0; s <= steps; s++) {
        const theta = (s / steps) * 2 * Math.PI;
        pts.push({
          x: cx + rx * Math.cos(theta) + (Math.random() * 8 - 4),
          y: cy + ry * Math.sin(theta) + (Math.random() * 8 - 4),
        });
      }
      simulatedDataset.push({ grid: normalizeDrawingToGrid(pts), label: 'circle' });
    }

    // Triangle generator
    for (let i = 0; i < 15; i++) {
      const pts: { x: number; y: number }[] = [];
      // Top vertex, bottom-right vertex, bottom-left vertex, closing top
      const top = { x: 100 + (Math.random()*10-5), y: 40 + (Math.random()*6-3) };
      const br = { x: 160 + (Math.random()*10-5), y: 160 + (Math.random()*6-3) };
      const bl = { x: 40 + (Math.random()*10-5), y: 160 + (Math.random()*6-3) };

      // Interpolate lines
      for (let s = 0; s < 8; s++) {
        const r = s / 8;
        pts.push({ x: top.x + (br.x - top.x) * r, y: top.y + (br.y - top.y) * r });
      }
      for (let s = 0; s < 8; s++) {
        const r = s / 8;
        pts.push({ x: br.x + (bl.x - br.x) * r, y: br.y + (bl.y - br.y) * r });
      }
      for (let s = 0; s < 8; s++) {
        const r = s / 8;
        pts.push({ x: bl.x + (top.x - bl.x) * r, y: bl.y + (top.y - bl.y) * r });
      }
      simulatedDataset.push({ grid: normalizeDrawingToGrid(pts), label: 'triangle' });
    }

    // Square generator
    for (let i = 0; i < 15; i++) {
      const pts: { x: number; y: number }[] = [];
      const left = 40 + Math.random() * 10;
      const right = 160 - Math.random() * 10;
      const top = 40 + Math.random() * 10;
      const bottom = 160 - Math.random() * 10;

      for (let s = 0; s < 6; s++) {
        const r = s/6;
        pts.push({ x: left + (right-left)*r, y: top });
        pts.push({ x: right, y: top + (bottom-top)*r });
        pts.push({ x: right + (left-right)*r, y: bottom });
        pts.push({ x: left, y: bottom + (top-bottom)*r });
      }
      simulatedDataset.push({ grid: normalizeDrawingToGrid(pts), label: 'square' });
    }

    // Line generator
    for (let i = 0; i < 15; i++) {
      const pts: { x: number; y: number }[] = [];
      const x1 = 30 + Math.random()*20;
      const y1 = 100 + Math.random()*20 - 10;
      const x2 = 170 - Math.random()*20;
      const y2 = 100 + Math.random()*20 - 10;
      for (let s = 0; s < 12; s++) {
        const r = s / 12;
        pts.push({ x: x1 + (x2 - x1) * r, y: y1 + (y2 - y1) * r });
      }
      simulatedDataset.push({ grid: normalizeDrawingToGrid(pts), label: 'line' });
    }

    // Iterate train epochs asynchronously to animate progress
    let e = 0;
    const interval = setInterval(() => {
      let epochLossSum = 0;
      // Shuffle training batch samples
      const shuffled = [...simulatedDataset].sort(() => Math.random() - 0.5);
      shuffled.forEach(sample => {
        const l = nn.train(sample.grid, sample.label, 0.1);
        epochLossSum += l;
      });

      setLatestLoss(epochLossSum / shuffled.length);
      setEpochCount(prev => prev + 1);
      e++;

      if (e >= 35) {
        clearInterval(interval);
        setIsTrainingBatch(false);

        // Re-evaluate on current grid if applicable
        if (points.length >= 5) {
          const grid = normalizeDrawingToGrid(points);
          const { outputs, hidden } = nn.forward(grid);
          const results = nn.classes.map((cls, idx) => ({
            label: cls,
            confidence: outputs[idx],
          })).sort((a, b) => b.confidence - a.confidence);
          setPredictions(results);
          setPredictionDetail({ outputs, hidden });
        }
      }
    }, 40);
  };

  return (
    <div className="space-y-6" id="pattern-neuralnet-container">
      {/* CAPTCHA instructions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Pencil className="w-4 h-4 text-emerald-400" />
            Shape Matching Challenge
          </h3>
          <div className="bg-emerald-950 border border-emerald-900/50 text-emerald-400 font-mono text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-widest animate-pulse">
            DRAW TARGET: {targetShape}
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          Please sketch a <span className="text-emerald-400 font-bold uppercase">{targetShape}</span> on the pad below. A local Multilayer Perceptron neural network will process the pixel vectors instantly to authorize your profile.
        </p>

        {/* Board workspace & outputs side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Sketch board */}
          <div className="md:col-span-5 flex flex-col items-center">
            <div className="relative border border-slate-800 rounded-lg bg-slate-950 overflow-hidden w-[200px] h-[200px]">
              <canvas
                ref={canvasRef}
                width={200}
                height={200}
                onMouseDown={handleStartDrawing}
                onMouseMove={handleDrawing}
                onMouseUp={handleStopDrawing}
                onMouseLeave={handleStopDrawing}
                className="cursor-pencil relative z-10"
                id="drawing-paint-canvas"
              />

              {points.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 pointer-events-none select-none">
                  <Pencil className="w-6 h-6 mb-1 text-slate-700 animate-pulse" />
                  <span className="text-[9px] font-mono tracking-widest">DRAW HERE</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 w-[200px] mt-2.5">
              <button
                onClick={clearCanvas}
                className="flex-1 py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-mono transition flex items-center justify-center gap-1.5"
                id="clear-pattern-canvas"
              >
                <RefreshCw className="w-3 h-3" /> Clear Pad
              </button>
              <button
                onClick={pickRandomTarget}
                className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-mono transition"
                id="skip-pattern"
              >
                Skip Shape
              </button>
            </div>
          </div>

          {/* Model outputs bars */}
          <div className="md:col-span-7 flex flex-col justify-between" id="nn-probability-bars">
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Neural Net Probabilities</h4>

              <div className="space-y-2">
                {['circle', 'triangle', 'square', 'line'].map(shape => {
                  const matchingPred = predictions.find(p => p.label === shape);
                  const score = matchingPred ? matchingPred.confidence : 0.0;
                  const percent = Math.round(score * 100);

                  const isMatchPrompt = shape === targetShape;

                  return (
                    <div key={shape} className="space-y-1">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className={`capitalize flex items-center gap-1.5 ${isMatchPrompt ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                          {shape}
                          {isMatchPrompt && <span className="text-[9px] bg-emerald-950 text-emerald-500 px-1 rounded uppercase">TARGET</span>}
                        </span>
                        <span className="text-slate-300">{percent}%</span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isMatchPrompt
                              ? (percent >= requiredConfidence ? 'bg-emerald-500' : 'bg-emerald-600/50')
                              : 'bg-sky-500/30'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Validation State Feedback */}
            {predictions.length > 0 && (
              <div className={`mt-4 p-2.5 rounded border text-xs flex items-start gap-2 ${
                predictions[0].label === targetShape && (predictions[0].confidence * 100) >= requiredConfidence
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-950/20 border-amber-500/30 text-amber-400'
              }`}>
                {predictions[0].label === targetShape && (predictions[0].confidence * 100) >= requiredConfidence ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold">Verification Passed!</p>
                      <p className="text-[10px] opacity-80">
                        Top prediction matches prompt shape with sufficient neural threshold confidence.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold">Awaiting Target Shape Match...</p>
                      <p className="text-[10px] opacity-80">
                        Make sure to draw a complete {targetShape}. Drawn shape is rated as: {predictions[0].label} ({Math.round(predictions[0].confidence * 100)}%).
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Neural Weight Visualizer & Backpropagation Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* MLP Network Visualizer Diagram */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5" id="mlp-diagram-panel">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-sky-400" />
            Local Multilayer Perceptron Node Activation Diagram
          </h4>

          {/* Graphical diagram representing Neural Connections */}
          <div className="relative h-44 bg-slate-950 rounded border border-slate-800 overflow-hidden flex items-center justify-between px-6 py-2">
            {/* Layers columns */}
            {/* Column 1: Input Grid Node Sample (8x8) */}
            <div className="flex flex-col items-center">
              <div className="text-[9px] text-slate-500 uppercase font-mono mb-1.5">Input grid (64)</div>
              <div className="grid grid-cols-8 gap-0.5 border border-slate-800 bg-slate-900 p-1 rounded">
                {gridData.map((val, idx) => (
                  <div
                    key={idx}
                    className="w-2.5 h-2.5 rounded-sm transition-colors duration-200"
                    style={{
                      backgroundColor: val > 0 ? `rgba(96, 165, 250, ${val})` : '#0f172a',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Neural weights connectors lines drawn with dynamic opacity SVGs */}
            <div className="absolute inset-0 pointer-events-none opacity-20">
              <svg className="w-full h-full">
                {/* We simulate random node lines connecting Input to Hidden to Output */}
                {[...Array(6)].map((_, i) => (
                  <line
                    key={`ih-${i}`}
                    x1="22%"
                    y1={`${20 + i * 12}%`}
                    x2="50%"
                    y2={`${10 + ((i * 3) % 8) * 11}%`}
                    stroke={i % 2 === 0 ? '#60a5fa' : '#34d399'}
                    strokeWidth={1}
                  />
                ))}
                {[...Array(6)].map((_, i) => (
                  <line
                    key={`ho-${i}`}
                    x1="50%"
                    y1={`${10 + i * 14}%`}
                    x2="78%"
                    y2={`${25 + (i % 4) * 16}%`}
                    stroke={i % 2 === 0 ? '#34d399' : '#f43f5e'}
                    strokeWidth={1}
                  />
                ))}
              </svg>
            </div>

            {/* Column 2: Hidden layer neurons list (16 represented by nodes) */}
            <div className="flex flex-col items-center relative z-10">
              <div className="text-[9px] text-slate-500 uppercase font-mono mb-1.5">Hidden layer (16)</div>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-900/60 p-2 rounded border border-slate-850">
                {Array.from({ length: 16 }).map((_, idx) => {
                  const activation = predictionDetail ? predictionDetail.hidden[idx] : 0.0;
                  return (
                    <div
                      key={idx}
                      className="w-3 h-3 rounded-full border border-slate-800"
                      style={{
                        backgroundColor: activation > 0 ? `rgba(52, 211, 153, ${activation})` : '#020617',
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Column 3: Output layer neurons representing Circle, Triangle, Square, Line */}
            <div className="flex flex-col items-center relative z-10">
              <div className="text-[9px] text-slate-500 uppercase font-mono mb-1.5">Outputs (4)</div>
              <div className="space-y-2 bg-slate-900/60 p-2.5 rounded border border-slate-850">
                {['circle', 'triangle', 'square', 'line'].map((shape, idx) => {
                  const conf = predictionDetail ? predictionDetail.outputs[idx] : 0.0;
                  return (
                    <div key={shape} className="flex items-center gap-1.5">
                      <div
                        className="w-3.5 h-3.5 rounded border border-slate-700 transition-all duration-300"
                        style={{
                          backgroundColor: conf > 0.4 ? 'rgba(239, 68, 68, 0.9)' : `rgba(239, 68, 68, ${conf})`,
                        }}
                      />
                      <span className="text-[9px] font-mono text-slate-400 capitalize">{shape.substring(0,3)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Neural Network Training Playground */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5" id="training-playground-panel">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Brain className="w-4 h-4 text-amber-400" />
            Browser Training Lab (Edge AI)
          </h4>
          <p className="text-[10px] text-slate-400 mb-3">
            Train the MLP weights in real-time. Draw a shape on the pad above, assign its ground truth target label, and run standard backpropagation inside your browser.
          </p>

          <div className="space-y-3">
            {/* Label class selector */}
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-bold text-slate-400 block pt-1 font-mono">Ground Truth Label:</label>
              <select
                value={trainClass}
                onChange={(e) => setTrainClass(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 font-mono"
                id="train-label-selector"
              >
                <option value="circle">Circle</option>
                <option value="triangle">Triangle</option>
                <option value="square">Square</option>
                <option value="line">Line</option>
              </select>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleTrainStep}
                disabled={points.length < 5 || isTrainingBatch}
                className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:hover:bg-amber-600 text-slate-900 font-bold font-mono rounded text-xs transition"
                id="btn-single-train-step"
              >
                Backprop (1 step)
              </button>

              <button
                onClick={handleBatchTrainSelf}
                disabled={isTrainingBatch}
                className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold font-mono rounded text-xs transition flex items-center gap-1"
                id="btn-batch-train"
              >
                <Flame className={`w-3.5 h-3.5 text-amber-500 ${isTrainingBatch ? 'animate-bounce' : ''}`} />
                {isTrainingBatch ? 'Bulk Training...' : 'Bulk Train (35 epochs)'}
              </button>
            </div>

            {/* Live weight parameters */}
            <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Global Training Iterations:</span>
                <span className="text-amber-400 font-semibold">{epochCount} epochs</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Calculated MSE Loss:</span>
                <span className="text-amber-400 font-semibold">
                  {latestLoss !== null ? latestLoss.toFixed(6) : 'Uncalculated'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
