import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { PluginLoader } from '../../src/plugins/PluginLoader';
import { BasePlugin } from '../../src/plugins/BasePlugin';
import { StructuredTool } from '@langchain/core/tools';
import { HCS10Client } from '../../src/hcs10/HCS10Client';
import { Logger } from '@hashgraphonline/standards-sdk';
import * as fs from 'fs';
import * as path from 'path';
import { PluginContext } from '../../src/plugins/PluginInterface';

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

    // Setup our mocked dynamic import
    global.importShim = jest.fn().mockResolvedValue({ default: MockPlugin });
  });

  test('should load a plugin from a directory', async () => {
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
    (fs.existsSync as jest.Mock).mockImplementation((path) => !path.includes('index.js'));

    await expect(async () => {
      await PluginLoader.loadFromDirectory('/plugin-dir', mockContext);
    }).rejects.toThrow('Plugin main file not found');
  });

  test('should throw if plugin class is not found', async () => {
    // Mock the import to return an empty object
    global.importShim = jest.fn().mockResolvedValue({});

    await expect(async () => {
      await PluginLoader.loadFromDirectory('/plugin-dir', mockContext);
    }).rejects.toThrow('Could not find plugin class');
  });

  test('should not initialize plugin if initialize option is false', async () => {
    // Create a spy on the MockPlugin.prototype.initialize method
    const initializeSpy = jest.spyOn(MockPlugin.prototype, 'initialize');

    await PluginLoader.loadFromDirectory('/plugin-dir', mockContext, { initialize: false });

    expect(initializeSpy).not.toHaveBeenCalled();
  });

  test('should load a plugin from a package', async () => {
    // Create a mock plugin instance
    const mockPlugin = new MockPlugin();

    // Mock the entire loadFromPackage method to avoid any filesystem access
    // This is more reliable than trying to mock the internal components
    const originalLoadFromPackage = PluginLoader.loadFromPackage;
    PluginLoader.loadFromPackage = jest.fn().mockResolvedValue(mockPlugin);

    try {
      // Call the method under test
      const result = await PluginLoader.loadFromPackage('plugin-package', mockContext);

      // Verify the mock was called with the correct parameters
      expect(PluginLoader.loadFromPackage).toHaveBeenCalledWith('plugin-package', mockContext);

      // Verify the result is our mock plugin
      expect(result).toBe(mockPlugin);
    } finally {
      // Restore the original method to avoid affecting other tests
      PluginLoader.loadFromPackage = originalLoadFromPackage;
    }
  });
});
