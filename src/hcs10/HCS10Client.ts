import { TransactionReceipt, PrivateKey } from '@hashgraph/sdk';
import {
  HCS10Client as StandardSDKClient,
  AgentBuilder,
  InboundTopicType as StandardInboundTopicType,
  AIAgentCapability as StandardAIAgentCapability,
  AgentRegistrationResult,
  WaitForConnectionConfirmationResponse,
  ProfileResponse as SDKProfileResponse,
  HCSMessage,
  LogLevel,
  Logger,
  FeeConfigBuilderInterface,
  SocialPlatform,
} from '@hashgraphonline/standards-sdk';
import { AgentMetadata, AgentChannels } from './types';
import { encryptMessage } from '../utils/Encryption';
import { IStateManager } from '../state/state-types';

// Keep type alias as they were removed accidentally
type StandardHandleConnectionRequest = InstanceType<
  typeof StandardSDKClient
>['handleConnectionRequest'];
type HandleConnectionRequestResponse = Awaited<
  ReturnType<StandardHandleConnectionRequest>
>;
export type StandardNetworkType = 'mainnet' | 'testnet';

export interface ClientValidationOptions {
  accountId: string;
  privateKey: string;
  network?: StandardNetworkType;
  stateManager?: IStateManager;
}

export interface HCSMessageWithTimestamp extends HCSMessage {
  timestamp: number;
  data?: string;
  sequence_number: number;
}

export interface ExtendedAgentMetadata extends AgentMetadata {
  pfpBuffer?: Buffer;
  pfpFileName?: string;
  feeConfig?: FeeConfigBuilderInterface;
}

/**
 * HCS10Client wraps the HCS-10 functionalities using the @hashgraphonline/standards-sdk.
 * - Creates and registers agents using the standard SDK flow.
 * - Manages agent communication channels (handled by standard SDK).
 * - Sends messages on Hedera topics (currently manual, potential for standard SDK integration).
 */
export class HCS10Client {
  public standardClient: StandardSDKClient;
  private useEncryption: boolean;
  public agentChannels?: AgentChannels;
  public guardedRegistryBaseUrl: string;
  public logger: Logger;

  constructor(
    operatorId: string,
    operatorPrivateKey: string,
    network: StandardNetworkType,
    options?: {
      useEncryption?: boolean;
      registryUrl?: string;
      logLevel?: LogLevel;
    }
  ) {
    this.standardClient = new StandardSDKClient({
      network: network,
      operatorId: operatorId,
      operatorPrivateKey: operatorPrivateKey,
      guardedRegistryBaseUrl: options?.registryUrl,
      logLevel: options?.logLevel,
    });
    this.guardedRegistryBaseUrl = options?.registryUrl || '';
    this.useEncryption = options?.useEncryption || false;
    this.logger = new Logger({
      level: options?.logLevel || 'info',
    });
  }

  public getOperatorId(): string {
    const operator = this.standardClient.getClient().operatorAccountId;
    if (!operator) {
      throw new Error('Operator Account ID not configured in standard client.');
    }
    return operator.toString();
  }

  public getNetwork(): StandardNetworkType {
    return this.standardClient.getNetwork() as StandardNetworkType;
  }

