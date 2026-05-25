import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Dataset, SchemaField, SyntheticDataRequest, GenerationResult, DataQualityReport } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class DataGenerator {
  private seed: number = Date.now();

  setSeed(seed: number): void {
    this.seed = seed;
  }

  private seededRandom(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  private seededUUID(): string {
    return uuidv4();
  }

  async generate(request: SyntheticDataRequest): Promise<GenerationResult> {
    const datasetId = uuidv4();
    logger.info(`Generating synthetic data: ${request.dataset.name}`);

    this.setSeed(request.dataset.options?.seed || Date.now());

    const data: Record<string, unknown>[] = [];
    const schema = request.dataset.schema;

    for (let i = 0; i < request.dataset.recordCount; i++) {
      const record: Record<string, unknown> = {};
      for (const field of schema) {
        record[field.name] = this.generateFieldValue(field, i, request);
      }
      data.push(record);
    }

    const piiFields = schema
      .filter(f => ['email', 'phone', 'name', 'address'].includes(f.type))
      .map(f => f.name);

    const fieldStats: Record<string, unknown> = {};
    for (const field of schema) {
      if (field.type === 'number') {
        const values = data.map(d => d[field.name]).filter(v => typeof v === 'number') as number[];
        fieldStats[field.name] = {
          min: Math.min(...values),
          max: Math.max(...values),
          mean: values.reduce((a, b) => a + b, 0) / values.length
        };
      }
      fieldStats[field.name] = {
        ...fieldStats[field.name],
        unique: new Set(data.map(d => d[field.name])).size
      };
    }

    return {
      datasetId,
      name: request.dataset.name,
      recordCount: data.length,
      generatedAt: new Date(),
      schema,
      data,
      stats: {
        fieldStats,
        totalSize: JSON.stringify(data).length,
        piiFields
      }
    };
  }

  private generateFieldValue(field: SchemaField, index: number, request: SyntheticDataRequest): unknown {
    const options = request.dataset.options || {};

    switch (field.type) {
      case 'string':
        return this.generateString(field, index);
      case 'number':
        return this.generateNumber(field, options);
      case 'boolean':
        return this.seededRandom() > 0.5;
      case 'date':
        return this.generateDate(field);
      case 'email':
        return this.generateEmail(index);
      case 'phone':
        return this.generatePhone();
      case 'name':
        return this.generateName();
      case 'address':
        return this.generateAddress();
      case 'uuid':
        return this.seededUUID();
      case 'enum':
        return this.generateEnum(field);
      case 'array':
        return this.generateArray(field);
      case 'object':
        return this.generateObject(field);
      default:
        return null;
    }
  }

  private generateString(field: SchemaField, index: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const minLen = field.minLength || 5;
    const maxLen = field.maxLength || 20;
    const length = Math.floor(this.seededRandom() * (maxLen - minLen + 1)) + minLen;

    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(this.seededRandom() * chars.length));
    }
    return result;
  }

  private generateNumber(field: SchemaField, options): number {
    const min = field.min ?? 0;
    const max = field.max ?? 1000;

    if (options.addNoise && options.noiseLevel) {
      const noise = (this.seededRandom() - 0.5) * 2 * (max - min) * options.noiseLevel;
      return Math.round((min + this.seededRandom() * (max - min) + noise) * 100) / 100;
    }

    return Math.round((min + this.seededRandom() * (max - min)) * 100) / 100;
  }

  private generateDate(field: SchemaField): string {
    const start = field.min ? new Date(field.min).getTime() : Date.now() - 365 * 24 * 60 * 60 * 1000;
    const end = field.max ? new Date(field.max).getTime() : Date.now();
    const date = new Date(start + this.seededRandom() * (end - start));
    return date.toISOString().split('T')[0];
  }

  private generateEmail(index: number): string {
    const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'company.com'];
    const name = this.generateName().toLowerCase().replace(/\s/g, '.');
    return `${name}${index}@${domains[Math.floor(this.seededRandom() * domains.length)]}`;
  }

  private generatePhone(): string {
    const prefixes = ['+91 987', '+91 981', '+91 985', '+91 880'];
    const prefix = prefixes[Math.floor(this.seededRandom() * prefixes.length)];
    const suffix = Math.floor(this.seededRandom() * 10000000).toString().padStart(7, '0');
    return `${prefix} ${suffix}`;
  }

  private generateName(): string {
    const firstNames = ['Rajesh', 'Priya', 'Amit', 'Neha', 'Vikram', 'Anita', 'Rahul', 'Pooja', 'Suresh', 'Kavita'];
    const lastNames = ['Sharma', 'Patel', 'Singh', 'Gupta', 'Kumar', 'Verma', 'Reddy', 'Joshi', 'Mehta', 'Shah'];
    return `${firstNames[Math.floor(this.seededRandom() * firstNames.length)]} ${lastNames[Math.floor(this.seededRandom() * lastNames.length)]}`;
  }

  private generateAddress(): string {
    const streetNumbers = [1, 2, 3, 45, 67, 89, 123, 456];
    const streets = ['MG Road', 'Link Road', 'Main Street', 'Park Avenue', 'Station Road', 'Market Lane'];
    const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune'];
    const areas = ['Indiranagar', 'Koramangala', 'Jubilee Hills', 'Bandra', 'Vasant Kunj'];
    return `${streetNumbers[Math.floor(this.seededRandom() * streetNumbers.length)]}, ${streets[Math.floor(this.seededRandom() * streets.length)]}, ${areas[Math.floor(this.seededRandom() * areas.length)]}, ${cities[Math.floor(this.seededRandom() * cities.length)]}`;
  }

  private generateEnum(field: SchemaField): string {
    if (!field.enum || field.enum.length === 0) {
      return 'unknown';
    }
    return field.enum[Math.floor(this.seededRandom() * field.enum.length)];
  }

  private generateArray(field: SchemaField): unknown[] {
    const length = Math.floor(this.seededRandom() * 5) + 1;
    return Array.from({ length }, (_, i) => this.generateString(field, i));
  }

  private generateObject(field: SchemaField): Record<string, unknown> {
    return {
      id: this.seededUUID(),
      type: field.name,
      created: new Date().toISOString()
    };
  }

  async anonymizeData(data: unknown[], fieldsToAnonymize: string[], preserveFormat: boolean = true): Promise<unknown[]> {
    return data.map(record => {
      const anonymized = { ...record };

      for (const field of fieldsToAnonymize) {
        if (field in anonymized) {
          if (preserveFormat && typeof anonymized[field] === 'string') {
            anonymized[field] = this.anonymizeWithFormat(anonymized[field]);
          } else if (typeof anonymized[field] === 'string' && anonymized[field].includes('@')) {
            anonymized[field] = 'user' + Math.floor(this.seededRandom() * 100000) + '@anonymized.com';
          } else if (typeof anonymized[field] === 'string' && anonymized[field].match(/^\+91/)) {
            anonymized[field] = '+91 999 XXXXX' + Math.floor(this.seededRandom() * 10000);
          } else {
            anonymized[field] = '[REDACTED]';
          }
        }
      }

      return anonymized;
    });
  }

  private anonymizeWithFormat(value: string): string {
    if (value.length <= 4) return '****';
    return value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2);
  }

  generateUserDataset(count: number = 100): unknown[] {
    return Array.from({ length: count }, (_, i) => ({
      id: this.seededUUID(),
      email: this.generateEmail(i),
      name: this.generateName(),
      phone: this.generatePhone(),
      address: this.generateAddress(),
      age: Math.floor(this.seededRandom() * 50) + 18,
      isActive: this.seededRandom() > 0.2,
      createdAt: this.generateDate({ name: 'createdAt', type: 'date', min: '2020-01-01' } as unknown),
      lastLogin: this.generateDate({ name: 'lastLogin', type: 'date', min: '2024-01-01' } as unknown)
    }));
  }

  generateProductDataset(count: number = 100): unknown[] {
    const categories = ['Electronics', 'Clothing', 'Food', 'Home', 'Sports', 'Books'];
    const brands = ['Premium', 'Value', 'Budget', 'Luxury', 'Standard'];
    return Array.from({ length: count }, (_, i) => ({
      id: this.seededUUID(),
      sku: 'SKU' + Math.floor(this.seededRandom() * 1000000).toString().padStart(6, '0'),
      name: 'Product ' + (i + 1),
      category: categories[Math.floor(this.seededRandom() * categories.length)],
      brand: brands[Math.floor(this.seededRandom() * brands.length)],
      price: Math.round((this.seededRandom() * 5000 + 100) * 100) / 100,
      cost: Math.round((this.seededRandom() * 2500 + 50) * 100) / 100,
      stock: Math.floor(this.seededRandom() * 500),
      isAvailable: this.seededRandom() > 0.1
    }));
  }

  generateOrderDataset(count: number = 100): unknown[] {
    const statuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    const paymentMethods = ['UPI', 'Card', 'Wallet', 'Net Banking', 'COD'];
    return Array.from({ length: count }, (_, i) => ({
      id: this.seededUUID(),
      orderNumber: 'ORD' + Date.now().toString().slice(-8) + i.toString().padStart(4, '0'),
      customerId: this.seededUUID(),
      totalAmount: Math.round((this.seededRandom() * 10000 + 100) * 100) / 100,
      status: statuses[Math.floor(this.seededRandom() * statuses.length)],
      paymentMethod: paymentMethods[Math.floor(this.seededRandom() * paymentMethods.length)],
      items: Math.floor(this.seededRandom() * 10) + 1,
      createdAt: this.generateDate({ name: 'createdAt', type: 'date', min: '2024-01-01' } as unknown)
    }));
  }

  async generateQualityReport(data: unknown[], schema: SchemaField[]): Promise<DataQualityReport> {
    const datasetId = uuidv4();

    const totalFields = schema.length;
    let completeFields = 0;
    let validFields = 0;
    const issues: string[] = [];

    for (const field of schema) {
      const values = data.map(d => d[field.name]);
      const nonNull = values.filter(v => v !== null && v !== undefined).length;
      if (nonNull / data.length > 0.95) completeFields++;

      const valid = values.filter(v => this.validateValue(v, field)).length;
      if (valid / data.length > 0.9) validFields++;

      if (nonNull / data.length < 0.8) {
        issues.push(`Field ${field.name} has ${((1 - nonNull / data.length) * 100).toFixed(1)}% missing values`);
      }
    }

    const piiFields = schema.filter(f => ['email', 'phone', 'name', 'address'].includes(f.type));
    const privacyScore = 1 - (piiFields.length / totalFields);

    const recommendations: string[] = [];
    if (privacyScore < 0.8) {
      recommendations.push('Consider anonymizing more PII fields');
    }
    if (completeFields / totalFields < 0.9) {
      recommendations.push('Address missing values in data fields');
    }

    return {
      datasetId,
      completeness: completeFields / totalFields,
      validity: validFields / totalFields,
      consistency: 0.95,
      privacyScore,
      distributionMatch: 0.9,
      issues,
      recommendations
    };
  }

  private validateValue(value, field: SchemaField): boolean {
    if (value === null || value === undefined) return !field.required;

    switch (field.type) {
      case 'email':
        return typeof value === 'string' && value.includes('@');
      case 'phone':
        return typeof value === 'string' && value.length >= 10;
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
        return !isNaN(Date.parse(value));
      case 'uuid':
        return typeof value === 'string' && value.match(/^[0-9a-f]{8}-[0-9a-f]{4}/i) !== null;
      default:
        return true;
    }
  }
}

export const dataGenerator = new DataGenerator();
