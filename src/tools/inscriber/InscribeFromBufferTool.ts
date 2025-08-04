import { z } from 'zod';
import { BaseInscriberQueryTool } from './base-inscriber-tools';
import { InscriptionOptions } from '@hashgraphonline/standards-sdk';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';

/**
 * Schema for inscribing from buffer
 */
const inscribeFromBufferSchema = z.object({
  base64Data: z.string().min(1, 'Base64 data cannot be empty').describe('Base64 encoded content to inscribe. Must contain valid, non-empty content (minimum 10 bytes after decoding).'),
  fileName: z.string().min(1, 'File name cannot be empty').describe('Name for the inscribed content. Required for all inscriptions.'),
  mimeType: z
    .string()
    .optional()
    .describe('MIME type of the content'),
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
    .describe('Timeout in milliseconds for inscription (default: no timeout)'),
  apiKey: z
    .string()
    .optional()
    .describe('API key for inscription service'),
});


/**
 * Tool for inscribing content from buffer
 */
export class InscribeFromBufferTool extends BaseInscriberQueryTool<typeof inscribeFromBufferSchema> {
  name = 'inscribeFromBuffer';
  description = 'Inscribe content from a buffer/base64 data to the Hedera network. IMPORTANT: Only use this tool when you have actual content to inscribe. The base64Data must contain valid, non-empty content (minimum 10 bytes). Useful for inscribing content that has been read into memory, including files accessed through MCP filesystem tools. Always verify the content exists and is meaningful before attempting inscription.';

  get specificInputSchema() {
    return inscribeFromBufferSchema;
  }

  protected async executeQuery(
    params: z.infer<typeof inscribeFromBufferSchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<unknown> {
    console.log(`[DEBUG] InscribeFromBufferTool.executeQuery called`);
    console.log(`[DEBUG] Buffer tool received base64Data length: ${params.base64Data?.length || 0}`);
    console.log(`[DEBUG] Buffer tool fileName: ${params.fileName}`);
    console.log(`[DEBUG] Buffer tool mimeType: ${params.mimeType}`);
    
    if (!params.base64Data || params.base64Data.trim() === '') {
      console.log(`[InscribeFromBufferTool] ERROR: No data provided`);
      throw new Error('No data provided. Cannot inscribe empty content. Please provide valid base64 encoded data.');
    }

    if (!params.fileName || params.fileName.trim() === '') {
      console.log(`[InscribeFromBufferTool] ERROR: No fileName provided`);
      throw new Error('No fileName provided. A valid fileName is required for inscription.');
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(params.base64Data, 'base64');
    } catch (error) {
      console.log(`[InscribeFromBufferTool] ERROR: Invalid base64 data`);
      throw new Error('Invalid base64 data provided. Please ensure the data is properly base64 encoded.');
    }
    
    console.log(`[InscribeFromBufferTool] Buffer length after conversion: ${buffer.length}`);
    
    if (buffer.length === 0) {
      console.log(`[InscribeFromBufferTool] ERROR: Buffer is empty after conversion`);
      throw new Error('Buffer is empty after base64 conversion. The provided data appears to be invalid or empty.');
    }

    if (buffer.length < 10) {
      console.log(`[InscribeFromBufferTool] WARNING: Buffer is very small (${buffer.length} bytes)`);
      console.log(`[InscribeFromBufferTool] Buffer content preview: ${buffer.toString('utf8', 0, Math.min(buffer.length, 50))}`);
      throw new Error(`Buffer content is too small (${buffer.length} bytes). This may indicate empty or invalid content. Please verify the source data contains actual content.`);
    }

    const isValidBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(params.base64Data);
    if (!isValidBase64) {
      console.log(`[InscribeFromBufferTool] ERROR: Invalid base64 format`);
      throw new Error('Invalid base64 format. The data does not appear to be properly base64 encoded.');
    }

    if (buffer.toString('utf8', 0, Math.min(buffer.length, 100)).trim() === '') {
      console.log(`[InscribeFromBufferTool] ERROR: Buffer contains only whitespace or empty content`);
      throw new Error('Buffer contains only whitespace or empty content. Cannot inscribe meaningless data.');
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
      let result: any;
      
      if (params.timeoutMs) {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error(`Inscription timed out after ${params.timeoutMs}ms`)),
            params.timeoutMs
          );
        });

        result = await Promise.race([
          this.inscriberBuilder.inscribe(
            {
              type: 'buffer',
              buffer,
              fileName: params.fileName,
              mimeType: params.mimeType,
            },
            options
          ),
          timeoutPromise,
        ]);
      } else {
        result = await this.inscriberBuilder.inscribe(
          {
            type: 'buffer',
            buffer,
            fileName: params.fileName,
            mimeType: params.mimeType,
          },
          options
        );
      }

      if (result.confirmed) {
        const topicId = result.inscription?.topic_id || result.result.topicId;
        const network = options.network || 'testnet';
        const cdnUrl = topicId ? `https://kiloscribe.com/api/inscription-cdn/${topicId}?network=${network}` : null;
        return `Successfully inscribed and confirmed content on the Hedera network!\n\nTransaction ID: ${result.result.transactionId}\nTopic ID: ${topicId || 'N/A'}${cdnUrl ? `\nView inscription: ${cdnUrl}` : ''}\n\nThe inscription is now available.`;
      } else {
        return `Successfully submitted inscription to the Hedera network!\n\nTransaction ID: ${result.result.transactionId}\n\nThe inscription is processing and will be confirmed shortly.`;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to inscribe from buffer';
      throw new Error(`Inscription failed: ${errorMessage}`);
    }
  }
}