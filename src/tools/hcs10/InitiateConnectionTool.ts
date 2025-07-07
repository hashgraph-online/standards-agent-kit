import { z } from 'zod';
import { BaseHCS10TransactionTool } from './base-hcs10-tools';
import { HCS10Builder } from '../../builders/hcs10/hcs10-builder';
import { HCS10TransactionToolParams } from './hcs10-tool-params';
import { BaseServiceBuilder } from 'hedera-agent-kit';

const InitiateConnectionZodSchema = z.object({
  targetAccountId: z
    .string()
    .describe(
      'The Hedera account ID (e.g., 0.0.12345) of the agent you want to connect with.'
    ),
  disableMonitor: z
    .boolean()
    .optional()
    .describe(
      'If true, does not wait for connection confirmation. Returns immediately after sending the request.'
    ),
  memo: z
    .string()
    .optional()
    .describe(
      'Optional memo to include with the connection request (e.g., "Hello from Alice"). If not provided, defaults to "true" or "false" based on monitoring preference.'
    ),
});

/**
 * A tool to actively START a NEW HCS-10 connection TO a target agent.
 * Requires the target agent's account ID.
 * It retrieves their profile, sends a connection request, and optionally waits for confirmation.
 * Use this tool ONLY to actively INITIATE an OUTGOING connection.
 */
export class InitiateConnectionTool extends BaseHCS10TransactionTool<
  typeof InitiateConnectionZodSchema
> {
  name = 'initiate_connection';
  description =
    'Actively STARTS a NEW HCS-10 connection TO a specific target agent identified by their account ID. Requires the targetAccountId parameter. Use this ONLY to INITIATE an OUTGOING connection request.';
  specificInputSchema = InitiateConnectionZodSchema;
  constructor(params: HCS10TransactionToolParams) {
    super(params);
    this.neverScheduleThisTool = true;
    this.requiresMultipleTransactions = true;
  }

  protected async callBuilderMethod(
    builder: BaseServiceBuilder,
    specificArgs: z.infer<typeof InitiateConnectionZodSchema>
  ): Promise<void> {
    const hcs10Builder = builder as HCS10Builder;
    const params: {
      targetAccountId: string;
      disableMonitor?: boolean;
      memo?: string;
    } = {
      targetAccountId: specificArgs.targetAccountId,
    };
    if (specificArgs.disableMonitor !== undefined) {
      params.disableMonitor = specificArgs.disableMonitor;
    }
    if (specificArgs.memo !== undefined) {
      params.memo = specificArgs.memo;
    }
    await hcs10Builder.initiateConnection(params);
  }
}