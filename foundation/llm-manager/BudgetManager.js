/**
 * BudgetManager - Intelligent budget allocation and tracking
 *
 * Revolutionary Enhancement: Track spending, optimize allocation, prevent overruns
 *
 * Features:
 * - Real-time cost tracking
 * - Budget allocation by task type
 * - Spending predictions
 * - Alert thresholds
 * - Usage analytics
 * - Cost optimization recommendations
 */

import { createLogger } from '../common/logger.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';
import { EventTypes } from '../event-bus/eventTypes.js';

const logger = createLogger('BudgetManager');

// Default budget allocation
const DEFAULT_ALLOCATION = {
  critical: 0.30,    // 30% for premium/critical tasks
  normal: 0.50,      // 50% for standard tasks
  simple: 0.10,      // 10% for simple tasks
  reserve: 0.10      // 10% emergency reserve
};

// Alert thresholds
const ALERT_THRESHOLDS = {
  warning: 0.70,     // 70% budget used
  critical: 0.90,    // 90% budget used
  daily: 0.05        // 5% of monthly budget per day max
};

class BudgetManager {
  constructor(options = {}) {
    this.logger = logger;
    this.eventBus = null;
    this.initialized = false;

    // Budget configuration
    this.config = {
      monthlyBudget: options.monthlyBudget || 200, // Default $200/month
      allocation: { ...DEFAULT_ALLOCATION, ...options.allocation },
      alertThresholds: { ...ALERT_THRESHOLDS, ...options.alertThresholds },
      currency: options.currency || 'USD'
    };

    // Current period tracking
    this.currentPeriod = {
      startDate: this.getMonthStart(),
      endDate: this.getMonthEnd(),
      spent: 0,
      byCategory: {
        critical: 0,
        normal: 0,
        simple: 0
      },
      byAgent: new Map(),
      byModel: new Map(),
      transactions: []
    };

    // Historical data
    this.history = [];

    // Alerts
    this.alertsSent = new Set();
  }

  /**
   * Initialize the budget manager
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.eventBus = getEventBus();
    } catch (error) {
      this.logger.warn('EventBus not available');
    }

    // Check if we need to roll over to new period
    this.checkPeriodRollover();

    this.initialized = true;
    this.logger.info('BudgetManager initialized', {
      monthlyBudget: this.config.monthlyBudget,
      allocation: this.config.allocation
    });
  }

  /**
   * Get start of current month
   */
  getMonthStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  /**
   * Get end of current month
   */
  getMonthEnd() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  /**
   * Check and handle period rollover
   */
  checkPeriodRollover() {
    const now = new Date();
    if (now > this.currentPeriod.endDate) {
      // Archive current period
      this.history.push({
        ...this.currentPeriod,
        transactions: this.currentPeriod.transactions.length // Don't store all transactions
      });

      // Keep only last 12 months
      if (this.history.length > 12) {
        this.history.shift();
      }

      // Start new period
      this.currentPeriod = {
        startDate: this.getMonthStart(),
        endDate: this.getMonthEnd(),
        spent: 0,
        byCategory: { critical: 0, normal: 0, simple: 0 },
        byAgent: new Map(),
        byModel: new Map(),
        transactions: []
      };

      // Clear alerts for new period
      this.alertsSent.clear();

      this.logger.info('Budget period rolled over');
    }
  }

