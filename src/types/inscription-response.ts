/**
 * Structured response interface for inscription tools
 * Provides a consistent, user-friendly format for inscription results
 */

export interface InscriptionSuccessResponse {
  success: true;
  type: 'inscription';
  title: string;
  message: string;
  inscription: {
    /** The HRL (Hashinal Reference Link) for minting - e.g., "hcs://1/0.0.123456" */
    hrl: string;
    /** Topic ID where the inscription was stored */
    topicId: string;
    /** Type of Hashinal - Static (HCS-5) or Dynamic (HCS-6) */
    standard: 'Static' | 'Dynamic';
    /** CDN URL for direct access to the inscribed content */
    cdnUrl?: string;
    /** Transaction ID of the inscription */
    transactionId?: string;
  };
  metadata: {
    /** Name/title of the inscribed content */
    name?: string;
    /** Creator of the content */
    creator?: string;
    /** Description of the content */
    description?: string;
    /** Content type (image, text, etc.) */
    type?: string;
    /** Additional attributes */
    attributes?: Array<{ trait_type: string; value: string | number }>;
  };
  nextSteps: {
    /** Primary action the user should take next */
    primary: string;
    /** Additional context or options */
    context?: string;
    /** Specific metadata value to use for minting */
    mintingMetadata: string;
  };
  /** HashLink block data (only present when withHashLinkBlocks=true) */
  hashLinkBlock?: {
    /** Block topic ID on HCS */
    blockId: string;
    /** HashLink reference to the block */
    hashLink: string;
    /** Template topic ID */
    template: string;
    /** Block attributes for rendering */
    attributes: BlockAttributes;
  };
}

export interface InscriptionQuoteResponse {
  success: true;
  type: 'quote';
  title: string;
  message: string;
  quote: {
    /** Total cost in HBAR */
    totalCostHbar: string;
    /** When the quote expires */
    validUntil: string;
    /** Cost breakdown details */
    breakdown?: CostBreakdown;
  };
  content: {
    /** Name of the content to be inscribed */
    name?: string;
    /** Creator of the content */
    creator?: string;
    /** Type of content */
    type?: string;
  };
}

export interface InscriptionErrorResponse {
  success: false;
  type: 'error';
  title: string;
  message: string;
  error: {
    /** Error code for programmatic handling */
    code: string;
    /** Detailed error message */
    details: string;
    /** Suggestions for fixing the error */
    suggestions?: string[];
  };
}

export type InscriptionResponse =
  | InscriptionSuccessResponse
  | InscriptionQuoteResponse
  | InscriptionErrorResponse;

/**
 * Helper function to create a successful inscription response
 */
export function createInscriptionSuccess(params: {
  hrl: string;
  topicId: string;
  standard: 'Static' | 'Dynamic';
  cdnUrl?: string;
  transactionId?: string;
  metadata: {
    name?: string;
    creator?: string;
    description?: string;
    type?: string;
    attributes?: Array<{ trait_type: string; value: string | number }>;
  };
}): InscriptionSuccessResponse {
  const { hrl, topicId, standard, cdnUrl, transactionId, metadata } = params;

  return {
    success: true,
    type: 'inscription',
    title: `${standard} Hashinal Inscription Complete`,
    message: `Successfully inscribed "${
      metadata.name || 'your content'
    }" as a ${standard} Hashinal. The content is now ready for NFT minting.`,
    inscription: {
      hrl,
      topicId,
      standard,
      cdnUrl,
      transactionId,
    },
    metadata,
    nextSteps: {
      primary: 'Use the HRL below as metadata when minting your NFT',
      context:
        'The HRL (Hedera Resource Locator) is the standardized way to reference your inscribed content in NFT metadata.',
      mintingMetadata: hrl,
    },
  };
}

/**
 * Block attributes for HashLink rendering
 */
interface BlockAttributes {
  /** Display name */
  name?: string;
  /** Description text */
  description?: string;
  /** Image URL */
  image?: string;
  /** Content type */
  contentType?: string;
  /** Size in bytes */
  size?: number;
  /** Custom metadata */
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Transfer details in cost breakdown
 */
interface TransferDetails {
  to: string;
  amount: string;
  description: string;
}

/**
 * Cost breakdown details for inscription quote
 */
interface CostBreakdown {
  transfers: TransferDetails[];
  baseFee?: number;
  sizeFee?: number;
  networkFee?: number;
  serviceFee?: number;
  totalFee?: number;
  currency?: string;
}

/**
 * Helper function to create a quote response
 */
export function createInscriptionQuote(params: {
  totalCostHbar: string;
  validUntil: string;
  breakdown?: CostBreakdown;
  content: {
    name?: string;
    creator?: string;
    type?: string;
  };
}): InscriptionQuoteResponse {
  const { totalCostHbar, validUntil, breakdown, content } = params;

  return {
    success: true,
    type: 'quote',
    title: 'Inscription Cost Quote',
    message: `Estimated cost to inscribe "${
      content.name || 'your content'
    }" is ${totalCostHbar} HBAR.`,
    quote: {
      totalCostHbar,
      validUntil,
      breakdown,
    },
    content,
  };
}

/**
 * Helper function to create an error response
 */
export function createInscriptionError(params: {
  code: string;
  details: string;
  suggestions?: string[];
}): InscriptionErrorResponse {
  const { code, details, suggestions } = params;

  return {
    success: false,
    type: 'error',
    title: 'Inscription Failed',
    message: `Unable to complete inscription: ${details}`,
    error: {
      code,
      details,
      suggestions,
    },
  };
}
