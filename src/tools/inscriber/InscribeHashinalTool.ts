/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';
import { BaseInscriberQueryTool } from './base-inscriber-tools';
import {
  InscriptionOptions,
  InscriptionInput,
  ContentResolverRegistry,
  Logger,
} from '@hashgraphonline/standards-sdk';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { validateHIP412Metadata } from '../../validation/hip412-schemas';
import { contentRefSchema } from '../../validation/content-ref-schemas';
import { generateDefaultMetadata } from '../../utils/metadata-defaults';
import {
  extendZodSchema,
  renderConfigs,
} from '../../lib/zod-render/schema-extension';
import {
  createInscriptionSuccess,
  createInscriptionQuote,
  createInscriptionError,
  InscriptionResponse,
} from '../../types/inscription-response';
import { FormValidatable } from '../../interfaces/FormValidatable';

/**
 * Network-specific Hashinal block configuration for HashLink blocks
 */
const HASHLINK_BLOCK_CONFIG = {
  testnet: {
    blockId: '0.0.6617393',
    hashLink: 'hcs://12/0.0.6617393',
    template: '0.0.6617393',
  },
  mainnet: {
    blockId: '0.0.TBD',
    hashLink: 'hcs://12/0.0.TBD',
    template: '0.0.TBD',
  },
};

/**
 * Gets the appropriate HashLink block configuration for the specified network.
 * Provides graceful fallback to testnet for unknown networks or undeployed mainnet blocks.
 *
 * @param network The network type to get configuration for
 * @returns Network-specific block configuration with blockId, hashLink, and template
 */
// @ts-ignore - keep untyped to satisfy mixed parser while using runtime narrowing
function getHashLinkBlockId(network) {
  const config =
    network === 'mainnet'
      ? HASHLINK_BLOCK_CONFIG.mainnet
      : HASHLINK_BLOCK_CONFIG.testnet;
  if (!config || config.blockId === '0.0.TBD') {
    return HASHLINK_BLOCK_CONFIG.testnet;
  }
  return config;
}

// Note: Using inline return type annotations to avoid parser issues with interface declarations

/**
 * Schema for inscribing Hashinal NFT
 */
const inscribeHashinalSchema = extendZodSchema(
  z.object({
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
        'Display name for the NFT (e.g., "Sunset Landscape #42", "Digital Abstract Art")'
      ),
    creator: z
      .string()
      .optional()
      .describe(
        'Creator account ID, artist name, or brand (e.g., "0.0.123456", "ArtistName", "StudioBrand")'
      ),
    description: z
      .string()
      .optional()
      .describe(
        'Meaningful description of the artwork, story, or concept behind this NFT'
      ),
    type: z
      .string()
      .optional()
      .describe(
        'Category or genre of the NFT (e.g., "Digital Art", "Photography", "Collectible Card")'
      ),
    attributes: extendZodSchema(
      z.array(
        z.object({
          trait_type: z.string(),
          value: z.union([z.string(), z.number()]),
        })
      )
    )
      .withRender(renderConfigs.array('NFT Attributes', 'Attribute'))
      .optional()
      .describe(
        'Collectible traits and characteristics (e.g., "Rarity": "Epic", "Color": "Blue", "Style": "Abstract")'
      ),
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
    quoteOnly: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        'If true, returns a cost quote instead of executing the inscription'
      ),
    withHashLinkBlocks: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        'If true, creates interactive HashLink blocks for the inscribed content and returns block data alongside the inscription response'
      ),
    renderForm: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        'Whether to show a form to collect metadata. Set to false only if user provided complete metadata including name, description, creator, and attributes.'
      ),
  })
).withRender({
  fieldType: 'object',
  ui: {
    label: 'Inscribe Hashinal NFT',
    description: 'Create a Hashinal inscription for NFT minting',
  },
});

/**
 * Tool for inscribing Hashinal NFTs
 */
