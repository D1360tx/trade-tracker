# Contributing to Trade Tracker Pro

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## 🚀 Getting Started

1. **Fork the repository**
2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/trade-tracker.git
   cd trade-tracker
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create `.env` file**:
   ```bash
   cp .env.example .env
   # Add your API keys
   ```
5. **Start dev server**:
   ```bash
   npm run dev
   ```

## 📝 Development Guidelines

### Code Style
- Use TypeScript for all new files
- Follow existing code formatting (Prettier/ESLint)
- Use meaningful variable and function names
- Add comments for complex logic

### Component Structure
```typescript
// Imports
import React from 'react';
import type { Trade } from '../types';

// Types/Interfaces
interface Props {
  trades: Trade[];
}

// Component
export const MyComponent: React.FC<Props> = ({ trades }) => {
  // Hooks
  const [state, setState] = useState();
  
  // Event handlers
  const handleClick = () => {};
  
  // Render
  return <div>...</div>;
};
```

### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat: Add new feature`
- `fix: Bug fix`
- `docs: Documentation changes`
- `style: Formatting changes`
- `refactor: Code refactoring`
- `test: Add tests`
- `chore: Maintenance tasks`

## 🔄 Pull Request Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** and commit:
   ```bash
   git add .
   git commit -m "feat: Add your feature"
   ```

3. **Push to your fork**:
   ```bash
   git push origin feat/your-feature-name
   ```

4. **Open a Pull Request** on GitHub

5. **Describe your changes**:
   - What does this PR do?
   - Why is this change needed?
   - Any breaking changes?
   - Screenshots (if UI changes)

## 🐛 Reporting Bugs

**Before submitting**, search existing issues to avoid duplicates.

**Bug Report Template**:
```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- Browser: [e.g. Chrome 120]
- OS: [e.g. macOS, Windows]
```

## 💡 Feature Requests

**Feature Request Template**:
```markdown
**Is your feature request related to a problem?**
A clear description of the problem.

**Describe the solution you'd like**
What you want to happen.

**Describe alternatives you've considered**
Other solutions you've thought about.

**Additional context**
Any other context or screenshots.
```

## 🎯 Areas for Contribution

### High Priority
- [ ] Database integration (MongoDB/PostgreSQL)
- [ ] More exchange integrations (Binance, MT4/MT5)
- [ ] Performance optimizations for large datasets
- [ ] Mobile responsive improvements

### Medium Priority
- [ ] Additional chart types
- [ ] Export functionality (PDF reports)
- [ ] Dark mode enhancements
- [ ] Keyboard shortcuts

### Good First Issues
- [ ] UI polish and animations
- [ ] Documentation improvements
- [ ] Error message improvements
- [ ] Add more tests

## 🧪 Testing

Before submitting a PR:
- [ ] Test your changes locally
- [ ] Check console for errors
- [ ] Test with different exchanges
- [ ] Verify responsive design
- [ ] Update documentation if needed

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Thank You!

Your contributions make this project better for everyone. Thank you for taking the time to contribute!
