# Contributing to GeoAgri AI

Thank you for contributing to GeoAgri AI.

## Development Setup

1. **Backend**:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env
   ```
2. **Frontend**:
   ```bash
   cd frontend
   npm ci
   npm run dev
   ```

## Testing & Quality Gates

Before submitting changes, ensure all test suites and quality gates pass:

```bash
# 1. Backend test suite (100% offline)
PYTHONPATH=backend pytest backend/tests -q

# 2. Frontend unit tests
npm --prefix frontend test

# 3. End-to-end tests
cd frontend && npx playwright test

# 4. CSS class audit (ensures no orphaned classes)
python3 scripts/audit_css_classes.py
```

## Commit Style

Follow Conventional Commits: `type(scope): subject`.
- Examples: `fix(ui): correct metric card padding`, `feat(api): add health sources endpoint`.
- Avoid vague commits like "fix" or "update files".

