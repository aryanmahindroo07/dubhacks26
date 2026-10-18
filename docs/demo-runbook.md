# Mise demo runbook

## What we claim

Mise predicts the next registered API operation from workflow history and starts a worthwhile read-only request while the user reviews the current result. A matching click shares that request or reuses its completed result. It does not make the underlying AI model run faster, predict arbitrary prompts, or execute physical actions. Markov prediction is established technology; this project's contribution is its integration with cost-aware speculation, request sharing, instrumentation and two working applications.

## Before recording

- Start backend and frontend from the checkout containing the AI inbox. Confirm the model in an exported AI session is `gemini-3.5-flash-lite` if using the new run's figures.
- Close the `.env` tab before screen sharing. Keep API keys out of recordings.
- Check quota and stop other AI tests during the recording. Do not run a benchmark alongside the demo.
- Check the receipt vendor, total and tax, and whiteboard task content. Displayed model output needs human checking.
- Use Fresh run between OFF and ON, then explicitly enable ON. The five-second review interval must be the same in both modes. UI switching OFF alone does not clear cached results.

## Demo 1: customer workspace

Open `/`. Load customers, select one, then open Orders. For the ON run allow the prediction to finish while reviewing the profile. Show the live request log and cache reuse. Explain that these are synthetic customer records and the route delay is artificial. Use customer-specific measured results only; AI timings are a separate experiment. `/overview` shows the customer prefetch service, not AI-inbox totals.

## Demo 2: visual AI workspace

Open `/ai`. OFF: Demo receipt → Read text → review for five seconds → Extract fields. Show the output and measured waiting. Export. Fresh run; enable prefetch; repeat exactly. Explain that Perceptron transcribes the image and Gemini performs extraction, while Mise predicts and schedules that extraction. Show the speculative event followed by either a completed cache hit or an in-flight join. Export.

For variety, use the whiteboard → Read text → Turn into tasks. For the cost tradeoff, use receipt → Read text → Summarize: extraction may be prefetched but unused. Keep the unused call in the reported totals. Don't prefire every action to manufacture hits.

## Honest presentation of measurements

Label the exact model, number of matched pairs and review interval. Report extra provider calls and failures alongside latency. Say "measured waiting in these scripted trials" rather than a universal speedup. Prediction probabilities come from designed synthetic training journeys, not demonstrated accuracy on company users. Backend timing excludes browser transport/rendering; the benchmark also records client journey elapsed time. A completed cache hit still has browser overhead.

If a request fails, show the error and acknowledge provider availability or quota. Do not present a failed run's short time as a speedup. Have a saved recording of a successful real run as a labeled fallback. Do not replace live provider output with simulated output and call it live.

## Submission preparation

Use one problem statement: waiting repeats across multi-step API and AI workflows. Show the customer and image workflows as two applications of the same scheduler. Use measured results, describe wasted-call costs, name Perceptron and Gemini roles, and include limits and next steps. Robotics and higher-order Markov are future work, not current capabilities.

Before a PR: review changed files against teammate work, run tests/build, ensure `.env` is ignored, and exclude local bundles and benchmark scratch directories. Local changes are not automatically on teammates' laptops until committed and shared.
