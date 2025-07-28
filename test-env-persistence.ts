import { HederaAgentKit, ServerSigner } from 'hedera-agent-kit';
import { RegisterAgentTool } from './src/tools/hcs10/RegisterAgentTool';
import { OpenConvaiState } from './src/state/open-convai-state';
import { HCS10Builder } from './src/builders/hcs10/hcs10-builder';
import { AIAgentCapability } from '@hashgraphonline/standards-sdk';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();
process.env.DISABLE_LOGS = 'true';

async function testEnvPersistence() {
  console.log('Testing .env file persistence...\n');

  // Read current .env content
  const envPath = '.env';
  const beforeContent = fs.readFileSync(envPath, 'utf-8');
  const beforeLines = beforeContent.split('\n').length;

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

  // Register agent
  const uniqueName = `TestBot${Date.now().toString(36).slice(-4).toUpperCase()}`;
  const args = {
    name: uniqueName,
    alias: `bot${Date.now().toString(36)}`,
    capabilities: [AIAgentCapability.TEXT_GENERATION],
    description: 'Testing env persistence',
  };

  console.log(`Registering agent named: ${uniqueName}`);
  console.log('Expected .env prefix:', uniqueName.toUpperCase().replace(/[^A-Z0-9]/g, '_'));

  const result = await tool.call(args);
  const parsed = JSON.parse(result);

  if (parsed.success) {
    console.log('\n✅ Registration successful');

    // Wait a bit for async write
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check .env file
    const afterContent = fs.readFileSync(envPath, 'utf-8');
    const afterLines = afterContent.split('\n').length;

    console.log(`\n.env file lines before: ${beforeLines}`);
    console.log(`.env file lines after: ${afterLines}`);

    const expectedPrefix = uniqueName.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const hasNewEntries = afterContent.includes(`${expectedPrefix}_ACCOUNT_ID`);

    if (hasNewEntries) {
      console.log('\n✅ SUCCESS: Agent was persisted to .env file!');
      console.log('\nNew .env entries:');
      const newLines = afterContent.split('\n').filter(line => line.includes(expectedPrefix));
      newLines.forEach(line => console.log(line));
    } else {
      console.log('\n❌ FAILED: Agent was NOT persisted to .env file');
    }
  }
}

testEnvPersistence()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });