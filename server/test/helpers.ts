import type { z } from "zod";
import type { Config } from "../src/config.js";
import { createContainer } from "../src/container.js";
import { CRITERION_IDS } from "../src/domain/rubric.js";
import {
  LlmError,
  type StructuredLlm,
  type StructuredRequest,
  type StructuredResponse,
} from "../src/evaluation/judge/llm.js";
import type { JudgeOutput } from "../src/evaluation/judge/prompt.js";
import type { DesignCanvas } from "../src/formats/designCanvas.js";
import { createApp } from "../src/http/app.js";
import { openDatabase } from "../src/infra/database.js";
import { silentLogger } from "../src/infra/logger.js";
import type { Clock } from "../src/lib/clock.js";

export class FakeClock implements Clock {
  constructor(private current = new Date("2026-10-12T10:00:00Z")) {}
  now() {
    return new Date(this.current);
  }
  advance(ms: number) {
    this.current = new Date(this.current.getTime() + ms);
  }
}

type Behaviour = JudgeOutput | LlmError | Error | (() => JudgeOutput | Promise<JudgeOutput>);

/** Stands in for the model. Each call consumes the next scripted behaviour (the last one repeats). */
export class FakeLlm implements StructuredLlm {
  readonly model = "fake-model";
  calls: string[] = [];

  constructor(private script: Behaviour[] = [judgeOutput()]) {}

  async generate<S extends z.ZodType>(request: StructuredRequest<S>): Promise<StructuredResponse<z.infer<S>>> {
    this.calls.push(request.prompt);
    const next = this.script.length > 1 ? this.script.shift()! : this.script[0]!;
    if (next instanceof Error) throw next;
    const output = typeof next === "function" ? await next() : next;
    return { output: output as z.infer<S>, model: this.model, inputTokens: 1200, outputTokens: 400 };
  }
}

export function judgeOutput(overrides: Partial<Record<(typeof CRITERION_IDS)[number], number>> = {}): JudgeOutput {
  return {
    criteria: CRITERION_IDS.map((criterion) => ({
      criterion,
      evidence: ["so two gates never get the same spot"],
      concern: `Concern about ${criterion}`,
      band: overrides[criterion] ?? 3,
      suggestion: `Suggestion for ${criterion}`,
      confidence: "medium" as const,
    })),
    strengths: ["Allocation is isolated in SpotAllocator."],
    next_steps: ["Model payment failures explicitly."],
    headline: "A clear design with room to tighten failure handling.",
  };
}

export const testConfig: Config = {
  port: 0,
  databasePath: ":memory:",
  anthropicApiKey: null,
  llmModel: "fake-model",
  llmTimeoutMs: 10_000,
  llmTotalCalls: Number.POSITIVE_INFINITY,
  llmDailyCalls: 100,
  llmPerLearnerHourly: 100,
  evalConcurrency: 2,
  staticDir: null,
};

export function harness(
  options: { llm?: StructuredLlm | null; config?: Partial<Config>; clock?: FakeClock; start?: boolean } = {},
) {
  const db = openDatabase(":memory:");
  const clock = options.clock ?? new FakeClock();
  const container = createContainer({
    db,
    config: { ...testConfig, ...options.config },
    logger: silentLogger,
    llm: options.llm === undefined ? new FakeLlm() : options.llm,
    clock,
    retryDelayMs: 0,
  });
  if (options.start !== false) container.start();
  const app = createApp(container, silentLogger);
  return { db, clock, container, app };
}

