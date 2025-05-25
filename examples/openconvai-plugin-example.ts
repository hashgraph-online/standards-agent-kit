import * as dotenv from 'dotenv';
import { HCS10Client, StandardNetworkType } from '../src/hcs10/HCS10Client';
import { OpenConvAIPlugin } from '../src/plugins/openconvai/OpenConvAIPlugin';
import { PluginRegistry } from '../src/plugins/PluginRegistry';
import { PluginContext } from '../src/plugins/PluginInterface';
import { OpenConvaiState } from '../src/state/open-convai-state';
import { Logger } from '@hashgraphonline/standards-sdk';

dotenv.config();

/**
 * Example demonstrating how to use the OpenConvAIPlugin
 * This plugin provides all the tools from standards-agent-kit
 */
async function openConvAIPluginExample(): Promise<void> {
  console.log('Starting OpenConvAI Plugin example...');

  try {
    const operatorId = process.env.HEDERA_OPERATOR_ID;
    const operatorKey = process.env.HEDERA_OPERATOR_KEY;
    const network = (process.env.HEDERA_NETWORK || 'testnet') as StandardNetworkType;

    if (!operatorId || !operatorKey) {
      throw new Error('HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set in environment variables');
    }

    const client = new HCS10Client(operatorId, operatorKey, network);
    const stateManager = new OpenConvaiState();
    const logger = new Logger({ module: 'OpenConvAIPluginExample' });

    const context: PluginContext = {
      client,
      logger,
      stateManager,
      config: {
        registryUrl: process.env.REGISTRY_URL || 'https://moonscape.tech',
      },
    };

    const pluginRegistry = new PluginRegistry(context);

    console.log('Registering OpenConvAI Plugin...');
    const openConvAIPlugin = new OpenConvAIPlugin();
    await pluginRegistry.registerPlugin(openConvAIPlugin);

    const plugins = pluginRegistry.getAllPlugins();
    console.log(`Registered plugins (${plugins.length}):`);
    plugins.forEach((plugin) => {
      console.log(`- ${plugin.name} (${plugin.id}) v${plugin.version} by ${plugin.author}`);
      console.log(`  Namespace: ${(plugin as OpenConvAIPlugin).namespace || 'N/A'}`);
    });

    const tools = pluginRegistry.getAllTools();
    console.log(`\nAvailable tools from OpenConvAI Plugin (${tools.length}):`);
    tools.forEach((tool) => {
      console.log(`- ${tool.name}: ${tool.description}`);
    });

    console.log('\nExample: Using the find_registrations tool');
    const findRegistrationsTool = tools.find(
      (tool) => tool.name === 'find_registrations'
    );

    if (findRegistrationsTool) {
      try {
        const result = await findRegistrationsTool.invoke({
          tags: ['ai-agent'],
        });
        console.log('Find registrations result:', result);
      } catch (error) {
        console.error('Error using find_registrations tool:', error);
      }
    } else {
      console.log('find_registrations tool not found');
    }

    console.log('\nExample: Using the register_agent tool');
    const registerAgentTool = tools.find(
      (tool) => tool.name === 'register_agent'
    );

    if (registerAgentTool) {
      console.log('register_agent tool is available and ready to use');
      console.log('Tool description:', registerAgentTool.description);
    } else {
      console.log('register_agent tool not found');
    }

    await pluginRegistry.unregisterAllPlugins();
    console.log('All plugins unregistered');

  } catch (error) {
    console.error('Error in OpenConvAI Plugin example:', error);
  }
}

openConvAIPluginExample().catch(console.error); 