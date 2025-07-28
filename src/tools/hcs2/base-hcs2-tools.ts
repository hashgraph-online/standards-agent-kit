import {
  BaseHederaTransactionTool,
  BaseHederaQueryTool,
  BaseServiceBuilder,
} from 'hedera-agent-kit';
import { HCS2Builder } from '../../builders/hcs2/hcs2-builder';
import {
  HCS2TransactionToolParams,
  HCS2QueryToolParams,
} from './hcs2-tool-params';
import { z } from 'zod';

/**
 * Base class for HCS2 transaction tools
 */
export abstract class BaseHCS2TransactionTool<
  T extends z.ZodObject<
    z.ZodRawShape,
    z.UnknownKeysParam,
    z.ZodTypeAny
  > = z.ZodObject<z.ZodRawShape>
> extends BaseHederaTransactionTool<T> {
  protected hcs2Builder: HCS2Builder;
  namespace = 'hcs2' as const;

  constructor(params: HCS2TransactionToolParams) {
    super(params);
    this.hcs2Builder = params.hcs2Builder;
  }

  /**
   * Override to return the HCS2Builder
   */
  protected getServiceBuilder(): BaseServiceBuilder {
    return this.hcs2Builder;
  }
}

/**
 * Base class for HCS2 query tools
 */
export abstract class BaseHCS2QueryTool<
  T extends z.ZodObject<
    z.ZodRawShape,
    z.UnknownKeysParam,
    z.ZodTypeAny
  > = z.ZodObject<z.ZodRawShape>
> extends BaseHederaQueryTool<T> {
  protected hcs2Builder: HCS2Builder;
  namespace = 'hcs2' as const;

  constructor(params: HCS2QueryToolParams) {
    super(params);
    this.hcs2Builder = params.hcs2Builder;
  }

  /**
   * Override to return the HCS2Builder
   */
  protected getServiceBuilder(): BaseServiceBuilder {
    return this.hcs2Builder;
  }
}