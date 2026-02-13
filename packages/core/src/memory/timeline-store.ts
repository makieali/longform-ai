import type { TimelineEvent } from '../types.js';

export class TimelineStore {
  private events: TimelineEvent[] = [];

  addEvent(event: TimelineEvent): void {
    this.events.push(event);
    this.events.sort((a, b) => a.chapter - b.chapter);
  }

  addEvents(events: TimelineEvent[]): void {
    for (const event of events) {
      this.addEvent(event);
    }
  }

  getEvents(fromChapter?: number, toChapter?: number): TimelineEvent[] {
    return this.events.filter(e => {
      if (fromChapter !== undefined && e.chapter < fromChapter) return false;
      if (toChapter !== undefined && e.chapter > toChapter) return false;
      return true;
    });
  }

  getMajorEvents(): TimelineEvent[] {
    return this.events.filter(e => e.significance === 'major');
  }

  getEventsForCharacter(name: string): TimelineEvent[] {
    return this.events.filter(e => e.characters.includes(name));
  }

  getRecentEvents(count = 10): TimelineEvent[] {
    return this.events.slice(-count);
  }

  getTotalEvents(): number { return this.events.length; }
}
