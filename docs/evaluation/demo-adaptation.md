# Controlled live-provider adaptation demo

Four synthetic whiteboards; actual Perceptron/Gemini calls. Authored READ_TEXT → SUMMARIZE choices, fresh session, read-ahead OFF. A controlled adaptation demonstration, not prediction accuracy.

Recorded: 2026-10-18T10:23:35.921Z

Starting choice: MAKE_TASKS. Final choice: SUMMARIZE.

| Image | Summary source | Consumed prefire | Wait | Next whiteboard summary prediction |
|---|---|---|---:|---:|
| 1 | network | False | 755.21 ms | 37.6% |
| 2 | network | False | 587.14 ms | 48.0% |
| 3 | network | False | 893.55 ms | 55.4% |
| 4 | cache | True | 0.07 ms | 61.0% |

Provider calls: 7 demand + 4 speculative. Failures: 0. Used prefires: 1; unused: 3.

The four images are synthetic demo whiteboards. Calls were live Perceptron/Gemini. The authored choices demonstrate adaptation, not real-user accuracy. Raw predictions and events are in demo-adaptation.json.
