import { HederaAgentKit } from 'hedera-agent-kit';
import {
  HCS10Builder,
  HCS2Builder,
  InscriberBuilder,
  CreateRegistryTool,
  RegisterEntryTool,
  QueryRegistryTool
} from '../dist/es/standards-agent-kit.es.js';

async function testHCS2Tools() {
  console.log('🧪 Testing HCS-2 Tools...');
  
  try {
    const testAccountId = process.env.HEDERA_ACCOUNT_ID || '0.0.123456';
    const testPrivateKey = process.env.HEDERA_PRIVATE_KEY || 'test-key';
    
    console.log('Creating HederaAgentKit...');
    const hederaKit = new HederaAgentKit({
      accountId: testAccountId,
      privateKey: testPrivateKey,
      network: 'testnet'
    });
    
    console.log('Creating HCS2Builder...');
    const hcs2Builder = new HCS2Builder(hederaKit);
    
    console.log('Creating CreateRegistryTool...');
    const createTool = new CreateRegistryTool({
      hederaKit,
      hcs2Builder
    });
    
    console.log('✅ HCS-2 tools instantiate successfully');
    console.log('Tool name:', createTool.name);
    console.log('Tool description:', createTool.description);
    
    return true;
  } catch (error) {
    console.error('❌ HCS-2 tools failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

async function testInscriberTools() {
  console.log('🧪 Testing Inscriber Tools...');
  
  try {
    const testAccountId = process.env.HEDERA_ACCOUNT_ID || '0.0.123456';
    const testPrivateKey = process.env.HEDERA_PRIVATE_KEY || 'test-key';
    
    console.log('Creating HederaAgentKit...');
    const hederaKit = new HederaAgentKit({
      accountId: testAccountId,
      privateKey: testPrivateKey,
      network: 'testnet'
    });
    
    console.log('Creating InscriberBuilder...');
    const inscriberBuilder = new InscriberBuilder(hederaKit);
    
    console.log('✅ Inscriber tools instantiate successfully');
    
    return true;
  } catch (error) {
    console.error('❌ Inscriber tools failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

async function main() {
  console.log('🚀 Testing New Tools Integration...\n');
  
  const hcs2Success = await testHCS2Tools();
  console.log('');
  const inscriberSuccess = await testInscriberTools();
  
  console.log('\n📊 Test Results:');
  console.log(`HCS-2 Tools: ${hcs2Success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Inscriber Tools: ${inscriberSuccess ? '✅ PASS' : '❌ FAIL'}`);
  
  if (hcs2Success && inscriberSuccess) {
    console.log('\n🎉 All tools working correctly!');
    process.exit(0);
  } else {
    console.log('\n💥 Some tools have issues!');
    process.exit(1);
  }
}

main().catch(console.error);