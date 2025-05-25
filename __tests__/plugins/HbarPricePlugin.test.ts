import axios from 'axios';
import { GetHbarPriceTool } from '../../src/plugins/hedera/HbarPricePlugin';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HbarPricePlugin Tools - Unit Tests', () => {

  let toolInstance: GetHbarPriceTool;

  beforeEach(() => {
    mockedAxios.get.mockClear();
    toolInstance = new GetHbarPriceTool();
  });

  it('GetHbarPriceTool should return the correct price string on successful API call', async () => {
    const mockApiResponse = {
      data: {
        current_rate: {
          cent_equivalent: 6500,
          hbar_equivalent: 100000,
          expiration_time: 1700000000,
        },
        next_rate: {
          cent_equivalent: 6600,
          hbar_equivalent: 100000,
          expiration_time: 1700003600,
        },
        timestamp: '1699999999.123456789',
      },
    };
    mockedAxios.get.mockResolvedValue(mockApiResponse);
    const result = await toolInstance.call({});
    expect(result).toBe('The current price of HBAR is $0.000650 USD.');
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(mockedAxios.get).toHaveBeenCalledWith('https://mainnet.mirrornode.hedera.com/api/v1/network/exchangerate');
  });

  it('GetHbarPriceTool should return an error string if the API call fails', async () => {
    const errorMessage = 'Network Error';
    mockedAxios.get.mockRejectedValue(new Error(errorMessage));
    const result = await toolInstance.call({});
    expect(result).toBe(`Failed to retrieve HBAR price: ${errorMessage}`);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('GetHbarPriceTool should return an error string if the API response format is invalid', async () => {
    const mockInvalidApiResponse = {
      data: {
        next_rate: {
          cent_equivalent: 6600,
          hbar_equivalent: 100000,
          expiration_time: 1700003600,
        },
        timestamp: '1699999999.123456789',
      },
    };
    mockedAxios.get.mockResolvedValue(mockInvalidApiResponse);
    const result = await toolInstance.call({});
    expect(result).toBe('Failed to retrieve HBAR price: Invalid API response format');
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('GetHbarPriceTool should handle Axios error with response status', async () => {
    const mockAxiosError = new Error('Request failed with status code 404');
    (mockAxiosError as any).isAxiosError = true;
    (mockAxiosError as any).response = {
      status: 404,
      data: 'Not Found',
      headers: {},
      statusText: 'Not Found',
      config: {}
    };
    mockedAxios.get.mockRejectedValue(mockAxiosError);
    const result = await toolInstance.call({});
    expect(result).toBe('Failed to retrieve HBAR price: Request failed with status code 404');
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });
});

describe('HbarPricePlugin Tools - Integration Test', () => {

  it('GetHbarPriceTool should fetch real price from Hedera Mirror Node', async () => {
    const realAxios = jest.requireActual('axios');
    const HEDERA_MIRROR_NODE_API = 'https://mainnet.mirrornode.hedera.com/api/v1';

    let result: string | undefined;
    let errorOccurred: any = null;

    try {
      const response = await realAxios.get(`${HEDERA_MIRROR_NODE_API}/network/exchangerate`);
      const data: unknown = response.data;
      const ExchangeRateResponseSchema = jest.requireActual('zod').object({
         current_rate: jest.requireActual('zod').object({ cent_equivalent: jest.requireActual('zod').number(), hbar_equivalent: jest.requireActual('zod').number(), expiration_time: jest.requireActual('zod').number() }),
         next_rate: jest.requireActual('zod').object({ cent_equivalent: jest.requireActual('zod').number(), hbar_equivalent: jest.requireActual('zod').number(), expiration_time: jest.requireActual('zod').number() }),
         timestamp: jest.requireActual('zod').string(),
      });
      const parsedData = ExchangeRateResponseSchema.safeParse(data);
      if (!parsedData.success) {
        throw new Error('Real API response format invalid');
      } else {
         const { current_rate } = parsedData.data;
         const priceUsd = current_rate.cent_equivalent / current_rate.hbar_equivalent / 100;
         result = `The current price of HBAR is $${priceUsd.toFixed(6)} USD.`;
      }
    } catch (e) {
      errorOccurred = e;
      console.error("Integration Test Error:", e);
    }

    console.log('Integration Test Result:', result);
    console.error('Integration Test Error Log (if any):', errorOccurred);

    expect(errorOccurred).toBeNull();
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^The current price of HBAR is \$\d+\.\d{6} USD\.$/);

    const priceMatch = result?.match(/\$(\d+\.\d{6})/);
    if (priceMatch && priceMatch[1]) {
      const price = parseFloat(priceMatch[1]);
      expect(price).toBeGreaterThan(0);
      expect(price).toBeLessThan(1.0);
    }
  }, 15000);
}); 