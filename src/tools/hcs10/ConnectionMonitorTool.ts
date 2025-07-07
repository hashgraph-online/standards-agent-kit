import { z } from 'zod';
import { BaseHCS10TransactionTool } from './base-hcs10-tools';
import { HCS10Builder } from '../../builders/hcs10/hcs10-builder';
import { HCS10TransactionToolParams } from './hcs10-tool-params';
import { BaseServiceBuilder } from 'hedera-agent-kit';

const ConnectionMonitorZodSchema = z.object({
  acceptAll: z
    .boolean()
    .optional()
    .describe(
      'Whether to automatically accept all incoming connection requests. Default is false.'
    ),
  targetAccountId: z
    .string()
    .optional()
    .describe(
      'If provided, only accept connection requests from this specific account ID.'
    ),
  hbarFees: z
    .array(
      z.object({
        amount: z.number(),
        collectorAccount: z.string().optional(),
      })
    )
    .optional()
    .describe(
      'Array of HBAR fee amounts to charge per message (with optional collector accounts).'
    ),
  tokenFees: z
    .array(
      z.object({
        amount: z.number(),
        tokenId: z.string(),
        collectorAccount: z.string().optional(),
      })
    )
    .optional()
    .describe(
      'Array of token fee amounts and IDs to charge per message (with optional collector accounts).'
    ),
  exemptAccountIds: z
    .array(z.string())
    .optional()
    .describe(
      'Array of account IDs to exempt from ALL fees set in this request.'
    ),
  monitorDurationSeconds: z
    .number()
    .optional()
    .describe(
      'How long to monitor for incoming requests in seconds. Default is 120.'
    ),
  defaultCollectorAccount: z
    .string()
    .optional()
    .describe(
      'Default account to collect fees if not specified at the fee level. Defaults to the agent account.'
    ),
});

/**
 * A tool for monitoring incoming connection requests and accepting them with optional fee settings.
 */
export class ConnectionMonitorTool extends BaseHCS10TransactionTool<
  typeof ConnectionMonitorZodSchema
> {
  name = 'monitor_connections';
  description =
    'Monitors for incoming connection requests and accepts them with optional fee settings. Use this to watch for connection requests and accept them, optionally setting HBAR or token fees on the connection. Note: When acceptAll=true, this tool requires multiple transactions and cannot be used in returnBytes mode.';
  specificInputSchema = ConnectionMonitorZodSchema;
  constructor(params: HCS10TransactionToolParams) {
    super(params);
    this.neverScheduleThisTool = true;
    this.requiresMultipleTransactions = true;
  }

  protected async callBuilderMethod(
    builder: BaseServiceBuilder,
    specificArgs: z.infer<typeof ConnectionMonitorZodSchema>
  ): Promise<void> {
    const hcs10Builder = builder as HCS10Builder;
    await hcs10Builder.monitorConnections({
      ...(specificArgs.acceptAll !== undefined && {
        acceptAll: specificArgs.acceptAll,
      }),
      ...(specificArgs.targetAccountId !== undefined && {
        targetAccountId: specificArgs.targetAccountId,
      }),
      ...(specificArgs.monitorDurationSeconds !== undefined && {
        monitorDurationSeconds: specificArgs.monitorDurationSeconds,
      }),
      hbarFees: (specificArgs.hbarFees || []) as Array<{
        amount: number;
        collectorAccount?: string;
      }>,
      tokenFees: (specificArgs.tokenFees || []) as Array<{
        amount: number;
        tokenId: string;
        collectorAccount?: string;
      }>,
      ...(specificArgs.exemptAccountIds !== undefined && {
        exemptAccountIds: specificArgs.exemptAccountIds,
      }),
      ...(specificArgs.defaultCollectorAccount !== undefined && {
        defaultCollectorAccount: specificArgs.defaultCollectorAccount,
      }),
    });
  }
}
