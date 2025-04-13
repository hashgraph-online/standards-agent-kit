import { IPlugin, PluginContext } from './PluginInterface';
import { StructuredTool } from '@langchain/core/tools';
import { Logger } from '@hashgraphonline/standards-sdk';

/**
 * Registry for managing plugins in the Standards Agent Kit
 */
export class PluginRegistry {
  private plugins: Map<string, IPlugin> = new Map();
  private context: PluginContext;
  private logger: Logger;
  
  /**
   * Creates a new PluginRegistry instance
   * @param context The context to provide to plugins during initialization
   */
  constructor(context: PluginContext) {
    this.context = context;
    this.logger = context.logger;
  }
  
  /**
   * Register a plugin with the registry
   * @param plugin The plugin to register
   * @throws Error if a plugin with the same ID is already registered
   */
  async registerPlugin(plugin: IPlugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin with ID ${plugin.id} is already registered`);
    }
    
    await plugin.initialize(this.context);
    this.plugins.set(plugin.id, plugin);
    this.logger.info(`Plugin registered: ${plugin.name} (${plugin.id}) v${plugin.version}`);
  }
  
  /**
   * Get a plugin by ID
   * @param id The ID of the plugin to retrieve
   * @returns The plugin, or undefined if not found
   */
  getPlugin(id: string): IPlugin | undefined {
    return this.plugins.get(id);
  }
  
  /**
   * Get all registered plugins
   * @returns Array of all registered plugins
   */
  getAllPlugins(): IPlugin[] {
    return Array.from(this.plugins.values());
  }
  
  /**
   * Get all tools from all registered plugins
   * @returns Array of all tools provided by registered plugins
   */
  getAllTools(): StructuredTool[] {
    return this.getAllPlugins().flatMap(plugin => plugin.getTools());
  }
  
  /**
   * Unregister a plugin
   * @param id The ID of the plugin to unregister
   * @returns true if the plugin was unregistered, false if it wasn't found
   */
  async unregisterPlugin(id: string): Promise<boolean> {
    const plugin = this.plugins.get(id);
    if (!plugin) {
      return false;
    }
    
    if (plugin.cleanup) {
      try {
        await plugin.cleanup();
      } catch (error) {
        this.logger.error(`Error during plugin cleanup: ${error}`);
      }
    }
    
    const result = this.plugins.delete(id);
    if (result) {
      this.logger.info(`Plugin unregistered: ${plugin.name} (${plugin.id})`);
    }
    
    return result;
  }
  
  /**
   * Unregister all plugins
   */
  async unregisterAllPlugins(): Promise<void> {
    const pluginIds = Array.from(this.plugins.keys());
    for (const id of pluginIds) {
      await this.unregisterPlugin(id);
    }
  }
}
