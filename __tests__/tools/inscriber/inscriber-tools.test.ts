import {
  InscribeFromUrlTool,
  InscribeFromFileTool,
  InscribeFromBufferTool,
  InscribeHashinalTool,
  RetrieveInscriptionTool,
  InscriberBuilder,
} from '../../../src';
import { Logger } from '@hashgraphonline/standards-sdk';

describe('Inscriber Tools', () => {
  let mockInscriberBuilder: jest.Mocked<InscriberBuilder>;
  let mockLogger: Logger;
  let mockHederaKit: any;

  beforeEach(() => {
    mockLogger = new Logger({ module: 'Inscriber-Test' });
    mockHederaKit = {
      operatorId: '0.0.123456',
      operatorPrivateKey: 'mock-key',
      client: {
        network: {
          toString: () => 'testnet'
        }
      }
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

  describe('InscribeFromUrlTool', () => {
    it('should inscribe from URL successfully with confirmation', async () => {
      const tool = new InscribeFromUrlTool({ inscriberBuilder: mockInscriberBuilder, logger: mockLogger, hederaKit: mockHederaKit });

      mockInscriberBuilder.inscribe.mockResolvedValue({
        confirmed: true,
        result: {
          jobId: '0.0.1234@1234567890.123456789',
          transactionId: '0.0.1234@1234567890.123456789',
          topicId: '0.0.1234'
        },
        inscription: {
          inscriptionId: 'insc_123456',
          topic_id: '0.0.1234'
        },
        sdk: {} as any,
      });

      const result = await tool._call({
        url: 'https://example.com/image.png',
        mode: 'file',
        waitForConfirmation: true,
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data).toContain('Successfully inscribed');
      expect(parsed.data).toContain('0.0.1234@1234567890.123456789');
      expect(mockInscriberBuilder.inscribe).toHaveBeenCalledWith(
        { type: 'url', url: 'https://example.com/image.png' },
        expect.objectContaining({
          mode: 'file',
          waitForConfirmation: true,
          network: 'testnet',
        })
      );
    });

    it('should inscribe from URL without confirmation', async () => {
      const tool = new InscribeFromUrlTool({ inscriberBuilder: mockInscriberBuilder, logger: mockLogger, hederaKit: mockHederaKit });

      mockInscriberBuilder.inscribe.mockResolvedValue({
        confirmed: false,
        result: {
          jobId: '0.0.1234@1234567890.123456789',
          transactionId: '0.0.1234@1234567890.123456789'
        },
        sdk: {} as any,
      });

      const result = await tool._call({
        url: 'https://example.com/video.mp4',
        waitForConfirmation: false,
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data).toContain('inscription');
      expect(parsed.data).toContain('0.0.1234@1234567890.123456789');
    });
  });

  describe('InscribeFromFileTool', () => {
    it('should inscribe from file successfully', async () => {
      const tool = new InscribeFromFileTool({ inscriberBuilder: mockInscriberBuilder, logger: mockLogger, hederaKit: mockHederaKit });

      mockInscriberBuilder.inscribe.mockResolvedValue({
        confirmed: true,
        result: {
          jobId: '0.0.1234@1234567890.123456789',
          transactionId: '0.0.1234@1234567890.123456789'
        },
        inscription: {
          inscriptionId: 'insc_789012'
        },
        sdk: {} as any,
      });

      const result = await tool._call({
        filePath: '/path/to/document.pdf',
        mode: 'file',
        tags: ['document', 'pdf'],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('no such file');
    });
  });

  describe('InscribeFromBufferTool', () => {
    it('should inscribe from buffer successfully', async () => {
      const tool = new InscribeFromBufferTool({ inscriberBuilder: mockInscriberBuilder, logger: mockLogger, hederaKit: mockHederaKit });

      mockInscriberBuilder.inscribe.mockResolvedValue({
        confirmed: true,
        result: {
          jobId: '0.0.1234@1234567890.123456789',
          transactionId: '0.0.1234@1234567890.123456789',
          topicId: '0.0.1234'
        },
        inscription: {
          inscriptionId: 'insc_345678',
          topic_id: '0.0.1234'
        },
        sdk: {} as any,
      });

      const result = await tool._call({
        base64Data: 'SGVsbG8gV29ybGQ=',
        fileName: 'hello.txt',
        mimeType: 'text/plain',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data).toContain('Successfully inscribed');
      expect(parsed.data).toContain('0.0.1234@1234567890.123456789');
      expect(mockInscriberBuilder.inscribe).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'buffer',
          fileName: 'hello.txt',
          mimeType: 'text/plain',
        }),
        expect.any(Object)
      );
    });
  });

  describe('InscribeHashinalTool', () => {
    it('should inscribe Hashinal NFT successfully', async () => {
      const tool = new InscribeHashinalTool({ inscriberBuilder: mockInscriberBuilder, logger: mockLogger, hederaKit: mockHederaKit });

      mockInscriberBuilder.inscribe.mockResolvedValue({
        confirmed: true,
        result: {
          jobId: '0.0.1234@1234567890.123456789',
          transactionId: '0.0.1234@1234567890.123456789',
          topicId: '0.0.1234'
        },
        inscription: {
          inscriptionId: 'insc_nft_123',
          topic_id: '0.0.1234'
        },
        sdk: {} as any,
      });

      const result = await tool._call({
        url: 'https://example.com/nft-image.jpg',
        name: 'My Cool NFT',
        creator: '0.0.1234',
        description: 'A cool NFT on Hedera',
        type: 'image',
        attributes: [
          { trait_type: 'Color', value: 'Blue' },
          { trait_type: 'Rarity', value: 'Rare' },
        ],
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data).toContain('Successfully inscribed');
      expect(parsed.data).toContain('Hashinal NFT');
      expect(parsed.data).toContain('0.0.1234@1234567890.123456789');
      expect(mockInscriberBuilder.inscribe).toHaveBeenCalledWith(
        { type: 'url', url: 'https://example.com/nft-image.jpg' },
        expect.objectContaining({
          mode: 'hashinal',
          metadata: expect.objectContaining({
            name: 'My Cool NFT',
            creator: '0.0.1234',
            description: 'A cool NFT on Hedera',
            type: 'image',
          }),
        })
      );
    });
  });

  describe('RetrieveInscriptionTool', () => {
    it('should retrieve inscription successfully', async () => {
      const tool = new RetrieveInscriptionTool({ inscriberBuilder: mockInscriberBuilder, logger: mockLogger, hederaKit: mockHederaKit });

      const mockInscription = {
        inscriptionId: 'insc_123456',
        transactionId: '0.0.1234@1234567890.123456789',
        topicId: '0.0.5678',
        status: 'completed',
        holderId: '0.0.9999',
        metadata: { name: 'Test' },
        tags: ['test'],
        mode: 'file',
        chunks: 1,
        createdAt: '2024-01-01T00:00:00Z',
        completedAt: '2024-01-01T00:01:00Z',
        fileUrl: 'https://storage.example.com/file.png',
        mimeType: 'image/png',
        fileSize: 1024,
      };

      mockInscriberBuilder.retrieveInscription.mockResolvedValue(mockInscription);

      const result = await tool._call({
        transactionId: '0.0.1234@1234567890.123456789',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.inscriptionId).toBe('insc_123456');
      expect(parsed.data.status).toBe('completed');
      expect(parsed.data.fileUrl).toBe('https://storage.example.com/file.png');
    });

    it('should handle retrieval errors', async () => {
      const tool = new RetrieveInscriptionTool({ inscriberBuilder: mockInscriberBuilder, logger: mockLogger, hederaKit: mockHederaKit });

      mockInscriberBuilder.retrieveInscription.mockRejectedValue(
        new Error('Inscription not found')
      );

      const result = await tool._call({
        transactionId: '0.0.9999@1234567890.123456789',
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Inscription not found');
    });
  });
});