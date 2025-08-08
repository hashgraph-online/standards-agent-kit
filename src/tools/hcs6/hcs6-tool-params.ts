import { HederaAgentKit } from 'hedera-agent-kit';
import type { BasePluginContext } from 'hedera-agent-kit';
import { HCS6Builder } from '../../builders/hcs6/hcs6-builder';

/**
 * Parameters for HCS6 transaction tools
 */
export interface HCS6TransactionToolParams {
  hederaKit: HederaAgentKit;
  hcs6Builder: HCS6Builder;
  logger?: BasePluginContext['logger'];
}

/**
 * Parameters for HCS6 query tools
 */
export interface HCS6QueryToolParams {
  hederaKit: HederaAgentKit;
  hcs6Builder: HCS6Builder;
  logger?: BasePluginContext['logger'];
}