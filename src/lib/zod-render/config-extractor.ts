import { ZodType } from 'zod';

/**
 * Type definitions for Zod internal structures
 */
interface ZodDef {
  typeName: string;
  type?: ZodType<unknown>;
}

/**
 * Type definition for Zod object schema with shape property
 */
interface ZodObjectSchema {
  _def: ZodDef;
  shape: Record<string, ZodType<unknown>>;
}

/**
 * Type definition for Zod array schema with element type
 */
interface ZodArraySchema {
  _def: ZodDef & {
    type: ZodType<unknown>;
  };
}

/**
 * Type definition for field config map entries
 */
interface FieldConfigMapEntry {
  renderConfig: RenderConfigSchema;
  metadata: FieldMetadata;
  path: string[];
}


/**
 * Type definition for simple field configuration
 */
interface SimpleFieldConfig {
  name: string;
  type: FormFieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: Array<{ value: unknown; label: string }>;
}
import {
  RenderConfigSchema,
  ExtractedRenderConfig,
  FieldMetadata,
  FormFieldType
} from './types';
import {
  hasRenderConfig,
  getRenderConfig,
  extractFieldMetadata,
  getInnerSchema
} from './schema-extension';

/**
 * Extracts render configurations from a Zod schema and all nested schemas
 */
export function extractRenderConfigs(schema: ZodType<unknown>): ExtractedRenderConfig {
  const fields: Record<string, RenderConfigSchema> = {};
  const groups: Record<string, string[]> = {};
  const order: string[] = [];
  const metadata: Record<string, FieldMetadata> = {};

  extractFromSchema(schema, '', fields, groups, order, metadata);

  return {
    fields,
    groups: organizeFieldGroups(groups),
    order: orderFields(order, fields),
    metadata
  };
}

/**
 * Recursively extracts render configurations from schema and nested schemas
 */
function extractFromSchema(
  schema: ZodType<unknown>,
  pathPrefix: string,
  fields: Record<string, RenderConfigSchema>,
  groups: Record<string, string[]>,
  order: string[],
  metadata: Record<string, FieldMetadata>
): void {
  const innerSchema = getInnerSchema(schema);
  const typeName = (innerSchema._def as ZodDef)?.typeName;

  if (typeName === 'ZodObject') {
    extractFromObjectSchema(innerSchema as unknown as ZodObjectSchema, pathPrefix, fields, groups, order, metadata);
  } else if (typeName === 'ZodArray') {
    extractFromArraySchema(innerSchema as unknown as ZodArraySchema, pathPrefix, fields, groups, order, metadata);
  } else {
    extractFromPrimitiveSchema(schema, pathPrefix, fields, groups, order, metadata);
  }
}

/**
 * Extracts configurations from ZodObject schemas
 */
function extractFromObjectSchema(
  schema: ZodObjectSchema,
  pathPrefix: string,
  fields: Record<string, RenderConfigSchema>,
  groups: Record<string, string[]>,
  order: string[],
  metadata: Record<string, FieldMetadata>
): void {
  const shape = schema.shape;

  if (hasRenderConfig(schema)) {
    const config = getRenderConfig(schema);
    if (config && pathPrefix) {
      fields[pathPrefix] = config;
      addToGroup(groups, config.ui?.group || 'default', pathPrefix);
      addToOrder(order, pathPrefix, config.ui?.order);
    }
  }

  for (const [key, fieldSchema] of Object.entries(shape)) {
    const fieldPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    extractFromSchema(fieldSchema as ZodType<unknown>, fieldPath, fields, groups, order, metadata);
  }
}

/**
 * Extracts configurations from ZodArray schemas
 */
function extractFromArraySchema(
  schema: ZodArraySchema,
  pathPrefix: string,
  fields: Record<string, RenderConfigSchema>,
  groups: Record<string, string[]>,
  order: string[],
  metadata: Record<string, FieldMetadata>
): void {
  if (hasRenderConfig(schema)) {
    const config = getRenderConfig(schema);
    if (config) {
      fields[pathPrefix] = config;
      addToGroup(groups, config.ui?.group || 'default', pathPrefix);
      addToOrder(order, pathPrefix, config.ui?.order);
      metadata[pathPrefix] = extractFieldMetadata(schema);
    }
  }

  const elementSchema = schema._def.type;
  if (elementSchema) {
    const itemPath = `${pathPrefix}[]`;
    extractFromSchema(elementSchema, itemPath, fields, groups, order, metadata);
  }
}

/**
 * Extracts configurations from primitive schemas
 */
