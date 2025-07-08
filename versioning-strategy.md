# Versioning and Release Strategy

## Overview
This document outlines the versioning and release strategy for the separated packages:
- `@hashgraphonline/standards-agent-kit` - Core tools and utilities
- `@hashgraphonline/standards-agent-plugin` - Plugin bundle for AI agents

## Semantic Versioning

Both packages follow Semantic Versioning (SemVer):
- **MAJOR.MINOR.PATCH** (e.g., 1.2.3)
- **MAJOR**: Breaking API changes
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, backward compatible

## Version Compatibility Matrix

| standards-agent-kit | standards-agent-plugin | Compatible |
|-------------------|----------------------|------------|
| 1.0.x             | 1.0.x                | ✅         |
| 1.1.x             | 1.0.x                | ✅         |
| 1.1.x             | 1.1.x                | ✅         |
| 2.0.x             | 1.x.x                | ❌         |
| 2.0.x             | 2.0.x                | ✅         |

## Release Strategy

### 1. Synchronized Major Releases

When making breaking changes to shared interfaces:

```bash
# Release kit first
cd standards-agent-kit
npm version major
npm publish

# Then release plugin
cd ../standards-agent-plugin
npm version major
# Update peer dependency version
npm publish
```

### 2. Independent Minor/Patch Releases

For non-breaking changes:

```bash
# Kit adds new tool
cd standards-agent-kit
npm version minor
npm publish

# Plugin can stay on current version
# Or update to bundle new tool
cd ../standards-agent-plugin
npm version minor
npm publish
```

## Release Workflows

### Pre-Release Testing

```yaml
# .github/workflows/pre-release.yml
name: Pre-Release Testing

on:
  workflow_dispatch:
    inputs:
      package:
        description: 'Package to test'
        required: true
        type: choice
        options:
          - standards-agent-kit
          - standards-agent-plugin
          - both

jobs:
  test-compatibility:
    runs-on: ubuntu-latest
    steps:
      - name: Test Package Compatibility
        run: |
          # Install both packages
          npm install @hashgraphonline/standards-agent-kit@next
          npm install @hashgraphonline/standards-agent-plugin@next
          
          # Run integration tests
          npm test
```

### Release Process

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'kit-v*'
      - 'plugin-v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Determine Package
        id: package
        run: |
          if [[ ${{ github.ref }} == refs/tags/kit-* ]]; then
            echo "package=standards-agent-kit" >> $GITHUB_OUTPUT
          else
            echo "package=standards-agent-plugin" >> $GITHUB_OUTPUT
          fi
      
      - name: Publish to NPM
        run: |
          cd ${{ steps.package.outputs.package }}
          npm publish
```

## Version Management

### 1. Peer Dependency Ranges

Use flexible version ranges for peer dependencies:

```json
{
  "peerDependencies": {
    "@hashgraphonline/standards-agent-kit": "^1.0.0"
  }
}
```

- `^1.0.0` - Compatible with 1.x.x but not 2.0.0
- `~1.0.0` - Compatible with 1.0.x only
- `>=1.0.0 <2.0.0` - Explicit range

### 2. Version Pinning for Examples

Examples should pin specific versions:

```json
{
  "dependencies": {
    "@hashgraphonline/standards-agent-kit": "1.0.0",
    "@hashgraphonline/standards-agent-plugin": "1.0.0"
  }
}
```

## Release Channels

### 1. Production Releases

```bash
npm publish
# or
npm publish --tag latest
```

### 2. Beta Releases

```bash
npm version 1.0.0-beta.1
npm publish --tag beta
```

### 3. Next/Canary Releases

```bash
npm version 1.0.0-next.$(date +%Y%m%d%H%M%S)
npm publish --tag next
```

## Deprecation Policy

### 1. Deprecation Timeline

- **Announce**: In release notes and console warnings
- **Grace Period**: 6 months for major deprecations
- **Remove**: In next major version

### 2. Deprecation Warnings

```typescript
/**
 * @deprecated Since version 1.5.0. Will be removed in 2.0.0. Use `newMethod` instead.
 */
export function oldMethod() {
  console.warn('oldMethod is deprecated. Use newMethod instead.');
  return newMethod();
}
```

## Changelog Management

### 1. Conventional Commits

Use conventional commits for automatic changelog generation:

```bash
# Features
feat(tools): add new verification tool

# Fixes
fix(plugin): correct tool initialization order

# Breaking changes
feat(kit)!: rename Builder to HCS10Builder

BREAKING CHANGE: Builder class renamed to HCS10Builder
```

### 2. Changelog Format

```markdown
# Changelog

## [1.1.0] - 2024-01-15

### Added
- New VerificationTool for HCS-10 compliance
- Export additional types for plugin development

### Fixed
- Connection state persistence issue
- Type inference in TypeScript 5.3

### Changed
- Improved error messages for better debugging

### Breaking Changes
- None
```

## Version Bump Decision Tree

```
Is it a bug fix only?
├─ YES → PATCH (1.0.0 → 1.0.1)
└─ NO
   │
   Does it add new features?
   ├─ YES
   │  │
   │  Is it backward compatible?
   │  ├─ YES → MINOR (1.0.0 → 1.1.0)
   │  └─ NO → MAJOR (1.0.0 → 2.0.0)
   │
   └─ NO
      │
      Does it change existing APIs?
      ├─ YES → MAJOR (1.0.0 → 2.0.0)
      └─ NO → PATCH (1.0.0 → 1.0.1)
```

## Coordinated Releases

### Scenario 1: Adding New Tool to Kit

1. **Kit Release** (Minor):
   - Add new tool to standards-agent-kit
   - Version: 1.1.0 → 1.2.0
   - Plugin continues to work (backward compatible)

2. **Plugin Update** (Optional Minor):
   - Update to include new tool in bundle
   - Version: 1.1.0 → 1.2.0

### Scenario 2: Breaking Change in Shared Interface

1. **Kit Release** (Major):
   - Change tool constructor signature
   - Version: 1.2.0 → 2.0.0

2. **Plugin Release** (Major, Required):
   - Update to use new interface
   - Version: 1.2.0 → 2.0.0
   - Update peer dependency

## Release Checklist

### Pre-Release
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Migration guide (if breaking changes)
- [ ] Compatibility tested
- [ ] Changelog updated

### Release
- [ ] Version bumped appropriately
- [ ] Git tag created
- [ ] Package published to NPM
- [ ] GitHub release created
- [ ] Announcement prepared

### Post-Release
- [ ] Examples updated
- [ ] Community notified
- [ ] Monitor for issues
- [ ] Update compatibility matrix

## Emergency Procedures

### Unpublishing a Release

```bash
# Within 72 hours
npm unpublish @hashgraphonline/standards-agent-kit@1.0.0

# After 72 hours (deprecate instead)
npm deprecate @hashgraphonline/standards-agent-kit@1.0.0 "Critical bug, use 1.0.1"
```

### Hotfix Process

1. Create hotfix branch from tag
2. Fix issue with minimal changes
3. Release as patch version
4. Cherry-pick to main branch

This strategy ensures smooth releases while maintaining compatibility between the separated packages.