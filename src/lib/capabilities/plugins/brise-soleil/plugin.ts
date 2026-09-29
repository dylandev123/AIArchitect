import { capabilityRegistry } from "../../registry";
import { implementation } from "./implementation";
import { metadata } from "./metadata";

export const briseSoleilPlugin = { metadata, implementation };
capabilityRegistry.register(briseSoleilPlugin);
