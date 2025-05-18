
import { GenericPluginContext } from '../../../src/plugins/PluginInterface';
import { StructuredTool } from '@langchain/core/tools';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { GenericPlugin } from '../../../src';

/**
 * Example generic weather plugin that works across different client implementations
 */
export class GenericWeatherPlugin extends GenericPlugin {
  id = 'generic-weather-plugin';
  name = 'Weather Plugin';
  description = 'Provides tools to check weather information';
  version = '1.0.0';
  author = 'Example Author';

  private apiKey: string | undefined;

  async initialize(context: GenericPluginContext): Promise<void> {
    await super.initialize(context);
    this.apiKey = this.context.config.weatherApiKey as string;

    if (!this.apiKey) {
      this.context.logger.warn('Weather API key not provided in config - plugin functionality will be limited');
    }


    this.context.logger.info(`Initialized GenericWeatherPlugin on network: ${this.context.client.getNetwork()}`);
  }

  getTools(): StructuredTool[] {
    return [
      new DynamicStructuredTool({
        name: 'check_weather',
        description: 'Checks the weather for a specific location',
        schema: z.object({
          location: z.string().describe('The location to check weather for'),
        }),
        func: async ({ location }: { location: string }): Promise<string> => {
          if (!this.apiKey) {
            return 'Weather API key not configured. Please check plugin configuration.';
          }

          // In a real implementation, this would make an API call
          return `Weather for ${location}: Sunny, 22°C, Network: ${this.context.client.getNetwork()}`;
        },
      }),
    ];
  }
}