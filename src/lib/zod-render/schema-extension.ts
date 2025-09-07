import { ZodType } from 'zod';
import { RenderConfigSchema, EnhancedRenderConfig, ZodSchemaWithRender, FormFieldType, FieldMetadata, SelectOption } from './types';

interface ExtendedZodSchema {
  description?: string;
  merge?: (other: ZodType<unknown>) => ZodType<unknown>;
  extend?: (extensions: Record<string, ZodType<unknown>>) => ZodType<unknown>;
  pick?: (fields: Record<string, boolean>) => ZodType<unknown>;
  omit?: (fields: Record<string, boolean>) => ZodType<unknown>;
  withRender?: (config: EnhancedRenderConfig | RenderConfigSchema) => ZodSchemaWithRender<unknown>;
  withProgressive?: (priority: 'essential' | 'common' | 'advanced' | 'expert', group?: string) => ZodSchemaWithRender<unknown>;
  withBlock?: (blockId: string) => ZodSchemaWithRender<unknown>;
}

/**
 * Extends a Zod schema with render configuration capabilities
 */
export function extendZodSchema<TSchema>(schema: ZodType<TSchema>): ZodSchemaWithRender<TSchema> {
  const extendedSchema = schema as ZodSchemaWithRender<TSchema>;

  extendedSchema.withRender = function(config: EnhancedRenderConfig | RenderConfigSchema): ZodSchemaWithRender<TSchema> {
    const newSchema = Object.create(this);
    const currentConfig = this._renderConfig || {} as EnhancedRenderConfig;

    const mergedConfig: EnhancedRenderConfig = {
      ...currentConfig,
      ...config,
      ui: {
        ...(currentConfig.ui || {}),
        ...(config.ui || {})
      }
    };

    if (currentConfig.progressive || (config as EnhancedRenderConfig).progressive) {
      mergedConfig.progressive = {
        ...(currentConfig.progressive || {} as NonNullable<EnhancedRenderConfig['progressive']>),
        ...((config as EnhancedRenderConfig).progressive || {} as NonNullable<EnhancedRenderConfig['progressive']>)
      };
    }

    if (currentConfig.block || (config as EnhancedRenderConfig).block) {
      mergedConfig.block = {
        ...(currentConfig.block || {} as NonNullable<EnhancedRenderConfig['block']>),
        ...((config as EnhancedRenderConfig).block || {} as NonNullable<EnhancedRenderConfig['block']>)
      };
    }

    (newSchema as ZodSchemaWithRender<TSchema>)._renderConfig = mergedConfig;
    (newSchema as ZodSchemaWithRender<TSchema>).withRender = extendedSchema.withRender;
    (newSchema as ZodSchemaWithRender<TSchema>).withProgressive = extendedSchema.withProgressive;
    (newSchema as ZodSchemaWithRender<TSchema>).withBlock = extendedSchema.withBlock;
    return newSchema as ZodSchemaWithRender<TSchema>;
  };

  extendedSchema.withProgressive = function(
    priority: 'essential' | 'common' | 'advanced' | 'expert',
    group?: string
  ): ZodSchemaWithRender<TSchema> {
    const currentConfig = this._renderConfig || { fieldType: inferFieldTypeFromSchema(schema) };
    return this.withRender({
      ...currentConfig,
      progressive: {
        priority,
        group
      }
    });
  };

  extendedSchema.withBlock = function(blockId: string): ZodSchemaWithRender<TSchema> {
    const currentConfig = this._renderConfig || { fieldType: inferFieldTypeFromSchema(schema) };
    return this.withRender({
      ...currentConfig,
      block: {
        id: blockId,
        type: 'field',
        reusable: true
      }
    });
  };

  return extendedSchema;
}

/**
 * Checks if a schema has render configuration
 */
export function hasRenderConfig(schema: unknown): schema is ZodSchemaWithRender {
  return Boolean(schema && typeof (schema as Record<string, unknown>).withRender === 'function');
}

/**
 * Extracts render configuration from a schema
 */
export function getRenderConfig(schema: ZodType<unknown>): EnhancedRenderConfig | undefined {
  if (hasRenderConfig(schema)) {
    return schema._renderConfig;
  }
  return undefined;
}

/**
 * Infers form field type from Zod schema type with enhanced field detection
 */
