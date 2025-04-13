import { StructuredTool } from '@langchain/core/tools';
import { HCS10Client } from '../hcs10/HCS10Client';
import { IStateManager } from '../state/state-types';
import { Logger } from '@hashgraphonline/standards-sdk';

/**
 * Context provided to plugins during initialization
 */
export interface PluginContext {
  /**
   * The HCS10Client instance
   */
  client: HCS10Client;
  
  /**
   * Optional state manager
   */
  stateManager?: IStateManager;
  
  /**
   * Logger instance
   */
  logger: Logger;
  
  /**
   * Configuration options
   */
  config: Record<string, any>;
}

/**
 * Standard interface that all plugins must implement
 */
export interface IPlugin {
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
  initialize(context: PluginContext): Promise<void>;
  
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
