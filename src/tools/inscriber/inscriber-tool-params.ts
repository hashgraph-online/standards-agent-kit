import { HederaAgentKit } from 'hedera-agent-kit';
import type { BasePluginContext } from 'hedera-agent-kit';
import { InscriberBuilder } from '../../builders/inscriber/inscriber-builder';

/**
 * Parameters for Inscriber transaction tools
 */
export interface InscriberTransactionToolParams {
  hederaKit: HederaAgentKit;
  inscriberBuilder: InscriberBuilder;
  logger?: BasePluginContext['logger'];
}

/**
 * Parameters for Inscriber query tools
 */
export interface InscriberQueryToolParams {
  hederaKit: HederaAgentKit;
  inscriberBuilder: InscriberBuilder;
  logger?: BasePluginContext['logger'];
}