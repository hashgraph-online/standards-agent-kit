import {
  HCS10Client,
  PluginRegistry,
  PluginContext,
  StandardNetworkType,
} from '../src';
import WeatherPlugin from './plugins/weather';
import DeFiPlugin from './plugins/defi';
import { Logger } from '@hashgraphonline/standards-sdk';

/**
 * Example demonstrating how to use the plugin system
 */
async function pluginSystemExample(): Promise<void> {
  console.log('Starting plugin system example...');

  try {
    const client = new HCS10Client(
      process.env.HEDERA_OPERATOR_ID!,
      process.env.HEDERA_OPERATOR_KEY!,
      process.env.HEDERA_NETWORK! as StandardNetworkType
    );

    // Create logger
    const logger = Logger.getInstance({
      level: 'debug',
    });

    // Create plugin context
    const context: PluginContext = {
      client,
      logger,
      config: {
        // Add your WeatherAPI key here if you want to test the weather plugin
        // You can get a free API key from https://www.weatherapi.com/
        weatherApiKey: process.env.WEATHER_API_KEY,
      },
    };

    // Initialize plugin registry
    const pluginRegistry = new PluginRegistry(context);

    // Register plugins
    console.log('Registering plugins...');
    await pluginRegistry.registerPlugin(new WeatherPlugin());
    await pluginRegistry.registerPlugin(new DeFiPlugin());

    // Get all registered plugins
    const plugins = pluginRegistry.getAllPlugins();
    console.log(`Registered plugins (${plugins.length}):`);
    plugins.forEach((plugin) => {
      console.log(
        `- ${plugin.name} (${plugin.id}) v${plugin.version} by ${plugin.author}`
      );
    });

    // Get all tools from all plugins
    const tools = pluginRegistry.getAllTools();
    console.log(`\nAvailable tools (${tools.length}):`);
    tools.forEach((tool) => {
      console.log(`- ${tool.name}: ${tool.description}`);
    });

    // Example of using a tool from the weather plugin
    console.log('\nExample: Using the get_current_weather tool');
    const weatherTool = tools.find(
      (tool) => tool.name === 'get_current_weather'
    );
    if (weatherTool) {
      try {
        const result = await weatherTool.invoke({
          location: 'London, UK',
          unit: 'celsius',
        });
        console.log('Result:', result);
      } catch (error) {
        console.error('Error using weather tool:', error);
      }
    } else {
      console.log('Weather tool not found');
    }

    // Example of using a tool from the DeFi plugin
    console.log('\nExample: Using the get_token_price tool');
    const priceTool = tools.find((tool) => tool.name === 'get_token_price');
    if (priceTool) {
      try {
        const result = await priceTool.invoke({
          tokenId: '0.0.1234',
        });
        console.log('Result:', result);
      } catch (error) {
        console.error('Error using price tool:', error);
      }
    } else {
      console.log('Price tool not found');
    }

    // Unregister plugins
    console.log('\nUnregistering plugins...');
    await pluginRegistry.unregisterAllPlugins();
    console.log('All plugins unregistered');
  } catch (error) {
    console.error('Error in plugin system example:', error);
  }
}

// Run the example
pluginSystemExample().catch(console.error);
