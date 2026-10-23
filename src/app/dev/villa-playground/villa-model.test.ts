import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial } from "three";
import { instantiateVilla } from "./villa-model";

describe("playground villa instances", () => {
  it("preserves authored transforms and shares geometry while isolating each part's material", () => {
    const source = new Group();
    source.position.set(-4, 0, 2);
    const geometry = new BoxGeometry(), finish = new MeshStandardMaterial({ color: "#ddd0ba" });
    const facade = new Mesh(geometry, finish), roof = new Mesh(geometry, finish);
    facade.name = "Facade"; facade.position.set(3, 2, -1); facade.rotation.y = .4;
    roof.name = "Roof"; roof.position.set(0, 5, 0);
    source.add(facade, roof);
    const a = instantiateVilla(source), b = instantiateVilla(source);
    const aFacade = a.getObjectByName("Facade") as Mesh<BoxGeometry, MeshStandardMaterial>;
    const aRoof = a.getObjectByName("Roof") as Mesh<BoxGeometry, MeshStandardMaterial>;
    const bFacade = b.getObjectByName("Facade") as Mesh<BoxGeometry, MeshStandardMaterial>;
    expect(a.position.toArray()).toEqual(source.position.toArray());
    expect(aFacade.position.toArray()).toEqual(facade.position.toArray());
    expect(aFacade.rotation.y).toBeCloseTo(.4);
    expect(aFacade.geometry).toBe(geometry);
    expect(aFacade.material).not.toBe(finish);
    expect(aFacade.material).not.toBe(aRoof.material);
    expect(aFacade.material).not.toBe(bFacade.material);
    aFacade.material.color.set("red");
    expect(aRoof.material.color.getHexString()).toBe("ddd0ba");
    expect(finish.color.getHexString()).toBe("ddd0ba");
  });

  it("lets sunlight pass through transmission glass while retaining opaque shadows", () => {
    const source = new Group();
    const pane = new Mesh(new BoxGeometry(), new MeshPhysicalMaterial({ transmission: 1, roughness: .04 }));
    pane.name = "Glazing";
    const wall = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    wall.name = "Wall"; wall.castShadow = true; wall.receiveShadow = true;
    source.add(pane, wall);
    const copy = instantiateVilla(source);
    expect(copy.getObjectByName("Glazing")?.castShadow).toBe(false);
    expect(copy.getObjectByName("Wall")?.castShadow).toBe(true);
    expect(pane.material.transmission).toBe(1);
  });
});
