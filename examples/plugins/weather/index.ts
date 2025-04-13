import { BasePlugin, PluginContext } from '../../../src/plugins';
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import axios from 'axios';

/**
 * Example Weather API Plugin for the Standards Agent Kit
 * 
 * This plugin demonstrates how to create a plugin that integrates with
 * an external web service (Weather API in this case).
 */

/**
 * Tool for getting current weather information
 */
class GetCurrentWeatherTool extends StructuredTool {
  name = 'get_current_weather';
  description = 'Get the current weather for a location';
  
  schema = z.object({
    location: z.string().describe('The city and state, e.g. San Francisco, CA'),
    unit: z.enum(['celsius', 'fahrenheit']).optional().describe('The unit of temperature')
  });
  
  constructor(private apiKey?: string) {
    super();
  }
  
  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    if (!this.apiKey) {
      return 'Error: Weather API key not configured. Please set weatherApiKey in the plugin configuration.';
    }
    
    try {
      const response = await axios.get('https://api.weatherapi.com/v1/current.json', {
        params: {
          key: this.apiKey,
          q: input.location,
          aqi: 'no'
        }
      });
      
      const data = response.data;
      const temp = input.unit === 'fahrenheit' 
        ? data.current.temp_f 
        : data.current.temp_c;
      const unit = input.unit === 'fahrenheit' ? '°F' : '°C';
      
      return `Current weather in ${data.location.name}, ${data.location.country}: ${data.current.condition.text}, ${temp}${unit}`;
    } catch (error) {
      return `Error fetching weather data: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Tool for getting weather forecast
 */
class GetWeatherForecastTool extends StructuredTool {
  name = 'get_weather_forecast';
  description = 'Get the weather forecast for a location';
  
  schema = z.object({
    location: z.string().describe('The city and state, e.g. San Francisco, CA'),
    days: z.number().min(1).max(7).optional().describe('Number of days for the forecast (1-7, default: 3)'),
    unit: z.enum(['celsius', 'fahrenheit']).optional().describe('The unit of temperature')
  });
  
  constructor(private apiKey?: string) {
    super();
  }
  
  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    if (!this.apiKey) {
      return 'Error: Weather API key not configured. Please set weatherApiKey in the plugin configuration.';
    }
    
    const days = input.days || 3;
    
    try {
      const response = await axios.get('https://api.weatherapi.com/v1/forecast.json', {
        params: {
          key: this.apiKey,
          q: input.location,
          days: days,
          aqi: 'no'
        }
      });
      
      const data = response.data;
      const unit = input.unit === 'fahrenheit' ? '°F' : '°C';
      
      let result = `Weather forecast for ${data.location.name}, ${data.location.country}:\n\n`;
      
      data.forecast.forecastday.forEach((day: any) => {
        const date = new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        const temp = input.unit === 'fahrenheit' ? day.day.avgtemp_f : day.day.avgtemp_c;
        
        result += `${date}: ${day.day.condition.text}, Avg temp: ${temp}${unit}\n`;
      });
      
      return result;
    } catch (error) {
      return `Error fetching weather forecast: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Weather API Plugin for the Standards Agent Kit
 */
export default class WeatherPlugin extends BasePlugin {
  id = 'weather-api';
  name = 'Weather API Plugin';
  description = 'Provides tools to access weather data';
  version = '1.0.0';
  author = 'Hashgraph Online';
  
  private apiKey?: string;
  
  async initialize(context: PluginContext): Promise<void> {
    await super.initialize(context);
    this.apiKey = context.config.weatherApiKey;
    
    if (!this.apiKey) {
      this.context.logger.warn('Weather API key not provided. Weather tools will not function correctly.');
    }
  }
  
  getTools(): StructuredTool[] {
    return [
      new GetCurrentWeatherTool(this.apiKey),
      new GetWeatherForecastTool(this.apiKey)
    ];
  }
}
