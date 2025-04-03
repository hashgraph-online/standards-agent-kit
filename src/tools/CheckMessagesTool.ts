import { StructuredTool, ToolParams } from '@langchain/core/tools';
import { z } from 'zod';
import { HCS10Client } from '../hcs10/HCS10Client';
import { IStateManager } from '../state/open-convai-state';
import { Logger } from '@hashgraphonline/standards-sdk'; // Assuming logger utility

export interface CheckMessagesToolParams extends ToolParams {
  hcsClient: HCS10Client;
  stateManager: IStateManager;
}

/**
 * A tool to check for new messages on an active HCS-10 connection topic.
 */
export class CheckMessagesTool extends StructuredTool {
  name = 'check_new_messages';
  description =
    "Checks for and retrieves new messages from an active connection. Identify the target agent using their account ID (e.g., 0.0.12345) or the connection number shown in 'list_connections'.";
  schema = z.object({
    targetIdentifier: z
      .string()
      .describe(
        "The account ID (e.g., 0.0.12345) of the target agent OR the connection number (e.g., '1', '2') from the 'list_connections' tool to check messages for."
      ),
  });

  public hcsClient: HCS10Client;
  private stateManager: IStateManager;
  private logger: Logger;

  constructor({ hcsClient, stateManager, ...rest }: CheckMessagesToolParams) {
    super(rest);
    this.hcsClient = hcsClient;
    this.stateManager = stateManager;
    this.logger = Logger.getInstance({ module: 'CheckMessagesTool' });
  }

  protected async _call({
    targetIdentifier,
  }: z.infer<this['schema']>): Promise<string> {
    const connection =
      this.stateManager.getConnectionByIdentifier(targetIdentifier);

    if (!connection) {
      return `Error: Could not find an active connection matching identifier "${targetIdentifier}". Use 'list_connections' to see active connections.`;
    }

    const connectionTopicId = connection.connectionTopicId;
    const targetAgentName = connection.targetAgentName;
    const lastProcessedTimestamp =
      this.stateManager.getLastTimestamp(connectionTopicId);

    this.logger.info(
      `Checking messages for connection with ${targetAgentName} (${connection.targetAccountId}) on topic ${connectionTopicId} since timestamp ${lastProcessedTimestamp}`
    );

    try {
      // 1. Get messages from the topic
      // Note: hcsClient.getMessages returns timestamp in milliseconds
      const result = await this.hcsClient.getMessages(connectionTopicId);
      const allMessages = result.messages; // Array<{ timestamp: number; data: string; sequence_number: number }>

      if (!allMessages || allMessages.length === 0) {
        return `No messages found on connection topic ${connectionTopicId}.`;
      }

      // 2. Filter messages newer than the last processed timestamp
      // Convert message timestamp (ms) to nanoseconds for comparison
      const newMessages = allMessages.filter((msg) => {
        const msgTimestampNanos = msg.timestamp * 1_000_000;
        return msgTimestampNanos > lastProcessedTimestamp;
      });

      if (newMessages.length === 0) {
        return `No new messages found for connection with ${targetAgentName} since last check.`;
      }

      this.logger.info(`Found ${newMessages.length} new message(s).`);

      // 3. Process new messages (resolve inscriptions, format)
      let outputString = `New messages from ${targetAgentName}:
`;
      let latestTimestampNanos = lastProcessedTimestamp;

      for (const msg of newMessages) {
        const msgTimestampNanos = msg.timestamp * 1_000_000;
        latestTimestampNanos = Math.max(
          latestTimestampNanos,
          msgTimestampNanos
        );

        let content = msg.data;
        try {
          // Check for inscription HRL
          if (typeof content === 'string' && content.startsWith('hcs://')) {
            this.logger.debug(`Resolving inscribed message: ${content}`);
            content = await this.hcsClient.getMessageContent(content);
            this.logger.debug(`Resolved content length: ${content?.length}`);
          }

          // Attempt to parse the content as the HCS-10 structure
          let displayContent = content; // Default to raw content
          try {
            const parsed = JSON.parse(content);
            if (
              parsed.p === 'hcs-10' &&
              parsed.op === 'message' &&
              parsed.data
            ) {
              // Extract sender and actual data from standard message format
              const senderOpId = parsed.operator_id || 'unknown_sender';
              displayContent = `[${senderOpId}]: ${parsed.data}`;
            } else {
              // If not standard format, maybe just show raw stringified version
              displayContent = content; // Keep raw if parsing worked but not expected format
            }
          } catch (parseError) {
            // Content wasn't JSON, keep raw content
            displayContent = content;
          }

          const messageDate = new Date(msg.timestamp);
          outputString += `\n[${messageDate.toLocaleString()}] (Seq: ${
            msg.sequence_number
          })
${displayContent}
`;
        } catch (error) {
          const errorMsg = `Error processing message (Seq: ${
            msg.sequence_number
          }): ${error instanceof Error ? error.message : String(error)}`;
          this.logger.error(errorMsg);
          outputString += `\n[Error processing message Seq: ${msg.sequence_number}]\n`;
        }
      }

      // 4. Update the timestamp in demo state
      if (latestTimestampNanos > lastProcessedTimestamp) {
        this.logger.debug(
          `Updating timestamp for topic ${connectionTopicId} to ${latestTimestampNanos}`
        );
        this.stateManager.updateTimestamp(
          connectionTopicId,
          latestTimestampNanos
        );
      }

      return outputString.trim();
    } catch (error) {
      this.logger.error(
        `Failed to check messages for topic ${connectionTopicId}: ${error}`
      );
      return `Error checking messages for ${targetAgentName}: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }
}
