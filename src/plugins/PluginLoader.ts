import { PluginContext } from './PluginInterface';
import * as fs from 'fs';
import * as path from 'path';
import { IPlugin } from './PluginInterface';

/**
 * Configuration for loading a plugin
 */
export interface PluginLoadOptions {
  /**
   * Whether to initialize the plugin after loading
   * @default true
   */
  initialize?: boolean;
}

/**
 * Utility for loading plugins from different sources
 */
export class PluginLoader {
  /**
   * Load a plugin from a directory
   * @param directory Path to the directory containing the plugin
   * @param context Context to provide to the plugin during initialization
   * @param options Options for loading the plugin
   * @returns The loaded plugin instance
   */
  static async loadFromDirectory(
    directory: string, 
    context: PluginContext, 
    options: PluginLoadOptions = { initialize: true }
  ): Promise<IPlugin> {
    const manifestPath = path.join(directory, 'plugin.json');
    
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Plugin manifest not found at ${manifestPath}`);
    }
    
    try {
      const manifestContent = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);
      
      // Validate manifest
      if (!manifest.id || !manifest.main) {
        throw new Error('Invalid plugin manifest: missing required fields (id, main)');
      }
      
      // Load the plugin module
      const mainPath = path.join(directory, manifest.main);
      if (!fs.existsSync(mainPath)) {
        throw new Error(`Plugin main file not found at ${mainPath}`);
      }
      
      // Import the plugin module
      const pluginModule = await import(mainPath);
      const PluginClass = pluginModule.default || pluginModule[manifest.id];
      
      if (!PluginClass) {
        throw new Error(`Could not find plugin class in ${mainPath}`);
      }
      
      // Create an instance of the plugin
      const plugin = new PluginClass();
      
      // Validate that it implements the IPlugin interface
      if (!this.isValidPlugin(plugin)) {
        throw new Error(`Plugin does not implement the IPlugin interface correctly`);
      }
      
      // Initialize the plugin if requested
      if (options.initialize) {
        await plugin.initialize(context);
      }
      
      return plugin;
    } catch (error) {
      throw new Error(`Failed to load plugin from directory ${directory}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Load a plugin from an npm package
   * @param packageName Name of the npm package containing the plugin
   * @param context Context to provide to the plugin during initialization
   * @param options Options for loading the plugin
   * @returns The loaded plugin instance
   */
  static async loadFromPackage(
    packageName: string, 
    context: PluginContext, 
    options: PluginLoadOptions = { initialize: true }
  ): Promise<IPlugin> {
    try {
      // Resolve the package path
      const packagePath = require.resolve(packageName);
      const packageDir = path.dirname(packagePath);
      
      return this.loadFromDirectory(packageDir, context, options);
    } catch (error) {
      throw new Error(`Failed to load plugin from package ${packageName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Check if an object implements the IPlugin interface
   * @param obj Object to check
   * @returns true if the object implements IPlugin, false otherwise
   */
  private static isValidPlugin(obj: any): obj is IPlugin {
    return (
      obj &&
      typeof obj.id === 'string' &&
      typeof obj.name === 'string' &&
      typeof obj.description === 'string' &&
      typeof obj.version === 'string' &&
      typeof obj.author === 'string' &&
      typeof obj.initialize === 'function' &&
      typeof obj.getTools === 'function'
    );
  }
}
