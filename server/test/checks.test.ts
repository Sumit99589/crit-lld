import { describe, expect, it } from "vitest";
import { PROBLEMS } from "../src/content/problems.js";
import type { DesignModel } from "../src/domain/design.js";
import { LLD_RUBRIC } from "../src/domain/rubric.js";
import { CoreConceptCheck } from "../src/evaluation/checks/coreConcepts.js";
import { NarrativeCheck } from "../src/evaluation/checks/narrative.js";
import { RequirementCoverageCheck } from "../src/evaluation/checks/requirementCoverage.js";
import { ResponsibilityCheck } from "../src/evaluation/checks/responsibilities.js";
import { StructureCheck } from "../src/evaluation/checks/structure.js";
import { RuleBasedEvaluator } from "../src/evaluation/ruleBasedEvaluator.js";
import { DesignCanvasFormat } from "../src/formats/designCanvas.js";
import { parkingCanvas } from "./helpers.js";

const problem = PROBLEMS[0]!;
const format = new DesignCanvasFormat();
const goodModel = () => format.toModel(parkingCanvas());
const codes = (findings: { code: string }[]) => findings.map((f) => f.code);

function modelWith(patch: (m: DesignModel) => void): DesignModel {
  const m = goodModel();
  patch(m);
  return m;
}

describe("deterministic checks on a reasonable design", () => {
  it("raise nothing above a note", () => {
    const report = new RuleBasedEvaluator([
      new RequirementCoverageCheck(),
      new CoreConceptCheck(),
      new ResponsibilityCheck(),
      new StructureCheck(),
      new NarrativeCheck(),
    ]).evaluateSync({ problem, model: goodModel(), rubric: LLD_RUBRIC });
    expect(report.findings.filter((f) => f.severity !== "note")).toEqual([]);
    expect(report.caps).toEqual([]);
  });
});

describe("RequirementCoverageCheck", () => {
  const check = new RequirementCoverageCheck();

  it("reports each unmapped requirement and caps the band", () => {
    const result = check.run({ problem, model: modelWith((m) => delete m.traceability["FR-5"]) });
    expect(result.findings.map((f) => f.subject)).toContain("FR-5");
    expect(result.caps).toEqual([expect.objectContaining({ criterion: "requirements", maxBand: 3 })]);
    expect(result.coverage?.find((c) => c.requirementId === "FR-5")?.status).toBe("unmapped");
  });

  it("treats an empty map as a single major issue, not six", () => {
    const result = check.run({ problem, model: modelWith((m) => (m.traceability = {})) });
    expect(codes(result.findings)).toEqual(["REQ_MAP_EMPTY"]);
    expect(result.caps?.[0]?.maxBand).toBe(2);
  });

  it("marks a mapping to a class that no longer exists as broken", () => {
    const result = check.run({ problem, model: modelWith((m) => (m.traceability["FR-5"] = ["#deleted"])) });
    expect(result.coverage?.find((c) => c.requirementId === "FR-5")?.status).toBe("broken");
  });

  it("notices one class carrying most requirements", () => {
    const model = modelWith((m) => {
      for (const id of Object.keys(m.traceability)) m.traceability[id] = ["ParkingLot"];
    });
    expect(codes(check.run({ problem, model }).findings)).toContain("REQ_CONCENTRATED");
  });
});

describe("CoreConceptCheck", () => {
  it("asks about a concept that is nowhere in the design, without treating it as an error", () => {
    const model = modelWith((m) => {
      m.elements = m.elements.filter((e) => e.name !== "Ticket");
      for (const e of m.elements) {
        e.methods = e.methods.filter((x) => !/ticket|receipt/i.test(x));
        e.responsibility = e.responsibility.replace(/ticket(ing)?/gi, "visit");
      }
    });
    const findings = new CoreConceptCheck().run({ problem, model }).findings;
    expect(findings).toEqual([
      expect.objectContaining({ code: "CONCEPT_NOT_FOUND", subject: "Ticket", severity: "note" }),
    ]);
  });

  it("accepts aliases and different spacing", () => {
    const model = modelWith((m) => {
      const ticket = m.elements.find((e) => e.name === "Ticket")!;
      ticket.name = "Parking Receipt";
    });
    expect(new CoreConceptCheck().run({ problem, model }).findings).toEqual([]);
  });
});