  /**
   * Record a cost
   */
  recordCost(cost, metadata = {}) {
    if (!this.initialized) {
      this.initialize();
    }

    this.checkPeriodRollover();

    const {
      category = 'normal',
      agent = 'unknown',
      model = 'unknown',
      tokens = { prompt: 0, completion: 0 }
    } = metadata;

    // Update totals
    this.currentPeriod.spent += cost;

    // Update category
    if (this.currentPeriod.byCategory[category] !== undefined) {
      this.currentPeriod.byCategory[category] += cost;
    }

    // Update agent tracking
    const agentCost = this.currentPeriod.byAgent.get(agent) || 0;
    this.currentPeriod.byAgent.set(agent, agentCost + cost);

    // Update model tracking
    const modelCost = this.currentPeriod.byModel.get(model) || 0;
    this.currentPeriod.byModel.set(model, modelCost + cost);

    // Record transaction
    this.currentPeriod.transactions.push({
      timestamp: new Date().toISOString(),
      cost,
      category,
      agent,
      model,
      tokens
    });

    // Keep transactions list manageable
    if (this.currentPeriod.transactions.length > 10000) {
      this.currentPeriod.transactions = this.currentPeriod.transactions.slice(-5000);
    }

    // Check alerts
    this.checkAlerts();

    // Publish event
    if (this.eventBus) {
      this.eventBus.publish('BUDGET_SPENT', {
        agent: 'budget-manager',
        cost,
        totalSpent: this.currentPeriod.spent,
        remaining: this.getRemainingBudget()
      });
    }

    this.logger.debug('Cost recorded', { cost, totalSpent: this.currentPeriod.spent });

    return {
      recorded: true,
      totalSpent: this.currentPeriod.spent,
      remaining: this.getRemainingBudget()
    };
  }

  /**
   * Check if we can afford a cost
   */
  canAfford(estimatedCost) {
    const remaining = this.getRemainingBudget();
    const reserve = this.config.monthlyBudget * this.config.allocation.reserve;

    return remaining - estimatedCost >= reserve;
  }

  /**
   * Get remaining budget
   */
  getRemainingBudget() {
    return this.config.monthlyBudget - this.currentPeriod.spent;
  }

  /**
   * Get remaining budget by category
   */
  getRemainingByCategory() {
    const allocations = {};

    for (const [category, percentage] of Object.entries(this.config.allocation)) {
      if (category === 'reserve') continue;

      const allocated = this.config.monthlyBudget * percentage;
      const spent = this.currentPeriod.byCategory[category] || 0;
      allocations[category] = {
        allocated,
        spent,
        remaining: allocated - spent,
        percentage: spent / allocated * 100
      };
    }

    return allocations;
  }

  /**
   * Check and send alerts
   */
  checkAlerts() {
    const usagePercentage = this.currentPeriod.spent / this.config.monthlyBudget;

    // Critical alert (90%)
    if (usagePercentage >= this.config.alertThresholds.critical &&
        !this.alertsSent.has('critical')) {
      this.sendAlert('critical', {
        message: 'Critical: 90% of monthly budget used',
        spent: this.currentPeriod.spent,
        remaining: this.getRemainingBudget()
      });
      this.alertsSent.add('critical');
    }
    // Warning alert (70%)
    else if (usagePercentage >= this.config.alertThresholds.warning &&
             !this.alertsSent.has('warning')) {
      this.sendAlert('warning', {
        message: 'Warning: 70% of monthly budget used',
        spent: this.currentPeriod.spent,
        remaining: this.getRemainingBudget()
      });
      this.alertsSent.add('warning');
    }

    // Daily limit check
    const today = new Date().toDateString();
    const todaySpent = this.currentPeriod.transactions
      .filter(t => new Date(t.timestamp).toDateString() === today)
      .reduce((sum, t) => sum + t.cost, 0);

    const dailyLimit = this.config.monthlyBudget * this.config.alertThresholds.daily;
    const alertKey = `daily-${today}`;

    if (todaySpent > dailyLimit && !this.alertsSent.has(alertKey)) {
      this.sendAlert('warning', {
        message: 'Daily spending limit exceeded',
        todaySpent,
        dailyLimit
      });
      this.alertsSent.add(alertKey);
    }
  }

  /**
   * Send an alert
   */
  sendAlert(level, data) {
    this.logger.warn(`Budget alert: ${level}`, data);

    if (this.eventBus) {
      this.eventBus.publish('BUDGET_ALERT', {
        agent: 'budget-manager',
        level,
        ...data
      });
    }
  }

