# Node ACME Project Guidelines

## General
- Write clear, concise, and self-documenting code.
- Use TypeScript for all source files in `src/`.
- Prefer ES modules syntax (import/export).
- Avoid using `any` unless absolutely necessary; prefer strict typing.

## Code Style
- Follow the ESLint rules defined in `eslint.config.mjs`.
- Use Prettier for code formatting if available.
- Keep functions small and focused; one function, one responsibility.
- Use descriptive variable and function names.
- Add JSDoc comments for exported functions and classes.

## Project Structure
- Place all source code in `src/`.
- Place all tests in `tests/`, mirroring the structure of `src/`.
- Keep test files named as `*.test.ts`.

## Testing
- Write unit tests for all new features and bug fixes.
- Use a consistent testing framework (e.g., Jest or Vitest).
- Ensure tests are deterministic and do not depend on external state.
- Run tests before submitting changes.

## Dependency Management
- Use `pnpm` for installing and managing dependencies.
- Do not commit `node_modules/`.
- Keep dependencies up to date and remove unused packages.

## Git & PRs
- Write clear, descriptive commit messages.
- Use feature branches for new work.
- Open pull requests for all changes; do not commit directly to main.
- Ensure all checks pass before merging.

## Documentation
- Update `README.md` with any user-facing changes.
- Document public APIs and important modules.
