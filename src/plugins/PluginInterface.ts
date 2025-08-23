
export { BasePlugin } from 'hedera-agent-kit';
export type {
  IPlugin,
  BasePluginContext,
  GenericPluginContext,
  PluginContext,
  IPluginClient,
  IPluginStateManager,
  HederaTool,
} from 'hedera-agent-kit';

import { HCS10Client } from '../hcs10/HCS10Client';
import { IStateManager } from '../state/state-types';
import { BasePluginContext } from 'hedera-agent-kit';

/**
 * Context provided to HCS10-specific plugins during initialization
 */
export interface HCS10PluginContext extends BasePluginContext {
  /**
   * The HCS10Client instance
   */
  client: HCS10Client;

  /**
   * Optional state manager
   */
  stateManager?: IStateManager;
}
