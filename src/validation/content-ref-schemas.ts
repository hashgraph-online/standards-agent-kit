import { z } from 'zod';

/**
 * Validates content reference format
 */
export const contentRefSchema = z
  .string()
  .regex(/^content-ref:[a-zA-Z0-9_-]+$/, 'Content reference must be in format "content-ref:[alphanumeric-id]"')
  .describe('Content reference in format "content-ref:[id]"');

/**
 * Validates content reference or returns error for dumber models
 */
export function validateContentRef(input: string): string {
  try {
    return contentRefSchema.parse(input);
  } catch (error) {
    throw new Error(`Invalid content reference format. Expected "content-ref:[alphanumeric-id]" but got "${input}"`);
  }
}