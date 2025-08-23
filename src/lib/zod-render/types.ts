import { ZodType } from 'zod';

export type ReactNode = unknown;
export type ReactElement = unknown;
export type ComponentType<_TProps = Record<string, unknown>> = unknown;

/**
 * Core form field types supported by the render system
 */
export type FormFieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'checkbox'
  | 'textarea'
  | 'file'
  | 'array'
  | 'object'
  | 'currency'
  | 'percentage';

/**
 * Context provided to render functions containing field state and callbacks
 */
export type RenderContext = {
  path: string[];
  value: unknown;
  setValue: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
};

/**
 * Function that renders a field component for a Zod schema
 */
export type RenderFunction<TSchema = unknown> = (
  schema: ZodType<TSchema>,
  context: RenderContext
) => ReactNode;

/**
 * Configuration for rendering a form field
 */
export type RenderConfigSchema = {
  fieldType: FormFieldType;
  component?: ComponentType<Record<string, unknown>>;
  props?: Record<string, unknown>;
  wrapper?: ComponentType<{ children: ReactNode }>;
  validation?: {
    customMessages?: Record<string, string>;
  };
  ui?: {
    label?: string;
    placeholder?: string;
    helpText?: string;
    group?: string;
    order?: number;
    hidden?: boolean;
    readonly?: boolean;
    width?: 'full' | 'half' | 'third' | 'quarter';
    className?: string;
    priority?: 'essential' | 'common' | 'advanced' | 'expert';
    collapsible?: boolean;
    expanded?: boolean;
    icon?: string;
    description?: string;
  };
  options?: Array<{ value: unknown; label: string; disabled?: boolean }>;
  constraints?: {
    min?: number;
    max?: number;
    step?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    accept?: string;
    multiple?: boolean;
  };
};

/**
 * Extended Zod schema with render configuration
 */
export interface ZodSchemaWithRender<TSchema = unknown>
  extends ZodType<TSchema> {
  _renderConfig?: EnhancedRenderConfig;
  withRender: (
    config: EnhancedRenderConfig | RenderConfigSchema
  ) => ZodSchemaWithRender<TSchema>;
  withProgressive: (
    priority: 'essential' | 'common' | 'advanced' | 'expert',
    group?: string
  ) => ZodSchemaWithRender<TSchema>;
  withBlock: (blockId: string) => ZodSchemaWithRender<TSchema>;
}

/**
 * Progressive disclosure configuration
 */
export type ProgressiveDisclosureConfig = {
  enabled?: boolean;
  groups?: FormGroup[];
  defaultExpanded?: string[];
  showFieldCount?: boolean;
  adaptiveLayout?: boolean;
  essentialOnly?: boolean;
};

/**
 * Form group configuration for progressive disclosure
 */
export type FormGroup = {
  name: string;
  priority: 'essential' | 'common' | 'advanced' | 'expert';
  collapsible?: boolean;
  description?: string;
  icon?: string;
  defaultExpanded?: boolean;
};

/**
 * Options for generating forms from schemas
 */
export type FormGenerationOptions = {
  fieldOrder?: string[];
  fieldConfigs?: Record<string, RenderConfigSchema>;
  onSubmit?: (values: Record<string, unknown>) => void | Promise<void>;
  onValueChange?: (path: string[], value: unknown) => void;
  className?: string;
  disabled?: boolean;
  showSubmitButton?: boolean;
  submitButtonText?: string;
  resetButtonText?: string;
  showResetButton?: boolean;
  groupBy?: 'none' | 'group' | 'section';
  layout?: 'vertical' | 'horizontal' | 'grid';
  progressiveDisclosure?: ProgressiveDisclosureConfig;
};

/**
 * Form validation error
 */
export type ValidationError = {
  path: string[];
  message: string;
  code: string;
};

/**
 * Form state management
 */
export type FormState<TValues = Record<string, unknown>> = {
  values: TValues;
  errors: ValidationError[];
  isValidating: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
  touchedFields: Set<string>;
};

