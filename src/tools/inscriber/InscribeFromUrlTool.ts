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
  description = 'Inscribe content directly from a URL that points to a downloadable file (PDF, image, JSON, etc). DO NOT use this for web pages like Wikipedia, Twitter, or GitHub pages. This tool is ONLY for direct file URLs like https://example.com/document.pdf or https://api.example.com/data.json. For content you already have (from Wikipedia, MCP tools, or text), use inscribeFromBuffer instead.';

  get specificInputSchema() {
    return inscribeFromUrlSchema;
  }

  protected async executeQuery(
    params: z.infer<typeof inscribeFromUrlSchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<unknown> {
    console.log(`[DEBUG] InscribeFromUrlTool.executeQuery called with URL: ${params.url}`);
    
    if (!params.url || params.url.trim() === '') {
      throw new Error('URL cannot be empty. Please provide a valid URL.');
    }

    try {
      const urlObj = new URL(params.url);
      if (!urlObj.protocol || !urlObj.host) {
        throw new Error('Invalid URL format. Please provide a complete URL with protocol (http/https).');
      }
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Only HTTP and HTTPS URLs are supported for inscription.');
      }
    } catch (error) {
      throw new Error(`Invalid URL: ${params.url}. Please provide a valid URL.`);
    }

    console.log(`[InscribeFromUrlTool] Validating URL content before inscription...`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      try {
        const response = await fetch(params.url, {
          method: 'HEAD',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`URL returned error status ${response.status}: ${response.statusText}. Cannot inscribe content from inaccessible URLs.`);
        }

        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) === 0) {
          throw new Error('URL returns empty content (Content-Length: 0). Cannot inscribe empty content.');
        }

        if (contentLength && parseInt(contentLength) < 10) {
          throw new Error(`URL content is too small (${contentLength} bytes). Content must be at least 10 bytes.`);
        }

        const contentType = response.headers.get('content-type');
        console.log(`[InscribeFromUrlTool] URL validation passed. Content-Type: ${contentType}, Content-Length: ${contentLength || 'unknown'}`);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.log(`[InscribeFromUrlTool] Warning: URL validation timed out after 10 seconds. Proceeding with inscription attempt.`);
        } else if (error.message.includes('URL returned error') || error.message.includes('empty content') || error.message.includes('too small')) {
          throw error;
        } else {
          console.log(`[InscribeFromUrlTool] Warning: Could not validate URL with HEAD request: ${error.message}. Proceeding with inscription attempt.`);
        }
      }
    }

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