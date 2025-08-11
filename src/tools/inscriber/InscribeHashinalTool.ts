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
  timeoutMs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Timeout in milliseconds for inscription (default: no timeout - waits until completion)'),
  apiKey: z
    .string()
    .optional()
    .describe('API key for inscription service'),
  quoteOnly: z
    .boolean()
    .optional()
    .default(false)
    .describe('If true, returns a cost quote instead of executing the inscription'),
});


/**
 * Tool for inscribing Hashinal NFTs
 */
export class InscribeHashinalTool extends BaseInscriberQueryTool<typeof inscribeHashinalSchema> {
  name = 'inscribeHashinal';
  description = 'Inscribe content as a Hashinal NFT on the Hedera network. Set quoteOnly=true to get cost estimates without executing the inscription.';

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
      waitForConfirmation: params.quoteOnly ? false : (params.waitForConfirmation ?? true),
      waitMaxAttempts: 10,
      waitIntervalMs: 3000,
      apiKey: params.apiKey,
      network: this.inscriberBuilder['hederaKit'].client.network.toString().includes('mainnet') ? 'mainnet' : 'testnet',
      quoteOnly: params.quoteOnly,
    };

    if (params.quoteOnly) {
      try {
        const quote = await this.generateInscriptionQuote(
          { type: 'url', url: params.url },
          options
        );
        
        return {
          success: true,
          quote: {
            totalCostHbar: quote.totalCostHbar,
            validUntil: quote.validUntil,
            breakdown: quote.breakdown,
          },
          contentInfo: {
            url: params.url,
            name: params.name,
            creator: params.creator,
            type: params.type,
          },
          message: `Quote generated for Hashinal NFT: ${params.name}\nCreator: ${params.creator}\nTotal cost: ${quote.totalCostHbar} HBAR\nQuote valid until: ${new Date(quote.validUntil).toLocaleString()}`,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to generate inscription quote';
        throw new Error(`Quote generation failed: ${errorMessage}`);
      }
    }

    try {
      let result: Awaited<ReturnType<typeof this.inscriberBuilder.inscribe>>;
      
      if (params.timeoutMs) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`Inscription timed out after ${params.timeoutMs}ms`)),
            params.timeoutMs
          );
        });

        result = await Promise.race([
          this.inscriberBuilder.inscribe(
            { type: 'url', url: params.url },
            options
          ),
          timeoutPromise
        ]);
      } else {
        result = await this.inscriberBuilder.inscribe(
          { type: 'url', url: params.url },
          options
        );
      }

      if (result.confirmed && !result.quote) {
        const topicId = result.inscription?.topic_id || (result.result as any).topicId;
        const network = options.network || 'testnet';
        const cdnUrl = topicId ? `https://kiloscribe.com/api/inscription-cdn/${topicId}?network=${network}` : null;
        return `Successfully inscribed and confirmed Hashinal NFT on the Hedera network!\n\nTransaction ID: ${(result.result as any).transactionId}\nTopic ID: ${topicId || 'N/A'}${cdnUrl ? `\nView inscription: ${cdnUrl}` : ''}\n\nThe Hashinal NFT is now available.`;
      } else if (!result.quote && !result.confirmed) {
        return `Successfully submitted Hashinal NFT inscription to the Hedera network!\n\nTransaction ID: ${(result.result as any).transactionId}\n\nThe inscription is processing and will be confirmed shortly.`;
      } else {
        return 'Inscription operation completed.';
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to inscribe Hashinal NFT';
      throw new Error(`Inscription failed: ${errorMessage}`);
    }
  }
}