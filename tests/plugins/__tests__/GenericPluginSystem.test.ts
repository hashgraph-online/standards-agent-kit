import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { GenericPlugin } from '../../../src/plugins/GenericPlugin';
import { HCS10Plugin } from '../../../src/plugins/HCS10Plugin';
import {
  IPluginClient,
  GenericPluginContext,
  PluginContext,
  IPluginStateManager
} from '../../../src/plugins/PluginInterface';
import { StructuredTool } from '@langchain/core/tools';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Logger } from '@hashgraphonline/standards-sdk';
import { HCS10Client } from '../../../src/hcs10/HCS10Client';

// Mock implementations for testing
class MockGenericClient implements IPluginClient {
  getNetwork(): string {
    return 'mock-network';
  }
}

class MockStateManager implements IPluginStateManager {
  getCurrentAgent() {
    return { name: 'mock-agent' };
  }
}

// Mock HCS10Client for testing HCS10Plugin
jest.mock('../../../src/hcs10/HCS10Client');

// Test plugins
class TestGenericPlugin extends GenericPlugin {
  id = 'test-generic-plugin';
  name = 'Test Generic Plugin';
  description = 'A plugin for testing';
  version = '1.0.0';
  author = 'Test Author';

  initializeCalled = false;

  async initialize(context: GenericPluginContext): Promise<void> {
    await super.initialize(context);
    this.initializeCalled = true;
  }

  getTools(): StructuredTool[] {
    return [
      new DynamicStructuredTool({
        name: 'test_tool',
        description: 'A test tool',
        schema: z.object({
          input: z.string().describe('Input parameter'),
        }),
        func: async ({ input }: { input: string }): Promise<string> =>
          `Processed: ${input} on ${this.context.client.getNetwork()}`
      }),
    ];
  }
}

class TestHCS10Plugin extends HCS10Plugin {
  id = 'test-hcs10-plugin';
  name = 'Test HCS10 Plugin';
  description = 'A HCS10-specific plugin for testing';
  version = '1.0.0';
  author = 'Test Author';

  getTools(): StructuredTool[] {
    return [
      new DynamicStructuredTool({
        name: 'hcs10_test_tool',
        description: 'An HCS10 test tool',
        schema: z.object({
          input: z.string().describe('Input parameter'),
        }),
        func: async ({ input }: { input: string }): Promise<string> =>
          `HCS10 Processed: ${input}`
      }),
    ];
  }
}

describe('Generic Plugin System', () => {
  let genericPlugin: TestGenericPlugin;
  let hcs10Plugin: TestHCS10Plugin;
  let logger: Logger;
  let genericClient: MockGenericClient;
  let stateManager: MockStateManager;
  let mockHcs10Client: HCS10Client;

  beforeEach(() => {
    // Set up common test objects
    logger = new Logger({ module: 'TestLogger' });
    genericClient = new MockGenericClient();
    stateManager = new MockStateManager();

    // Create a fresh instance of each plugin for each test
    genericPlugin = new TestGenericPlugin();
    hcs10Plugin = new TestHCS10Plugin();

    // Mock HCS10Client
    jest.clearAllMocks();
    mockHcs10Client = {
      getNetwork: jest.fn().mockReturnValue('mock-hedera-network')
    } as unknown as HCS10Client;
  });

  test('GenericPlugin initializes correctly', async () => {
    const context: GenericPluginContext = {
      logger,
      client: genericClient,
      stateManager,
      config: { testConfig: 'value' }
    };

    await genericPlugin.initialize(context);

    expect(genericPlugin.initializeCalled).toBe(true);
    expect(genericPlugin['context']).toBe(context);
  });

  test('GenericPlugin provides tools', async () => {
    const context: GenericPluginContext = {
      logger,
      client: genericClient,
      stateManager,
      config: {}
    };

    await genericPlugin.initialize(context);
    const tools = genericPlugin.getTools();

    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('test_tool');
  });

  test('GenericPlugin tool executes correctly', async () => {
    const context: GenericPluginContext = {
      logger,
      client: genericClient,
      stateManager,
      config: {}
    };

    await genericPlugin.initialize(context);
    const tools = genericPlugin.getTools();
    const result = await tools[0].invoke({ input: 'test-input' });

    expect(result).toBe('Processed: test-input on mock-network');
  });

  test('HCS10Plugin initializes correctly', async () => {
    const context: PluginContext = {
      logger,
      client: mockHcs10Client,
      config: { hcsConfig: 'value' }
    };

    await hcs10Plugin.initialize(context);
    expect(hcs10Plugin['context']).toBe(context);
  });

  test('HCS10Plugin provides HCS10-specific tools', async () => {
    const context: PluginContext = {
      logger,
      client: mockHcs10Client,
      config: {}
    };

    await hcs10Plugin.initialize(context);
    const tools = hcs10Plugin.getTools();

    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('hcs10_test_tool');
  });

  test('HCS10Plugin tool executes correctly', async () => {
    const context: PluginContext = {
      logger,
      client: mockHcs10Client,
      config: {}
    };

    await hcs10Plugin.initialize(context);
    const tools = hcs10Plugin.getTools();
    const result = await tools[0].invoke({ input: 'hcs-input' });

    expect(result).toBe('HCS10 Processed: hcs-input');
  });
});