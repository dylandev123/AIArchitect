import { capabilityRegistry } from "../../registry";
import { implementation } from "./implementation";
import { metadata } from "./metadata";

export const cornerGlazingPlugin = { metadata, implementation };
capabilityRegistry.register(cornerGlazingPlugin);
