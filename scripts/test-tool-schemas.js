import {
  CreateRegistryTool,
  RegisterEntryTool,
  QueryRegistryTool,
  InscribeFromUrlTool,
  RetrieveInscriptionTool
} from '../dist/es/standards-agent-kit.es.js';

const mockHederaKit = {
  client: { network: { toString: () => 'testnet' } },
  signer: { 
    getAccountId: () => ({ toString: () => '0.0.123456' }),
    getOperatorPrivateKey: () => ({ toStringRaw: () => 'fake-key' })
  }
};

const mockHCS2Builder = { getHCS2Client: () => null };
const mockInscriberBuilder = { inscribe: () => null };

console.log('🧪 Testing Tool Schemas...\n');

try {
  const createTool = new CreateRegistryTool({ 
    hederaKit: mockHederaKit, 
    hcs2Builder: mockHCS2Builder 
  });
  
  console.log('CreateRegistryTool Schema:');
  console.log('- Has specificInputSchema:', typeof createTool.specificInputSchema);
  console.log('- Schema shape:', Object.keys(createTool.specificInputSchema.shape));
  console.log('');
  
  const inscribeTool = new InscribeFromUrlTool({
    hederaKit: mockHederaKit,
    inscriberBuilder: mockInscriberBuilder
  });
  
  console.log('InscribeFromUrlTool Schema:');
  console.log('- Has specificInputSchema:', typeof inscribeTool.specificInputSchema);
  console.log('- Schema shape:', Object.keys(inscribeTool.specificInputSchema.shape));
  console.log('');
  
  const queryTool = new QueryRegistryTool({
    hederaKit: mockHederaKit,
    hcs2Builder: mockHCS2Builder
  });
  
  console.log('QueryRegistryTool Schema:');
  console.log('- Has specificInputSchema:', typeof queryTool.specificInputSchema);
  console.log('- Schema shape:', Object.keys(queryTool.specificInputSchema.shape));
  console.log('');
  
  console.log('✅ All schemas properly structured!');
  
} catch (error) {
  console.error('❌ Schema test failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}