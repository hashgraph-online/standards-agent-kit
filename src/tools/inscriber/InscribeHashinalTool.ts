import { z } from 'zod';
import { BaseInscriberQueryTool } from './base-inscriber-tools';
import { InscriptionOptions } from '@hashgraphonline/standards-sdk';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';

/**
 * Schema for inscribing Hashinal NFT
 */
const inscribeHashinalSchema = z.object({
  url: z.string().url().describe('The URL of the content to inscribe as Hashinal NFT'),
  name: z.string().describe('Name of the Hashinal NFT'),
  creator: z.string().describe('Creator account ID or name'),
  description: z.string().describe('Description of the Hashinal NFT'),
  type: z.string().describe('Type of NFT (e.g., "image", "video", "audio")'),
  attributes: z
    .array(
      z.object({
        trait_type: z.string(),
        value: z.union([z.string(), z.number()]),
      })
    )
    .optional()
    .describe('NFT attributes'),
  properties: z
    .record(z.unknown())
    .optional()
    .describe('Additional properties'),
  jsonFileURL: z
    .string()
    .url()
    .optional()
    .describe('URL to JSON metadata file'),
  tags: z
    .array(z.string())
    .optional()
    .describe('Tags to categorize the NFT'),
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
 * Tool for inscribing Hashinal NFTs
 */
export class InscribeHashinalTool extends BaseInscriberQueryTool<typeof inscribeHashinalSchema> {
  name = 'inscribeHashinal';
  description = 'Inscribe content as a Hashinal NFT on the Hedera network';

  get specificInputSchema() {
    return inscribeHashinalSchema;
  }

  protected async executeQuery(
    params: z.infer<typeof inscribeHashinalSchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<unknown> {
    const metadata = {
      name: params.name,
      creator: params.creator,
      description: params.description,
      type: params.type,
      attributes: params.attributes,
      properties: params.properties,
    };

    const options: InscriptionOptions = {
      mode: 'hashinal',
      metadata,
      jsonFileURL: params.jsonFileURL,
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
        return `Successfully inscribed and confirmed Hashinal NFT on the Hedera network!\n\nTransaction ID: ${result.result.transactionId}\nTopic ID: ${topicId || 'N/A'}${cdnUrl ? `\nView inscription: ${cdnUrl}` : ''}\n\nThe Hashinal NFT is now available.`;
      } else {
        return `Successfully submitted Hashinal NFT inscription to the Hedera network!\n\nTransaction ID: ${result.result.transactionId}\n\nThe inscription is processing and will be confirmed shortly.`;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to inscribe Hashinal NFT';
      throw new Error(`Inscription failed: ${errorMessage}`);
    }
  }
}