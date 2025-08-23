import { z } from 'zod';
import {
  extendZodSchema,
  hasRenderConfig,
  getRenderConfig,
  renderConfigs,
  installZodRenderExtensions,
  createProgressiveSchema,
  extractProgressiveInfo,
  enhanceRenderConfig
} from '../../../src/lib/zod-render/schema-extension';
import { EnhancedRenderConfig } from '../../../src/lib/zod-render/types';

describe('withRender Schema Extensions', () => {
  beforeEach(() => {

    installZodRenderExtensions();
  });

  describe('Basic withRender functionality', () => {
    it('should extend a schema with render configuration', () => {
      const schema = z.string();
      const extendedSchema = extendZodSchema(schema);

      expect(typeof extendedSchema.withRender).toBe('function');
      expect(typeof extendedSchema.withProgressive).toBe('function');
      expect(typeof extendedSchema.withBlock).toBe('function');
    });

    it('should store render configuration in schema', () => {
      const config: EnhancedRenderConfig = {
        fieldType: 'text',
        ui: { label: 'Test Field', priority: 'essential' },
        progressive: { priority: 'essential' }
      };

      const schema = extendZodSchema(z.string()).withRender(config);

      expect(hasRenderConfig(schema)).toBe(true);
      expect(getRenderConfig(schema)).toEqual(config);
    });

    it('should support progressive disclosure configuration', () => {
      const schema = extendZodSchema(z.string()).withProgressive('essential', 'Basic Info');

      const progressiveInfo = extractProgressiveInfo(schema);
      expect(progressiveInfo.priority).toBe('essential');
      expect(progressiveInfo.group).toBe('Basic Info');
    });

    it('should support block configuration', () => {
      const schema = extendZodSchema(z.string()).withBlock('account-input');

      const config = getRenderConfig(schema);
      expect(config?.block?.id).toBe('account-input');
      expect(config?.block?.type).toBe('field');
      expect(config?.block?.reusable).toBe(true);
    });
  });

  describe('Progressive disclosure helpers', () => {
    it('should create essential field configurations', () => {
      const config = renderConfigs.essential.text('Name', 'Enter your name');

      expect(config.fieldType).toBe('text');
      expect(config.ui?.label).toBe('Name');
      expect(config.ui?.placeholder).toBe('Enter your name');
      expect(config.ui?.priority).toBe('essential');
      expect(config.progressive?.priority).toBe('essential');
    });

    it('should create advanced field configurations', () => {
      const config = renderConfigs.advanced.number('Batch Size', 1, 100);

      expect(config.fieldType).toBe('number');
      expect(config.ui?.label).toBe('Batch Size');
      expect(config.ui?.priority).toBe('advanced');
      expect(config.progressive?.priority).toBe('advanced');
      expect(config.constraints?.min).toBe(1);
      expect(config.constraints?.max).toBe(100);
    });

    it('should create expert field configurations', () => {
      const config = renderConfigs.expert.textarea('Debug Info', 5);

      expect(config.fieldType).toBe('textarea');
      expect(config.ui?.label).toBe('Debug Info');
      expect(config.ui?.priority).toBe('expert');
      expect(config.progressive?.priority).toBe('expert');
      expect(config.props?.rows).toBe(5);
    });
  });

  describe('Global prototype extension', () => {
    it('should add withRender to all Zod schemas', () => {
      const stringSchema = z.string();
      const numberSchema = z.number();
      const objectSchema = z.object({ name: z.string() });

      expect(typeof (stringSchema as any).withRender).toBe('function');
      expect(typeof (numberSchema as any).withProgressive).toBe('function');
      expect(typeof (objectSchema as any).withBlock).toBe('function');
    });

    it('should work with chained configurations', () => {
      const schema = (z.string() as any)
        .withProgressive('essential', 'Basic Info')
        .withRender({ ui: { helpText: 'This is required' } });

      const config = getRenderConfig(schema);
      expect(config?.progressive?.priority).toBe('essential');
      expect(config?.progressive?.group).toBe('Basic Info');
      expect(config?.ui?.helpText).toBe('This is required');
    });
  });

  describe('Progressive schema creation', () => {
    it('should create schemas with grouped fields', () => {
      const baseSchema = z.object({
        name: z.string(),
        symbol: z.string(),
        batchSize: z.number().optional(),
        adminKey: z.string().optional()
      });

      const groups = {
        'Basic Info': { priority: 'essential' as const, fields: ['name', 'symbol'] },
        'Advanced': { priority: 'advanced' as const, fields: ['batchSize', 'adminKey'] }
      };

      const progressiveSchema = createProgressiveSchema(baseSchema, groups);

      expect(hasRenderConfig(progressiveSchema)).toBe(true);
    });
  });

  describe('Legacy compatibility', () => {
    it('should enhance legacy render configs', () => {
      const legacyConfig = {
        fieldType: 'text' as const,
        ui: { label: 'Test', priority: 'advanced' as const }
      };

      const enhanced = enhanceRenderConfig(legacyConfig);

      expect(enhanced.progressive?.priority).toBe('advanced');
      expect(enhanced.ui?.label).toBe('Test');
    });

    it('should handle configs without priority', () => {
      const legacyConfig = {
        fieldType: 'text' as const,
        ui: { label: 'Test' }
      };

      const enhanced = enhanceRenderConfig(legacyConfig);

      expect(enhanced.progressive?.priority).toBe('common');
    });
  });

  describe('Real-world usage patterns', () => {
    it('should support individual field progressive disclosure', () => {

      const tokenIdField = (z.string() as any).withProgressive('essential', 'Basic Info');
      const batchSizeField = (z.number().optional() as any).withProgressive('advanced', 'Performance');
      const timeoutField = (z.number().optional() as any).withProgressive('expert', 'Technical');

      const tokenIdInfo = extractProgressiveInfo(tokenIdField);
      expect(tokenIdInfo.priority).toBe('essential');
      expect(tokenIdInfo.group).toBe('Basic Info');

      const batchSizeInfo = extractProgressiveInfo(batchSizeField);
      expect(batchSizeInfo.priority).toBe('advanced');
      expect(batchSizeInfo.group).toBe('Performance');

      const timeoutInfo = extractProgressiveInfo(timeoutField);
      expect(timeoutInfo.priority).toBe('expert');
      expect(timeoutInfo.group).toBe('Technical');
    });

    it('should support complex NFT schema configuration', () => {
      const nftSchema = z.object({
        tokenId: z.string(),
        name: z.string(),
        description: z.string().optional(),
        batchSize: z.number().optional(),
        timeoutMs: z.number().optional()
      });

      const enhancedSchema = (nftSchema as any).withRender({
        fieldType: 'object',
        progressive: {
          priority: 'common',
          group: 'NFT Creation'
        }
      });

      expect(hasRenderConfig(enhancedSchema)).toBe(true);
      const config = getRenderConfig(enhancedSchema);
      expect(config?.progressive?.priority).toBe('common');
      expect(config?.progressive?.group).toBe('NFT Creation');
    });
  });
});