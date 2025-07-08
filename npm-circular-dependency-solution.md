# NPM Circular Dependency Solution

## Current Situation
- `cli-demo.ts` currently imports `OpenConvAIPlugin` from local source: `../src/plugins/openconvai/OpenConvAIPlugin`
- We want to move `OpenConvAIPlugin` to its own package: `@hashgraphonline/standards-agent-plugin`
- The plugin needs to import tools from `@hashgraphonline/standards-agent-kit`
- The cli-demo (and other examples) need to import the plugin from `@hashgraphonline/standards-agent-plugin`

## The Problem
If both packages depend on each other, npm will refuse to install due to circular dependency.

## The Solution

### Package Structure

**@hashgraphonline/standards-agent-plugin**
```json
{
  "name": "@hashgraphonline/standards-agent-plugin",
  "dependencies": {
    "@hashgraphonline/standards-agent-kit": "^2.0.0"
  }
}
```

**@hashgraphonline/standards-agent-kit**
```json
{
  "name": "@hashgraphonline/standards-agent-kit",
  "dependencies": {
    // NO dependency on plugin
  },
  "devDependencies": {
    // Plugin can be in devDependencies for examples/tests
    "@hashgraphonline/standards-agent-plugin": "^1.0.0"
  }
}
```

### Key Insight: Examples Don't Create Circular Dependencies

The examples (like cli-demo.ts) are not part of the package's runtime dependencies. They can import both packages without creating a circular dependency because:

1. The plugin depends on the kit (normal dependency)
2. The kit does NOT depend on the plugin (no runtime dependency)
3. Examples/tests can use both (devDependencies or user installs both)

### Updated cli-demo.ts

```typescript
// OLD - local import
import { OpenConvAIPlugin } from '../src/plugins/openconvai/OpenConvAIPlugin';

// NEW - package import
import { OpenConvAIPlugin } from '@hashgraphonline/standards-agent-plugin';
```

### How Users Install

```bash
# Users who want both tools AND plugin
npm install @hashgraphonline/standards-agent-kit
npm install @hashgraphonline/standards-agent-plugin
```

### StandardsAgentKit Options

If you want StandardsAgentKit to optionally load the plugin:

```typescript
// Option 1: User passes plugin instance
const plugin = new OpenConvAIPlugin();
const kit = new StandardsAgentKit({
  additionalPlugins: [plugin]
});

// Option 2: Dynamic import (no dependency needed)
const kit = new StandardsAgentKit(config);
await kit.loadPlugin('@hashgraphonline/standards-agent-plugin');
```

## Summary

- **No circular dependency** because kit doesn't depend on plugin
- **Plugin depends on kit** to import tools (one-way dependency)
- **Examples import both** as separate packages
- **Users install both** if they want plugin functionality

This is the same pattern used by:
- ESLint (core) and eslint plugins
- Webpack (core) and webpack loaders/plugins
- Express (core) and express middleware

🦊