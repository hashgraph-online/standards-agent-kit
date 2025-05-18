import { IPlugin, BasePluginContext } from './PluginInterface';
import { StructuredTool } from '@langchain/core/tools';

/**
 * Base class for plugins to simplify implementation
 */
export abstract class BasePlugin<T extends BasePluginContext = BasePluginContext> implements IPlugin<T> {
  abstract id: string;
  abstract name: string;
  abstract description: string;
  abstract version: string;
  abstract author: string;

  protected context!: T;

  /**
   * Initialize the plugin with the provided context
   * @param context The context containing shared resources
   */
  async initialize(context: T): Promise<void> {
    this.context = context;
  }

  /**
   * Get the tools provided by this plugin
   * @returns Array of tools provided by this plugin
   */
  abstract getTools(): StructuredTool[];

  /**
   * Clean up resources when the plugin is unloaded
   * Default implementation does nothing
   */
  async cleanup(): Promise<void> {
    // Default implementation does nothing
  }
}
