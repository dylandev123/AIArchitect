import { capabilityRegistry } from "../../registry";
import { implementation } from "./implementation";
import { metadata } from "./metadata";

export const bridgeMassesPlugin = { metadata, implementation };
capabilityRegistry.register(bridgeMassesPlugin);
