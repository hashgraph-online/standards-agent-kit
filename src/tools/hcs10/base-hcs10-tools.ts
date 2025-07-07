import {
  BaseHederaTransactionTool,
  BaseHederaQueryTool,
  BaseServiceBuilder,
} from 'hedera-agent-kit';
import { HCS10Builder } from '../../builders/hcs10/hcs10-builder';
import {
  HCS10TransactionToolParams,
  HCS10QueryToolParams,
} from './hcs10-tool-params';
import { z } from 'zod';

/**
 * Base class for HCS10 transaction tools
 */
export abstract class BaseHCS10TransactionTool<
  T extends z.ZodObject<
    z.ZodRawShape,
    z.UnknownKeysParam,
    z.ZodTypeAny
  > = z.ZodObject<z.ZodRawShape>
> extends BaseHederaTransactionTool<T> {
  protected hcs10Builder: HCS10Builder;
  namespace = 'hcs10' as const;

  constructor(params: HCS10TransactionToolParams) {
    super(params);
    this.hcs10Builder = params.hcs10Builder;
  }

  /**
   * Override to return the HCS10Builder
   */
  protected getServiceBuilder(): BaseServiceBuilder {
    return this.hcs10Builder;
  }
}

/**
 * Base class for HCS10 query tools
 */
export abstract class BaseHCS10QueryTool<
  T extends z.ZodObject<
    z.ZodRawShape,
    z.UnknownKeysParam,
    z.ZodTypeAny,
    Record<string, unknown>,
    Record<string, unknown>
  > = z.ZodObject<z.ZodRawShape>
> extends BaseHederaQueryTool<T> {
  protected hcs10Builder: HCS10Builder;
  namespace = 'hcs10' as const;

  constructor(params: HCS10QueryToolParams) {
    super(params);
    this.hcs10Builder = params.hcs10Builder;
  }

  /**
   * Override to return the HCS10Builder
   */
  protected getServiceBuilder(): BaseServiceBuilder {
    return this.hcs10Builder;
  }
}
