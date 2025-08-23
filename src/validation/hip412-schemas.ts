import { z } from 'zod';

/**
 * HIP-412 file schema for multi-file NFTs
 */
export const hip412FileSchema = z.object({
  uri: z.string().describe('URI of the file'),
  checksum: z.string().optional().describe('SHA-256 checksum of the file'),
  is_default_file: z.boolean().optional().describe('Whether this is the default file'),
  type: z.string().describe('MIME type of the file'),
});

/**
 * HIP-412 attribute schema for NFT traits
 */
export const hip412AttributeSchema = z.object({
  trait_type: z.string().describe('The trait type'),
  value: z.union([z.string(), z.number()]).describe('The trait value'),
  display_type: z.string().optional().describe('Display type for the attribute'),
});

/**
 * HIP-412 compliant metadata schema for Hedera NFTs
 */
export const hip412MetadataSchema = z.object({
  name: z.string().describe('Token name (required by HIP-412)'),
  description: z.string().describe('Human readable description (required by HIP-412)'),
  image: z.string().describe('Preview image URI (required by HIP-412)'),
  type: z.string().describe('MIME type (required by HIP-412)'),
  creator: z.string().optional().describe('Creator name or comma-separated names'),
  creatorDID: z.string().optional().describe('Decentralized identifier for creator'),
  checksum: z.string().optional().describe('SHA-256 checksum of the image'),
  format: z.string().optional().default('HIP412@2.0.0').describe('Metadata format version'),
  files: z.array(hip412FileSchema).optional().describe('Array of files for multi-file NFTs'),
  attributes: z.array(hip412AttributeSchema).optional().describe('NFT attributes/traits'),
  properties: z.record(z.unknown()).optional().describe('Additional properties'),
});

/**
 * Validates metadata against HIP-412 standard
 */
export function validateHIP412Metadata(metadata: unknown): z.infer<typeof hip412MetadataSchema> {
  try {
    return hip412MetadataSchema.parse(metadata);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('; ');
      throw new Error(`HIP-412 metadata validation failed: ${issues}`);
    }
    throw error;
  }
}