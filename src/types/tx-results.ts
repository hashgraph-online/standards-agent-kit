import type { TopicRegistrationResponse, RegistryOperationResponse, HCS6TopicRegistrationResponse, HCS6RegistryOperationResponse, HCS6CreateHashinalResponse } from '@hashgraphonline/standards-sdk';

export interface WalletBytesResponse {
  success: true;
  transactionBytes: string;
}

export function isWalletBytesResponse(value: unknown): value is WalletBytesResponse {
  return !!value && typeof (value as any).transactionBytes === 'string';
}

export type TopicRegistrationResult = TopicRegistrationResponse | WalletBytesResponse;
export type RegistryOperationResult = RegistryOperationResponse | WalletBytesResponse;
export type SubmitMessageResult = { success: true; transactionId?: string } | WalletBytesResponse;

export type HCS6TopicRegistrationResult = HCS6TopicRegistrationResponse | WalletBytesResponse;
export type HCS6RegistryOperationResult = HCS6RegistryOperationResponse | WalletBytesResponse;
export type HCS6CreateHashinalResult = HCS6CreateHashinalResponse | WalletBytesResponse;