export function inferFieldTypeFromSchema(schema: ZodType<unknown>): FormFieldType {
  const typeName = (schema._def as Record<string, unknown>)?.typeName;

  switch (typeName) {
    case 'ZodString': {
      const stringChecks = ((schema._def as Record<string, unknown>)?.checks as Array<Record<string, unknown>>) || [];
      for (const check of stringChecks) {
        if (check.kind === 'email') {return 'text';}
        if (check.kind === 'url') {return 'text';}
      }
      return 'text';
    }

    case 'ZodNumber':
    case 'ZodBigInt':
      return 'number';

    case 'ZodBoolean':
      return 'checkbox';

    case 'ZodEnum':
    case 'ZodNativeEnum':
      return 'select';

    case 'ZodArray':
      return 'array';

    case 'ZodUnion':
    case 'ZodDiscriminatedUnion':
      return 'select';

    case 'ZodDate':
      return 'text';

    case 'ZodObject':
      return 'object';

    case 'ZodOptional':
    case 'ZodDefault': {
      const innerType = (schema._def as Record<string, unknown>)?.innerType as ZodType<unknown>;
      if (innerType) {
        return inferFieldTypeFromSchema(innerType);
      }
      return 'text';
    }

    default:
      return 'text';
  }
}

/**
 * Extracts options from enum, union, or literal schemas
 */
export function extractOptionsFromSchema(schema: ZodType<unknown>): SelectOption[] | undefined {
  const typeName = (schema._def as Record<string, unknown>)?.typeName;

  if (typeName === 'ZodEnum') {
    const values = (schema._def as Record<string, unknown>)?.values;
    if (Array.isArray(values)) {
      return values.map((value: string) => ({
        value,
        label: value.charAt(0).toUpperCase() + value.slice(1).replace(/[_-]/g, ' '),
      }));
    }
  }

  if (typeName === 'ZodNativeEnum') {
    const enumObject = (schema._def as Record<string, unknown>)?.values as Record<string, unknown>;
    if (enumObject) {
      return Object.entries(enumObject).map(([key, value]) => ({
        value,
        label: key.replace(/[_-]/g, ' '),
      }));
    }
  }

  if (typeName === 'ZodUnion') {
    const options: SelectOption[] = [];
    const unionOptions = (schema._def as Record<string, unknown>)?.options as Array<ZodType<unknown>>;

    if (Array.isArray(unionOptions)) {
      for (const option of unionOptions) {
        if ((option._def as Record<string, unknown>)?.typeName === 'ZodLiteral') {
          const value = (option._def as Record<string, unknown>)?.value;
          if (value !== undefined) {
            options.push({
              value,
              label: typeof value === 'string'
                ? value.charAt(0).toUpperCase() + value.slice(1)
                : String(value),
            });
          }
        }
      }
    }

    return options.length > 0 ? options : undefined;
  }

  return undefined;
}

/**
 * Checks if a schema is optional
 */
export function isOptionalSchema(schema: ZodType<unknown>): boolean {
  const typeName = (schema._def as Record<string, unknown>)?.typeName;
  return typeName === 'ZodOptional' || typeName === 'ZodDefault';
}

/**
 * Gets the inner schema from optional/default wrappers
 */
export function getInnerSchema(schema: ZodType<unknown>): ZodType<unknown> {
  const typeName = (schema._def as Record<string, unknown>)?.typeName;
  if (typeName === 'ZodOptional' || typeName === 'ZodDefault') {
    const innerType = (schema._def as Record<string, unknown>)?.innerType as ZodType<unknown>;
    return innerType || schema;
  }
  return schema;
}

/**
 * Extracts validation constraints from a schema with enhanced support
 */
export function extractValidationConstraints(schema: ZodType<unknown>): Record<string, unknown> {
  const innerSchema = getInnerSchema(schema);
  const typeName = (innerSchema._def as Record<string, unknown>)?.typeName;
  const constraints: Record<string, unknown> = {};

  if (typeName === 'ZodString') {
    const def = innerSchema._def as Record<string, unknown>;
    const checks = def.checks as Array<Record<string, unknown>>;
    if (checks && Array.isArray(checks)) {
      for (const check of checks) {
        switch (check.kind) {
          case 'min':
            constraints.minLength = check.value;
            break;
          case 'max':
            constraints.maxLength = check.value;
            break;
          case 'email':
            constraints.type = 'email';
            break;
          case 'url':
            constraints.type = 'url';
            break;
          case 'regex':
            constraints.pattern = check.regex as string;
            break;
        }
      }
    }
  }

  if (typeName === 'ZodNumber') {
    const def = innerSchema._def as Record<string, unknown>;
    const checks = def.checks as Array<Record<string, unknown>>;
    if (checks && Array.isArray(checks)) {
      for (const check of checks) {
        switch (check.kind) {
          case 'min':
            constraints.min = check.value;
            break;
          case 'max':
            constraints.max = check.value;
            break;
          case 'int':
            constraints.step = 1;
            break;
          case 'multipleOf':
            constraints.step = check.value;
            break;
        }
      }
    }
  }

  if (typeName === 'ZodArray') {
    const def = innerSchema._def as Record<string, unknown>;
    const minLength = def.minLength as Record<string, unknown> | undefined;
    const maxLength = def.maxLength as Record<string, unknown> | undefined;
    if (minLength !== undefined) {
      constraints.minItems = minLength.value;
    }
    if (maxLength !== undefined) {
      constraints.maxItems = maxLength.value;
    }
  }

  return constraints;
}

