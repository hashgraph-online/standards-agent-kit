// Mock for state-tools MUST be at the top, before OpenConvaiState is imported.
// OpenConvaiState only uses updateEnvFile from it.
jest.mock('../../src/utils/state-tools', () => ({
  __esModule: true,
  updateEnvFile: jest.fn(() => Promise.resolve()),
  // ensureAgentHasEnoughHbar and other functions from state-tools are NOT mocked here,
  // as OpenConvaiState does not directly call them. This simplifies the mock interface.
}));

/**
 * @jest-environment jsdom
 */
import { OpenConvaiState } from '../../src/state/open-convai-state';
import {
  HCS10BaseClient,
  IConnectionsManager,
  Connection,
  AIAgentProfile,
} from '@hashgraphonline/standards-sdk';
import {
  ActiveConnection,
  RegisteredAgent,
  AgentPersistenceOptions,
} from '../../src/state/state-types';
import { jest, describe, beforeEach, it, expect } from '@jest/globals';

describe('OpenConvaiState', () => {
  let state: OpenConvaiState;
  let mockBaseClient: HCS10BaseClient;
  let connectionsManagerInstance: IConnectionsManager | null;

  beforeEach(() => {
    jest.clearAllMocks(); // Clear all mocks

    mockBaseClient = {
      getMessages: jest.fn<() => Promise<Connection[]>>().mockResolvedValue([]),
      submitMessage: jest.fn<() => Promise<any>>().mockResolvedValue({} as any),
      requestAccount: jest
        .fn<() => Promise<any>>()
        .mockResolvedValue({ balance: { balance: 0 } } as any),
      getClient: jest.fn().mockReturnValue({} as any),
      getAccountAndSigner: jest.fn().mockReturnValue({
        accountId: '0.0.999',
        privateKey: 'mockPrivateKey',
        publicKey: 'mockPublicKey',
      } as any),
    } as unknown as HCS10BaseClient;

    state = new OpenConvaiState();
  });

  describe('constructor and initialization', () => {
    it('should initialize with default envFilePath and prefix', () => {
      expect((state as any).defaultEnvFilePath).toBeUndefined();
      expect((state as any).defaultPrefix).toBe('TODD');
      expect((state as any).logger).toBeDefined();
    });

    it('should initialize with provided options', () => {
      const opts = {
        defaultEnvFilePath: '.env.test',
        defaultPrefix: 'TEST',
        baseClient: mockBaseClient,
      };
      const initState = new OpenConvaiState(opts);
      expect((initState as any).defaultEnvFilePath).toBe('.env.test');
      expect((initState as any).defaultPrefix).toBe('TEST');
      expect(initState.getConnectionsManager()).not.toBeNull();
    });

    it('should initialize ConnectionsManager when initializeConnectionsManager is called', () => {
      expect(state.getConnectionsManager()).toBeNull();
      const cm = state.initializeConnectionsManager(mockBaseClient);
      expect(cm).not.toBeNull();
      expect(state.getConnectionsManager()).toBe(cm);
      expect(cm).toBeDefined();
    });

    it('should return the same ConnectionsManager instance on subsequent calls to initializeConnectionsManager', () => {
      const cm1 = state.initializeConnectionsManager(mockBaseClient);
      const cm2 = state.initializeConnectionsManager(mockBaseClient);
      expect(cm1).toBe(cm2);
    });
  });

  const ensureConnectionsManager = () => {
    if (!state.getConnectionsManager()) {
      connectionsManagerInstance =
        state.initializeConnectionsManager(mockBaseClient);
    } else {
      connectionsManagerInstance = state.getConnectionsManager();
    }
    if (!connectionsManagerInstance) {
      throw new Error('Failed to initialize ConnectionsManager for test');
    }
    return connectionsManagerInstance;
  };

  describe('setCurrentAgent', () => {
    it('should set the current agent and clear timestamps', () => {
      ensureConnectionsManager();
      const agent: RegisteredAgent = {
        name: 'TestAgent',
        accountId: '0.0.1',
        inboundTopicId: '0.0.2',
        outboundTopicId: '0.0.3',
      };
      state.setCurrentAgent(agent);
      expect(state.getCurrentAgent()).toEqual(agent);
      expect((state as any).connectionMessageTimestamps).toEqual({});
    });

    it('should call connectionsManager.clearAll if manager exists', () => {
      const cm = ensureConnectionsManager();
      jest.spyOn(cm, 'clearAll');
      const agent: RegisteredAgent = {
        name: 'TestAgent',
        accountId: '0.0.1',
        inboundTopicId: '0.0.2',
        outboundTopicId: '0.0.3',
      };
      state.setCurrentAgent(agent);
      expect(cm.clearAll).toHaveBeenCalled();
    });
  });

  describe('addActiveConnection', () => {
    it('should throw if ConnectionsManager is not initialized', () => {
      (state as any).connectionsManager = null;
      const conn: ActiveConnection = {
        targetAccountId: '0.0.10',
        connectionTopicId: '0.0.11',
        targetAgentName: '',
        targetInboundTopicId: '',
      };
      expect(() => state.addActiveConnection(conn)).toThrow(
        'ConnectionsManager not initialized'
      );
    });

    it('should call connectionsManager.updateOrAddConnection and initialize timestamp', () => {
      const cm = ensureConnectionsManager();
      jest.spyOn(cm, 'updateOrAddConnection');
      const conn: ActiveConnection = {
        connectionTopicId: '0.0.123',
        targetAccountId: '0.0.456',
        targetAgentName: 'Target',
        targetInboundTopicId: '0.0.789',
        status: 'established',
      };
      state.addActiveConnection(conn);
      expect(cm.updateOrAddConnection).toHaveBeenCalled();
      const calledWith = (cm.updateOrAddConnection as jest.Mock).mock
        .calls[0][0] as Connection;
      expect(calledWith.connectionTopicId).toBe('0.0.123');
      expect(calledWith.targetAccountId).toBe('0.0.456');
      expect(state.getLastTimestamp('0.0.123')).not.toBe(0);
    });
  });

  describe('listConnections', () => {
    it('should return empty array if ConnectionsManager is not initialized', () => {
      (state as any).connectionsManager = null;
      expect(state.listConnections()).toEqual([]);
    });

    it('should call connectionsManager.getAllConnections and convert results', () => {
      const cm = ensureConnectionsManager();
      const sdkConn: Connection = {
        connectionTopicId: '0.0.1',
        targetAccountId: '0.0.2',
        status: 'established',
        created: new Date(),
        isPending: false,
        needsConfirmation: false,
        processed: true,
      };
      jest.spyOn(cm, 'getAllConnections').mockReturnValue([sdkConn]);
      const activeConns = state.listConnections();
      expect(cm.getAllConnections).toHaveBeenCalled();
      expect(activeConns.length).toBe(1);
      expect(activeConns[0].connectionTopicId).toBe('0.0.1');
      expect(activeConns[0].targetAccountId).toBe('0.0.2');
      expect(activeConns[0].status).toBe('established');
    });
  });

  describe('getConnectionByIdentifier', () => {
    let cm: IConnectionsManager;
    const sdkConn1: Connection = {
      connectionTopicId: 'topic1',
      targetAccountId: 'acc1',
      status: 'established',
      created: new Date(),
      isPending: false,
      needsConfirmation: false,
      processed: true,
      targetAgentName: 'Agent1',
      targetInboundTopicId: 'inTopic1',
    };
    const sdkConn2: Connection = {
      connectionTopicId: 'topic2',
      targetAccountId: 'acc2',
      status: 'pending',
      created: new Date(),
      isPending: true,
      needsConfirmation: false,
      processed: true,
      targetAgentName: 'Agent2',
      targetInboundTopicId: 'inTopic2',
    };

    beforeEach(() => {
      cm = ensureConnectionsManager();
      jest.spyOn(cm, 'getAllConnections').mockReturnValue([sdkConn1, sdkConn2]);
      jest.spyOn(cm, 'getConnectionByTopicId').mockImplementation((id) => {
        if (id === 'topic1') {
          return sdkConn1;
        }
        if (id === 'topic2') {
          return sdkConn2;
        }
        return undefined;
      });
      jest.spyOn(cm, 'getConnectionByAccountId').mockImplementation((id) => {
        if (id === 'acc1') {
          return sdkConn1;
        }
        if (id === 'acc2') {
          return sdkConn2;
        }
        return undefined;
      });
    });

    it('should find by 1-based index', () => {
      const conn = state.getConnectionByIdentifier('1');
      expect(conn?.connectionTopicId).toBe('topic1');
      const conn2 = state.getConnectionByIdentifier('2');
      expect(conn2?.connectionTopicId).toBe('topic2');
    });

    it('should find by topic ID', () => {
      const conn = state.getConnectionByIdentifier('topic1');
      expect(cm.getConnectionByTopicId).toHaveBeenCalledWith('topic1');
      expect(conn?.connectionTopicId).toBe('topic1');
    });

    it('should find by account ID if not found by topic ID', () => {
      (cm.getConnectionByTopicId as jest.Mock).mockImplementation((id) => {
        if (id === 'acc2') {
          return undefined;
        } // Simulate not found by topic for 'acc2'
        return undefined;
      });
      const conn = state.getConnectionByIdentifier('acc2');
      expect(cm.getConnectionByTopicId).toHaveBeenCalledWith('acc2');
      expect(cm.getConnectionByAccountId).toHaveBeenCalledWith('acc2');
      expect(conn?.targetAccountId).toBe('acc2');
    });

    it('should return undefined if not found', () => {
      (cm.getConnectionByTopicId as jest.Mock).mockReturnValue(undefined);
      (cm.getConnectionByAccountId as jest.Mock).mockReturnValue(undefined);
      const conn = state.getConnectionByIdentifier('nonexistent');
      expect(conn).toBeUndefined();
    });
  });

  describe('timestamp management', () => {
    const topicId = 'testTopicTime';
    beforeEach(() => {
      ensureConnectionsManager();
    });

    it('should return 0 for uninitialized timestamp', () => {
      expect(state.getLastTimestamp(topicId)).toBe(0);
    });

    it('should initialize timestamp on first addActiveConnection for a topic', () => {
      state.addActiveConnection({
        connectionTopicId: topicId,
        targetAccountId: 'any',
        status: 'established',
        targetAgentName: '',
        targetInboundTopicId: '',
      });
      expect(state.getLastTimestamp(topicId)).toBeGreaterThan(0);
    });

    it('should update timestamp if newer', () => {
      state.addActiveConnection({
        connectionTopicId: topicId,
        targetAccountId: 'any',
        status: 'established',
        targetAgentName: '',
        targetInboundTopicId: '',
      });
      const initialTime = state.getLastTimestamp(topicId);
      const laterTime = initialTime + 1000;
      state.updateTimestamp(topicId, laterTime);
      expect(state.getLastTimestamp(topicId)).toBe(laterTime);
    });

    it('should not update timestamp if older or same', () => {
      state.addActiveConnection({
        connectionTopicId: topicId,
        targetAccountId: 'any',
        status: 'established',
        targetAgentName: '',
        targetInboundTopicId: '',
      });
      const initialTime = Date.now() * 1_000_000;
      state.updateTimestamp(topicId, initialTime);

      state.updateTimestamp(topicId, initialTime - 1000);
      expect(state.getLastTimestamp(topicId)).toBe(initialTime);
      state.updateTimestamp(topicId, initialTime);
      expect(state.getLastTimestamp(topicId)).toBe(initialTime);
    });
  });

  describe('status conversion (internal helpers)', () => {
    it('convertToActiveConnection should map SDK Connection to ActiveConnection correctly', () => {
      const sdkConn: Connection = {
        connectionTopicId: 't1',
        targetAccountId: 'a1',
        targetAgentName: 'Agent X',
        targetInboundTopicId: 'in1',
        status: 'established',
        created: new Date(),
        lastActivity: new Date(),
        isPending: false,
        needsConfirmation: false,
        profileInfo: {} as AIAgentProfile,
        connectionRequestId: 123,
        processed: true,
      };
      const activeConn = (state as any).convertToActiveConnection(sdkConn);
      expect(activeConn.connectionTopicId).toBe(sdkConn.connectionTopicId);
      expect(activeConn.targetAccountId).toBe(sdkConn.targetAccountId);
      expect(activeConn.targetAgentName).toBe('Agent X');
      expect(activeConn.targetInboundTopicId).toBe('in1');
      expect(activeConn.status).toBe('established');
      expect(activeConn.profileInfo).toEqual({});
      expect(activeConn.connectionRequestId).toBe(123);
    });

    it('should correctly map SDK statuses to state statuses via convertToStateStatus', () => {
      expect((state as any).convertToStateStatus('pending')).toBe('pending');
      expect((state as any).convertToStateStatus('established')).toBe(
        'established'
      );
      expect((state as any).convertToStateStatus('needs_confirmation')).toBe(
        'needs confirmation'
      );
      expect((state as any).convertToStateStatus('closed')).toBe('established');
      expect((state as any).convertToStateStatus('unknown_status')).toBe(
        'unknown'
      );
    });
  });

  describe('persistAgentData', () => {
    const agent: RegisteredAgent = {
      name: 'PersistAgent',
      accountId: '0.0.777',
      privateKey: 'aPrivateKey',
      inboundTopicId: '0.0.888',
      outboundTopicId: '0.0.999',
      profileTopicId: '0.0.111',
    };
    const options: AgentPersistenceOptions = {
      type: 'env-file',
      envFilePath: '.env.test.persist',
      prefix: 'TEST_AGENT',
    };
    let mockUpdateEnvFile: jest.Mock;

    beforeEach(() => {
      const mockedStateTools = jest.requireMock(
        '../../src/utils/state-tools'
      ) as {
        updateEnvFile: jest.Mock;
        ensureAgentHasEnoughHbar: jest.Mock; // ensureAgentHasEnoughHbar is in the top-level mock now
      };
      mockUpdateEnvFile = mockedStateTools.updateEnvFile;
      mockUpdateEnvFile.mockClear();
    });

    it('should call updateEnvFile with correct parameters', async () => {
      await state.persistAgentData(agent, options);

      expect(mockUpdateEnvFile).toHaveBeenCalled();
      expect(mockUpdateEnvFile).toHaveBeenCalledWith(
        options.envFilePath,
        expect.objectContaining({
          [`${options.prefix}_ACCOUNT_ID`]: agent.accountId,
          [`${options.prefix}_INBOUND_TOPIC_ID`]: agent.inboundTopicId,
          [`${options.prefix}_OUTBOUND_TOPIC_ID`]: agent.outboundTopicId,
          [`${options.prefix}_PRIVATE_KEY`]: agent.privateKey,
          [`${options.prefix}_PROFILE_TOPIC_ID`]: agent.profileTopicId,
        })
      );
    });

    it('should throw error for unsupported persistence type', async () => {
      const invalidOptions: AgentPersistenceOptions = {
        type: 'unsupported' as any,
      };
      await expect(
        state.persistAgentData(agent, invalidOptions)
      ).rejects.toThrow(
        "Unsupported persistence type: unsupported. Only 'env-file' is supported."
      );
    });

    it('should throw error if agent data is incomplete', async () => {
      const incompleteAgent: RegisteredAgent = {
        ...agent,
        accountId: undefined as any,
      };
      await expect(
        state.persistAgentData(incompleteAgent, options)
      ).rejects.toThrow('Agent data incomplete, cannot persist to environment');
    });

    it('should use default prefix if not provided in options', async () => {
      const optsNoPrefix: AgentPersistenceOptions = {
        type: 'env-file',
        envFilePath: '.env.test.persist',
      };
      const defaultPrefix = (state as any).defaultPrefix;

      await state.persistAgentData(agent, optsNoPrefix);
      expect(mockUpdateEnvFile).toHaveBeenCalledWith(
        optsNoPrefix.envFilePath,
        expect.objectContaining({
          [`${defaultPrefix}_ACCOUNT_ID`]: agent.accountId,
        })
      );
    });
  });
});
