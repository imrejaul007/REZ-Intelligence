import { v4 as uuidv4 } from 'uuid';

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AlertStatus = 'firing' | 'resolved' | 'acknowledged' | 'pending';
export type AlertType = 'threshold' | 'anomaly' | 'availability' | 'performance';

export interface AlertCondition {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number;
  duration?: number;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  service: string;
  condition: AlertCondition;
  severity: AlertSeverity;
  type: AlertType;
  enabled: boolean;
  cooldownMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface AlertAnnotation {
  key: string;
  value: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  status: AlertStatus;
  type: AlertType;
  service: string;
  message: string;
  currentValue?: number;
  threshold?: number;
  firedAt?: string;
  resolvedAt?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  annotations: AlertAnnotation[];
  labels: Record<string, string>;
  runs: number;
  lastCheckAt?: string;
}

export interface AlertEvaluationResult {
  ruleId: string;
  ruleName: string;
  isViolated: boolean;
  currentValue?: number;
  threshold?: number;
  evaluatedAt: string;
}

class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private lastFired: Map<string, number> = new Map();
  private metricValues: Map<string, number> = new Map();
  private alertHistory: Alert[] = [];
  private readonly maxHistory = 1000;
  private readonly listeners: Array<(alert: Alert) => void> = [];

  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    this.createRule({
      name: 'High Error Rate',
      description: 'Alert when error rate exceeds 5%',
      service: 'api',
      condition: { metric: 'errors_total', operator: '>', value: 5 },
      severity: 'high',
      type: 'threshold',
      enabled: true,
      cooldownMinutes: 5
    });

    this.createRule({
      name: 'High Latency',
      description: 'Alert when p99 latency exceeds 500ms',
      service: 'api',
      condition: { metric: 'http_request_duration_seconds_p99', operator: '>', value: 0.5 },
      severity: 'medium',
      type: 'performance',
      enabled: true,
      cooldownMinutes: 10
    });

