import { z } from 'zod';
import { BaseHCS6QueryTool } from './base-hcs6-tools';
import { HCS6QueryToolParams } from './hcs6-tool-params';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';

/**
 * Schema for updating a dynamic hashinal
 */
const UpdateDynamicHashinalSchema = z.object({
  registryTopicId: z.string()
    .describe('The registry topic ID that tracks this dynamic hashinal'),
  metadata: z.record(z.unknown())
    .describe('Updated metadata object for the hashinal'),
  data: z.object({
    base64: z.string().optional().describe('Base64 encoded data for the updated hashinal'),
    url: z.string().optional().describe('URL to fetch updated data from'),
    mimeType: z.string().optional().describe('MIME type of the data'),
  }).optional()
    .describe('Updated data to inscribe'),
  memo: z.string()
    .optional()
    .describe('Optional memo for the update (e.g., "Level up", "Version 2.0")'),
  submitKey: z.string()
    .describe('Submit key for the registry (required to update)'),
});

export type UpdateDynamicHashinalInput = z.infer<typeof UpdateDynamicHashinalSchema>;

/**
 * Tool for updating dynamic hashinals
 */
export class UpdateDynamicHashinalTool extends BaseHCS6QueryTool<typeof UpdateDynamicHashinalSchema> {
  name = 'updateDynamicHashinal';
  description = 'Update an existing dynamic hashinal with new content while maintaining the same registry';
  
  get specificInputSchema() {
    return UpdateDynamicHashinalSchema;
  }

  constructor(params: HCS6QueryToolParams) {
    super(params);
  }

  protected async executeQuery(
    params: UpdateDynamicHashinalInput,
    _runManager?: CallbackManagerForToolRun
  ): Promise<unknown> {
    // Use the register method with the existing registry ID to update
    const result = await this.hcs6Builder.register({
      metadata: params.metadata,
      data: params.data,
      memo: params.memo,
      registryTopicId: params.registryTopicId,
      submitKey: params.submitKey,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to update dynamic hashinal');
    }

    return `Successfully updated dynamic hashinal!\n\nRegistry Topic ID: ${params.registryTopicId}\nInscription Topic ID: ${result.inscriptionTopicId}${params.memo ? `\nUpdate Memo: ${params.memo}` : ''}\n\nThe dynamic hashinal has been updated with new content.`;
  }
}