# How I used AI

I built this with Claude Code as a pair programmer. Most of the code was typed by the AI. I made the product and scope calls, steered the design, reviewed what came back, ran it, and pushed back where it didn't fit. Claude also did the first pass of the web research; the research note only cites pages it fetched and linked. Inside the product, a model (Claude Haiku 5.5) grades designs.

These are the decisions where the AI's input mattered, and what I did with it.

## 1. Stack: rejected Python, kept a warning about Next.js

**AI suggested:** Python + FastAPI with a plain HTML/JS frontend. The reasoning was that domain classes read cleanly, there is no build step, and it uses little memory on my machine.
**I decided:** TypeScript end to end, with a React + Tailwind frontend. A practice tool lives or dies on whether people enjoy using it, and I didn't want a plain HTML UI. One language also means the API types and the domain read the same way.
**Accepted from the AI:** don't use Next.js. A `next build` had crashed this machine before, and Vite gives the same result for a single-page app at a fraction of the memory.

## 2. What the learner submits: a structured canvas

**AI laid out three options:** free text (easy, but almost nothing can be checked), a code skeleton (the strongest evidence, but needs sandboxing and per-language parsing), and a structured "design canvas".
**I chose the canvas.** It is the smallest format that has both structure (classes, typed relationships, a requirement map, which rules can check) and reasoning (flow, decisions, response to change, which a reviewer can judge). It also gave us the live UML diagram for free. Code and diagrams are left as future formats behind the `SubmissionFormat` interface.

## 3. Which model grades, and how much it may cost

**The default would have been** a large model for "better" feedback.
**I asked for** the cheapest model, plus rule-based feedback that works on its own, because a practice tool has to be cheap enough to use repeatedly. The result is Claude Haiku 5.5 at low effort, a cache keyed on the exact input, and daily and per-learner caps that fall back to rule-based feedback when they trip. I measured a real review at about 4k input and 2k output tokens, roughly $0.0015.

## 4. Not trusting the grader blindly

**AI proposed** three guards around the LLM: make it quote the learner's design for every grade, verify every quote against the submission in code, and let deterministic facts cap its grades. One example: extensibility can't be "Strong" if the change scenario was never answered.
**I kept all three.** The research backed it up: the TUM paper found LLM graders are generous to weak work. I also wanted feedback that points at evidence, not a number. In the first real run, all 18 quotes verified. The cap visibly fired on a deliberately weak revision 1, where the AI's band was lowered to "Missing" with the reason shown.
**Also adopted:** the schema asks for evidence and the concern *before* the band, and the judge never sees its earlier verdicts. "What you fixed since revision 1" is computed by code, not by the model.

## 5. Where the AI's code was wrong, and how it was caught

- **A state-machine bug.** The first `Evaluation` let a learner trigger "retry" on an evaluation that was still running, because `running → queued` is a legal internal transition (used for automatic retries). The test suite caught it, and the fix guards learner retries explicitly.
- **Diagram and layout bugs** showed up when I reviewed screenshots rather than code. The composition diamonds were drawn backwards and hidden under the class boxes, the class editor overflowed on a 390px phone, and the diagram was too small to read in its side panel, so it got an "Expand" view.
- **Skipped from a UI guideline:** smooth-scroll (Lenis) was suggested by the motion design guidelines I used. I left it out because it fights the scrollable panes of an editor app.

## What I'd do differently

I would build a small calibration set early: 20–30 designs I grade by hand, used to check the judge prompt whenever it changes. Right now the prompt has only been checked against a handful of real designs.
