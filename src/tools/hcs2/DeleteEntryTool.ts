import { z } from 'zod';
import { BaseHCS2QueryTool } from './base-hcs2-tools';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';

/**
 * Schema for deleting an entry from HCS-2
 */
const deleteEntrySchema = z.object({
  registryTopicId: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .describe('The HCS-2 registry topic ID (must be indexed)'),
  uid: z
    .string()
    .describe('The unique ID of the entry to delete'),
  memo: z
    .string()
    .max(500)
    .optional()
    .describe('Optional memo (max 500 characters)'),
});


/**
 * Tool for deleting entries from HCS-2 registries
 */
export class DeleteEntryTool extends BaseHCS2QueryTool<typeof deleteEntrySchema> {
  name = 'deleteHCS2Entry';
  description = 'Delete an entry from an indexed HCS-2 registry';

  get specificInputSchema(): typeof deleteEntrySchema {
    return deleteEntrySchema;
  }

  protected async executeQuery(
    params: z.infer<typeof deleteEntrySchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<unknown> {
    try {
      const result = await this.hcs2Builder.deleteEntry(
        params.registryTopicId,
        {
          uid: params.uid,
          memo: params.memo,
        }
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete entry');
      }

      return `Successfully deleted entry from HCS-2 registry!\n\nRegistry Topic: ${params.registryTopicId}\nUID: ${params.uid}${params.memo ? `\nMemo: ${params.memo}` : ''}\n\nThe entry has been removed from the registry.`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete entry';
      throw new Error(`Entry deletion failed: ${errorMessage}`);
    }
  }
}