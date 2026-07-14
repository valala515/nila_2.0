/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-no-outward-deps',
      comment: 'domain/ реализует бизнес-правила без I/O — не может зависеть от application/infrastructure/transport',
      severity: 'error',
      from: { path: '^src/domain' },
      to: { path: '^src/(application|infrastructure|transport)' },
    },
    {
      name: 'application-only-domain-and-ports',
      comment: 'application/ оркеструет domain/ через ports/ — не может напрямую импортировать infrastructure/transport',
      severity: 'error',
      from: { path: '^src/application' },
      to: {
        path: '^src/(infrastructure|transport)',
      },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    doNotFollow: { path: 'node_modules' },
  },
};
