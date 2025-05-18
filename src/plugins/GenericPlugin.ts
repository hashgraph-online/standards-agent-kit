import { BasePlugin } from './BasePlugin';
import { GenericPluginContext } from './PluginInterface';
import { StructuredTool } from '@langchain/core/tools';

/**
 * Base class for platform-agnostic plugins that can be used across different implementations
 */
export abstract class GenericPlugin extends BasePlugin<GenericPluginContext> {
  /**
   * Get the tools provided by this plugin
   * @returns Array of tools provided by this plugin
   */
  abstract getTools(): StructuredTool[];
}