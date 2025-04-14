# Plugin System for Standards Agent Kit

This pull request adds a plugin system to the Standards Agent Kit, enabling contributors to extend the kit with their own integrations such as DeFi protocols or web2 services.

## Features

- **Plugin Registry**: Central system for registering, discovering, and loading plugins
- **Plugin Interface**: Standard interface that all plugins must implement
- **Plugin Loader**: Mechanism to dynamically load plugins at runtime
- **Plugin Context**: Shared context that provides access to the HCS10Client and other resources
- **Sample Plugins**: Example implementations for Weather API and DeFi integrations
- **Comprehensive Tests**: Unit tests for all plugin system components

## Usage

```typescript
import { HCS10Client, PluginRegistry, PluginContext, Logger } from '@hashgraphonline/standards-agent-kit';
import WeatherPlugin from './plugins/weather';
import DeFiPlugin from './plugins/defi';

// Initialize HCS10Client
const client = new HCS10Client({
  operatorId: process.env.HEDERA_ACCOUNT_ID,
  operatorKey: process.env.HEDERA_PRIVATE_KEY,
  network: 'testnet'
});

// Create plugin context
const context: PluginContext = {
  client,
  logger: Logger.getInstance(),
  config: {
    // Configuration options for plugins
    weatherApiKey: process.env.WEATHER_API_KEY,
  }
};

// Initialize plugin registry
const pluginRegistry = new PluginRegistry(context);

// Register plugins
await pluginRegistry.registerPlugin(new WeatherPlugin());
await pluginRegistry.registerPlugin(new DeFiPlugin());

// Get all tools from all plugins
const pluginTools = pluginRegistry.getAllTools();

// Use these tools with your agent
const agent = createOpenAIToolsAgent({
  llm,
  tools: [...standardTools, ...pluginTools],
  prompt
});
```

## Creating a Plugin

To create a plugin, implement the `IPlugin` interface or extend the `BasePlugin` class:

```typescript
import { BasePlugin, StructuredTool } from '@hashgraphonline/standards-agent-kit';
import { z } from 'zod';

class MyCustomTool extends StructuredTool {
  name = 'my_custom_tool';
  description = 'Does something awesome';
  
  schema = z.object({
    param1: z.string().describe('First parameter'),
    param2: z.number().describe('Second parameter'),
  });
  
  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    // Implement your tool logic here
    return `Processed ${input.param1} with value ${input.param2}`;
  }
}

export default class MyPlugin extends BasePlugin {
  id = 'my-plugin';
  name = 'My Custom Plugin';
  description = 'Provides custom functionality';
  version = '1.0.0';
  author = 'Your Name';
  
  getTools(): StructuredTool[] {
    return [new MyCustomTool()];
  }
}
```

## Example Plugins

This PR includes two example plugins:

1. **Weather API Plugin**: Demonstrates integration with external web services
2. **DeFi Integration Plugin**: Shows how to implement Hedera-specific functionality

These examples serve as templates for contributors who want to create their own plugins.

## Testing

The plugin system includes comprehensive unit tests using Jest with SWC for fast TypeScript testing. Run the tests with:

```bash
npm test
```

## Integration with Existing Code

The plugin system is designed to work seamlessly with the existing Standards Agent Kit architecture:

- In CLI applications, you can register plugins and add their tools to your tool collection
- In LangChain applications, you can add plugin tools to your agent's tool list
- All plugins use the same context and client instances as your main application

## Future Enhancements

Potential future enhancements for the plugin system:

1. Plugin discovery from npm registry
2. Plugin versioning and compatibility checking
3. Plugin configuration UI
4. Plugin marketplace integration
