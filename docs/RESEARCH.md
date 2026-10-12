# Research note: why LLD practice is hard to evaluate

## The learner problem

Practising low-level design is easy to start: pick "Parking Lot", sketch some classes, maybe write code. The hard part is knowing whether the result is any good. Three things get in the way:

1. **There is no single right answer.** Two strong designs for an elevator can split responsibilities very differently. A learner comparing their design with one published solution can't tell "different" from "wrong".
2. **The feedback that exists is either a reference solution or a score.** A reference solution shows *a* design, not what is weak about *yours*. A score ("7/10") doesn't say which class to change.
3. **Mistakes repeat silently.** Most learners make the same mistakes on every problem: a god "Manager" class, no answer for what happens when something fails, abstractions with nothing behind them. Nothing in their practice tells them it's a pattern.

Learners say this themselves. One of the most-viewed LeetCode Discuss posts on parking-lot LLD is titled *"Is this approach enough for interviews? Feedback appreciated"* ([link](https://leetcode.com/discuss/post/1775855/parking-lot-lld-is-this-approach-enough-m8qd0/)); the only way to check a design was to post it and hope. On the most popular LLD repository, learners ask for test scenarios "so that people can code the problem themselves and then run the test scenarios" ([issue #188](https://github.com/ashishps1/awesome-low-level-design/issues/188)), and say that without class diagrams "it's hard to understand… connectivity between the class[es]" ([issue #141](https://github.com/ashishps1/awesome-low-level-design/issues/141)).

## What exists today

I looked at eight resources, checking each one's own pages (October 2026). Some product internals sit behind a login, which I note where it applies.

| Tool | How you practise | What you submit | Feedback | Learning loop |
|---|---|---|---|---|
| **AlgoMaster AI LLD interviews** ([link](https://algomaster.io/interview/low-level-design)) | Timed AI-led mock in 4 stages: requirements, entities, class design, code | Text or voice, then code | Each stage scored out of 10 by AI, compared with "our reference solution" | Sessions saved with scores; no weakness tracking. Premium except one problem |
| **awesome-low-level-design** (27k stars) and AlgoMaster LLD track ([repo](https://github.com/ashishps1/awesome-low-level-design)) | Read a problem, read the solution | Nothing | Reference Java solutions | Manual checklist |
| **Codemia OOD** ([link](https://codemia.io/object-oriented-design)) | ~70 problems with a structured text template (requirements, core objects, relationships, patterns, SOLID…) | Text template plus a diagram tool | "AI Design Review" advertised; community submissions are public | Streaks and flashcards, not tied to design weaknesses |
| **Hello Interview** ([link](https://www.hellointerview.com/learn/low-level-design)) | Written breakdowns; guided practice, 8 problems of ~35 min | Step-by-step answers | "Instant AI feedback"; rubric not published for LLD. Human mocks ended May 2026 | Per-question history |
| **Educative "Grokking the LLD Interview"** | Case studies with UML and code in 5 languages, ending in 19 AI mock interviews | Mock interview answers | AI mock interview; grading mechanics not public | Unknown |
| **DesignGurus "Grokking OOD"** and the tssovi repo | Lessons, 250+ diagrams, multiple-choice quizzes | No design submission | Reference solutions | Quiz scores |
| **GeeksforGeeks** articles | Read | Nothing | None (comments) | None |
| **TUM Athena / Apollon** (ICSE-SEET 2026, [paper](https://aet.cit.tum.de/research/publications/soelch2026icse.pdf)) | University modelling exercises | UML converted to text | LLM feedback against rubric-style grading instructions, reviewed by human graders | Course-level |

## Gaps I found

1. **Feedback is anchored to one canonical answer.** Even the AI-graded tool compares against "our reference solution". Nothing tells a learner whether their *different* design is acceptable.
2. **Reference answers are unreliable.** The most popular repo has open correctness issues in its own solutions (for example #184, where parking breaks un-parking, and #73, a logger that is "not thread safe as asked"). The GfG code is inconsistent across languages.
3. **AI feedback is opaque.** Where AI grading exists, the rubric isn't published and scores aren't tied to specific classes. The TUM study found that LLM grades are generous to weak work and harsh to strong work, so unconstrained AI scoring is risky.
4. **History is a log, not a coach.** Tools save attempts and scores, but none I could verify points out recurring weaknesses across problems.
5. **Requirement change is rarely tested.** Extensibility is the point of LLD, but practice usually stops at the first design. Nobody asks "now add EV charging: what breaks?".

## Product direction

**crit** focuses on one loop: *choose a problem → design → submit → get a crit → revise → see what you fixed.*

- **A structured design canvas, not free text or code.** Assumptions, classes with one-sentence responsibilities, typed relationships, a requirement-to-class map, one key flow, design decisions, and a response to a requirement change. Each section is evidence of a specific LLD skill, and the structure makes deterministic checks possible. The canvas draws a live UML class diagram, which answers the "hard to see connectivity" complaint.
- **Grade against a published rubric, not a reference solution.** Six criteria, each with four described bands. Every judgement must quote the learner's own design, and quotes are machine-checked.
- **Facts before opinions.** Deterministic checks (unmapped requirements, ownership cycles, orphan classes, unanswered change scenario…) run first and cap the AI where it contradicts them. This counters the generosity bias the TUM study found.
- **A requirement change in every problem**, so extensibility is actually exercised.
- **Revisions are compared deterministically** ("Fixed: unconnected DisplayBoard"), and recurring weaknesses across problems are surfaced on a progress page.
- **It works without AI.** If the model is down or over budget, the learner still gets complete rule-based feedback and can request the AI review later.

Out of scope for the MVP: accounts, a problem editor, code execution, diagram input and human review. The design leaves room for each (see [DESIGN.md](DESIGN.md)).
