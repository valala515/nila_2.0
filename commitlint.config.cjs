/**
 * Enforces the commit header convention documented in CLAUDE.md §10:
 *   <тип>(<область>): <краткое описание>
 * Body content (Что сделано / На что повлияет / ...) is free-form Russian
 * prose, so only the header is linted here.
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'style', 'chore', 'docs', 'test']],
    'header-max-length': [2, 'always', 100],
    // Subjects are written in Russian — Latin case rules (sentence-case, etc.) don't apply.
    'subject-case': [0],
    'subject-empty': [2, 'never'],
    'scope-empty': [0],
  },
};
