Introducing WM Bench: A Benchmark for Cognitive Intelligence in World Models
The field of world models has made remarkable progress. From NVIDIA Cosmos to Meta V-JEPA 2, from DeepMind Genie 3 to Physical Intelligence π0, the pace of development is extraordinary.
Yet a question remains largely unanswered:
How do we measure whether a world model actually understands what is happening — not just renders it convincingly?
FID tells us a model's output looks realistic. FVD tells us its videos flow naturally. HumanML3D and BABEL tell us its motions are human-like.
None of them tell us whether the model thinks.
The Gap We're Trying to Address
Consider a simple scenario: a charging beast, 3 meters away, closing fast.
A world model with excellent FID scores can generate that scene beautifully. But does it know the character should sprint away — not walk? Does it respond differently when the threat is a human rather than an animal? Does it remember that the left corridor was blocked two steps ago? Does it gradually de-escalate once the threat disappears, rather than snapping back to neutral?
These are cognitive questions. And to our knowledge, no existing benchmark asks them.
WM Bench is our attempt to build one.
What WM Bench Measures
WM Bench evaluates world models across three pillars, ten categories, and one hundred scenarios, scored on a 1000-point scale.
WM Score (1000 pts)
│
├── 👁 P1 · Perception 25% 250 pts
│ ├── C01 Environmental Awareness (analogous to Occupancy Grid evaluation)
│ └── C02 Entity Recognition (analogous to BABEL action recognition)
│
├── 🧠 P2 · Cognition 45% 450 pts
│ ├── C03 Prediction-Based Reasoning
│ ├── C04 Threat-Type Differentiated Response
│ ├── C05 Autonomous Emotion Escalation
│ ├── C06 Contextual Memory Utilization
│ └── C07 Post-Threat Adaptive Recovery
│
└── 🔥 P3 · Embodiment 30% 300 pts
├── C08 Motion-Emotion Expression
├── C09 Real-Time Cognitive Performance (analogous to FVD latency metrics)
└── C10 Body-Swap Extensibility
Perception and Embodiment deliberately mirror existing benchmarks — they form the foundation. The new ground is Cognition, which carries 45% of the total score.
Six of the ten categories represent definitions we have not found in prior literature. Two of them — C05 Autonomous Emotion Escalation and C10 Body-Swap Extensibility — address capabilities for which, to our knowledge, no prior research framework exists at all.
We want to be clear: these definitions are our own proposal, not established consensus. We expect them to be debated, refined, and improved. That is precisely why we are releasing them openly.
A Text-First Design
We made a deliberate choice to keep the evaluation interface as simple as possible. No 3D environment. No physics engine. No specialized hardware.
Every scenario is presented as a JSON object. Every response is two lines.
Input:
{
"scenario_id": "C04_003",
"walls": { "forward": 8.5, "left": null, "right": null, "backward": null },
"npc_type": "beast",
"npc_distance": 3.2,
"npc_behavior": "charge",
"emotion_state": "alert",
"recent_decisions": ["hit_wall_left"]
}
Expected output:
PREDICT: npc=danger(beast,3.2m,charging), forward=danger(wall,8.5m), left=danger(wall,prev), right=safe, backward=safe
MOTION: a person launching sideways to the right, legs driving hard, arms thrown wide in blind panic
The PREDICT
line tests situational reasoning. The MOTION
line tests whether that reasoning translates into emotionally coherent, physically grounded action.
Any system with an API endpoint can participate — LLMs, VLMs, rule-based agents, or hybrid architectures. Scoring is fully automated and deterministic (temperature = 0.0).
The Dataset
📦 https://huggingface.co/datasets/FINAL-Bench/World-Model
One hundred scenarios, ten per category, released in full. Each entry includes the scene context, expected output structure, and scoring rubric. We have tried to make the rubrics transparent — if you disagree with how we score something, we would genuinely like to hear it.
from datasets import load_dataset
ds = load_dataset("FINAL-Bench/World-Model")
scenario = ds["train"][0]
print(scenario["scenario_id"]) # "C01_001"
print(scenario["scene_context"]) # JSON input
print(scenario["scoring_rubric"]) # How each line is evaluated
To submit results, open a discussion thread at the link below. Once verified, your model will appear on the leaderboard.
The Leaderboard
🏆 https://huggingface.co/spaces/FINAL-Bench/worldmodel-bench
Twenty-six models are currently registered. Thirteen have estimated scores derived from published papers and technical reports; the remaining thirteen are pending direct evaluation.
| Rank | Model | WM Score | Grade | |
|---|---|---|---|---|
| 1 | PROMETHEUS v1.0 (VIDRAFT) | 726 | B | Track C · directly verified |
| 2 | Meta V-JEPA 2-AC | ~554 | C | est. |
| 3 | Wayve GAIA-3 | ~550 | C | est. |
| 4 | NC AI WFM v1.0 | ~522 | C | est. |
| 5 | NVIDIA Cosmos v1.0 | ~498 | C | est. |
| 6 | NAVER LABS SWM | ~470 | C | est. |
| 7 | DeepMind Genie 2 | ~449 | C | est. |
| 8 | DreamerV3 XL | ~441 | C | est. |
| 9 | OpenAI Sora 2 | ~381 | D | est. |
| 10 | World Labs Marble | ~362 | D | est. |
est.
— estimated from publicly available data. Subject to revision upon direct submission.
A few notes on the current standings. First, PROMETHEUS sits at rank one because it is the only model we have been able to run the full Track C evaluation on directly. We recognize the inherent awkwardness of a team benchmarking its own system, and we invite other teams to submit their own results — including corrections to our estimates. Second, the grade distribution skews low. We are honestly unsure whether this reflects the genuine difficulty of cognitive evaluation, or whether our scoring rubrics are too strict. Both are possible. We will keep iterating.
Grade thresholds: S ≥ 900 · A ≥ 750 · B ≥ 600 · C ≥ 400 · D ≥ 200 · F below.
Pending evaluation: Tesla FSD v13, Figure Helix-02, DeepMind Genie 3, Physical Intelligence π0, Skild Brain, Covariant RFM-1, HuggingFace LeRobot, and others.
PROMETHEUS v1.0 — The Baseline
🔥 https://huggingface.co/spaces/FINAL-Bench/world-model
A benchmark without a concrete implementation is hard to reason about. We built PROMETHEUS as a reference point — a working world model that we could evaluate against WM Bench directly, and that anyone can interact with in a browser.
It runs on a T4 GPU via HuggingFace Spaces. No installation required.
The system is organized around three components:
AETHER — the cognitive layer. An open-architecture brain that accepts any LLM as its reasoning engine. Handles prediction, meta-cognition, and multi-agent coordination.
PROMETHEUS — the world model engine. A perception-prediction-judgment-action loop, with motion generation powered by FloodDiffusion-VIDRAFT.
HEPHAESTUS — the body engine. A 263-joint skeleton system with GLB retargeting, supporting humanoid, tank, and extensible form factors.
The Space ships with the following files — all self-implemented:
| File | Size | Role |
|---|---|---|
main.js |
39.7 kB | World model main loop |
input_controller.js |
112 kB | Input handling |
skeleton.js |
44.2 kB | Joint skeleton · GLB retargeting |
entity_manager.js |
16.1 kB | NPC and entity management |
world_manager.js |
15.9 kB | Environment and physics |
tank.glb |
12.7 MB | 3D tank model |
WM Bench results (Track C, directly verified):
| Pillar | Score | Max | Highlights |
|---|---|---|---|
| 👁 P1 Perception | 140 | 250 | C01: 65 · C02: 75 |
| 🧠 P2 Cognition | 390 | 450 | C04: 90 · C03: 85 · C05: 85 |
| 🔥 P3 Embodiment | 196 | 300 | C09: 85 · C08: 80 · C10: 35 |
| Total | 726 | 1000 | Grade B · 47 FPS · RTX 5070 |
The C10 score (35/100) reflects where the system currently falls short — cross-embodiment transfer is still an open problem for us, and we expect it to be for others as well.
Part of the FINAL Bench Family
WM Bench is the second dataset in the FINAL Bench family, which we are building to evaluate AI systems across different dimensions of intelligence.
| FINAL Bench | WM Bench | |
|---|---|---|
| Focus | Text-based AGI · Metacognition | Embodied AGI · World model cognition |
| Dataset | FINAL-Bench/Metacognitive | FINAL-Bench/World-Model |
| Leaderboard | FINAL-Bench/Leaderboard | FINAL-Bench/worldmodel-bench |
| Status | HF global dataset Top 5 · covered by four press outlets (Feb 2026) | Released March 2026 |
A Note on Limitations
WM Bench v1.0 is an early release. The scoring rubrics were designed by a small team, the estimated scores for non-participating models carry significant uncertainty, and the evaluation scenarios — while diverse — are necessarily simplified relative to the full complexity of real-world embodied intelligence.
We are releasing now because we believe the question WM Bench is asking — does this model understand its environment, or just render it? — is worth asking publicly, even imperfectly. We expect the benchmark itself to evolve as more teams engage with it.
If you see something that should be scored differently, a model we missed, or a scenario type we should add — please open a discussion. This is meant to be a community resource.
Citation
@dataset{wmbench2026,
title = {WM Bench: Evaluating Cognitive Intelligence in World Models},
author = {Kim, Taebong},
year = {2026},
publisher = {VIDRAFT / FINAL Bench},
url = {https://huggingface.co/datasets/FINAL-Bench/World-Model}
}
License: CC-BY-SA-4.0 (dataset) · Apache 2.0 (scoring code)
| Resource | Link |
|---|---|
| 🔥 PROMETHEUS (interactive demo) | https://huggingface.co/spaces/FINAL-Bench/world-model |
| 🏆 WM Bench Leaderboard | https://huggingface.co/spaces/FINAL-Bench/worldmodel-bench |
| 📦 WM Bench Dataset | https://huggingface.co/datasets/FINAL-Bench/World-Model |
"Beyond FID — Measuring Intelligence, Not Just Motion."