/** A reasonable parking-lot design that should pass every readiness check. */
export function parkingCanvas(): DesignCanvas {
  return {
    assumptions:
      "One lot only. Motorcycles use compact spots, cars regular, vans large. Card payment either succeeds or the driver retries at the gate.",
    entities: [
      {
        id: "e1",
        name: "ParkingLot",
        kind: "class",
        responsibility: "Entry point for the gates: coordinates allocation, ticketing and exit.",
        attributes: "floors",
        methods: "parkVehicle(vehicle, gate): Ticket\nexit(ticket, payment): Receipt",
      },
      {
        id: "e2",
        name: "Floor",
        kind: "class",
        responsibility: "Holds the spots on one level and reports free spots by size.",
        attributes: "number\nspots",
        methods: "findFreeSpot(size)\nfreeCount(size)",
      },
      {
        id: "e3",
        name: "ParkingSpot",
        kind: "class",
        responsibility: "A single spot with a size; knows whether it is free and who occupies it.",
        attributes: "size\noccupant",
        methods: "occupy(vehicle)\nrelease()\nfits(vehicle)",
      },
      {
        id: "e4",
        name: "Vehicle",
        kind: "abstract",
        responsibility: "A vehicle with a plate; its type decides which spot sizes fit.",
        attributes: "plate",
        methods: "allowedSizes()",
      },
      {
        id: "e5",
        name: "Car",
        kind: "class",
        responsibility: "A regular car that fits regular or large spots.",
        attributes: "",
        methods: "allowedSizes()",
      },
      {
        id: "e6",
        name: "Ticket",
        kind: "class",
        responsibility: "Records which vehicle parked in which spot and when it entered.",
        attributes: "entryTime\nspot\nvehicle",
        methods: "duration(now)",
      },
      {
        id: "e7",
        name: "PricingPolicy",
        kind: "interface",
        responsibility: "Calculates the fee for a ticket at exit time.",
        attributes: "",
        methods: "feeFor(ticket, exitTime): Money",
      },
      {
        id: "e8",
        name: "HourlyPricing",
        kind: "class",
        responsibility: "Charges an hourly rate per vehicle type, rounding partial hours up.",
        attributes: "rates",
        methods: "feeFor(ticket, exitTime): Money",
      },
      {
        id: "e9",
        name: "SpotAllocator",
        kind: "class",
        responsibility: "Chooses a free suitable spot and reserves it atomically so two gates never get the same spot.",
        attributes: "",
        methods: "allocate(vehicle): ParkingSpot",
      },
    ],
    relationships: [
      { id: "r1", from: "e1", to: "e2", type: "composes", label: "" },
      { id: "r2", from: "e2", to: "e3", type: "composes", label: "" },
      { id: "r3", from: "e1", to: "e9", type: "associates", label: "asks for spots" },
      { id: "r4", from: "e9", to: "e2", type: "associates", label: "" },
      { id: "r5", from: "e6", to: "e3", type: "associates", label: "" },
      { id: "r6", from: "e6", to: "e4", type: "associates", label: "" },
      { id: "r7", from: "e5", to: "e4", type: "inherits", label: "" },
      { id: "r8", from: "e8", to: "e7", type: "implements", label: "" },
      { id: "r9", from: "e1", to: "e7", type: "depends", label: "" },
    ],
    requirementMap: {
      "FR-1": ["e2", "e3"],
      "FR-2": ["e4", "e3"],
      "FR-3": ["e1", "e9", "e6"],
      "FR-4": ["e7", "e8", "e1"],
      "FR-5": ["e2"],
      "FR-6": ["e9"],
    },
    keyFlow:
      "A car arrives at gate 2. ParkingLot.parkVehicle asks SpotAllocator.allocate(car), which scans each Floor for a free ParkingSpot that fits and calls occupy() under a lock, so a concurrent request from gate 1 gets a different spot. ParkingLot creates a Ticket with the entry time. If no spot fits, allocate throws NoSpotAvailable and the gate shows 'Full for cars'. On exit, PricingPolicy.feeFor(ticket, now) computes the fee, payment is taken, and the spot is released.",
    decisions:
      "Pricing sits behind the PricingPolicy interface (strategy) because rates change often; weekend pricing becomes a new class instead of an edit to ParkingLot. Allocation lives in SpotAllocator so the locking is in one place.",
    changeResponse:
      "Add a ChargingSpot that extends ParkingSpot and an ElectricCar subtype of Vehicle. SpotAllocator prefers a ChargingSpot for electric cars when one is free. Charging cost becomes a ChargingPricing that the exit flow adds to PricingPolicy's fee, so ParkingLot itself doesn't change.",
  };
}