export class InscribeHashinalTool
  extends BaseInscriberQueryTool
  implements FormValidatable
{
  name = 'inscribeHashinal';
  description =
    'Tool for inscribing Hashinal NFTs. CRITICAL: When user provides content (url/contentRef/base64Data), call with ONLY the content parameters - DO NOT auto-generate name, description, creator, or attributes. A form will be automatically shown to collect metadata from the user. Only include metadata parameters if the user explicitly provided them in their message.';

  // Declare entity resolution preferences to preserve user-specified literal fields
  getEntityResolutionPreferences(): Record<string, string> {
    return {
      name: 'literal',
      description: 'literal',
      creator: 'literal',
      attributes: 'literal',
      properties: 'literal',
    };
  }

  get specificInputSchema(): z.ZodObject<z.ZodRawShape> {
    const baseSchema =
      (inscribeHashinalSchema as z.ZodType & { _def?: { schema?: z.ZodType } })
        ._def?.schema || inscribeHashinalSchema;
    return baseSchema as z.ZodObject<z.ZodRawShape>;
  }

  private _schemaWithRenderConfig?: z.ZodObject<z.ZodRawShape>;

  override get schema(): z.ZodObject<z.ZodRawShape> {
    if (!this._schemaWithRenderConfig) {
      const baseSchema = this.specificInputSchema;
      const schemaWithRender = baseSchema as z.ZodObject<z.ZodRawShape> & {
        _renderConfig?: {
          fieldType: string;
          ui: { label: string; description: string };
        };
      };

      if (!schemaWithRender._renderConfig) {
        schemaWithRender._renderConfig = {
          fieldType: 'object',
          ui: {
            label: 'Inscribe Hashinal NFT',
            description: 'Create a Hashinal inscription for NFT minting',
          },
        };
      }
      this._schemaWithRenderConfig = baseSchema;
    }
    return this._schemaWithRenderConfig;
  }

  /**
   * Implementation of FormValidatable interface
   * Determines if a form should be generated for the given input
   */
  shouldGenerateForm(input: unknown): boolean {
    const logger = new Logger({ module: 'InscribeHashinalTool' });
    const inputObj = input as Record<string, unknown>;

    logger.info('InscribeHashinalTool: Checking if form should be generated', {
      inputKeys: Object.keys(inputObj || {}),
      hasContent: !!(
        inputObj.url ||
        inputObj.contentRef ||
        inputObj.base64Data
      ),
      renderFormProvided: 'renderForm' in inputObj,
      renderFormValue: inputObj.renderForm,
    });

    const hasContentSource = !!(
      inputObj.url ||
      inputObj.contentRef ||
      inputObj.base64Data
    );

    if (!hasContentSource) {
      logger.info('InscribeHashinalTool: No content source provided');
      return false;
    }

    if ('renderForm' in inputObj && inputObj.renderForm === false) {
      logger.info(
        'InscribeHashinalTool: renderForm=false, skipping form generation'
      );
      return false;
    }

    const isNonEmptyString = (v: unknown): v is string => {
      if (typeof v !== 'string') {
        return false;
      }
      if (v.trim().length === 0) {
        return false;
      }
      return true;
    };

    const hasRequiredMetadata =
      isNonEmptyString(inputObj.name) &&
      isNonEmptyString(inputObj.description) &&
      isNonEmptyString(inputObj.creator);

    if (hasRequiredMetadata) {
      logger.info(
        'InscribeHashinalTool: Required metadata present, skipping form generation'
      );
      return false;
    }

    logger.info(
      'InscribeHashinalTool: Content provided, showing form for metadata collection'
    );
    return true;
  }

  /**
   * Implementation of FormValidatable interface
   * Returns the focused schema for form generation
   */
  getFormSchema(): z.ZodObject<z.ZodRawShape> {
    const focusedSchema = extendZodSchema(
      z.object({
        name: z
          .string()
          .min(1, 'Name is required')
          .describe(
            'Display name for the NFT (e.g., "Sunset Landscape #42", "Digital Abstract Art")'
          ),

        description: z
          .string()
          .min(1, 'Description is required')
          .describe(
            'Meaningful description of the artwork, story, or concept behind this NFT'
          ),

        creator: z
          .string()
          .min(1, 'Creator is required')
          .describe(
            'Creator account ID, artist name, or brand (e.g., "0.0.123456", "ArtistName", "StudioBrand")'
          ),

        attributes: extendZodSchema(
          z.array(
            z.object({
              trait_type: z
                .string()
                .describe('Trait name (e.g., "Rarity", "Color", "Style")'),
              value: z
                .union([z.string(), z.number()])
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .describe('Trait value (e.g., "Epic", "Blue", 85)'),
            })
          )
        )
          .withRender(renderConfigs.array('NFT Attributes', 'Attribute'))
          .optional()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .describe('Collectible traits and characteristics.'),

        type: z
          .string()
          .optional()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .describe(
            'Category or genre of the NFT (e.g., "Digital Art", "Photography", "Collectible Card)'
          ),
      })
    ).withRender({
      fieldType: 'object',
      ui: {
        label: 'Complete NFT Metadata',
        description: 'Provide meaningful metadata to create a valuable NFT',
      },
    });

    return focusedSchema as unknown as z.ZodObject<z.ZodRawShape>;
  }

  /**
   * Implementation of FormValidatable interface
   * Validates metadata quality and provides detailed feedback
   */
  validateMetadataQuality(input: unknown): {
    needsForm: boolean;
    reason: string;
  } {
    const inputObj = input as Record<string, unknown>;
    const hasRequiredMetadata = !!(
      inputObj.name &&
      inputObj.description &&
      inputObj.creator
    );

    if (!hasRequiredMetadata) {
      return {
        needsForm: true,
        reason:
          'Missing essential metadata (name, description, creator) for NFT creation',
      };
    }

    return {
      needsForm: false,
      reason: 'All required metadata fields present',
    };
  }

  protected async executeQuery(
    params: z.infer<typeof inscribeHashinalSchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<InscriptionResponse> {
    if (!params.url && !params.contentRef && !params.base64Data) {
      return createInscriptionError({
        code: 'MISSING_CONTENT',
        details: 'No content source provided',
        suggestions: [
          'Provide a URL to content you want to inscribe',
          'Upload a file and use the content reference',
          'Provide base64-encoded content data',
        ],
      });
    }

    const operatorAccount =
      this.inscriberBuilder[
        'hederaKit'
      ]?.client?.operatorAccountId?.toString() || '0.0.unknown';

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
      attributes: Array.isArray(params.attributes) ? params.attributes : [],
      properties:
        (params.properties as Record<string, unknown> | undefined) || {},
    };

    let validatedMetadata;
    try {
      validatedMetadata = validateHIP412Metadata(rawMetadata);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return createInscriptionError({
        code: 'METADATA_VALIDATION_FAILED',
        details: `Metadata validation error: ${errorMessage}`,
        suggestions: [
          'Ensure all required metadata fields are provided',
          'Check that attribute values are valid',
          'Verify metadata follows HIP-412 standard',
        ],
      });
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
      waitMaxAttempts: 60,
      waitIntervalMs: 5000,
      network: this.inscriberBuilder['hederaKit'].client.network
        .toString()
        .includes('mainnet')
        ? 'mainnet'
        : 'testnet',
      quoteOnly: params.quoteOnly,
    };

    let inscriptionData: InscriptionInput;

    if (params.url) {
      inscriptionData = { type: 'url', url: params.url };
    } else if (params.contentRef || params.base64Data) {
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
    } else {
      throw new Error('No valid input data provided for inscription');
    }

    if (params.quoteOnly) {
      try {
        const quote = await this.generateInscriptionQuote(
          inscriptionData,
          options
        );

        return createInscriptionQuote({
          totalCostHbar: quote.totalCostHbar,
          validUntil: quote.validUntil,
          breakdown: quote.breakdown,
          content: {
            name: params.name,
            creator: params.creator,
            type: params.type,
          },
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to generate inscription quote';
        return createInscriptionError({
          code: 'QUOTE_GENERATION_FAILED',
          details: `Quote generation failed: ${errorMessage}`,
          suggestions: [
            'Check network connectivity',
            'Verify content is accessible',
            'Try again in a moment',
          ],
        });
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
        const imageTopicId = (
          result.inscription as { topic_id?: string; jsonTopicId?: string }
        )?.topic_id;
        const jsonTopicId = (
          result.inscription as { topic_id?: string; jsonTopicId?: string }
        )?.jsonTopicId;
        const network = options.network || 'testnet';

        const cdnUrl = jsonTopicId
          ? `https://kiloscribe.com/api/inscription-cdn/${jsonTopicId}?network=${network}`
          : null;

        const fileStandard = params.fileStandard || '1';
        const hrl = jsonTopicId ? `hcs://${fileStandard}/${jsonTopicId}` : null;
        const standardType = fileStandard === '6' ? 'Dynamic' : 'Static';

        if (!hrl) {
          return createInscriptionError({
            code: 'MISSING_TOPIC_ID',
            details: 'Inscription completed but topic ID is missing',
            suggestions: [
              'Try the inscription again',
              'Contact support if the issue persists',
            ],
          });
        }

        const inscriptionResponse = createInscriptionSuccess({
          hrl,
          topicId: jsonTopicId || imageTopicId || 'unknown',
          standard: standardType as 'Static' | 'Dynamic',
          cdnUrl: cdnUrl || undefined,
          transactionId: (result.result as { transactionId?: string })
            ?.transactionId,
          metadata: {
            name: params.name,
            creator: params.creator,
            description: params.description,
            type: params.type,
            attributes: params.attributes,
          },
        });

        this.onEntityCreated?.({
          entityId: jsonTopicId || imageTopicId || 'unknown',
          entityName: params.name || 'Unnamed Inscription',
          entityType: 'topic',
          transactionId: (result.result as { transactionId?: string })
            ?.transactionId,
        });

        if (params.withHashLinkBlocks) {
          try {
            const blockData = await this.createHashLinkBlock(
              inscriptionResponse,
              inscriptionData.type === 'buffer'
                ? inscriptionData.mimeType
                : undefined
            );

            inscriptionResponse.hashLinkBlock = blockData;
          } catch (blockError) {
            // Log error but don't fail the inscription
            const logger = new Logger({ module: 'InscribeHashinalTool' });
            logger.error('Failed to create HashLink block', {
              error: blockError,
            });
          }
        }

        return inscriptionResponse;
      } else if (!result.quote && !result.confirmed) {
        const imageTopicId = (
          result.inscription as { topic_id?: string; jsonTopicId?: string }
        )?.topic_id;
        const jsonTopicId = (
          result.inscription as { topic_id?: string; jsonTopicId?: string }
        )?.jsonTopicId;

        if (jsonTopicId || imageTopicId) {
          const network = options.network || 'testnet';
          const cdnUrl = jsonTopicId
            ? `https://kiloscribe.com/api/inscription-cdn/${jsonTopicId}?network=${network}`
            : null;

          const fileStandard = params.fileStandard || '1';
          const hrl = jsonTopicId
            ? `hcs://${fileStandard}/${jsonTopicId}`
            : null;
          const standardType = fileStandard === '6' ? 'Dynamic' : 'Static';

          if (hrl) {
            const inscriptionResponse = createInscriptionSuccess({
              hrl,
              topicId: jsonTopicId || imageTopicId || 'unknown',
              standard: standardType as 'Static' | 'Dynamic',
              cdnUrl: cdnUrl || undefined,
              transactionId: (result.result as { transactionId?: string })
                ?.transactionId,
              metadata: {
                name: params.name,
                creator: params.creator,
                description: params.description,
                type: params.type,
                attributes: params.attributes,
              },
            });

            this.onEntityCreated?.({
              entityId: jsonTopicId || imageTopicId || 'unknown',
              entityName: params.name || 'Unnamed Inscription',
              entityType: 'topic',
              transactionId: (result.result as { transactionId?: string })
                ?.transactionId,
            });

            if (params.withHashLinkBlocks) {
              try {
                const blockData = await this.createHashLinkBlock(
                  inscriptionResponse,
                  inscriptionData.type === 'buffer'
                    ? inscriptionData.mimeType
                    : undefined
                );

                inscriptionResponse.hashLinkBlock = blockData;
              } catch (blockError) {
                // Log error but don't fail the inscription
                const logger = new Logger({ module: 'InscribeHashinalTool' });
                logger.error('Failed to create HashLink block', {
                  error: blockError,
                });
              }
            }

            return inscriptionResponse;
          }
        }

        const transactionId =
          (result.result as { transactionId?: string })?.transactionId ||
          'unknown';
        return createInscriptionError({
          code: 'INSCRIPTION_PENDING',
          details: `Inscription submitted but not yet confirmed. Transaction ID: ${transactionId}`,
          suggestions: [
            'Wait a few moments for confirmation',
            'Check the transaction status on a Hedera explorer',
            "Try the inscription again if it doesn't confirm within 5 minutes",
          ],
        });
      } else {
        return createInscriptionError({
          code: 'UNKNOWN_STATE',
          details: 'Inscription completed but result state is unclear',
          suggestions: [
            'Check if the inscription was successful manually',
            'Try the inscription again',
          ],
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to inscribe Hashinal NFT';
      return createInscriptionError({
        code: 'INSCRIPTION_FAILED',
        details: `Inscription failed: ${errorMessage}`,
        suggestions: [
          'Check network connectivity',
          'Verify you have sufficient HBAR balance',
          'Ensure content is accessible and valid',
          'Try again in a moment',
        ],
      });
    }
  }

  /**
   * Creates HashLink block configuration for Hashinal inscriptions.
   * Automatically detects network and selects appropriate block ID configuration.
   * Uses testnet block as fallback for unknown networks or undeployed mainnet blocks.
   *
   * @param response The inscription response containing metadata and network information
   * @param _mimeType Optional MIME type (currently unused, preserved for compatibility)
   * @returns HCS12BlockResult with network-specific block configuration
   *
   * @example
   * ```typescript
   * // Testnet usage (automatic detection from client)
   * const testnetClient = Client.forTestnet();
   * const tool = new InscribeHashinalTool(testnetClient);
   * const block = await tool.createHashLinkBlock(inscriptionResponse);
   * console.log(block.blockId);   // '0.0.6617393'
   * console.log(block.hashLink);  // 'hcs://12/0.0.6617393'
   *
   * // Mainnet usage (automatic detection from client)
   * const mainnetClient = Client.forMainnet();
   * const tool = new InscribeHashinalTool(mainnetClient);
   * const block = await tool.createHashLinkBlock(inscriptionResponse);
   * console.log(block.blockId);   // Network-specific mainnet block ID
   *
   * // HashLink Block Response Structure:
   * {
   *   blockId: string;        // Hedera account ID format (e.g., '0.0.6617393')
   *   hashLink: string;       // HCS-12 URL format: 'hcs://12/{blockId}'
   *   template: string;       // Block template reference matching blockId
   *   attributes: {           // Metadata for client-side processing
   *     name: string;         // Content display name
   *     creator: string;      // Creator account ID
   *     topicId: string;      // HCS topic containing the inscription
   *     hrl: string;          // Hedera Resource Locator
   *     network: string;      // Network type: 'testnet' | 'mainnet'
   *   }
   * }
   *
   * // Render function usage in HashLink blocks:
   * // The block's JavaScript render function receives this structure
   * // and can access network-specific resources through attributes.network
   * ```
   */
  private async createHashLinkBlock(
    response: ReturnType<typeof createInscriptionSuccess>,
    _mimeType?: string
  ): Promise<{
    blockId: string;
    hashLink: string;
    template: string;
    attributes: Record<string, unknown>;
  }> {
    const clientNetwork = this.inscriberBuilder['hederaKit'].client.network
      .toString()
      .includes('mainnet')
      ? 'mainnet'
      : 'testnet';

    const cdnNetwork = response.inscription.cdnUrl?.includes('mainnet')
      ? 'mainnet'
      : 'testnet';

    if (clientNetwork !== cdnNetwork) {
      const logger = new Logger({ module: 'InscribeHashinalTool' });
      logger.warn(
        `Network mismatch detected: client=${clientNetwork}, cdn=${cdnNetwork}. Using client network.`
      );
    }

    const network = clientNetwork;
    const config = getHashLinkBlockId(network);

    return {
      blockId: config.blockId,
      hashLink: config.hashLink,
      template: config.template,
      attributes: {
        name: response.metadata.name || 'Untitled Content',
        creator: response.metadata.creator || '',
        topicId: response.inscription.topicId,
        hrl: response.inscription.hrl,
        network: network,
      },
    };
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

  /**
   * Implementation of FormValidatable interface
   * Returns essential fields that should always be shown in forms
   */
  getEssentialFields(): string[] {
    return ['name', 'description', 'creator', 'attributes'];
  }

  /**
   * Implementation of FormValidatable interface
   * Determines if a field value should be considered empty for this tool
   */
  isFieldEmpty(fieldName: string, value: unknown): boolean {
    if (value === undefined || value === null || value === '') {
      return true;
    }

    if (Array.isArray(value) && value.length === 0) {
      return true;
    }

    if (fieldName === 'attributes' && Array.isArray(value)) {
      return value.every(
        (attr) =>
          !attr ||
          (typeof attr === 'object' && (!attr.trait_type || !attr.value))
      );
    }

    return false;
  }
}
