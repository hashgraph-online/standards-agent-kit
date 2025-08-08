import { BaseServiceBuilder } from 'hedera-agent-kit';
import type { HederaAgentKit } from 'hedera-agent-kit';
import { PrivateKey, TransactionReceipt } from '@hashgraph/sdk';
import { ActiveConnection, IStateManager } from '../../state/state-types';
import { ExecuteResult } from '../types';
import {
  FeeConfigBuilderInterface,
  FeeConfigBuilder,
  HCS10Client,
  AgentBuilder,
  InboundTopicType as StandardInboundTopicType,
  AIAgentCapability as StandardAIAgentCapability,
  AgentRegistrationResult,
  ProfileResponse as SDKProfileResponse,
  HCSMessage,
  LogLevel,
  Logger as SDKLogger,
  SocialPlatform,
  HandleConnectionRequestResponse,
  Connection,
} from '@hashgraphonline/standards-sdk';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const NOT_INITIALIZED_ERROR = 'ConnectionsManager not initialized';

/**
 * Internal agent data for registration
 */
interface AgentRegistrationData {
  name: string;
  bio?: string;
  alias?: string;
  type?: 'autonomous' | 'manual';
  model?: string;
  capabilities?: number[];
  creator?: string;
  socials?: Record<string, string>;
  properties?: Record<string, unknown>;
  pfpBuffer?: Buffer;
  pfpFileName?: string;
  existingProfilePictureTopicId?: string;
  feeConfig?: FeeConfigBuilderInterface;
}

/**
 * Message response with timestamp
 */
export interface HCSMessageWithTimestamp extends Omit<HCSMessage, 'op'> {
  timestamp: number;
  data?: string;
  sequence_number: number;
  op?: HCSMessage['op'] | string;
  operator_id?: string;
  created?: Date;
  m?: string;
}

/**
 * Network type for HCS-10
 */
export type StandardNetworkType = 'mainnet' | 'testnet';

/**
 * Parameters for agent registration
 */
export interface RegisterAgentParams {
  name: string;
  bio?: string;
  alias?: string;
  type?: 'autonomous' | 'manual';
  model?: string;
  capabilities?: number[];
  creator?: string;
  socials?: Record<string, string>;
  properties?: Record<string, unknown>;
  profilePicture?:
    | string
    | {
        url?: string;
        path?: string;
        filename?: string;
      };
  existingProfilePictureTopicId?: string;
  initialBalance?: number;
  userAccountId?: string;
  hbarFee?: number;
  tokenFees?: Array<{
    amount: number;
    tokenId: string;
  }>;
  exemptAccountIds?: string[];
}

/**
 * Parameters for initiating a connection
 */
export interface InitiateConnectionParams {
  targetAccountId: string;
  disableMonitor?: boolean;
  memo?: string;
}

/**
 * Parameters for accepting a connection request
 */
export interface AcceptConnectionParams {
  requestKey: string;
  hbarFee?: number | undefined;
  exemptAccountIds?: string[] | undefined;
}

/**
 * Parameters for sending a message
 */
export interface SendMessageParams {
  topicId: string;
  message: string;
  disableMonitoring?: boolean;
}

/**
 * Parameters for sending a message to a connected account
 */
export interface SendMessageToConnectionParams {
  targetIdentifier: string;
  message: string;
  disableMonitoring?: boolean;
}

/**
 * HCS10Builder facilitates HCS-10 protocol operations for agent communication
 * This builder incorporates all HCS10Client functionality directly
 */
export class HCS10Builder extends BaseServiceBuilder {
  private standardClient: HCS10Client;
  private stateManager: IStateManager | undefined;
  private executeResult?: ExecuteResult & { rawResult?: unknown };
  private useEncryption: boolean = false;
  private guardedRegistryBaseUrl: string = '';
  private network: StandardNetworkType;
  private sdkLogger: SDKLogger;

  constructor(
    hederaKit: HederaAgentKit,
    stateManager?: IStateManager,
    options?: {
      useEncryption?: boolean;
      registryUrl?: string;
      logLevel?: LogLevel;
    }
  ) {
    super(hederaKit);
    this.stateManager = stateManager;
    this.useEncryption = options?.useEncryption || false;
    this.guardedRegistryBaseUrl = options?.registryUrl || '';

    const network = this.hederaKit.client.network;
    this.network = network.toString().includes('mainnet')
      ? 'mainnet'
      : 'testnet';

    const operatorId = this.hederaKit.signer.getAccountId().toString();
    const operatorPrivateKey = this.hederaKit.signer?.getOperatorPrivateKey()
      ? this.hederaKit.signer.getOperatorPrivateKey().toStringRaw()
      : '';

    this.sdkLogger = new SDKLogger({
      module: 'HCS10Builder',
      level: options?.logLevel || 'info',
    });

    this.standardClient = new HCS10Client({
      network: this.network,
      operatorId: operatorId,
      operatorPrivateKey: operatorPrivateKey,
      logLevel: options?.logLevel || 'info',
    });

    if (this.stateManager) {
      this.stateManager.initializeConnectionsManager(this.standardClient);
    }
  }

  /**
   * Get the operator account ID
   */
  public getOperatorId(): string {
    const operator = this.standardClient.getClient().operatorAccountId;
    if (!operator) {
      throw new Error('Operator Account ID not configured in standard client.');
    }
    return operator.toString();
  }

  /**
   * Get the network type
   */
  public getNetwork(): StandardNetworkType {
    return this.network;
  }

  /**
   * Get state manager instance
   */
  public getStateManager(): IStateManager | undefined {
    return this.stateManager;
  }

  /**
   * Get account and signer information
   */
  public getAccountAndSigner(): { accountId: string; signer: PrivateKey } {
    const result = this.standardClient.getAccountAndSigner();
    return {
      accountId: result.accountId,
      signer: result.signer as unknown as PrivateKey,
    };
  }

