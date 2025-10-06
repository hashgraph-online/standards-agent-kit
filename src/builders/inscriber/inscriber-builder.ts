import { BaseServiceBuilder } from 'hedera-agent-kit';
import type { HederaAgentKit } from 'hedera-agent-kit';
import {
  inscribe,
  inscribeWithSigner,
  retrieveInscription,
  getOrCreateSDK,
  InscriptionInput,
  InscriptionOptions,
  InscriptionResponse,
  RetrievedInscriptionResult,
  HederaClientConfig,
  NetworkType,
  getTopicId,
  Logger,
} from '@hashgraphonline/standards-sdk';
import type {
  InscriptionSDK,
  InscriptionResult,
  RegistrationProgressData,
} from '@kiloscribe/inscription-sdk';
import type { AgentOperationalMode } from 'hedera-agent-kit';

/**
 * Type definition for DAppSigner interface compatible with inscription SDK
 */
interface DAppSigner {
  getAccountId(): { toString(): string };
  [key: string]: unknown;
}

export interface PendingInscriptionResponse {
  transactionBytes: string;
  tx_id?: string;
  topic_id?: string;
  status?: string;
  completed?: boolean;
}

export interface CompletedInscriptionResponse {
  confirmed?: boolean;
  result?: InscriptionResult;
  inscription?: RetrievedInscriptionResult;
  jsonTopicId?: string;
  network?: string;
}
/**
 * Builder for Inscription operations
 */
type InscriptionSDKInstance = InscriptionSDK;

export const toDashedTransactionId = (transactionId: string): string => {
  if (transactionId.includes('-')) {
    return transactionId;
  }

  const [account, timePart] = transactionId.split('@');
  if (!account || !timePart) {
    return transactionId;
  }

  const [secondsPart, nanosPart] = timePart.split('.');
  if (!secondsPart) {
    return transactionId;
  }

  const normalizedNanos = (nanosPart ?? '0').padEnd(9, '0').slice(0, 9);
  return `${account}-${secondsPart}-${normalizedNanos}`;
};

export class InscriberBuilder extends BaseServiceBuilder {
  protected inscriptionSDK?: InscriptionSDKInstance;
  private static signerProvider?: () =>
    | Promise<DAppSigner | null>
    | DAppSigner
    | null;
  private static walletInfoResolver?: () =>
    | Promise<{ accountId: string; network: 'mainnet' | 'testnet' } | null>
    | { accountId: string; network: 'mainnet' | 'testnet' }
    | null;

