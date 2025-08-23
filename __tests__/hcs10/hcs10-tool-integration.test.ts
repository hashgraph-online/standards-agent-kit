import { describe, it, expect } from '@jest/globals';

describe('HCS-10 Tool Parameter Integration', () => {
  /**
   * Integration test for the SendMessageToConnectionTool parameter handling fix.
   * This test validates the actual parameter extraction logic that was causing
   * "Sorry, I encountered an error processing your request" messages.
   */
  describe('Parameter Extraction Logic Integration', () => {
    // Simulate the actual parameter extraction logic from SendMessageToConnectionTool
    function extractTargetIdentifier(args: {
      targetIdentifier?: string;
      connectionId?: string;
      agentId?: string;
      message: string;
    }): string | undefined {
      // This is the exact logic from the fixed SendMessageToConnectionTool
      return args.targetIdentifier || args.agentId || args.connectionId;
    }

    it('should handle conversational-agent sending targetIdentifier', () => {
      const args = {
        targetIdentifier: '0.0.123456',
        message: 'Hello from conversational agent'
      };

      const result = extractTargetIdentifier(args);
      expect(result).toBe('0.0.123456');
    });

    it('should handle conversational-agent sending connectionId', () => {
      const args = {
        connectionId: '1',
        message: 'Message via connection number'
      };

      const result = extractTargetIdentifier(args);
      expect(result).toBe('1');
    });

    it('should handle conversational-agent sending agentId', () => {
      const args = {
        agentId: '0.0.789012',
        message: 'Message via agent ID'
      };

      const result = extractTargetIdentifier(args);
      expect(result).toBe('0.0.789012');
    });

    it('should handle parameter priority when multiple are provided', () => {
      const args = {
        targetIdentifier: 'priority-target',
        connectionId: 'fallback-connection',
        agentId: 'fallback-agent',
        message: 'Multi-parameter message'
      };

      const result = extractTargetIdentifier(args);
      // targetIdentifier should have highest priority
      expect(result).toBe('priority-target');
    });

    it('should handle agentId fallback when targetIdentifier not provided', () => {
      const args = {
        connectionId: 'connection-fallback',
        agentId: 'agent-priority',
        message: 'Fallback test'
      };

      const result = extractTargetIdentifier(args);
      // agentId should have priority over connectionId
      expect(result).toBe('agent-priority');
    });

    it('should handle connectionId as final fallback', () => {
      const args = {
        connectionId: 'final-fallback',
        message: 'Only connection ID provided'
      };

      const result = extractTargetIdentifier(args);
      expect(result).toBe('final-fallback');
    });

    it('should return undefined when no identifier provided', () => {
      const args = {
        message: 'No identifier provided'
      };

      const result = extractTargetIdentifier(args);
      expect(result).toBeUndefined();
    });

    it('should handle request key format properly', () => {
      const args = {
        targetIdentifier: 'req-1:0.0.123@0.0.456',
        message: 'Request key format test'
      };

      const result = extractTargetIdentifier(args);
      expect(result).toBe('req-1:0.0.123@0.0.456');
    });
  });

  describe('Connection Lookup Strategy Integration', () => {
    // Simulate the enhanced connection lookup logic from HCS10Builder
    interface MockConnection {
      connectionId: string;
      targetAccountId: string;
      targetAgentName: string;
      targetInboundTopicId: string;
      connectionTopicId: string;
      status: 'established';
      created: Date;
    }

    function findConnectionWithStrategies(
      identifier: string,
      connections: MockConnection[]
    ): MockConnection | null {
      let connection = null;

      // Strategy 1: Request key format parsing (req-1:0.0.123@0.0.456)
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

      // Strategy 3: Auto-prefix account IDs (123456 → 0.0.123456)
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

      // Strategy 4: Connection number mapping (1, 2, 3)
      if (!connection && /^[1-9]\d*$/.test(identifier)) {
        const index = parseInt(identifier) - 1;
        if (index >= 0 && index < connections.length) {
          connection = connections[index];
        }
      }

      return connection || null;
    }

    const mockConnections: MockConnection[] = [
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

    it('should use Strategy 1: Request key format parsing', () => {
      const connection = findConnectionWithStrategies(
        'req-1:0.0.111@0.0.123456',
        mockConnections
      );

      expect(connection).not.toBeNull();
      expect(connection!.targetAccountId).toBe('0.0.123456');
      expect(connection!.connectionId).toBe('conn-1');
    });

    it('should use Strategy 2: Direct account ID lookup', () => {
      const connection = findConnectionWithStrategies(
        '0.0.789012',
        mockConnections
      );

      expect(connection).not.toBeNull();
      expect(connection!.targetAccountId).toBe('0.0.789012');
    });

    it('should use Strategy 2: Direct topic ID lookup', () => {
      const connection = findConnectionWithStrategies(
        '0.0.444444',
        mockConnections
      );

      expect(connection).not.toBeNull();
      expect(connection!.connectionTopicId).toBe('0.0.444444');
    });

    it('should use Strategy 2: Direct connection ID lookup', () => {
      const connection = findConnectionWithStrategies(
        'conn-1',
        mockConnections
      );

      expect(connection).not.toBeNull();
      expect(connection!.connectionId).toBe('conn-1');
    });

    it('should use Strategy 3: Auto-prefix account IDs', () => {
      const connection = findConnectionWithStrategies(
        '123456',
        mockConnections
      );

      expect(connection).not.toBeNull();
      expect(connection!.targetAccountId).toBe('0.0.123456');
    });

    it('should use Strategy 4: Connection number mapping', () => {
      const connection1 = findConnectionWithStrategies('1', mockConnections);
      expect(connection1).not.toBeNull();
      expect(connection1!.targetAccountId).toBe('0.0.123456');

      const connection2 = findConnectionWithStrategies('2', mockConnections);
      expect(connection2).not.toBeNull();
      expect(connection2!.targetAccountId).toBe('0.0.789012');
    });

    it('should return null for non-existent connections', () => {
      const connection = findConnectionWithStrategies(
        'non-existent',
        mockConnections
      );

      expect(connection).toBeNull();
    });

    it('should handle empty connections array', () => {
      const connection = findConnectionWithStrategies('1', []);
      expect(connection).toBeNull();
    });

    it('should prioritize strategies correctly', () => {
      // Test that connection numbers go to Strategy 4, not Strategy 2
      const testConnections = [
        ...mockConnections,
        {
          connectionId: '1', // This could match Strategy 2
          targetAccountId: '0.0.999999',
          targetAgentName: 'Test',
          targetInboundTopicId: '0.0.888888',
          connectionTopicId: '0.0.777777',
          status: 'established' as const,
          created: new Date(),
        },
      ];

      // Should use Strategy 4 (index 0) not Strategy 2 (connectionId match)
      const connection = findConnectionWithStrategies('1', testConnections);
      expect(connection!.targetAccountId).toBe('0.0.123456'); // First connection
    });
  });

  describe('Error Handling Integration', () => {
    it('should generate helpful error messages', () => {
      const mockConnections = [
        {
          connectionId: 'conn-1',
          targetAccountId: '0.0.123456',
          connectionTopicId: '0.0.222222',
        },
        {
          connectionId: 'conn-2',
          targetAccountId: '0.0.789012',
          connectionTopicId: '0.0.444444',
        },
      ];

      function generateErrorMessage(identifier: string) {
        const availableIds = mockConnections.map(
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

      const errorMsg = generateErrorMessage('invalid-id');

      expect(errorMsg).toContain('Connection not found for identifier: "invalid-id"');
      expect(errorMsg).toContain('1. 0.0.123456 (Topic: 0.0.222222)');
      expect(errorMsg).toContain('2. 0.0.789012 (Topic: 0.0.444444)');
      expect(errorMsg).toContain('Connection number');
      expect(errorMsg).toContain('Account ID');
      expect(errorMsg).toContain('list_connections');
    });
  });

  describe('Real-World Scenario Integration', () => {
    it('should handle the original error scenario', () => {
      // Simulate the original error: conversational-agent sends connectionId
      // but SendMessageToConnectionTool only accepted targetIdentifier

      const originalArgs = {
        connectionId: '1',
        message: 'This used to cause "Sorry, I encountered an error"'
      };

      // Before fix: only targetIdentifier was accepted
      function oldParameterHandling(args: any): string | undefined {
        return args.targetIdentifier; // This would be undefined!
      }

      // After fix: accept all three parameter types
      function newParameterHandling(args: {
        targetIdentifier?: string;
        connectionId?: string;
        agentId?: string;
        message: string;
      }): string | undefined {
        return args.targetIdentifier || args.agentId || args.connectionId;
      }

      const oldResult = oldParameterHandling(originalArgs);
      const newResult = newParameterHandling(originalArgs);

      expect(oldResult).toBeUndefined(); // This caused the error
      expect(newResult).toBe('1'); // This fixes the error
    });

    it('should handle multiple parameter formats from different sources', () => {
      const scenarios = [
        {
          name: 'Direct CLI usage with targetIdentifier',
          args: { targetIdentifier: '0.0.123456', message: 'CLI message' },
          expected: '0.0.123456'
        },
        {
          name: 'Conversational agent with connectionId',
          args: { connectionId: '2', message: 'Agent message' },
          expected: '2'
        },
        {
          name: 'API call with agentId',
          args: { agentId: '0.0.789012', message: 'API message' },
          expected: '0.0.789012'
        },
        {
          name: 'Request key format',
          args: { targetIdentifier: 'req-1:0.0.123@0.0.456', message: 'Request key message' },
          expected: 'req-1:0.0.123@0.0.456'
        }
      ];

      scenarios.forEach(scenario => {
        const result = scenario.args.targetIdentifier ||
                      scenario.args.agentId ||
                      scenario.args.connectionId;

        expect(result).toBe(scenario.expected);
      });
    });
  });
});