/**
 * Form action handlers
 */
export type FormActions<TValues = Record<string, unknown>> = {
  setValue: (path: string[], value: unknown) => void;
  setValues: (values: Partial<TValues>) => void;
  setError: (path: string[], error: string) => void;
  clearError: (path: string[]) => void;
  clearErrors: () => void;
  reset: () => void;
  submit: () => Promise<void>;
  validate: () => Promise<boolean>;
  touchField: (path: string[]) => void;
};

/**
 * Complete form hook return type
 */
export type UseFormReturn<TValues = Record<string, unknown>> = {
  state: FormState<TValues>;
  actions: FormActions<TValues>;
};

/**
 * Registry mapping field types to React components
 */
export type ComponentRegistry = Record<
  FormFieldType,
  ComponentType<FieldComponentProps>
>;

/**
 * Props passed to field components
 */
export type FieldComponentProps = {
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: unknown; label: string; disabled?: boolean }>;
  multiple?: boolean;
  accept?: string;
  rows?: number;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
};

/**
 * Option for select fields
 */
export type SelectOption = {
  value: unknown;
  label: string;
  disabled?: boolean;
};

/**
 * File upload result
 */
export type FileUploadResult = {
  name: string;
  data: string;
  type: string;
  size: number;
};

/**
 * Field metadata extracted from schema
 */
export type FieldMetadata = {
  type: FormFieldType;
  required: boolean;
  optional: boolean;
  default?: unknown;
  options?: SelectOption[];
  constraints?: Record<string, unknown>;
  description?: string;
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
  };
};

/**
 * Schema composition utilities
 */
export type SchemaComposer = {
  merge: <TSchema1, TSchema2>(
    schema1: ZodType<TSchema1>,
    schema2: ZodType<TSchema2>
  ) => ZodType<TSchema1 & TSchema2>;
  extend: <TSchema>(
    schema: ZodType<TSchema>,
    extensions: Record<string, ZodType<unknown>>
  ) => ZodType<TSchema>;
  pick: <TSchema>(
    schema: ZodType<TSchema>,
    keys: string[]
  ) => ZodType<Partial<TSchema>>;
  omit: <TSchema>(
    schema: ZodType<TSchema>,
    keys: string[]
  ) => ZodType<Omit<TSchema, string>>;
};

/**
 * Render config extraction result
 */
export type ExtractedRenderConfig = {
  fields: Record<string, RenderConfigSchema>;
  groups: Record<string, string[]>;
  order: string[];
  metadata: Record<string, FieldMetadata>;
  progressiveDisclosure?: ProgressiveDisclosureConfig;
};

/**
 * Block-based form architecture types
 */
export type FormBlock<TSchema = unknown> = {
  id: string;
  name: string;
  schema: ZodType<TSchema>;
  renderConfig?: RenderConfigSchema;
  validate?: (data: unknown) => ValidationError[];
  getDefaultValue?: () => unknown;
  metadata?: {
    category?: string;
    reusable?: boolean;
    description?: string;
    version?: string;
  };
};

/**
 * Block registry for reusable form components
 */
export type BlockRegistry = {
  register: <TSchema>(block: FormBlock<TSchema>) => void;
  get: <TSchema>(id: string) => FormBlock<TSchema> | undefined;
  list: () => FormBlock[];
  listByCategory: (category: string) => FormBlock[];
  unregister: (id: string) => void;
};

/**
 * Enhanced render configuration with block support
 */
export type EnhancedRenderConfig = RenderConfigSchema & {
  block?: {
    id?: string;
    type?: 'field' | 'group' | 'section' | 'array-item' | 'union-variant';
    reusable?: boolean;
    composition?: {
      blocks?: string[];
      layout?: 'stack' | 'grid' | 'flex';
    };
  };
  progressive?: {
    priority: 'essential' | 'common' | 'advanced' | 'expert';
    group?: string;
    showWhen?: (values: Record<string, unknown>) => boolean;
    hideWhen?: (values: Record<string, unknown>) => boolean;
  };
};
