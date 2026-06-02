// CoinType is canonical in constants/coins.ts — re-exported here for backward compat
import type { CoinType } from '../constants/coins';
export type { CoinType };

export interface WalletBalance {
  rez:      number;
  prive:    number;
  promo:    number;
  branded:  number;
  cashback: number;
  total:    number;
}

export interface CoinTransaction {
  _id:         string;
  coinType:    CoinType;
  amount:      number;
  type:        'earned' | 'spent' | 'expired' | 'refunded' | 'bonus' | 'branded_award';
  description: string;
  createdAt:   string;
}
