export * from './types';
export * from './schema-extension';
export * from './config-extractor';

export {
  extendZodSchema,
  hasRenderConfig,
  getRenderConfig,
  renderConfigs
} from './schema-extension';

export {
  extractRenderConfigs,
  generateFieldOrdering,
  createFieldConfigMap,
  createSimpleConfig
} from './config-extractor';

export type {
  FormFieldType,
  RenderContext,
  RenderFunction,
  RenderConfigSchema,
  ZodSchemaWithRender,
  FormGenerationOptions,
  ValidationError,
  FormState,
  FormActions,
  UseFormReturn,
  ComponentRegistry,
  FieldComponentProps,
  SelectOption,
  FileUploadResult,
  FieldMetadata,
  ExtractedRenderConfig
} from './types';