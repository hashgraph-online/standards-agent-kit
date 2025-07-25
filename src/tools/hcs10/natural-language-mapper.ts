import { AIAgentCapability } from '@hashgraphonline/standards-sdk';

/**
 * Maps natural language terms to AIAgentCapability enum values
 */
export class NaturalLanguageMapper {
  private static readonly CAPABILITY_MAPPINGS: Record<string, AIAgentCapability[]> = {
    // Common terms
    'ai': [AIAgentCapability.TEXT_GENERATION],
    'artificial intelligence': [AIAgentCapability.TEXT_GENERATION],
    'chat': [AIAgentCapability.TEXT_GENERATION],
    'conversation': [AIAgentCapability.TEXT_GENERATION],
    'text': [AIAgentCapability.TEXT_GENERATION],
    'text generation': [AIAgentCapability.TEXT_GENERATION],
    
    // Image
    'image': [AIAgentCapability.IMAGE_GENERATION],
    'picture': [AIAgentCapability.IMAGE_GENERATION],
    'visual': [AIAgentCapability.IMAGE_GENERATION],
    'photo': [AIAgentCapability.IMAGE_GENERATION],
    
    // Audio
    'audio': [AIAgentCapability.AUDIO_GENERATION],
    'sound': [AIAgentCapability.AUDIO_GENERATION],
    'voice': [AIAgentCapability.AUDIO_GENERATION],
    'speech': [AIAgentCapability.AUDIO_GENERATION],
    
    // Video
    'video': [AIAgentCapability.VIDEO_GENERATION],
    'movie': [AIAgentCapability.VIDEO_GENERATION],
    'animation': [AIAgentCapability.VIDEO_GENERATION],
    
    // Code
    'code': [AIAgentCapability.CODE_GENERATION],
    'programming': [AIAgentCapability.CODE_GENERATION],
    'development': [AIAgentCapability.CODE_GENERATION],
    'coding': [AIAgentCapability.CODE_GENERATION],
    
    // Translation
    'translate': [AIAgentCapability.LANGUAGE_TRANSLATION],
    'translation': [AIAgentCapability.LANGUAGE_TRANSLATION],
    'language': [AIAgentCapability.LANGUAGE_TRANSLATION],
    
    // Summarization
    'summarize': [AIAgentCapability.SUMMARIZATION_EXTRACTION],
    'summary': [AIAgentCapability.SUMMARIZATION_EXTRACTION],
    'extract': [AIAgentCapability.SUMMARIZATION_EXTRACTION],
    'extraction': [AIAgentCapability.SUMMARIZATION_EXTRACTION],
    
    // Knowledge
    'knowledge': [AIAgentCapability.KNOWLEDGE_RETRIEVAL],
    'search': [AIAgentCapability.KNOWLEDGE_RETRIEVAL],
    'retrieve': [AIAgentCapability.KNOWLEDGE_RETRIEVAL],
    'lookup': [AIAgentCapability.KNOWLEDGE_RETRIEVAL],
    
    // Data
    'data': [AIAgentCapability.DATA_INTEGRATION],
    'data processing': [AIAgentCapability.DATA_INTEGRATION],
    'data integration': [AIAgentCapability.DATA_INTEGRATION],
    'etl': [AIAgentCapability.DATA_INTEGRATION],
    
    // Market
    'market': [AIAgentCapability.MARKET_INTELLIGENCE],
    'trading': [AIAgentCapability.MARKET_INTELLIGENCE],
    'finance': [AIAgentCapability.MARKET_INTELLIGENCE],
    'financial': [AIAgentCapability.MARKET_INTELLIGENCE],
    
    // Analytics
    'analytics': [AIAgentCapability.TRANSACTION_ANALYTICS],
    'analysis': [AIAgentCapability.TRANSACTION_ANALYTICS],
    'analyze': [AIAgentCapability.TRANSACTION_ANALYTICS],
    'transactions': [AIAgentCapability.TRANSACTION_ANALYTICS],
    
    // Smart Contract
    'audit': [AIAgentCapability.SMART_CONTRACT_AUDIT],
    'contract': [AIAgentCapability.SMART_CONTRACT_AUDIT],
    'smart contract': [AIAgentCapability.SMART_CONTRACT_AUDIT],
    
    // Governance
    'governance': [AIAgentCapability.GOVERNANCE_FACILITATION],
    'voting': [AIAgentCapability.GOVERNANCE_FACILITATION],
    'dao': [AIAgentCapability.GOVERNANCE_FACILITATION],
    
    // Security
    'security': [AIAgentCapability.SECURITY_MONITORING],
    'monitoring': [AIAgentCapability.SECURITY_MONITORING],
    'threat': [AIAgentCapability.SECURITY_MONITORING],
    
    // Compliance
    'compliance': [AIAgentCapability.COMPLIANCE_ANALYSIS],
    'regulatory': [AIAgentCapability.COMPLIANCE_ANALYSIS],
    'regulation': [AIAgentCapability.COMPLIANCE_ANALYSIS],
    
    // Fraud
    'fraud': [AIAgentCapability.FRAUD_DETECTION],
    'detection': [AIAgentCapability.FRAUD_DETECTION],
    'anomaly': [AIAgentCapability.FRAUD_DETECTION],
    
    // Multi-agent
    'coordination': [AIAgentCapability.MULTI_AGENT_COORDINATION],
    'multi-agent': [AIAgentCapability.MULTI_AGENT_COORDINATION],
    'orchestration': [AIAgentCapability.MULTI_AGENT_COORDINATION],
    
    // API
    'api': [AIAgentCapability.API_INTEGRATION],
    'integration': [AIAgentCapability.API_INTEGRATION],
    'webhook': [AIAgentCapability.API_INTEGRATION],
    
    // Workflow
    'workflow': [AIAgentCapability.WORKFLOW_AUTOMATION],
    'automation': [AIAgentCapability.WORKFLOW_AUTOMATION],
    'process': [AIAgentCapability.WORKFLOW_AUTOMATION],
  };

