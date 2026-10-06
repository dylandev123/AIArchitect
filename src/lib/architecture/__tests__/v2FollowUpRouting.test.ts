import { describe, expect, it } from "vitest";
import { routeV2FollowUp } from "../v2AdditiveObjects";

describe("routeV2FollowUp", () => {
  it.each(["add a lounge chair by the pool", "add 2 pool loungers", "add umbrella", "add an outdoor bar", "add a modern gazebo in the garden", "add a fire pit in the garden", "add a bench by the bedroom wing"])(
    "keeps the deterministic fast path for the recognized loose asset %j", (prompt) => {
      expect(routeV2FollowUp(prompt)).toEqual({ route: "placement" });
    });

  it.each(["add a fence", "add a gate", "create a garden wall", "extend the driveway", "add a covered walkway", "move the pool farther back", "add a koi-pond bridge with a lantern arch", "Change the roof to a gable roof", "remove the lounge chair"])(
    "sends %j to the Architect rather than refusing an unlisted noun", (prompt) => {
      expect(routeV2FollowUp(prompt).route).toBe("architect");
    });

  it.each(["move this chair onto the patio", "lower that table", "rotate the planter", "delete that tree", "recolor the sculpture"])(
    "sends an existing-object edit %j to the operation-plan Architect", (prompt) => {
      expect(routeV2FollowUp(prompt).route).toBe("architect");
    });
});