  private static startInscriptionDelegate?: (
    request: Record<string, unknown>,
    network: 'mainnet' | 'testnet'
  ) => Promise<PendingInscriptionResponse | CompletedInscriptionResponse>;
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
    resolver: () =>
      | Promise<{ accountId: string; network: 'mainnet' | 'testnet' } | null>
      | { accountId: string; network: 'mainnet' | 'testnet' }
      | null
  ): void {
    InscriberBuilder.walletInfoResolver = resolver;
  }

  static setStartInscriptionDelegate(
    delegate: (
      request: Record<string, unknown>,
      network: 'mainnet' | 'testnet'
    ) => Promise<PendingInscriptionResponse | CompletedInscriptionResponse>
  ): void {
    InscriberBuilder.startInscriptionDelegate = delegate;
  }

  static setWalletExecutor(
    executor: (
      base64: string,
      network: 'mainnet' | 'testnet'
    ) => Promise<{ transactionId: string }>
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
      return maybe && typeof (maybe as Promise<unknown>).then === 'function'
        ? await (maybe as Promise<DAppSigner | null>)
        : (maybe as DAppSigner | null);
    } catch {
      return null;
    }
  }

  /**
   * Get or create Inscription SDK
   */
  protected async getInscriptionSDK(
    options: InscriptionOptions
  ): Promise<InscriptionSDKInstance | null> {
    if (this.inscriptionSDK) {
      return this.inscriptionSDK;
    }

    const network = this.hederaKit.client.network;
    const networkType: 'mainnet' | 'testnet' = network
      .toString()
      .includes('mainnet')
      ? 'mainnet'
      : 'testnet';
    const accountId = this.hederaKit.signer.getAccountId().toString();
    const operatorKey = this.hederaKit.signer?.getOperatorPrivateKey();
    const baseOptions: InscriptionOptions = {
      ...options,
      network: options.network ?? networkType,
    };

    const apiKey = baseOptions.apiKey ?? (operatorKey ? undefined : 'public-access');
    const effectiveOptions: InscriptionOptions = apiKey
      ? { ...baseOptions, apiKey }
      : baseOptions;

    const clientConfig = {
      accountId,
      privateKey: operatorKey?.toStringRaw() ?? apiKey ?? 'public-access',
      network: networkType,
    };

    try {
      this.inscriptionSDK = await getOrCreateSDK(
        clientConfig,
        effectiveOptions,
        this.inscriptionSDK
      );
      return this.inscriptionSDK;
    } catch (error) {
      this.logger.error('failed to setup sdk', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.inscriptionSDK = undefined;
      return null;
    }
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

    type WalletExecutorResponse = { transactionId: string };

    const infoMaybe: WalletInfo | null = InscriberBuilder.walletInfoResolver
      ? await InscriberBuilder.walletInfoResolver()
      : null;

    if (InscriberBuilder.preferWalletOnly && !infoMaybe) {
      const err = new Error(
        'Wallet unavailable: connect a wallet or switch to autonomous mode'
      );
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
        metadata?: Record<string, unknown> & {
          creator?: string;
          description?: string;
        };
      };
      const ext = options as InscriptionOptionsExt;

      const baseRequest: Record<string, unknown> = {
        holderId,
        metadata: ext.metadata || {},
        tags: options.tags || [],
        mode: options.mode || 'file',
      };
      if (typeof ext.fileStandard !== 'undefined') {
        (baseRequest as { fileStandard?: string }).fileStandard =
          ext.fileStandard;
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
          request = {
            ...baseRequest,
            file: { type: 'path', path: input.path },
          };
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
        (request as { creator?: string }).creator =
          ext.metadata?.creator || holderId;
        (request as { description?: string }).description =
          ext.metadata?.description;
        if (typeof ext.jsonFileURL === 'string' && ext.jsonFileURL.length > 0) {
          (request as { jsonFileURL?: string }).jsonFileURL = ext.jsonFileURL;
        }
      }

      const start = await InscriberBuilder.startInscriptionDelegate(
        request,
        network
      );

      this.logger.info('inscribeAuto start response', {
        hasTransactionBytes:
          typeof (start as { transactionBytes?: unknown }).transactionBytes ===
          'string',
        txId: (start as { tx_id?: unknown }).tx_id,
        status: (start as { status?: unknown }).status,
      });

      const completedStart = start as CompletedInscriptionResponse;
      const isCompletedResponse =
        Boolean(completedStart?.inscription) && completedStart?.confirmed;

      if (isCompletedResponse) {
        const completed = start as {
          confirmed?: boolean;
          result?: unknown;
          inscription?: unknown;
        };
        this.logger.info(
          'inscription already completed, short circuiting',
          start
        );
        return {
          quote: false,
          confirmed: completed.confirmed === true,
          result: completed.result as InscriptionResult,
          inscription: completed.inscription,
        } as unknown as InscriptionResponse;
      }

      const startResponse = start as {
        transactionBytes: string;
        tx_id?: string;
        topic_id?: string;
        status?: string;
        completed?: boolean;
      };

      if (!startResponse || !startResponse.transactionBytes) {
        throw new Error('Failed to start inscription (no transaction bytes)');
      }

      const exec: WalletExecutorResponse =
        await InscriberBuilder.walletExecutor(
          startResponse.transactionBytes,
          network
        );
      const transactionId = exec?.transactionId || '';
      const rawTransactionId = startResponse.tx_id || transactionId;
      const canonicalTransactionId = toDashedTransactionId(rawTransactionId);

      this.logger.info('inscribeAuto wallet execution', {
        transactionId,
        network,
      });

      const shouldWait = options.quoteOnly
        ? false
        : options.waitForConfirmation ?? true;
      if (shouldWait) {
        const maxAttempts =
          (options as { waitMaxAttempts?: number }).waitMaxAttempts ?? 60;
        const intervalMs =
          (options as { waitIntervalMs?: number }).waitIntervalMs ?? 5000;
        const pollId = canonicalTransactionId;
        this.logger.debug('Will be retrieving inscription', pollId);

        let retrieved: RetrievedInscriptionResult | null = null;
        const sdk = await this.getInscriptionSDK(options);

        if (sdk) {
          try {
            retrieved = await sdk.waitForInscription(
              pollId,
              maxAttempts,
              intervalMs,
              true,
              (progress: RegistrationProgressData) => {
                this.logger.debug('checking inscription', progress);
              }
            );
          } catch (error) {
            this.logger.warn('Primary inscription wait failed', {
              pollId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        } else {
          this.logger.warn(
            'No inscription SDK available, using public client',
            {
              pollId,
            }
          );
        }

        if (retrieved) {
          const topicIdFromInscription: string | undefined = getTopicId(
            retrieved as unknown
          );
          const topicId: string | undefined =
            topicIdFromInscription ?? startResponse.topic_id;
          const resultConfirmed: InscriptionResponse = {
            quote: false,
            confirmed: true,
            result: {
              jobId: toDashedTransactionId(startResponse.tx_id || ''),
              transactionId: canonicalTransactionId,
              topicId,
            },
            inscription: retrieved,
          } as unknown as InscriptionResponse;
          this.logger.debug(
            'retrieved inscription confirmed',
            resultConfirmed,
            retrieved
          );
          return resultConfirmed;
        }
      }

      const partial: InscriptionResponse = {
        quote: false,
        confirmed: false,
        result: {
          jobId: toDashedTransactionId(startResponse.tx_id || ''),
          transactionId: canonicalTransactionId,
          status: startResponse.status,
          completed: startResponse.completed,
        },
        inscription: startResponse.topic_id
          ? { topic_id: startResponse.topic_id }
          : undefined,
      } as unknown as InscriptionResponse;
      return partial;
    }

    if (InscriberBuilder.preferWalletOnly) {
      const err = new Error(
        'Wallet unavailable: connect a wallet or switch to autonomous mode'
      );
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
