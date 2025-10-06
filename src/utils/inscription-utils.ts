import { RetrievedInscriptionResult } from '@kiloscribe/inscription-sdk';

export type NetworkType = 'mainnet' | 'testnet';

export interface TopicIds {
  jsonTopicId?: string;
  topicId?: string;
}

function getStringProp(obj: unknown, key: string): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const val = (obj as Record<string, unknown>)[key];
  return typeof val === 'string' && val.trim() ? val : undefined;
}

/**
 * Extract topic ids from an inscription and/or result object without using any.
 * - Prefers jsonTopicId when present (for CDN linking)
 * - Collects topic_id/topicId from either inscription or result
 */
export function extractTopicIds(
  inscription: RetrievedInscriptionResult | undefined,
  result?: unknown
): TopicIds {
  const jsonTopicId =
    (inscription as RetrievedInscriptionResult | undefined)?.jsonTopicId ||
    getStringProp(inscription, 'json_topic_id');

  const imageTopicId =
    getStringProp(inscription, 'topic_id') ||
    getStringProp(inscription, 'topicId') ||
    getStringProp(result, 'topicId') ||
    getStringProp(result, 'topic_id');

  return {
    jsonTopicId: jsonTopicId,
    topicId: imageTopicId,
  };
}

/**
 * Build HRL/CDN URLs from extracted topic ids.
 * - HRL prefers jsonTopicId, falls back to topicId
 * - CDN URL only provided when jsonTopicId is present
 */
export function buildInscriptionLinks(
  ids: TopicIds,
  network: NetworkType,
  fileStandard: string = '1'
): { hrl?: string; cdnUrl?: string; topicId?: string } {
  const chosen = ids.jsonTopicId || ids.topicId;
  const hrl = chosen ? `hcs://${fileStandard}/${chosen}` : undefined;
  const cdnUrl = ids.jsonTopicId
    ? `https://kiloscribe.com/api/inscription-cdn/${ids.jsonTopicId}?network=${network}`
    : undefined;
  return { hrl, cdnUrl, topicId: chosen };
}
