import { z } from 'zod';
import { BaseHCS6QueryTool } from './base-hcs6-tools';
import { isWalletBytesResponse } from '../../types/tx-results';
import { HCS6QueryToolParams } from './hcs6-tool-params';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';

/**
 * Schema for creating a dynamic hashinal registry
 */
const CreateDynamicRegistrySchema = z.object({
  ttl: z
    .number()
    .min(3600)
    .default(86400)
    .describe('Time-to-live in seconds (minimum 3600 seconds/1 hour)'),
  submitKey: z
    .union([z.boolean(), z.string()])
    .optional()
    .describe('Submit key for the registry topic. Can be boolean (use operator key) or a public key string'),
});

export type CreateDynamicRegistryInput = z.infer<typeof CreateDynamicRegistrySchema>;

/**
 * Tool for creating HCS-6 dynamic registries
 */
export class CreateDynamicRegistryTool extends BaseHCS6QueryTool<typeof CreateDynamicRegistrySchema> {
  name = 'createDynamicRegistry';
  description = 'Create a new HCS-6 dynamic registry for managing evolving content';

  get specificInputSchema(): typeof CreateDynamicRegistrySchema {
    return CreateDynamicRegistrySchema;
  }

  constructor(params: HCS6QueryToolParams) {
    super(params);
  }

  protected async executeQuery(
    params: CreateDynamicRegistryInput,
    _runManager?: CallbackManagerForToolRun
  ): Promise<unknown> {
    const result = await this.hcs6Builder.createRegistry({
      ttl: params.ttl,
      submitKey: params.submitKey,
    });

    if (!('success' in result) || !result.success) {
      throw new Error((result as any).error || 'Failed to create dynamic registry');
    }

    if (isWalletBytesResponse(result)) {
      const txBytes = result.transactionBytes;
      return {
        message: 'I prepared an unsigned transaction to create your HCS-6 dynamic registry. Please review and approve to submit.',
        transactionBytes: txBytes,
        metadata: {
          transactionBytes: txBytes,
          pendingApproval: true,
          description: `Create HCS-6 dynamic registry (TTL: ${params.ttl}s)`,
        },
      };
    }

    return `Successfully created HCS-6 dynamic registry!\n\nTopic ID: ${(result as any).topicId}\nTTL: ${params.ttl} seconds\n\nYou can now register dynamic hashinals to this registry using the topic ID.`;
  }
}