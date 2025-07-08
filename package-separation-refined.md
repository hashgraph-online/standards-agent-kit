# Refined Package Separation Plan

## Key Findings from Dependency Analysis

The analysis revealed that HCS10 tools are tightly coupled to:
1. **HCS10Builder** - Every tool requires it
2. **State Management** - Shared state across all tools
3. **HederaAgentKit** - Core dependency for builder creation
4. **Type Definitions** - Extensive shared types

## Revised Architecture

### Option 1: Minimal Separation (Recommended)

Keep tools in `standards-agent-kit`, only separate the plugin bundle:

```
@hashgraphonline/standards-agent-kit/
├── src/
│   ├── tools/hcs10/           # All HCS10 tools remain here
│   ├── builders/              # HCS10Builder stays here
│   ├── state/                 # State management stays here
│   ├── types/                 # All types stay here
│   └── index.ts               # Exports everything

@hashgraphonline/standards-agent-plugin/
├── src/
│   ├── OpenConvAIPlugin.ts    # Just the plugin wrapper
│   └── index.ts
└── package.json               # Peer dep on kit
```

**Advantages:**
- No need to expose internal implementation details
- Tools and builder remain together (high cohesion)
- Plugin is just a thin bundler/orchestrator
- Easier to maintain and version

### Option 2: Full Separation with Shared Core

Create three packages:

```
@hashgraphonline/standards-agent-core/    # Shared foundations
├── src/
│   ├── builders/              # HCS10Builder
│   ├── state/                 # State interfaces
│   ├── types/                 # All shared types
│   └── base-tools/            # Base tool classes

@hashgraphonline/standards-agent-tools/   # Individual tools
├── src/
│   ├── RegisterAgentTool.ts
│   ├── FindRegistrationsTool.ts
│   └── ... (other tools)

@hashgraphonline/standards-agent-plugin/  # Plugin bundle
├── src/
│   └── OpenConvAIPlugin.ts
```

**Challenges:**
- Three packages to maintain and version
- More complex dependency management
- Exposing internal APIs as public contracts

## Recommended Approach: Minimal Separation

Based on the coupling analysis, I recommend Option 1:

### 1. **Package Structure**

**standards-agent-kit** exports:
```typescript
// Main exports
export * from './tools/hcs10';
export * from './builders';
export * from './state';
export * from './types';

// Optional: Plugin loader interface
export interface IPluginLoader {
  loadPlugin(name: string): Promise<BasePlugin>;
}
```

**standards-agent-plugin** contains:
```typescript
import {
  RegisterAgentTool,
  FindRegistrationsTool,
  // ... all tools
  HCS10Builder,
  OpenConvaiState,
  type IStateManager
} from '@hashgraphonline/standards-agent-kit';

export class OpenConvAIPlugin extends BasePlugin {
  // Plugin implementation that bundles tools
}
```

### 2. **Usage Patterns**

**Direct tool usage (without plugin):**
```typescript
import { 
  HCS10Builder, 
  RegisterAgentTool,
  OpenConvaiState 
} from '@hashgraphonline/standards-agent-kit';

const state = new OpenConvaiState();
const builder = new HCS10Builder(hederaKit, state);
const tool = new RegisterAgentTool({ hederaKit, hcs10Builder: builder });
```

**Plugin usage (bundled tools):**
```typescript
import { StandardsAgentKit } from '@hashgraphonline/standards-agent-kit';
import { OpenConvAIPlugin } from '@hashgraphonline/standards-agent-plugin';

const kit = new StandardsAgentKit(config);
const plugin = new OpenConvAIPlugin();
kit.addPlugin(plugin);
```

### 3. **Benefits of This Approach**

1. **Maintains Cohesion**: Tools, builder, and state stay together
2. **Simple Dependencies**: Only two packages instead of three
3. **Clear Separation**: Tools (functionality) vs Plugin (bundling)
4. **No Breaking Changes**: Existing imports continue to work
5. **Marketing Flexibility**: Can promote "tools for developers" vs "plugin for AI agents"

### 4. **Migration Path**

```bash
# Phase 1: Extract plugin
mkdir ../standards-agent-plugin
cp -r src/plugins/openconvai/* ../standards-agent-plugin/src/

# Phase 2: Update imports in plugin
# Change internal imports to package imports

# Phase 3: Update kit to not include plugin by default
# Remove plugin from StandardsAgentKit constructor

# Phase 4: Publish both packages
npm publish @hashgraphonline/standards-agent-kit
npm publish @hashgraphonline/standards-agent-plugin
```

## Implementation Checklist

- [ ] Create standards-agent-plugin package structure
- [ ] Move OpenConvAIPlugin to new package
- [ ] Update plugin imports to use kit package
- [ ] Remove plugin from kit's default initialization
- [ ] Add plugin loader interface to kit
- [ ] Update documentation for both packages
- [ ] Create examples for both usage patterns
- [ ] Test peer dependency resolution
- [ ] Publish beta versions
- [ ] Gather feedback and iterate

This approach provides the separation needed for independent promotion while maintaining the technical cohesion required by the tight coupling between tools and their dependencies.