import { StructuredTool } from '@langchain/core/tools';
import { HCS10Client } from '../hcs10/HCS10Client';
import { IStateManager } from '../state/state-types';
import { Logger } from '@hashgraphonline/standards-sdk';

/**
 * Basic client interface required by plugins
 */
export interface IPluginClient {
  getNetwork(): string;
}

/**
 * Basic state manager interface required by plugins
 */
export interface IPluginStateManager {
  getCurrentAgent?(): unknown;
}

/**
 * Base context provided to all plugins during initialization
 */
export interface BasePluginContext {
  /**
   * Logger instance
   */
  logger: Logger;

  /**
   * Configuration options
   */
  config: Record<string, unknown>;
}

/**
 * Context provided to platform-agnostic plugins during initialization
 */
export interface GenericPluginContext extends BasePluginContext {
  /**
   * Generic client interface
   */
  client: IPluginClient;

  /**
   * Optional generic state manager
   */
  stateManager?: IPluginStateManager;
}

/**
 * Context provided to HCS10-specific plugins during initialization
 */
export interface PluginContext extends BasePluginContext {
  /**
   * The HCS10Client instance
   */
  client: HCS10Client;

  /**
   * Optional state manager
   */
  stateManager?: IStateManager;
}

/**
 * Standard interface that all plugins must implement
 */
export interface IPlugin<T extends BasePluginContext = BasePluginContext> {
  /**
   * Unique identifier for the plugin
   */
  id: string;

  /**
   * Human-readable name of the plugin
   */
  name: string;

  /**
   * Description of what the plugin does
   */
  description: string;

  /**
   * Version of the plugin
   */
  version: string;

  /**
   * Author of the plugin
   */
  author: string;

  /**
   * Initialize the plugin with the provided context
   * @param context The context containing shared resources
   */
  initialize(context: T): Promise<void>;

  /**
   * Get the tools provided by this plugin
   * @returns Array of tools provided by this plugin
   */
  getTools(): StructuredTool[];

  /**
   * Clean up resources when the plugin is unloaded
   */
  cleanup?(): Promise<void>;
}
