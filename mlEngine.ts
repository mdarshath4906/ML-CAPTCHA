/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MousePoint, BehavioralMetrics, TrainingSample } from '../types';

// ==========================================
// 1. BEHAVIORAL MOUSE TRAJECTORY CLASSIFIER
// ==========================================

/**
 * Extracts behavioral features from a sequence of mouse events.
 */
export function extractBehavioralMetrics(points: MousePoint[]): BehavioralMetrics {
  if (points.length < 2) {
    return {
      totalDistance: 0,
      straightLineDistance: 0,
      straightnessRatio: 1,
      averageVelocity: 0,
      maxVelocity: 0,
      averageAcceleration: 0,
      jitteriness: 0,
      totalTime: 0,
      directionChanges: 0,
    };
  }

  const start = points[0];
  const end = points[points.length - 1];
  const totalTime = (end.t - start.t) / 1000; // in seconds

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const straightLineDistance = Math.sqrt(dx * dx + dy * dy);

  let totalDistance = 0;
  let velocities: number[] = [];
  let accelerations: number[] = [];
  let directionChanges = 0;
  let lastAngle = 0;
  let angleChanges: number[] = [];

  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];

    const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    totalDistance += dist;

    const dt = (p2.t - p1.t) / 1000; // seconds
    if (dt > 0) {
      const v = dist / dt;
      velocities.push(v);

      // Angle of movement
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      if (i > 1) {
        let diff = Math.abs(angle - lastAngle);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        angleChanges.push(diff);
        if (diff > 0.5) { // sharp turn
          directionChanges++;
        }
      }
      lastAngle = angle;
    }
  }

  // Calculate accelerations
  for (let i = 1; i < velocities.length; i++) {
    const v1 = velocities[i - 1];
    const v2 = velocities[i];
    const dt = ((points[i + 1]?.t || points[i].t) - points[i].t) / 1000;
    if (dt > 0) {
      accelerations.push(Math.abs(v2 - v1) / dt);
    }
  }

  const avgVelocity = velocities.length > 0 ? velocities.reduce((a, b) => a + b, 0) / velocities.length : 0;
  const maxVelocity = velocities.length > 0 ? Math.max(...velocities) : 0;
  const avgAcceleration = accelerations.length > 0 ? accelerations.reduce((a, b) => a + b, 0) / accelerations.length : 0;

  // Calculate angular/movement jitter (high frequency changes in angle & velocity)
  let jitteriness = 0;
  if (angleChanges.length > 0) {
    const sumAngleChanges = angleChanges.reduce((a, b) => a + b, 0);
    jitteriness = (sumAngleChanges / angleChanges.length) * (directionChanges + 1);
  }

  const straightnessRatio = totalDistance > 0 ? straightLineDistance / totalDistance : 1;

  return {
    totalDistance,
    straightLineDistance,
    straightnessRatio,
    averageVelocity: isNaN(avgVelocity) ? 0 : avgVelocity,
    maxVelocity: isNaN(maxVelocity) ? 0 : maxVelocity,
    averageAcceleration: isNaN(avgAcceleration) ? 0 : avgAcceleration,
    jitteriness: isNaN(jitteriness) ? 0 : jitteriness,
    totalTime: isNaN(totalTime) ? 0 : totalTime,
    directionChanges,
  };
}

/**
 * Heuristic/Statistical ML Classifier (similar to Logistic Regression)
 * Predicts human probability based on mouse trace metrics.
 * Humans have natural jitter, deceleration, curved paths, and reaction pauses.
 * Bots are either perfectly linear, follow exact bezier paths without tremor, or have artificial noise.
 */
