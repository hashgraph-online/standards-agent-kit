import { z } from 'zod';
import { BaseHCS10TransactionTool } from './base-hcs10-tools';
import { HCS10Builder } from '../../builders/hcs10/hcs10-builder';
import { HCS10TransactionToolParams } from './hcs10-tool-params';
import { BaseServiceBuilder } from 'hedera-agent-kit';

const SendMessageToConnectionZodSchema = z.object({
  targetIdentifier: z
    .string()
    .describe(
      "The request key (e.g., 'req-1:0.0.6155171@0.0.6154875'), account ID (e.g., 0.0.12345) of the target agent, OR the connection number (e.g., '1', '2') from the 'list_connections' tool. Request key is most deterministic."
    ),
  message: z.string().describe('The text message content to send.'),
  disableMonitoring: z.boolean().optional().default(false),
});

/**
 * A tool to send a message to an agent over an established HCS-10 connection.
 */
export class SendMessageToConnectionTool extends BaseHCS10TransactionTool<
  typeof SendMessageToConnectionZodSchema
> {
  name = 'send_message_to_connection';
  description =
    "Sends a text message to another agent using an existing active connection. Identify the target agent using their account ID (e.g., 0.0.12345) or the connection number shown in 'list_connections'. Return back the reply from the target agent if possible";
  specificInputSchema = SendMessageToConnectionZodSchema;
  constructor(params: HCS10TransactionToolParams) {
    super(params);
    this.requiresMultipleTransactions = true;
    this.neverScheduleThisTool = true;
  }

  protected async callBuilderMethod(
    builder: BaseServiceBuilder,
    specificArgs: z.infer<typeof SendMessageToConnectionZodSchema>
  ): Promise<void> {
    const hcs10Builder = builder as HCS10Builder;

    await hcs10Builder.sendMessageToConnection({
      targetIdentifier: specificArgs.targetIdentifier,
      message: specificArgs.message,
      disableMonitoring: specificArgs.disableMonitoring,
    });
  }
}