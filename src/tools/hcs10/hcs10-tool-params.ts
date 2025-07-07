import { HederaAgentKit } from 'hedera-agent-kit';
import type { BasePluginContext } from 'hedera-agent-kit';
import { HCS10Builder } from '../../builders/hcs10/hcs10-builder';

/**
 * Parameters for HCS10 transaction tools
 */
export interface HCS10TransactionToolParams {
  hederaKit: HederaAgentKit;
  hcs10Builder: HCS10Builder;
  logger?: BasePluginContext['logger'];
}

/**
 * Parameters for HCS10 query tools
 */
export interface HCS10QueryToolParams {
  hederaKit: HederaAgentKit;
  hcs10Builder: HCS10Builder;
  logger?: BasePluginContext['logger'];
}
