import { z } from 'zod';
import { BaseHCS10TransactionTool } from './base-hcs10-tools';
import { HCS10Builder } from '../../builders/hcs10/hcs10-builder';
import { HCS10TransactionToolParams } from './hcs10-tool-params';
import { BaseServiceBuilder } from 'hedera-agent-kit';

const AcceptConnectionRequestZodSchema = z.object({
  requestKey: z
    .string()
    .describe(
      'The unique request key of the specific request to accept. Use the "manage_connection_requests" tool with action="list" first to get valid keys.'
    ),
  hbarFee: z
    .number()
    .optional()
    .describe(
      'Optional HBAR fee amount to charge the connecting agent per message on the new connection topic.'
    ),
  exemptAccountIds: z
    .array(z.string())
    .optional()
    .describe(
      'Optional list of account IDs to exempt from any configured fees on the new connection topic.'
    ),
});

/**
 * Tool for accepting incoming HCS-10 connection requests
 */
export class AcceptConnectionRequestTool extends BaseHCS10TransactionTool<
  typeof AcceptConnectionRequestZodSchema
> {
  name = 'accept_connection_request';
  description =
    'Accepts a pending HCS-10 connection request from another agent. Use list_unapproved_connection_requests to see pending requests.';
  specificInputSchema = AcceptConnectionRequestZodSchema;

  constructor(params: HCS10TransactionToolParams) {
    super(params);
    this.neverScheduleThisTool = true;
    this.requiresMultipleTransactions = true;
  }

  protected async callBuilderMethod(
    builder: BaseServiceBuilder,
    specificArgs: z.infer<typeof AcceptConnectionRequestZodSchema>
  ): Promise<void> {
    const hcs10Builder = builder as HCS10Builder;

    await hcs10Builder.acceptConnection({
      requestKey: specificArgs.requestKey,
      hbarFee: specificArgs.hbarFee,
      exemptAccountIds: specificArgs.exemptAccountIds,
    });
  }
}