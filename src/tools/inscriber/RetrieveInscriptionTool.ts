import { z } from 'zod';
import { BaseInscriberQueryTool } from './base-inscriber-tools';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import type { RetrievedInscriptionResult } from '@hashgraphonline/standards-sdk';

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
    const result: RetrievedInscriptionResult = await this.inscriberBuilder.retrieveInscription(
      params.transactionId,
      {
        apiKey: params.apiKey,
        network: this.inscriberBuilder['hederaKit'].client.network.toString().includes('mainnet') ? 'mainnet' : 'testnet',
      }
    );

    return {
      inscriptionId: (result as unknown as { inscriptionId?: string }).inscriptionId,
      transactionId: (result as unknown as { transactionId?: string }).transactionId || 'unknown',
      topicId: (result as unknown as { topic_id?: string; topicId?: string }).topic_id || (result as unknown as { topicId?: string }).topicId,
      status: (result as unknown as { status?: string }).status || 'unknown',
      holderId: (result as unknown as { holderId?: string }).holderId,
      metadata: result.metadata,
      tags: (result as unknown as { tags?: unknown }).tags,
      mode: (result as unknown as { mode?: string }).mode,
      chunks: (result as unknown as { chunks?: unknown }).chunks,
      createdAt: (result as unknown as { createdAt?: string }).createdAt,
      completedAt: (result as unknown as { completed?: string; completedAt?: string }).completed || (result as unknown as { completedAt?: string }).completedAt,
      fileUrl: (result as unknown as { fileUrl?: string }).fileUrl,
      mimeType: (result as unknown as { mimeType?: string }).mimeType,
      fileSize: (result as unknown as { fileSize?: number }).fileSize,
    };
  }
}