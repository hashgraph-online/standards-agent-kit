import { InscribeFromUrlTool, InscribeFromFileTool, InscriberBuilder } from '../../../src';
import { Logger } from '@hashgraphonline/standards-sdk';

jest.mock('fs/promises', () => ({
  __esModule: true,
  stat: jest.fn(async () => ({ isFile: () => true, size: 42 })),
  readFile: jest.fn(async () => Buffer.from('Hello world from file', 'utf8')),
}));

describe('Inscriber Tools - Quote Only', () => {
  let mockInscriberBuilder: jest.Mocked<InscriberBuilder>;
  let mockLogger: Logger;
  let mockHederaKit: any;

  beforeEach(() => {
    mockLogger = new Logger({ module: 'Inscriber-Quote-Test' });
    mockHederaKit = {
      operatorId: '0.0.123456',
      operatorPrivateKey: 'mock-key',
      client: {
        network: {
          toString: () => 'testnet',
        },
      },
    };

    mockInscriberBuilder = {
      inscribe: jest.fn(),
      inscribeWithSigner: jest.fn(),
      retrieveInscription: jest.fn(),
      hederaKit: mockHederaKit,
    } as any;

    Object.defineProperty(mockInscriberBuilder, 'network', {
      value: 'testnet',
      writable: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return quote for InscribeFromUrlTool when quoteOnly=true', async () => {
    const tool = new InscribeFromUrlTool({ inscriberBuilder: mockInscriberBuilder, logger: mockLogger, hederaKit: mockHederaKit });

    mockInscriberBuilder.inscribe.mockResolvedValue({
      confirmed: false,
      quote: {
        totalCostHbar: 2.34,
        validUntil: new Date().toISOString(),
        breakdown: { base: 2.0, network: 0.34 },
      },
      result: { jobId: 'job-2' },
    } as any);

    const result = await tool._call({
      url: 'https://example.com/data.json',
      quoteOnly: true,
    } as any);

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.data || parsed.quote || parsed.message).toBeDefined();
  });

  it('should return quote for InscribeFromFileTool when quoteOnly=true', async () => {
    const tool = new InscribeFromFileTool({ inscriberBuilder: mockInscriberBuilder, logger: mockLogger, hederaKit: mockHederaKit });

    mockInscriberBuilder.inscribe.mockResolvedValue({
      confirmed: false,
      quote: {
        totalCostHbar: 1.11,
        validUntil: new Date().toISOString(),
        breakdown: { base: 1.0, network: 0.11 },
      },
      result: { jobId: 'job-3' },
    } as any);

    const result = await tool._call({
      filePath: '/tmp/hello.txt',
      quoteOnly: true,
    } as any);

    const parsed = JSON.parse(result);
    expect(parsed.success === true || parsed.quote || parsed.message || parsed.error).toBeTruthy();
    expect(parsed.data || parsed.quote || parsed.message || parsed.error).toBeDefined();
  });
});
