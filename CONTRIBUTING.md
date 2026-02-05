# Contributing to BlueFinWiki

Thank you for your interest in contributing to BlueFinWiki! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [Commit Guidelines](#commit-guidelines)
6. [Pull Request Process](#pull-request-process)
7. [Testing Requirements](#testing-requirements)

## 🤝 Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Collaborate openly
- Prioritize family-friendly content and behavior

## 🚀 Getting Started

### 1. Fork and Clone

```bash
git clone https://github.com/your-username/bluefinwiki.git
cd bluefinwiki
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions or modifications
- `chore/` - Maintenance tasks

## 💻 Development Workflow

### 1. Make Your Changes

Work on one feature or fix at a time. Keep changes focused and atomic.

### 2. Write Tests

All new features and bug fixes must include tests:
- Unit tests for components and utilities
- Integration tests for API endpoints
- Update existing tests if behavior changes

### 3. Run Tests Locally

```bash
# Run all tests
npm test

# Run tests for specific workspace
npm test --workspace=frontend
npm test --workspace=backend

# Run tests in watch mode
npm run test:watch --workspace=frontend
```

### 4. Lint and Type Check

```bash
# Lint all code
npm run lint

# Type check all code
npm run type-check
```

### 5. Build Locally

```bash
# Build all workspaces
npm run build --workspaces
```

## 📝 Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Avoid `any` types - use `unknown` if type is truly unknown
- Use interfaces for object shapes
- Use type aliases for unions and primitives

### React Components

```typescript
// ✅ Good: Functional component with TypeScript
interface UserProfileProps {
  userId: string;
  onUpdate?: (user: User) => void;
}

export function UserProfile({ userId, onUpdate }: UserProfileProps) {
  // Component logic
}

// ❌ Bad: Component without types
export function UserProfile({ userId, onUpdate }) {
  // Component logic
}
```

### Naming Conventions

- **Files**: `kebab-case.ts`, `PascalCase.tsx` for components
- **Components**: `PascalCase`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Interfaces**: `PascalCase` with descriptive names
- **Types**: `PascalCase` with descriptive names

### File Organization

```
component-name/
├── ComponentName.tsx       # Main component
├── ComponentName.test.tsx  # Tests
├── ComponentName.styles.ts # Styles (if needed)
├── types.ts               # Component-specific types
└── index.ts               # Public exports
```

### Comments

- Write self-documenting code
- Add comments for complex logic
- Use JSDoc for public APIs

```typescript
/**
 * Validates a user invitation code.
 * 
 * @param code - The invitation code to validate
 * @returns True if code is valid and unused
 * @throws {InvalidCodeError} If code format is invalid
 */
export async function validateInviteCode(code: string): Promise<boolean> {
  // Implementation
}
```

## 📦 Commit Guidelines

### Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

### Examples

```bash
# Feature
git commit -m "feat(auth): add JWT token refresh mechanism"

# Bug fix
git commit -m "fix(editor): prevent data loss on network error"

# Documentation
git commit -m "docs(readme): update installation instructions"

# Multiple paragraphs
git commit -m "feat(search): implement full-text search

- Add CloudSearch integration
- Create search API endpoint
- Implement frontend search UI

Closes #123"
```

### Scope

Use workspace names or feature areas:
- `frontend`
- `backend`
- `infrastructure`
- `auth`
- `editor`
- `search`
- `ci`

## 🔄 Pull Request Process

### Before Submitting

1. ✅ All tests pass locally
2. ✅ Code is linted and type-checked
3. ✅ Build succeeds
4. ✅ Commits follow commit guidelines
5. ✅ Branch is up to date with `main`

```bash
# Update your branch
git checkout main
git pull origin main
git checkout your-branch
git rebase main
```

### Creating a Pull Request

1. Push your branch:
   ```bash
   git push origin your-branch
   ```

2. Open a Pull Request on GitHub

3. Fill out the PR template completely

4. Link related issues using `Closes #123` or `Fixes #123`

5. Request review from team members

### PR Title Format

Use the same format as commit messages:

```
feat(auth): add JWT token refresh mechanism
fix(editor): prevent data loss on network error
```

### PR Description Template

The template will be pre-filled when you create a PR. Ensure all sections are completed:

- **Description**: What changes were made and why
- **Type of Change**: Feature, bug fix, etc.
- **Testing**: How to test the changes
- **Checklist**: All items checked

### Review Process

1. At least one approval required
2. All CI checks must pass
3. No merge conflicts
4. Code review comments addressed

### After Approval

- Squash and merge (preferred for feature branches)
- Rebase and merge (for clean history)
- Merge commit (for release branches)

## 🧪 Testing Requirements

### Unit Tests

- Test individual functions and components
- Mock external dependencies
- Aim for >80% code coverage

```typescript
// Example: Component test
import { render, screen } from '@testing-library/react';
import { UserProfile } from './UserProfile';

describe('UserProfile', () => {
  it('should display user name', () => {
    render(<UserProfile userId="123" />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });
});
```

### Integration Tests

- Test API endpoints
- Test component interactions
- Use MSW for API mocking

```typescript
// Example: API test
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/users/:id', (req, res, ctx) => {
    return res(ctx.json({ id: '123', name: 'John Doe' }));
  })
);

describe('User API', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('should fetch user data', async () => {
    const user = await fetchUser('123');
    expect(user.name).toBe('John Doe');
  });
});
```

### E2E Tests (Future)

- Test complete user flows
- Use Playwright for browser automation

## 🔍 Code Review Checklist

### For Reviewers

- [ ] Code follows project conventions
- [ ] Tests are included and pass
- [ ] Documentation is updated
- [ ] No unnecessary dependencies added
- [ ] Security considerations addressed
- [ ] Performance implications considered
- [ ] Accessibility requirements met (WCAG 2.1 AA)

### For Authors

- [ ] Self-review completed
- [ ] All CI checks pass
- [ ] Documentation updated
- [ ] Breaking changes documented
- [ ] Migration guide provided (if needed)

## 🐛 Reporting Bugs

### Bug Report Template

```markdown
**Description**
A clear description of the bug.

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior**
What should happen.

**Screenshots**
If applicable.

**Environment**
- OS: [e.g., macOS 14.0]
- Browser: [e.g., Chrome 120]
- Version: [e.g., 0.1.0]
```

## 💡 Feature Requests

### Feature Request Template

```markdown
**Problem Statement**
Describe the problem this feature would solve.

**Proposed Solution**
How should this feature work?

**Alternatives Considered**
Other approaches considered.

**Additional Context**
Mockups, examples, references.
```

## 📞 Questions?

- Open a GitHub Discussion
- Contact the team
- Check existing documentation

## 📄 License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to BlueFinWiki! 🎉
