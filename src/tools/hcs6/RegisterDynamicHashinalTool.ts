import { z } from 'zod';
import { BaseHCS6QueryTool } from './base-hcs6-tools';
import { isWalletBytesResponse } from '../../types/tx-results';
import { HCS6QueryToolParams } from './hcs6-tool-params';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';

/**
 * Schema for registering a dynamic hashinal
 */
const RegisterDynamicHashinalSchema = z.object({
  metadata: z.record(z.unknown())
    .describe('Metadata object for the hashinal (e.g., name, description, attributes)'),
  data: z.object({
    base64: z.string().optional().describe('Base64 encoded data for the hashinal'),
    url: z.string().optional().describe('URL to fetch data from'),
    mimeType: z.string().optional().describe('MIME type of the data'),
  }).optional()
    .describe('Data to inscribe with the hashinal'),
  memo: z.string()
    .optional()
    .describe('Optional memo for the registration'),
  ttl: z.number()
    .min(3600)
    .default(86400)
    .describe('Time-to-live in seconds for the inscription'),
  registryTopicId: z.string()
    .optional()
    .describe('Registry topic ID to use. If not provided, a new registry will be created'),
  submitKey: z.string()
    .optional()
    .describe('Submit key for the registry (required if registry has a submit key)'),
});

export type RegisterDynamicHashinalInput = z.infer<typeof RegisterDynamicHashinalSchema>;

/**
 * Tool for registering (creating) dynamic hashinals
 */
export class RegisterDynamicHashinalTool extends BaseHCS6QueryTool<typeof RegisterDynamicHashinalSchema> {
  name = 'registerDynamicHashinal';
  description = 'Create and register a new dynamic hashinal that can be updated over time';

  get specificInputSchema() {
    return RegisterDynamicHashinalSchema;
  }

  constructor(params: HCS6QueryToolParams) {
    super(params);
  }

  protected async executeQuery(
    params: RegisterDynamicHashinalInput,
    _runManager?: CallbackManagerForToolRun
  ): Promise<unknown> {
    const result = await this.hcs6Builder.register({
      metadata: params.metadata,
      data: params.data,
      memo: params.memo,
      ttl: params.ttl,
      registryTopicId: params.registryTopicId,
      submitKey: params.submitKey,
    });

    if (!('success' in result) || !result.success) {
      throw new Error((result as any).error || 'Failed to register dynamic hashinal');
    }

    if (isWalletBytesResponse(result as any)) {
      const txBytes = (result as any).transactionBytes as string;
      return {
        message: 'I prepared an unsigned transaction to register a dynamic hashinal. Please review and approve to submit.',
        transactionBytes: txBytes,
        metadata: {
          transactionBytes: txBytes,
          pendingApproval: true,
          description: `Register dynamic hashinal${params.memo ? ` (Memo: ${params.memo})` : ''}`,
        },
      };
    }

    return `Successfully registered dynamic hashinal!\n\nRegistry Topic ID: ${(result as any).registryTopicId}\nInscription Topic ID: ${(result as any).inscriptionTopicId}${params.memo ? `\nMemo: ${params.memo}` : ''}\n\nThe dynamic hashinal has been created and can be updated using the registry topic ID.`;
  }
}