export function classifyBehavior(metrics: BehavioralMetrics): {
  botProbability: number;
  isBot: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  let score = 0; // cumulative anomaly indicators

  // 1. Straightness ratio check
  // Perfectly straight lines are highly robotic.
  if (metrics.straightnessRatio > 0.99 && metrics.totalDistance > 30) {
    score += 45;
    reasons.push("Trajectory is perfectly linear (Straightness Ratio > 99%).");
  } else if (metrics.straightnessRatio > 0.97 && metrics.totalDistance > 50) {
    score += 25;
    reasons.push("Atypical linear alignment (Straightness Ratio > 97%).");
  }

  // 2. Average Jitteriness
  // Normal human mouse sweeps have subtle micro-tremors (jitter between 0.1 and 1.8).
  // Perfect Bezier paths have virtually 0 jitter. Automated macro recorders have weirdly high jitter.
  if (metrics.jitteriness < 0.05 && metrics.totalDistance > 40) {
    score += 35;
    reasons.push("Unnatural path smoothness (zero micro-tremors detected).");
  } else if (metrics.jitteriness > 4.5 && metrics.totalDistance > 20) {
    score += 30;
    reasons.push("Excessive artificial noise or disjointed cursor coordinates.");
  }

  // 3. Movement speed & acceleration analysis
  // Robots achieve massive velocity instantly or maintain uniform speed.
  if (metrics.averageAcceleration < 50 && metrics.averageVelocity > 300) {
    score += 20;
    reasons.push("Uniform movement speed lacking natural physical acceleration curves.");
  } else if (metrics.maxVelocity > 25000) {
    score += 35;
    reasons.push("Velocity exceeds human physics limits (teleportation pattern).");
  }

  // 4. Time checks
  if (metrics.totalTime < 0.08 && metrics.totalDistance > 100) {
    score += 40;
    reasons.push("Interaction completed faster than basic human visual-motor latency (< 80ms).");
  }

  // Normalize probability (0 to 1)
  const botProbability = Math.min(Math.max(score / 100, 0.01), 0.99);

  return {
    botProbability,
    isBot: botProbability > 0.5,
    reasons: reasons.length > 0 ? reasons : ["No anomalous mechanical signatures detected."],
  };
}


// ==========================================
// 2. HAND-DRAWN SHAPE NEURAL NETWORK (MLP)
// ==========================================

export class ShapeNeuralNetwork {
  private inputSize: number = 64; // 8x8 input grid
  private hiddenSize: number = 16;
  private outputSize: number = 4; // ['circle', 'triangle', 'square', 'line']
  public classes: string[] = ['circle', 'triangle', 'square', 'line'];

  // Network weights & biases
  public weightsIH: number[][];
  public weightsHO: number[][];
  public biasH: number[];
  public biasO: number[];

  constructor() {
    this.weightsIH = [];
    this.weightsHO = [];
    this.biasH = [];
    this.biasO = [];
    this.initializeWeights();
  }

  /**
   * Initializes or restores pre-trained default weights for instant verification.
   */
  private initializeWeights() {
    // Hidden layer weights
    for (let i = 0; i < this.hiddenSize; i++) {
      this.weightsIH[i] = [];
      for (let j = 0; j < this.inputSize; j++) {
        this.weightsIH[i][j] = (Math.random() * 2 - 1) * Math.sqrt(2.0 / this.inputSize);
      }
      this.biasH[i] = (Math.random() * 2 - 1) * 0.1;
    }

    // Output layer weights
    for (let i = 0; i < this.outputSize; i++) {
      this.weightsHO[i] = [];
      for (let j = 0; j < this.hiddenSize; j++) {
        this.weightsHO[i][j] = (Math.random() * 2 - 1) * Math.sqrt(2.0 / this.hiddenSize);
      }
      this.biasO[i] = (Math.random() * 2 - 1) * 0.1;
    }

    // Set highly deterministic defaults simulating basic shape characteristics
    this.seedPretrainedWeights();
  }

