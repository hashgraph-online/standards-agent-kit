import { HederaAgentKit, ServerSigner } from 'hedera-agent-kit';
import { RegisterAgentTool } from './src/tools/hcs10/RegisterAgentTool';
import { OpenConvaiState } from './src/state/open-convai-state';
import { HCS10Builder } from './src/builders/hcs10/hcs10-builder';
import { AIAgentCapability } from '@hashgraphonline/standards-sdk';
import dotenv from 'dotenv';

dotenv.config();

// Suppress logs for cleaner output
process.env.DISABLE_LOGS = 'true';

async function demonstrateFix() {
  console.log('=== DEMONSTRATING THE FIX ===\n');
  console.log('This test shows that RegisterAgentTool now saves agents to state.\n');

  // Setup
  const signer = new ServerSigner(
    process.env.HEDERA_OPERATOR_ID!,
    process.env.HEDERA_OPERATOR_KEY!,
    'testnet'
  );

  const hederaKit = new HederaAgentKit(signer, undefined, 'autonomous');
  await hederaKit.initialize();

  const stateManager = new OpenConvaiState();
  const hcs10Builder = new HCS10Builder(hederaKit, stateManager, {
    logLevel: 'error',
  });

  const tool = new RegisterAgentTool({
    hederaKit: hederaKit,
    hcs10Builder: hcs10Builder,
    logger: hederaKit.logger,
  });

  // Before the fix: Agent would NOT be saved to state
  console.log('BEFORE registration:');
  console.log('- Current agent in state:', stateManager.getCurrentAgent());

  // Register an agent
  const uniqueAlias = `bot${Date.now().toString(36)}`;
  console.log(`\nRegistering agent with alias: ${uniqueAlias}`);
  console.log('This simulates the exact parameters LangChain would pass...\n');

  const args = {
    name: 'HelperBot',
    description: 'A helper bot',
    alias: uniqueAlias,
    capabilities: [AIAgentCapability.TEXT_GENERATION],
    // Note: setAsCurrent defaults to true if not specified
  };

  console.log('Calling RegisterAgentTool...');
  const startTime = Date.now();

  const result = await tool.call(args);
  const parsed = JSON.parse(result);

  const endTime = Date.now();
  console.log(`\nRegistration completed in ${((endTime - startTime) / 1000).toFixed(1)}s`);
  console.log('Success:', parsed.success);

  // After the fix: Agent IS saved to state
  console.log('\nAFTER registration:');
  const savedAgent = stateManager.getCurrentAgent();
  console.log('- Current agent in state:', savedAgent);

  if (savedAgent) {
    console.log('\n✅ THE FIX WORKS!');
    console.log('\nThe registered agent has been automatically saved to state:');
    console.log(`- Name: ${savedAgent.name}`);
    console.log(`- Account ID: ${savedAgent.accountId}`);
    console.log(`- Inbound Topic: ${savedAgent.inboundTopicId}`);
    console.log(`- Outbound Topic: ${savedAgent.outboundTopicId}`);
    console.log(`- Profile Topic: ${savedAgent.profileTopicId}`);
    console.log('\nThis means when using the LangChain agent with the prompt:');
    console.log('"Register me as an AI assistant named HelperBot, a random unique alias,');
    console.log(' with TEXT_GENERATION capability and description \'A helper bot\'"');
    console.log('\nThe agent will now be available for subsequent operations!');
  } else {
    console.log('\n❌ The fix did not work - agent was not saved to state');
  }
}

const timeoutId = setTimeout(() => {
  console.error('\n⏰ Test timed out');
  process.exit(1);
}, 90000);

demonstrateFix()
  .then(() => {
    clearTimeout(timeoutId);
    console.log('\n=== END OF DEMONSTRATION ===');
    process.exit(0);
  })
  .catch((error) => {
    clearTimeout(timeoutId);
    console.error('\nError:', error);
    process.exit(1);
  });