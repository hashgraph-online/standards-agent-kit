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
}