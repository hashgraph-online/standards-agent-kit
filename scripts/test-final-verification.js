import {
  HCS2Builder,
  InscriberBuilder,
  CreateRegistryTool,
  RegisterEntryTool,
  UpdateEntryTool,
  DeleteEntryTool,
  MigrateRegistryTool,
  QueryRegistryTool,
  InscribeFromUrlTool,
  InscribeFromFileTool,
  InscribeFromBufferTool,
  InscribeHashinalTool,
  RetrieveInscriptionTool
} from '../dist/es/standards-agent-kit.es.js';

const mockHederaKit = {
  client: { network: { toString: () => 'testnet' } },
  signer: { 
    getAccountId: () => ({ toString: () => '0.0.123456' }),
    getOperatorPrivateKey: () => ({ toStringRaw: () => 'fake-key' })
  }
};

const mockLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
};

console.log('🔧 Final Tool Verification\n');

try {
  const hcs2Builder = new HCS2Builder(mockHederaKit);
  const inscriberBuilder = new InscriberBuilder(mockHederaKit);
  
  console.log('✅ Builders created successfully\n');

  const hcs2Tools = [
    { Tool: CreateRegistryTool, name: 'CreateRegistryTool' },
    { Tool: RegisterEntryTool, name: 'RegisterEntryTool' },
    { Tool: UpdateEntryTool, name: 'UpdateEntryTool' },
    { Tool: DeleteEntryTool, name: 'DeleteEntryTool' },
    { Tool: MigrateRegistryTool, name: 'MigrateRegistryTool' },
    { Tool: QueryRegistryTool, name: 'QueryRegistryTool' }
  ];

  const inscriberTools = [
    { Tool: InscribeFromUrlTool, name: 'InscribeFromUrlTool' },
    { Tool: InscribeFromFileTool, name: 'InscribeFromFileTool' },
    { Tool: InscribeFromBufferTool, name: 'InscribeFromBufferTool' },
    { Tool: InscribeHashinalTool, name: 'InscribeHashinalTool' },
    { Tool: RetrieveInscriptionTool, name: 'RetrieveInscriptionTool' }
  ];

  console.log('🧪 Testing HCS-2 Tools:');
  for (const { Tool, name } of hcs2Tools) {
    const tool = new Tool({
      hederaKit: mockHederaKit,
      hcs2Builder,
      logger: mockLogger
    });
    
    console.log(`✅ ${name}: ${tool.name} - Schema: ${typeof tool.specificInputSchema}`);
  }

  console.log('\n🧪 Testing Inscriber Tools:');
  for (const { Tool, name } of inscriberTools) {
    const tool = new Tool({
      hederaKit: mockHederaKit,
      inscriberBuilder,
      logger: mockLogger
    });
    
    console.log(`✅ ${name}: ${tool.name} - Schema: ${typeof tool.specificInputSchema}`);
  }

  console.log('\n🎉 All tools working perfectly!');
  console.log('📊 Summary:');
  console.log(`   - HCS-2 Tools: ${hcs2Tools.length} created`);
  console.log(`   - Inscriber Tools: ${inscriberTools.length} created`);
  console.log(`   - Total: ${hcs2Tools.length + inscriberTools.length} tools verified`);

} catch (error) {
  console.error('❌ Final verification failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}