  /**
   * Parse natural language text and extract capability values
   */
  static parseCapabilities(text: string): AIAgentCapability[] {
    if (!text) return [AIAgentCapability.TEXT_GENERATION];
    
    const normalizedText = text.toLowerCase();
    const capabilities = new Set<AIAgentCapability>();
    
    // Check for exact matches first
    for (const [term, caps] of Object.entries(this.CAPABILITY_MAPPINGS)) {
      if (normalizedText.includes(term)) {
        caps.forEach(cap => capabilities.add(cap));
      }
    }
    
    // Default to TEXT_GENERATION if no capabilities found
    if (capabilities.size === 0) {
      capabilities.add(AIAgentCapability.TEXT_GENERATION);
    }
    
    return Array.from(capabilities);
  }

  /**
   * Parse tags/capabilities from various input formats
   */
  static parseTagsOrCapabilities(input: any): AIAgentCapability[] {
    // If already an array of numbers, return as is
    if (Array.isArray(input) && input.every(item => typeof item === 'number')) {
      return input;
    }
    
    // If array of strings, parse each
    if (Array.isArray(input) && input.every(item => typeof item === 'string')) {
      const capabilities = new Set<AIAgentCapability>();
      input.forEach(term => {
        this.parseCapabilities(term).forEach(cap => capabilities.add(cap));
      });
      return Array.from(capabilities);
    }
    
    // If single string, parse it
    if (typeof input === 'string') {
      return this.parseCapabilities(input);
    }
    
    // Default
    return [AIAgentCapability.TEXT_GENERATION];
  }

  /**
   * Convert capability enum to human-readable name
   */
  static getCapabilityName(capability: AIAgentCapability): string {
    const names: Record<AIAgentCapability, string> = {
      [AIAgentCapability.TEXT_GENERATION]: 'Text Generation',
      [AIAgentCapability.IMAGE_GENERATION]: 'Image Generation',
      [AIAgentCapability.AUDIO_GENERATION]: 'Audio Generation',
      [AIAgentCapability.VIDEO_GENERATION]: 'Video Generation',
      [AIAgentCapability.CODE_GENERATION]: 'Code Generation',
      [AIAgentCapability.LANGUAGE_TRANSLATION]: 'Language Translation',
      [AIAgentCapability.SUMMARIZATION_EXTRACTION]: 'Summarization & Extraction',
      [AIAgentCapability.KNOWLEDGE_RETRIEVAL]: 'Knowledge Retrieval',
      [AIAgentCapability.DATA_INTEGRATION]: 'Data Integration',
      [AIAgentCapability.MARKET_INTELLIGENCE]: 'Market Intelligence',
      [AIAgentCapability.TRANSACTION_ANALYTICS]: 'Transaction Analytics',
      [AIAgentCapability.SMART_CONTRACT_AUDIT]: 'Smart Contract Audit',
      [AIAgentCapability.GOVERNANCE_FACILITATION]: 'Governance Facilitation',
      [AIAgentCapability.SECURITY_MONITORING]: 'Security Monitoring',
      [AIAgentCapability.COMPLIANCE_ANALYSIS]: 'Compliance Analysis',
      [AIAgentCapability.FRAUD_DETECTION]: 'Fraud Detection',
      [AIAgentCapability.MULTI_AGENT_COORDINATION]: 'Multi-Agent Coordination',
      [AIAgentCapability.API_INTEGRATION]: 'API Integration',
      [AIAgentCapability.WORKFLOW_AUTOMATION]: 'Workflow Automation',
    };
    
    return names[capability] || 'Unknown Capability';
  }
}