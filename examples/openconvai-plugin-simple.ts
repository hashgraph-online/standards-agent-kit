/**
 * Simple example demonstrating how to use the OpenConvAI plugin
 * with the standards-agent-kit SDK
 */
import { 
  OpenConvAIPlugin, 
  OpenConvaiState,
  HCS10Builder 
} from '@hashgraphonline/standards-agent-kit';
import { HederaAgentKit, ServerSigner } from 'hedera-agent-kit';
import { Logger } from '@hashgraphonline/standards-sdk';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  // Initialize HederaAgentKit
  const operatorId = process.env.HEDERA_OPERATOR_ID!;
  const operatorKey = process.env.HEDERA_OPERATOR_KEY!;
  const network = process.env.HEDERA_NETWORK || 'testnet';
  
  const serverSigner = new ServerSigner(
    operatorId, 
    operatorKey, 
    network as 'mainnet' | 'testnet'
  );
  
  // Create state manager
  const stateManager = new OpenConvaiState();
  
  // Create and configure the OpenConvAI plugin
  const openConvAIPlugin = new OpenConvAIPlugin();
  
  // Initialize HederaAgentKit with the plugin
  const hederaKit = new HederaAgentKit(
    serverSigner,
    {
      plugins: [openConvAIPlugin],
      appConfig: {
        stateManager,
        registryUrl: process.env.REGISTRY_URL,
      },
    },
    'autonomous'
  );
  
  await hederaKit.initialize();
  
  // Create HCS10Builder
  const hcs10Builder = new HCS10Builder(hederaKit, stateManager);
  
  // Initialize the plugin with context
  await openConvAIPlugin.initialize({
    logger: new Logger({ module: 'OpenConvAIPlugin' }),
    config: {
      hederaKit,
      registryUrl: process.env.REGISTRY_URL,
    },
    stateManager,
  });
  
  // Get all available tools from the plugin
  const tools = openConvAIPlugin.getTools();
  console.log(`OpenConvAI Plugin loaded with ${tools.length} tools:`);
  tools.forEach(tool => {
    console.log(`  - ${tool.name}: ${tool.description}`);
  });
  
  // Example: Register an agent
  const registerTool = tools.find(t => t.name === 'register_agent');
  if (registerTool) {
    console.log('\nRegistering a new agent...');
    const result = await registerTool.invoke({
      name: 'Example Agent',
      description: 'An example agent created with the SDK',
      capabilities: [0], // TEXT_GENERATION
    });
    console.log('Registration result:', result);
  }
}

main().catch(console.error);