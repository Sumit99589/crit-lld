import { describe, expect, it } from "vitest";
import { PROBLEMS } from "../src/content/problems.js";
import { DesignCanvasFormat } from "../src/formats/designCanvas.js";
import { parkingCanvas } from "./helpers.js";

const format = new DesignCanvasFormat();
const problem = PROBLEMS[0]!;
const ctx = { requirementIds: problem.requirements.map((r) => r.id), changeTitle: problem.changeScenario.title };

describe("DesignCanvasFormat", () => {
  it("accepts an empty draft so learners can save early", () => {
    const parsed = format.parse({});
    expect(parsed.ok).toBe(true);
  });

  it("rejects malformed shapes with a path to the problem", () => {
    const parsed = format.parse({ entities: [{ id: "e1", name: "X", kind: "struct", responsibility: "" }] });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.issues[0]?.path).toBe("entities.0.kind");
  });

  it("finds a complete design ready to submit", () => {
    expect(format.submissionIssues(parkingCanvas())).toEqual([]);
  });

  it("explains why a thin design is not ready", () => {
    const canvas = format.empty();
    canvas.entities = [{ id: "a", name: "Lot", kind: "class", responsibility: "lot", attributes: "", methods: "" }];
    const paths = format.submissionIssues(canvas).map((i) => i.path);
    expect(paths).toEqual(expect.arrayContaining(["entities.0.responsibility", "entities", "relationships", "keyFlow"]));
  });

  it("flags duplicate class names regardless of case", () => {
    const canvas = parkingCanvas();
    canvas.entities[1]!.name = "parkinglot";
    expect(format.submissionIssues(canvas).some((i) => i.message.includes("defined twice"))).toBe(true);
  });

  it("flags relationships that point at deleted classes", () => {
    const canvas = parkingCanvas();
    canvas.relationships.push({ id: "rx", from: "e1", to: "gone", type: "associates", label: "" });
    expect(format.submissionIssues(canvas).some((i) => i.path === "relationships.9")).toBe(true);
  });

  it("ignores fully blank rows the UI leaves behind", () => {
    const canvas = parkingCanvas();
    canvas.entities.push({ id: "blank", name: "", kind: "class", responsibility: "", attributes: "", methods: "" });
    expect(format.submissionIssues(canvas)).toEqual([]);
  });

  it("translates ids to names in the design model", () => {
    const model = format.toModel(parkingCanvas());
    expect(model.relations[0]).toMatchObject({ from: "ParkingLot", to: "Floor", type: "composes" });
    expect(model.traceability["FR-3"]).toEqual(["ParkingLot", "SpotAllocator", "Ticket"]);
    expect(model.elements.find((e) => e.name === "Floor")?.methods).toEqual(["findFreeSpot(size)", "freeCount(size)"]);
  });

  it("renders the same text for the same content, so hashing deduplicates", () => {
    expect(format.render(parkingCanvas(), ctx)).toBe(format.render(parkingCanvas(), ctx));
    expect(format.render(parkingCanvas(), ctx)).toContain("- FR-6: SpotAllocator");
  });
});
