import { BaseServiceBuilder } from 'hedera-agent-kit';
import type { HederaAgentKit } from 'hedera-agent-kit';
import {
  inscribe,
  inscribeWithSigner,
  retrieveInscription,
  InscriptionInput,
  InscriptionOptions,
  InscriptionResponse,
  RetrievedInscriptionResult,
  HederaClientConfig,
  NetworkType,
} from '@hashgraphonline/standards-sdk';
import { InscriptionSDK } from '@kiloscribe/inscription-sdk';

/**
 * Type definition for DAppSigner interface compatible with inscription SDK
 */
interface DAppSigner {
  getAccountId(): { toString(): string };
  [key: string]: unknown;
}

/**
 * Builder for Inscription operations
 */
export class InscriberBuilder extends BaseServiceBuilder {
  protected inscriptionSDK?: InscriptionSDK;

  constructor(hederaKit: HederaAgentKit) {
    super(hederaKit);
  }

  /**
   * Get or create Inscription SDK - temporarily returns null since we don't have the actual SDK
   */
  protected async getInscriptionSDK(
    _options: InscriptionOptions
  ): Promise<InscriptionSDK | null> {
    return null;
  }

  /**
   * Inscribe content using server-side authentication
   */
  async inscribe(
    input: InscriptionInput,
    options: InscriptionOptions
  ): Promise<InscriptionResponse> {
    const operatorId = this.hederaKit.signer.getAccountId().toString();
    const operatorPrivateKey = this.hederaKit.signer?.getOperatorPrivateKey()
      ? this.hederaKit.signer.getOperatorPrivateKey().toStringRaw()
      : '';

    const network = this.hederaKit.client.network;
    const networkType: NetworkType = network.toString().includes('mainnet')
      ? 'mainnet'
      : 'testnet';

    const clientConfig: HederaClientConfig = {
      accountId: operatorId,
      privateKey: operatorPrivateKey,
      network: networkType,
    };

    return await inscribe(input, clientConfig, options);
  }

  /**
   * Inscribe content using a DApp signer
   */
  async inscribeWithSigner(
    input: InscriptionInput,
    signer: DAppSigner,
    options: InscriptionOptions
  ): Promise<InscriptionResponse> {
    return await inscribeWithSigner(input, signer as unknown as Parameters<typeof inscribeWithSigner>[1], options);
  }

  /**
   * Retrieve an existing inscription
   */
  async retrieveInscription(
    transactionId: string,
    options: InscriptionOptions
  ): Promise<RetrievedInscriptionResult> {
    const operatorId = this.hederaKit.signer.getAccountId().toString();
    const operatorPrivateKey = this.hederaKit.signer?.getOperatorPrivateKey()
      ? this.hederaKit.signer.getOperatorPrivateKey().toStringRaw()
      : '';

    return await retrieveInscription(transactionId, {
      ...options,
      accountId: operatorId,
      privateKey: operatorPrivateKey,
    });
  }

  /**
   * Close the inscription SDK
   */
  async close(): Promise<void> {
    this.inscriptionSDK = undefined;
  }
}