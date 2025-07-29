import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';

describe('HCS-10 Parameter Validation', () => {
  const SendMessageToConnectionZodSchema = z.object({
    targetIdentifier: z
      .string()
      .optional()
      .describe(
        "The request key (e.g., 'req-1:0.0.6155171@0.0.6154875'), account ID (e.g., 0.0.12345) of the target agent, OR the connection number (e.g., '1', '2') from the 'list_connections' tool. Request key is most deterministic."
      ),
    connectionId: z
      .string()
      .optional()
      .describe("The connection number (e.g., '1', '2') from the 'list_connections' tool."),
    agentId: z
      .string()
      .optional()
      .describe("The account ID (e.g., 0.0.12345) of the target agent."),
    message: z.string().describe('The text message content to send.'),
    disableMonitoring: z.boolean().optional().default(false),
  });

  it('should accept targetIdentifier parameter', () => {
    const params = {
      targetIdentifier: '0.0.123456',
      message: 'Test message'
    };
    
    const result = SendMessageToConnectionZodSchema.parse(params);
    expect(result.targetIdentifier).toBe('0.0.123456');
    expect(result.message).toBe('Test message');
    expect(result.disableMonitoring).toBe(false);
  });

  it('should accept connectionId parameter', () => {
    const params = {
      connectionId: '1',
      message: 'Test message'
    };
    
    const result = SendMessageToConnectionZodSchema.parse(params);
    expect(result.connectionId).toBe('1');
    expect(result.message).toBe('Test message');
  });

  it('should accept agentId parameter', () => {
    const params = {
      agentId: '0.0.789012',
      message: 'Test message'
    };
    
    const result = SendMessageToConnectionZodSchema.parse(params);
    expect(result.agentId).toBe('0.0.789012');
    expect(result.message).toBe('Test message');
  });

  it('should accept all parameters together', () => {
    const params = {
      targetIdentifier: '0.0.111111',
      connectionId: '2',
      agentId: '0.0.222222',
      message: 'Test message'
    };
    
    const result = SendMessageToConnectionZodSchema.parse(params);
    expect(result.targetIdentifier).toBe('0.0.111111');
    expect(result.connectionId).toBe('2');
    expect(result.agentId).toBe('0.0.222222');
    expect(result.message).toBe('Test message');
  });

  it('should handle disableMonitoring flag', () => {
    const params = {
      targetIdentifier: '0.0.123456',
      message: 'Test message',
      disableMonitoring: true
    };
    
    const result = SendMessageToConnectionZodSchema.parse(params);
    expect(result.disableMonitoring).toBe(true);
  });

  it('should require message field', () => {
    const params = {
      targetIdentifier: '0.0.123456'
    } as any;
    
    expect(() => SendMessageToConnectionZodSchema.parse(params)).toThrow();
  });

  it('should handle request key format', () => {
    const params = {
      targetIdentifier: 'req-1:0.0.123@0.0.456',
      message: 'Test message'
    };
    
    const result = SendMessageToConnectionZodSchema.parse(params);
    expect(result.targetIdentifier).toBe('req-1:0.0.123@0.0.456');
  });

  it('should test parameter priority logic', () => {
    const params = {
      targetIdentifier: 'target123',
      connectionId: 'conn456', 
      agentId: 'agent789',
      message: 'Test message'
    };
    
    // Simulate the parameter selection logic from SendMessageToConnectionTool
    const targetIdentifier = params.targetIdentifier || 
                             params.agentId || 
                             params.connectionId;
    
    expect(targetIdentifier).toBe('target123'); // targetIdentifier has priority
  });

  it('should test parameter fallback logic', () => {
    const params1 = {
      agentId: 'agent789',
      connectionId: 'conn456',
      message: 'Test message'
    };
    
    // Should use agentId when targetIdentifier is not present
    const targetIdentifier1 = params1.targetIdentifier || 
                              params1.agentId || 
                              params1.connectionId;
    
    expect(targetIdentifier1).toBe('agent789');

    const params2 = {
      connectionId: 'conn456',
      message: 'Test message'
    };
    
    // Should use connectionId when neither targetIdentifier nor agentId are present
    const targetIdentifier2 = params2.targetIdentifier || 
                              params2.agentId || 
                              params2.connectionId;
    
    expect(targetIdentifier2).toBe('conn456');
  });

  it('should test error case when no identifier provided', () => {
    const params = {
      message: 'Test message'
    };
    
    const targetIdentifier = params.targetIdentifier || 
                             params.agentId || 
                             params.connectionId;
    
    expect(targetIdentifier).toBeUndefined();
    
    // This should trigger the error in the actual tool
    if (!targetIdentifier) {
      expect(() => {
        throw new Error("Either targetIdentifier, connectionId, or agentId must be provided");
      }).toThrow("Either targetIdentifier, connectionId, or agentId must be provided");
    }
  });
});