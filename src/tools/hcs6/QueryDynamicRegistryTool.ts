import { z } from 'zod';
import { BaseHCS6QueryTool } from './base-hcs6-tools';
import { HCS6QueryToolParams } from './hcs6-tool-params';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';

/**
 * Schema for querying a dynamic registry
 */
const QueryDynamicRegistrySchema = z.object({
  topicId: z.string()
    .describe('The registry topic ID to query'),
  limit: z.number()
    .optional()
    .default(100)
    .describe('Maximum number of entries to retrieve'),
  order: z.enum(['asc', 'desc'])
    .optional()
    .default('desc')
    .describe('Order of entries (desc shows latest first)'),
  skip: z.number()
    .optional()
    .describe('Number of entries to skip'),
});

export type QueryDynamicRegistryInput = z.infer<typeof QueryDynamicRegistrySchema>;

/**
 * Tool for querying HCS-6 dynamic registries
 */
export class QueryDynamicRegistryTool extends BaseHCS6QueryTool<typeof QueryDynamicRegistrySchema> {
  name = 'queryDynamicRegistry';
  description = 'Query a dynamic registry to get the current state of a dynamic hashinal';

  get specificInputSchema() {
    return QueryDynamicRegistrySchema;
  }

  constructor(params: HCS6QueryToolParams) {
    super(params);
  }

  protected async executeQuery(
    params: QueryDynamicRegistryInput,
    _runManager?: CallbackManagerForToolRun
  ): Promise<unknown> {
    const registry = await this.hcs6Builder.getRegistry(params.topicId, {
      limit: params.limit,
      order: params.order,
      skip: params.skip,
    });

    const latestEntry = registry.latestEntry ? {
      topicId: registry.latestEntry.message.t_id,
      timestamp: registry.latestEntry.timestamp,
      memo: registry.latestEntry.message.m,
      sequence: registry.latestEntry.sequence,
      payer: registry.latestEntry.payer,
    } : null;

    return `Successfully queried dynamic registry!\n\nRegistry Topic: ${registry.topicId}\nRegistry Type: NON_INDEXED\nTTL: ${registry.ttl} seconds\nTotal Entries: ${registry.entries.length}${latestEntry ? `\n\nLatest Entry:\n- Topic ID: ${latestEntry.topicId}\n- Timestamp: ${latestEntry.timestamp}\n- Memo: ${latestEntry.memo || 'N/A'}\n- Sequence: ${latestEntry.sequence}` : '\n\nNo entries found in registry.'}`;
  }
}