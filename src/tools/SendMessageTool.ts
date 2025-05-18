import { HCS10Client } from '../hcs10/HCS10Client';
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Logger } from '@hashgraphonline/standards-sdk';

/**
 * SendMessageTool wraps the sendMessage() function of HCS10Client.
 * It sends a message to a specified Hedera topic and monitors for responses.
 */
export class SendMessageTool extends StructuredTool {
  name = 'send_message';
  description =
    'Sends a message to a specified Hedera topic using HCS-10 and monitors for responses.';
  private client: HCS10Client;
  private lastProcessedTimestamp: number = 0;
  private logger: Logger;

  schema = z.object({
    topicId: z.string().describe('The Hedera topic ID to send the message to'),
    message: z.string().describe('The message content to send'),
    disableMonitoring: z
      .boolean()
      .optional()
      .describe('Whether to disable monitoring for responses'),
  });

  /**
   * @param client - Instance of HCS10Client.
   */
  constructor(client: HCS10Client) {
    super();
    this.client = client;
    this.logger = Logger.getInstance({ module: 'SendMessageTool' });
  }

  /**
   * Calls sendMessage() with the provided parameters.
   */
  async _call(input: {
    topicId: string;
    message: string;
    disableMonitoring: boolean;
  }): Promise<string> {
    try {
      const result = await this.client.sendMessage(
        input.topicId,
        input.message
      );
      if (!result) {
        throw new Error('Failed to send message');
      }
      this.logger.info(`Message sent with sequence number ${result}`);
      if (!input.disableMonitoring) {
        const response = await this.monitorResponses(input.topicId, result);
        return `Successfully sent message to topic ${input.topicId}${
          response ? `\nResponse: ${response}` : ''
        }`;
      } else {
        return `Successfully sent message to topic ${input.topicId}`;
      }
    } catch (error) {
      throw new Error(
        `Failed to send message: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async monitorResponses(
    topicId: string,
    sequenceNumber: number
  ): Promise<string | null> {
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const messages = await this.client.getMessageStream(topicId);

        for (const message of messages.messages) {
          if (
            message.created &&
            message.created.getTime() > this.lastProcessedTimestamp
          ) {
            this.lastProcessedTimestamp = message.created.getTime();

            const content = await this.client.getMessageContent(message.data || '');

            let parsedContent;
            try {
              parsedContent = JSON.parse(content);
            } catch (error) {
              this.logger.error(`Error parsing message content: ${error}`);
              continue;
            }
            if (message.sequence_number > sequenceNumber) {
              // Unwrap nested data field if present
              if (parsedContent && typeof parsedContent.data === 'string') {
                return parsedContent.data;
              }
              return JSON.stringify(parsedContent);
            }
          }
        }
      } catch (error) {
        this.logger.error(`Error monitoring responses: ${error}`);
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return null;
  }
}
