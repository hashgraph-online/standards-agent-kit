import { BasePlugin } from './BasePlugin';
import { PluginContext } from './PluginInterface';
import { StructuredTool } from '@langchain/core/tools';

/**
 * Base class for plugins that require HCS10 specific functionality
 */
export abstract class HCS10Plugin extends BasePlugin<PluginContext> {
  /**
   * Get the tools provided by this plugin
   * @returns Array of tools provided by this plugin
   */
  abstract getTools(): StructuredTool[];
}