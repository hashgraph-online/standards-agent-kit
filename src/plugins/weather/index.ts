import { BasePlugin, GenericPluginContext, BaseHederaQueryTool, HederaTool, HederaAgentKit } from 'hedera-agent-kit';
import { z } from 'zod';
import axios from 'axios';

// Define a more specific type for the forecast day data
interface ForecastDayData {
  date: string;
  day: {
    avgtemp_f: number;
    avgtemp_c: number;
    condition: {
      text: string;
    };
  };
}

/**
 * Example Weather API Plugin for the Standards Agent Kit
 *
 * This plugin demonstrates how to create a plugin that integrates with
 * an external web service (Weather API in this case).
 */

const GetCurrentWeatherSchema = z.object({
  location: z.string().describe('The city and state, e.g. San Francisco, CA'),
  unit: z
    .enum(['celsius', 'fahrenheit'])
    .optional()
    .describe('The unit of temperature'),
});

/**
 * Tool for getting current weather information
 */
class GetCurrentWeatherTool extends BaseHederaQueryTool<typeof GetCurrentWeatherSchema> {
  name = 'get_current_weather';
  description = 'Get the current weather for a location';
  specificInputSchema = GetCurrentWeatherSchema;
  namespace = 'weather';

  constructor(params: { hederaKit: HederaAgentKit; logger?: any; apiKey?: string }) {
    super(params);
    this.apiKey = params.apiKey;
  }

  private apiKey?: string;

  protected async executeQuery(input: z.infer<typeof GetCurrentWeatherSchema>): Promise<string> {
    if (!this.apiKey) {
      return 'Error: Weather API key not configured. Please set weatherApiKey in the plugin configuration.';
    }

    try {
      const response = await axios.get(
        'https://api.weatherapi.com/v1/current.json',
        {
          params: {
            key: this.apiKey,
            q: input.location,
            aqi: 'no',
          },
        }
      );

      const data = response.data;
      const temp =
        input.unit === 'fahrenheit' ? data.current.temp_f : data.current.temp_c;
      const unit = input.unit === 'fahrenheit' ? '°F' : '°C';

      return `Current weather in ${data.location.name}, ${data.location.country}: ${data.current.condition.text}, ${temp}${unit}`;
    } catch (error) {
      return `Error fetching weather data: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }
}

const GetWeatherForecastSchema = z.object({
  location: z.string().describe('The city and state, e.g. San Francisco, CA'),
  days: z
    .number()
    .min(1)
    .max(7)
    .optional()
    .describe('Number of days for the forecast (1-7, default: 3)'),
  unit: z
    .enum(['celsius', 'fahrenheit'])
    .optional()
    .describe('The unit of temperature'),
});

/**
 * Tool for getting weather forecast
 */
class GetWeatherForecastTool extends BaseHederaQueryTool<typeof GetWeatherForecastSchema> {
  name = 'get_weather_forecast';
  description = 'Get the weather forecast for a location';
  specificInputSchema = GetWeatherForecastSchema;
  namespace = 'weather';

  constructor(params: { hederaKit: HederaAgentKit; logger?: any; apiKey?: string }) {
    super(params);
    this.apiKey = params.apiKey;
  }

  private apiKey?: string;

  protected async executeQuery(input: z.infer<typeof GetWeatherForecastSchema>): Promise<string> {
    if (!this.apiKey) {
      return 'Error: Weather API key not configured. Please set weatherApiKey in the plugin configuration.';
    }

    const days = input.days || 3;

    try {
      const response = await axios.get(
        'https://api.weatherapi.com/v1/forecast.json',
        {
          params: {
            key: this.apiKey,
            q: input.location,
            days: days,
            aqi: 'no',
          },
        }
      );

      const data = response.data;
      const unit = input.unit === 'fahrenheit' ? '°F' : '°C';

      let result = `Weather forecast for ${data.location.name}, ${data.location.country}:\n\n`;

      data.forecast.forecastday.forEach((day: ForecastDayData) => {
        const date = new Date(day.date).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        });
        const temp =
          input.unit === 'fahrenheit' ? day.day.avgtemp_f : day.day.avgtemp_c;

        result += `${date}: ${day.day.condition.text}, Avg temp: ${temp}${unit}\n`;
      });

      return result;
    } catch (error) {
      return `Error fetching weather forecast: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }
}

/**
 * Weather API Plugin for the Standards Agent Kit
 * Uses BaseHederaQueryTool for consistent tool architecture
 */
export default class WeatherPlugin extends BasePlugin<GenericPluginContext> {
  id = 'weather-api';
  name = 'Weather API Plugin';
  description = 'Provides tools to access weather data';
  version = '1.0.0';
  author = 'Hashgraph Online';

  private apiKey?: string;
  private tools: HederaTool[] = [];

  override async initialize(context: GenericPluginContext): Promise<void> {
    await super.initialize(context);
    this.apiKey = context.config.weatherApiKey as string | undefined;

    if (!this.apiKey) {
      this.context.logger.warn(
        'Weather API key not provided. Weather tools will not function correctly.'
      );
    }

    this.initializeTools();
  }

  private initializeTools(): void {
    const hederaKit = this.context.config.hederaKit as HederaAgentKit;
    const logger = this.context.logger;

    this.tools = [
      new GetCurrentWeatherTool({ hederaKit, logger, apiKey: this.apiKey }),
      new GetWeatherForecastTool({ hederaKit, logger, apiKey: this.apiKey }),
    ];
  }

  override getTools(): HederaTool[] {
    return this.tools;
  }
}
