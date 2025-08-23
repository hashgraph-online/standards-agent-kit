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
  filePath: z
    .string()
    .min(1, 'File path cannot be empty')
    .describe(
      'The file path of the content to inscribe. Must point to a valid, non-empty file.'
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
    .describe('Timeout in milliseconds for inscription (default: no timeout)'),
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
 * Tool for inscribing content from file
 */
export class InscribeFromFileTool extends BaseInscriberQueryTool<
  typeof inscribeFromFileSchema
> {
  name = 'inscribeFromFile';
  description =
    'Inscribe content from a local file to the Hedera network using a file path. IMPORTANT: Only use this tool when you have a valid file path to actual content. The file must exist and contain meaningful data (minimum 10 bytes). For files accessed through MCP filesystem tools, consider reading the file content first and using inscribeFromBuffer instead. Set quoteOnly=true to get cost estimates without executing the inscription.';

  get specificInputSchema(): typeof inscribeFromFileSchema {
    return inscribeFromFileSchema;
  }

  protected async executeQuery(
    params: z.infer<typeof inscribeFromFileSchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<unknown> {
    let fileContent: Buffer;
    try {
      const stats = await fs.stat(params.filePath);
      if (!stats.isFile()) {
        throw new Error(`Path "${params.filePath}" is not a file`);
      }

      if (stats.size === 0) {
        throw new Error(
          `File "${params.filePath}" is empty (0 bytes). Cannot inscribe empty files.`
        );
      }

      if (stats.size < 10) {
        throw new Error(
          `File "${params.filePath}" is too small (${stats.size} bytes). Files must contain at least 10 bytes of meaningful content.`
        );
      }

      if (stats.size > 100 * 1024 * 1024) {
        this.logger?.warn(
          `Large file detected (${(
            stats.size /
            (1024 * 1024)
          ).toFixed(2)} MB)`
        );
      }

      this.logger?.info('Reading file content...');
      fileContent = await fs.readFile(params.filePath);
      this.logger?.info(`Read ${fileContent.length} bytes from file`);

      if (!fileContent || fileContent.length === 0) {
        throw new Error(
          `File "${params.filePath}" has no content after reading. Cannot inscribe empty files.`
        );
      }

      if (fileContent.length < 10) {
        throw new Error(
          `File "${params.filePath}" content is too small (${fileContent.length} bytes). Files must contain at least 10 bytes of meaningful content.`
        );
      }

      const fileName = path.basename(params.filePath);
      const mimeType = this.getMimeType(fileName);
      if (mimeType.startsWith('text/') || mimeType === 'application/json') {
        const textContent = fileContent.toString(
          'utf8',
          0,
          Math.min(fileContent.length, 1000)
        );
        if (textContent.trim() === '') {
          throw new Error(
            `File "${params.filePath}" contains only whitespace or empty content. Cannot inscribe meaningless data.`
          );
        }
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
      waitForConfirmation: params.quoteOnly
        ? false
        : params.waitForConfirmation ?? true,
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
            buffer: Buffer.from(base64Data, 'base64'),
            fileName,
            mimeType,
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
            fileName,
            mimeType,
            sizeBytes: fileContent.length,
            filePath: params.filePath,
          },
          message: `Estimated Quote for file: ${fileName} (${(
            fileContent.length / 1024
          ).toFixed(2)} KB)\nTotal cost: ${
            quote.totalCostHbar
          } HBAR`,
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
      let result: unknown;

      if (params.timeoutMs) {
        const timeoutPromise = new Promise((_, reject) => {
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

      const inscriptionResult = result as any;
      if (inscriptionResult.confirmed && !inscriptionResult.quote) {
        const topicId =
          inscriptionResult.inscription?.topic_id ||
          inscriptionResult.result.topicId;
        const network = options.network || 'testnet';
        const cdnUrl = topicId
          ? `https://kiloscribe.com/api/inscription-cdn/${topicId}?network=${network}`
          : null;
        return `Successfully inscribed and confirmed content on the Hedera network!\n\nTransaction ID: ${
          inscriptionResult.result.transactionId
        }\nTopic ID: ${topicId || 'N/A'}${
          cdnUrl ? `\nView inscription: ${cdnUrl}` : ''
        }\n\nThe inscription is now available.`;
      } else if (!inscriptionResult.quote && !inscriptionResult.confirmed) {
        return `Successfully submitted inscription to the Hedera network!\n\nTransaction ID: ${inscriptionResult.result.transactionId}\n\nThe inscription is processing and will be confirmed shortly.`;
      } else {
        return 'Inscription operation completed.';
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
