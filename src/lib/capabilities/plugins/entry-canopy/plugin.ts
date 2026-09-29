import { capabilityRegistry } from "../../registry";
import { implementation } from "./implementation";
import { metadata } from "./metadata";

export const entryCanopyPlugin = { metadata, implementation };
capabilityRegistry.register(entryCanopyPlugin);
