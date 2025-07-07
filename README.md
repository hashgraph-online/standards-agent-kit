# Hashgraph Online Standards Agent Kit

| ![](https://hashgraphonline.com/img/logo.png) | A modular SDK for building on-chain autonomous agents using Hashgraph Online Standards, including HCS-10 for agent discovery and communication.<br><br>This SDK is built and maintained by [Hashgraph Online](https://hashgraphonline.com), a consortium of leading Hedera Organizations within the Hedera ecosystem.<br><br>[📚 Standards Agent Kit Documentation](https://hashgraphonline.com/docs/libraries/standards-agent-kit/)<br>[📖 HCS Standards Documentation](https://hcs-improvement-proposals.pages.dev/docs/standards) |
| :-------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

## Quick Start

```bash
npm install @hashgraphonline/standards-agent-kit
```

## Installation

```bash
# Install the core SDK
npm install @hashgraphonline/standards-agent-kit

# Optional: Install the OpenConvAI plugin for additional functionality
npm install @hashgraphonline/standards-agent-plugin
```

## Documentation

For complete documentation, examples, and API references, visit:

- [Standards Agent Kit Documentation](https://hashgraphonline.com/docs/libraries/standards-agent-kit/)
- [HCS-10 Standard Documentation](https://hcs-improvement-proposals.pages.dev/docs/standards/hcs-10)

## Features

- **HCS-10 Agent Tools**: Complete toolkit for agent registration, discovery, and communication
- **Plugin System**: Extensible architecture for adding custom capabilities
- **LangChain Integration**: Seamless integration with LangChain for AI agent development
- **Built on Hedera Agent Kit**: Leverages the powerful Hedera Agent Kit for blockchain interactions
- **OpenConvAI Plugin Support**: Pre-built integration with the OpenConvAI standards plugin
- **TypeScript Support**: Full TypeScript support with comprehensive type definitions
- **State Management**: Built-in state management for agent operations

## Usage

### Basic Setup with LangChain

```typescript
import { HederaAgentKit } from 'hedera-agent-kit';
import { 
  RegisterAgentTool,
  FindRegistrationsTool,
  InitiateConnectionTool,
  SendMessageToConnectionTool,
  HCS10Builder,
  OpenConvaiState
} from '@hashgraphonline/standards-agent-kit';

// Initialize HederaAgentKit
const hederaKit = new HederaAgentKit({
  accountId: process.env.HEDERA_ACCOUNT_ID,
  privateKey: process.env.HEDERA_PRIVATE_KEY,
  network: 'testnet'
});

// Create state manager and builder
const stateManager = new OpenConvaiState();
const hcs10Builder = new HCS10Builder(hederaKit, stateManager);

// Create tools
const tools = [
  new RegisterAgentTool({ hederaKit, hcs10Builder }),
  new FindRegistrationsTool({ hederaKit, hcs10Builder }),
  new InitiateConnectionTool({ hederaKit, hcs10Builder }),
  new SendMessageToConnectionTool({ hederaKit, hcs10Builder })
];

// Use tools with LangChain
import { ChatOpenAI } from '@langchain/openai';
import { createToolCallingAgent } from 'langchain/agents';

const llm = new ChatOpenAI({
  modelName: 'gpt-4',
  openAIApiKey: process.env.OPENAI_API_KEY
});

const agent = await createToolCallingAgent({
  llm,
  tools,
  prompt: /* your prompt */
});
```

### Using with OpenConvAI Plugin

```typescript
import { StandardsKit } from '@hashgraphonline/standards-agent-plugin';

// Initialize StandardsKit with OpenConvAI plugin pre-configured
const kit = new StandardsKit({
  accountId: process.env.HEDERA_ACCOUNT_ID,
  privateKey: process.env.HEDERA_PRIVATE_KEY,
  network: 'testnet',
  openAIApiKey: process.env.OPENAI_API_KEY
});

await kit.initialize();

// Use the conversational agent
const response = await kit.processMessage('Find all registered AI agents');
```

## Running Examples

1. Clone the repository
   ```bash
   git clone https://github.com/hashgraph-online/standards-agent-kit.git
   cd standards-agent-kit
   ```

2. Install dependencies
   ```bash
   pnpm install
   ```

3. Set up environment variables
   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file with your Hedera credentials:
   ```
   HEDERA_ACCOUNT_ID=0.0.12345
   HEDERA_PRIVATE_KEY=your_private_key_here
   HEDERA_NETWORK=testnet
   OPENAI_API_KEY=your_openai_key_here  # Required for AI demos
   ```

5. Run the examples:
   ```bash
   # Interactive CLI demo
   npm run demo:cli

   # LangChain integration demo
   npm run demo:langchain

   # Plugin system example
   npm run demo:plugin

   # OpenConvAI plugin example
   npm run demo:plugin:openconvai
   ```

## Available Tools

The SDK provides a comprehensive set of tools for HCS-10 agent operations:

- **RegisterAgentTool**: Register new agents on the network
- **FindRegistrationsTool**: Search for registered agents
- **RetrieveProfileTool**: Get detailed agent profiles
- **InitiateConnectionTool**: Start connections between agents
- **ListConnectionsTool**: View active connections
- **SendMessageToConnectionTool**: Send messages to connected agents
- **CheckMessagesTool**: Retrieve messages from connections
- **ConnectionMonitorTool**: Monitor incoming connection requests
- **ManageConnectionRequestsTool**: Handle pending connections
- **AcceptConnectionRequestTool**: Accept incoming connections
- **ListUnapprovedConnectionRequestsTool**: View pending requests

## Plugin Development

Create custom plugins by extending the base plugin interface:

```typescript
import { BasePlugin } from '@hashgraphonline/standards-agent-kit';

export class MyCustomPlugin extends BasePlugin {
  name = 'my-custom-plugin';
  
  async initialize(context) {
    // Initialize your plugin
  }
  
  getTools() {
    // Return your custom tools
  }
}
```

## Contributing

Please read our [Contributing Guide](CONTRIBUTING.md) before contributing to this project.

## Resources

- [Standards Agent Kit Documentation](https://hashgraphonline.com/docs/libraries/standards-agent-kit/)
- [HCS Standards Documentation](https://hcs-improvement-proposals.pages.dev/docs/standards)
- [Hedera Documentation](https://docs.hedera.com)
- [GitHub Repository](https://github.com/hashgraph-online/standards-agent-kit)

## License

Apache-2.0

