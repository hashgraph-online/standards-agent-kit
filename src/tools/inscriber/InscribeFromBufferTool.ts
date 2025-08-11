import { z } from 'zod';
import { BaseInscriberQueryTool } from './base-inscriber-tools';
import { InscriptionOptions, ContentResolverRegistry } from '@hashgraphonline/standards-sdk';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { loadConfig } from '../../config/ContentReferenceConfig';

const inscribeFromBufferSchema = z.object({
  base64Data: z
    .string()
    .min(1, 'Data cannot be empty')
    .describe(
      'The content to inscribe. Accept BOTH plain text AND base64. Also accepts content reference IDs in format "content-ref:[id]". When user says "inscribe it" or "inscribe the content", use the EXACT content from your previous message or from MCP tool results. DO NOT generate new content. DO NOT create repetitive text. Pass the actual search results or other retrieved content EXACTLY as you received it.'
    ),
  fileName: z
    .string()
    .min(1, 'File name cannot be empty')
    .describe('Name for the inscribed content. Required for all inscriptions.'),
  mimeType: z.string().optional().describe('MIME type of the content'),
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
  timeoutMs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Timeout in milliseconds for inscription (default: no timeout - waits until completion)'
    ),
  apiKey: z.string().optional().describe('API key for inscription service'),
  quoteOnly: z
    .boolean()
    .optional()
    .default(false)
    .describe('If true, returns a cost quote instead of executing the inscription'),
});

export class InscribeFromBufferTool extends BaseInscriberQueryTool<
  typeof inscribeFromBufferSchema
