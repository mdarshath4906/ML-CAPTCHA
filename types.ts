/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CaptchaType = 'behavioral' | 'pattern' | 'puzzle';

export interface MousePoint {
  x: number;
  y: number;
  t: number; // timestamp
}

export interface BehavioralMetrics {
  totalDistance: number;
  straightLineDistance: number;
  straightnessRatio: number; // straightLineDistance / totalDistance (near 1.0 is highly robotic)
  averageVelocity: number;
  maxVelocity: number;
  averageAcceleration: number;
  jitteriness: number; // derivative of acceleration or curve changes
  totalTime: number;
  directionChanges: number;
}

export interface NeuralNetworkWeights {
  inputToHidden: number[][];
  hiddenToOutput: number[][];
  hiddenBiases: number[];
  outputBiases: number[];
}

export interface TrainingSample {
  input: number[]; // 8x8 normalized grid = 64 inputs
  label: string;   // 'circle', 'square', 'triangle', 'line'
}

export interface CaptchaAttempt {
  id: string;
  timestamp: Date;
  type: CaptchaType;
  passed: boolean;
  score: number; // 0 to 100 confidence
  botProbability: number;
  details: string;
}
