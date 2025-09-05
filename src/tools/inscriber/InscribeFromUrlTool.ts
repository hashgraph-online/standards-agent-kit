import { z } from 'zod';
import { BaseInscriberQueryTool } from './base-inscriber-tools';
import { InscriptionOptions, Logger, InscriptionResponse } from '@hashgraphonline/standards-sdk';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { extractTopicIds, buildInscriptionLinks } from '../../utils/inscription-utils';

const logger = new Logger({ module: 'InscribeFromUrlTool' });

/**
 * Schema for inscribing from URL
 */
const inscribeFromUrlSchema = z.object({
  url: z
    .string()
    .url()
    .describe(
      'ONLY direct file download URLs with file extensions (.pdf, .jpg, .png, .json, .zip). NEVER use for web pages, articles, or when you already have content to inscribe.'
    ),
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
    .describe(
      'If true, returns a cost quote instead of executing the inscription'
    ),
});

/**
 * Tool for inscribing content from URL
 */
export class InscribeFromUrlTool extends BaseInscriberQueryTool<
  typeof inscribeFromUrlSchema
> {
  name = 'inscribeFromUrl';
  description =
    'ONLY for direct FILE DOWNLOAD URLs ending with file extensions (.pdf, .jpg, .png, .json, .zip). NEVER use for web pages, articles, or ANY HTML content - it WILL FAIL. If you have already retrieved content from any source (including MCP tools), you MUST use inscribeFromBuffer instead. This tool downloads files from URLs - it does NOT inscribe content you already have. When asked to "inscribe it" after retrieving content, ALWAYS use inscribeFromBuffer with the actual content. Set quoteOnly=true to get cost estimates without executing the inscription.';

  get specificInputSchema() {
    return inscribeFromUrlSchema;
  }

  protected async executeQuery(
    params: z.infer<typeof inscribeFromUrlSchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<unknown> {
    logger.debug(`InscribeFromUrlTool.executeQuery called with URL: ${params.url}`);

    if (!params.url || params.url.trim() === '') {
      throw new Error('URL cannot be empty. Please provide a valid URL.');
    }

    try {
      const urlObj = new URL(params.url);
      if (!urlObj.protocol || !urlObj.host) {
        throw new Error(
          'Invalid URL format. Please provide a complete URL with protocol (http/https).'
        );
      }
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error(
          'Only HTTP and HTTPS URLs are supported for inscription.'
        );
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Cannot inscribe content from')
      ) {
        throw error;
      }
      throw new Error(
        `Invalid URL: ${params.url}. Please provide a valid URL.`
      );
    }

    logger.info('Validating URL content before inscription...');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const headResponse = await fetch(params.url, {
          method: 'HEAD',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!headResponse.ok) {
          throw new Error(
            `URL returned error status ${headResponse.status}: ${headResponse.statusText}. Cannot inscribe content from inaccessible URLs.`
          );
        }

        const contentType = headResponse.headers.get('content-type') || '';
        const contentLength = headResponse.headers.get('content-length');

        const webPageContentTypes = [
          'text/html',
          'application/xhtml+xml',
          'text/xml',
        ];

        if (
          webPageContentTypes.some((type) =>
            contentType.toLowerCase().includes(type)
          )
        ) {
          throw new Error(
            `URL returns HTML/web page content (Content-Type: ${contentType}). This tool only works with direct file URLs (PDFs, images, JSON, etc.). For web page content, first retrieve the content using the appropriate MCP tool or web scraper, then use inscribeFromBuffer to inscribe it.`
          );
        }

        if (contentLength && parseInt(contentLength) === 0) {
          throw new Error(
            'URL returns empty content (Content-Length: 0). Cannot inscribe empty content.'
          );
        }

        if (contentLength && parseInt(contentLength) < 10) {
          throw new Error(
            `URL content is too small (${contentLength} bytes). Content must be at least 10 bytes.`
          );
        }

        if (!contentType || contentType === 'application/octet-stream') {
          logger.info('Content-Type unclear, fetching first 1KB to verify...');

          const getController = new AbortController();
          const getTimeoutId = setTimeout(() => getController.abort(), 5000);

          try {
            const getResponse = await fetch(params.url, {
              signal: getController.signal,
              headers: {
                Range: 'bytes=0-1023', // Get first 1KB
              },
            });

            clearTimeout(getTimeoutId);

            if (getResponse.ok || getResponse.status === 206) {

              const buffer = await getResponse.arrayBuffer();
              const bytes = new Uint8Array(buffer);
              const text = new TextDecoder('utf-8', { fatal: false }).decode(
                bytes.slice(0, 512)
              );

              if (
                text.toLowerCase().includes('<!doctype html') ||
                text.toLowerCase().includes('<html') ||
                text.match(/<meta\s+[^>]*>/i) ||
                text.match(/<title>/i)
              ) {
                throw new Error(
                  `URL returns HTML content. This tool only works with direct file URLs. For web page content, first retrieve it using the appropriate tool, then use inscribeFromBuffer.`
                );
              }
            }
          } catch (getError) {
            clearTimeout(getTimeoutId);
            if (
              getError instanceof Error &&
              getError.message.includes('HTML content')
            ) {
              throw getError;
            }
            logger.warn(
              `Could not perform partial GET validation: ${
                getError instanceof Error ? getError.message : 'Unknown error'
              }`
            );
          }
        }

        logger.info(
          `URL validation passed. Content-Type: ${contentType}, Content-Length: ${
            contentLength || 'unknown'
          }`
        );
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          logger.warn(
            'URL validation timed out after 10 seconds. Proceeding with inscription attempt.'
          );
        } else if (
          error.message.includes('URL returned error') ||
          error.message.includes('empty content') ||
          error.message.includes('too small') ||
          error.message.includes('HTML')
        ) {
          throw error;
        } else {
          logger.warn(
            `Could not validate URL with HEAD request: ${error.message}. Proceeding with inscription attempt.`
          );
        }
      }
    }

    const options: InscriptionOptions = {
      mode: params.mode,
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
          },
          message: `Estimated Quote for URL: ${params.url}\nTotal cost: ${quote.totalCostHbar} HBAR`,
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
      let result: Awaited<ReturnType<typeof this.inscriberBuilder.inscribe>>;

      if (params.timeoutMs) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () =>
              reject(
                new Error(`Inscription timed out after ${params.timeoutMs}ms`)
              ),
            params.timeoutMs
          );
        });

        result = await Promise.race([
          this.inscriberBuilder.inscribe(
            { type: 'url', url: params.url },
            options
          ),
          timeoutPromise,
        ]);
      } else {
        result = await this.inscriberBuilder.inscribe(
          { type: 'url', url: params.url },
          options
        );
      }

      const typed = result as InscriptionResponse;

      if (typed.confirmed && !typed.quote) {
        const ids = extractTopicIds(typed.inscription, typed.result);
        const network = (options.network || 'testnet') as 'mainnet' | 'testnet';
        const { topicId, cdnUrl } = buildInscriptionLinks(
          ids,
          network,
          '1'
        );
        return `Successfully inscribed and confirmed content on the Hedera network!\n\nTransaction ID: ${
          (typed.result as { transactionId?: string })?.transactionId ?? 'unknown'
        }\nTopic ID: ${topicId || 'N/A'}${
          cdnUrl ? `\nView inscription: ${cdnUrl}` : ''
        }\n\nThe inscription is now available.`;
      } else if (!typed.quote && !typed.confirmed) {
        return `Successfully submitted inscription to the Hedera network!\n\nTransaction ID: ${
          (typed.result as { transactionId?: string })?.transactionId ?? 'unknown'
        }\n\nThe inscription is processing and will be confirmed shortly.`;
      } else {
        return 'Inscription operation completed.';
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to inscribe from URL';
      throw new Error(`Inscription failed: ${errorMessage}`);
    }
  }
}