function extractFromPrimitiveSchema(
  schema: ZodType<unknown>,
  pathPrefix: string,
  fields: Record<string, RenderConfigSchema>,
  groups: Record<string, string[]>,
  order: string[],
  metadata: Record<string, FieldMetadata>
): void {
  if (hasRenderConfig(schema)) {
    const config = getRenderConfig(schema);
    if (config) {
      fields[pathPrefix] = config;
      addToGroup(groups, config.ui?.group || 'default', pathPrefix);
      addToOrder(order, pathPrefix, config.ui?.order);
    }
  }

  metadata[pathPrefix] = extractFieldMetadata(schema);
}

/**
 * Adds a field to a group
 */
function addToGroup(groups: Record<string, string[]>, groupName: string, fieldPath: string): void {
  if (!groups[groupName]) {
    groups[groupName] = [];
  }
  groups[groupName].push(fieldPath);
}

/**
 * Adds a field to the order array considering explicit order values
 */
function addToOrder(order: string[], fieldPath: string, explicitOrder?: number): void {
  if (explicitOrder !== undefined) {
    order.splice(explicitOrder, 0, fieldPath);
  } else {
    order.push(fieldPath);
  }
}

/**
 * Organizes field groups with proper ordering
 */
function organizeFieldGroups(groups: Record<string, string[]>): Record<string, string[]> {
  const organized: Record<string, string[]> = {};
  const groupPriority = ['default', 'Keys & Security', 'Token Settings', 'Custom Fees'];

  for (const groupName of groupPriority) {
    if (groups[groupName]) {
      organized[groupName] = groups[groupName];
    }
  }

  for (const [groupName, fields] of Object.entries(groups)) {
    if (!groupPriority.includes(groupName)) {
      organized[groupName] = fields;
    }
  }

  return organized;
}

/**
 * Orders fields based on explicit order values and logical grouping
 */
function orderFields(order: string[], fields: Record<string, RenderConfigSchema>): string[] {
  const fieldPriority: Record<string, number> = {
    'tokenName': 1,
    'tokenSymbol': 2,
    'maxSupply': 3,
    'supplyType': 4,
    'treasuryAccountId': 5,
    'memo': 6,
  };

  return order.sort((a, b) => {
    const aConfig = fields[a];
    const bConfig = fields[b];

    if (aConfig?.ui?.order !== undefined && bConfig?.ui?.order !== undefined) {
      return aConfig.ui.order - bConfig.ui.order;
    }

    if (aConfig?.ui?.order !== undefined) {
      return -1;
    }
    if (bConfig?.ui?.order !== undefined) {
      return 1;
    }

    const aPriority = fieldPriority[a] || 1000;
    const bPriority = fieldPriority[b] || 1000;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    return a.localeCompare(b);
  });
}

/**
 * Generates field ordering metadata for complex forms
 */
export function generateFieldOrdering(schema: ZodType<unknown>): {
  sections: Record<string, { title: string; fields: string[]; order: number }>;
  fieldOrder: string[];
} {
  const extracted = extractRenderConfigs(schema);
  const sections: Record<string, { title: string; fields: string[]; order: number }> = {};

  const sectionOrder: Record<string, number> = {
    'default': 0,
    'Basic Information': 1,
    'Token Settings': 2,
    'Keys & Security': 3,
    'Custom Fees': 4,
    'Advanced Settings': 5
  };

  for (const [groupName, fields] of Object.entries(extracted.groups)) {
    const displayName = groupName === 'default' ? 'Basic Information' : groupName;
    sections[displayName] = {
      title: displayName,
      fields,
      order: sectionOrder[displayName] || 10
    };
  }

  return {
    sections,
    fieldOrder: extracted.order
  };
}

/**
 * Creates a field configuration map for form builders
 */
export function createFieldConfigMap(schema: ZodType<unknown>): Record<string, FieldConfigMapEntry> {
  const extracted = extractRenderConfigs(schema);
  const configMap: Record<string, FieldConfigMapEntry> = {};

  for (const [fieldPath, renderConfig] of Object.entries(extracted.fields)) {
    const metadata = extracted.metadata[fieldPath];
    const path = fieldPath.split('.');

    configMap[fieldPath] = {
      renderConfig,
      metadata,
      path
    };
  }

  return configMap;
}




/**
 * Creates a simplified configuration for basic form rendering
 */
export function createSimpleConfig(schema: ZodType<unknown>): {
  fields: Array<SimpleFieldConfig>;
} {
  const extracted = extractRenderConfigs(schema);
  const fields = [];

  for (const fieldPath of extracted.order) {
    const renderConfig = extracted.fields[fieldPath];
    const metadata = extracted.metadata[fieldPath];

    if (!renderConfig || !metadata) {
      continue;
    }

    fields.push({
      name: fieldPath,
      type: metadata.type,
      label: renderConfig.ui?.label || fieldPath,
      required: metadata.required,
      placeholder: renderConfig.ui?.placeholder,
      options: renderConfig.options || metadata.options
    });
  }

  return { fields };
}