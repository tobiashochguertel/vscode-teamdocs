# Agent Instructions for vscode-teamdocs (fork)

<!-- BEGIN: project-todos agent instructions -->
## Project Todos Management

This repository tracks tasks, follow-ups, and planned work in `project-todos.yaml` backed by JSON Schema Draft 2020-12.

### Guidelines for AI Agents

1. **Discovery & Alignment**: Always inspect `project-todos.yaml` at repository root when planning work, discovering
   debt, or finishing a task.
2. **Adding New Todos**:
   - Write **what** is needed and the expected outcome, not implementation internals or code analysis.
   - Follow the schema (required fields: `id`, `title`, `description`, `status`, `priority`, `tags`, `created`).
   - Use kebab-case for `id` (e.g., `fix-auth-token-refresh`).
   - Set `created` timestamps with current ISO date, time, and timezone offset.
3. **Updating Todos**:
   - Update `status` to `in-progress` when actively working on a todo.
   - Mark `status` as `done` when the task and its tests are verified.
   - You can also use the CLI: `project-todos-cli done <todo-id>` or `project-todos-cli set status <todo-id> <status>`.
4. **Validation**:
   - Always run validation before committing changes to `project-todos.yaml`:

     ```bash
     project-todos-cli validate
     ```

     *(Or via uv: `uv run --project /path/to/project-todos-cli project-todos-cli validate`)*
<!-- END: project-todos agent instructions -->

## Development Workflow

Humans and agents should read [`DEVELOPMENT.md`](DEVELOPMENT.md) before making changes — it covers the
branch model (`dev.patch` is the develop branch), the revert-then-repatch `.patch` workflow, changelog
regeneration via git-cliff, Dependabot PR auto-conversion, and the release process.
