import { z } from 'zod';
import { BaseHCS2QueryTool } from './base-hcs2-tools';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';

/**
 * Schema for querying HCS-2 registry
 */
const queryRegistrySchema = z.object({
  topicId: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .describe('The HCS-2 registry topic ID to query'),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum number of entries to return'),
  order: z
    .enum(['asc', 'desc'])
    .optional()
    .describe('Order of results (ascending or descending)'),
  skip: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Number of entries to skip'),
});


/**
 * Tool for querying HCS-2 registries
 */
export class QueryRegistryTool extends BaseHCS2QueryTool<typeof queryRegistrySchema> {
  name = 'queryHCS2Registry';
  description = 'Query entries from an HCS-2 registry (standard HCS-2). Retrieves indexed or latest entries and returns a structured summary.'

  get specificInputSchema() {
    return queryRegistrySchema;
  }

  protected async executeQuery(
    params: z.infer<typeof queryRegistrySchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<unknown> {
    const registry = await this.hcs2Builder.getRegistry(params.topicId, {
      limit: params.limit,
      order: params.order,
      skip: params.skip,
    });

    const typeVal = (registry as unknown as { registryType: unknown }).registryType;
    const isIndexed =
      typeVal === 0 ||
      typeVal === '0' ||
      String(typeVal).toLowerCase() === 'indexed' ||
      String(typeVal).toLowerCase() === 'index' ||
      String(typeVal).toLowerCase() === 'index_topic' ||
      String(typeVal).toLowerCase() === 'indexed_registry';

    return {
      topicId: registry.topicId,
      registryType: isIndexed ? 'indexed' : 'non-indexed',
      ttl: registry.ttl,
      totalEntries: registry.entries.length,
      entries: registry.entries.map(entry => ({
        sequence: entry.sequence,
        timestamp: entry.timestamp,
        payer: entry.payer,
        operation: entry.message.op,
        targetTopicId: entry.message.t_id,
        uid: entry.message.uid,
        metadata: entry.message.metadata,
        memo: entry.message.m,
      })),
    };
  }
}