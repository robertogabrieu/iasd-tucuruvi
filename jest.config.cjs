/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // As worktrees dos agentes moram em .claude/worktrees/: sem isto, a suíte rodada no checkout
  // principal executa também os testes de cada uma delas.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // O código do servidor importa com sufixo .js (exigência do ESM em produção); o Jest resolve
    // os .ts, então o sufixo precisa cair na resolução.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // isolatedModules: cada arquivo é só traduzido, sem montar o programa TypeScript inteiro
        // por worker; a checagem de tipos é do `tsc` do build.
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
          isolatedModules: true,
        },
      },
    ],
  },
}

module.exports = config
