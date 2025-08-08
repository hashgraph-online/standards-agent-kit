export interface ContentReferenceConfig {
  maxInscriptionSize: number;
  minContentSize: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableContentValidation: boolean;
}

export const DEFAULT_CONFIG: ContentReferenceConfig = {
  maxInscriptionSize: 50 * 1024, // 50KB
  minContentSize: 10,
  logLevel: 'warn',
  enableContentValidation: true,
};

export function loadConfig(): ContentReferenceConfig {
  return {
    maxInscriptionSize: parseInt(
      process.env.REF_MAX_SIZE || DEFAULT_CONFIG.maxInscriptionSize.toString(),
      10
    ),
    minContentSize: parseInt(
      process.env.REF_MIN_SIZE || DEFAULT_CONFIG.minContentSize.toString(),
      10
    ),
    logLevel:
      (process.env.REF_LOG_LEVEL as ContentReferenceConfig['logLevel']) ||
      DEFAULT_CONFIG.logLevel,
    enableContentValidation: process.env.REF_ENABLE_VALIDATION !== 'false',
  };
}