  /**
   * Seeds custom-built weights that correspond to specific pixel density templates.
   * This guarantees a functional classifier straight out of the gate!
   */
  private seedPretrainedWeights() {
    // We will build a template-matching-inspired weight structure:
    // Output 0 (Circle): Strong positive weights in the perimeter pixels, negative in center.
    // Output 1 (Triangle): Strong positive weights along diagonals (bottom-left to top, top to bottom-right, and horizontal base).
    // Output 2 (Square): Positive weights on outer borders (top row, bottom row, left column, right col), negative center.
    // Output 3 (Line): Positive weights along the main diagonals or middle horizontal band.

    for (let h = 0; h < this.hiddenSize; h++) {
      // Create hidden neurons responding to different shapes
      const patternType = h % 4; // 4 neurons for each pattern family
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const index = r * 8 + c;
          let w = (Math.random() * 0.2 - 0.1);

          if (patternType === 0) {
            // Circle template: circular ring at radius ~2.5 from center (3.5, 3.5)
            const dist = Math.sqrt(Math.pow(r - 3.5, 2) + Math.pow(c - 3.5, 2));
            if (dist > 1.8 && dist < 3.2) {
              w += 0.45;
            } else {
              w -= 0.35;
            }
          } else if (patternType === 1) {
            // Triangle template: inverted V shape with bottom base
            const leftDiag = Math.abs((7 - r) - c);
            const rightDiag = Math.abs(r - c);
            if ((r < 7 && Math.abs(c - r/2 - 2) < 0.8) || (r < 7 && Math.abs(c + r/2 - 5) < 0.8) || (r === 6 && c > 1 && c < 6)) {
              w += 0.55;
            } else {
              w -= 0.25;
            }
          } else if (patternType === 2) {
            // Square template: border lines
            if (r === 0 || r === 7 || c === 0 || c === 7) {
              w += 0.45;
            } else if (r > 1 && r < 6 && c > 1 && c < 6) {
              w -= 0.4;
            }
          } else {
            // Line template (diagonal / horizontal)
            if (Math.abs(r - c) < 1.0 || r === 3 || r === 4) {
              w += 0.5;
            } else {
              w -= 0.3;
            }
          }

          this.weightsIH[h][index] = w;
        }
      }
      this.biasH[h] = -0.1;
    }

    // Set hidden-to-output maps
    for (let o = 0; o < this.outputSize; o++) {
      for (let h = 0; h < this.hiddenSize; h++) {
        if (h % 4 === o) {
          this.weightsHO[o][h] = 0.8;
        } else {
          this.weightsHO[o][h] = -0.4;
        }
      }
      this.biasO[o] = -0.05;
    }
  }

  // Activation functions
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private dSigmoid(y: number): number {
    return y * (1 - y);
  }

  private softmax(arr: number[]): number[] {
    const maxVal = Math.max(...arr);
    const exp = arr.map(v => Math.exp(v - maxVal));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(v => v / (sum || 1));
  }

  /**
   * Run forward propagation. Returns outputs and hidden states.
   */
  public forward(input: number[]): { outputs: number[]; hidden: number[] } {
    // Input to Hidden
    const hidden: number[] = [];
    for (let h = 0; h < this.hiddenSize; h++) {
      let sum = this.biasH[h];
      for (let i = 0; i < this.inputSize; i++) {
        sum += input[i] * this.weightsIH[h][i];
      }
      hidden[h] = this.sigmoid(sum);
    }

    // Hidden to Output
    const rawOutputs: number[] = [];
    for (let o = 0; o < this.outputSize; o++) {
      let sum = this.biasO[o];
      for (let h = 0; h < this.hiddenSize; h++) {
        sum += hidden[h] * this.weightsHO[o][h];
      }
      rawOutputs[o] = sum;
    }

    const outputs = this.softmax(rawOutputs);

    return { outputs, hidden };
  }

  /**
   * Backpropagation live training on a single sample.
   */
  public train(input: number[], targetLabel: string, learningRate: number = 0.15): number {
    const targetIdx = this.classes.indexOf(targetLabel);
    if (targetIdx === -1) return 0;

    const targets = new Array(this.outputSize).fill(0);
    targets[targetIdx] = 1.0;

    // 1. Forward Pass
    const { outputs, hidden } = this.forward(input);

    // 2. Output Layer Errors & Deltas
    const outputDeltas: number[] = [];
    let loss = 0;
    for (let o = 0; o < this.outputSize; o++) {
      const error = targets[o] - outputs[o];
      loss += error * error;
      // Cross entropy with softmax simplifies to target - output
      outputDeltas[o] = error;
    }
    loss = loss / 2;

    // 3. Hidden Layer Errors & Deltas
    const hiddenDeltas: number[] = [];
    for (let h = 0; h < this.hiddenSize; h++) {
      let error = 0;
      for (let o = 0; o < this.outputSize; o++) {
        error += outputDeltas[o] * this.weightsHO[o][h];
      }
      hiddenDeltas[h] = error * this.dSigmoid(hidden[h]);
    }

    // 4. Update Weights HO (Hidden to Output)
    for (let o = 0; o < this.outputSize; o++) {
      for (let h = 0; h < this.hiddenSize; h++) {
        this.weightsHO[o][h] += learningRate * outputDeltas[o] * hidden[h];
      }
      this.biasO[o] += learningRate * outputDeltas[o];
    }

    // 5. Update Weights IH (Input to Hidden)
    for (let h = 0; h < this.hiddenSize; h++) {
      for (let i = 0; i < this.inputSize; i++) {
        this.weightsIH[h][i] += learningRate * hiddenDeltas[h] * input[i];
      }
      this.biasH[h] += learningRate * hiddenDeltas[h];
    }

    return loss;
  }
}

