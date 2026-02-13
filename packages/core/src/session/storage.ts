import type { SessionStorage } from '../types.js';

/**
 * In-memory session storage. Data lives only while the process runs.
 */
export class MemorySessionStorage implements SessionStorage {
  private store = new Map<string, string>();

  async save(id: string, state: string): Promise<void> {
    this.store.set(id, state);
  }

  async load(id: string): Promise<string | null> {
    return this.store.get(id) ?? null;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async list(): Promise<string[]> {
    return Array.from(this.store.keys());
  }
}
