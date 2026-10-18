# Inbox model results (dummy data)

Trained on 500 synthetic journeys, tested on 200 new ones (435 AI actions, 1311.0 s of AI waiting without prefetch).

Next-action accuracy: the model's top guess was right 82% of the time.

| Strategy | Prefetch calls | Used | Wasted | AI waiting saved | Wasted AI time |
|---|---:|---:|---:|---:|---:|
| No prefetch | 0 | 0 | 0 | 0.0 s (0%) | 0.0 s |
| Always prefetch the most common action | 316 | 135 | 181 | 337.5 s (26%) | 452.5 s |
| Prefetch every possible action | 1916 | 435 | 1481 | 1311.0 s (100%) | 4596.5 s |
| Mise (Markov + 35% threshold) | 482 | 343 | 139 | 1024.0 s (78%) | 433.5 s |

Synthetic journeys from designed probabilities (backend/inbox/journeys.js) and placeholder latencies (backend/inbox/actions.js). Assumes a correct prefetch saves the action's full latency.
