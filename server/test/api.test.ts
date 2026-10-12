import request from "supertest";
import { describe, expect, it } from "vitest";
import { FakeLlm, harness, judgeOutput, parkingCanvas } from "./helpers.js";

const ME = { "x-learner-id": "learner-0001" };
const SOMEONE_ELSE = { "x-learner-id": "learner-0002" };

describe("practice loop over HTTP", () => {
  it("goes from problem list to feedback to history", async () => {
    const h = harness();
    const api = request(h.app);

    const problems = await api.get("/api/problems").set(ME).expect(200);
    expect(problems.body.map((p: { slug: string }) => p.slug)).toContain("parking-lot");

    const attempt = await api.post("/api/attempts").set(ME).send({ problemSlug: "parking-lot" }).expect(201);
    const attemptId = attempt.body.id;

    await api.put(`/api/attempts/${attemptId}/draft`).set(ME).send({ draft: parkingCanvas() }).expect(200);
    const precheck = await api.post(`/api/attempts/${attemptId}/precheck`).set(ME).send({ draft: parkingCanvas() }).expect(200);
    expect(precheck.body.readiness).toEqual([]);

    const submitted = await api
      .post(`/api/attempts/${attemptId}/submissions`)
      .set(ME)
      .set("Idempotency-Key", "key-0000001")
      .send({ draft: parkingCanvas() })
      .expect(202);
    expect(submitted.body.submission.revision).toBe(1);

    await h.container.queue.onIdle();
    const result = await api.get(`/api/submissions/${submitted.body.submission.id}`).set(ME).expect(200);
    expect(result.body.evaluation.status).toBe("completed");
    expect(result.body.evaluation.feedback.criteria).toHaveLength(6);
    expect(result.body.evaluation).not.toHaveProperty("version");

    const history = await api.get("/api/history").set(ME).expect(200);
    expect(history.body[0].revisions[0]).toMatchObject({ revision: 1, status: "completed", mode: "full" });

    const listed = await api.get("/api/problems").set(ME).expect(200);
    expect(listed.body.find((p: { slug: string }) => p.slug === "parking-lot").progress.attempts).toBe(1);
  });

  it("treats a repeated submit with the same idempotency key as the same submission", async () => {
    const h = harness();
    const api = request(h.app);
    const { body: attempt } = await api.post("/api/attempts").set(ME).send({ problemSlug: "parking-lot" });
    const send = () =>
      api.post(`/api/attempts/${attempt.id}/submissions`).set(ME).set("Idempotency-Key", "double-click-1").send({ draft: parkingCanvas() });

    const first = await send().expect(202);
    const second = await send().expect(200);
    expect(second.body.duplicate).toBe(true);
    expect(second.body.submission.id).toBe(first.body.submission.id);
  });

  it("does not create a new revision when nothing changed", async () => {
    const h = harness();
    const api = request(h.app);
    const { body: attempt } = await api.post("/api/attempts").set(ME).send({ problemSlug: "parking-lot" });
    await api.post(`/api/attempts/${attempt.id}/submissions`).set(ME).send({ draft: parkingCanvas() }).expect(202);
    const again = await api.post(`/api/attempts/${attempt.id}/submissions`).set(ME).send({ draft: parkingCanvas() }).expect(200);
    expect(again.body.submission.revision).toBe(1);
  });

  it("rejects a design that isn't ready, with field-level reasons, and stores nothing", async () => {
    const h = harness();
    const api = request(h.app);
    const { body: attempt } = await api.post("/api/attempts").set(ME).send({ problemSlug: "parking-lot" });
    const res = await api.post(`/api/attempts/${attempt.id}/submissions`).set(ME).send({ draft: {} }).expect(422);
    expect(res.body.issues.map((i: { path: string }) => i.path)).toEqual(expect.arrayContaining(["entities", "keyFlow"]));
    const history = await api.get("/api/history").set(ME);
    expect(history.body[0].revisions).toEqual([]);
  });

  it("hides one learner's attempts and submissions from another", async () => {
    const h = harness();
    const api = request(h.app);
    const { body: attempt } = await api.post("/api/attempts").set(ME).send({ problemSlug: "parking-lot" });
    const { body: sub } = await api.post(`/api/attempts/${attempt.id}/submissions`).set(ME).send({ draft: parkingCanvas() });

    await api.get(`/api/attempts/${attempt.id}`).set(SOMEONE_ELSE).expect(404);
    await api.put(`/api/attempts/${attempt.id}/draft`).set(SOMEONE_ELSE).send({ draft: {} }).expect(404);
    await api.get(`/api/submissions/${sub.submission.id}`).set(SOMEONE_ELSE).expect(404);
  });

  it("requires a learner id", async () => {
    const h = harness();
    await request(h.app).get("/api/problems").expect(400);
    await request(h.app).get("/api/problems").set("x-learner-id", "x").expect(400);
  });

  it("returns 404 for unknown problems and attempts", async () => {
    const h = harness();
    const api = request(h.app);
    await api.post("/api/attempts").set(ME).send({ problemSlug: "time-machine" }).expect(404);
    await api.get("/api/attempts/nope").set(ME).expect(404);
  });

  it("returns 400 for malformed JSON instead of a server error", async () => {
    const h = harness();
    await request(h.app).post("/api/attempts").set(ME).set("content-type", "application/json").send("{oops").expect(400);
  });

  it("refuses to re-run an evaluation that already has full feedback", async () => {
    const h = harness();
    const api = request(h.app);
    const { body: attempt } = await api.post("/api/attempts").set(ME).send({ problemSlug: "parking-lot" });
    const { body } = await api.post(`/api/attempts/${attempt.id}/submissions`).set(ME).send({ draft: parkingCanvas() });
    await h.container.queue.onIdle();
    await api.post(`/api/submissions/${body.submission.id}/retry`).set(ME).expect(409);
  });
});

describe("insights", () => {
  it("surfaces a criterion that keeps scoring low and an issue that recurs across attempts", async () => {
    const h = harness({ llm: new FakeLlm([judgeOutput({ extensibility: 2 })]) });
    const api = request(h.app);
    const canvas = parkingCanvas();
    canvas.assumptions = "";

    for (let i = 0; i < 2; i++) {
      const { body: attempt } = await api.post("/api/attempts").set(ME).send({ problemSlug: "parking-lot" });
      await api.post(`/api/attempts/${attempt.id}/submissions`).set(ME).send({ draft: canvas }).expect(202);
      await h.container.queue.onIdle();
    }

    const { body } = await api.get("/api/insights").set(ME).expect(200);
    expect(body.completedReviews).toBe(2);
    expect(body.focusAreas.map((f: { criterion: string }) => f.criterion)).toEqual(["extensibility"]);
    expect(body.recurringIssues).toContainEqual(expect.objectContaining({ code: "NO_ASSUMPTIONS", attempts: 2 }));
  });
});
