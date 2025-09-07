import { z } from 'zod';
import { BaseHCS2QueryTool } from './base-hcs2-tools';
import { HCS2RegistryType } from '@hashgraphonline/standards-sdk';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { isWalletBytesResponse, type TopicRegistrationResult } from '../../types/tx-results';

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
  description = 'Create an HCS-2 registry (standard HCS-2). Use when the user asks to create an HCS-2 registry, not a generic HCS topic. Builds a standards-compliant registry topic and returns the result or transaction bytes.'

  get specificInputSchema(): typeof createRegistrySchema {
    return createRegistrySchema;
  }

  protected async executeQuery(
    params: z.infer<typeof createRegistrySchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<unknown> {
    const normalizeKey = (val?: string | boolean): string | boolean | undefined => {
      if (typeof val === 'string') {
        const lc = val.trim().toLowerCase();
        if (lc === 'true') return true;
        if (lc === 'false') return false;
        return val; // assume public key string
      }
      return val;
    };

    try {
      const result: TopicRegistrationResult = await this.hcs2Builder.createRegistry({
        registryType: params.registryType,
        ttl: params.ttl,
        adminKey: normalizeKey(params.adminKey),
        submitKey: normalizeKey(params.submitKey),
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create registry');
      }

      if (isWalletBytesResponse(result)) {
        const txBytes = result.transactionBytes;
        return {
          message: 'I prepared an unsigned transaction to create your HCS-2 registry. Please review and approve to submit.',
          transactionBytes: txBytes,
          metadata: {
            transactionBytes: txBytes,
            pendingApproval: true,
            description: `Create HCS-2 registry (${params.registryType === 1 ? 'Non-Indexed' : 'Indexed'}; TTL: ${params.ttl || 86400}s)`,
          },
        };
      }

      const topicId = (result as any)?.topicId || 'unknown';
      return `Successfully created HCS-2 registry!\n\nTopic ID: ${topicId}\nRegistry Type: ${params.registryType === 1 ? 'Non-Indexed' : 'Indexed'}\nTTL: ${params.ttl || 86400} seconds\n\nYou can now register entries to this registry using the topic ID.`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create HCS-2 registry';
      throw new Error(`Registry creation failed: ${errorMessage}`);
    }
  }
}