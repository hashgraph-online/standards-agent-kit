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
  namespace = 'inscriber' as const;

  constructor(params: InscriberTransactionToolParams) {
    super(params);
    this.inscriberBuilder = params.inscriberBuilder;
  }

  /**
   * Override to return the InscriberBuilder
   */
  protected getServiceBuilder(): BaseServiceBuilder {
    return this.inscriberBuilder;
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
  namespace = 'inscriber' as const;

  constructor(params: InscriberQueryToolParams) {
    super(params);
    this.inscriberBuilder = params.inscriberBuilder;
  }

  /**
   * Override to return the InscriberBuilder
   */
  protected getServiceBuilder(): BaseServiceBuilder {
    return this.inscriberBuilder;
  }
}