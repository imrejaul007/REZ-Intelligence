/**
 * REZ Context Engine - Weather Service
 * Provides weather-based multipliers for demand prediction
 */

import Redis from 'ioredis';
import crypto from 'crypto';
import { logger } from './utils/logger';

// Crypto-based random number generator for secure randomness
function secureRandom(): number {
  return parseInt(crypto.randomBytes(4).toString('hex'), 16) / 0xFFFFFFFF;
}

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || '';
const WEATHER_API_URL = process.env.WEATHER_API_URL || 'https://api.openweathermap.org/data/2.5';

export interface WeatherData {
  city: string;
  coordinates: { lat: number; lon: number };
  condition: WeatherCondition;
  temperature: number; // Celsius
  humidity: number;
  windSpeed: number;
  description: string;
  timestamp: Date;
}

export type WeatherCondition =
  | 'clear'
  | 'cloudy'
  | 'rain'
  | 'heavy_rain'
  | 'storm'
  | 'snow'
  | 'fog'
  | 'hot'
  | 'cold';

export interface WeatherMultiplier {
  condition: WeatherCondition;
  outdoorMultiplier: number;
  indoorMultiplier: number;
  deliveryMultiplier: number;
  rideMultiplier: number;
  reason: string;
}

const WEATHER_MULTIPLIERS: Record<WeatherCondition, Omit<WeatherMultiplier, 'condition'>> = {
  clear: {
    outdoorMultiplier: 1.2,
    indoorMultiplier: 0.9,
    deliveryMultiplier: 0.85,
    rideMultiplier: 1.1,
    reason: 'Clear weather boosts outdoor activities'
  },
  cloudy: {
    outdoorMultiplier: 1.0,
    indoorMultiplier: 1.0,
    deliveryMultiplier: 1.0,
    rideMultiplier: 1.0,
    reason: 'Moderate weather'
  },
  rain: {
    outdoorMultiplier: 0.4,
    indoorMultiplier: 1.4,
    deliveryMultiplier: 1.5,
    rideMultiplier: 1.3,
    reason: 'Rain increases indoor activities and delivery demand'
  },
  heavy_rain: {
    outdoorMultiplier: 0.2,
    indoorMultiplier: 1.6,
    deliveryMultiplier: 1.8,
    rideMultiplier: 1.5,
    reason: 'Heavy rain drives people indoors'
  },
  storm: {
    outdoorMultiplier: 0.1,
    indoorMultiplier: 1.8,
    deliveryMultiplier: 2.0,
    rideMultiplier: 1.8,
    reason: 'Storm conditions maximize indoor/delivery demand'
  },
  snow: {
    outdoorMultiplier: 0.3,
    indoorMultiplier: 1.5,
    deliveryMultiplier: 1.6,
    rideMultiplier: 1.4,
    reason: 'Snow increases indoor activities'
  },
  fog: {
    outdoorMultiplier: 0.7,
    indoorMultiplier: 1.2,
    deliveryMultiplier: 1.3,
    rideMultiplier: 1.2,
    reason: 'Fog reduces outdoor visibility'
  },
  hot: {
    outdoorMultiplier: 0.6,
    indoorMultiplier: 1.3,
    deliveryMultiplier: 1.4,
    rideMultiplier: 1.5,
    reason: 'Hot weather increases ride and delivery demand'
  },
  cold: {
    outdoorMultiplier: 0.5,
    indoorMultiplier: 1.4,
    deliveryMultiplier: 1.2,
    rideMultiplier: 1.3,
    reason: 'Cold weather drives indoor dining'
  }
};

export class WeatherService {
  private redis: Redis;
  private cacheTTL = 1800; // 30 minutes