/**
 * Gets default value from schema with comprehensive type support
 */
export function getDefaultValue(schema: ZodType<unknown>): unknown {
  const typeName = (schema._def as Record<string, unknown>)?.typeName;
  if (typeName === 'ZodDefault') {
    const defaultValue = (schema._def as Record<string, unknown>)?.defaultValue;
    if (typeof defaultValue === 'function') {
      return (defaultValue as () => unknown)();
    }
    return defaultValue;
  }

  const innerSchema = getInnerSchema(schema);
  const innerTypeName = (innerSchema._def as Record<string, unknown>)?.typeName;

  switch (innerTypeName) {
    case 'ZodString':
      return '';
    case 'ZodNumber':
    case 'ZodBigInt':
      return 0;
    case 'ZodBoolean':
      return false;
    case 'ZodArray':
      return [];
    case 'ZodObject': {
      const shape = (innerSchema._def as Record<string, unknown>)?.shape as Record<string, ZodType<unknown>>;
      if (shape) {
        const defaultObj: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(shape)) {
          defaultObj[key] = getDefaultValue(value);
        }
        return defaultObj;
      }
      return {};
    }
    case 'ZodDate':
      return new Date();
    case 'ZodEnum': {
      const values = (innerSchema._def as Record<string, unknown>)?.values as unknown[];
      return Array.isArray(values) && values.length > 0 ? values[0] : undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Extracts field metadata from schema including render configuration
 */
export function extractFieldMetadata(schema: ZodType<unknown>): FieldMetadata {
  const innerSchema = getInnerSchema(schema);
  const fieldType = inferFieldTypeFromSchema(schema);
  const required = !isOptionalSchema(schema);
  const optional = isOptionalSchema(schema);
  const defaultValue = getDefaultValue(schema);
  const options = extractOptionsFromSchema(innerSchema);
  const constraints = extractValidationConstraints(schema);
  const description = (schema as ZodType<unknown> & ExtendedZodSchema)?.description;

  return {
    type: fieldType,
    required,
    optional,
    default: defaultValue,
    options,
    constraints,
    description,
    validation: {
      minLength: constraints.minLength as number,
      maxLength: constraints.maxLength as number,
      min: constraints.min as number,
      max: constraints.max as number,
      pattern: constraints.pattern ? new RegExp(constraints.pattern as string) : undefined,
    }
  };
}



/**
 * Helper function to create common render configurations
 */
export const renderConfigs = {
  text: (label: string, placeholder?: string, priority: 'essential' | 'common' | 'advanced' | 'expert' = 'common'): EnhancedRenderConfig => ({
    fieldType: 'text',
    ui: { label, placeholder, priority },
    progressive: { priority }
  }),

  number: (label: string, min?: number, max?: number, priority: 'essential' | 'common' | 'advanced' | 'expert' = 'common'): EnhancedRenderConfig => ({
    fieldType: 'number',
    ui: { label, priority },
    constraints: { min, max },
    progressive: { priority }
  }),

  select: (label: string, options: SelectOption[], priority: 'essential' | 'common' | 'advanced' | 'expert' = 'common'): EnhancedRenderConfig => ({
    fieldType: 'select',
    ui: { label, priority },
    options,
    progressive: { priority }
  }),

  textarea: (label: string, rows = 3, priority: 'essential' | 'common' | 'advanced' | 'expert' = 'common'): EnhancedRenderConfig => ({
    fieldType: 'textarea',
    ui: { label, priority },
    props: { rows },
    progressive: { priority }
  }),

  currency: (label: string, symbol = 'HBAR', priority: 'essential' | 'common' | 'advanced' | 'expert' = 'common'): EnhancedRenderConfig => ({
    fieldType: 'currency',
    ui: { label, priority },
    props: { symbol },
    progressive: { priority }
  }),

  array: (label: string, itemLabel?: string, priority: 'essential' | 'common' | 'advanced' | 'expert' = 'advanced'): EnhancedRenderConfig => ({
    fieldType: 'array',
    ui: { label, priority },
    props: { itemLabel },
    progressive: { priority }
  }),

  essential: {
    text: (label: string, placeholder?: string) => renderConfigs.text(label, placeholder, 'essential'),
    number: (label: string, min?: number, max?: number) => renderConfigs.number(label, min, max, 'essential'),
    select: (label: string, options: SelectOption[]) => renderConfigs.select(label, options, 'essential'),
    textarea: (label: string, rows?: number) => renderConfigs.textarea(label, rows, 'essential'),
  },

  advanced: {
    text: (label: string, placeholder?: string) => renderConfigs.text(label, placeholder, 'advanced'),
    number: (label: string, min?: number, max?: number) => renderConfigs.number(label, min, max, 'advanced'),
    select: (label: string, options: SelectOption[]) => renderConfigs.select(label, options, 'advanced'),
    textarea: (label: string, rows?: number) => renderConfigs.textarea(label, rows, 'advanced'),
    array: (label: string, itemLabel?: string) => renderConfigs.array(label, itemLabel, 'advanced'),
  },

  expert: {
    text: (label: string, placeholder?: string) => renderConfigs.text(label, placeholder, 'expert'),
    number: (label: string, min?: number, max?: number) => renderConfigs.number(label, min, max, 'expert'),
    select: (label: string, options: SelectOption[]) => renderConfigs.select(label, options, 'expert'),
    textarea: (label: string, rows?: number) => renderConfigs.textarea(label, rows, 'expert'),
  }
};

/**
 * Extends Zod prototype to add withRender functionality globally
 */
export function installZodRenderExtensions() {
  if (!(ZodType.prototype as typeof ZodType.prototype & ExtendedZodSchema).withRender) {
    (ZodType.prototype as typeof ZodType.prototype & ExtendedZodSchema).withRender = function(config: EnhancedRenderConfig | RenderConfigSchema) {
      return extendZodSchema(this).withRender(config);
    };

    (ZodType.prototype as typeof ZodType.prototype & ExtendedZodSchema).withProgressive = function(
      priority: 'essential' | 'common' | 'advanced' | 'expert',
      group?: string
    ) {
      return extendZodSchema(this).withProgressive(priority, group);
    };

    (ZodType.prototype as typeof ZodType.prototype & ExtendedZodSchema).withBlock = function(blockId: string) {
      return extendZodSchema(this).withBlock(blockId);
    };
  }
}

/**
 * Creates a progressive form schema with grouped fields
 */
export function createProgressiveSchema<TSchema>(
  baseSchema: ZodType<TSchema>,
  groups: Record<string, { priority: 'essential' | 'common' | 'advanced' | 'expert'; fields: string[] }>
): ZodSchemaWithRender<TSchema> {
  const extendedSchema = extendZodSchema(baseSchema);

  const typeName = (baseSchema._def as Record<string, unknown>)?.typeName;
  if (typeName === 'ZodObject') {
    const shape = (baseSchema._def as Record<string, unknown>)?.shape as Record<string, ZodType<unknown>>;
    if (shape) {
      const enhancedShape: Record<string, ZodType<unknown>> = {};

      for (const [fieldName, fieldSchema] of Object.entries(shape)) {
        let fieldGroup: string | undefined;
        let fieldPriority: 'essential' | 'common' | 'advanced' | 'expert' = 'common';

        for (const [groupName, groupConfig] of Object.entries(groups)) {
          if (groupConfig.fields.includes(fieldName)) {
            fieldGroup = groupName;
            fieldPriority = groupConfig.priority;
            break;
          }
        }

        enhancedShape[fieldName] = extendZodSchema(fieldSchema).withProgressive(fieldPriority, fieldGroup);
      }

      return extendedSchema;
    }
  }

  return extendedSchema;
}

/**
 * Utility to convert legacy render configs to enhanced configs
 */
export function enhanceRenderConfig(config: RenderConfigSchema): EnhancedRenderConfig {
  return {
    ...config,
    progressive: {
      priority: config.ui?.priority || 'common',
      group: config.ui?.group
    }
  };
}

/**
 * Helper to extract progressive disclosure information from schema
 */
export function extractProgressiveInfo(schema: ZodType<unknown>): {
  priority: 'essential' | 'common' | 'advanced' | 'expert';
  group?: string;
} {
  const renderConfig = getRenderConfig(schema);
  if (renderConfig?.progressive) {
    return {
      priority: renderConfig.progressive.priority,
      group: renderConfig.progressive.group
    };
  }

  if (renderConfig?.ui?.priority) {
    return {
      priority: renderConfig.ui.priority,
      group: renderConfig.ui.group
    };
  }

  return { priority: 'common' };
}