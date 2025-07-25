import { z } from 'zod';
import { BaseHCS2QueryTool } from './base-hcs2-tools';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';

/**
 * Schema for migrating an HCS-2 registry
 */
const migrateRegistrySchema = z.object({
  registryTopicId: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .describe('The current HCS-2 registry topic ID'),
  targetTopicId: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .describe('The new topic ID to migrate to'),
  metadata: z
    .string()
    .optional()
    .describe('Optional metadata URI for migration details'),
  memo: z
    .string()
    .max(500)
    .optional()
    .describe('Optional memo (max 500 characters)'),
});


/**
 * Tool for migrating HCS-2 registries
 */
export class MigrateRegistryTool extends BaseHCS2QueryTool<typeof migrateRegistrySchema> {
  name = 'migrateHCS2Registry';
  description = 'Migrate an HCS-2 registry to a new topic';

  get specificInputSchema() {
    return migrateRegistrySchema;
  }

  protected async executeQuery(
    params: z.infer<typeof migrateRegistrySchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<unknown> {
    try {
      const result = await this.hcs2Builder.migrateRegistry(
        params.registryTopicId,
        {
          targetTopicId: params.targetTopicId,
          metadata: params.metadata,
          memo: params.memo,
        }
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to migrate registry');
      }

      return `Successfully migrated HCS-2 registry!\n\nFrom Registry Topic: ${params.registryTopicId}\nTo Target Topic: ${params.targetTopicId}${params.metadata ? `\nMetadata: ${params.metadata}` : ''}${params.memo ? `\nMemo: ${params.memo}` : ''}\n\nThe registry has been migrated to the new topic.`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to migrate registry';
      throw new Error(`Registry migration failed: ${errorMessage}`);
    }
  }
}