import { MemorySaver } from '@langchain/langgraph';

export type CheckpointerType = 'memory' | 'sqlite' | 'postgres';

export interface CheckpointerConfig {
  type: CheckpointerType;
  connectionString?: string;
  dbPath?: string;
}

/**
 * Creates a checkpointer based on configuration.
 * For now, only MemorySaver is implemented (no external dependencies).
 * SQLite and Postgres can be added later with @langchain/langgraph-checkpoint-sqlite/postgres.
 */
export function createCheckpointer(config?: CheckpointerConfig) {
  const type = config?.type ?? 'memory';

  switch (type) {
    case 'memory':
      return new MemorySaver();
    case 'sqlite':
      // Future: dynamic import of @langchain/langgraph-checkpoint-sqlite
      console.warn('SQLite checkpointer not yet implemented, falling back to memory');
      return new MemorySaver();
    case 'postgres':
      // Future: dynamic import of @langchain/langgraph-checkpoint-postgres
      console.warn('Postgres checkpointer not yet implemented, falling back to memory');
      return new MemorySaver();
    default:
      return new MemorySaver();
  }
}
