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
 * Type definition for inscription retrieval result
 */
interface InscriptionRetrievalResult {
  inscriptionId?: string;
  transactionId: string;
  topicId?: string;
  status?: string;
  holderId?: string;
  metadata?: unknown;
  tags?: unknown;
  mode?: string;
  chunks?: unknown;
  createdAt?: string;
  completedAt?: string;
  fileUrl?: string;
  mimeType?: string;
  fileSize?: number;
}


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
  ): Promise<InscriptionRetrievalResult> {
    const result = await this.inscriberBuilder.retrieveInscription(
      params.transactionId,
      {
        apiKey: params.apiKey,
        network: this.inscriberBuilder['hederaKit'].client.network.toString().includes('mainnet') ? 'mainnet' : 'testnet',
      }
    );

    const typedResult = result as unknown as Record<string, unknown>;

    return {
      inscriptionId: typedResult.inscriptionId as string | undefined,
      transactionId: result.transactionId || 'unknown',
      topicId: typedResult.topic_id as string | undefined,
      status: result.status || 'unknown',
      holderId: typedResult.holderId as string | undefined,
      metadata: result.metadata,
      tags: typedResult.tags,
      mode: result.mode,
      chunks: typedResult.chunks,
      createdAt: typedResult.createdAt as string | undefined,
      completedAt: (typedResult.completed || typedResult.completedAt) as string | undefined,
      fileUrl: result.fileUrl,
      mimeType: typedResult.mimeType as string | undefined,
      fileSize: typedResult.fileSize as number | undefined,
    };
  }
}