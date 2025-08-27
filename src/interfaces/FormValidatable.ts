import { z } from 'zod';

/**
 * Interface for tools that can provide custom form validation logic
 */
export interface FormValidatable {
  /**
   * Determines if a form should be generated for the given input
   * @param input The input data to validate
   * @returns true if a form should be generated, false if the tool can execute
   */
  shouldGenerateForm(input: unknown): boolean;

  /**
   * Returns the schema to use for form generation
   * This allows tools to provide a focused schema for forms
   * @returns The schema to use for generating forms
   */
  getFormSchema(): z.ZodSchema;

  /**
   * Defines which fields are essential for this tool
   * Essential fields are always shown in forms even if marked as optional
   * @returns Array of field names that are essential for user experience
   */
  getEssentialFields(): string[];

  /**
   * Determines if a field value should be considered empty
   * Allows tools to define custom empty logic for their specific data types
   * @param fieldName The name of the field
   * @param value The value to check
   * @returns true if the field should be considered empty
   */
  isFieldEmpty(fieldName: string, value: unknown): boolean;
}

/**
 * Type guard to check if a tool implements FormValidatable
 */
export function isFormValidatable(tool: unknown): tool is FormValidatable {
  return (
    tool !== null &&
    typeof tool === 'object' &&
    'shouldGenerateForm' in tool &&
    'getFormSchema' in tool &&
    'getEssentialFields' in tool &&
    'isFieldEmpty' in tool &&
    typeof (tool as FormValidatable).shouldGenerateForm === 'function' &&
    typeof (tool as FormValidatable).getFormSchema === 'function' &&
    typeof (tool as FormValidatable).getEssentialFields === 'function' &&
    typeof (tool as FormValidatable).isFieldEmpty === 'function'
  );
}