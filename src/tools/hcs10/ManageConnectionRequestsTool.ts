import { z } from 'zod';
import { BaseHCS10QueryTool } from './base-hcs10-tools';
import { HCS10QueryToolParams } from './hcs10-tool-params';

const ManageConnectionRequestsZodSchema = z.object({
  action: z
    .enum(['list', 'view', 'reject'])
    .describe(
      'The action to perform: list all requests, view details of a specific request, or reject a request'
    ),
  requestKey: z
    .string()
    .optional()
    .describe(
      'The unique request key to view or reject (required for view and reject actions)'
    ),
});

/**
 * A tool for managing incoming connection requests in a LangChain-compatible way.
 * This tool allows an agent to list, view details of, and reject incoming connection requests.
 */
export class ManageConnectionRequestsTool extends BaseHCS10QueryTool<
  typeof ManageConnectionRequestsZodSchema
> {
  name = 'manage_connection_requests';
  description =
    'Manage incoming connection requests. List pending requests, view details about requesting agents, and reject connection requests. Use the separate "accept_connection_request" tool to accept.';
  specificInputSchema = ManageConnectionRequestsZodSchema;
  constructor(params: HCS10QueryToolParams) {
    super(params);
  }

  protected async executeQuery({
    action,
    requestKey,
  }: z.infer<typeof ManageConnectionRequestsZodSchema>): Promise<unknown> {
    const hcs10Builder = this.hcs10Builder;
    const params: { action: 'list' | 'view' | 'reject'; requestKey?: string } =
      { action };
    if (requestKey !== undefined) {
      params.requestKey = requestKey;
    }
    await hcs10Builder.manageConnectionRequests(params);
    const result = await hcs10Builder.execute();
    return 'rawResult' in result ? result.rawResult : result;
  }
}
