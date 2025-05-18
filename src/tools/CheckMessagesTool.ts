import { StructuredTool, ToolParams } from '@langchain/core/tools';
import { z } from 'zod';
import { HCS10Client, HCSMessageWithTimestamp } from '../hcs10/HCS10Client';
import { IStateManager } from '../state/state-types';
import { Logger } from '@hashgraphonline/standards-sdk'; // Assuming logger utility

export interface CheckMessagesToolParams extends ToolParams {
  hcsClient: HCS10Client;
  stateManager: IStateManager;
}

/**
 * A tool to check for new messages on an active HCS-10 connection topic,
 * or optionally fetch the latest messages regardless of timestamp.
 */
export class CheckMessagesTool extends StructuredTool {
  name = 'check_messages';
  description = `Checks for and retrieves messages from an active connection. 
Identify the target agent using their account ID (e.g., 0.0.12345) or the connection number shown in 'list_connections'. 
By default, it only retrieves messages newer than the last check. 
Use 'fetchLatest: true' to get the most recent messages regardless of when they arrived. 
Use 'lastMessagesCount' to specify how many latest messages to retrieve (default 1 when fetchLatest is true).`;
  schema = z.object({
    targetIdentifier: z
      .string()
      .describe(
        "The account ID (e.g., 0.0.12345) of the target agent OR the connection number (e.g., '1', '2') from the 'list_connections' tool to check messages for."
      ),
    fetchLatest: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        'Set to true to fetch the latest messages even if they have been seen before, ignoring the last checked timestamp. Defaults to false (fetching only new messages).'
      ),
    lastMessagesCount: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        'When fetchLatest is true, specifies how many of the most recent messages to retrieve. Defaults to 1.'
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
    fetchLatest,
    lastMessagesCount,
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
      `Checking messages for connection with ${targetAgentName} (${connection.targetAccountId}) on topic ${connectionTopicId} (fetchLatest: ${fetchLatest}, lastCount: ${lastMessagesCount}, since: ${lastProcessedTimestamp})`
    );

    try {
      // 1. Get messages from the topic
      const result = await this.hcsClient.getMessages(connectionTopicId);
      const allMessages = result.messages;

      if (!allMessages || allMessages.length === 0) {
        return `No messages found on connection topic ${connectionTopicId}.`;
      }

      let messagesToProcess: HCSMessageWithTimestamp[] = [];
      let latestTimestampNanos = lastProcessedTimestamp;
      const isFetchingLatest = fetchLatest === true;

      if (isFetchingLatest) {
        this.logger.info('Fetching latest messages regardless of timestamp.');
        const count = lastMessagesCount ?? 1;
        messagesToProcess = allMessages.slice(-count);
      } else {
        this.logger.info(
          `Filtering for messages newer than ${lastProcessedTimestamp}`
        );
        messagesToProcess = allMessages.filter((msg) => {
          const msgTimestampNanos = msg.timestamp * 1_000_000;
          return msgTimestampNanos > lastProcessedTimestamp;
        });
        
        if (messagesToProcess.length > 0) {
          latestTimestampNanos = messagesToProcess.reduce(
            (maxTs, msg) => Math.max(maxTs, msg.timestamp * 1_000_000),
             lastProcessedTimestamp
          );
        }
      }

      if (messagesToProcess.length === 0) {
        return isFetchingLatest
          ? `Could not retrieve the latest message(s). No messages found on topic ${connectionTopicId}.`
          : `No new messages found for connection with ${targetAgentName} since last check.`;
      }

      this.logger.info(`Processing ${messagesToProcess.length} message(s).`);

      // 3. Process messages (resolve inscriptions, format)
      let outputString = isFetchingLatest
        ? `Latest message(s) from ${targetAgentName}:
`
        : `New messages from ${targetAgentName}:
`;

      for (const msg of messagesToProcess) {
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
            const parsed = JSON.parse(content || '{}');
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

      // 4. Update the timestamp in demo state ONLY if fetching NEW messages
      if (!isFetchingLatest && latestTimestampNanos > lastProcessedTimestamp) {
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
