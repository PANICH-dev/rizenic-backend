# Task: Refactor rizenic-backend-service to Clean Architecture & SOLID Principles

> Detailed specifications, architecture blueprint, and step-by-step instructions are documented in:
> 📄 [docs/clean-architecture-refactoring-guide.md](docs/clean-architecture-refactoring-guide.md)

---

## Executive Summary for AI / Codex:

Please read [docs/clean-architecture-refactoring-guide.md](docs/clean-architecture-refactoring-guide.md) completely before making changes.

### Key Mandates:
1. **Zero Regression**: Preserve 100% backward compatibility with legacy endpoints (`/api/...` and `/api/v1/...`).
2. **Format Code**: De-minify all compact single-line methods across `jobs`, `parts`, and `operations` to standard Google Java Style.
3. **Type Safety**: Replace `Map<String, Object>` with Java 21 `record` DTOs.
4. **SOLID Principles**:
   - Split `JobsRepository` God Class into focused persistence adapters (`Customer`, `Vehicle`, `Document`, `Station`, `RepairJob`).
   - Refactor `fast()` using Strategy Pattern (`JobFieldUpdateStrategy`).
5. **Rename `operations`**: Refactor into domain packages (`inspection`, `quota`, `preference`).
6. **Centralize Exceptions**: Add `@RestControllerAdvice` (`GlobalExceptionHandler`).
7. **Testing**: Add MockMvc and Mockito tests; ensure `mvn test` passes cleanly.
8. **No DB Migrations**: Do not modify any files in `database/` or alter `rizenic_old`/`rizenic_new` schemas.
