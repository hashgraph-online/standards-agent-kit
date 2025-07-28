import {
  HederaConversationalAgent,
  ServerSigner,
  BasePlugin,
  GenericPluginContext,
  HederaTool,
  HederaAgentKit,
} from 'hedera-agent-kit';
import dotenv from 'dotenv';
import { RegisterAgentTool } from './src/tools/hcs10/RegisterAgentTool';
import { OpenConvaiState } from './src/state/open-convai-state';
import { HCS10Builder } from './src/builders/hcs10/hcs10-builder';

dotenv.config();

// Create a custom plugin class
class TestPlugin extends BasePlugin {
  id = 'test-plugin';
  name = 'Test Standards Plugin';
  description = 'Test plugin with updated RegisterAgentTool';
  version = '1.0.0';
  author = 'Test';
  namespace = 'test';

  private stateManager: OpenConvaiState;
  private tools: HederaTool[] = [];

  constructor(stateManager: OpenConvaiState) {
    super();
    this.stateManager = stateManager;
  }

  override async initialize(context: GenericPluginContext): Promise<void> {
    await super.initialize(context);

    const hederaKit = context.config.hederaKit as HederaAgentKit;
    if (!hederaKit) {
      throw new Error('HederaKit not found in context');
    }

    const hcs10Builder = new HCS10Builder(hederaKit, this.stateManager, {
      logLevel: 'debug',
    });

    this.tools = [
      new RegisterAgentTool({
        hederaKit: hederaKit,
        hcs10Builder: hcs10Builder,
        logger: this.context.logger,
      }),
    ];
  }

  override getTools(): HederaTool[] {
    return this.tools;
  }
}

async function testRealRegistration() {
  console.log('Testing registration with LangChain agent...\n');

  // Create signer
  const signer = new ServerSigner(
    process.env.HEDERA_OPERATOR_ID!,
    process.env.HEDERA_OPERATOR_KEY!,
    'testnet'
  );

  // Create state manager
  const stateManager = new OpenConvaiState();

  // Create custom plugin with our updated tool
  const customPlugin = new TestPlugin(stateManager);

  // Create the actual agent with custom plugin
  const agent = new HederaConversationalAgent(signer, {
    pluginConfig: {
      plugins: [customPlugin],
      appConfig: {
        stateManager: stateManager,
      },
    },
    openAIApiKey: process.env.OPENAI_API_KEY,
    openAIModelName: 'gpt-4o-mini',
    operationalMode: 'autonomous', // Important: must be autonomous mode
  });

  await agent.initialize();

  // Check initial state
  console.log('1. Current agent BEFORE:', stateManager.getCurrentAgent());

  const prompt =
    'Register me as an AI assistant named HelperBot, a random unique alias, with TEXT_GENERATION capability and description "A helper bot"';
  console.log('\n2. Processing prompt:', prompt);
  console.log('\nUsing LangChain to process the natural language prompt...\n');

  try {
    const response = await agent.processMessage(prompt);
    console.log('\n3. Agent response:', response.message || response.output);

    // Check if agent was saved to state
    const currentAgent = stateManager.getCurrentAgent();
    console.log('\n4. Current agent AFTER:', currentAgent);

    if (currentAgent) {
      console.log('\n✅ SUCCESS: Agent was saved to state!');
      console.log('- Name:', currentAgent.name);
      console.log('- Account ID:', currentAgent.accountId);
      console.log('- Inbound Topic:', currentAgent.inboundTopicId);
      console.log('- Outbound Topic:', currentAgent.outboundTopicId);
      console.log('- Profile Topic:', currentAgent.profileTopicId);
      console.log('\n✅ The fix is working correctly!');
    } else {
      console.log('\n❌ FAILED: Agent was not saved to state');
      if (response.success === false) {
        console.log('Registration failed:', response.error);
      }
    }
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
  }
}

testRealRegistration().catch((error) => {
  console.error(error);
  process.exit(1);
});
