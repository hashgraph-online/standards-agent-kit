import {
  CreateRegistryTool,
  RegisterEntryTool,
  UpdateEntryTool,
  DeleteEntryTool,
  MigrateRegistryTool,
  QueryRegistryTool,
  HCS2Builder,
} from '../../../src';
import { HCS2RegistryType, Logger } from '@hashgraphonline/standards-sdk';
import { HederaAgentKit } from 'hedera-agent-kit';

describe('HCS-2 Tools', () => {
  let mockHCS2Builder: jest.Mocked<HCS2Builder>;
  let mockHederaKit: jest.Mocked<HederaAgentKit>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockHCS2Builder = {
      createRegistry: jest.fn(),
      registerEntry: jest.fn(),
      updateEntry: jest.fn(),
      deleteEntry: jest.fn(),
      migrateRegistry: jest.fn(),
      getRegistry: jest.fn(),
    } as any;

    mockHederaKit = {
      client: {},
      operatorId: '0.0.123456',
      operatorPrivateKey: 'mock-key',
    } as any;

    mockLogger = new Logger({ module: 'HCS2-Test' });
  });

  describe('CreateRegistryTool', () => {
    it('should create an indexed registry successfully', async () => {
      const tool = new CreateRegistryTool({ 
        hcs2Builder: mockHCS2Builder,
        hederaKit: mockHederaKit,
        logger: mockLogger
      });

      mockHCS2Builder.createRegistry.mockResolvedValue({
        success: true,
        topicId: '0.0.123456',
        transactionId: '0.0.5678@1234567890.123456789',
      });

      const result = await tool._call({
        registryType: HCS2RegistryType.INDEXED,
        ttl: 3600,
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data).toContain('Successfully created HCS-2 registry!');
      expect(parsed.data).toContain('Topic ID: 0.0.123456');
      expect(mockHCS2Builder.createRegistry).toHaveBeenCalledWith({
        registryType: HCS2RegistryType.INDEXED,
        ttl: 3600,
      });
    });

    it('should handle creation errors', async () => {
      const tool = new CreateRegistryTool({ 
        hcs2Builder: mockHCS2Builder,
        hederaKit: mockHederaKit,
        logger: mockLogger
      });

      mockHCS2Builder.createRegistry.mockResolvedValue({
        success: false,
        error: 'Insufficient HBAR balance',
      });

      const result = await tool._call({});
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Insufficient HBAR balance');
    });
  });

  describe('RegisterEntryTool', () => {
    it('should register an entry successfully', async () => {
      const tool = new RegisterEntryTool({ 
        hcs2Builder: mockHCS2Builder,
        hederaKit: mockHederaKit,
        logger: mockLogger
      });

      mockHCS2Builder.registerEntry.mockResolvedValue({
        success: true,
        sequenceNumber: 1,
      });

      const result = await tool._call({
        registryTopicId: '0.0.123456',
        targetTopicId: '0.0.789012',
        metadata: 'https://example.com/metadata.json',
        memo: 'Test entry',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data).toContain('Successfully registered entry');
      expect(parsed.data).toContain('0.0.123456');
      expect(parsed.data).toContain('0.0.789012');
      expect(mockHCS2Builder.registerEntry).toHaveBeenCalledWith('0.0.123456', {
        targetTopicId: '0.0.789012',
        metadata: 'https://example.com/metadata.json',
        memo: 'Test entry',
      });
    });
  });

  describe('QueryRegistryTool', () => {
    it('should query registry entries successfully', async () => {
      const tool = new QueryRegistryTool({ 
        hcs2Builder: mockHCS2Builder,
        hederaKit: mockHederaKit,
        logger: mockLogger
      });

      mockHCS2Builder.getRegistry.mockResolvedValue({
        topicId: '0.0.123456',
        registryType: HCS2RegistryType.INDEXED,
        ttl: 86400,
        entries: [
          {
            sequence: 1,
            timestamp: '2024-01-01T00:00:00Z',
            payer: '0.0.1234',
            message: {
              p: 'hcs-2',
              op: 'register',
              t_id: '0.0.789012',
              metadata: 'https://example.com/metadata.json',
              m: 'Test entry',
            },
            consensus_timestamp: '1234567890.123456789',
            registry_type: HCS2RegistryType.INDEXED,
          },
        ],
        latestEntry: undefined,
      });

      const result = await tool._call({
        topicId: '0.0.123456',
        limit: 10,
        order: 'asc',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.topicId).toBe('0.0.123456');
      expect(parsed.data.registryType).toBe('indexed');
      expect(parsed.data.totalEntries).toBe(1);
      expect(parsed.data.entries[0].targetTopicId).toBe('0.0.789012');
    });
  });

  describe('UpdateEntryTool', () => {
    it('should update an entry successfully', async () => {
      const tool = new UpdateEntryTool({ 
        hcs2Builder: mockHCS2Builder,
        hederaKit: mockHederaKit,
        logger: mockLogger
      });

      mockHCS2Builder.updateEntry.mockResolvedValue({
        success: true,
        sequenceNumber: 2,
      });

      const result = await tool._call({
        registryTopicId: '0.0.123456',
        targetTopicId: '0.0.999999',
        uid: 'entry-1',
        metadata: 'https://example.com/updated.json',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data).toContain('Successfully updated entry');
      expect(parsed.data).toContain('entry-1');
      expect(parsed.data).toContain('0.0.123456');
    });
  });

  describe('DeleteEntryTool', () => {
    it('should delete an entry successfully', async () => {
      const tool = new DeleteEntryTool({ 
        hcs2Builder: mockHCS2Builder,
        hederaKit: mockHederaKit,
        logger: mockLogger
      });

      mockHCS2Builder.deleteEntry.mockResolvedValue({
        success: true,
        sequenceNumber: 3,
      });

      const result = await tool._call({
        registryTopicId: '0.0.123456',
        uid: 'entry-1',
        memo: 'Deleting obsolete entry',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data).toContain('Successfully deleted entry');
      expect(parsed.data).toContain('entry-1');
      expect(parsed.data).toContain('0.0.123456');
    });
  });

  describe('MigrateRegistryTool', () => {
    it('should migrate registry successfully', async () => {
      const tool = new MigrateRegistryTool({ 
        hcs2Builder: mockHCS2Builder,
        hederaKit: mockHederaKit,
        logger: mockLogger
      });

      mockHCS2Builder.migrateRegistry.mockResolvedValue({
        success: true,
        sequenceNumber: 4,
      });

      const result = await tool._call({
        registryTopicId: '0.0.123456',
        targetTopicId: '0.0.555555',
        metadata: 'https://example.com/migration.json',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data).toContain('Successfully migrated HCS-2 registry');
      expect(parsed.data).toContain('0.0.123456');
      expect(parsed.data).toContain('0.0.555555');
    });
  });
});
