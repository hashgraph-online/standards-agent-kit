# Package Separation Plan: Standards Agent Kit & Plugin

## Overview
This plan outlines how to separate the current monolithic `@hashgraphonline/standards-agent-kit` into two independent packages while avoiding circular dependencies.

## Proposed Architecture

### Package Structure

```
@hashgraphonline/standards-agent-kit/    # Core tools and utilities
├── src/
│   ├── tools/                          # HCS10 tools
│   │   └── hcs10/
│   │       ├── RegisterAgentTool.ts
│   │       ├── FindRegistrationsTool.ts
│   │       └── ... (other tools)
│   ├── builders/                       # HCS10Builder
│   ├── state/                          # State management
│   ├── types/                          # Shared types/interfaces
│   └── index.ts                        # Exports tools, builders, types

@hashgraphonline/standards-agent-plugin/ # Plugin that bundles tools
├── src/
│   ├── OpenConvAIPlugin.ts             # Main plugin class
│   ├── types.ts                        # Plugin-specific types
│   └── index.ts                        # Export plugin
└── package.json                        # Peer dependency on kit
```

## Solution: Peer Dependencies + Registration Pattern

### 1. **Core Principle**
- `standards-agent-kit` provides tools, builders, and types
- `standards-agent-plugin` imports from kit as a **peer dependency**
- Applications install both packages together
- No direct circular dependency exists

### 2. **Package Dependencies**

**@hashgraphonline/standards-agent-kit**
```json
{
  "dependencies": {
    "@hashgraphonline/standards-sdk": "^0.0.146",
    "hedera-agent-kit": "^2.0.3",
    // ... other core dependencies
  },
  "peerDependencies": {
    // Optional: Define plugin interface compatibility
    "@hashgraphonline/standards-agent-plugin": "^1.0.0"
  },
  "peerDependenciesMeta": {
    "@hashgraphonline/standards-agent-plugin": {
      "optional": true
    }
  }
}
```

**@hashgraphonline/standards-agent-plugin**
```json
{
  "peerDependencies": {
    "@hashgraphonline/standards-agent-kit": "^1.0.0",
    "hedera-agent-kit": "^2.0.3"
  },
  "devDependencies": {
    "@hashgraphonline/standards-agent-kit": "^1.0.0",
    "hedera-agent-kit": "^2.0.3"
  }
}
```

### 3. **Usage Pattern**

**For applications using both:**
```json
{
  "dependencies": {
    "@hashgraphonline/standards-agent-kit": "^1.0.0",
    "@hashgraphonline/standards-agent-plugin": "^1.0.0",
    "hedera-agent-kit": "^2.0.3"
  }
}
```

## Implementation Strategy

### Phase 1: Extract Plugin to Separate Package

1. **Create new package structure**
   ```bash
   standards-agent-plugin/
   ├── src/
   │   ├── OpenConvAIPlugin.ts
   │   ├── types.ts
   │   └── index.ts
   ├── package.json
   ├── tsconfig.json
   └── README.md
   ```

2. **Move OpenConvAIPlugin**
   - Copy plugin code to new package
   - Update imports to reference kit as external package
   - Ensure all tool imports use `@hashgraphonline/standards-agent-kit`

3. **Update plugin to import tools:**
   ```typescript
   import {
     RegisterAgentTool,
     FindRegistrationsTool,
     InitiateConnectionTool,
     // ... other tools
     HCS10Builder,
     OpenConvaiState
   } from '@hashgraphonline/standards-agent-kit';
   ```

### Phase 2: Update Standards Agent Kit

1. **Remove plugin from kit**
   - Delete `src/plugins/openconvai/` directory
   - Keep plugin interface definitions
   - Export all tools, builders, and types

2. **Create optional plugin loader**
   ```typescript
   // src/kit/StandardsAgentKit.ts
   export class StandardsAgentKit {
     async loadPlugin(pluginName: string) {
       try {
         if (pluginName === '@hashgraphonline/standards-agent-plugin') {
           const { OpenConvAIPlugin } = await import(pluginName);
           const plugin = new OpenConvAIPlugin();
           await this.hederaKit.addPlugin(plugin);
           return plugin;
         }
       } catch (error) {
         console.warn(`Plugin ${pluginName} not installed`);
       }
     }
   }
   ```

### Phase 3: Maintain Backward Compatibility

1. **Export wrapper for easy migration:**
   ```typescript
   // src/kit/StandardsAgentKitWithPlugin.ts
   export async function createStandardsAgentKitWithPlugin(config: StandardsAgentKitConfig) {
     const kit = new StandardsAgentKit(config);
     await kit.initialize();
     
     try {
       await kit.loadPlugin('@hashgraphonline/standards-agent-plugin');
     } catch (error) {
       console.warn('Plugin not available, continuing without it');
     }
     
     return kit;
   }
   ```

## Benefits

1. **Clean Separation**: Tools and plugin are independently versioned
2. **No Circular Dependencies**: Peer dependencies prevent circular refs
3. **Flexible Usage**: Users can choose to install just tools or tools + plugin
4. **Backward Compatible**: Existing code can migrate gradually
5. **Independent Promotion**: Each package can be marketed separately

## Migration Guide

### For existing users:

1. **Install both packages:**
   ```bash
   npm install @hashgraphonline/standards-agent-kit@latest
   npm install @hashgraphonline/standards-agent-plugin@latest
   ```

2. **Update imports:**
   ```typescript
   // Old
   import { StandardsAgentKit } from '@hashgraphonline/standards-agent-kit';
   
   // New (if using plugin)
   import { StandardsAgentKit } from '@hashgraphonline/standards-agent-kit';
   import { OpenConvAIPlugin } from '@hashgraphonline/standards-agent-plugin';
   ```

3. **Initialize with plugin:**
   ```typescript
   const kit = new StandardsAgentKit(config);
   await kit.initialize();
   await kit.loadPlugin('@hashgraphonline/standards-agent-plugin');
   ```

## Versioning Strategy

1. **Synchronized Major Versions**: Keep major versions in sync for compatibility
2. **Independent Minor/Patch**: Allow independent feature/fix releases
3. **Version Matrix**: Document compatible version combinations

## Testing Strategy

1. **Unit Tests**: Each package tests its own components
2. **Integration Tests**: Separate test package that imports both
3. **Example Apps**: Demonstrate usage patterns

## Release Process

1. **Independent CI/CD**: Each package has its own pipeline
2. **Coordinated Releases**: For breaking changes, release together
3. **Changelogs**: Maintain separate changelogs

## Risk Mitigation

1. **Peer Dependency Issues**: Clear documentation on installation
2. **Version Conflicts**: Use version ranges carefully
3. **Migration Pain**: Provide automated migration scripts
4. **Type Safety**: Ensure shared types remain compatible

## Timeline

- Week 1: Set up new package structure
- Week 2: Move code and update imports
- Week 3: Testing and documentation
- Week 4: Beta release and feedback
- Week 5: Production release

This approach provides clean separation while maintaining flexibility and avoiding NPM dependency hell.