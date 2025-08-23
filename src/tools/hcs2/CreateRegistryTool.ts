import { z } from 'zod';
import { BaseHCS2QueryTool } from './base-hcs2-tools';
import { HCS2RegistryType } from '@hashgraphonline/standards-sdk';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';

/**
 * Schema for creating an HCS-2 registry
 */
const createRegistrySchema = z.object({
  registryType: z
    .nativeEnum(HCS2RegistryType)
    .optional()
    .describe('Registry type: 0 for indexed, 1 for non-indexed (default: 0)'),
  ttl: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Time to live in seconds (default: 86400)'),
  adminKey: z
    .union([z.string(), z.boolean()])
    .optional()
    .describe('Admin key: public key string or true to use operator key'),
  submitKey: z
    .union([z.string(), z.boolean()])
    .optional()
    .describe('Submit key: public key string or true to use operator key'),
});

/**
 * Tool for creating HCS-2 registries
 */
export class CreateRegistryTool extends BaseHCS2QueryTool<typeof createRegistrySchema> {
  name = 'createHCS2Registry';
  description = 'Create a new HCS-2 registry topic for storing decentralized data';

  get specificInputSchema(): typeof createRegistrySchema {
    return createRegistrySchema;
  }

  protected async executeQuery(
    params: z.infer<typeof createRegistrySchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<unknown> {
    try {
      const result = await this.hcs2Builder.createRegistry({
        registryType: params.registryType,
        ttl: params.ttl,
        adminKey: params.adminKey,
        submitKey: params.submitKey,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create registry');
      }

      return `Successfully created HCS-2 registry!\n\nTopic ID: ${result.topicId}\nRegistry Type: ${params.registryType === 1 ? 'Non-Indexed' : 'Indexed'}\nTTL: ${params.ttl || 86400} seconds\n\nYou can now register entries to this registry using the topic ID.`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create HCS-2 registry';
      throw new Error(`Registry creation failed: ${errorMessage}`);
    }
  }
}