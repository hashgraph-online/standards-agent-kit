import { z } from 'zod';
import { BaseHCS2QueryTool } from './base-hcs2-tools';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { isWalletBytesResponse, type RegistryOperationResult } from '../../types/tx-results';

/**
 * Schema for registering an entry in HCS-2
 */
const registerEntrySchema = z.object({
  registryTopicId: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .describe('The HCS-2 registry topic ID (e.g., 0.0.123456)'),
  targetTopicId: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .describe('The target topic ID to register (e.g., 0.0.123456)'),
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
 * Tool for registering entries in HCS-2 registries
 */
export class RegisterEntryTool extends BaseHCS2QueryTool<typeof registerEntrySchema> {
  name = 'registerHCS2Entry';
  description = 'Register an entry in an HCS-2 registry (standard HCS-2). Use this to add a target topic to an existing HCS-2 registry.'

  get specificInputSchema(): typeof registerEntrySchema {
    return registerEntrySchema;
  }

  protected async executeQuery(
    params: z.infer<typeof registerEntrySchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<unknown> {
    try {
      const result: RegistryOperationResult = await this.hcs2Builder.registerEntry(
        params.registryTopicId,
        {
          targetTopicId: params.targetTopicId,
          metadata: params.metadata,
          memo: params.memo,
        }
      );

      if (!('success' in result) || !result.success) {
        throw new Error(result.error || 'Failed to register entry');
      }

      if (isWalletBytesResponse(result)) {
        const txBytes = result.transactionBytes;
        return {
          message: 'I prepared an unsigned transaction to register the entry in the HCS-2 registry. Please review and approve to submit.',
          transactionBytes: txBytes,
          metadata: {
            transactionBytes: txBytes,
            pendingApproval: true,
            description: `Register HCS-2 entry (registry ${params.registryTopicId} -> target ${params.targetTopicId})`,
          },
        };
      }

      return `Successfully registered entry in HCS-2 registry!\n\nRegistry Topic: ${params.registryTopicId}\nTarget Topic ID: ${params.targetTopicId}${params.metadata ? `\nMetadata: ${params.metadata}` : ''}${params.memo ? `\nMemo: ${params.memo}` : ''}\n\nThe entry has been added to the registry.`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to register entry';
      throw new Error(`Entry registration failed: ${errorMessage}`);
    }
  }
}