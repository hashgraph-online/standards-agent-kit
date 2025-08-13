import { z } from 'zod';

/**
 * Validates content reference format
 */
export const contentRefSchema = z
  .string()
  .regex(/^content-ref:[a-fA-F0-9]{64}$/, 'Content reference must be in format "content-ref:[64-char hex]"')
  .describe('Content reference in format "content-ref:[id]"');

/**
 * Validates content reference or returns error for dumber models
 */
export function validateContentRef(input: string): string {
  try {
    return contentRefSchema.parse(input);
  } catch (error) {
    throw new Error(`Invalid content reference format. Expected "content-ref:[64-character-hash]" but got "${input}"`);
  }
}