    this.createRule({
      name: 'Memory Usage High',
      description: 'Alert when memory usage exceeds 80%',
      service: 'system',
      condition: { metric: 'memory_usage_percent', operator: '>', value: 80 },
      severity: 'high',
      type: 'threshold',
      enabled: true,
      cooldownMinutes: 15
    });
  }

  createRule(params: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): AlertRule {
    const rule: AlertRule = {
      ...params,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.rules.set(rule.id, rule);
    return rule;
  }

  updateRule(ruleId: string, updates: Partial<AlertRule>): AlertRule | undefined {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return undefined;
    }
    const updatedRule = { ...rule, ...updates, updatedAt: new Date().toISOString() };
    this.rules.set(ruleId, updatedRule);
    return updatedRule;
  }

  deleteRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  getAllRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  getEnabledRules(): AlertRule[] {
    return Array.from(this.rules.values()).filter(r => r.enabled);
  }

  setMetricValue(metric: string, value: number): void {
    this.metricValues.set(metric, value);
  }

  getMetricValue(metric: string): number | undefined {
    return this.metricValues.get(metric);
  }

  private evaluateCondition(condition: AlertCondition, value: number): boolean {
    switch (condition.operator) {
      case '>': return value > condition.value;
      case '<': return value < condition.value;
      case '>=': return value >= condition.value;
      case '<=': return value <= condition.value;
      case '==': return value === condition.value;
      case '!=': return value !== condition.value;
      default: return false;
    }
  }

  private canFire(ruleId: string): boolean {
    const lastFiredTime = this.lastFired.get(ruleId);
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    if (!lastFiredTime) return true;
    const cooldownMs = rule.cooldownMinutes * 60 * 1000;
    return Date.now() - lastFiredTime >= cooldownMs;
  }

  evaluateRules(): AlertEvaluationResult[] {
    const results: AlertEvaluationResult[] = [];

    for (const rule of this.getEnabledRules()) {
      const value = this.metricValues.get(rule.condition.metric);
      const isViolated = value !== undefined && this.evaluateCondition(rule.condition, value);

      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        isViolated,
        currentValue: value,
        threshold: rule.condition.value,
        evaluatedAt: new Date().toISOString()
      });

      if (isViolated && this.canFire(rule.id)) {
        this.fireAlert(rule, value!);
        this.lastFired.set(rule.id, Date.now());
      }
    }

    return results;
  }

  private fireAlert(rule: AlertRule, currentValue: number): Alert {
    const existingAlert = this.findActiveAlert(rule.id);

    if (existingAlert) {
      existingAlert.currentValue = currentValue;
      existingAlert.runs++;
      existingAlert.lastCheckAt = new Date().toISOString();
      this.notifyListeners(existingAlert);
      return existingAlert;
    }

    const alert: Alert = {
      id: uuidv4(),
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      status: 'firing',
      type: rule.type,
      service: rule.service,
      message: `${rule.name}: ${rule.description}`,
      currentValue,
      threshold: rule.condition.value,
      firedAt: new Date().toISOString(),
      annotations: [],
      labels: { service: rule.service },
      runs: 1,
      lastCheckAt: new Date().toISOString()
    };

    this.alerts.set(alert.id, alert);
    this.alertHistory.push(alert);

    if (this.alertHistory.length > this.maxHistory) {
      this.alertHistory.shift();
    }

    this.notifyListeners(alert);
    return alert;
  }

  private findActiveAlert(ruleId: string): Alert | undefined {
    for (const alert of this.alerts.values()) {
      if (alert.ruleId === ruleId && alert.status === 'firing') {
        return alert;
      }
    }
    return undefined;
  }

  acknowledgeAlert(alertId: string, acknowledgedBy: string): Alert | undefined {
    const alert = this.alerts.get(alertId);
    if (!alert) return undefined;

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date().toISOString();
    alert.acknowledgedBy = acknowledgedBy;
    return alert;
  }

  resolveAlert(alertId: string): Alert | undefined {
    const alert = this.alerts.get(alertId);
    if (!alert) return undefined;

    alert.status = 'resolved';
    alert.resolvedAt = new Date().toISOString();
    return alert;
  }

  getAlert(alertId: string): Alert | undefined {
    return this.alerts.get(alertId);
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(a => a.status === 'firing');
  }

  getAlertsByStatus(status: AlertStatus): Alert[] {
    return Array.from(this.alerts.values()).filter(a => a.status === status);
  }

  getAlertsBySeverity(severity: AlertSeverity): Alert[] {
    return Array.from(this.alerts.values()).filter(a => a.severity === severity);
  }

  getAlertsByService(service: string): Alert[] {
    return Array.from(this.alerts.values()).filter(a => a.service === service);
  }

  getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  onAlert(listener: (alert: Alert) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(alert: Alert): void {
    for (const listener of this.listeners) {
      try {
        listener(alert);
      } catch (error) {
        console.error('Alert listener error:', error);
      }
    }
  }

  getAlertStats(): {
    total: number;
    byStatus: Record<AlertStatus, number>;
    bySeverity: Record<AlertSeverity, number>;
    byService: Record<string, number>;
    totalRules: number;
    enabledRules: number;
  } {
    const byStatus: Record<AlertStatus, number> = { firing: 0, resolved: 0, acknowledged: 0, pending: 0 };
    const bySeverity: Record<AlertSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const byService: Record<string, number> = {};

    for (const alert of this.alerts.values()) {
      byStatus[alert.status]++;
      bySeverity[alert.severity]++;
      byService[alert.service] = (byService[alert.service] || 0) + 1;
    }

    const rules = Array.from(this.rules.values());

    return {
      total: this.alerts.size,
      byStatus,
      bySeverity,
      byService,
      totalRules: rules.length,
      enabledRules: rules.filter(r => r.enabled).length
    };
  }
}

export const alerts = new AlertManager();
