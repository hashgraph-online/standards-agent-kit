import { z } from 'zod';
import { BaseInscriberQueryTool } from './base-inscriber-tools';
import {
  InscriptionOptions,
  InscriptionResponse,
  InscriptionResult,
} from '@hashgraphonline/standards-sdk';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { resolveContent } from '../../utils/content-resolver';
import { contentRefSchema } from '../../validation/content-ref-schemas';
import { loadConfig } from '../../config/ContentReferenceConfig';
import {
  extractTopicIds,
  buildInscriptionLinks,
} from '../../utils/inscription-utils';

const inscribeFromBufferSchema = z.object({
  base64Data: z
    .union([z.string(), contentRefSchema])
    .describe(
      'Content to inscribe as base64 data, plain text, or content reference'
    ),
  fileName: z.string().min(1).describe('Name for the inscribed content'),
  mimeType: z.string().optional().describe('MIME type of the content'),
  metadata: z.record(z.unknown()).optional().describe('Metadata to attach'),
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
    .describe('Wait for inscription confirmation'),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Timeout in milliseconds'),
  apiKey: z.string().optional().describe('API key for inscription service'),
  quoteOnly: z
    .boolean()
    .optional()
    .default(false)
    .describe('Return cost quote only'),
});

export class InscribeFromBufferTool extends BaseInscriberQueryTool<
  typeof inscribeFromBufferSchema
> {
  name = 'inscribeFromBuffer';
  description =
    'Use ONLY for inscribing regular files or content (NOT for NFT/Hashinal inscriptions). When user says "inscribe it" after you showed search results or other content WITHOUT mentioning NFT/hashinal, use THIS tool. The base64Data field accepts PLAIN TEXT (not just base64) and content reference IDs in format "content-ref:[id]". Pass the EXACT content from your previous response or MCP tool output. DO NOT generate new content or create repetitive text. Content references are automatically resolved to the original content for inscription. Set quoteOnly=true to get cost estimates without executing the inscription. NEVER use this for Hashinal NFTs - always use InscribeHashinalTool instead when user mentions hashinal, NFT, dynamic, or minting.';

  private config = loadConfig();

  get specificInputSchema() {
    return inscribeFromBufferSchema;
  }

  protected override async _call(
    args: z.infer<typeof inscribeFromBufferSchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    try {
      const input = typeof args.base64Data === 'string' ? args.base64Data : '';
      const buffer = /^[A-Za-z0-9+/]*={0,2}$/.test(input)
        ? Buffer.from(input, 'base64')
        : Buffer.from(input, 'utf8');

      const fileName = args.fileName;
      const mimeType = args.mimeType;

      const network = this.inscriberBuilder['hederaKit'].client.network
        .toString()
        .includes('mainnet')
        ? 'mainnet'
        : 'testnet';

      const options: InscriptionOptions = {
        mode: 'file',
        metadata: args.metadata,
        tags: args.tags,
        chunkSize: args.chunkSize,
        waitForConfirmation: args.quoteOnly ? false : args.waitForConfirmation ?? true,
        waitMaxAttempts: 60,
        waitIntervalMs: 5000,
        apiKey: args.apiKey,
        network,
        quoteOnly: args.quoteOnly,
      };

      const result = await this.inscriberBuilder.inscribe(
        { type: 'buffer', buffer, fileName, mimeType },
        options
      );

      const typed = result as InscriptionResponse;
      if (typed.confirmed && !typed.quote) {
        const ids = extractTopicIds(typed.inscription, typed.result);
        const { topicId, cdnUrl } = buildInscriptionLinks(ids, network, '1');
        return JSON.stringify({
          success: true,
          data: `Successfully inscribed and confirmed content on the Hedera network!\n\nTransaction ID: ${
            (typed.result as InscriptionResult)?.transactionId ?? 'unknown'
          }\nTopic ID: ${topicId || 'N/A'}${
            cdnUrl ? `\nView inscription: ${cdnUrl}` : ''
          }\n\nThe inscription is now available.`,
        });
      }

      return JSON.stringify({
        success: true,
        data: `Successfully submitted inscription to the Hedera network!\n\nTransaction ID: ${
          (typed.result as InscriptionResult)?.transactionId ?? 'unknown'
        }\n\nThe inscription is processing and will be confirmed shortly.`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return JSON.stringify({ success: false, error: `Inscription failed: ${errorMessage}` });
    }
  }

  protected async executeQuery(
    params: z.infer<typeof inscribeFromBufferSchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<unknown> {

    const resolvedContent = await resolveContent(
      params.base64Data,
      params.mimeType,
      params.fileName
    );
    this.logger?.debug(
      `[InscribeFromBufferTool] Resolved content bytes: ${
        resolvedContent.buffer?.length ?? -1
      }`
    );

    try {
      this.validateContent(resolvedContent.buffer);
    } catch (validationError) {
      this.logger?.warn(
        `Content validation warning: ${
          validationError instanceof Error
            ? validationError.message
            : String(validationError)
        }`
      );
    }

    const buffer = resolvedContent.buffer;
    const resolvedMimeType = resolvedContent.mimeType || params.mimeType;
    const resolvedFileName = resolvedContent.fileName || params.fileName;

    const options: InscriptionOptions = {
      mode: 'file',
      metadata: params.metadata,
      tags: params.tags,
      chunkSize: params.chunkSize,
      waitForConfirmation: params.quoteOnly
        ? false
        : params.waitForConfirmation ?? true,
      waitMaxAttempts: 60,
      waitIntervalMs: 5000,
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
          message: `Estimated Quote for buffer content: ${resolvedFileName} (${(
            buffer.length / 1024
          ).toFixed(2)} KB)\nTotal cost: ${quote.totalCostHbar} HBAR`,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to generate inscription quote';
        throw new Error(`Quote generation failed: ${errorMessage}`);
      }
    }

    try {
      this.logger?.debug(
        `[InscribeFromBufferTool] Calling inscribe with fileName: ${resolvedFileName}, mime: ${resolvedMimeType}`
      );
      const result = await this.executeInscription(
        buffer,
        resolvedFileName,
        resolvedMimeType,
        options,
        params.timeoutMs
      );
      this.logger?.debug(
        `[InscribeFromBufferTool] Inscribe result (confirmed): ${Boolean((result as any)?.confirmed)}`
      );
      return this.formatInscriptionResult(result, options);
    } catch (error) {
      this.logger?.warn(
        `[InscribeFromBufferTool] Error during inscription: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
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
    const typed = result as InscriptionResponse;

    if (typed.confirmed && !typed.quote) {
      const ids = extractTopicIds(typed.inscription, typed.result);
      const network = (options.network || 'testnet') as 'mainnet' | 'testnet';
      const { topicId, cdnUrl } = buildInscriptionLinks(ids, network, '1');
      return `Successfully inscribed and confirmed content on the Hedera network!\n\nTransaction ID: ${
        (typed.result as InscriptionResult)?.transactionId ?? 'unknown'
      }\nTopic ID: ${topicId || 'N/A'}${
        cdnUrl ? `\nView inscription: ${cdnUrl}` : ''
      }\n\nThe inscription is now available.`;
    }

    if (!typed.quote && !typed.confirmed) {
      return `Successfully submitted inscription to the Hedera network!\n\nTransaction ID: ${
        (typed.result as InscriptionResult)?.transactionId ?? 'unknown'
      }\n\nThe inscription is processing and will be confirmed shortly.`;
    }

    return 'Inscription operation completed.';
  }
}
