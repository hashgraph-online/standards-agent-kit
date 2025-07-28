import { z } from 'zod';
import { BaseInscriberQueryTool } from './base-inscriber-tools';
import { InscriptionOptions } from '@hashgraphonline/standards-sdk';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Schema for inscribing from file
 */
const inscribeFromFileSchema = z.object({
  filePath: z.string().describe('The file path of the content to inscribe'),
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
  apiKey: z.string().optional().describe('API key for inscription service'),
});

/**
 * Tool for inscribing content from file
 */
export class InscribeFromFileTool extends BaseInscriberQueryTool<
  typeof inscribeFromFileSchema
> {
  name = 'inscribeFromFile';
  description =
    'Inscribe content from a local file to the Hedera network using a file path. For files accessed through MCP filesystem tools, consider reading the file content first and using inscribeFromBuffer instead.';

  get specificInputSchema(): typeof inscribeFromFileSchema {
    return inscribeFromFileSchema;
  }

  protected async executeQuery(
    params: z.infer<typeof inscribeFromFileSchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<unknown> {
    console.log(`[DEBUG] InscribeFromFileTool.executeQuery called with: ${params.filePath}`);
    
    // File validation
    let fileContent: Buffer;
    try {
      console.log(`[DEBUG] Checking file: ${params.filePath}`);
      console.log(`[DEBUG] Current working directory: ${process.cwd()}`);

      const stats = await fs.stat(params.filePath);
      if (!stats.isFile()) {
        throw new Error(`Path "${params.filePath}" is not a file`);
      }

      console.log(`[DEBUG] File size: ${stats.size} bytes`);

      if (stats.size === 0) {
        throw new Error(
          `File "${params.filePath}" is empty. Cannot inscribe empty files.`
        );
      }

      this.logger?.info('Reading file content...');
      fileContent = await fs.readFile(params.filePath);
      this.logger?.info(`Read ${fileContent.length} bytes from file`);

      if (!fileContent || fileContent.length === 0) {
        throw new Error(
          `File "${params.filePath}" has no content. Cannot inscribe empty files.`
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('ENOENT')) {
          throw new Error(`File not found: "${params.filePath}"`);
        }
        throw error;
      }
      throw new Error(`Failed to read file: ${error}`);
    }

    const base64Data = fileContent.toString('base64');
    this.logger?.info(`Converted to base64: ${base64Data.length} characters`);

    const fileName = path.basename(params.filePath);
    const mimeType = this.getMimeType(fileName);
    this.logger?.info(`File: ${fileName}, MIME type: ${mimeType}`);

    const options: InscriptionOptions = {
      mode: params.mode,
      metadata: params.metadata,
      tags: params.tags,
      chunkSize: params.chunkSize,
      waitForConfirmation: params.waitForConfirmation ?? true,
      waitMaxAttempts: 10,
      waitIntervalMs: 3000,
      apiKey: params.apiKey,
      network: this.inscriberBuilder['hederaKit'].client.network
        .toString()
        .includes('mainnet')
        ? 'mainnet'
        : 'testnet',
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
              buffer: Buffer.from(base64Data, 'base64'),
              fileName,
              mimeType,
            },
            options
          ),
          timeoutPromise,
        ]);
      } else {
        result = await this.inscriberBuilder.inscribe(
          {
            type: 'buffer',
            buffer: Buffer.from(base64Data, 'base64'),
            fileName,
            mimeType,
          },
          options
        );
      }

      if (result.confirmed) {
        const topicId = result.inscription?.topic_id || result.result.topicId;
        const network = options.network || 'testnet';
        const cdnUrl = topicId
          ? `https://kiloscribe.com/api/inscription-cdn/${topicId}?network=${network}`
          : null;
        return `Successfully inscribed and confirmed content on the Hedera network!\n\nTransaction ID: ${
          result.result.transactionId
        }\nTopic ID: ${topicId || 'N/A'}${
          cdnUrl ? `\nView inscription: ${cdnUrl}` : ''
        }\n\nThe inscription is now available.`;
      } else {
        return `Successfully submitted inscription to the Hedera network!\n\nTransaction ID: ${result.result.transactionId}\n\nThe inscription is processing and will be confirmed shortly.`;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to inscribe from file';
      throw new Error(`Inscription failed: ${errorMessage}`);
    }
  }

  private getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.zip': 'application/zip',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}
