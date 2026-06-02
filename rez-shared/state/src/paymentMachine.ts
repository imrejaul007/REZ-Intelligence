import { PaymentStatus } from '@rez/enums';

export type PaymentEvent =
  | { type: 'INIT'; amount: number; currency: string }
  | { type: 'SUBMIT' }
  | { type: 'SUCCESS'; transactionId: string }
  | { type: 'FAIL'; error: string }
  | { type: 'RETRY' };

export interface PaymentState {
  status: PaymentStatus;
  amount: number;
  currency: string;
  transactionId?: string;
  error?: string;
  retryCount: number;
}

export class PaymentMachine {
  private state: PaymentState = {
    status: PaymentStatus.INIT,
    amount: 0,
    currency: 'USD',
    retryCount: 0,
  };

  getState(): PaymentState {
    return { ...this.state };
  }

  transition(event: PaymentEvent): PaymentState {
    const { status } = this.state;

    switch (event.type) {
      case 'INIT':
        if (status !== PaymentStatus.INIT) {
          throw new Error(`Cannot reinitialize payment in ${status} state`);
        }
        this.state = {
          ...this.state,
          amount: event.amount,
          currency: event.currency,
        };
        return this.state;

      case 'SUBMIT':
        if (status !== PaymentStatus.INIT) {
          throw new Error(`Can only submit from INIT state, current: ${status}`);
        }
        this.state = { ...this.state, status: PaymentStatus.PENDING };
        return this.state;

      case 'SUCCESS':
        if (status !== PaymentStatus.PENDING) {
          throw new Error(`Can only succeed from PENDING state, current: ${status}`);
        }
        this.state = {
          ...this.state,
          status: PaymentStatus.SUCCESS,
          transactionId: event.transactionId,
          error: undefined,
        };
        return this.state;

      case 'FAIL':
        if (status !== PaymentStatus.PENDING) {
          throw new Error(`Can only fail from PENDING state, current: ${status}`);
        }
        this.state = {
          ...this.state,
          status: PaymentStatus.FAILED,
          error: event.error,
        };
        return this.state;

      case 'RETRY':
        if (status !== PaymentStatus.FAILED || this.state.retryCount >= 3) {
          throw new Error('Cannot retry: invalid state or max retries exceeded');
        }
        this.state = {
          ...this.state,
          status: PaymentStatus.PENDING,
          retryCount: this.state.retryCount + 1,
          error: undefined,
        };
        return this.state;

      default:
        const _exhaustive: never = event;
        return _exhaustive;
    }
  }

  canTransition(event: PaymentEvent): boolean {
    try {
      const current = { ...this.state };
      this.transition(event);
      this.state = current;
      return true;
    } catch {
      return false;
    }
  }
}
