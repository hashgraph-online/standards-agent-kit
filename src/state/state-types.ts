import {
  HCS10BaseClient,
  AIAgentProfile,
  IConnectionsManager,
} from '@hashgraphonline/standards-sdk';

/**
 * Basic registered agent information
 */
export interface RegisteredAgent {
  name: string;
  accountId: string;
  inboundTopicId: string;
  outboundTopicId: string;
  profileTopicId?: string;
  privateKey?: string;
}

/**
 * Connection status types
 */
export type ConnectionStatus =
  | 'established'
  | 'pending'
  | 'needs confirmation'
  | 'unknown';

/**
 * Basic agent profile information
 */
export interface AgentProfileInfo {
  name?: string;
  bio?: string;
  avatar?: string;
  type?: string;
}

/**
 * Information about a connection request
 */
export interface ConnectionRequestInfo {
  id: number;
  requestorId: string;
  requestorName: string;
  timestamp: Date;
  memo?: string;
  profile?: AgentProfileInfo;
}

/**
 * Information about an active connection
 */
export interface ActiveConnection {
  targetAccountId: string;
  targetAgentName: string;
  targetInboundTopicId: string;
  connectionTopicId: string;
  connectionRequestId?: number;
  status?: ConnectionStatus;
  created?: Date;
  lastActivity?: Date;
  isPending?: boolean;
  needsConfirmation?: boolean;
  profileInfo?: AIAgentProfile;
  metadata?: {
    [key: string]: unknown;
  };
}

/**
 * Options for environment variable persistence
 */
export interface EnvPersistenceOptions {
  prefix?: string;
  envFilePath?: string;
}

/**
 * Base persistence options interface
 */
export interface PersistenceOptions {
  type: string;
}

/**
 * Environment file persistence options
 */
export interface EnvFilePersistenceOptions extends PersistenceOptions {
  type: 'env-file';
  prefix?: string;
  envFilePath?: string;
}

/**
 * Persistence options union type
 */
export type AgentPersistenceOptions = EnvFilePersistenceOptions;

/**
 * Core state management interface for the standards agent toolkit.
 * All tools that need to maintain state should use an implementation of this interface.
 */
export interface IStateManager {
  /**
   * Sets the current active agent, clearing any previous connections.
   */
  setCurrentAgent(_agent: RegisteredAgent | null): void;

  /**
   * Gets the current active agent.
   */
  getCurrentAgent(): RegisteredAgent | null;

  /**
   * Adds a new active connection to the state.
   * Will not add duplicates based on connectionTopicId.
   */
  addActiveConnection(_connection: ActiveConnection): void;

  /**
   * Updates an existing connection or adds it if not found.
   * Preserves existing properties when updating.
   */
  updateOrAddConnection(_connection: ActiveConnection): void;

  /**
   * Lists all active connections for the current agent.
   */
  listConnections(): ActiveConnection[];

  /**
   * Finds a connection by identifier, which can be:
   * - A 1-based index number as shown in the connection list
   * - A target account ID
   * - A connection topic ID
   */
  getConnectionByIdentifier(_identifier: string): ActiveConnection | undefined;

  /**
   * Gets the last processed message timestamp for a connection.
   */
  getLastTimestamp(_connectionTopicId: string): number;

  /**
   * Updates the last processed message timestamp for a connection.
   */
  updateTimestamp(_connectionTopicId: string, _timestampNanos: number): void;

  /**
   * Persists agent data to storage
   * Implementation may vary depending on the state manager
   */
  persistAgentData?(
    _agent: RegisteredAgent,
    _options?: AgentPersistenceOptions
  ): Promise<void>;

  /**
   * Initializes the ConnectionsManager with the provided client
   * @param baseClient - The HCS10BaseClient instance to use
   * @returns The initialized ConnectionsManager
   */
  initializeConnectionsManager(_baseClient: HCS10BaseClient): IConnectionsManager;

  /**
   * Gets the ConnectionsManager instance
   * @returns The ConnectionsManager instance or null if not initialized
   */
  getConnectionsManager(): IConnectionsManager | null;
}
