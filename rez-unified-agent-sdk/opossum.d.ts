declare module 'opossum' {
  export interface Options {
    timeout?: number;
    errorThresholdPercentage?: number;
    resetTimeout?: number;
    volumeThreshold?: number;
    enabled?: boolean;
  }

  export interface Stats {
    failures: number;
    successes: number;
    fallbacks: number;
    rejects: number;
    fires: number;
  }

  export type Status = 'closed' | 'open' | 'halfOpen';

  export default class CircuitBreaker {
    constructor(fn: Function, options?: Options);
    fire(...args: unknown[]): Promise<unknown>;
    isOpen(): boolean;
    isClosed(): boolean;
    opened: boolean;
    open: boolean;
    halfOpen: boolean;
    status: Status;
    stats: Stats;
    close(): void;
    open(): void;
    on(event: string, handler: Function): void;
  }
}
