import { z } from 'zod';
import { BaseHCS10QueryTool } from './base-hcs10-tools';
import { HCS10QueryToolParams } from './hcs10-tool-params';
const ListUnapprovedConnectionRequestsZodSchema = z.object({});

/**
 * Lists all connection requests that are not fully established
 */
export class ListUnapprovedConnectionRequestsTool extends BaseHCS10QueryTool<
  typeof ListUnapprovedConnectionRequestsZodSchema
> {
  name = 'list_unapproved_connection_requests';
  description =
    'Lists all connection requests that are not fully established, including incoming requests needing approval and outgoing requests waiting for confirmation.';
  specificInputSchema = ListUnapprovedConnectionRequestsZodSchema;
  constructor(params: HCS10QueryToolParams) {
    super(params);
  }

  protected async executeQuery(): Promise<unknown> {
    const hcs10Builder = this.hcs10Builder;
    await hcs10Builder.listUnapprovedConnectionRequests();
    const result = await hcs10Builder.execute();
    return 'rawResult' in result ? result.rawResult : result;
  }
}