describe("ResponsibilityCheck", () => {
  it("flags a manager class with many methods and a list of jobs as a likely god class", () => {
    const model = modelWith((m) =>
      m.elements.push({
        name: "ParkingManager",
        kind: "class",
        responsibility: "Handles entry, exit, pricing, payments and the display board",
        attributes: [],
        methods: Array.from({ length: 10 }, (_, i) => `op${i}()`),
      }),
    );
    const finding = new ResponsibilityCheck().run({ problem, model }).findings.find((f) => f.code === "GOD_CLASS");
    expect(finding).toMatchObject({ subject: "ParkingManager", severity: "major" });
  });

  it("notes vague responsibilities and data-only classes", () => {
    const model = modelWith((m) => {
      m.elements.push({
        name: "Helper",
        kind: "class",
        responsibility: "Handles stuff",
        attributes: [],
        methods: ["x()"],
      });
      m.elements.push({
        name: "Address",
        kind: "class",
        responsibility: "Postal address of the mall operator.",
        attributes: ["street", "city"],
        methods: [],
      });
    });
    const found = codes(new ResponsibilityCheck().run({ problem, model }).findings);
    expect(found).toEqual(expect.arrayContaining(["VAGUE_RESPONSIBILITY", "DATA_ONLY_CLASS"]));
  });
});

describe("StructureCheck", () => {
  const check = new StructureCheck();

  it("finds unconnected classes and abstractions nobody implements", () => {
    const model = modelWith((m) => {
      m.elements.push({
        name: "DisplayBoard",
        kind: "class",
        responsibility: "Shows free spot counts at the entry.",
        attributes: [],
        methods: ["refresh()"],
      });
      m.elements.push({
        name: "PaymentMethod",
        kind: "interface",
        responsibility: "Takes a payment for an amount.",
        attributes: [],
        methods: ["pay(amount)"],
      });
    });
    const result = check.run({ problem, model });
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "ORPHAN_ELEMENT", subject: "DisplayBoard" }),
        expect.objectContaining({ code: "UNREALISED_ABSTRACTION", subject: "PaymentMethod" }),
      ]),
    );
  });

  it("detects a composition cycle and caps relationships", () => {
    const model = modelWith((m) =>
      m.relations.push({ from: "ParkingSpot", to: "ParkingLot", type: "composes", label: "" }),
    );
    const result = check.run({ problem, model });
    expect(codes(result.findings)).toContain("COMPOSITION_CYCLE");
    expect(result.caps).toEqual([expect.objectContaining({ criterion: "relationships", maxBand: 2 })]);
  });

  it("catches 'implements' pointing at a class", () => {
    const model = modelWith((m) => m.relations.push({ from: "Car", to: "Ticket", type: "implements", label: "" }));
    expect(codes(check.run({ problem, model }).findings)).toContain("IMPLEMENTS_NON_INTERFACE");
  });

  it("does not crash on relationships to unknown names", () => {
    const model = modelWith((m) => m.relations.push({ from: "Ghost", to: "Phantom", type: "composes", label: "" }));
    expect(() => check.run({ problem, model })).not.toThrow();
  });
});

describe("NarrativeCheck", () => {
  const check = new NarrativeCheck();

  it("caps extensibility hard when the change scenario is ignored", () => {
    const result = check.run({ problem, model: modelWith((m) => (m.narrative.changeResponse = "")) });
    expect(codes(result.findings)).toContain("CHANGE_NOT_ADDRESSED");
    expect(result.caps).toEqual(
      expect.arrayContaining([expect.objectContaining({ criterion: "extensibility", maxBand: 1 })]),
    );
  });

  it("asks for failure cases when none are mentioned", () => {
    const model = modelWith((m) => {
      m.narrative.keyFlow = "ParkingLot asks SpotAllocator for a spot, creates a Ticket and opens the barrier.";
      m.narrative.decisions = "PricingPolicy is an interface because rates change.";
      m.narrative.assumptions = "One lot.";
    });
    const result = check.run({ problem, model });
    expect(codes(result.findings)).toContain("NO_FAILURE_CASES");
    expect(result.caps).toEqual(
      expect.arrayContaining([expect.objectContaining({ criterion: "behaviour", maxBand: 2 })]),
    );
  });

  it("notes patterns named without a reason, but not the plain word 'state'", () => {
    const model = modelWith(
      (m) =>
        (m.narrative.decisions = "We use Observer for the display board. The spot state is stored on ParkingSpot."),
    );
    const findings = check.run({ problem, model }).findings.filter((f) => f.code === "PATTERN_UNJUSTIFIED");
    expect(findings.map((f) => f.subject)).toEqual(["observer"]);
  });
});
