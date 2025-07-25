import { z } from 'zod';
import { BaseInscriberQueryTool } from './base-inscriber-tools';
import { InscriptionOptions } from '@hashgraphonline/standards-sdk';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';

/**
 * Schema for inscribing from URL
 */
const inscribeFromUrlSchema = z.object({
  url: z.string().url().describe('The URL of the content to inscribe'),
  mode: z
    .enum(['file', 'hashinal'])
    .optional()
    .describe('Inscription mode: file or hashinal NFT'),
  metadata: z
    .record(z.unknown())
    .optional()
    .describe('Metadata to attach to the inscription'),
  tags: z
    .array(z.string())
    .optional()
    .describe('Tags to categorize the inscription'),
  chunkSize: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Chunk size for large files'),
  waitForConfirmation: z
    .boolean()
    .optional()
    .describe('Whether to wait for inscription confirmation'),
  apiKey: z
    .string()
    .optional()
    .describe('API key for inscription service'),
});


/**
 * Tool for inscribing content from URL
 */
export class InscribeFromUrlTool extends BaseInscriberQueryTool<typeof inscribeFromUrlSchema> {
  name = 'inscribeFromUrl';
  description = 'Inscribe content from a URL to the Hedera network';

  get specificInputSchema() {
    return inscribeFromUrlSchema;
  }

  protected async executeQuery(
    params: z.infer<typeof inscribeFromUrlSchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<unknown> {
    const options: InscriptionOptions = {
      mode: params.mode,
      metadata: params.metadata,
      tags: params.tags,
      chunkSize: params.chunkSize,
      waitForConfirmation: params.waitForConfirmation ?? true,
      waitMaxAttempts: 10,
      waitIntervalMs: 3000,
      apiKey: params.apiKey,
      network: this.inscriberBuilder['hederaKit'].client.network.toString().includes('mainnet') ? 'mainnet' : 'testnet',
    };

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Inscription timed out after 30 seconds')), 30000);
      });

      const result = await Promise.race([
        this.inscriberBuilder.inscribe(
          { type: 'url', url: params.url },
          options
        ),
        timeoutPromise
      ]) as any;

      if (result.confirmed) {
        const topicId = result.inscription?.topic_id || result.result.topicId;
        const network = options.network || 'testnet';
        const cdnUrl = topicId ? `https://kiloscribe.com/api/inscription-cdn/${topicId}?network=${network}` : null;
        return `Successfully inscribed and confirmed content on the Hedera network!\n\nTransaction ID: ${result.result.transactionId}\nTopic ID: ${topicId || 'N/A'}${cdnUrl ? `\nView inscription: ${cdnUrl}` : ''}\n\nThe inscription is now available.`;
      } else {
        return `Successfully submitted inscription to the Hedera network!\n\nTransaction ID: ${result.result.transactionId}\n\nThe inscription is processing and will be confirmed shortly.`;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to inscribe from URL';
      throw new Error(`Inscription failed: ${errorMessage}`);
    }
  }
}