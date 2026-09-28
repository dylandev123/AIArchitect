import type { CapabilityPlugin } from "./types";

/**
 * The permanent extension boundary. Plugins register themselves here; engine callers only use `get` and `all`.
 * Duplicate ids fail fast during application startup, rather than silently selecting arbitrary geometry.
 */
class CapabilityRegistry {
  private readonly entries = new Map<string, CapabilityPlugin>();
  register(plugin: CapabilityPlugin): void {
    if (this.entries.has(plugin.metadata.id)) throw new Error(`Capability plugin already registered: ${plugin.metadata.id}`);
    this.entries.set(plugin.metadata.id, plugin);
  }
  get(id: string): CapabilityPlugin | undefined { return this.entries.get(id); }
  all(): CapabilityPlugin[] { return [...this.entries.values()]; }
}

export const capabilityRegistry = new CapabilityRegistry();
