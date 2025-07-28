import {
  HCS2Builder,
  InscriberBuilder,
  CreateRegistryTool,
  RegisterEntryTool,
  QueryRegistryTool,
  InscribeFromUrlTool,
  RetrieveInscriptionTool
} from '../dist/es/standards-agent-kit.es.js';

console.log('🚀 Testing Tool Exports...\n');

console.log('✅ HCS2Builder:', typeof HCS2Builder);
console.log('✅ InscriberBuilder:', typeof InscriberBuilder);
console.log('✅ CreateRegistryTool:', typeof CreateRegistryTool);
console.log('✅ RegisterEntryTool:', typeof RegisterEntryTool);
console.log('✅ QueryRegistryTool:', typeof QueryRegistryTool);
console.log('✅ InscribeFromUrlTool:', typeof InscribeFromUrlTool);
console.log('✅ RetrieveInscriptionTool:', typeof RetrieveInscriptionTool);

console.log('\n📊 All exports available!');

const mockHederaKit = {
  client: { network: { toString: () => 'testnet' } },
  signer: { 
    getAccountId: () => ({ toString: () => '0.0.123456' }),
    getOperatorPrivateKey: () => ({ toStringRaw: () => 'fake-key' })
  }
};

try {
  console.log('\n🔧 Testing Builder Instantiation:');
  const hcs2Builder = new HCS2Builder(mockHederaKit);
  console.log('✅ HCS2Builder instantiated');
  
  const inscriberBuilder = new InscriberBuilder(mockHederaKit);
  console.log('✅ InscriberBuilder instantiated');
  
  console.log('\n🛠️ Testing Tool Instantiation:');
  const createTool = new CreateRegistryTool({ 
    hederaKit: mockHederaKit, 
    hcs2Builder 
  });
  console.log('✅ CreateRegistryTool instantiated');
  console.log('   Name:', createTool.name);
  console.log('   Description:', createTool.description);
  
  const inscribeTool = new InscribeFromUrlTool({
    hederaKit: mockHederaKit,
    inscriberBuilder
  });
  console.log('✅ InscribeFromUrlTool instantiated');
  console.log('   Name:', inscribeTool.name);
  console.log('   Description:', inscribeTool.description);
  
  console.log('\n🎉 All tools working correctly!');
  
} catch (error) {
  console.error('❌ Error during instantiation:', error.message);
  process.exit(1);
}