  public async handleConnectionRequest(
    inboundTopicId: string,
    requestingAccountId: string,
    connectionRequestId: number,
    feeConfig?: FeeConfigBuilderInterface
  ): Promise<HandleConnectionRequestResponse> {
    try {
      const result = await this.standardClient.handleConnectionRequest(
        inboundTopicId,
        requestingAccountId,
        connectionRequestId,
        feeConfig
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error handling connection request #${connectionRequestId} for topic ${inboundTopicId}:`,
        error
      );
      throw new Error(
        `Failed to handle connection request: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Retrieves the profile for a given account ID using the standard SDK.
   */
  public async getAgentProfile(accountId: string): Promise<SDKProfileResponse> {
    return this.standardClient.retrieveProfile(accountId);
  }

  /**
   * Exposes the standard SDK's submitConnectionRequest method.
   */
  public async submitConnectionRequest(
    inboundTopicId: string,
    memo: string
  ): Promise<TransactionReceipt> {
    return this.standardClient.submitConnectionRequest(
      inboundTopicId,
      memo
    ) as Promise<TransactionReceipt>;
  }

  /**
   * Exposes the standard SDK's waitForConnectionConfirmation method.
   */
  public async waitForConnectionConfirmation(
    outboundTopicId: string,
    connectionRequestId: number,
    maxAttempts = 60,
    delayMs = 2000
  ): Promise<WaitForConnectionConfirmationResponse> {
    return this.standardClient.waitForConnectionConfirmation(
      outboundTopicId,
      connectionRequestId,
      maxAttempts,
      delayMs
    );
  }

  /**
   * Creates and registers an agent using the standard SDK's HCS10Client.
   * This handles account creation, key generation, topic setup, and registration.
   *
   * When metadata includes fee configuration:
   * 1. The properties.feeConfig will be passed to the AgentBuilder
   * 2. The properties.inboundTopicType will be set to FEE_BASED
   * 3. The SDK's createAndRegisterAgent will apply the fees to the agent's inbound topic
   *
   * @param metadata - The agent's metadata, potentially including pfpBuffer, pfpFileName,
   *                   and fee configuration in properties.feeConfig
   * @returns The registration result from the standard SDK, containing accountId, keys, topics etc.
   */
  public async createAndRegisterAgent(
    metadata: ExtendedAgentMetadata
  ): Promise<AgentRegistrationResult> {
    const builder = new AgentBuilder()
      .setName(metadata.name)
      .setBio(metadata.description || '')
      .setCapabilities(
        metadata.capabilities
          ? metadata.capabilities
          : [StandardAIAgentCapability.TEXT_GENERATION]
      )
      .setType((metadata.type || 'autonomous') as 'autonomous' | 'manual')
      .setModel(metadata.model || 'agent-model-2024')
      .setNetwork(this.getNetwork())
      .setInboundTopicType(StandardInboundTopicType.PUBLIC);

    if (metadata?.feeConfig) {
      builder.setInboundTopicType(StandardInboundTopicType.FEE_BASED);
      builder.setFeeConfig(metadata.feeConfig);
    }

    if (metadata.pfpBuffer && metadata.pfpFileName) {
      if (metadata.pfpBuffer.byteLength === 0) {
        this.logger.warn(
          'Provided PFP buffer is empty. Skipping profile picture.'
        );
      } else {
        this.logger.info(
          `Setting profile picture: ${metadata.pfpFileName} (${metadata.pfpBuffer.byteLength} bytes)`
        );
        builder.setProfilePicture(metadata.pfpBuffer, metadata.pfpFileName);
      }
    } else {
      this.logger.warn(
        'Profile picture not provided in metadata. Agent creation might fail if required by the underlying SDK builder.'
      );
    }

    if (metadata.social) {
      Object.entries(metadata.social).forEach(([platform, handle]) => {
        builder.addSocial(platform as SocialPlatform, handle);
      });
    }

    if (metadata.properties) {
      Object.entries(metadata.properties).forEach(([key, value]) => {
        builder.addProperty(key, value);
      });
    }

    try {
      const hasFees = Boolean(metadata?.feeConfig);
      const result = await this.standardClient.createAndRegisterAgent(builder, {
        initialBalance: hasFees ? 50 : undefined,
      });
      if (
        result?.metadata?.inboundTopicId &&
        result?.metadata?.outboundTopicId
      ) {
        this.agentChannels = {
          inboundTopicId: result.metadata.inboundTopicId,
          outboundTopicId: result.metadata.outboundTopicId,
        };
      }
      return result;
    } catch (error) {
      this.logger.error('Error during agent creation/registration:', error);
      throw new Error(
        `Failed to create/register agent: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Sends a structured HCS-10 message to the specified topic using the standard SDK client.
   * Handles potential inscription for large messages.
   *
   * @param topicId - The target topic ID (likely a connection topic).
   * @param operatorId - The operator ID string (e.g., "inboundTopic@accountId").
   * @param data - The actual message content/data.
   * @param memo - Optional memo for the message.
   * @param submitKey - Optional private key for topics requiring specific submit keys.
   * @returns A confirmation status string from the transaction receipt.
   */
  public async sendMessage(
    topicId: string,
    data: string,
    memo?: string,
    submitKey?: PrivateKey
  ): Promise<number | undefined> {
    if (this.useEncryption) {
      data = encryptMessage(data);
    }

    try {
      const messageResponse = await this.standardClient.sendMessage(
        topicId,
        data,
        memo,
        submitKey
      );
      return messageResponse.topicSequenceNumber?.toNumber();
    } catch (error) {
      this.logger.error(`Error sending message to topic ${topicId}:`, error);
      throw new Error(
        `Failed to send message: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Retrieves messages from a topic using the standard SDK client.
   *
   * @param topicId - The topic ID to get messages from.
   * @returns Messages from the topic, mapped to the expected format.
   */
  public async getMessages(topicId: string): Promise<{
    messages: HCSMessageWithTimestamp[];
  }> {
    try {
      const result = await this.standardClient.getMessages(topicId);

      const mappedMessages = result.messages.map((sdkMessage) => {
        const timestamp = sdkMessage?.created?.getTime() || 0;

        return {
          ...sdkMessage,
          timestamp: timestamp,
          data: sdkMessage.data,
          sequence_number: sdkMessage.sequence_number,
        };
      });
      mappedMessages.sort(
        (a: { timestamp: number }, b: { timestamp: number }) =>
          a.timestamp - b.timestamp
      );
      return { messages: mappedMessages };
    } catch (error) {
      this.logger.error(`Error getting messages from topic ${topicId}:`, error);
      return { messages: [] };
    }
  }

  public async getMessageStream(topicId: string): Promise<{
    messages: HCSMessage[];
  }> {
    return this.standardClient.getMessageStream(topicId);
  }

  /**
   * Retrieves content from an inscribed message using the standard SDK client.
   * @param inscriptionIdOrData - The inscription ID (hcs://...) or potentially raw data string.
   * @returns The resolved message content.
   */
  public async getMessageContent(inscriptionIdOrData: string): Promise<string> {
    try {
      const content = await this.standardClient.getMessageContent(
        inscriptionIdOrData
      );
      return content as string;
    } catch (error) {
      this.logger.error(
        `Error retrieving message content for: ${inscriptionIdOrData}`,
        error
      );
      throw new Error(
        `Failed to retrieve message content: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Retrieves the inbound topic ID associated with the current operator.
   * This typically involves fetching the operator's own HCS-10 profile.
   * @returns A promise that resolves to the operator's inbound topic ID.
   * @throws {Error} If the operator ID cannot be determined or the profile/topic cannot be retrieved.
   */
  public async getInboundTopicId(): Promise<string> {
    try {
      const operatorId = this.getOperatorId();
      this.logger.info(
        `[HCS10Client] Retrieving profile for operator ${operatorId} to find inbound topic...`
      );
      const profileResponse = await this.getAgentProfile(operatorId);
      if (profileResponse.success && profileResponse.topicInfo?.inboundTopic) {
        this.logger.info(
          `[HCS10Client] Found inbound topic for operator ${operatorId}: ${profileResponse.topicInfo.inboundTopic}`
        );
        return profileResponse.topicInfo.inboundTopic;
      } else {
        throw new Error(
          `Could not retrieve inbound topic from profile for ${operatorId}. Profile success: ${profileResponse.success}, Error: ${profileResponse.error}`
        );
      }
    } catch (error) {
      this.logger.error(
        `[HCS10Client] Error fetching operator's inbound topic ID (${this.getOperatorId()}):`,
        error
      );
      const operatorId = this.getOperatorId();
      let detailedMessage = `Failed to get inbound topic ID for operator ${operatorId}.`;
      if (
        error instanceof Error &&
        error.message.includes('does not have a valid HCS-11 memo')
      ) {
        detailedMessage += ` The account profile may not exist or is invalid. Please ensure this operator account (${operatorId}) is registered as an HCS-10 agent. You might need to register it first (e.g., using the 'register_agent' tool or SDK function).`;
      } else if (error instanceof Error) {
        detailedMessage += ` Reason: ${error.message}`;
      } else {
        detailedMessage += ` Unexpected error: ${String(error)}`;
      }
      throw new Error(detailedMessage);
    }
  }

  /**
   * Retrieves the configured operator account ID and private key.
   * Required by tools needing to identify the current agent instance.
   */
  public getAccountAndSigner(): { accountId: string; signer: PrivateKey } {
    const result = this.standardClient.getAccountAndSigner();
    return {
      accountId: result.accountId,
      signer: result.signer as unknown as PrivateKey,
    };
  }

  /**
   * Retrieves the outbound topic ID for the current operator.
   * Fetches the operator's profile if necessary.
   * @returns The outbound topic ID string.
   * @throws If the outbound topic cannot be determined.
   */
  public async getOutboundTopicId(): Promise<string> {
    const operatorId = this.getOperatorId();
    const profile = await this.getAgentProfile(operatorId);
    if (profile.success && profile.topicInfo?.outboundTopic) {
      return profile.topicInfo.outboundTopic;
    } else {
      throw new Error(
        `Could not retrieve outbound topic from profile for ${operatorId}. Profile success: ${profile.success}, Error: ${profile.error}`
      );
    }
  }

  public setClient(accountId: string, privateKey: string): StandardSDKClient {
    this.standardClient = new StandardSDKClient({
      network: this.getNetwork(),
      operatorId: accountId,
      operatorPrivateKey: privateKey,
      guardedRegistryBaseUrl: this.guardedRegistryBaseUrl,
    });
    return this.standardClient;
  }

  /**
   * Validates that the operator account exists and has proper access for agent operations
   */
  private async validateOperator(
    options: ClientValidationOptions
  ): Promise<{
    isValid: boolean;
    operator?: { accountId: string };
    error?: string;
  }> {
    try {
      // Set up client with provided operator details
      this.setClient(options.accountId, options.privateKey);

      // Check if we can retrieve the operator ID
      const operatorId = this.getOperatorId();

      // If we got this far, basic validation passed
      return {
        isValid: true,
        operator: { accountId: operatorId },
      };
    } catch (error) {
      this.logger.error(`Validation error: ${error}`);
      return {
        isValid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async initializeWithValidation(
    options: ClientValidationOptions
  ): Promise<{
    isValid: boolean;
    operator?: { accountId: string };
    error?: string;
  }> {
    const validationResult = await this.validateOperator(options);

    if (validationResult.isValid) {
      // If we have access to the state manager, initialize its connections manager
      if (options.stateManager) {
        options.stateManager.initializeConnectionsManager(this.standardClient);
      }
    }

    return validationResult;
  }
}