  /**
   * Get the inbound topic ID for the current operator
   */
  public async getInboundTopicId(): Promise<string> {
    try {
      const operatorId = this.getOperatorId();
      this.logger.info(
        `[HCS10Builder] Retrieving profile for operator ${operatorId} to find inbound topic...`
      );
      const profileResponse = await this.getAgentProfile(operatorId);
      if (profileResponse.success && profileResponse.topicInfo?.inboundTopic) {
        this.logger.info(
          `[HCS10Builder] Found inbound topic for operator ${operatorId}: ${profileResponse.topicInfo.inboundTopic}`
        );
        return profileResponse.topicInfo.inboundTopic;
      } else {
        throw new Error(
          `Could not retrieve inbound topic from profile for ${operatorId}. Profile success: ${profileResponse.success}, Error: ${profileResponse.error}`
        );
      }
    } catch (error) {
      this.logger.error(
        `[HCS10Builder] Error fetching operator's inbound topic ID (${this.getOperatorId()}):`,
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
   * Get agent profile
   */
  public async getAgentProfile(accountId: string): Promise<SDKProfileResponse> {
    try {
      return await this.standardClient.retrieveProfile(accountId);
    } catch (error) {
      this.logger.error(
        `[HCS10Builder] Error retrieving agent profile for account ${accountId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Submit connection request
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
   * Handle connection request
   */
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

      if (
        result &&
        result.connectionTopicId &&
        typeof result.connectionTopicId === 'object' &&
        'toString' in result.connectionTopicId
      ) {
        result.connectionTopicId = (
          result.connectionTopicId as { toString(): string }
        ).toString();
      }

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
   * Send message to a topic
   */
  public async sendMessage(
    topicId: string,
    data: string,
    memo?: string
  ): Promise<{
    sequenceNumber: number | undefined;
    receipt: TransactionReceipt;
    transactionId: string | undefined;
  }> {
    if (topicId && typeof topicId === 'object' && 'toString' in topicId) {
      topicId = (topicId as unknown as { toString: () => string })?.toString();
    }

    if (!topicId || typeof topicId !== 'string') {
      throw new Error(
        `Invalid topic ID provided to sendMessage: ${JSON.stringify(topicId)}`
      );
    }

    try {
      const messageResponse = await this.standardClient.sendMessage(
        topicId,
        data,
        memo,
        undefined
      );
      return {
        sequenceNumber: messageResponse.topicSequenceNumber?.toNumber(),
        receipt: messageResponse as unknown as TransactionReceipt,
        transactionId:
          'transactionId' in messageResponse
            ? (
                messageResponse as { transactionId?: { toString(): string } }
              ).transactionId?.toString()
            : undefined,
      };
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
   * Get messages from a topic
   */
  public async getMessages(topicId: string): Promise<{
    messages: HCSMessageWithTimestamp[];
  }> {
    if (topicId && typeof topicId === 'object' && 'toString' in topicId) {
      topicId = (topicId as unknown as { toString: () => string })?.toString();
    }

    if (!topicId || typeof topicId !== 'string') {
      throw new Error(
        `Invalid topic ID provided to getMessages: ${JSON.stringify(topicId)}`
      );
    }

    try {
      const result = await this.standardClient.getMessages(topicId);

      const mappedMessages: HCSMessageWithTimestamp[] = result.messages.map(
        (sdkMessage) => {
          const timestamp = sdkMessage?.created?.getTime() || 0;

          return {
            ...sdkMessage,
            timestamp: timestamp,
            data: sdkMessage.data || '',
            sequence_number: sdkMessage.sequence_number,
            p: 'hcs-10' as const,
          } as HCSMessageWithTimestamp;
        }
      );
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

  /**
   * Get message stream from a topic
   */
  public async getMessageStream(topicId: string): Promise<{
    messages: HCSMessage[];
  }> {
    if (topicId && typeof topicId === 'object' && 'toString' in topicId) {
      topicId = (topicId as unknown as { toString: () => string })?.toString();
    }

    if (!topicId || typeof topicId !== 'string') {
      throw new Error(
        `Invalid topic ID provided to getMessageStream: ${JSON.stringify(
          topicId
        )}`
      );
    }

    return this.standardClient.getMessageStream(topicId) as Promise<{
      messages: HCSMessage[];
    }>;
  }

  /**
   * Get message content
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
   * Get the standard client instance (for compatibility)
   */
  public getStandardClient(): HCS10Client {
    return this.standardClient;
  }

  /**
   * Load profile picture from URL or file path
   */
  private async loadProfilePicture(
    profilePicture: string | { url?: string; path?: string; filename?: string }
  ): Promise<{ buffer: Buffer; filename: string } | null> {
    try {
      if (!profilePicture) {
        return null;
      }

      if (typeof profilePicture === 'string') {
        const isUrl =
          profilePicture.startsWith('http://') ||
          profilePicture.startsWith('https://');

        if (isUrl) {
          this.logger.info(
            `Loading profile picture from URL: ${profilePicture}`
          );
          const response = await axios.get(profilePicture, {
            responseType: 'arraybuffer',
          });
          const buffer = Buffer.from(response.data);
          const urlPathname = new URL(profilePicture).pathname;
          const filename = path.basename(urlPathname) || 'profile.png';
          return { buffer, filename };
        } else {
          if (!fs.existsSync(profilePicture)) {
            this.logger.warn(
              `Profile picture file not found: ${profilePicture}`
            );
            return null;
          }
          this.logger.info(
            `Loading profile picture from file: ${profilePicture}`
          );
          const buffer = fs.readFileSync(profilePicture);
          const filename = path.basename(profilePicture);
          return { buffer, filename };
        }
      } else if (profilePicture.url) {
        this.logger.info(
          `Loading profile picture from URL: ${profilePicture.url}`
        );
        const response = await axios.get(profilePicture.url, {
          responseType: 'arraybuffer',
        });
        const buffer = Buffer.from(response.data);
        const filename = profilePicture.filename || 'profile.png';
        return { buffer, filename };
      } else if (profilePicture.path) {
        if (!fs.existsSync(profilePicture.path)) {
          this.logger.warn(
            `Profile picture file not found: ${profilePicture.path}`
          );
          return null;
        }
        this.logger.info(
          `Loading profile picture from file: ${profilePicture.path}`
        );
        const buffer = fs.readFileSync(profilePicture.path);
        const filename =
          profilePicture.filename || path.basename(profilePicture.path);
        return { buffer, filename };
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to load profile picture:', error);
      return null;
    }
  }

  /**
   * Create and register an agent
   */
  private async createAndRegisterAgent(
    data: AgentRegistrationData
  ): Promise<AgentRegistrationResult> {
    const builder = new AgentBuilder()
      .setName(data.name)
      .setBio(data.bio || '')
      .setCapabilities(
        data.capabilities || [StandardAIAgentCapability.TEXT_GENERATION]
      )
      .setType(data.type || 'autonomous')
      .setModel(data.model || 'agent-model-2024')
      .setNetwork(this.getNetwork())
      .setInboundTopicType(StandardInboundTopicType.PUBLIC);

    if (data.alias) {
      builder.setAlias(data.alias);
    }

    if (data.creator) {
      builder.setCreator(data.creator);
    }

    if (data?.feeConfig) {
      builder.setInboundTopicType(StandardInboundTopicType.FEE_BASED);
      builder.setFeeConfig(data.feeConfig);
    }

    if (data.existingProfilePictureTopicId) {
      builder.setExistingProfilePicture(data.existingProfilePictureTopicId);
    } else if (data.pfpBuffer && data.pfpFileName) {
      if (data.pfpBuffer.byteLength === 0) {
        this.logger.warn(
          'Provided PFP buffer is empty. Skipping profile picture.'
        );
      } else {
        this.logger.info(
          `Setting profile picture: ${data.pfpFileName} (${data.pfpBuffer.byteLength} bytes)`
        );
        builder.setProfilePicture(data.pfpBuffer, data.pfpFileName);
      }
    } else {
      this.logger.warn(
        'Profile picture not provided. Agent creation might fail if required by the underlying SDK builder.'
      );
    }

    if (data.socials) {
      Object.entries(data.socials).forEach(([platform, handle]) => {
        builder.addSocial(platform as SocialPlatform, handle);
      });
    }

    if (data.properties) {
      Object.entries(data.properties).forEach(([key, value]) => {
        builder.addProperty(key, value);
      });
    }

    try {
      const hasFees = Boolean(data?.feeConfig);
      const result = await this.standardClient.createAndRegisterAgent(builder, {
        initialBalance: hasFees ? 50 : 10,
      });
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
   * Register a new HCS-10 agent
   * Note: This performs multiple transactions and requires directExecution mode
   */
  public async registerAgent(params: RegisterAgentParams): Promise<this> {
    this.clearNotes();

    if (this.hederaKit.operationalMode === 'returnBytes') {
      throw new Error(
        'Agent registration requires multiple transactions and cannot be performed in returnBytes mode. ' +
          'Please use autonomous mode.'
      );
    }

    try {
      let profilePictureData: { buffer: Buffer; filename: string } | null =
        null;
      if (params.profilePicture) {
        profilePictureData = await this.loadProfilePicture(
          params.profilePicture
        );
      }

      const registrationData: AgentRegistrationData = {
        name: params.name,
        ...(params.bio !== undefined && { bio: params.bio }),
        ...(params.alias !== undefined && { alias: params.alias }),
        ...(params.type !== undefined && { type: params.type }),
        ...(params.model !== undefined && { model: params.model }),
        ...(params.capabilities !== undefined && {
          capabilities: params.capabilities,
        }),
        ...(params.creator !== undefined && { creator: params.creator }),
        ...(params.socials !== undefined && { socials: params.socials }),
        ...(params.properties !== undefined && {
          properties: params.properties,
        }),
        ...(params.existingProfilePictureTopicId !== undefined && {
          existingProfilePictureTopicId: params.existingProfilePictureTopicId,
        }),
        ...(profilePictureData?.buffer !== undefined && {
          pfpBuffer: profilePictureData.buffer,
        }),
        ...(profilePictureData?.filename !== undefined && {
          pfpFileName: profilePictureData.filename,
        }),
      };

      if (params.hbarFee && params.hbarFee > 0) {
        const feeConfigBuilder = new FeeConfigBuilder({
          network: this.network,
          logger: this.sdkLogger,
        });

        const { accountId: collectorAccountId } = this.getAccountAndSigner();
        if (!collectorAccountId) {
          throw new Error('Could not determine account ID for fee collection.');
        }
        this.addNote(
          `Setting the operator account (${collectorAccountId}) as the fee collector since no specific collector was provided.`
        );

        const effectiveExemptIds =
          params.exemptAccountIds?.filter(
            (id: string) => id !== collectorAccountId && id.startsWith('0.0')
          ) || [];

        registrationData.feeConfig = feeConfigBuilder.addHbarFee(
          params.hbarFee,
          collectorAccountId,
          effectiveExemptIds
        );
      }

      const result = await this.createAndRegisterAgent(registrationData);

      this.executeResult = {
        success: true,
        transactionId: result.transactionId,
        receipt: undefined,
        scheduleId: undefined,
        rawResult: {
          ...result,
          name: params.name,
          accountId:
            result?.metadata?.accountId ||
            result.state?.agentMetadata?.accountId,
        },
      } as unknown as ExecuteResult & { rawResult?: unknown };
    } catch (error) {
      this.logger.error('Failed to register agent:', error);
      throw error;
    }

    return this;
  }

  /**
   * Initiate a connection to another agent
   */
  public async initiateConnection(
    params: InitiateConnectionParams
  ): Promise<this> {
    this.clearNotes();

    try {
      const targetProfile = await this.getAgentProfile(params.targetAccountId);

      if (!targetProfile.success || !targetProfile.topicInfo?.inboundTopic) {
        throw new Error(
          `Could not retrieve inbound topic for target account ${params.targetAccountId}`
        );
      }

      const targetInboundTopicId = targetProfile.topicInfo.inboundTopic;
      let memo: string;
      if (params.memo !== undefined) {
        memo = params.memo;
      } else {
        memo = params.disableMonitor ? 'false' : 'true';
        this.addNote(
          `No custom memo was provided. Using default memo '${memo}' based on monitoring preference.`
        );
      }
      if (!params.disableMonitor) {
        this.addNote(
          `Monitoring will be enabled for this connection request as disableMonitor was not specified.`
        );
      }

      const result = await this.submitConnectionRequest(
        targetInboundTopicId,
        memo
      );

      this.executeResult = {
        success: true,
        transactionId:
          'transactionId' in result
            ? (
                result as { transactionId?: { toString(): string } }
              ).transactionId?.toString()
            : undefined,
        receipt: result,
        scheduleId: undefined,
        rawResult: {
          targetAccountId: params.targetAccountId,
          targetInboundTopicId,
          connectionRequestSent: true,
          monitoringEnabled: !params.disableMonitor,
          ...result,
        },
      } as unknown as ExecuteResult & { rawResult?: unknown };
    } catch (error) {
      this.logger.error('Failed to initiate connection:', error);
      throw error;
    }

    return this;
  }

  /**
   * Accept a connection request
   * Note: This performs multiple transactions and requires directExecution mode
   */
  public async acceptConnection(params: AcceptConnectionParams): Promise<this> {
    this.clearNotes();

    if (this.hederaKit.operationalMode === 'returnBytes') {
      throw new Error(
        'Accepting connections requires multiple transactions and cannot be performed in returnBytes mode. ' +
          'Please use autonomous mode.'
      );
    }

    try {
      const currentAgent = this.stateManager?.getCurrentAgent();
      if (!currentAgent) {
        throw new Error(
          'Cannot accept connection request. No agent is currently active. Please register or select an agent first.'
        );
      }

      const connectionsManager = this.stateManager?.getConnectionsManager();
      if (!connectionsManager) {
        throw new Error(NOT_INITIALIZED_ERROR);
      }

      await connectionsManager.fetchConnectionData(currentAgent.accountId);

      const allRequests = [
        ...connectionsManager.getPendingRequests(),
        ...connectionsManager.getConnectionsNeedingConfirmation(),
      ];

      const request = allRequests.find(
        (r) =>
          r.uniqueRequestKey === params.requestKey ||
          r.connectionRequestId?.toString() === params.requestKey ||
          r.inboundRequestId?.toString() === params.requestKey
      );

      if (!request) {
        throw new Error(
          `Request with key ${params.requestKey} not found or no longer pending.`
        );
      }

      if (!request.needsConfirmation || !request.inboundRequestId) {
        throw new Error(
          `Request with key ${params.requestKey} is not an inbound request that can be accepted.`
        );
      }

      const targetAccountId = request.targetAccountId;
      const inboundRequestId = request.inboundRequestId;

      let feeConfig: FeeConfigBuilderInterface | undefined;

      if (params.hbarFee && params.hbarFee > 0) {
        const feeConfigBuilder = new FeeConfigBuilder({
          network: this.network,
          logger: this.sdkLogger,
        });

        const { accountId: collectorAccountId } = this.getAccountAndSigner();
        if (!collectorAccountId) {
          throw new Error('Could not determine account ID for fee collection.');
        }
        this.addNote(
          `Setting the operator account (${collectorAccountId}) as the fee collector since no specific collector was provided.`
        );

        const effectiveExemptIds =
          params.exemptAccountIds?.filter(
            (id: string) => id !== collectorAccountId && id.startsWith('0.0')
          ) || [];

        feeConfig = feeConfigBuilder.addHbarFee(
          params.hbarFee,
          collectorAccountId,
          effectiveExemptIds
        );
      }

      const inboundTopicId = await this.getInboundTopicId();
      const confirmationResult = await this.handleConnectionRequest(
        inboundTopicId,
        targetAccountId,
        inboundRequestId,
        feeConfig
      );

      let connectionTopicId = confirmationResult?.connectionTopicId;

      if (
        connectionTopicId &&
        typeof connectionTopicId === 'object' &&
        'toString' in connectionTopicId
      ) {
        connectionTopicId = (
          connectionTopicId as unknown as { toString: () => string }
        )?.toString();
      }

      if (!connectionTopicId || typeof connectionTopicId !== 'string') {
        throw new Error(
          `Failed to create connection topic. Got: ${JSON.stringify(
            connectionTopicId
          )}`
        );
      }

      if (this.stateManager) {
        const targetAgentName =
          request.targetAgentName || `Agent ${targetAccountId}`;
        if (!request.targetAgentName) {
          this.addNote(
            `No agent name was provided in the connection request, using default name 'Agent ${targetAccountId}'.`
          );
        }

        let targetInboundTopicId = request.targetInboundTopicId || '';
        if (!targetInboundTopicId) {
          try {
            const targetProfile = await this.getAgentProfile(targetAccountId);
            if (
              targetProfile.success &&
              targetProfile.topicInfo?.inboundTopic
            ) {
              targetInboundTopicId = targetProfile.topicInfo.inboundTopic;
            }
          } catch (profileError) {
            this.logger.warn(
              `Could not fetch profile for ${targetAccountId}:`,
              profileError
            );
          }
        }

        const newConnection = {
          connectionId: `conn-${Date.now()}`,
          targetAccountId: targetAccountId,
          targetAgentName: targetAgentName,
          targetInboundTopicId: targetInboundTopicId,
          connectionTopicId: connectionTopicId,
          status: 'established' as const,
          created: new Date(),
        };
        this.stateManager.addActiveConnection(newConnection);

        connectionsManager.markConnectionRequestProcessed(
          request.targetInboundTopicId || '',
          inboundRequestId
        );
      }

      this.executeResult = {
        success: true,
        transactionId: undefined,
        receipt: undefined,
        scheduleId: undefined,
        rawResult: {
          targetAccountId,
          connectionTopicId,
          feeConfigured: !!params.hbarFee,
          hbarFee: params.hbarFee || 0,
          confirmationResult,
        },
      } as unknown as ExecuteResult & { rawResult?: unknown };
    } catch (error) {
      this.logger.error('Failed to accept connection:', error);
      throw error;
    }

    return this;
  }

  /**
   * Send a message using HCS (for operations that need direct topic access)
   */
  public async sendHCS10Message(params: SendMessageParams): Promise<this> {
    this.clearNotes();

    try {
      const result = await this.sendMessage(params.topicId, params.message);

      this.executeResult = {
        success: true,
        transactionId: result.transactionId,
        receipt: result.receipt,
        scheduleId: undefined,
        rawResult: result,
      } as unknown as ExecuteResult & { rawResult?: unknown };

      this.addNote(`Message sent to topic ${params.topicId}.`);
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      throw error;
    }

    return this;
  }

  /**
   * Send a message to a connected account with optional response monitoring
   */
  public async sendMessageToConnection(
    params: SendMessageToConnectionParams
  ): Promise<this> {
    this.clearNotes();

    if (!this.stateManager) {
      throw new Error(
        'StateManager is required to send messages to connections'
      );
    }

    try {
      const currentAgent = this.stateManager.getCurrentAgent();
      if (!currentAgent) {
        throw new Error(
          'Cannot send message. No agent is currently active. Please register or select an agent first.'
        );
      }

      let connection: ActiveConnection | undefined;

      const identifier = params.targetIdentifier;

      if (identifier.includes('@')) {
        const parts = identifier.split('@');
        if (parts.length === 2) {
          const accountId = parts[1];
          connection = this.stateManager.getConnectionByIdentifier(accountId);

          if (!connection) {
            this.addNote(
              `Could not find connection using request key '${identifier}', extracted account ID '${accountId}'.`
            );
          }
        }
      }

      if (!connection) {
        connection = this.stateManager.getConnectionByIdentifier(identifier);
      }

      if (
        !connection &&
        !identifier.startsWith('0.0.') &&
        /^\d+$/.test(identifier)
      ) {
        const accountIdWithPrefix = `0.0.${identifier}`;
        connection =
          this.stateManager.getConnectionByIdentifier(accountIdWithPrefix);
        if (connection) {
          this.addNote(
            `Found connection using account ID with prefix: ${accountIdWithPrefix}`
          );
        }
      }

      if (!connection && /^[1-9]\d*$/.test(identifier)) {
        const connections = this.stateManager.listConnections();
        const index = parseInt(identifier) - 1;
        if (index >= 0 && index < connections.length) {
          connection = connections[index];
          if (connection) {
            this.addNote(
              `Found connection by index ${identifier}: ${connection.targetAccountId}`
            );
          }
        }
      }

      if (!connection) {
        const connections = this.stateManager.listConnections();
        const availableIds = connections.map(
          (c, i) =>
            `${i + 1}. ${c.targetAccountId} (Topic: ${c.connectionTopicId})`
        );

        let errorMsg = `Connection not found for identifier: "${identifier}"\n`;
        errorMsg += `Available connections:\n${
          availableIds.join('\n') || 'No active connections'
        }`;
        errorMsg += `\n\nYou can use:\n`;
        errorMsg += `- Connection number (e.g., "1", "2")\n`;
        errorMsg += `- Account ID (e.g., "0.0.6412936")\n`;
        errorMsg += `- Connection topic ID\n`;
        errorMsg += `Use 'list_connections' to see all active connections.`;

        throw new Error(errorMsg);
      }

      let connectionTopicId = connection.connectionTopicId;
      if (
        connectionTopicId &&
        typeof connectionTopicId === 'object' &&
        'toString' in connectionTopicId
      ) {
        connectionTopicId = (
          connectionTopicId as unknown as { toString: () => string }
        )?.toString();
      }

      if (!connectionTopicId || typeof connectionTopicId !== 'string') {
        throw new Error(
          `Invalid connection topic ID for ${
            connection.targetAccountId
          }: ${JSON.stringify(
            connectionTopicId
          )} (type: ${typeof connectionTopicId})`
        );
      }

      const targetAgentName = connection.targetAgentName;

      const operatorId = `${currentAgent.inboundTopicId}@${currentAgent.accountId}`;

      const messageResult = await this.sendMessage(
        connectionTopicId,
        params.message,
        `Agent message from ${currentAgent.name}`
      );

      if (!messageResult.sequenceNumber) {
        throw new Error('Failed to send message');
      }

      let reply: string | null = null;
      if (!params.disableMonitoring) {
        reply = await this.monitorResponses(
          connectionTopicId,
          operatorId,
          messageResult.sequenceNumber
        );
      } else {
        this.addNote(
          `Message sent successfully. Response monitoring was disabled.`
        );
      }

      this.executeResult = {
        success: true,
        transactionId: messageResult.transactionId,
        receipt: messageResult.receipt,
        scheduleId: undefined,
        rawResult: {
          targetAgentName,
          targetAccountId: connection.targetAccountId,
          connectionTopicId,
          sequenceNumber: messageResult.sequenceNumber,
          reply,
          monitoringEnabled: !params.disableMonitoring,
          message: params.message,
          messageResult,
        },
      };
    } catch (error) {
      this.logger.error('Failed to send message to connection:', error);
      throw error;
    }

    return this;
  }

  /**
   * Monitor responses on a topic after sending a message
   */
  private async monitorResponses(
    topicId: string,
    operatorId: string,
    sequenceNumber: number
  ): Promise<string | null> {
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const messages = await this.getMessageStream(topicId);

        for (const message of messages.messages) {
          if (
            message.sequence_number < sequenceNumber ||
            message.operator_id === operatorId
          ) {
            continue;
          }
          const content = await this.getMessageContent(message.data || '');
          return content;
        }
      } catch (error) {
        this.logger.error(`Error monitoring responses: ${error}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 4000));
      attempts++;
    }
    return null;
  }

  /**
   * Start passive monitoring for incoming connection requests
   * This method monitors continuously in the background
   */
  public async startPassiveConnectionMonitoring(): Promise<this> {
    this.clearNotes();

    if (!this.stateManager) {
      throw new Error('StateManager is required for passive monitoring');
    }

    const inboundTopicId = await this.getInboundTopicId();
    this.logger.info(
      `Starting passive connection monitoring on topic ${inboundTopicId}...`
    );

    this.executeResult = {
      success: true,
      transactionId: undefined,
      receipt: undefined,
      scheduleId: undefined,
      rawResult: {
        inboundTopicId,
        message: `Started monitoring inbound topic ${inboundTopicId} for connection requests in the background.`,
      },
    } as unknown as ExecuteResult & { rawResult?: unknown };

    return this;
  }

  /**
   * Monitor for incoming connection requests
   */
  public async monitorConnections(params: {
    acceptAll?: boolean;
    targetAccountId?: string;
    monitorDurationSeconds?: number;
    hbarFees?: Array<{ amount: number; collectorAccount?: string }>;
    tokenFees?: Array<{
      amount: number;
      tokenId: string;
      collectorAccount?: string;
    }>;
    exemptAccountIds?: string[];
    defaultCollectorAccount?: string;
  }): Promise<this> {
    this.clearNotes();

    const {
      acceptAll = false,
      targetAccountId,
      monitorDurationSeconds = 120,
      hbarFees = [],
      tokenFees = [],
      exemptAccountIds = [],
      defaultCollectorAccount,
    } = params;

    if (!this.stateManager) {
      throw new Error('StateManager is required for connection monitoring');
    }

    const currentAgent = this.stateManager.getCurrentAgent();
    if (!currentAgent) {
      throw new Error(
        'Cannot monitor for connections. No agent is currently active.'
      );
    }

    const inboundTopicId = await this.getInboundTopicId();
    const endTime = Date.now() + monitorDurationSeconds * 1000;
    const pollIntervalMs = 3000;
    let connectionRequestsFound = 0;
    let acceptedConnections = 0;
    const processedRequestIds = new Set<number>();

    while (Date.now() < endTime) {
      try {
        const messagesResult = await this.getMessages(inboundTopicId);
        const connectionRequests = messagesResult.messages.filter(
          (msg) =>
            msg.op === 'connection_request' &&
            typeof msg.sequence_number === 'number'
        );

        for (const request of connectionRequests) {
          const connectionRequestId = request.sequence_number;
          if (
            !connectionRequestId ||
            processedRequestIds.has(connectionRequestId)
          ) {
            continue;
          }

          const requestingAccountId = request.operator_id?.split('@')[1];
          if (!requestingAccountId) {
            continue;
          }

          connectionRequestsFound++;

          if (targetAccountId && requestingAccountId !== targetAccountId) {
            this.logger.info(
              `Skipping request from ${requestingAccountId} (not target account)`
            );
            continue;
          }

          if (acceptAll || targetAccountId === requestingAccountId) {
            this.logger.info(
              `Accepting connection request from ${requestingAccountId}`
            );

            let feeConfig;
            if (hbarFees.length > 0 || tokenFees.length > 0) {
              const builder = new FeeConfigBuilder({
                network: this.network,
                logger: this.sdkLogger,
              });

              for (const fee of hbarFees) {
                const collectorAccount =
                  fee.collectorAccount ||
                  defaultCollectorAccount ||
                  this.getOperatorId();
                builder.addHbarFee(
                  fee.amount,
                  collectorAccount,
                  exemptAccountIds
                );
              }

              for (const fee of tokenFees) {
                const collectorAccount =
                  fee.collectorAccount ||
                  defaultCollectorAccount ||
                  this.getOperatorId();
                builder.addTokenFee(
                  fee.amount,
                  fee.tokenId,
                  collectorAccount,
                  undefined,
                  exemptAccountIds
                );
              }

              feeConfig = builder;
            }

            await this.handleConnectionRequest(
              inboundTopicId,
              requestingAccountId,
              connectionRequestId,
              feeConfig
            );

            processedRequestIds.add(connectionRequestId);
            acceptedConnections++;
          }
        }
      } catch (error) {
        this.logger.error('Error during connection monitoring:', error);
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    this.executeResult = {
      success: true,
      transactionId: undefined,
      receipt: undefined,
      scheduleId: undefined,
      rawResult: {
        connectionRequestsFound,
        acceptedConnections,
        monitorDurationSeconds,
        processedRequestIds: Array.from(processedRequestIds),
      },
    } as unknown as ExecuteResult & { rawResult?: unknown };

    this.addNote(
      `Monitoring completed. Found ${connectionRequestsFound} requests, accepted ${acceptedConnections}.`
    );

    return this;
  }

  /**
   * Manage connection requests (list, view, or reject)
   */
  public async manageConnectionRequests(params: {
    action: 'list' | 'view' | 'reject';
    requestKey?: string;
  }): Promise<this> {
    this.clearNotes();

    if (!this.stateManager) {
      throw new Error(
        'StateManager is required for managing connection requests'
      );
    }

    const currentAgent = this.stateManager.getCurrentAgent();
    if (!currentAgent) {
      throw new Error(
        'Cannot manage connection requests. No agent is currently active.'
      );
    }

    const connectionsManager = this.stateManager.getConnectionsManager();
    if (!connectionsManager) {
      throw new Error(NOT_INITIALIZED_ERROR);
    }

    try {
      const { accountId } = this.getAccountAndSigner();
      await connectionsManager.fetchConnectionData(accountId);

      const pendingRequests = connectionsManager.getPendingRequests();
      const needsConfirmation =
        connectionsManager.getConnectionsNeedingConfirmation();
      const allRequests = [...pendingRequests, ...needsConfirmation];

      switch (params.action) {
        case 'list':
          this.executeResult = {
            success: true,
            transactionId: undefined,
            receipt: undefined,
            scheduleId: undefined,
            rawResult: {
              requests: allRequests.map((request, index) => ({
                index: index + 1,
                type: request.needsConfirmation ? 'incoming' : 'outgoing',
                requestKey:
                  request.uniqueRequestKey ||
                  `${
                    request.connectionRequestId ||
                    request.inboundRequestId ||
                    'unknown'
                  }`,
                targetAccountId: request.targetAccountId,
                targetAgentName:
                  request.targetAgentName || `Agent ${request.targetAccountId}`,
                created: request.created.toISOString(),
                memo: request.memo,
                bio: request.profileInfo?.bio,
              })),
            },
          } as unknown as ExecuteResult & { rawResult?: unknown };
          break;

        case 'view': {
          if (!params.requestKey) {
            throw new Error('Request key is required for viewing a request');
          }
          const viewRequest = allRequests.find(
            (r) =>
              r.uniqueRequestKey === params.requestKey ||
              r.connectionRequestId?.toString() === params.requestKey ||
              r.inboundRequestId?.toString() === params.requestKey
          );
          if (!viewRequest) {
            throw new Error(`Request with key ${params.requestKey} not found`);
          }
          this.executeResult = {
            success: true,
            transactionId: undefined,
            receipt: undefined,
            scheduleId: undefined,
            rawResult: {
              request: {
                type: viewRequest.needsConfirmation ? 'incoming' : 'outgoing',
                requestKey:
                  viewRequest.uniqueRequestKey ||
                  `${
                    viewRequest.connectionRequestId ||
                    viewRequest.inboundRequestId ||
                    'unknown'
                  }`,
                targetAccountId: viewRequest.targetAccountId,
                targetAgentName:
                  viewRequest.targetAgentName ||
                  `Agent ${viewRequest.targetAccountId}`,
                created: viewRequest.created.toISOString(),
                memo: viewRequest.memo,
                profileInfo: viewRequest.profileInfo,
              },
            },
          } as unknown as ExecuteResult & { rawResult?: unknown };
          break;
        }

        case 'reject': {
          if (!params.requestKey) {
            throw new Error('Request key is required for rejecting a request');
          }
          const rejectRequest = allRequests.find(
            (r) =>
              r.uniqueRequestKey === params.requestKey ||
              r.connectionRequestId?.toString() === params.requestKey ||
              r.inboundRequestId?.toString() === params.requestKey
          );
          if (!rejectRequest) {
            throw new Error(`Request with key ${params.requestKey} not found`);
          }
          if (rejectRequest.inboundRequestId) {
            connectionsManager.markConnectionRequestProcessed(
              rejectRequest.targetInboundTopicId || '',
              rejectRequest.inboundRequestId
            );
          } else if (rejectRequest.connectionRequestId) {
            connectionsManager.markConnectionRequestProcessed(
              rejectRequest.originTopicId || '',
              rejectRequest.connectionRequestId
            );
          }
          this.executeResult = {
            success: true,
            transactionId: undefined,
            receipt: undefined,
            scheduleId: undefined,
            rawResult: {
              rejectedRequest: {
                requestKey: params.requestKey,
                targetAccountId: rejectRequest.targetAccountId,
                targetAgentName:
                  rejectRequest.targetAgentName ||
                  `Agent ${rejectRequest.targetAccountId}`,
              },
            },
          } as unknown as ExecuteResult & { rawResult?: unknown };
          break;
        }
      }
    } catch (error) {
      this.logger.error('Failed to manage connection requests:', error);
      throw error;
    }

    return this;
  }

  /**
   * List unapproved connection requests
   */
  public async listUnapprovedConnectionRequests(): Promise<this> {
    this.clearNotes();

    if (!this.stateManager) {
      throw new Error(
        'StateManager is required for listing connection requests'
      );
    }

    const currentAgent = this.stateManager.getCurrentAgent();
    if (!currentAgent) {
      throw new Error(
        'Cannot list connection requests. No agent is currently active.'
      );
    }

    try {
      const inboundTopicId = await this.getInboundTopicId();
      const messages = await this.getMessages(inboundTopicId);

      const unapprovedRequests = messages.messages
        .filter(
          (msg): msg is HCSMessageWithTimestamp & { op: string } =>
            msg.op === 'connection_request'
        )
        .map((msg) => ({
          requestId: msg.sequence_number,
          fromAccountId: msg.operator_id?.split('@')[1] || 'unknown',
          timestamp: msg.timestamp || new Date(msg?.created || '').getTime(),
          memo: msg.m || '',
          data: msg.data,
        }))
        .filter(
          (req): req is typeof req & { fromAccountId: string } =>
            req.fromAccountId !== 'unknown'
        );

      this.executeResult = {
        success: true,
        transactionId: undefined,
        receipt: undefined,
        scheduleId: undefined,
        rawResult: {
          requests: unapprovedRequests,
          count: unapprovedRequests.length,
        },
      } as unknown as ExecuteResult & { rawResult?: unknown };

      if (unapprovedRequests.length === 0) {
        this.addNote('No unapproved connection requests found.');
      } else {
        this.addNote(
          `Found ${unapprovedRequests.length} unapproved connection request(s).`
        );
      }
    } catch (error) {
      this.logger.error(
        'Failed to list unapproved connection requests:',
        error
      );
      throw error;
    }

    return this;
  }

  /**
   * List connections with enhanced details
   */
  public async listConnections(
    params: {
      includeDetails?: boolean;
      showPending?: boolean;
    } = {}
  ): Promise<this> {
    this.clearNotes();

    if (!this.stateManager) {
      throw new Error('StateManager is required to list connections');
    }

    const includeDetails = params.includeDetails ?? true;
    const showPending = params.showPending ?? true;

    try {
      const connections = await this.getEnhancedConnections();

      if (connections.length === 0) {
        this.executeResult = {
          success: true,
          rawResult: {
            connections: [],
            message: 'There are currently no active connections.',
          },
        } as ExecuteResult & { rawResult?: unknown };
        return this;
      }

      const activeConnections = connections.filter(
        (c): c is Connection => (c as Connection).status === 'established'
      );
      const pendingConnections = connections.filter(
        (c): c is Connection => (c as Connection).isPending
      );
      const needsConfirmation = connections.filter(
        (c): c is Connection => (c as Connection).needsConfirmation
      );

      let output = '';

      if (activeConnections.length > 0) {
        output += `🟢 Active Connections (${activeConnections.length}):\n`;
        activeConnections.forEach((conn, index) => {
          output += this.formatConnection(conn, index, includeDetails);
        });
        output += '\n';
      }

      if (showPending && needsConfirmation.length > 0) {
        output += `🟠 Connections Needing Confirmation (${needsConfirmation.length}):\n`;
        needsConfirmation.forEach((conn, index) => {
          output += this.formatConnection(conn, index, includeDetails);
        });
        output += '\n';
      }

      if (showPending && pendingConnections.length > 0) {
        output += `⚪ Pending Connection Requests (${pendingConnections.length}):\n`;
        pendingConnections.forEach((conn, index) => {
          output += this.formatConnection(conn, index, includeDetails);
        });
      }

      this.executeResult = {
        success: true,
        rawResult: {
          connections,
          formattedOutput: output.trim(),
          activeCount: activeConnections.length,
          pendingCount: pendingConnections.length,
          needsConfirmationCount: needsConfirmation.length,
        },
      } as ExecuteResult & { rawResult?: unknown };
    } catch (error) {
      this.logger.error('Failed to list connections:', error);
      this.executeResult = {
        success: false,
        error: `Failed to list connections: ${
          error instanceof Error ? error.message : String(error)
        }`,
      } as ExecuteResult & { rawResult?: unknown };
    }

    return this;
  }

  private formatConnection(
    conn: unknown,
    index: number,
    includeDetails: boolean
  ): string {
    const connection = conn as {
      profileInfo?: { display_name?: string; bio?: string };
      targetAgentName?: string;
      targetAccountId?: string;
      isPending?: boolean;
      connectionTopicId?: string;
      status?: string;
      created?: Date;
      lastActivity?: Date;
    };

    let output = `${index + 1}. ${
      connection.profileInfo?.display_name ||
      connection.targetAgentName ||
      'Unknown Agent'
    } (${connection.targetAccountId})\n`;
    const displayTopicId = connection.isPending
      ? '(Pending Request)'
      : connection.connectionTopicId;
    output += `   Topic: ${displayTopicId}\n`;
    const statusText = connection.status || 'unknown';
    output += `   Status: ${statusText}\n`;

    if (includeDetails) {
      if (connection.profileInfo?.bio) {
        output += `   Bio: ${connection.profileInfo.bio.substring(0, 100)}${
          connection.profileInfo.bio.length > 100 ? '...' : ''
        }\n`;
      }

      if (connection.created) {
        const createdLabel = connection.isPending
          ? 'Request sent'
          : 'Connection established';
        output += `   ${createdLabel}: ${connection.created.toLocaleString()}\n`;
      }

      if (connection.lastActivity) {
        output += `   Last activity: ${connection.lastActivity.toLocaleString()}\n`;
      }
    }

    return output;
  }

  private async getEnhancedConnections(): Promise<unknown[]> {
    try {
      const { accountId } = this.getAccountAndSigner();
      if (!accountId) {
        return this.stateManager!.listConnections();
      }

      const connectionManager = this.stateManager!.getConnectionsManager();
      if (!connectionManager) {
        this.logger.error(NOT_INITIALIZED_ERROR);
        return this.stateManager!.listConnections();
      }

      const connections = await connectionManager.fetchConnectionData(
        accountId
      );

      for (const connection of connections) {
        this.stateManager!.addActiveConnection(
          connection as unknown as ActiveConnection
        );
      }

      return connections;
    } catch (error) {
      this.logger.error('Failed to get enhanced connections:', error);
      return this.stateManager!.listConnections();
    }
  }

  /**
   * Check messages on a connection
   */
  public async checkMessages(params: {
    targetIdentifier: string;
    fetchLatest?: boolean;
    lastMessagesCount?: number;
  }): Promise<this> {
    this.clearNotes();

    if (!this.stateManager) {
      throw new Error('StateManager is required to check messages');
    }

    const connection = this.stateManager.getConnectionByIdentifier(
      params.targetIdentifier
    );

    if (!connection) {
      this.executeResult = {
        success: false,
        error: `Could not find an active connection matching identifier "${params.targetIdentifier}". Use 'list_connections' to see active connections.`,
      } as ExecuteResult & { rawResult?: unknown };
      return this;
    }

    const connectionTopicId = connection.connectionTopicId || '';

    if (!connectionTopicId || !connectionTopicId.match(/^\d+\.\d+\.\d+$/)) {
      this.logger.error(
        `Invalid connection topic ID format: ${connectionTopicId}`
      );
      this.executeResult = {
        success: false,
        error: `Invalid connection topic ID format: ${connectionTopicId}. Expected format: 0.0.XXXXX`,
      } as ExecuteResult & { rawResult?: unknown };
      return this;
    }

    const targetAgentName = connection.targetAgentName;
    const lastProcessedTimestamp =
      this.stateManager.getLastTimestamp(connectionTopicId);

    this.logger.info(
      `Checking messages for connection with ${targetAgentName} (${connection.targetAccountId}) on topic ${connectionTopicId} (fetchLatest: ${params.fetchLatest}, lastCount: ${params.lastMessagesCount}, since: ${lastProcessedTimestamp})`
    );

    try {
      const result = await this.getMessages(connectionTopicId);
      const allMessages = result.messages;

      if (!allMessages || allMessages.length === 0) {
        this.executeResult = {
          success: true,
          rawResult: {
            messages: [],
            message: `No messages found on connection topic ${connectionTopicId}.`,
          },
        } as ExecuteResult & { rawResult?: unknown };
        return this;
      }

      let messagesToProcess: HCSMessageWithTimestamp[] = [];
      let latestTimestampNanos = lastProcessedTimestamp;
      const isFetchingLatest = params.fetchLatest === true;

      if (isFetchingLatest) {
        this.logger.info('Fetching latest messages regardless of timestamp.');
        const count = params.lastMessagesCount ?? 1;
        messagesToProcess = allMessages.slice(-count);
      } else {
        this.logger.info(
          `Filtering for messages newer than ${lastProcessedTimestamp}`
        );
        messagesToProcess = allMessages.filter(
          (msg: HCSMessageWithTimestamp) => {
            const msgTimestampNanos = msg.timestamp * 1_000_000;
            return msgTimestampNanos > lastProcessedTimestamp;
          }
        );

        if (messagesToProcess.length > 0) {
          latestTimestampNanos = messagesToProcess.reduce(
            (maxTs, msg) => Math.max(maxTs, msg.timestamp * 1_000_000),
            lastProcessedTimestamp
          );
        }
      }

      if (messagesToProcess.length === 0) {
        const message = isFetchingLatest
          ? `Could not retrieve the latest message(s). No messages found on topic ${connectionTopicId}.`
          : `No new messages found for connection with ${targetAgentName} since last check.`;

        this.executeResult = {
          success: true,
          rawResult: {
            messages: [],
            message,
          },
        } as ExecuteResult & { rawResult?: unknown };
        return this;
      }

      this.logger.info(`Processing ${messagesToProcess.length} message(s).`);

      let outputString = isFetchingLatest
        ? `Latest message(s) from ${targetAgentName}:\n`
        : `New messages from ${targetAgentName}:\n`;

      const processedMessages: Array<{
        timestamp: number;
        sequenceNumber: number;
        content: string | undefined;
        raw: HCSMessageWithTimestamp;
      }> = [];

      for (const msg of messagesToProcess) {
        let content = msg.data;
        try {
          if (typeof content === 'string' && content.startsWith('hcs://')) {
            this.logger.debug(`Resolving inscribed message: ${content}`);
            content = await this.getMessageContent(content);
            this.logger.debug(`Resolved content length: ${content?.length}`);
          }

          let displayContent = content;
          try {
            const parsed = JSON.parse(content || '{}');
            if (
              parsed.p === 'hcs-10' &&
              parsed.op === 'message' &&
              parsed.data
            ) {
              const senderOpId = parsed.operator_id || 'unknown_sender';
              displayContent = `[${senderOpId}]: ${parsed.data}`;
            } else {
              displayContent = content;
            }
          } catch {
            displayContent = content;
          }

          const messageDate = new Date(msg.timestamp);
          outputString += `\n[${messageDate.toLocaleString()}] (Seq: ${
            msg.sequence_number
          })\n${displayContent}\n`;

          processedMessages.push({
            timestamp: msg.timestamp,
            sequenceNumber: msg.sequence_number,
            content: displayContent,
            raw: msg,
          });
        } catch (error) {
          const errorMsg = `Error processing message (Seq: ${
            msg.sequence_number
          }): ${error instanceof Error ? error.message : String(error)}`;
          this.logger.error(errorMsg);
          outputString += `\n[Error processing message Seq: ${msg.sequence_number}]\n`;
        }
      }

      if (!isFetchingLatest && latestTimestampNanos > lastProcessedTimestamp) {
        this.logger.debug(
          `Updating timestamp for topic ${connectionTopicId} to ${latestTimestampNanos}`
        );
        this.stateManager.updateTimestamp(
          connectionTopicId,
          latestTimestampNanos
        );
      }

      this.executeResult = {
        success: true,
        rawResult: {
          messages: processedMessages,
          formattedOutput: outputString.trim(),
          targetAgentName,
          connectionTopicId,
        },
      } as ExecuteResult & { rawResult?: unknown };
    } catch (error) {
      this.logger.error(
        `Failed to check messages for topic ${connectionTopicId}: ${error}`
      );
      this.executeResult = {
        success: false,
        error: `Error checking messages for ${targetAgentName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      } as ExecuteResult & { rawResult?: unknown };
    }

    return this;
  }

  /**
   * Find registrations using the configured registry
   */
  public async findRegistrations(params: {
    accountId?: string;
    tags?: number[];
  }): Promise<this> {
    this.clearNotes();

    try {
      const options: {
        network: StandardNetworkType;
        accountId?: string;
        tags?: number[];
      } = {
        network: this.network,
      };

      if (params.accountId) {
        options.accountId = params.accountId;
      }

      if (params.tags && params.tags.length > 0) {
        options.tags = params.tags;
      }

      const result = await this.standardClient.findRegistrations(options);

      if (!result.success || result.error) {
        this.executeResult = {
          success: false,
          error: `Error finding registrations: ${
            result.error || 'Unknown error'
          }`,
        } as ExecuteResult & { rawResult?: unknown };
        return this;
      }

      if (!result.registrations || result.registrations.length === 0) {
        this.executeResult = {
          success: true,
          rawResult: {
            registrations: [],
            message: 'No registrations found matching the criteria.',
          },
        } as ExecuteResult & { rawResult?: unknown };
        return this;
      }

      const formattedRegistrations = result.registrations
        .map((reg: unknown): string => {
          const registration = reg as {
            agent?: { name?: string; capabilities?: string[] };
            accountId?: string;
          };
          const agentName = registration.agent?.name || 'Unknown Agent';
          const accountId = registration.accountId || 'Unknown Account';
          const capabilities =
            registration.agent?.capabilities?.join(', ') || 'None';

          return `Agent: ${agentName} (${accountId}), Capabilities: ${capabilities}`;
        })
        .join('\\n');

      this.executeResult = {
        success: true,
        rawResult: {
          registrations: result.registrations,
          formattedOutput: `Found ${result.registrations.length} registration(s):\\n${formattedRegistrations}`,
        },
      } as ExecuteResult & { rawResult?: unknown };
    } catch (error) {
      this.logger.error('Error during FindRegistrations execution:', error);
      this.executeResult = {
        success: false,
        error: `Failed to search registrations: ${
          error instanceof Error ? error.message : String(error)
        }`,
      } as ExecuteResult & { rawResult?: unknown };
    }

    return this;
  }

  /**
   * Retrieve detailed profile information for an agent
   */
  public async retrieveProfile(params: {
    accountId: string;
    disableCache?: boolean;
  }): Promise<this> {
    this.clearNotes();

    try {
      const profileResponse = await this.standardClient.retrieveProfile(
        params.accountId,
        params.disableCache || false
      );

      if (!profileResponse.success) {
        this.executeResult = {
          success: false,
          error: `Failed to retrieve profile: ${
            profileResponse.error || 'Unknown error'
          }`,
        } as ExecuteResult & { rawResult?: unknown };
        return this;
      }

      const profile = profileResponse.profile;
      const topicInfo = profileResponse.topicInfo;

      let profileDetails = `Profile for ${params.accountId}:\n`;
      profileDetails += `Name: ${profile.name || 'Unknown'}\n`;
      profileDetails += `Bio: ${profile.bio || 'No bio provided'}\n`;
      profileDetails += `Type: ${profile.type || 'Unknown'}\n`;
      profileDetails += `Model: ${profile.model || 'Unknown'}\n`;

      if (profile.capabilities && profile.capabilities.length > 0) {
        profileDetails += `Capabilities: ${profile.capabilities.join(', ')}\n`;
      } else {
        profileDetails += `Capabilities: None listed\n`;
      }

      if (topicInfo) {
        profileDetails += `Inbound Topic: ${
          topicInfo.inboundTopic || 'Unknown'
        }\n`;
        profileDetails += `Outbound Topic: ${
          topicInfo.outboundTopic || 'Unknown'
        }\n`;
        profileDetails += `Profile Topic: ${
          topicInfo.profileTopicId || 'Unknown'
        }\n`;
      }

      if (profile.social && Object.keys(profile.social).length > 0) {
        profileDetails += `Social: ${Object.entries(profile.social)
          .map(
            ([platform, handle]: [string, unknown]): string =>
              `${platform}: ${handle}`
          )
          .join(', ')}\n`;
      }

      if (profile.properties && Object.keys(profile.properties).length > 0) {
        profileDetails += `Properties: ${JSON.stringify(profile.properties)}\n`;
      }

      this.executeResult = {
        success: true,
        rawResult: {
          profileDetails,
          rawProfile: profileResponse,
        },
      } as ExecuteResult & { rawResult?: unknown };
    } catch (error) {
      this.logger.error(
        `Unexpected error retrieving profile for ${params.accountId}:`,
        error
      );
      this.executeResult = {
        success: false,
        error: `Unexpected error retrieving profile for ${params.accountId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      } as ExecuteResult & { rawResult?: unknown };
    }

    return this;
  }

  /**
   * Override execute to return stored HCS10 operation results
   */
  public override async execute(): Promise<ExecuteResult> {
    if (this.executeResult) {
      return {
        success: this.executeResult.success,
        transactionId: this.executeResult.transactionId,
        receipt: this.executeResult.receipt,
        scheduleId: this.executeResult.scheduleId,
        error: this.executeResult.error,
        rawResult: this.executeResult.rawResult,
        notes: this.notes,
      } as ExecuteResult & { rawResult?: unknown; notes?: string[] };
    }

    return {
      success: false,
      error: 'No operation result available. Call a builder method first.',
    };
  }
}
