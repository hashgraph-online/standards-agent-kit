import { HbarPricePlugin } from '../../src/plugins/hedera/HbarPricePlugin';
import { GenericPluginContext } from '../../src/plugins/PluginInterface';

describe('HbarPricePlugin', () => {
  let plugin: HbarPricePlugin;
  let mockContext: GenericPluginContext;

  beforeEach(() => {
    mockContext = {
      config: {
        hederaKit: {
          query: jest.fn().mockReturnValue({
            getHbarPrice: jest.fn().mockResolvedValue(0.05) // Mock HBAR price
          }),
          logger: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          }
        },
      },
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
    };

    plugin = new HbarPricePlugin();
  });

  it('should initialize properly', async () => {
    await plugin.initialize(mockContext);

    expect(plugin.id).toBe('hedera-hbar-price');
    expect(plugin.name).toBe('Hedera HBAR Price Plugin');
    expect(plugin.description).toBe('Provides tools to interact with Hedera network data, specifically HBAR price.');
  });

  it('should provide HBAR price tool', async () => {
    await plugin.initialize(mockContext);

    const tools = plugin.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('hedera-get-hbar-price');
  });

  describe('HbarPricePlugin Tools - Integration Test', () => {
    it('GetHbarPriceTool should fetch real price from Hedera Mirror Node', async () => {
      let errorOccurred = null;
      let result = '';

      try {
        await plugin.initialize(mockContext);
        const tools = plugin.getTools();
        const hbarPriceTool = tools[0];

        result = await hbarPriceTool._call({});
      } catch (error) {
        errorOccurred = error;
      }

      console.log('Integration Test Result:', result);
      console.error('Integration Test Error Log (if any):', errorOccurred);

      expect(errorOccurred).toBeNull();
      expect(typeof result).toBe('string');
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.priceUsd).toBe(0.05);
    });
  });

});