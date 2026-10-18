export function actionBadge(state) {
  if (state?.status === 'ready') return {label: state.prefetched ? '✓ Ready' : 'Cached', ready: state.prefetched};
  if (state?.status === 'pending') return {label: state.prefetched ? 'Preparing…' : 'Running…', ready: false};
  return null;
}

export function backgroundFailure(session, current, action) {
  const latest = session?.requestLog?.find(event => event.itemId === current?.id
    && (!action || event.action === action)
    && ['prefetch','read-ahead','provider'].includes(event.kind));
  return latest?.result === 'failed' && latest.kind !== 'provider' ? latest : null;
}

export function predictionReason(prediction, session, current) {
  const state = current?.actionStates?.[prediction.action];
  if (state?.status === 'ready') return state.prefetched ? 'Ready · prepared before your click.' : 'Cached · available to reopen.';
  if (state?.status === 'pending') return state.prefetched ? 'Preparing in the background…' : 'Running…';
  if (backgroundFailure(session,current,prediction.action)) return 'Background call failed · choose this action to retry.';
  if (!prediction.eligible) return `Skipped · ${prediction.eligibilityNote || 'Provider or source text unavailable.'}`;
  if (!prediction.shouldPrefetch) return prediction.expectedValue <= 0
    ? 'Skipped · estimated call cost outweighs saved waiting.'
    : `Skipped · only ${(prediction.probability * 100).toFixed(0)}% likely; below the likelihood threshold.`;
  if (!session.enabled) return 'Paused · prefetch is off.';
  if (current.prefires >= session.prefetchLimitPerItem) return 'Skipped · this image’s call budget is reached.';
  if (session.metrics.pendingPrefetches) return 'Not started · another background call is running.';
  return 'Eligible · not selected for a background call.';
}