  /**
   * Optimize budget allocation based on usage
   */
  async optimizeSpending() {
    const analysis = this.analyzeUsage();
    const recommendations = [];

    // Analyze category usage
    for (const [category, data] of Object.entries(analysis.byCategory)) {
      if (data.percentage > 100) {
        recommendations.push({
          type: 'over-allocation',
          category,
          message: `${category} is ${(data.percentage - 100).toFixed(0)}% over allocated budget`,
          suggestion: `Consider routing more ${category} tasks to lower-cost tiers`
        });
      } else if (data.percentage < 30 && category !== 'reserve') {
        recommendations.push({
          type: 'under-utilization',
          category,
          message: `${category} is only at ${data.percentage.toFixed(0)}% utilization`,
          suggestion: `Budget can be reallocated to other categories`
        });
      }
    }

    // Analyze model efficiency
    const modelEfficiency = this.calculateModelEfficiency();
    const inefficientModels = modelEfficiency.filter(m => m.efficiency < 0.5);

    if (inefficientModels.length > 0) {
      recommendations.push({
        type: 'model-efficiency',
        message: `${inefficientModels.length} models have low cost-efficiency`,
        models: inefficientModels.map(m => m.model),
        suggestion: 'Consider using alternative models for these task types'
      });
    }

    // Predict month-end spending
    const prediction = this.predictMonthEndSpending();
    if (prediction.projected > this.config.monthlyBudget) {
      recommendations.push({
        type: 'projection-warning',
        message: `Projected spending: $${prediction.projected.toFixed(2)} (over budget by $${(prediction.projected - this.config.monthlyBudget).toFixed(2)})`,
        suggestion: 'Reduce spending rate or use lower-cost models'
      });
    }

    return {
      analysis,
      recommendations,
      suggestedAllocation: this.calculateOptimalAllocation(analysis),
      monthEndProjection: prediction
    };
  }

  /**
   * Analyze usage patterns
   */
  analyzeUsage() {
    const daysInPeriod = Math.max(1,
      Math.ceil((new Date() - this.currentPeriod.startDate) / (1000 * 60 * 60 * 24))
    );

    return {
      period: {
        start: this.currentPeriod.startDate,
        end: this.currentPeriod.endDate,
        daysElapsed: daysInPeriod
      },
      spending: {
        total: this.currentPeriod.spent,
        dailyAverage: this.currentPeriod.spent / daysInPeriod,
        percentageUsed: (this.currentPeriod.spent / this.config.monthlyBudget) * 100
      },
      byCategory: this.getRemainingByCategory(),
      byAgent: Object.fromEntries(this.currentPeriod.byAgent),
      byModel: Object.fromEntries(this.currentPeriod.byModel),
      transactionCount: this.currentPeriod.transactions.length
    };
  }

  /**
   * Calculate model efficiency
   */
  calculateModelEfficiency() {
    const modelStats = new Map();

    // Group transactions by model
    for (const tx of this.currentPeriod.transactions) {
      const stats = modelStats.get(tx.model) || {
        cost: 0,
        tokens: 0,
        count: 0
      };

      stats.cost += tx.cost;
      stats.tokens += (tx.tokens?.prompt || 0) + (tx.tokens?.completion || 0);
      stats.count += 1;

      modelStats.set(tx.model, stats);
    }

    // Calculate efficiency (tokens per dollar)
    return Array.from(modelStats.entries()).map(([model, stats]) => ({
      model,
      cost: stats.cost,
      tokens: stats.tokens,
      requests: stats.count,
      efficiency: stats.cost > 0 ? stats.tokens / stats.cost : 0,
      costPerRequest: stats.count > 0 ? stats.cost / stats.count : 0
    })).sort((a, b) => b.efficiency - a.efficiency);
  }

