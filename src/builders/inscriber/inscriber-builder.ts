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

/**
 * Type definition for DAppSigner since we don't have the actual package
 */
interface DAppSigner {
  getAccountId(): { toString(): string };
}

/**
 * Type definition for InscriptionSDK since we don't have the actual package
 */
interface InscriptionSDK {
  inscribeAndExecute(request: any, config: any): Promise<any>;
  inscribe(request: any, signer: any): Promise<any>;
  waitForInscription(txId: string, maxAttempts: number, intervalMs: number, checkCompletion: boolean, progressCallback?: Function): Promise<any>;
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
    options: InscriptionOptions
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
    return await inscribeWithSigner(input, signer as any, options);
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