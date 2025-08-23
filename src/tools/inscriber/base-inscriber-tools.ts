import {
  BaseHederaTransactionTool,
  BaseHederaQueryTool,
  BaseServiceBuilder,
} from 'hedera-agent-kit';
import { InscriberBuilder } from '../../builders/inscriber/inscriber-builder';
import {
  InscriberTransactionToolParams,
  InscriberQueryToolParams,
} from './inscriber-tool-params';
import type { ContentResolverInterface } from '../../types/content-resolver';
import {
  InscriptionInput,
  InscriptionOptions,
  QuoteResult,
} from '@hashgraphonline/standards-sdk';
import { z } from 'zod';

/**
 * Base class for Inscriber transaction tools
 */
export abstract class BaseInscriberTransactionTool<
  T extends z.ZodObject<
    z.ZodRawShape,
    z.UnknownKeysParam,
    z.ZodTypeAny
  > = z.ZodObject<z.ZodRawShape>
> extends BaseHederaTransactionTool<T> {
  protected inscriberBuilder: InscriberBuilder;
  protected contentResolver: ContentResolverInterface | null;
  namespace = 'inscriber' as const;

  constructor(params: InscriberTransactionToolParams) {
    super(params);
    this.inscriberBuilder = params.inscriberBuilder;
    this.contentResolver = params.contentResolver || null;
  }

  /**
   * Override to return the InscriberBuilder
   */
  protected getServiceBuilder(): BaseServiceBuilder {
    return this.inscriberBuilder;
  }

  /**
   * Get content resolver with fallback to registry
   */
  protected getContentResolver(): ContentResolverInterface | null {
    return this.contentResolver;
  }

  /**
   * Generate a quote for an inscription without executing it
   * @param input - The inscription input data
   * @param options - Inscription options
   * @returns Promise containing the quote result
   */
  protected async generateInscriptionQuote(
    input: InscriptionInput,
    options: InscriptionOptions
  ): Promise<QuoteResult> {
    const network = this.inscriberBuilder['hederaKit'].client.network;
    const networkType = network.toString().includes('mainnet')
      ? 'mainnet'
      : 'testnet';

    const quoteOptions = {
      ...options,
      quoteOnly: true,
      network: networkType as 'mainnet' | 'testnet',
    };

    const result = await this.inscriberBuilder.inscribe(input, quoteOptions);

    if (!result.quote || result.confirmed) {
      throw new Error('Failed to generate quote - unexpected response type');
    }

    return result.result as QuoteResult;
  }
}

/**
 * Base class for Inscriber query tools
 */
export abstract class BaseInscriberQueryTool<
  T extends z.ZodObject<
    z.ZodRawShape,
    z.UnknownKeysParam,
    z.ZodTypeAny
  > = z.ZodObject<z.ZodRawShape>
> extends BaseHederaQueryTool<T> {
  protected inscriberBuilder: InscriberBuilder;
  protected contentResolver: ContentResolverInterface | null;
  namespace = 'inscriber' as const;

  constructor(params: InscriberQueryToolParams) {
    super(params);
    this.inscriberBuilder = params.inscriberBuilder;
    this.contentResolver = params.contentResolver || null;
  }

  /**
   * Override to return the InscriberBuilder
   */
  protected getServiceBuilder(): BaseServiceBuilder {
    return this.inscriberBuilder;
  }

  /**
   * Get content resolver with fallback to registry
   */
  protected getContentResolver(): ContentResolverInterface | null {
    return this.contentResolver;
  }

  /**
   * Generate a quote for an inscription without executing it
   * @param input - The inscription input data
   * @param options - Inscription options
   * @returns Promise containing the quote result
   */
  protected async generateInscriptionQuote(
    input: InscriptionInput,
    options: InscriptionOptions
  ): Promise<QuoteResult> {
    const network = this.inscriberBuilder['hederaKit'].client.network;
    const networkType = network.toString().includes('mainnet')
      ? 'mainnet'
      : 'testnet';

    const quoteOptions = {
      ...options,
      quoteOnly: true,
      network: networkType as 'mainnet' | 'testnet',
    };

    const result = await this.inscriberBuilder.inscribe(input, quoteOptions);

    if (!result.quote || result.confirmed) {
      throw new Error('Failed to generate quote - unexpected response type');
    }

    return result.result as QuoteResult;
  }
}