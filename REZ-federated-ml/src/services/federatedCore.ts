import crypto from 'crypto';
import { FederatedConfig, FLNode, TrainingRound, ModelContribution, PrivacyBudget } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class FederatedCore {
  private globalWeights: number[] = [];
  private globalBias: number[] = [];
  private privacyBudgets: Map<string, PrivacyBudget> = new Map();

  initializeModel(config: FederatedConfig): void {
    const inputSize = config.features.length;
    const hiddenSize = Math.min(128, Math.max(16, inputSize * 2));
    const outputSize = 1;

    this.globalWeights = this.initializeWeights(inputSize, hiddenSize, outputSize);
    this.globalBias = new Array(outputSize).fill(0);

    logger.info(`Model initialized: ${this.globalWeights.length} parameters`);
  }

  private initializeWeights(inputSize: number, hiddenSize: number, outputSize: number): number[] {
    const weights: number[] = [];
    const layer1Size = inputSize * hiddenSize;
    const layer2Size = hiddenSize * outputSize;

    for (let i = 0; i < layer1Size; i++) {
      const xavier = Math.sqrt(2.0 / (inputSize + hiddenSize));
      weights.push((Math.random() * 2 - 1) * xavier);
    }

    for (let i = 0; i < layer2Size; i++) {
      const xavier = Math.sqrt(2.0 / (hiddenSize + outputSize));
      weights.push((Math.random() * 2 - 1) * xavier);
    }

    return weights;
  }

  async trainLocal(
    nodeId: string,
    localData: { features: number[][]; labels: number[] },
    config: FederatedConfig
  ): Promise<{ weights: number[]; bias: number[]; metrics: { loss: number; accuracy: number } }> {
    const weights = [...this.globalWeights];
    const bias = [...this.globalBias];

    let bestLoss = Infinity;
    let patience = 0;

    for (let epoch = 0; epoch < config.epochsPerRound; epoch++) {
      const shuffledIndices = this.shuffleArray([...Array(localData.features.length).keys()]);
      let totalLoss = 0;
      let correct = 0;
      let total = 0;

      for (let i = 0; i < shuffledIndices.length; i += config.batchSize) {
        const batchIndices = shuffledIndices.slice(i, i + config.batchSize);
        const batchFeatures = batchIndices.map(idx => localData.features[idx]);
        const batchLabels = batchIndices.map(idx => localData.labels[idx]);

        const { loss, predictions } = this.forwardPropagation(batchFeatures, weights, bias);
        totalLoss += loss;

        const gradients = this.backwardPropagation(
          batchFeatures,
          batchLabels,
          predictions,
          weights,
          config
        );

        this.applyGradients(weights, bias, gradients, config);

        batchLabels.forEach((label, idx) => {
          total++;
          if (Math.round(predictions[idx]) === label) correct++;
        });
      }

      const avgLoss = totalLoss / (shuffledIndices.length / config.batchSize);
      const accuracy = correct / total;

      if (avgLoss < bestLoss - 0.001) {
        bestLoss = avgLoss;
        patience = 0;
      } else {
        patience++;
        if (patience >= 3) break;
      }

      logger.debug(`Node ${nodeId} epoch ${epoch + 1}: loss=${avgLoss.toFixed(4)}, acc=${(accuracy * 100).toFixed(2)}%`);
    }

    return {
      weights,
      bias,
      metrics: { loss: bestLoss, accuracy: correct / total }
    };
  }

  private forwardPropagation(
    features: number[][],
    weights: number[],
    bias: number[]
  ): { loss: number; predictions: number[] } {
    const hiddenSize = Math.floor(Math.sqrt(weights.length / features[0].length));
    const predictions: number[] = [];

    for (const sample of features) {
      let hiddenSum = 0;
      for (let i = 0; i < sample.length; i++) {
        hiddenSum += sample[i] * weights[i * hiddenSize % weights.length];
      }
      hiddenSum += bias[0];

      const hidden = Math.max(0, hiddenSum);
      let outputSum = 0;
      for (let i = 0; i < hiddenSize; i++) {
        outputSum += hidden * weights[weights.length - hiddenSize + i];
      }
      outputSum += bias[bias.length - 1] || 0;

      predictions.push(1 / (1 + Math.exp(-outputSum)));
    }

    const loss = predictions.reduce((sum, pred, idx) => {
      const target = features[idx][0];
      const binaryCrossEntropy = -(target * Math.log(pred + 1e-10) + (1 - target) * Math.log(1 - pred + 1e-10));
      return sum + binaryCrossEntropy;
    }, 0) / predictions.length;

    return { loss, predictions };
  }

  private backwardPropagation(
    features: number[][],
    labels: number[],
    predictions: number[],
    weights: number[],
    config: FederatedConfig
  ): { weightGradients: number[]; biasGradients: number[] } {
    const hiddenSize = Math.floor(Math.sqrt(weights.length / features[0].length));
    const weightGradients = new Array(weights.length).fill(0);
    const biasGradients = new Array(weights[0] ? 2 : 1).fill(0);

    for (let i = 0; i < features.length; i++) {
      const error = predictions[i] - labels[i];

      const outputGradient = error;
      const hiddenGradient = outputGradient * weights[weights.length - 1] * (predictions[i] > 0 ? 1 : 0);

      for (let j = 0; j < features[i].length; j++) {
        const idx = j * hiddenSize + (i % hiddenSize);
        if (idx < weightGradients.length) {
          weightGradients[idx] += features[i][j] * hiddenGradient / features.length;
        }
      }

      biasGradients[0] += hiddenGradient / features.length;
      if (biasGradients.length > 1) {
        biasGradients[biasGradients.length - 1] += outputGradient / features.length;
      }
    }

    return { weightGradients, biasGradients };
  }

  private applyGradients(
    weights: number[],
    bias: number[],
    gradients: { weightGradients: number[]; biasGradients: number[] },
    config: FederatedConfig
  ): void {
    for (let i = 0; i < weights.length; i++) {
      weights[i] -= config.learningRate * gradients.weightGradients[i];
      weights[i] -= config.regularization * weights[i];
    }

    for (let i = 0; i < bias.length; i++) {
      bias[i] -= config.learningRate * gradients.biasGradients[i];
    }
  }

  async aggregateWeights(
    contributions: ModelContribution[],
    config: FederatedConfig
  ): Promise<number[]> {
    if (contributions.length === 0) {
      return this.globalWeights;
    }

    let aggregatedWeights: number[];

    switch (config.privacyMechanism) {
      case 'secure_aggregation':
        aggregatedWeights = this.secureAggregation(contributions);
        break;
      case 'differential_privacy':
        aggregatedWeights = this.differentialPrivateAggregation(contributions, config);
        break;
      default:
        aggregatedWeights = this.federatedAveraging(contributions);
    }

    this.globalWeights = aggregatedWeights;
    return aggregatedWeights;
  }

  private federatedAveraging(contributions: ModelContribution[]): number[] {
    const totalWeight = contributions.reduce((sum, c) => sum + c.weight, 0);
    const aggregated: number[] = new Array(this.globalWeights.length).fill(0);

    for (const contribution of contributions) {
      const normalizedWeight = contribution.weight / totalWeight;
      const localWeights = this.globalWeights.map((_, i) =>
        this.globalWeights[i] + contribution.contribution * normalizedWeight
      );

      for (let i = 0; i < aggregated.length; i++) {
        aggregated[i] += localWeights[i] * normalizedWeight;
      }
    }

    return aggregated;
  }

  private secureAggregation(contributions: ModelContribution[]): number[] {
    const aggregated: number[] = new Array(this.globalWeights.length).fill(0);
    const maskSum = new Array(this.globalWeights.length).fill(0);

    for (let i = 0; i < contributions.length; i++) {
      const mask = this.generateSecureMask(contributions[i].nodeId);
      for (let j = 0; j < aggregated.length; j++) {
        maskSum[j] += mask[j];
      }
    }

    for (let i = 0; i < contributions.length; i++) {
      const contribution = contributions[i];
      const mask = this.generateSecureMask(contribution.nodeId);

      for (let j = 0; j < aggregated.length; j++) {
        aggregated[j] += contribution.contribution + mask[j];
      }
    }

    for (let j = 0; j < aggregated.length; j++) {
      aggregated[j] -= maskSum[j];
    }

    return aggregated;
  }

  private generateSecureMask(nodeId: string): number[] {
    const seed = crypto.createHash('sha256').update(nodeId).digest();
    const mask: number[] = [];
    for (let i = 0; i < this.globalWeights.length; i++) {
      const randomBytes = crypto.randomBytes(4);
      mask.push(randomBytes.readInt32LE() / (2 ** 31 - 1) * 0.01);
    }
    return mask;
  }

  private differentialPrivateAggregation(
    contributions: ModelContribution[],
    config: FederatedConfig
  ): number[] {
    const aggregated = this.federatedAveraging(contributions);

    const sensitivity = 2 / Math.min(...contributions.map(c => c.weight));
    const noiseScale = sensitivity * config.differentialPrivacyEpsilon;

    const totalSamples = contributions.reduce((sum, c) => sum + c.weight, 0);
    const clippedContributions = contributions.map(c => ({
      ...c,
      weight: Math.min(c.weight, totalSamples * 0.1)
    }));

    const aggregatedClipped = this.federatedAveraging(clippedContributions);

    const noise = aggregated.map(() => {
      const noiseSample = this.laplaceSample(noiseScale);
      return noiseSample;
    });

    return aggregatedClipped.map((val, i) => val + noise[i]);
  }

  private laplaceSample(scale: number): number {
    const u = Math.random() - 0.5;
    return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  getGlobalWeights(): number[] {
    return [...this.globalWeights];
  }

  setGlobalWeights(weights: number[]): void {
    this.globalWeights = weights;
  }

  updatePrivacyBudget(nodeId: string, epsilonSpent: number): void {
    const budget = this.privacyBudgets.get(nodeId) || {
      spentEpsilon: 0,
      remainingEpsilon: 10,
      totalBudget: 10,
      roundsUsed: 0,
      compositionBound: 0
    };

    budget.spentEpsilon += epsilonSpent;
    budget.remainingEpsilon = Math.max(0, budget.totalBudget - budget.spentEpsilon);
    budget.roundsUsed += 1;

    this.privacyBudgets.set(nodeId, budget);
  }

  getPrivacyBudget(nodeId: string): PrivacyBudget {
    return this.privacyBudgets.get(nodeId) || {
      spentEpsilon: 0,
      remainingEpsilon: 10,
      totalBudget: 10,
      roundsUsed: 0,
      compositionBound: 0
    };
  }

  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

export const federatedCore = new FederatedCore();
