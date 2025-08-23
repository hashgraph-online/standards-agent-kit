import { z } from 'zod';
import { BaseHCS2QueryTool } from './base-hcs2-tools';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';

/**
 * Schema for updating an entry in HCS-2
 */
const updateEntrySchema = z.object({
  registryTopicId: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .describe('The HCS-2 registry topic ID (must be indexed)'),
  targetTopicId: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .describe('The new topic ID to point to'),
  uid: z
    .string()
    .describe('The unique ID of the entry to update'),
  metadata: z
    .string()
    .optional()
    .describe('Optional metadata URI (HIP-412 format)'),
  memo: z
    .string()
    .max(500)
    .optional()
    .describe('Optional memo (max 500 characters)'),
});


/**
 * Tool for updating entries in HCS-2 registries
 */
export class UpdateEntryTool extends BaseHCS2QueryTool<typeof updateEntrySchema> {
  name = 'updateHCS2Entry';
  description = 'Update an existing entry in an indexed HCS-2 registry';

  get specificInputSchema(): typeof updateEntrySchema {
    return updateEntrySchema;
  }

  protected async executeQuery(
    params: z.infer<typeof updateEntrySchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<unknown> {
    try {
      const result = await this.hcs2Builder.updateEntry(
        params.registryTopicId,
        {
          targetTopicId: params.targetTopicId,
          uid: params.uid,
          metadata: params.metadata,
          memo: params.memo,
        }
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to update entry');
      }

      return `Successfully updated entry in HCS-2 registry!\n\nRegistry Topic: ${params.registryTopicId}\nUID: ${params.uid}\nNew Target Topic ID: ${params.targetTopicId}${params.metadata ? `\nMetadata: ${params.metadata}` : ''}${params.memo ? `\nMemo: ${params.memo}` : ''}\n\nThe entry has been updated in the registry.`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update entry';
      throw new Error(`Entry update failed: ${errorMessage}`);
    }
  }
}