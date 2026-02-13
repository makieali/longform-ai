import type { WorldStateUpdate } from '../types.js';

export class WorldStore {
  private updates: WorldStateUpdate[] = [];

  addUpdate(update: WorldStateUpdate): void {
    this.updates.push(update);
  }

  getLatest(): WorldStateUpdate | null {
    return this.updates.length > 0 ? this.updates[this.updates.length - 1] : null;
  }

  getLocationStatus(name: string): string | undefined {
    for (let i = this.updates.length - 1; i >= 0; i--) {
      const loc = this.updates[i].locations.find(l => l.name === name);
      if (loc) return loc.status;
    }
    return undefined;
  }

  getAllLocations(): { name: string; description: string; status: string }[] {
    const locationMap = new Map<string, { name: string; description: string; status: string }>();
    for (const update of this.updates) {
      for (const loc of update.locations) {
        locationMap.set(loc.name, loc);
      }
    }
    return Array.from(locationMap.values());
  }

  getRules(): { rule: string; established: number }[] {
    const ruleMap = new Map<string, { rule: string; established: number }>();
    for (const update of this.updates) {
      for (const rule of update.rules) {
        ruleMap.set(rule.rule, rule);
      }
    }
    return Array.from(ruleMap.values());
  }
}
