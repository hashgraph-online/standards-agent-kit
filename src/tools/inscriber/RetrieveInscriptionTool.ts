import { z } from 'zod';
import { BaseInscriberQueryTool } from './base-inscriber-tools';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';

/**
 * Schema for retrieving inscription
 */
const retrieveInscriptionSchema = z.object({
  transactionId: z
    .string()
    .describe('The transaction ID of the inscription to retrieve'),
  apiKey: z
    .string()
    .optional()
    .describe('API key for inscription service'),
});


/**
 * Tool for retrieving inscriptions
 */
export class RetrieveInscriptionTool extends BaseInscriberQueryTool<typeof retrieveInscriptionSchema> {
  name = 'retrieveInscription';
  description = 'Retrieve details of an existing inscription from the Hedera network';

  get specificInputSchema() {
    return retrieveInscriptionSchema;
  }

  protected async executeQuery(
    params: z.infer<typeof retrieveInscriptionSchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<unknown> {
    const result = await this.inscriberBuilder.retrieveInscription(
      params.transactionId,
      {
        apiKey: params.apiKey,
        network: this.inscriberBuilder['hederaKit'].client.network.toString().includes('mainnet') ? 'mainnet' : 'testnet',
      }
    );

    return {
      inscriptionId: (result as any).inscriptionId,
      transactionId: result.transactionId,
      topicId: (result as any).topic_id,
      status: result.status,
      holderId: (result as any).holderId,
      metadata: result.metadata,
      tags: (result as any).tags,
      mode: result.mode,
      chunks: (result as any).chunks,
      createdAt: (result as any).createdAt,
      completedAt: (result as any).completed || (result as any).completedAt,
      fileUrl: result.fileUrl,
      mimeType: (result as any).mimeType,
      fileSize: (result as any).fileSize,
    };
  }
}