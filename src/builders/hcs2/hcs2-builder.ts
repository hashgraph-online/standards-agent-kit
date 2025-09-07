import { BaseServiceBuilder } from 'hedera-agent-kit';
import type { HederaAgentKit } from 'hedera-agent-kit';
import {
  HCS2Client,
  SDKHCS2ClientConfig,
  CreateRegistryOptions,
  RegisterEntryOptions,
  UpdateEntryOptions,
  DeleteEntryOptions,
  MigrateTopicOptions,
  QueryRegistryOptions,
  TopicRegistrationResponse,
  RegistryOperationResponse,
  TopicRegistry,
  NetworkType,
  HederaMirrorNode,
} from '@hashgraphonline/standards-sdk';
import { SignerProviderRegistry, type NetworkString } from '../../signing/signer-provider';
import type { TopicRegistrationResult, RegistryOperationResult, SubmitMessageResult } from '../../types/tx-results';
import { CodedError } from '../../utils/CodedError';

/**
 * Builder for HCS-2 operations that delegates to HCS2Client
 */
export class HCS2Builder extends BaseServiceBuilder {
  protected hcs2Client?: HCS2Client;

  constructor(hederaKit: HederaAgentKit) {
    super(hederaKit);
  }

  /**
   * Get or create HCS-2 client
   */
  protected async getHCS2Client(): Promise<HCS2Client> {
    if (!this.hcs2Client) {
      const operatorId = this.hederaKit.signer.getAccountId().toString();
      const operatorPrivateKey = this.hederaKit.signer?.getOperatorPrivateKey()
        ? this.hederaKit.signer.getOperatorPrivateKey().toStringRaw()
        : '';

      const network = this.hederaKit.client.network;
      const networkType: NetworkType = network.toString().includes('mainnet')
        ? 'mainnet'
        : 'testnet';

      let keyTypeHint: 'ed25519' | 'ecdsa' | undefined;
      try {
        const mirror = new HederaMirrorNode(networkType);
        const info = await mirror.requestAccount(operatorId);
        const t = (info as any)?.key?._type as string | undefined;
        if (t) {
          const upper = t.toUpperCase();
          if (upper.includes('ED25519')) keyTypeHint = 'ed25519';
          else if (upper.includes('ECDSA')) keyTypeHint = 'ecdsa';
        }
      } catch {}

      const config: SDKHCS2ClientConfig = {
        network: networkType,
        operatorId: operatorId,
        operatorKey: operatorPrivateKey,
        ...(keyTypeHint ? { keyType: keyTypeHint } : {}),
      };

      this.hcs2Client = new HCS2Client(config);
    }
    return this.hcs2Client;
  }