/**
 * Normalizes drawing point arrays into an 8x8 input grid.
 */
export function normalizeDrawingToGrid(points: { x: number; y: number }[]): number[] {
  const grid = new Array(64).fill(0);
  if (points.length === 0) return grid;

  // Find bounding box
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  points.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  const size = Math.max(width, height);

  // Center alignment & aspect scale
  const xOffset = (size - width) / 2;
  const yOffset = (size - height) / 2;

  // Render stroke density to 8x8 grid
  points.forEach(p => {
    // Map to normalized 0-7 coordinate system
    const mappedX = Math.min(Math.floor(((p.x - minX + xOffset) / size) * 8), 7);
    const mappedY = Math.min(Math.floor(((p.y - minY + yOffset) / size) * 8), 7);

    if (mappedX >= 0 && mappedX < 8 && mappedY >= 0 && mappedY < 8) {
      grid[mappedY * 8 + mappedX] = 1.0; // Fill grid pixel
    }
  });

  // Apply a light Gaussian blur to smooth representation & handle spacing
  const blurredGrid = [...grid];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const idx = r * 8 + c;
      if (grid[idx] === 1.0) {
        // Distribute weight to neighbors
        const neighbors = [
          [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]
        ];
        neighbors.forEach(([nr, nc]) => {
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            const nIdx = nr * 8 + nc;
            if (grid[nIdx] < 0.6) {
              blurredGrid[nIdx] = Math.max(blurredGrid[nIdx], 0.4);
            }
          }
        });
      }
    }
  }

  return blurredGrid;
}


// ==========================================
// 3. SYNTHETIC BOT PATH GENERATOR
// ==========================================

export function generateBotPath(
  type: 'linear' | 'bezier' | 'jittery',
  start: { x: number; y: number },
  end: { x: number; y: number },
  durationMs: number = 200
): MousePoint[] {
  const points: MousePoint[] = [];
  const steps = 25;
  const startTime = Date.now();

  if (type === 'linear') {
    // Perfectly straight robotic movement with perfect time-steps
    for (let i = 0; i <= steps; i++) {
      const ratio = i / steps;
      points.push({
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
        t: startTime + durationMs * ratio,
      });
    }
  } else if (type === 'bezier') {
    // Smooth, mathematical spline, perfect curved sweep with zero tremor/noise
    const controlX = (start.x + end.x) / 2 + 120;
    const controlY = (start.y + end.y) / 2 - 80;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Quadratic Bezier interpolation
      const x = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * controlX + t * t * end.x;
      const y = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * controlY + t * t * end.y;

      points.push({
        x,
        y,
        t: startTime + durationMs * t,
      });
    }
  } else {
    // High artificial noise bot (often used by rudimentary macros)
    for (let i = 0; i <= steps; i++) {
      const ratio = i / steps;
      // Linear path with huge artificial high-frequency noise/jitter
      const jitterX = i > 0 && i < steps ? (Math.random() * 26 - 13) : 0;
      const jitterY = i > 0 && i < steps ? (Math.random() * 26 - 13) : 0;

      points.push({
        x: start.x + (end.x - start.x) * ratio + jitterX,
        y: start.y + (end.y - start.y) * ratio + jitterY,
        t: startTime + durationMs * ratio,
      });
    }
  }

  return points;
}
