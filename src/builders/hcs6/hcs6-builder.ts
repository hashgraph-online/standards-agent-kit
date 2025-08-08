import { BaseServiceBuilder } from 'hedera-agent-kit';
import type { HederaAgentKit } from 'hedera-agent-kit';
import {
  HCS6Client,
  SDKHCS6ClientConfig,
  HCS6CreateRegistryOptions,
  HCS6RegisterEntryOptions,
  HCS6QueryRegistryOptions,
  HCS6RegisterOptions,
  HCS6CreateHashinalOptions,
  HCS6TopicRegistrationResponse,
  HCS6RegistryOperationResponse,
  HCS6TopicRegistry,
  HCS6CreateHashinalResponse,
  NetworkType,
} from '@hashgraphonline/standards-sdk';

/**
 * Builder for HCS-6 operations that delegates to HCS6Client
 */
export class HCS6Builder extends BaseServiceBuilder {
  protected hcs6Client?: HCS6Client;

  constructor(hederaKit: HederaAgentKit) {
    super(hederaKit);
  }

  /**
   * Get or create HCS-6 client
   */
  protected async getHCS6Client(): Promise<HCS6Client> {
    if (!this.hcs6Client) {
      const operatorId = this.hederaKit.signer.getAccountId().toString();
      const operatorPrivateKey = this.hederaKit.signer?.getOperatorPrivateKey()
        ? this.hederaKit.signer.getOperatorPrivateKey().toString()
        : '';

      const network = this.hederaKit.client.network;
      const networkType: NetworkType = network.toString().includes('mainnet')
        ? 'mainnet'
        : 'testnet';

      const config: SDKHCS6ClientConfig = {
        network: networkType,
        operatorId: operatorId,
        operatorKey: operatorPrivateKey,
      };

      this.hcs6Client = new HCS6Client(config);
    }
    return this.hcs6Client;
  }

  /**
   * Create a new HCS-6 dynamic registry
   * Note: This executes the transaction directly via HCS6Client
   */
  async createRegistry(
    options: HCS6CreateRegistryOptions = {}
  ): Promise<HCS6TopicRegistrationResponse> {
    const client = await this.getHCS6Client();
    const sanitized = { ...options };
    if ('adminKey' in sanitized) {
      delete (sanitized as any).adminKey;
    }
    return await client.createRegistry(sanitized);
  }

  /**
   * Register a new dynamic hashinal entry in an HCS-6 registry
   */
  async registerEntry(
    registryTopicId: string,
    options: HCS6RegisterEntryOptions
  ): Promise<HCS6RegistryOperationResponse> {
    const client = await this.getHCS6Client();
    return await client.registerEntry(registryTopicId, options);
  }

  /**
   * Query entries from an HCS-6 registry
   */
  async getRegistry(
    topicId: string,
    options: HCS6QueryRegistryOptions = {}
  ): Promise<HCS6TopicRegistry> {
    const client = await this.getHCS6Client();
    return await client.getRegistry(topicId, options);
  }

  /**
   * Create a complete dynamic hashinal with inscription and registry
   */
  async createHashinal(
    options: HCS6CreateHashinalOptions
  ): Promise<HCS6CreateHashinalResponse> {
    const client = await this.getHCS6Client();
    const metadata = {
      name: options.metadata?.name || 'Dynamic Hashinal',
      creator:
        options.metadata?.creator || this.hederaKit.signer.getAccountId().toString(),
      description: options.metadata?.description || 'Dynamic hashinal metadata',
      type: options.metadata?.type || 'json',
      ...options.metadata,
    } as Record<string, unknown>;

    return await client.createHashinal({
      ...options,
      metadata,
    });
  }

  /**
   * Register a dynamic hashinal with combined inscription and registry creation
   * This is the main method for creating and updating dynamic hashinals
   */
  async register(
    options: HCS6RegisterOptions
  ): Promise<HCS6CreateHashinalResponse> {
    const client = await this.getHCS6Client();
    const metadata = {
      name: options.metadata?.name || 'Dynamic Hashinal',
      creator:
        options.metadata?.creator || this.hederaKit.signer.getAccountId().toString(),
      description:
        options.metadata?.description || 'Dynamic hashinal registration',
      type: options.metadata?.type || 'json',
      ...options.metadata,
    } as Record<string, unknown>;

    return await client.register({
      ...options,
      metadata,
    });
  }

  /**
   * Submit a raw message to an HCS-6 topic
   */
  async submitMessage(
    topicId: string,
    payload: any
  ): Promise<any> {
    const client = await this.getHCS6Client();
    return await client.submitMessage(topicId, payload);
  }

  /**
   * Get topic info from mirror node
   */
  async getTopicInfo(topicId: string): Promise<any> {
    const client = await this.getHCS6Client();
    return await client.getTopicInfo(topicId);
  }

  /**
   * Close the HCS-6 client
   */
  async close(): Promise<void> {
    if (this.hcs6Client) {
      this.hcs6Client.close();
      this.hcs6Client = undefined;
    }
  }
}