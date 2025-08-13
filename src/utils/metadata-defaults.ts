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
}) {
  const defaultName = params.fileName?.replace(/\.[^/.]+$/, '') || 'Hashinal NFT';
  const defaultType = params.mimeType?.startsWith('image/') ? 'image' : 
                      params.mimeType?.startsWith('video/') ? 'video' :
                      params.mimeType?.startsWith('audio/') ? 'audio' : 'media';

  return {
    name: params.name || defaultName,
    creator: params.creator || params.operatorAccount,
    description: params.description || `${defaultType.charAt(0).toUpperCase() + defaultType.slice(1)} NFT inscribed as Hashinal`,
    type: params.type || defaultType,
    image: '',
  };
}