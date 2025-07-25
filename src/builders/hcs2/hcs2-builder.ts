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
} from '@hashgraphonline/standards-sdk';

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

      const config: SDKHCS2ClientConfig = {
        network: networkType,
        operatorId: operatorId,
        operatorKey: operatorPrivateKey,
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
  ): Promise<TopicRegistrationResponse> {
    const client = await this.getHCS2Client();
    return await client.createRegistry(options);
  }

  /**
   * Register a new entry in an HCS-2 registry
   */
  async registerEntry(
    registryTopicId: string,
    options: RegisterEntryOptions
  ): Promise<RegistryOperationResponse> {
    const client = await this.getHCS2Client();
    return await client.registerEntry(registryTopicId, options);
  }

  /**
   * Update an existing entry in an HCS-2 registry
   */
  async updateEntry(
    registryTopicId: string,
    options: UpdateEntryOptions
  ): Promise<RegistryOperationResponse> {
    const client = await this.getHCS2Client();
    return await client.updateEntry(registryTopicId, options);
  }

  /**
   * Delete an entry from an HCS-2 registry
   */
  async deleteEntry(
    registryTopicId: string,
    options: DeleteEntryOptions
  ): Promise<RegistryOperationResponse> {
    const client = await this.getHCS2Client();
    return await client.deleteEntry(registryTopicId, options);
  }

  /**
   * Migrate an HCS-2 registry to a new topic
   */
  async migrateRegistry(
    registryTopicId: string,
    options: MigrateTopicOptions
  ): Promise<RegistryOperationResponse> {
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
  ): Promise<any> {
    const client = await this.getHCS2Client();
    return await client.submitMessage(topicId, payload);
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