  /**
   * Create a new HCS-2 registry
   * Note: This executes the transaction directly via HCS2Client
   */
  async createRegistry(
    options: CreateRegistryOptions = {}
  ): Promise<TopicRegistrationResult> {
    const exec = SignerProviderRegistry.walletExecutor;
    const preferWallet = SignerProviderRegistry.preferWalletOnly;
    const hasPrivateKey = !!(this.hederaKit?.signer?.getOperatorPrivateKey && this.hederaKit.signer.getOperatorPrivateKey());

    if (exec) {
      const start = SignerProviderRegistry.startHCSDelegate;
      if (start) {
        try {
          const request: Record<string, unknown> = { options };
          const network = (this.hederaKit.client.network.toString().includes('mainnet') ? 'mainnet' : 'testnet') as NetworkString;
          const { transactionBytes } = await start('hcs2.createRegistry', request, network);
          if (transactionBytes) {
            return { success: true, transactionBytes };
          }
        } catch (err) {
          if (preferWallet) {
            throw new CodedError('wallet_submit_failed', `wallet_submit_failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
      if (preferWallet) {
        throw new CodedError('wallet_unavailable', 'WalletExecutor not configured for hcs2.createRegistry');
      }
    }

    if (!hasPrivateKey) {
      throw new CodedError('wallet_unavailable', 'No wallet executor and no operator private key available for server execution');
    }
    const client = await this.getHCS2Client();
    return await client.createRegistry(options);
  }
  /**
   * Register a new entry in an HCS-2 registry
   */
  async registerEntry(
    registryTopicId: string,
    options: RegisterEntryOptions
  ): Promise<RegistryOperationResult> {
    const exec = SignerProviderRegistry.walletExecutor;
    const preferWallet = SignerProviderRegistry.preferWalletOnly;
    const network = (this.hederaKit.client.network.toString().includes('mainnet') ? 'mainnet' : 'testnet') as NetworkString;
    const hasPrivateKey = !!(this.hederaKit?.signer?.getOperatorPrivateKey && this.hederaKit.signer.getOperatorPrivateKey());

    try {
      const { ByteBuildRegistry } = await import('../../signing/bytes-registry');
      if (ByteBuildRegistry.has('hcs2.registerEntry')) {
        const built = await ByteBuildRegistry.build('hcs2.registerEntry', this.hederaKit, { registryTopicId, options });
        if (built && built.transactionBytes) {
          if (exec) {
            return { success: true, transactionBytes: built.transactionBytes };
          }
          if (!hasPrivateKey) {
            return { success: true, transactionBytes: built.transactionBytes };
          }
        }
      }
    } catch {}

    const start = SignerProviderRegistry.startHCSDelegate;
    if (start) {
      try {
        const request: Record<string, unknown> = {
          registryTopicId,
          options,
        };
        const { transactionBytes } = await start('hcs2.registerEntry', request, network);
        if (transactionBytes) {
          if (exec) {
            return { success: true, transactionBytes };
          }
          if (!hasPrivateKey) {
            return { success: true, transactionBytes };
          }
        }
      } catch (err) {
        if (preferWallet) {
          const msg = `wallet_submit_failed: ${err instanceof Error ? err.message : String(err)}`;
          throw new CodedError('wallet_submit_failed', msg);
        }
      }
    }

    if (preferWallet) {
      throw new CodedError('wallet_unavailable', 'WalletExecutor not configured for hcs2.registerEntry');
    }

    if (!hasPrivateKey) {
      throw new CodedError('wallet_unavailable', 'No wallet executor and no operator private key available for server execution');
    }
    const client = await this.getHCS2Client();
    return await client.registerEntry(registryTopicId, options);
  }

  /**
   * Update an existing entry in an HCS-2 registry
   */
  async updateEntry(
    registryTopicId: string,
    options: UpdateEntryOptions
  ): Promise<RegistryOperationResult> {
    const exec = SignerProviderRegistry.walletExecutor;
    const preferWallet = SignerProviderRegistry.preferWalletOnly;
    const network = (this.hederaKit.client.network.toString().includes('mainnet') ? 'mainnet' : 'testnet') as NetworkString;
    const hasPrivateKey = !!(this.hederaKit?.signer?.getOperatorPrivateKey && this.hederaKit.signer.getOperatorPrivateKey());

    try {
      const { ByteBuildRegistry } = await import('../../signing/bytes-registry');
      if (ByteBuildRegistry.has('hcs2.updateEntry')) {
        const built = await ByteBuildRegistry.build('hcs2.updateEntry', this.hederaKit, { registryTopicId, options });
        if (built && built.transactionBytes) {
          if (exec) {
            return { success: true, transactionBytes: built.transactionBytes };
          }
          if (!hasPrivateKey) {
            return { success: true, transactionBytes: built.transactionBytes };
          }
        }
      }
    } catch {}

    const start = SignerProviderRegistry.startHCSDelegate;
    if (start) {
      try {
        const request: Record<string, unknown> = {
          registryTopicId,
          options,
        };
        const { transactionBytes } = await start('hcs2.updateEntry', request, network);
        if (transactionBytes) {
          if (exec) {
            return { success: true, transactionBytes };
          }
          if (!hasPrivateKey) {
            return { success: true, transactionBytes };
          }
        }
      } catch (err) {
        if (preferWallet) {
          const msg = `wallet_submit_failed: ${err instanceof Error ? err.message : String(err)}`;
          throw new CodedError('wallet_submit_failed', msg);
        }
      }
    }

    if (preferWallet) {
      throw new CodedError('wallet_unavailable', 'WalletExecutor not configured for hcs2.updateEntry');
    }

    if (!hasPrivateKey) {
      throw new CodedError('wallet_unavailable', 'No wallet executor and no operator private key available for server execution');
    }
    const client = await this.getHCS2Client();
    return await client.updateEntry(registryTopicId, options);
  }

  /**
   * Delete an entry from an HCS-2 registry
   */
  async deleteEntry(
    registryTopicId: string,
    options: DeleteEntryOptions
  ): Promise<RegistryOperationResult> {
    const exec = SignerProviderRegistry.walletExecutor;
    const preferWallet = SignerProviderRegistry.preferWalletOnly;
    const network = (this.hederaKit.client.network.toString().includes('mainnet') ? 'mainnet' : 'testnet') as NetworkString;
    const hasPrivateKey = !!(this.hederaKit?.signer?.getOperatorPrivateKey && this.hederaKit.signer.getOperatorPrivateKey());

    try {
      const { ByteBuildRegistry } = await import('../../signing/bytes-registry');
      if (ByteBuildRegistry.has('hcs2.deleteEntry')) {
        const built = await ByteBuildRegistry.build('hcs2.deleteEntry', this.hederaKit, { registryTopicId, options });
        if (built && built.transactionBytes) {
          if (exec) {
            return { success: true, transactionBytes: built.transactionBytes };
          }
          if (!hasPrivateKey) {
            return { success: true, transactionBytes: built.transactionBytes };
          }
        }
      }
    } catch {}

    const start = SignerProviderRegistry.startHCSDelegate;
    if (start) {
      try {
        const request: Record<string, unknown> = {
          registryTopicId,
          options,
        };
        const { transactionBytes } = await start('hcs2.deleteEntry', request, network);
        if (transactionBytes) {
          if (exec) {
            return { success: true, transactionBytes };
          }
          if (!hasPrivateKey) {
            return { success: true, transactionBytes };
          }
        }
      } catch (err) {
        if (preferWallet) {
          const msg = `wallet_submit_failed: ${err instanceof Error ? err.message : String(err)}`;
          throw new CodedError('wallet_submit_failed', msg);
        }
      }
    }

    if (preferWallet) {
      throw new CodedError('wallet_unavailable', 'WalletExecutor not configured for hcs2.deleteEntry');
    }

    if (!hasPrivateKey) {
      throw new CodedError('wallet_unavailable', 'No wallet executor and no operator private key available for server execution');
    }
    const client = await this.getHCS2Client();
    return await client.deleteEntry(registryTopicId, options);
  }

  /**
   * Migrate an HCS-2 registry to a new topic
   */
  async migrateRegistry(
    registryTopicId: string,
    options: MigrateTopicOptions
  ): Promise<RegistryOperationResult> {
    const exec = SignerProviderRegistry.walletExecutor;
    const preferWallet = SignerProviderRegistry.preferWalletOnly;
    const hasPrivateKey = !!(this.hederaKit?.signer?.getOperatorPrivateKey && this.hederaKit.signer.getOperatorPrivateKey());

    try {
      const { ByteBuildRegistry } = await import('../../signing/bytes-registry');
      if (ByteBuildRegistry.has('hcs2.migrateRegistry')) {
        const built = await ByteBuildRegistry.build('hcs2.migrateRegistry', this.hederaKit, { registryTopicId, options });
        if (built && built.transactionBytes) {
          if (exec) {
            return { success: true, transactionBytes: built.transactionBytes };
          }
          if (!hasPrivateKey) {
            return { success: true, transactionBytes: built.transactionBytes };
          }
        }
      }
    } catch {}

    const start = SignerProviderRegistry.startHCSDelegate;
    if (start) {
      try {
        const request: Record<string, unknown> = { registryTopicId, options };
        const network = (this.hederaKit.client.network.toString().includes('mainnet') ? 'mainnet' : 'testnet') as NetworkString;
        const { transactionBytes } = await start('hcs2.migrateRegistry', request, network);
        if (transactionBytes) {
          if (exec) {
            return { success: true, transactionBytes };
          }
          if (!hasPrivateKey) {
            return { success: true, transactionBytes };
          }
        }
      } catch (err) {
        if (preferWallet) {
          const msg = `wallet_submit_failed: ${err instanceof Error ? err.message : String(err)}`;
          throw new CodedError('wallet_submit_failed', msg);
        }
      }
    }

    if (preferWallet) {
      throw new CodedError('wallet_unavailable', 'WalletExecutor not configured for hcs2.migrateRegistry');
    }

    if (!hasPrivateKey) {
      throw new CodedError('wallet_unavailable', 'No wallet executor and no operator private key available for server execution');
    }
    const client = await this.getHCS2Client();
    return await client.migrateRegistry(registryTopicId, options);
  }

  /**
   * Query entries from an HCS-2 registry
   */
  async getRegistry(
    topicId: string,
    options: QueryRegistryOptions = {}
  ): Promise<TopicRegistry> {
    const client = await this.getHCS2Client();
    return await client.getRegistry(topicId, options);
  }

  /**
   * Submit a raw message to an HCS-2 topic
   */
  async submitMessage(
    topicId: string,
    payload: any
  ): Promise<SubmitMessageResult> {
    const exec = SignerProviderRegistry.walletExecutor;
    const preferWallet = SignerProviderRegistry.preferWalletOnly;
    const network = (this.hederaKit.client.network.toString().includes('mainnet') ? 'mainnet' : 'testnet') as NetworkString;
    const hasPrivateKey = !!(this.hederaKit?.signer?.getOperatorPrivateKey && this.hederaKit.signer.getOperatorPrivateKey());

    try {
      const { ByteBuildRegistry } = await import('../../signing/bytes-registry');
      if (ByteBuildRegistry.has('hcs2.submitMessage')) {
        const built = await ByteBuildRegistry.build('hcs2.submitMessage', this.hederaKit, { topicId, payload });
        if (built && built.transactionBytes) {
          if (exec) {
            return { success: true, transactionBytes: built.transactionBytes };
          }
          if (!hasPrivateKey) {
            return { success: true, transactionBytes: built.transactionBytes };
          }
        }
      }
    } catch {}

    const start = SignerProviderRegistry.startHCSDelegate;
    if (start) {
      try {
        const request: Record<string, unknown> = { topicId, payload };
        const { transactionBytes } = await start('hcs2.submitMessage', request, network);
        if (transactionBytes) {
          if (exec) {
            return { success: true, transactionBytes };
          }
          if (!hasPrivateKey) {
            return { success: true, transactionBytes };
          }
        }
      } catch (err) {
        if (preferWallet) {
          const msg = `wallet_submit_failed: ${err instanceof Error ? err.message : String(err)}`;
          throw new CodedError('wallet_submit_failed', msg);
        }
      }
    }

    if (preferWallet) {
      throw new CodedError('wallet_unavailable', 'WalletExecutor not configured for hcs2.submitMessage');
    }

    if (!hasPrivateKey) {
      throw new CodedError('wallet_unavailable', 'No wallet executor and no operator private key available for server execution');
    }
    const client = await this.getHCS2Client();
    await client.submitMessage(topicId, payload);
    return { success: true };
  }
  /**
   * Get topic info from mirror node
   */
  async getTopicInfo(topicId: string): Promise<any> {
    const client = await this.getHCS2Client();
    return await client.getTopicInfo(topicId);
  }

  /**
   * Close the HCS-2 client
   */
  async close(): Promise<void> {
    if (this.hcs2Client) {
      this.hcs2Client.close();
      this.hcs2Client = undefined;
    }
  }
}