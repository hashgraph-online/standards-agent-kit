import { describe, it, expect } from '@jest/globals';

describe('HCS-10 Connection Lookup Logic Test', () => {
  // Mock connections data
  const mockConnections = [
    {
      connectionId: 'conn-1',
      targetAccountId: '0.0.123456',
      targetAgentName: 'Agent1',
      targetInboundTopicId: '0.0.111111',
      connectionTopicId: '0.0.222222',
      status: 'established',
      created: new Date(),
    },
    {
      connectionId: 'conn-2',
      targetAccountId: '0.0.789012',
      targetAgentName: 'Agent2',
      targetInboundTopicId: '0.0.333333',
      connectionTopicId: '0.0.444444',
      status: 'established',
      created: new Date(),
    },
  ];

  // Simulate the connection lookup logic from HCS10Builder
  function findConnection(
    identifier: string,
    connections: typeof mockConnections
  ) {
    let connection = null;

    // Strategy 1: Request key format parsing
    if (identifier.includes('@')) {
      const parts = identifier.split('@');
      if (parts.length === 2) {
        const accountId = parts[1];
        connection = connections.find((c) => c.targetAccountId === accountId);
      }
    }

    // Strategy 2: Direct lookup (but not for connection numbers to preserve priority)
    if (!connection && !/^[1-9]\d*$/.test(identifier)) {
      connection = connections.find(
        (c) =>
          c.targetAccountId === identifier ||
          c.connectionTopicId === identifier ||
          c.connectionId === identifier
      );
    }

    // Strategy 3: Auto-prefix account IDs
    if (
      !connection &&
      !identifier.startsWith('0.0.') &&
      /^\d+$/.test(identifier)
    ) {
      const accountIdWithPrefix = `0.0.${identifier}`;
      connection = connections.find(
        (c) => c.targetAccountId === accountIdWithPrefix
      );
    }

    // Strategy 4: Connection number mapping
    if (!connection && /^[1-9]\d*$/.test(identifier)) {
      const index = parseInt(identifier) - 1;
      if (index >= 0 && index < connections.length) {
        connection = connections[index];
      }
    }

    return connection || null;
  }

  it('should find connection by request key format', () => {
    const connection = findConnection(
      'req-1:0.0.111@0.0.123456',
      mockConnections
    );
    expect(connection).toBeDefined();
    expect(connection!.targetAccountId).toBe('0.0.123456');
  });

  it('should find connection by direct account ID lookup', () => {
    const connection = findConnection('0.0.789012', mockConnections);
    expect(connection).toBeDefined();
    expect(connection!.targetAccountId).toBe('0.0.789012');
  });

  it('should find connection by account ID without prefix', () => {
    const connection = findConnection('123456', mockConnections);
    expect(connection).toBeDefined();
    expect(connection!.targetAccountId).toBe('0.0.123456');
  });

  it('should find connection by connection number', () => {
    const connection1 = findConnection('1', mockConnections);
    expect(connection1).toBeDefined();
    expect(connection1!.targetAccountId).toBe('0.0.123456');

    const connection2 = findConnection('2', mockConnections);
    expect(connection2).toBeDefined();
    expect(connection2!.targetAccountId).toBe('0.0.789012');
  });

  it('should find connection by topic ID', () => {
    const connection = findConnection('0.0.444444', mockConnections);
    expect(connection).toBeDefined();
    expect(connection!.targetAccountId).toBe('0.0.789012');
  });

  it('should find connection by connection ID', () => {
    const connection = findConnection('conn-2', mockConnections);
    expect(connection).toBeDefined();
    expect(connection!.targetAccountId).toBe('0.0.789012');
  });

  it('should return null for non-existent connection', () => {
    const connection = findConnection('non-existent', mockConnections);
    expect(connection).toBeNull();
  });

  it('should handle invalid connection numbers', () => {
    const connection1 = findConnection('0', mockConnections); // Invalid: starts with 0
    expect(connection1).toBeNull();

    const connection2 = findConnection('999', mockConnections); // Out of range
    expect(connection2).toBeNull();
  });

  it('should test error message generation', () => {
    function generateErrorMessage(
      identifier: string,
      connections: typeof mockConnections
    ) {
      const availableIds = connections.map(
        (c, i) =>
          `${i + 1}. ${c.targetAccountId} (Topic: ${c.connectionTopicId})`
      );

      let errorMsg = `Connection not found for identifier: "${identifier}"\n`;
      errorMsg += `Available connections:\n${
        availableIds.join('\n') || 'No active connections'
      }`;
      errorMsg += `\n\nYou can use:\n`;
      errorMsg += `- Connection number (e.g., "1", "2")\n`;
      errorMsg += `- Account ID (e.g., "0.0.6412936")\n`;
      errorMsg += `- Connection topic ID\n`;
      errorMsg += `Use 'list_connections' to see all active connections.`;

      return errorMsg;
    }

    const errorMsg = generateErrorMessage('non-existent', mockConnections);

    expect(errorMsg).toContain(
      'Connection not found for identifier: "non-existent"'
    );
    expect(errorMsg).toContain('1. 0.0.123456 (Topic: 0.0.222222)');
    expect(errorMsg).toContain('2. 0.0.789012 (Topic: 0.0.444444)');
    expect(errorMsg).toContain('Connection number');
    expect(errorMsg).toContain('Account ID');
    expect(errorMsg).toContain('list_connections');
  });

  it('should handle empty connections list', () => {
    const connection = findConnection('1', []);
    expect(connection).toBeNull();
  });

  it('should prioritize strategies correctly', () => {
    // Add a connection that could match multiple strategies
    const testConnections = [
      ...mockConnections,
      {
        connectionId: '1', // This could match connection number strategy
        targetAccountId: '0.0.999999',
        targetAgentName: 'Test',
        targetInboundTopicId: '0.0.888888',
        connectionTopicId: '0.0.777777',
        status: 'established' as const,
        created: new Date(),
      },
    ];

    // Connection number "1" should return the first connection (index 0),
    // not the one with connectionId "1"
    const connection = findConnection('1', testConnections);
    expect(connection!.targetAccountId).toBe('0.0.123456'); // First connection
  });
});
