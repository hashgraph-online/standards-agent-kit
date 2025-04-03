// src/tools/send-message-to-connection-tool.ts

import { StructuredTool, ToolParams } from '@langchain/core/tools';
import { z } from 'zod';
import { HCS10Client } from '../hcs10/HCS10Client';
import { IStateManager } from '../state/open-convai-state';
import { Logger } from '@hashgraphonline/standards-sdk'; // Assuming logger utility

export interface SendMessageToConnectionToolParams extends ToolParams {
  hcsClient: HCS10Client;
  stateManager: IStateManager;
}

/**
 * A tool to send a message to an agent over an established HCS-10 connection.
 */
export class SendMessageToConnectionTool extends StructuredTool {
  name = 'send_message_to_connection';
  description =
    "Sends a text message to another agent using an existing active connection. Identify the target agent using their account ID (e.g., 0.0.12345) or the connection number shown in 'list_connections'. Return back the reply from the target agent if possible";
  schema = z.object({
    targetIdentifier: z
      .string()
      .describe(
        "The account ID (e.g., 0.0.12345) of the target agent OR the connection number (e.g., '1', '2') from the 'list_connections' tool."
      ),
    message: z.string().describe('The text message content to send.'),
  });

  private hcsClient: HCS10Client;
  private stateManager: IStateManager;
  private logger: Logger;

  constructor({
    hcsClient,
    stateManager,
    ...rest
  }: SendMessageToConnectionToolParams) {
    super(rest);
    this.hcsClient = hcsClient;
    this.stateManager = stateManager;
    this.logger = Logger.getInstance({ module: 'SendMessageToConnectionTool' });
  }

  protected async _call({
    targetIdentifier,
    message,
  }: z.infer<this['schema']>): Promise<string> {
    const currentAgent = this.stateManager.getCurrentAgent();
    if (!currentAgent) {
      return 'Error: Cannot send message. No agent is currently active. Please register or select an agent first.';
    }

    const connection =
      this.stateManager.getConnectionByIdentifier(targetIdentifier);
    if (!connection) {
      return `Error: Could not find an active connection matching identifier "${targetIdentifier}". Use 'list_connections' to see active connections.`;
    }

    const connectionTopicId = connection.connectionTopicId;
    const targetAgentName = connection.targetAgentName;

    // Construct the sender's operator ID
    const operatorId = `${currentAgent.inboundTopicId}@${currentAgent.accountId}`;

    this.logger.info(
      `Sending message from ${operatorId} to ${targetAgentName} (${connection.targetAccountId}) via connection topic ${connectionTopicId}`
    );

    try {
      // Call sendMessage with correct arguments
      const sequenceNumber = await this.hcsClient.sendMessage(
        connectionTopicId,
        message, // Message content as 'data'
        `Agent message from ${currentAgent.name}` // Optional memo
      );

      if (!sequenceNumber) {
        throw new Error('Failed to send message');
      }

      this.logger.info(`Message sent. Sequence Number: ${sequenceNumber}`);

      const replyBack = await this.monitorResponses(
        connectionTopicId,
        operatorId,
        sequenceNumber
      );

      if (replyBack) {
        this.logger.info(`Got reply from ${targetAgentName}`, replyBack);
        // Format the return string clearly as an observation/reply
        return `Received reply from ${targetAgentName}: ${replyBack}`;
      }

      // Return message based on the status string if no reply was received/awaited
      return `Message sent to ${targetAgentName} (${connection.targetAccountId}) via connection ${connectionTopicId}. Sequence Number: ${sequenceNumber}`;
    } catch (error) {
      this.logger.error(
        `Failed to send message via connection ${connectionTopicId}: ${error}`
      );
      return `Error sending message to ${targetAgentName}: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }

  private async monitorResponses(
    topicId: string,
    operatorId: string,
    sequenceNumber: number
  ): Promise<string | null> {
    const maxAttempts = 30;
    const attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const messages = await this.hcsClient.getMessageStream(topicId);

        for (const message of messages.messages) {
          if (
            message.sequence_number < sequenceNumber ||
            message.operator_id === operatorId
          ) {
            continue;
          }
          const content = await this.hcsClient.getMessageContent(message.data);

          return content;
        }
      } catch (error) {
        this.logger.error(`Error monitoring responses: ${error}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }
    return null;
  }
}
