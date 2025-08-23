/**
 * Generates default metadata for NFT inscription
 */
export function generateDefaultMetadata(params: {
  name?: string;
  creator?: string;
  description?: string;
  type?: string;
  fileName?: string;
  mimeType?: string;
  operatorAccount: string;
}): {
  name: string;
  creator: string;
  description: string;
  type: string;
  image: string;
} {
  const defaultName = params.fileName?.replace(/\.[^/.]+$/, '') || 'Hashinal NFT';
  let defaultType = 'media';
  if (params.mimeType?.startsWith('image/')) {
    defaultType = 'image';
  } else if (params.mimeType?.startsWith('video/')) {
    defaultType = 'video';
  } else if (params.mimeType?.startsWith('audio/')) {
    defaultType = 'audio';
  }

  return {
    name: params.name || defaultName,
    creator: params.creator || params.operatorAccount,
    description: params.description || `${defaultType.charAt(0).toUpperCase() + defaultType.slice(1)} NFT inscribed as Hashinal`,
    type: params.type || defaultType,
    image: '',
  };
}