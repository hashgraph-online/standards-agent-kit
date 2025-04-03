import { StructuredTool, ToolParams } from '@langchain/core/tools';
import { z } from 'zod';
import { HCS10Client } from '../hcs10/HCS10Client';
import {
  IStateManager,
  ActiveConnection,
} from '../state/open-convai-state';
import { Logger } from '@hashgraphonline/standards-sdk'; // Assuming logger utility

export interface InitiateConnectionToolParams extends ToolParams {
  hcsClient: HCS10Client;
  stateManager: IStateManager;
}

/**
 * A tool to actively START a NEW HCS-10 connection TO a target agent.
 * Requires the target agent's account ID.
 * It retrieves their profile, sends a connection request, waits for confirmation, and stores the connection using the provided stateManager.
 * Use this tool ONLY to actively INITIATE an OUTGOING connection.
 */
export class InitiateConnectionTool extends StructuredTool {
  name = 'initiate_connection';
  description =
    'Actively STARTS a NEW HCS-10 connection TO a specific target agent identified by their account ID. Requires the targetAccountId parameter. Use this ONLY to INITIATE an OUTGOING connection request.';
  schema = z.object({
    targetAccountId: z
      .string()
      .describe(
        'The Hedera account ID (e.g., 0.0.12345) of the agent you want to connect with.'
      ),
  });

  private hcsClient: HCS10Client;
  private stateManager: IStateManager;
  private logger: Logger;

  constructor({
    hcsClient,
    stateManager,
    ...rest
  }: InitiateConnectionToolParams) {
    super(rest);
    this.hcsClient = hcsClient;
    this.stateManager = stateManager;
    this.logger = Logger.getInstance({ module: 'InitiateConnectionTool' });
  }

  protected async _call({
    targetAccountId,
  }: z.infer<this['schema']>): Promise<string> {
    const currentAgent = this.stateManager.getCurrentAgent();
    if (!currentAgent) {
      return 'Error: Cannot initiate connection. No agent is currently active. Please register or select an agent first.';
    }

    this.logger.info(
      `Attempting connection from ${currentAgent.accountId} to ${targetAccountId}`
    );

    try {
      this.logger.debug(`Retrieving profile for ${targetAccountId}...`);
      const targetProfile = await this.hcsClient.retrieveProfile(
        targetAccountId
      );
      if (!targetProfile?.topicInfo?.inboundTopic) {
        return `Error: Could not retrieve profile or find inbound topic ID for target agent ${targetAccountId}. They might not be registered or have a public profile.`;
      }
      const targetInboundTopicId = targetProfile.topicInfo.inboundTopic;
      const targetAgentName =
        targetProfile.profile.name || `Agent ${targetAccountId}`;

      const requestResult = await this.hcsClient.submitConnectionRequest(
        targetInboundTopicId,
        currentAgent.name
      );
      let connectionRequestId: number | null = null;
      const sequenceNumberLong = requestResult?.topicSequenceNumber;
      if (sequenceNumberLong !== null) {
        try {
          connectionRequestId = sequenceNumberLong.toNumber();
          if (isNaN(connectionRequestId)) {
            throw new Error('Converted sequence number is NaN.');
          }
        } catch (conversionError) {
          throw new Error(
            `Failed to convert connection request sequence number: ${conversionError}`
          );
        }
      } else {
        throw new Error('Connection request sequence number not found.');
      }

      const confirmationTimeoutMs = 60000;
      const delayMs = 2000;
      const maxAttempts = Math.ceil(confirmationTimeoutMs / delayMs);
      const confirmationResult =
        await this.hcsClient.waitForConnectionConfirmation(
          targetInboundTopicId,
          connectionRequestId,
          maxAttempts,
          delayMs
        );

      if (!confirmationResult?.connectionTopicId) {
        return `Error: Connection confirmation not received from ${targetAccountId} (for request ${connectionRequestId}) within ${
          confirmationTimeoutMs / 1000
        } seconds.`;
      }

      const connectionTopicId = confirmationResult.connectionTopicId;
      this.logger.info(`Connection confirmed! Topic ID: ${connectionTopicId}`);

      const newConnection: ActiveConnection = {
        targetAccountId: targetAccountId,
        targetAgentName: targetAgentName,
        targetInboundTopicId: targetInboundTopicId,
        connectionTopicId: connectionTopicId,
      };
      this.stateManager.addActiveConnection(newConnection);

      // Find the newly added connection to get its implicit ID (index+1) for the return message
      const connections = this.stateManager.listConnections();
      const addedEntry = connections.find(
        (c) => c.connectionTopicId === connectionTopicId
      );
      const localConnectionId = addedEntry
        ? connections.indexOf(addedEntry) + 1
        : null;

      const idString = localConnectionId ? `#${localConnectionId}` : '';
      return `Successfully established connection ${idString} with ${targetAgentName} (${targetAccountId}). Connection Topic: ${connectionTopicId}. You can now send messages using this connection.`;
    } catch (error) {
      this.logger.error(`Connection initiation failed: ${error}`);
      // No state was added for pending connection, so no cleanup needed here
      return `Error initiating connection with ${targetAccountId}: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }
}
