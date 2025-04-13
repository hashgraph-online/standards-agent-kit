import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { PluginRegistry, PluginContext, BasePlugin, IPlugin } from '../../src/plugins';
import { StructuredTool } from '@langchain/core/tools';
import { HCS10Client } from '../../src/hcs10/HCS10Client';
import { Logger } from '@hashgraphonline/standards-sdk';

// Mock classes
class MockTool extends StructuredTool {
  name = 'mock_tool';
  description = 'A mock tool for testing';
  
  async _call(): Promise<string> {
    return 'Mock tool result';
  }
}

class MockPlugin extends BasePlugin {
  id = 'mock-plugin';
  name = 'Mock Plugin';
  description = 'A mock plugin for testing';
  version = '1.0.0';
  author = 'Test Author';
  
  initialize = jest.fn(async (context: PluginContext) => {
    await super.initialize(context);
  });
  
  getTools = jest.fn(() => {
    return [new MockTool()];
  });
  
  cleanup = jest.fn(async () => {
    // Mock cleanup
  });
}

describe('PluginRegistry', () => {
  let registry: PluginRegistry;
  let mockPlugin: MockPlugin;
  let mockContext: PluginContext;
  let mockLogger: Logger;
  let mockClient: HCS10Client;
  
  beforeEach(() => {
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
    
    registry = new PluginRegistry(mockContext);
    mockPlugin = new MockPlugin();
  });
  
  test('should register a plugin', async () => {
    await registry.registerPlugin(mockPlugin);
    
    expect(mockPlugin.initialize).toHaveBeenCalledWith(mockContext);
    expect(registry.getPlugin('mock-plugin')).toBe(mockPlugin);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Plugin registered')
    );
  });
  
  test('should throw when registering a duplicate plugin', async () => {
    await registry.registerPlugin(mockPlugin);
    
    await expect(async () => {
      await registry.registerPlugin(mockPlugin);
    }).rejects.toThrow('already registered');
  });
  
  test('should get all plugins', async () => {
    await registry.registerPlugin(mockPlugin);
    
    const plugins = registry.getAllPlugins();
    expect(plugins).toHaveLength(1);
    expect(plugins[0]).toBe(mockPlugin);
  });
  
  test('should get all tools from all plugins', async () => {
    await registry.registerPlugin(mockPlugin);
    
    const tools = registry.getAllTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('mock_tool');
    expect(mockPlugin.getTools).toHaveBeenCalled();
  });
  
  test('should unregister a plugin', async () => {
    await registry.registerPlugin(mockPlugin);
    
    const result = await registry.unregisterPlugin('mock-plugin');
    expect(result).toBe(true);
    expect(mockPlugin.cleanup).toHaveBeenCalled();
    expect(registry.getPlugin('mock-plugin')).toBeUndefined();
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Plugin unregistered')
    );
  });
  
  test('should return false when unregistering a non-existent plugin', async () => {
    const result = await registry.unregisterPlugin('non-existent');
    expect(result).toBe(false);
  });
  
  test('should handle cleanup errors gracefully', async () => {
    await registry.registerPlugin(mockPlugin);
    
    // Make cleanup throw an error
    mockPlugin.cleanup.mockImplementation(() => {
      throw new Error('Cleanup error');
    });
    
    const result = await registry.unregisterPlugin('mock-plugin');
    expect(result).toBe(true);
    expect(mockPlugin.cleanup).toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error during plugin cleanup')
    );
  });
  
  test('should unregister all plugins', async () => {
    const mockPlugin2 = new MockPlugin();
    mockPlugin2.id = 'mock-plugin-2';
    
    await registry.registerPlugin(mockPlugin);
    await registry.registerPlugin(mockPlugin2);
    
    await registry.unregisterAllPlugins();
    
    expect(registry.getAllPlugins()).toHaveLength(0);
    expect(mockPlugin.cleanup).toHaveBeenCalled();
    expect(mockPlugin2.cleanup).toHaveBeenCalled();
  });
});
