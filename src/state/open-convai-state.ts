export interface RegisteredAgent {
  name: string;
  accountId: string;
  inboundTopicId: string;
  outboundTopicId: string;
  profileTopicId?: string;
}

export interface ActiveConnection {
  targetAccountId: string;
  targetAgentName: string;
  targetInboundTopicId: string;
  connectionTopicId: string;
}

export interface IStateManager {
  setCurrentAgent(agent: RegisteredAgent | null): void;
  getCurrentAgent(): RegisteredAgent | null;
  addActiveConnection(connection: ActiveConnection): void;
  listConnections(): ActiveConnection[];
  getConnectionByIdentifier(identifier: string): ActiveConnection | undefined;
  getLastTimestamp(connectionTopicId: string): number;
  updateTimestamp(connectionTopicId: string, timestampNanos: number): void;
}

/**
 * An example implementation of the `IStateManager` interface.
 * All tools should have a state manager instance.
 */
export class OpenConvaiState implements IStateManager {
  currentAgent: RegisteredAgent | null = null;
  activeConnections: ActiveConnection[] = [];
  // Store last processed consensus timestamp (in nanoseconds) for message polling
  connectionMessageTimestamps: { [connectionTopicId: string]: number } = {};

  // --- Agent Management ---
  setCurrentAgent(agent: RegisteredAgent | null): void {
    console.log(
      `[OpenConvaiState] Setting active agent: ${agent?.name ?? 'None'}`
    );
    this.currentAgent = agent;
    // Clear connections when agent changes
    this.activeConnections = [];
    this.connectionMessageTimestamps = {};
  }

  getCurrentAgent(): RegisteredAgent | null {
    return this.currentAgent;
  }

  // --- Connection Management ---
  addActiveConnection(connection: ActiveConnection): void {
    // Avoid duplicates
    if (
      !this.activeConnections.some(
        (c) => c.connectionTopicId === connection.connectionTopicId
      )
    ) {
      console.log(
        `[OpenConvaiState] Adding active connection to ${connection.targetAgentName} (${connection.targetAccountId})`
      );
      this.activeConnections.push(connection);
      // Initialize timestamp - use current time as rough estimate
      this.connectionMessageTimestamps[connection.connectionTopicId] =
        Date.now() * 1_000_000;
    } else {
      console.log(
        `[OpenConvaiState] Connection to ${connection.targetAgentName} already exists.`
      );
    }
  }

  listConnections(): ActiveConnection[] {
    return [...this.activeConnections]; // Return a copy
  }

  getConnectionByIdentifier(identifier: string): ActiveConnection | undefined {
    const index = parseInt(identifier) - 1; // Check if it's a 1-based index
    if (!isNaN(index) && index >= 0 && index < this.activeConnections.length) {
      return this.activeConnections[index];
    }
    // Check if it's a targetAccountId or connectionTopicId
    return this.activeConnections.find(
      (c) =>
        c.targetAccountId === identifier || c.connectionTopicId === identifier
    );
  }

  // --- Message Timestamp Management ---
  getLastTimestamp(connectionTopicId: string): number {
    // Find connection by topic ID first to adhere to potential interface
    for (const entry of this.activeConnections) {
      if (entry.connectionTopicId === connectionTopicId) {
        return this.connectionMessageTimestamps[connectionTopicId] || 0;
      }
    }
    return 0;
  }

  updateTimestamp(connectionTopicId: string, timestampNanos: number): void {
    for (const entry of this.activeConnections) {
      if (entry.connectionTopicId === connectionTopicId) {
        if (
          timestampNanos >
          (this.connectionMessageTimestamps[connectionTopicId] || 0)
        ) {
          console.log(
            `[OpenConvaiState] Updating timestamp for topic ${connectionTopicId} to ${timestampNanos}`
          );
          this.connectionMessageTimestamps[connectionTopicId] = timestampNanos;
        }
        return; // Exit once found and updated
      }
    }
  }
}
