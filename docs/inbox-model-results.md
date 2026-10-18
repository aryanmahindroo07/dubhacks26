# Inbox model results (dummy data)

Trained on 500 synthetic journeys, tested on 200 new ones (450 AI actions, 1345.0 s of AI waiting without prefetch).

Next-action accuracy: the model's top guess was right 81% of the time.

| Strategy | Prefetch calls | Used | Wasted | AI waiting saved | Wasted AI time |
|---|---:|---:|---:|---:|---:|
| No prefetch | 0 | 0 | 0 | 0.0 s (0%) | 0.0 s |
| Always prefetch the most common action | 650 | 128 | 522 | 320.0 s (24%) | 1305.0 s |
| Prefetch every possible action | 2725 | 450 | 2275 | 1345.0 s (100%) | 6860.0 s |
| RequestFlow (Markov + 35% threshold) | 493 | 347 | 146 | 1022.0 s (76%) | 455.5 s |

Synthetic journeys from designed probabilities (backend/inbox/journeys.js) and placeholder latencies (backend/inbox/actions.js). Assumes a correct prefetch saves the action's full latency.
