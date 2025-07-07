import { TransactionReceipt } from '@hashgraph/sdk';

export interface ExecuteResult {
  success: boolean;
  receipt?: TransactionReceipt;
  scheduleId?: string;
  error?: string;
  transactionId?: string | undefined;
  rawResult?: unknown;
  notes?: string[];
}