> {
  name = 'inscribeFromBuffer';
  description =
    'Inscribe content that you have already retrieved or displayed. When user says "inscribe it" after you showed search results or other content, use THIS tool. The base64Data field accepts PLAIN TEXT (not just base64) and content reference IDs in format "content-ref:[id]". Pass the EXACT content from your previous response or MCP tool output. DO NOT generate new content or create repetitive text. Content references are automatically resolved to the original content for inscription. Set quoteOnly=true to get cost estimates without executing the inscription.';

  private config = loadConfig();

  get specificInputSchema() {
    return inscribeFromBufferSchema;
  }

  protected async executeQuery(
    params: z.infer<typeof inscribeFromBufferSchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<unknown> {
    this.validateInput(params);

    const resolvedContent = await this.resolveContent(
      params.base64Data,
      params.mimeType,
      params.fileName
    );

    this.validateContent(resolvedContent.buffer);

    const buffer = resolvedContent.buffer;
    const resolvedMimeType = resolvedContent.mimeType || params.mimeType;
    const resolvedFileName = resolvedContent.fileName || params.fileName;

    const options: InscriptionOptions = {
      mode: params.mode,
      metadata: params.metadata,
      tags: params.tags,
      chunkSize: params.chunkSize,
      waitForConfirmation: params.quoteOnly ? false : (params.waitForConfirmation ?? true),
      waitMaxAttempts: 10,
      waitIntervalMs: 3000,
      apiKey: params.apiKey,
      network: this.inscriberBuilder['hederaKit'].client.network
        .toString()
        .includes('mainnet')
        ? 'mainnet'
        : 'testnet',
      quoteOnly: params.quoteOnly,
    };

    if (params.quoteOnly) {
      try {
        const quote = await this.generateInscriptionQuote(
          {
            type: 'buffer',
            buffer,
            fileName: resolvedFileName,
            mimeType: resolvedMimeType,
          },
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
            fileName: resolvedFileName,
            mimeType: resolvedMimeType,
            sizeBytes: buffer.length,
          },
          message: `Quote generated for buffer content: ${resolvedFileName} (${(buffer.length / 1024).toFixed(2)} KB)\nTotal cost: ${quote.totalCostHbar} HBAR\nQuote valid until: ${new Date(quote.validUntil).toLocaleString()}`,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to generate inscription quote';
        throw new Error(`Quote generation failed: ${errorMessage}`);
      }
    }

    const timeoutMs =
      params.timeoutMs || (options.waitForConfirmation ? 60000 : undefined);

    try {
      const result = await this.executeInscription(
        buffer,
        resolvedFileName,
        resolvedMimeType,
        options,
        timeoutMs
      );
      return this.formatInscriptionResult(result, options);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to inscribe from buffer';
      throw new Error(`Inscription failed: ${errorMessage}`);
    }
  }

  private validateInput(
    params: z.infer<typeof inscribeFromBufferSchema>
  ): void {
    if (!params.base64Data || params.base64Data.trim() === '') {
      throw new Error(
        'No data provided. Cannot inscribe empty content. Please provide valid content, plain text, base64 encoded data, or a content reference ID.'
      );
    }

    if (!params.fileName || params.fileName.trim() === '') {
      throw new Error(
        'No fileName provided. A valid fileName is required for inscription.'
      );
    }
  }

  private validateContent(buffer: Buffer): void {
    if (buffer.length === 0) {
      throw new Error(
        'Buffer is empty after conversion. The provided data appears to be invalid or empty.'
      );
    }

    if (buffer.length > this.config.maxInscriptionSize) {
      const maxSizeKB = Math.round(this.config.maxInscriptionSize / 1024);
      const bufferSizeKB = Math.round(buffer.length / 1024);
      throw new Error(
        `Content is too large for inscription (${bufferSizeKB}KB, max ${maxSizeKB}KB). Please summarize or extract key information before inscribing.`
      );
    }

    if (buffer.length < this.config.minContentSize) {
      throw new Error(
        `Buffer content is too small (${buffer.length} bytes). This may indicate empty or invalid content. Please verify the source data contains actual content.`
      );
    }

    if (
      buffer.toString('utf8', 0, Math.min(buffer.length, 100)).trim() === ''
    ) {
      throw new Error(
        'Buffer contains only whitespace or empty content. Cannot inscribe meaningless data.'
      );
    }

    const contentStr = buffer.toString('utf8');
    const emptyHtmlPattern = /<a\s+href=["'][^"']+["']\s*>\s*<\/a>/i;
    const hasOnlyEmptyLinks =
      emptyHtmlPattern.test(contentStr) &&
      contentStr.replace(/<[^>]+>/g, '').trim().length < 50;

    if (hasOnlyEmptyLinks) {
      throw new Error(
        'Buffer contains empty HTML with only links and no actual content. When inscribing content from external sources, use the actual article text you retrieved, not empty HTML with links.'
      );
    }
  }

  private async executeInscription(
    buffer: Buffer,
    fileName: string,
    mimeType: string | undefined,
    options: InscriptionOptions,
    timeoutMs?: number
  ): Promise<Awaited<ReturnType<typeof this.inscriberBuilder.inscribe>>> {
    const inscriptionData = {
      type: 'buffer' as const,
      buffer,
      fileName,
      mimeType,
    };

    if (timeoutMs) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Inscription timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      });

      return Promise.race([
        this.inscriberBuilder.inscribe(inscriptionData, options),
        timeoutPromise,
      ]);
    }

    return this.inscriberBuilder.inscribe(inscriptionData, options);
  }

  private formatInscriptionResult(
    result: Awaited<ReturnType<typeof this.inscriberBuilder.inscribe>>,
    options: InscriptionOptions
  ): string {
    if (result.confirmed && !result.quote) {
      const topicId = result.inscription?.topic_id || (result.result as any).topicId;
      const network = options.network || 'testnet';
      const cdnUrl = topicId
        ? `https://kiloscribe.com/api/inscription-cdn/${topicId}?network=${network}`
        : null;
      return `Successfully inscribed and confirmed content on the Hedera network!\n\nTransaction ID: ${
        (result.result as any).transactionId
      }\nTopic ID: ${topicId || 'N/A'}${
        cdnUrl ? `\nView inscription: ${cdnUrl}` : ''
      }\n\nThe inscription is now available.`;
    }

    if (!result.quote && !result.confirmed) {
      return `Successfully submitted inscription to the Hedera network!\n\nTransaction ID: ${(result.result as any).transactionId}\n\nThe inscription is processing and will be confirmed shortly.`;
    }

    return 'Inscription operation completed.';
  }

  private async resolveContent(
    input: string,
    providedMimeType?: string,
    providedFileName?: string
  ): Promise<{
    buffer: Buffer;
    mimeType?: string;
    fileName?: string;
    wasReference?: boolean;
  }> {
    const trimmedInput = input.trim();
    
    const resolver = this.getContentResolver() || ContentResolverRegistry.getResolver();
    
    if (!resolver) {
      return this.handleDirectContent(trimmedInput, providedMimeType, providedFileName);
    }
    
    const referenceId = resolver.extractReferenceId(trimmedInput);

    if (referenceId) {
      try {
        const resolution = await resolver.resolveReference(referenceId);

        return {
          buffer: resolution.content,
          mimeType: resolution.metadata?.mimeType || providedMimeType,
          fileName: resolution.metadata?.fileName || providedFileName,
          wasReference: true,
        };
      } catch (error) {
        const errorMsg =
          error instanceof Error
            ? error.message
            : 'Unknown error resolving reference';
        throw new Error(`Reference resolution failed: ${errorMsg}`);
      }
    }

    return this.handleDirectContent(trimmedInput, providedMimeType, providedFileName);
  }

  private handleDirectContent(
    input: string,
    providedMimeType?: string,
    providedFileName?: string
  ): {
    buffer: Buffer;
    mimeType?: string;
    fileName?: string;
    wasReference?: boolean;
  } {
    const isValidBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(input);

    if (isValidBase64) {
      try {
        const buffer = Buffer.from(input, 'base64');
        return {
          buffer,
          mimeType: providedMimeType,
          fileName: providedFileName,
          wasReference: false,
        };
      } catch (error) {
        throw new Error(
          'Failed to decode base64 data. Please ensure the data is properly encoded.'
        );
      }
    }

    const buffer = Buffer.from(input, 'utf8');
    return {
      buffer,
      mimeType: providedMimeType || 'text/plain',
      fileName: providedFileName,
      wasReference: false,
    };
  }
}