  constructor() {
    this.redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  async connect(): Promise<void> {
    await this.redis.connect();
    logger.info('Weather service connected to Redis');
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * Get weather data for a city
   */
  async getWeather(city: string, coordinates?: { lat: number; lon: number }): Promise<WeatherData | null> {
    const cacheKey = `weather:${city.toLowerCase()}`;

    try {
      // Check cache
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as WeatherData;
      }

      // Fetch from API if key available
      if (WEATHER_API_KEY && coordinates) {
        const weather = await this.fetchFromAPI(coordinates);
        if (weather) {
          await this.redis.setex(cacheKey, this.cacheTTL, JSON.stringify(weather));
          return weather;
        }
      }

      // Return simulated data for development
      return this.getSimulatedWeather(city);
    } catch (error) {
      logger.error('Weather fetch error', { city, error });
      return this.getSimulatedWeather(city);
    }
  }

  /**
   * Fetch weather from OpenWeatherMap API
   */
  private async fetchFromAPI(coordinates: { lat: number; lon: number }): Promise<WeatherData | null> {
    try {
      const response = await fetch(
        `${WEATHER_API_URL}/weather?lat=${coordinates.lat}&lon=${coordinates.lon}&appid=${WEATHER_API_KEY}&units=metric`
      );

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json() as {
        name: string;
        weather: Array<{ main: string; description: string }>;
        main: { temp: number; humidity: number };
        wind: { speed: number };
      };

      return {
        city: data.name,
        coordinates,
        condition: this.mapCondition(data.weather[0]?.main || 'Clear'),
        temperature: data.main.temp,
        humidity: data.main.humidity,
        windSpeed: data.wind.speed,
        description: data.weather[0]?.description || 'clear sky',
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Weather API fetch failed', { error });
      return null;
    }
  }

  /**
   * Map weather API condition to our condition type
   */
  private mapCondition(apiCondition: string): WeatherCondition {
    const conditionMap: Record<string, WeatherCondition> = {
      'Clear': 'clear',
      'Clouds': 'cloudy',
      'Rain': 'rain',
      'Drizzle': 'rain',
      'Thunderstorm': 'storm',
      'Snow': 'snow',
      'Mist': 'fog',
      'Fog': 'fog',
      'Haze': 'fog',
    };

    const mapped = conditionMap[apiCondition] || 'cloudy';

    // Check for temperature extremes
    if (mapped === 'clear') {
      // This would need actual temperature data - simplified here
      return 'clear';
    }

    return mapped;
  }

  /**
   * Get simulated weather for development
   */
  private getSimulatedWeather(_city: string): WeatherData {
    const _hour = new Date().getHours();
    const conditions: WeatherCondition[] = ['clear', 'cloudy', 'rain', 'hot', 'cold'];
    const condition = conditions[Math.floor(secureRandom() * conditions.length)];

    let temperature = 25;
    if (condition === 'hot') temperature = 38;
    if (condition === 'cold') temperature = 12;
    if (condition === 'rain') temperature = 22;

    return {
      city,
      coordinates: { lat: 19.0760, lon: 72.8777 }, // Mumbai default
      condition,
      temperature,
      humidity: condition === 'rain' ? 85 : 55,
      windSpeed: condition === 'storm' ? 40 : 10,
      description: `${condition} weather`,
      timestamp: new Date()
    };
  }

  /**
   * Get demand multipliers based on weather
   */
  getMultipliers(weather: WeatherData): WeatherMultiplier {
    const multipliers = WEATHER_MULTIPLIERS[weather.condition];
    return {
      condition: weather.condition,
      ...multipliers
    };
  }

  /**
   * Get context for a specific category
   */
  async getCategoryMultiplier(
    city: string,
    category: 'outdoor' | 'indoor' | 'delivery' | 'ride',
    coordinates?: { lat: number; lon: number }
  ): Promise<{ multiplier: number; reason: string; weather: WeatherData | null }> {
    const weather = await this.getWeather(city, coordinates);

    if (!weather) {
      return { multiplier: 1.0, reason: 'Weather data unavailable', weather: null };
    }

    const multipliers = this.getMultipliers(weather);
    const categoryKey = `${category}Multiplier` as keyof Omit<WeatherMultiplier, 'condition'>;

    return {
      multiplier: multipliers[categoryKey] as number,
      reason: multipliers.reason,
      weather
    };
  }

  /**
   * Batch fetch weather for multiple cities
   */
  async getBatchWeather(cities: string[]): Promise<Map<string, WeatherData>> {
    const results = new Map<string, WeatherData>();

    await Promise.all(
      cities.map(async (city) => {
        const weather = await this.getWeather(city);
        if (weather) {
          results.set(city, weather);
        }
      })
    );

    return results;
  }
}

export const weatherService = new WeatherService();
