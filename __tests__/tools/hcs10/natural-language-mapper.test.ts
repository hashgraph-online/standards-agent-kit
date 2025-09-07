import { AIAgentCapability } from '@hashgraphonline/standards-sdk';
import { NaturalLanguageMapper } from '../../../src/tools/hcs10/natural-language-mapper';

describe('NaturalLanguageMapper', () => {
  it('parseCapabilities should map common terms to capabilities', () => {
    const caps = NaturalLanguageMapper.parseCapabilities('We do AI and data processing plus analytics');
    expect(caps).toEqual(expect.arrayContaining([
      AIAgentCapability.TEXT_GENERATION,
      AIAgentCapability.DATA_INTEGRATION,
      AIAgentCapability.TRANSACTION_ANALYTICS,
    ]));
  });

  it('parseTagsOrCapabilities should accept string arrays and merge deduplicated', () => {
    const caps = NaturalLanguageMapper.parseTagsOrCapabilities(['ai', 'image', 'ai']);
    expect(caps).toEqual(expect.arrayContaining([
      AIAgentCapability.TEXT_GENERATION,
      AIAgentCapability.IMAGE_GENERATION,
    ]));
  });

  it('parseTagsOrCapabilities should pass through numeric arrays', () => {
    const input = [
      AIAgentCapability.TEXT_GENERATION,
      AIAgentCapability.WORKFLOW_AUTOMATION,
    ];
    const caps = NaturalLanguageMapper.parseTagsOrCapabilities(input);
    expect(caps).toEqual(input);
  });

  it('parseTagsOrCapabilities should default to TEXT_GENERATION for unknown input', () => {
    const caps = NaturalLanguageMapper.parseTagsOrCapabilities('unknown-term');
    expect(caps).toEqual(expect.arrayContaining([AIAgentCapability.TEXT_GENERATION]));
  });

  it('getCapabilityName returns human-readable names', () => {
    expect(NaturalLanguageMapper.getCapabilityName(AIAgentCapability.CODE_GENERATION)).toMatch(/Code Generation/);
    expect(NaturalLanguageMapper.getCapabilityName(AIAgentCapability.API_INTEGRATION)).toMatch(/API Integration|Workflow Automation/);
  });
});
