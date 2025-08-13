import { ContentResolverRegistry } from '@hashgraphonline/standards-sdk';

export interface ContentResolutionResult {
  buffer: Buffer;
  mimeType?: string;
  fileName?: string;
  wasReference?: boolean;
}

/**
 * Resolves content from various input formats (content-ref, base64, plain text)
 */
export async function resolveContent(
  input: string,
  providedMimeType?: string,
  providedFileName?: string
): Promise<ContentResolutionResult> {
  const trimmedInput = input.trim();

  const resolver = ContentResolverRegistry.getResolver();

  if (!resolver) {
    return handleDirectContent(
      trimmedInput,
      providedMimeType,
      providedFileName
    );
  }

  const referenceId = resolver.extractReferenceId(trimmedInput);

  if (referenceId) {
    try {
      const resolution = await resolver.resolveReference(referenceId);

      return {
        buffer: resolution.content,
        mimeType: resolution.metadata?.mimeType || providedMimeType,
        fileName: resolution.metadata?.fileName || providedFileName,
        wasReference: true,
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : 'Unknown error resolving reference';
      throw new Error(`Reference resolution failed: ${errorMsg}`);
    }
  }

  return handleDirectContent(trimmedInput, providedMimeType, providedFileName);
}

/**
 * Handles direct content (base64 or plain text)
 */
function handleDirectContent(
  input: string,
  providedMimeType?: string,
  providedFileName?: string
): ContentResolutionResult {
  const isValidBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(input);

  if (isValidBase64) {
    try {
      const buffer = Buffer.from(input, 'base64');
      return {
        buffer,
        mimeType: providedMimeType,
        fileName: providedFileName,
        wasReference: false,
      };
    } catch (error) {
      throw new Error(
        'Failed to decode base64 data. Please ensure the data is properly encoded.'
      );
    }
  }

  const buffer = Buffer.from(input, 'utf8');
  return {
    buffer,
    mimeType: providedMimeType || 'text/plain',
    fileName: providedFileName,
    wasReference: false,
  };
}
