import {
  CreateDynamicRegistryTool,
  RegisterDynamicHashinalTool,
  UpdateDynamicHashinalTool,
  QueryDynamicRegistryTool,
  HCS6Builder,
} from '../../../src';
import { Logger } from '@hashgraphonline/standards-sdk';
import { HederaAgentKit } from 'hedera-agent-kit';
import { PrivateKey } from '@hashgraph/sdk';

describe('HCS-6 Tools', () => {
  let mockHCS6Builder: jest.Mocked<HCS6Builder>;
  let mockHederaKit: jest.Mocked<HederaAgentKit>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockHCS6Builder = {
      createRegistry: jest.fn(),
      createHashinal: jest.fn(),
      register: jest.fn(),
      getRegistry: jest.fn(),
      registerEntry: jest.fn(),
    } as any;

    mockHederaKit = {
      client: {},
      operatorId: '0.0.123456',
      operatorPrivateKey: 'mock-key',
    } as any;

    mockLogger = new Logger({ module: 'HCS6-Test' });
    
    // Mock PrivateKey methods
    jest.spyOn(PrivateKey, 'generate').mockReturnValue({
      toStringRaw: () => 'mock-private-key',
      toStringDer: () => 'mock-private-key-der',
      publicKey: {
        toStringRaw: () => 'mock-public-key',
      },
    } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('CreateDynamicRegistryTool', () => {
    it('should create a dynamic registry successfully', async () => {
      const tool = new CreateDynamicRegistryTool({
        hcs6Builder: mockHCS6Builder,
        hederaKit: mockHederaKit,
        logger: mockLogger,
      });

      mockHCS6Builder.createRegistry.mockResolvedValue({
        success: true,
        topicId: '0.0.999999',
        transactionId: '0.0.123456@1234567890.123456789',
        sequence: 1,
      });

      const result = await tool._call({
        ttl: 86400,
        submitKey: true,
        submitKey: true,
      });

      expect(typeof result).toBe('string');
      expect(result).toContain('Successfully created HCS-6 dynamic registry!');
      expect(result).toContain('Topic ID: 0.0.999999');
      expect(result).toContain('TTL: 86400 seconds');
      expect(mockHCS6Builder.createRegistry).toHaveBeenCalledWith({
        ttl: 86400,
        submitKey: true,
        submitKey: true,
      });
    });

    it('should enforce minimum TTL of 3600 seconds', async () => {
      const tool = new CreateDynamicRegistryTool({
        hcs6Builder: mockHCS6Builder,
        hederaKit: mockHederaKit,
        logger: mockLogger,
      });

      const result = await tool._call({
        ttl: 1800, // Below minimum
      });

      try {
        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(false);
        expect(parsed.error).toBeDefined();
      } catch (e) {
        // If it's not JSON, it might be a direct error string
        expect(result).toContain('ttl');
      }
    });

    it('should handle creation errors', async () => {
      const tool = new CreateDynamicRegistryTool({
        hcs6Builder: mockHCS6Builder,
        hederaKit: mockHederaKit,
        logger: mockLogger,
      });

      mockHCS6Builder.createRegistry.mockResolvedValue({
        success: false,
        error: 'Insufficient HBAR balance',
      });

      const result = await tool._call({
        ttl: 86400,
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Insufficient HBAR balance');
    });

    it('should create registry without keys when not specified', async () => {
      const tool = new CreateDynamicRegistryTool({
        hcs6Builder: mockHCS6Builder,
        hederaKit: mockHederaKit,
        logger: mockLogger,
      });

      mockHCS6Builder.createRegistry.mockResolvedValue({
        success: true,
        topicId: '0.0.888888',
        transactionId: '0.0.123456@1234567890.123456789',
        sequence: 1,
      });

      const result = await tool._call({
        ttl: 7200,
        submitKey: false,
        submitKey: false,
      });

      expect(typeof result).toBe('string');
      expect(result).toContain('Successfully created HCS-6 dynamic registry!');
      expect(result).toContain('Topic ID: 0.0.888888');
      expect(result).toContain('TTL: 7200 seconds');
      expect(mockHCS6Builder.createRegistry).toHaveBeenCalledWith({
        ttl: 7200,
        submitKey: false,
        submitKey: false,
      });
    });
  });

  describe('RegisterDynamicHashinalTool', () => {
    it('should register a dynamic hashinal successfully', async () => {
      const tool = new RegisterDynamicHashinalTool({
        hcs6Builder: mockHCS6Builder,
        hederaKit: mockHederaKit,
        logger: mockLogger,
      });

      const submitKeyString = 'mock-private-key';

      mockHCS6Builder.register.mockResolvedValue({
        success: true,
        registryTopicId: '0.0.999999',
        inscriptionTopicId: '0.0.777777',
        transactionId: '0.0.123456@1234567890.123456789',
      });

      const metadata = {
        name: 'Test Item',
        level: 1,
        attributes: {
          strength: 10,
          defense: 5,
        },
      };

      const result = await tool._call({
        registryTopicId: '0.0.999999',
        metadata,
        memo: 'Initial creation',
        submitKey: submitKeyString,
      });

      expect(typeof result).toBe('string');
      expect(result).toContain('Successfully registered dynamic hashinal');
      expect(result).toContain('Registry Topic ID: 0.0.999999');
      expect(result).toContain('Inscription Topic ID: 0.0.777777');
      expect(mockHCS6Builder.register).toHaveBeenCalledWith({
        metadata,
        data: undefined,
        memo: 'Initial creation',
        ttl: undefined,
        registryTopicId: '0.0.999999',
        submitKey: submitKeyString,
      });
    });

    it('should create registry if not provided', async () => {
      const tool = new RegisterDynamicHashinalTool({
        hcs6Builder: mockHCS6Builder,
        hederaKit: mockHederaKit,
        logger: mockLogger,
      });

      mockHCS6Builder.register.mockResolvedValue({
        success: true,
        registryTopicId: '0.0.666666',
        inscriptionTopicId: '0.0.555555',
        transactionId: '0.0.123456@1234567890.123456789',
      });

      const result = await tool._call({
        metadata: { name: 'Auto Registry Test' },
        data: { base64: 'dGVzdC1kYXRh' }, // base64 encoded 'test-data'
      });

      expect(typeof result).toBe('string');
      expect(result).toContain('Successfully registered dynamic hashinal');
      expect(result).toContain('Registry Topic ID: 0.0.666666');
      expect(result).toContain('Inscription Topic ID: 0.0.555555');
      expect(mockHCS6Builder.register).toHaveBeenCalledWith({
        metadata: { name: 'Auto Registry Test' },
        data: { base64: 'dGVzdC1kYXRh' },
        memo: undefined,
        ttl: undefined,
        registryTopicId: undefined,
        submitKey: undefined,
      });
    });

    it('should handle registration errors', async () => {
      const tool = new RegisterDynamicHashinalTool({
        hcs6Builder: mockHCS6Builder,
        hederaKit: mockHederaKit,
        logger: mockLogger,
      });

      mockHCS6Builder.register.mockResolvedValue({
        success: false,
        error: 'Invalid submit key',
      });

      const result = await tool._call({
        registryTopicId: '0.0.999999',
        metadata: { name: 'Error Test' },
        submitKey: 'invalid-key',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Invalid submit key');
    });
  });

  describe('UpdateDynamicHashinalTool', () => {
    it('should update a dynamic hashinal successfully', async () => {
      const tool = new UpdateDynamicHashinalTool({
        hcs6Builder: mockHCS6Builder,
        hederaKit: mockHederaKit,
        logger: mockLogger,
      });

      const submitKeyString = 'mock-private-key';

      mockHCS6Builder.register.mockResolvedValue({
        success: true,
        registryTopicId: '0.0.999999',
        inscriptionTopicId: '0.0.444444',
        transactionId: '0.0.123456@1234567890.123456789',
      });

      const updatedMetadata = {
        name: 'Test Item',
        level: 5,
        attributes: {
          strength: 20,
          defense: 15,
        },
      };

      const result = await tool._call({
        registryTopicId: '0.0.999999',
        metadata: updatedMetadata,
        memo: 'Level up!',
        submitKey: submitKeyString,
      });

      expect(typeof result).toBe('string');
      expect(result).toContain('Successfully updated dynamic hashinal');
      expect(result).toContain('Registry Topic ID: 0.0.999999');
      expect(result).toContain('Inscription Topic ID: 0.0.444444');
      expect(result).toContain('Update Memo: Level up!');
      expect(mockHCS6Builder.register).toHaveBeenCalledWith({
        metadata: updatedMetadata,
        data: undefined,
        memo: 'Level up!',
        registryTopicId: '0.0.999999',
        submitKey: submitKeyString,
      });
    });

    it('should require submit key', async () => {
      const tool = new UpdateDynamicHashinalTool({
        hcs6Builder: mockHCS6Builder,
        hederaKit: mockHederaKit,
        logger: mockLogger,
      });

      const result = await tool._call({
        registryTopicId: '0.0.999999',
        metadata: { name: 'No Key Test' },
      });

      try {
        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(false);
        expect(parsed.error).toBeDefined();
      } catch (e) {
        // If it's not JSON, it might be a direct error string
        expect(result).toContain('submitKey');
      }
    });

    it('should handle update errors', async () => {
      const tool = new UpdateDynamicHashinalTool({
        hcs6Builder: mockHCS6Builder,
        hederaKit: mockHederaKit,
        logger: mockLogger,
      });

      mockHCS6Builder.register.mockResolvedValue({
        success: false,
        error: 'Registry TTL expired',
      });

      const result = await tool._call({
        registryTopicId: '0.0.999999',
        metadata: { name: 'Expired Test' },
        submitKey: 'mock-private-key',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Registry TTL expired');
    });
  });

  describe('QueryDynamicRegistryTool', () => {
    it('should query registry successfully', async () => {
      const tool = new QueryDynamicRegistryTool({
        hcs6Builder: mockHCS6Builder,
        hederaKit: mockHederaKit,
        logger: mockLogger,
      });

      mockHCS6Builder.getRegistry.mockResolvedValue({
        topicId: '0.0.999999',
        registryType: 1,
        ttl: 86400,
        latestEntry: {
          sequence: 2,
          timestamp: '2024-01-01T12:00:00Z',
          payer: '0.0.123456',
          message: {
            p: 'hcs-6',
            op: 'register',
            t_id: '0.0.444444',
            m: 'Level up!',
          },
          consensus_timestamp: '1234567890.123456789',
          registry_type: 1,
        },
        entries: [
          {
            sequence: 1,
            timestamp: '2024-01-01T11:00:00Z',
            payer: '0.0.123456',
            message: {
              p: 'hcs-6',
              op: 'register',
              t_id: '0.0.777777',
              m: 'Initial creation',
            },
            consensus_timestamp: '1234567890.111111111',
            registry_type: 1,
          },
          {
            sequence: 2,
            timestamp: '2024-01-01T12:00:00Z',
            payer: '0.0.123456',
            message: {
              p: 'hcs-6',
              op: 'register',
              t_id: '0.0.444444',
              m: 'Level up!',
            },
            consensus_timestamp: '1234567890.123456789',
            registry_type: 1,
          },
        ],
      });

      const result = await tool._call({
        topicId: '0.0.999999',
        limit: 10,
        order: 'desc',
      });

      expect(typeof result).toBe('string');
      expect(result).toContain('Successfully queried dynamic registry');
      expect(result).toContain('Registry Topic: 0.0.999999');
      expect(result).toContain('Registry Type: NON_INDEXED');
      expect(result).toContain('TTL: 86400 seconds');
      expect(result).toContain('Total Entries: 2');
      expect(result).toContain('Latest Entry');
      expect(result).toContain('Topic ID: 0.0.444444');
      expect(result).toContain('Memo: Level up!');
    });

    it('should handle empty registry', async () => {
      const tool = new QueryDynamicRegistryTool({
        hcs6Builder: mockHCS6Builder,
        hederaKit: mockHederaKit,
        logger: mockLogger,
      });

      mockHCS6Builder.getRegistry.mockResolvedValue({
        topicId: '0.0.999999',
        registryType: 1,
        ttl: 86400,
        latestEntry: null,
        entries: [],
      });

      const result = await tool._call({
        topicId: '0.0.999999',
      });

      expect(typeof result).toBe('string');
      expect(result).toContain('Successfully queried dynamic registry');
      expect(result).toContain('Registry Topic: 0.0.999999');
      expect(result).toContain('Total Entries: 0');
      expect(result).toContain('No entries found in registry');
    });

    it('should handle query errors', async () => {
      const tool = new QueryDynamicRegistryTool({
        hcs6Builder: mockHCS6Builder,
        hederaKit: mockHederaKit,
        logger: mockLogger,
      });

      mockHCS6Builder.getRegistry.mockRejectedValue(
        new Error('Registry not found')
      );

      const result = await tool._call({
        topicId: '0.0.999999',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Registry not found');
    });

    it('should respect query parameters', async () => {
      const tool = new QueryDynamicRegistryTool({
        hcs6Builder: mockHCS6Builder,
        hederaKit: mockHederaKit,
        logger: mockLogger,
      });

      mockHCS6Builder.getRegistry.mockResolvedValue({
        topicId: '0.0.999999',
        registryType: 1,
        ttl: 86400,
        latestEntry: null,
        entries: [],
      });

      await tool._call({
        topicId: '0.0.999999',
        limit: 50,
        order: 'asc',
        skip: 10,
      });

      expect(mockHCS6Builder.getRegistry).toHaveBeenCalledWith('0.0.999999', {
        limit: 50,
        order: 'asc',
        skip: 10,
      });
    });
  });
});