import { capabilityRegistry } from "../../registry";
import { implementation } from "./implementation";
import { metadata } from "./metadata";

export const screenLayerPlugin = { metadata, implementation };
capabilityRegistry.register(screenLayerPlugin);