  /**
   * Predict month-end spending
   */
  predictMonthEndSpending() {
    const now = new Date();
    const daysElapsed = Math.max(1,
      Math.ceil((now - this.currentPeriod.startDate) / (1000 * 60 * 60 * 24))
    );
    const daysTotal = Math.ceil(
      (this.currentPeriod.endDate - this.currentPeriod.startDate) / (1000 * 60 * 60 * 24)
    );

    const dailyRate = this.currentPeriod.spent / daysElapsed;
    const projected = dailyRate * daysTotal;

    // Calculate trend (last 7 days vs previous 7 days)
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

    const recentSpending = this.currentPeriod.transactions
      .filter(t => new Date(t.timestamp) >= sevenDaysAgo)
      .reduce((sum, t) => sum + t.cost, 0);

    const previousSpending = this.currentPeriod.transactions
      .filter(t => {
        const date = new Date(t.timestamp);
        return date >= fourteenDaysAgo && date < sevenDaysAgo;
      })
      .reduce((sum, t) => sum + t.cost, 0);

    let trend = 'stable';
    if (previousSpending > 0) {
      const changePercent = ((recentSpending - previousSpending) / previousSpending) * 100;
      if (changePercent > 20) trend = 'increasing';
      else if (changePercent < -20) trend = 'decreasing';
    }

    return {
      projected,
      dailyRate,
      daysRemaining: daysTotal - daysElapsed,
      trend,
      confidence: daysElapsed >= 7 ? 'high' : daysElapsed >= 3 ? 'medium' : 'low'
    };
  }

  /**
   * Calculate optimal allocation based on usage
   */
  calculateOptimalAllocation(analysis) {
    const total = analysis.spending.total;
    if (total === 0) return this.config.allocation;

    const optimal = {};
    let allocatedTotal = 0;

    // Calculate based on actual usage with buffer
    for (const [category, data] of Object.entries(analysis.byCategory)) {
      if (category === 'reserve') continue;

      // Actual percentage of spending
      const actualPercentage = data.spent / total;

      // Add 20% buffer
      optimal[category] = Math.min(0.5, actualPercentage * 1.2);
      allocatedTotal += optimal[category];
    }

    // Reserve gets what's left (minimum 5%)
    optimal.reserve = Math.max(0.05, 1 - allocatedTotal);

    // Normalize if over 100%
    const totalAllocated = Object.values(optimal).reduce((a, b) => a + b, 0);
    if (totalAllocated > 1) {
      for (const key of Object.keys(optimal)) {
        optimal[key] /= totalAllocated;
      }
    }

    return optimal;
  }

  /**
   * Set new monthly budget
   */
  setMonthlyBudget(amount) {
    this.config.monthlyBudget = amount;
    this.logger.info(`Monthly budget updated to $${amount}`);

    // Re-check alerts with new budget
    this.alertsSent.clear();
    this.checkAlerts();
  }

  /**
   * Set budget allocation
   */
  setAllocation(allocation) {
    // Validate allocation sums to 1
    const total = Object.values(allocation).reduce((a, b) => a + b, 0);
    if (Math.abs(total - 1) > 0.01) {
      throw new Error('Budget allocation must sum to 1.0');
    }

    this.config.allocation = allocation;
    this.logger.info('Budget allocation updated', allocation);
  }

  /**
   * Get budget status
   */
  getStatus() {
    return {
      monthlyBudget: this.config.monthlyBudget,
      allocation: this.config.allocation,
      period: {
        start: this.currentPeriod.startDate,
        end: this.currentPeriod.endDate
      },
      spent: this.currentPeriod.spent,
      remaining: this.getRemainingBudget(),
      percentageUsed: (this.currentPeriod.spent / this.config.monthlyBudget * 100).toFixed(1) + '%',
      byCategory: this.getRemainingByCategory(),
      projection: this.predictMonthEndSpending()
    };
  }

  /**
   * Get historical data
   */
  getHistory() {
    return this.history;
  }

  /**
   * Export data for analysis
   */
  exportData() {
    return {
      config: this.config,
      current: {
        ...this.currentPeriod,
        byAgent: Object.fromEntries(this.currentPeriod.byAgent),
        byModel: Object.fromEntries(this.currentPeriod.byModel)
      },
      history: this.history,
      analysis: this.analyzeUsage()
    };
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of BudgetManager
 * @returns {BudgetManager}
 */
export function getBudgetManager(options = {}) {
  if (!instance) {
    instance = new BudgetManager(options);
  }
  return instance;
}

export { BudgetManager, DEFAULT_ALLOCATION, ALERT_THRESHOLDS };
export default BudgetManager;
