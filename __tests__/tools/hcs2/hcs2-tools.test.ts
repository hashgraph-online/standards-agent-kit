import {
  CreateRegistryTool,
  RegisterEntryTool,
  UpdateEntryTool,
  DeleteEntryTool,
  MigrateRegistryTool,
  QueryRegistryTool,
  HCS2Builder,
} from '../../../src';
import { HCS2RegistryType } from '@hashgraphonline/standards-sdk';

describe('HCS-2 Tools', () => {
  let mockHCS2Builder: jest.Mocked<HCS2Builder>;

  beforeEach(() => {
    mockHCS2Builder = {
      createRegistry: jest.fn(),
      registerEntry: jest.fn(),
      updateEntry: jest.fn(),
      deleteEntry: jest.fn(),
      migrateRegistry: jest.fn(),
      getRegistry: jest.fn(),
    } as any;
  });

  describe('CreateRegistryTool', () => {
    it('should create an indexed registry successfully', async () => {
      const tool = new CreateRegistryTool({ hcs2Builder: mockHCS2Builder });

      mockHCS2Builder.createRegistry.mockResolvedValue({
        success: true,
        topicId: '0.0.123456',
        transactionId: '0.0.5678@1234567890.123456789',
      });

      const result = await tool._execute({
        registryType: HCS2RegistryType.INDEXED,
        ttl: 3600,
      });

      expect(result).toBe('Successfully created HCS-2 registry with topic ID: 0.0.123456');
      expect(mockHCS2Builder.createRegistry).toHaveBeenCalledWith({
        registryType: HCS2RegistryType.INDEXED,
        ttl: 3600,
      });
    });

    it('should handle creation errors', async () => {
      const tool = new CreateRegistryTool({ hcs2Builder: mockHCS2Builder });

      mockHCS2Builder.createRegistry.mockResolvedValue({
        success: false,
        error: 'Insufficient HBAR balance',
      });

      await expect(tool._execute({})).rejects.toThrow('Failed to create HCS-2 registry: Error: Insufficient HBAR balance');
    });
  });

  describe('RegisterEntryTool', () => {
    it('should register an entry successfully', async () => {
      const tool = new RegisterEntryTool({ hcs2Builder: mockHCS2Builder });

      mockHCS2Builder.registerEntry.mockResolvedValue({
        success: true,
        sequenceNumber: 1,
      });

      const result = await tool._execute({
        registryTopicId: '0.0.123456',
        targetTopicId: '0.0.789012',
        metadata: 'https://example.com/metadata.json',
        memo: 'Test entry',
      });

      expect(result).toBe('Successfully registered entry in registry 0.0.123456 pointing to topic 0.0.789012. Sequence number: 1');
      expect(mockHCS2Builder.registerEntry).toHaveBeenCalledWith(
        '0.0.123456',
        {
          targetTopicId: '0.0.789012',
          metadata: 'https://example.com/metadata.json',
          memo: 'Test entry',
        }
      );
    });
  });

  describe('QueryRegistryTool', () => {
    it('should query registry entries successfully', async () => {
      const tool = new QueryRegistryTool({ hcs2Builder: mockHCS2Builder });

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

      const result = await tool._execute({
        topicId: '0.0.123456',
        limit: 10,
        order: 'asc',
      });

      const parsed = JSON.parse(result);
      expect(parsed.topicId).toBe('0.0.123456');
      expect(parsed.registryType).toBe('indexed');
      expect(parsed.totalEntries).toBe(1);
      expect(parsed.entries[0].targetTopicId).toBe('0.0.789012');
    });
  });

  describe('UpdateEntryTool', () => {
    it('should update an entry successfully', async () => {
      const tool = new UpdateEntryTool({ hcs2Builder: mockHCS2Builder });

      mockHCS2Builder.updateEntry.mockResolvedValue({
        success: true,
        sequenceNumber: 2,
      });

      const result = await tool._execute({
        registryTopicId: '0.0.123456',
        targetTopicId: '0.0.999999',
        uid: 'entry-1',
        metadata: 'https://example.com/updated.json',
      });

      expect(result).toBe('Successfully updated entry with UID entry-1 in registry 0.0.123456. Sequence number: 2');
    });
  });

  describe('DeleteEntryTool', () => {
    it('should delete an entry successfully', async () => {
      const tool = new DeleteEntryTool({ hcs2Builder: mockHCS2Builder });

      mockHCS2Builder.deleteEntry.mockResolvedValue({
        success: true,
        sequenceNumber: 3,
      });

      const result = await tool._execute({
        registryTopicId: '0.0.123456',
        uid: 'entry-1',
        memo: 'Deleting obsolete entry',
      });

      expect(result).toBe('Successfully deleted entry with UID entry-1 from registry 0.0.123456. Sequence number: 3');
    });
  });

  describe('MigrateRegistryTool', () => {
    it('should migrate registry successfully', async () => {
      const tool = new MigrateRegistryTool({ hcs2Builder: mockHCS2Builder });

      mockHCS2Builder.migrateRegistry.mockResolvedValue({
        success: true,
        sequenceNumber: 4,
      });

      const result = await tool._execute({
        registryTopicId: '0.0.123456',
        targetTopicId: '0.0.555555',
        metadata: 'https://example.com/migration.json',
      });

      expect(result).toBe('Successfully migrated registry from 0.0.123456 to 0.0.555555. Sequence number: 4');
    });
  });
});