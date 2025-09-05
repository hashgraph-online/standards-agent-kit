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
  getTopicId,
} from '@hashgraphonline/standards-sdk';
import { InscriptionSDK } from '@kiloscribe/inscription-sdk';
import type { AgentOperationalMode } from 'hedera-agent-kit';

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
  private static signerProvider?: () => Promise<DAppSigner | null> | DAppSigner | null;
  private static walletInfoResolver?: () => Promise<{ accountId: string; network: 'mainnet' | 'testnet' } | null> | { accountId: string; network: 'mainnet' | 'testnet' } | null;
  private static startInscriptionDelegate?: (
    request: Record<string, unknown>,
    network: 'mainnet' | 'testnet'
  ) => Promise<{
    transactionBytes: string;
    tx_id?: string;
    topic_id?: string;
    status?: string;
    completed?: boolean;
  }>;
  private static walletExecutor?: (
    base64: string,
    network: 'mainnet' | 'testnet'
  ) => Promise<{ transactionId: string }>;
  /** When true, do not allow server fallback; require a wallet path in Provide Bytes */
  private static preferWalletOnly = false;

  constructor(hederaKit: HederaAgentKit) {
    super(hederaKit);
  }

  public getOperationalMode(): AgentOperationalMode {
    return this.hederaKit.operationalMode as AgentOperationalMode;
  }

  static setSignerProvider(
    provider: () => Promise<DAppSigner | null> | DAppSigner | null
  ): void {
    InscriberBuilder.signerProvider = provider;
  }

  static setWalletInfoResolver(
    resolver: () => Promise<{ accountId: string; network: 'mainnet' | 'testnet' } | null> | { accountId: string; network: 'mainnet' | 'testnet' } | null
  ): void {
    InscriberBuilder.walletInfoResolver = resolver;
  }

  static setStartInscriptionDelegate(
    delegate: (
      request: Record<string, unknown>,
      network: 'mainnet' | 'testnet'
    ) => Promise<{ transactionBytes: string; tx_id?: string; topic_id?: string; status?: string; completed?: boolean }>
  ): void {
    InscriberBuilder.startInscriptionDelegate = delegate;
  }

  static setWalletExecutor(
    executor: (base64: string, network: 'mainnet' | 'testnet') => Promise<{ transactionId: string }>
  ): void {
    InscriberBuilder.walletExecutor = executor;
  }

  /**
   * Control fallback behavior. When true, wallet must be available for execution paths.
   */
  static setPreferWalletOnly(flag: boolean): void {
    InscriberBuilder.preferWalletOnly = !!flag;
  }

  async getSigner(): Promise<DAppSigner | null> {
    const provider = InscriberBuilder.signerProvider;
    if (!provider) return null;
    try {
      const maybe = provider();
      return (maybe && typeof (maybe as Promise<unknown>).then === 'function')
        ? await (maybe as Promise<DAppSigner | null>)
        : (maybe as DAppSigner | null);
    } catch {
      return null;
    }
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
    return await inscribeWithSigner(
      input,
      signer as unknown as Parameters<typeof inscribeWithSigner>[1],
      options
    );
  }

  async inscribeAuto(
    input: InscriptionInput,
    options: InscriptionOptions
  ): Promise<InscriptionResponse> {
    const signer = await this.getSigner();
    if (signer) {
      return this.inscribeWithSigner(input, signer, options);
    }

    type WalletInfo = { accountId: string; network: 'mainnet' | 'testnet' };
    type WalletStartResponse = {
      transactionBytes: string;
      tx_id?: string;
      topic_id?: string;
      status?: string;
      completed?: boolean;
    };
    type WalletExecutorResponse = { transactionId: string };

    const infoMaybe: WalletInfo | null = InscriberBuilder.walletInfoResolver
      ? await InscriberBuilder.walletInfoResolver()
      : null;

    if (InscriberBuilder.preferWalletOnly && !infoMaybe) {
      const err = new Error('Wallet unavailable: connect a wallet or switch to autonomous mode');
      (err as unknown as { code: string }).code = 'wallet_unavailable';
      throw err;
    }

    if (
      infoMaybe &&
      InscriberBuilder.startInscriptionDelegate &&
      InscriberBuilder.walletExecutor
    ) {
      const holderId = infoMaybe.accountId;
      const network: 'mainnet' | 'testnet' = infoMaybe.network;

      type InscriptionOptionsExt = InscriptionOptions & {
        fileStandard?: string;
        chunkSize?: number;
        jsonFileURL?: string;
        metadata?: Record<string, unknown> & { creator?: string; description?: string };
      };
      const ext = options as InscriptionOptionsExt;

      const baseRequest: Record<string, unknown> = {
        holderId,
        metadata: ext.metadata || {},
        tags: options.tags || [],
        mode: options.mode || 'file',
      };
      if (typeof ext.fileStandard !== 'undefined') {
        (baseRequest as { fileStandard?: string }).fileStandard = ext.fileStandard;
      }
      if (typeof ext.chunkSize !== 'undefined') {
        (baseRequest as { chunkSize?: number }).chunkSize = ext.chunkSize;
      }

      let request: Record<string, unknown> = { ...baseRequest };
      switch (input.type) {
        case 'url':
          request = { ...baseRequest, file: { type: 'url', url: input.url } };
          break;
        case 'file':
          request = { ...baseRequest, file: { type: 'path', path: input.path } };
          break;
        case 'buffer':
          request = {
            ...baseRequest,
            file: {
              type: 'base64',
              base64: Buffer.from(input.buffer).toString('base64'),
              fileName: input.fileName,
              mimeType: input.mimeType,
            },
          };
          break;
      }

      if (options.mode === 'hashinal') {
        (request as { metadataObject?: unknown }).metadataObject = ext.metadata;
        (request as { creator?: string }).creator = ext.metadata?.creator || holderId;
        (request as { description?: string }).description = ext.metadata?.description;
        if (typeof ext.jsonFileURL === 'string' && ext.jsonFileURL.length > 0) {
          (request as { jsonFileURL?: string }).jsonFileURL = ext.jsonFileURL;
        }
      }

      const start: WalletStartResponse = await InscriberBuilder.startInscriptionDelegate(
        request,
        network
      );
      if (!start || !start.transactionBytes) {
        throw new Error('Failed to start inscription (no transaction bytes)');
      }

      const exec: WalletExecutorResponse = await InscriberBuilder.walletExecutor(
        start.transactionBytes,
        network
      );
      const transactionId = exec?.transactionId || '';

      const shouldWait = options.quoteOnly ? false : options.waitForConfirmation ?? true;
      if (shouldWait) {
        const maxAttempts = (options as { waitMaxAttempts?: number }).waitMaxAttempts ?? 60;
        const intervalMs = (options as { waitIntervalMs?: number }).waitIntervalMs ?? 5000;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const retrieved: RetrievedInscriptionResult = await this.retrieveInscription(
              transactionId,
              options
            );
            const topicIdFromInscription: string | undefined = getTopicId(retrieved as unknown);
            const topicId: string | undefined = topicIdFromInscription ?? start.topic_id;
            const status: string | undefined = (retrieved as { status?: string }).status;
            const isDone = status === 'completed' || !!topicId;
            if (isDone) {
              const resultConfirmed: InscriptionResponse = {
                quote: false,
                confirmed: true,
                result: {
                  jobId: start.tx_id || '',
                  transactionId,
                  topicId,
                },
                inscription: retrieved,
              } as unknown as InscriptionResponse;
              return resultConfirmed;
            }
          } catch {
          }
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
      }

      const partial: InscriptionResponse = {
        quote: false,
        confirmed: false,
        result: {
          jobId: start.tx_id || '',
          transactionId,
          status: start.status,
          completed: start.completed,
        },
        inscription: start.topic_id ? { topic_id: start.topic_id } : undefined,
      } as unknown as InscriptionResponse;
      return partial;
    }

    if (InscriberBuilder.preferWalletOnly) {
      const err = new Error('Wallet unavailable: connect a wallet or switch to autonomous mode');
      (err as unknown as { code: string }).code = 'wallet_unavailable';
      throw err;
    }
    return this.inscribe(input, options);
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
