import {
  AcceptConnectionRequestTool,
  InitiateConnectionTool,
  ManageConnectionRequestsTool,
  ListConnectionsTool,
  ListUnapprovedConnectionRequestsTool,
  CheckMessagesTool,
  FindRegistrationsTool,
  RetrieveProfileTool,
  SendMessageToConnectionTool,
  HCS10Builder,
} from '../../../src';
import { Logger } from '@hashgraphonline/standards-sdk';

describe('HCS-10 Tools', () => {
  let mockHCS10Builder: jest.Mocked<HCS10Builder>;
  let mockLogger: Logger;
  let mockHederaKit: any;

  beforeEach(() => {
    mockLogger = new Logger({ module: 'HCS10-Test' });
    mockHederaKit = {
      operatorId: '0.0.1001',
      operatorPrivateKey: 'mock-key',
      client: { network: { toString: () => 'testnet' } },
      signer: {
        getAccountId: () => ({ toString: () => '0.0.1001' }),
      },
      operationalMode: 'autonomous',
      scheduleUserTransactionsInBytesMode: false,
      logger: mockLogger as any,
    } as any;

    mockHCS10Builder = {
      acceptConnection: jest.fn(),
      initiateConnection: jest.fn(),
      manageConnectionRequests: jest.fn(),
      listConnections: jest.fn(),
      listUnapprovedConnectionRequests: jest.fn(),
      checkMessages: jest.fn(),
      findRegistrations: jest.fn(),
      retrieveProfile: jest.fn(),
      registerAgent: jest.fn(),
      sendMessageToConnection: jest.fn(),
      execute: jest.fn(),
      getStateManager: jest.fn(),
      clearNotes: jest.fn(),
      getNotes: jest.fn().mockReturnValue([]),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('InitiateConnectionTool', () => {
    it('should initiate connection with options', async () => {
      mockHCS10Builder.execute.mockResolvedValue({ success: true, rawResult: { message: 'Connection initiated' } });
      const tool = new InitiateConnectionTool({ hcs10Builder: mockHCS10Builder, hederaKit: mockHederaKit, logger: mockLogger });

      const result = await tool._call({ targetAccountId: '0.0.2222', disableMonitor: true, memo: 'Hello' });

      expect(mockHCS10Builder.initiateConnection).toHaveBeenCalledWith({ targetAccountId: '0.0.2222', disableMonitor: true, memo: 'Hello' });
      expect(typeof result).toBe('string');
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });
  });

  describe('AcceptConnectionRequestTool', () => {
    it('should accept a connection with optional fee and exemptions', async () => {
      mockHCS10Builder.execute.mockResolvedValue({ success: true, rawResult: { message: 'Accepted' } });
      const tool = new AcceptConnectionRequestTool({ hcs10Builder: mockHCS10Builder, hederaKit: mockHederaKit, logger: mockLogger });

      const result = await tool._call({ requestKey: 'req-1:0.0.1@0.0.2', hbarFee: 1.23, exemptAccountIds: ['0.0.3'] });

      expect(mockHCS10Builder.acceptConnection).toHaveBeenCalledWith({ requestKey: 'req-1:0.0.1@0.0.2', hbarFee: 1.23, exemptAccountIds: ['0.0.3'] });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });
  });

  describe('ManageConnectionRequestsTool', () => {
    it('should list connection requests', async () => {
      mockHCS10Builder.execute.mockResolvedValue({ success: true, rawResult: { message: 'Requests listed' } });
      const tool = new ManageConnectionRequestsTool({ hcs10Builder: mockHCS10Builder, hederaKit: mockHederaKit, logger: mockLogger });

      const result = await tool._call({ action: 'list' });

      expect(mockHCS10Builder.manageConnectionRequests).toHaveBeenCalledWith({ action: 'list' });
      expect(typeof result).toBe('string');
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });

    it('should reject a specific request', async () => {
      mockHCS10Builder.execute.mockResolvedValue({ success: true, rawResult: { message: 'Request rejected' } });
      const tool = new ManageConnectionRequestsTool({ hcs10Builder: mockHCS10Builder, hederaKit: mockHederaKit, logger: mockLogger });

      await tool._call({ action: 'reject', requestKey: 'req-abc' });

      expect(mockHCS10Builder.manageConnectionRequests).toHaveBeenCalledWith({ action: 'reject', requestKey: 'req-abc' });
    });
  });

  describe('ListConnectionsTool', () => {
    it('should list connections with flags', async () => {
      mockHCS10Builder.execute.mockResolvedValue({ success: true, rawResult: { formattedOutput: 'Connections: ...' } });
      const tool = new ListConnectionsTool({ hcs10Builder: mockHCS10Builder, hederaKit: mockHederaKit, logger: mockLogger });

      const result = await tool._call({ includeDetails: true, showPending: true });

      expect(mockHCS10Builder.listConnections).toHaveBeenCalledWith({ includeDetails: true, showPending: true });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data).toContain('Connections');
    });
  });

  describe('ListUnapprovedConnectionRequestsTool', () => {
    it('should list unapproved requests', async () => {
      mockHCS10Builder.execute.mockResolvedValue({ success: true, rawResult: { message: 'Unapproved requests' } });
      const tool = new ListUnapprovedConnectionRequestsTool({ hcs10Builder: mockHCS10Builder, hederaKit: mockHederaKit, logger: mockLogger });

      const result = await tool._call({});

      expect(mockHCS10Builder.listUnapprovedConnectionRequests).toHaveBeenCalled();
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });
  });

  describe('CheckMessagesTool', () => {
    it('should check messages with parameters', async () => {
      mockHCS10Builder.execute.mockResolvedValue({ success: true, rawResult: { formattedOutput: 'Fetched messages' } });
      const tool = new CheckMessagesTool({ hcs10Builder: mockHCS10Builder, hederaKit: mockHederaKit, logger: mockLogger });

      const result = await tool._call({ targetIdentifier: '0.0.3333', fetchLatest: true, lastMessagesCount: 5 });

      expect(mockHCS10Builder.checkMessages).toHaveBeenCalledWith({ targetIdentifier: '0.0.3333', fetchLatest: true, lastMessagesCount: 5 });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data).toContain('Fetched');
    });
  });

  describe('FindRegistrationsTool', () => {
    it('should search registrations with tags and accountId', async () => {
      mockHCS10Builder.execute.mockResolvedValue({ success: true, rawResult: { formattedOutput: 'Found registrations' } });
      const tool = new FindRegistrationsTool({ hcs10Builder: mockHCS10Builder, hederaKit: mockHederaKit, logger: mockLogger });

      const result = await tool._call({ accountId: '0.0.4444', tags: ['ai', 'data'] as any });

      expect(mockHCS10Builder.findRegistrations).toHaveBeenCalled();
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });
  });

  describe('RetrieveProfileTool', () => {
    it('should retrieve profile with disableCache', async () => {
      mockHCS10Builder.execute.mockResolvedValue({ success: true, rawResult: { profileDetails: 'Agent Profile: ...' } });
      const tool = new RetrieveProfileTool({ hcs10Builder: mockHCS10Builder, hederaKit: mockHederaKit, logger: mockLogger });

      const result = await tool._call({ accountId: '0.0.5555', disableCache: true });

      expect(mockHCS10Builder.retrieveProfile).toHaveBeenCalledWith({ accountId: '0.0.5555', disableCache: true });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data).toContain('Agent Profile');
    });
  });

  describe('SendMessageToConnectionTool', () => {
    it('should send using connection number mapping when available', async () => {
      mockHCS10Builder.execute.mockResolvedValue({ success: true, rawResult: { message: 'Sent' } });
      const list = [
        { status: 'established', isPending: false, needsConfirmation: false, connectionTopicId: '0.0.7777' },
      ];
      const mockConnectionsManager = { fetchConnectionData: jest.fn() };
      const mockStateManager = {
        getConnectionsManager: () => mockConnectionsManager,
        getCurrentAgent: () => ({ accountId: '0.0.1001' }),
        listConnections: () => list,
      };
      (mockHCS10Builder.getStateManager as jest.Mock).mockReturnValue(mockStateManager as any);

      const tool = new SendMessageToConnectionTool({ hcs10Builder: mockHCS10Builder, hederaKit: mockHederaKit, logger: mockLogger });

      const result = await tool._call({ targetIdentifier: '1', message: 'Hello' });

      expect(mockHCS10Builder.sendMessageToConnection).toHaveBeenCalledWith({ targetIdentifier: '0.0.7777', message: 'Hello', disableMonitoring: undefined });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });

    it('should send using direct account ID mapping when available', async () => {
      mockHCS10Builder.execute.mockResolvedValue({ success: true, rawResult: { message: 'Sent' } });
      const list = [
        { status: 'established', isPending: false, needsConfirmation: false, connectionTopicId: '0.0.8888', targetAccountId: '0.0.9999' },
      ];
      const mockStateManager = {
        getConnectionsManager: () => ({ fetchConnectionData: jest.fn() }),
        getCurrentAgent: () => ({ accountId: '0.0.1001' }),
        listConnections: () => list,
      };
      (mockHCS10Builder.getStateManager as jest.Mock).mockReturnValue(mockStateManager as any);

      const tool = new SendMessageToConnectionTool({ hcs10Builder: mockHCS10Builder, hederaKit: mockHederaKit, logger: mockLogger });

      await tool._call({ targetIdentifier: '0.0.9999', message: 'Hi' });

      expect(mockHCS10Builder.sendMessageToConnection).toHaveBeenCalledWith({ targetIdentifier: '0.0.8888', message: 'Hi', disableMonitoring: undefined });
    });

    it('should fall back to provided identifier when no mapping found', async () => {
      mockHCS10Builder.execute.mockResolvedValue({ success: true, rawResult: { message: 'Sent' } });
      (mockHCS10Builder.getStateManager as jest.Mock).mockReturnValue(undefined);
      const tool = new SendMessageToConnectionTool({ hcs10Builder: mockHCS10Builder, hederaKit: mockHederaKit, logger: mockLogger });

      await tool._call({ targetIdentifier: '0.0.3333', message: 'Hey' });

      expect(mockHCS10Builder.sendMessageToConnection).toHaveBeenCalledWith({ targetIdentifier: '0.0.3333', message: 'Hey', disableMonitoring: undefined });
    });

    it('should throw when no identifier provided', async () => {
      const tool = new SendMessageToConnectionTool({ hcs10Builder: mockHCS10Builder, hederaKit: mockHederaKit, logger: mockLogger });
      const result = await tool._call({} as any);
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Either targetIdentifier, connectionId, or agentId must be provided');
    });
  });

  describe('RegisterAgentTool', () => {
    it('should register agent and return result string', async () => {
      const mockStateManager = {
        setCurrentAgent: jest.fn(),
        persistAgentData: jest.fn().mockResolvedValue(undefined),
      };
      (mockHCS10Builder.getStateManager as jest.Mock).mockReturnValue(mockStateManager as any);
      mockHCS10Builder.execute.mockResolvedValue({
        success: true,
        state: {
          createdResources: ['account:0.0.333333'],
          inboundTopicId: '0.0.444444',
          outboundTopicId: '0.0.555555',
          profileTopicId: '0.0.666666',
        },
      } as any);

      const { RegisterAgentTool } = require('../../../src');
      const tool = new RegisterAgentTool({ hcs10Builder: mockHCS10Builder, hederaKit: mockHederaKit, logger: mockLogger });

      const result = await tool._call({ name: 'TestAgent', setAsCurrent: true });

      expect(mockHCS10Builder.registerAgent).toHaveBeenCalled();
      expect(typeof result).toBe('string');
    });
  });
});
