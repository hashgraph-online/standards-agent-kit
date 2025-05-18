import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { IPluginClient, IPluginStateManager, GenericPluginContext } from '../../../src/plugins/PluginInterface';
import { GenericPlugin } from '../../../src/plugins/GenericPlugin';
import { StructuredTool } from '@langchain/core/tools';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Logger } from '@hashgraphonline/standards-sdk';

/**
 * Example adapter for another platform's client
 */
class ExamplePlatformClient implements IPluginClient {
  private readonly platformClient: Record<string, unknown>;

  constructor(platformClient: Record<string, unknown>) {
    this.platformClient = platformClient;
  }

  getNetwork(): string {
    // Adapt the platform's network info to our interface
    return (this.platformClient.networkInfo as string) || 'example-network';
  }
}

/**
 * Example adapter for another platform's state manager
 */
class ExamplePlatformStateAdapter implements IPluginStateManager {
  private readonly platformState: Record<string, unknown>;

  constructor(platformState: Record<string, unknown>) {
    this.platformState = platformState;
  }

  getCurrentAgent() {
    const currentUser = this.platformState.currentUser as Record<string, unknown> | undefined;
    // Adapt the platform's agent info to our interface
    return {
      name: currentUser?.name as string || 'unknown',
      id: currentUser?.id as string || 'unknown'
    };
  }
}

/**
 * Example of a plugin that would work on any platform
 */
class CrossPlatformPlugin extends GenericPlugin {
  id = 'cross-platform-plugin';
  name = 'Cross Platform Plugin';
  description = 'Works on any platform with proper adapters';
  version = '1.0.0';
  author = 'Test Author';

  getTools(): StructuredTool[] {
    return [
      new DynamicStructuredTool({
        name: 'platform_info',
        description: 'Gets information about current platform',
        schema: z.object({}),
        func: async (): Promise<string> => {
          const network = this.context.client.getNetwork();
          // Safe access to stateManager
          let agent = null;
          if (this.context.stateManager) {
            agent = this.context.stateManager.getCurrentAgent();
          }

          return JSON.stringify({
            network,
            agent,
            pluginId: this.id
          });
        }
      })
    ];
  }
}

describe('Platform Adapter', () => {
  // Mock for a third-party platform client
  const mockThirdPartyClient = {
    networkInfo: 'third-party-network',
    connect: jest.fn(),
    disconnect: jest.fn()
  };

  // Mock for a third-party platform state
  const mockThirdPartyState = {
    currentUser: {
      name: 'External User',
      id: 'ext-123'
    },
    settings: {
      theme: 'dark'
    }
  };

  let clientAdapter: ExamplePlatformClient;
  let stateAdapter: ExamplePlatformStateAdapter;
  let plugin: CrossPlatformPlugin;
  let logger: Logger;

  beforeEach(() => {
    // Create our adapters
    clientAdapter = new ExamplePlatformClient(mockThirdPartyClient);
    stateAdapter = new ExamplePlatformStateAdapter(mockThirdPartyState);
    plugin = new CrossPlatformPlugin();
    logger = new Logger({ module: 'TestLogger' });
  });

  test('Plugin works with platform adapters', async () => {
    // Create a context with our adapters
    const context: GenericPluginContext = {
      client: clientAdapter,
      stateManager: stateAdapter,
      logger,
      config: {}
    };

    // Initialize plugin with adapted context
    await plugin.initialize(context);

    // Verify tools work with adapted context
    const tools = plugin.getTools();
    expect(tools).toHaveLength(1);

    const result = await tools[0].invoke({});
    const parsedResult = JSON.parse(result as string);

    // Verify the plugin can access properly adapted data
    expect(parsedResult.network).toBe('third-party-network');
    expect(parsedResult.agent.name).toBe('External User');
    expect(parsedResult.agent.id).toBe('ext-123');
  });

  test('Adapters translate platform data properly', () => {
    expect(clientAdapter.getNetwork()).toBe('third-party-network');

    const agent = stateAdapter.getCurrentAgent();
    expect(agent.name).toBe('External User');
    expect(agent.id).toBe('ext-123');
  });
});
 