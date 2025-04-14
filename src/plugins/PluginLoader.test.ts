import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { PluginLoader, PluginContext, IPlugin, BasePlugin } from '../../src/plugins';
import { StructuredTool } from '@langchain/core/tools';
import { HCS10Client } from '../../src/hcs10/HCS10Client';
import { Logger } from '@hashgraphonline/standards-sdk';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs and path modules
jest.mock('fs');
jest.mock('path');

// Mock plugin class
class MockPlugin extends BasePlugin {
  id = 'mock-plugin';
  name = 'Mock Plugin';
  description = 'A mock plugin for testing';
  version = '1.0.0';
  author = 'Test Author';
  
  getTools(): StructuredTool[] {
    return [];
  }
}

describe('PluginLoader', () => {
  let mockContext: PluginContext;
  let mockLogger: Logger;
  let mockClient: HCS10Client;
  
  beforeEach(() => {
    // Reset mocks
    jest.resetAllMocks();
    
    // Setup mocks
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as Logger;
    
    mockClient = {} as HCS10Client;
    
    mockContext = {
      client: mockClient,
      logger: mockLogger,
      config: {}
    };
    
    // Mock path.join to return predictable paths
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
    
    // Mock fs.existsSync to return true by default
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    
    // Mock fs.readFileSync to return a valid manifest
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
      id: 'mock-plugin',
      name: 'Mock Plugin',
      description: 'A mock plugin for testing',
      version: '1.0.0',
      author: 'Test Author',
      main: 'index.js'
    }));
  });
  
  test('should load a plugin from a directory', async () => {
    // Mock the import
    const mockPluginInstance = new MockPlugin();
    jest.mock('/plugin-dir/index.js', () => ({ default: MockPlugin }), { virtual: true });
    
    // Setup import mock
    jest.spyOn(global, 'import').mockResolvedValue({ default: MockPlugin });
    
    const plugin = await PluginLoader.loadFromDirectory('/plugin-dir', mockContext);
    
    expect(fs.existsSync).toHaveBeenCalledWith('/plugin-dir/plugin.json');
    expect(fs.readFileSync).toHaveBeenCalledWith('/plugin-dir/plugin.json', 'utf8');
    expect(path.join).toHaveBeenCalledWith('/plugin-dir', 'index.js');
    expect(plugin).toBeInstanceOf(MockPlugin);
  });
  
  test('should throw if manifest is missing', async () => {
    // Mock fs.existsSync to return false for the manifest
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    
    await expect(async () => {
      await PluginLoader.loadFromDirectory('/plugin-dir', mockContext);
    }).rejects.toThrow('Plugin manifest not found');
  });
  
  test('should throw if manifest is invalid', async () => {
    // Mock fs.readFileSync to return an invalid manifest
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
      // Missing required fields
      name: 'Mock Plugin'
    }));
    
    await expect(async () => {
      await PluginLoader.loadFromDirectory('/plugin-dir', mockContext);
    }).rejects.toThrow('Invalid plugin manifest');
  });
  
  test('should throw if main file is missing', async () => {
    // Mock fs.existsSync to return true for manifest but false for main file
    (fs.existsSync as jest.Mock).mockImplementation((path) => {
      return !path.includes('index.js');
    });
    
    await expect(async () => {
      await PluginLoader.loadFromDirectory('/plugin-dir', mockContext);
    }).rejects.toThrow('Plugin main file not found');
  });
  
  test('should throw if plugin class is not found', async () => {
    // Mock the import to return an empty object
    jest.spyOn(global, 'import').mockResolvedValue({});
    
    await expect(async () => {
      await PluginLoader.loadFromDirectory('/plugin-dir', mockContext);
    }).rejects.toThrow('Could not find plugin class');
  });
  
  test('should not initialize plugin if initialize option is false', async () => {
    // Create a spy on the MockPlugin.prototype.initialize method
    const initializeSpy = jest.spyOn(MockPlugin.prototype, 'initialize');
    
    // Mock the import
    jest.spyOn(global, 'import').mockResolvedValue({ default: MockPlugin });
    
    await PluginLoader.loadFromDirectory('/plugin-dir', mockContext, { initialize: false });
    
    expect(initializeSpy).not.toHaveBeenCalled();
  });
  
  test('should load a plugin from a package', async () => {
    // Mock require.resolve
    jest.spyOn(require, 'resolve').mockReturnValue('/node_modules/plugin-package/index.js');
    
    // Mock path.dirname
    (path.dirname as jest.Mock).mockReturnValue('/node_modules/plugin-package');
    
    // Mock the loadFromDirectory method
    const loadFromDirectorySpy = jest.spyOn(PluginLoader, 'loadFromDirectory').mockResolvedValue(new MockPlugin());
    
    await PluginLoader.loadFromPackage('plugin-package', mockContext);
    
    expect(require.resolve).toHaveBeenCalledWith('plugin-package');
    expect(path.dirname).toHaveBeenCalledWith('/node_modules/plugin-package/index.js');
    expect(loadFromDirectorySpy).toHaveBeenCalledWith('/node_modules/plugin-package', mockContext, { initialize: true });
  });
});
