import {
  InscribeFromUrlTool,
  InscribeFromFileTool,
  InscribeFromBufferTool,
  InscribeHashinalTool,
  RetrieveInscriptionTool,
  InscriberBuilder,
} from '../../../src';

describe('Inscriber Tools', () => {
  let mockInscriberBuilder: jest.Mocked<InscriberBuilder>;

  beforeEach(() => {
    mockInscriberBuilder = {
      inscribe: jest.fn(),
      inscribeWithSigner: jest.fn(),
      retrieveInscription: jest.fn(),
    } as any;

    // Add network property
    Object.defineProperty(mockInscriberBuilder, 'network', {
      value: 'testnet',
      writable: false,
    });
  });

  describe('InscribeFromUrlTool', () => {
    it('should inscribe from URL successfully with confirmation', async () => {
      const tool = new InscribeFromUrlTool({ inscriberBuilder: mockInscriberBuilder });

      mockInscriberBuilder.inscribe.mockResolvedValue({
        confirmed: true,
        result: {
          jobId: '0.0.1234@1234567890.123456789',
        },
        inscription: {
          inscriptionId: 'insc_123456',
        },
        sdk: {} as any,
      });

      const result = await tool._execute({
        url: 'https://example.com/image.png',
        mode: 'file',
        waitForConfirmation: true,
      });

      expect(result).toBe('Successfully inscribed content from URL https://example.com/image.png. Transaction ID: 0.0.1234@1234567890.123456789. Inscription ID: insc_123456');
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
      const tool = new InscribeFromUrlTool({ inscriberBuilder: mockInscriberBuilder });

      mockInscriberBuilder.inscribe.mockResolvedValue({
        confirmed: false,
        result: {
          jobId: '0.0.1234@1234567890.123456789',
        },
        sdk: {} as any,
      });

      const result = await tool._execute({
        url: 'https://example.com/video.mp4',
        waitForConfirmation: false,
      });

      expect(result).toBe('Inscription initiated from URL https://example.com/video.mp4. Transaction ID: 0.0.1234@1234567890.123456789. Use retrieveInscription to check status.');
    });
  });

  describe('InscribeFromFileTool', () => {
    it('should inscribe from file successfully', async () => {
      const tool = new InscribeFromFileTool({ inscriberBuilder: mockInscriberBuilder });

      mockInscriberBuilder.inscribe.mockResolvedValue({
        confirmed: true,
        result: {
          jobId: '0.0.1234@1234567890.123456789',
        },
        inscription: {
          inscriptionId: 'insc_789012',
        },
        sdk: {} as any,
      });

      const result = await tool._execute({
        filePath: '/path/to/document.pdf',
        mode: 'file',
        tags: ['document', 'pdf'],
      });

      expect(result).toBe('Successfully inscribed content from file /path/to/document.pdf. Transaction ID: 0.0.1234@1234567890.123456789. Inscription ID: insc_789012');
    });
  });

  describe('InscribeFromBufferTool', () => {
    it('should inscribe from buffer successfully', async () => {
      const tool = new InscribeFromBufferTool({ inscriberBuilder: mockInscriberBuilder });

      mockInscriberBuilder.inscribe.mockResolvedValue({
        confirmed: true,
        result: {
          jobId: '0.0.1234@1234567890.123456789',
        },
        inscription: {
          inscriptionId: 'insc_345678',
        },
        sdk: {} as any,
      });

      const result = await tool._execute({
        base64Data: 'SGVsbG8gV29ybGQ=',
        fileName: 'hello.txt',
        mimeType: 'text/plain',
      });

      expect(result).toBe('Successfully inscribed content hello.txt. Transaction ID: 0.0.1234@1234567890.123456789. Inscription ID: insc_345678');
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
      const tool = new InscribeHashinalTool({ inscriberBuilder: mockInscriberBuilder });

      mockInscriberBuilder.inscribe.mockResolvedValue({
        confirmed: true,
        result: {
          jobId: '0.0.1234@1234567890.123456789',
        },
        inscription: {
          inscriptionId: 'insc_nft_123',
        },
        sdk: {} as any,
      });

      const result = await tool._execute({
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

      expect(result).toBe('Successfully inscribed Hashinal NFT "My Cool NFT". Transaction ID: 0.0.1234@1234567890.123456789. Inscription ID: insc_nft_123');
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
      const tool = new RetrieveInscriptionTool({ inscriberBuilder: mockInscriberBuilder });

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

      const result = await tool._execute({
        transactionId: '0.0.1234@1234567890.123456789',
      });

      const parsed = JSON.parse(result);
      expect(parsed.inscriptionId).toBe('insc_123456');
      expect(parsed.status).toBe('completed');
      expect(parsed.fileUrl).toBe('https://storage.example.com/file.png');
    });

    it('should handle retrieval errors', async () => {
      const tool = new RetrieveInscriptionTool({ inscriberBuilder: mockInscriberBuilder });

      mockInscriberBuilder.retrieveInscription.mockRejectedValue(
        new Error('Inscription not found')
      );

      await expect(tool._execute({
        transactionId: '0.0.9999@1234567890.123456789',
      })).rejects.toThrow('Failed to retrieve inscription: Error: Inscription not found');
    });
  });
});