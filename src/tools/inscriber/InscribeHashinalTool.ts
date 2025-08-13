import { z } from 'zod';
import { BaseInscriberQueryTool } from './base-inscriber-tools';
import {
  InscriptionOptions,
  ContentResolverRegistry,
} from '@hashgraphonline/standards-sdk';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { validateHIP412Metadata } from '../../validation/hip412-schemas';
import { contentRefSchema } from '../../validation/content-ref-schemas';
import { generateDefaultMetadata } from '../../utils/metadata-defaults';


/**
 * Schema for inscribing Hashinal NFT
 */
const inscribeHashinalSchema = z.object({
  url: z
    .string()
    .optional()
    .describe(
      'The URL of the content to inscribe as Hashinal NFT (use this OR contentRef)'
    ),
  contentRef: contentRefSchema
    .optional()
    .describe(
      'Content reference ID in format "content-ref:[id]" for already stored content (use this OR url)'
    ),
  base64Data: z
    .string()
    .optional()
    .describe(
      'Base64 encoded content data (use this if neither url nor contentRef provided)'
    ),
  fileName: z
    .string()
    .optional()
    .describe(
      'File name for the content (required when using base64Data or contentRef)'
    ),
  mimeType: z
    .string()
    .optional()
    .describe('MIME type of the content (e.g., "image/png", "image/jpeg")'),
  name: z
    .string()
    .optional()
    .describe(
      'Name of the Hashinal NFT (defaults to filename if not provided)'
    ),
  creator: z
    .string()
    .optional()
    .describe('Creator account ID or name (defaults to operator account)'),
  description: z
    .string()
    .optional()
    .describe(
      'Description of the Hashinal NFT (auto-generated if not provided)'
    ),
  type: z
    .string()
    .optional()
    .describe('Type of NFT (auto-detected from MIME type if not provided)'),
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
  fileStandard: z
    .enum(['1', '6'])
    .optional()
    .default('1')
    .describe(
      'HCS file standard: 1 for static Hashinals (HCS-5), 6 for dynamic Hashinals (HCS-6)'
    ),
  tags: z.array(z.string()).optional().describe('Tags to categorize the NFT'),
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
 * Tool for inscribing Hashinal NFTs
 */
export class InscribeHashinalTool extends BaseInscriberQueryTool<
  typeof inscribeHashinalSchema
> {
  name = 'inscribeHashinal';
  description =
    'STEP 1: Inscribe content as Hashinal NFT. This tool creates the inscription and returns metadataForMinting (HRL format). CRITICAL: You MUST use the metadataForMinting field from this tool output as the metadata parameter when calling mint NFT tools. DO NOT use the original content reference for minting. This tool only inscribes - call minting tools separately after this completes. Use fileStandard=6 for dynamic Hashinals (HCS-6) or fileStandard=1 for static Hashinals (HCS-5).';

  get specificInputSchema() {
    return inscribeHashinalSchema;
  }

  protected async executeQuery(
    params: z.infer<typeof inscribeHashinalSchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<unknown> {
    // Validate input - must have either url, contentRef, or base64Data
    if (!params.url && !params.contentRef && !params.base64Data) {
      throw new Error(
        'Must provide either url, contentRef, or base64Data for the Hashinal NFT content'
      );
    }

    const operatorAccount =
      this.inscriberBuilder['hederaKit']?.client?.operatorAccountId?.toString() || '0.0.unknown';

    const rawMetadata = {
      ...generateDefaultMetadata({
        name: params.name,
        creator: params.creator,
        description: params.description,
        type: params.type,
        fileName: params.fileName,
        mimeType: params.mimeType,
        operatorAccount,
      }),
      attributes: params.attributes,
      properties: params.properties,
    };

    // Validate metadata against HIP-412 standard
    let validatedMetadata;
    try {
      validatedMetadata = validateHIP412Metadata(rawMetadata);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Metadata validation error: ${errorMessage}`);
    }

    const options: InscriptionOptions = {
      mode: 'hashinal',
      metadata: validatedMetadata,
      jsonFileURL: params.jsonFileURL,
      fileStandard: params.fileStandard,
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

    // Determine inscription data based on input type
    let inscriptionData: any;

    if (params.url) {
      inscriptionData = { type: 'url', url: params.url };
    } else if (params.contentRef || params.base64Data) {
      // Handle content reference or base64 data
      const inputData = params.contentRef || params.base64Data || '';
      const { buffer, mimeType, fileName } = await this.resolveContent(
        inputData,
        params.mimeType,
        params.fileName
      );

      inscriptionData = {
        type: 'buffer' as const,
        buffer,
        fileName: fileName || params.fileName || 'hashinal-content',
        mimeType: mimeType || params.mimeType,
      };
    }

    if (params.quoteOnly) {
      try {
        const quote = await this.generateInscriptionQuote(
          inscriptionData,
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
          message: `Estimated Quote for Hashinal NFT: ${params.name}\nCreator: ${params.creator}\nTotal cost: ${quote.totalCostHbar} HBAR`,
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
          this.inscriberBuilder.inscribe(inscriptionData, options),
          timeoutPromise,
        ]);
      } else {
        result = await this.inscriberBuilder.inscribe(inscriptionData, options);
      }

      if (result.confirmed && !result.quote) {
        const imageTopicId = result.inscription?.topic_id;
        const jsonTopicId = result.inscription?.jsonTopicId;
        const network = options.network || 'testnet';

        const cdnUrl = jsonTopicId
          ? `https://kiloscribe.com/api/inscription-cdn/${jsonTopicId}?network=${network}`
          : null;

        const fileStandard = params.fileStandard || '1';
        const hrl = jsonTopicId ? `hcs://${fileStandard}/${jsonTopicId}` : null;
        const standardType = fileStandard === '6' ? 'Dynamic' : 'Static';

        return {
          success: true,
          transactionId: (result.result as any).transactionId,
          imageTopicId: imageTopicId || 'N/A',
          jsonTopicId: jsonTopicId || 'N/A',
          metadataForMinting: hrl,
          hcsStandard: `hcs://${fileStandard}`,
          fileStandard: fileStandard,
          standardType: standardType,
          message: `STEP 1 COMPLETE: ${standardType} Hashinal inscription finished! NOW FOR STEP 2: Use EXACTLY this metadata for minting: "${hrl}". DO NOT use the original content reference.`,
          cdnUrl: cdnUrl,
          NEXT_STEP_INSTRUCTIONS: `Call mint NFT tool with metadata: ["${hrl}"]`,
          WARNING:
            'DO NOT use content-ref for minting - only use the metadataForMinting value above',
        };
      } else if (!result.quote && !result.confirmed) {
        return `Successfully submitted Hashinal NFT inscription to the Hedera network!\n\nTransaction ID: ${
          (result.result as any).transactionId
        }\n\nThe inscription is processing and will be confirmed shortly.`;
      } else {
        return 'Inscription operation completed.';
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to inscribe Hashinal NFT';
      throw new Error(`Inscription failed: ${errorMessage}`);
    }
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

    const resolver =
      this.getContentResolver() || ContentResolverRegistry.getResolver();

    if (!resolver) {
      return this.handleDirectContent(
        trimmedInput,
        providedMimeType,
        providedFileName
      );
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

    return this.handleDirectContent(
      trimmedInput,
      providedMimeType,
      providedFileName
    );
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
