import { HederaAgentKit } from 'hedera-agent-kit';
import type { BasePluginContext } from 'hedera-agent-kit';
import { HCS2Builder } from '../../builders/hcs2/hcs2-builder';

/**
 * Parameters for HCS2 transaction tools
 */
export interface HCS2TransactionToolParams {
  hederaKit: HederaAgentKit;
  hcs2Builder: HCS2Builder;
  logger?: BasePluginContext['logger'];
}

/**
 * Parameters for HCS2 query tools
 */
export interface HCS2QueryToolParams {
  hederaKit: HederaAgentKit;
  hcs2Builder: HCS2Builder;
  logger?: BasePluginContext['logger'];
}