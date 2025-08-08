import {
  BaseHederaTransactionTool,
  BaseHederaQueryTool,
  BaseServiceBuilder,
} from 'hedera-agent-kit';
import { HCS6Builder } from '../../builders/hcs6/hcs6-builder';
import {
  HCS6TransactionToolParams,
  HCS6QueryToolParams,
} from './hcs6-tool-params';
import { z } from 'zod';

/**
 * Base class for HCS6 transaction tools
 */
export abstract class BaseHCS6TransactionTool<
  T extends z.ZodObject<
    z.ZodRawShape,
    z.UnknownKeysParam,
    z.ZodTypeAny
  > = z.ZodObject<z.ZodRawShape>
> extends BaseHederaTransactionTool<T> {
  protected hcs6Builder: HCS6Builder;
  namespace = 'hcs6' as const;

  constructor(params: HCS6TransactionToolParams) {
    super(params);
    this.hcs6Builder = params.hcs6Builder;
  }

  /**
   * Override to return the HCS6Builder
   */
  protected getServiceBuilder(): BaseServiceBuilder {
    return this.hcs6Builder;
  }
}

/**
 * Base class for HCS6 query tools
 */
export abstract class BaseHCS6QueryTool<
  T extends z.ZodObject<
    z.ZodRawShape,
    z.UnknownKeysParam,
    z.ZodTypeAny
  > = z.ZodObject<z.ZodRawShape>
> extends BaseHederaQueryTool<T> {
  protected hcs6Builder: HCS6Builder;
  namespace = 'hcs6' as const;

  constructor(params: HCS6QueryToolParams) {
    super(params);
    this.hcs6Builder = params.hcs6Builder;
  }

  /**
   * Override to return the HCS6Builder
   */
  protected getServiceBuilder(): BaseServiceBuilder {
    return this.hcs6Builder;
  }
}