import { capabilityRegistry } from "../../registry";
import { implementation } from "./implementation";
import { metadata } from "./metadata";

export const courtyardEdgeWallPlugin = { metadata, implementation };
capabilityRegistry.register(courtyardEdgeWallPlugin);
