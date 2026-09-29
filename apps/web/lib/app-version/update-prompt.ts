export type UpdateFlow = 'prompt' | 'silentReload' | 'skip';

type UpdateFlowInput = {
  remoteBuildId: string;
  /** Build id a prompt was already surfaced for, or null when none was shown yet. */
  promptedBuildId: string | null;
  isVisible: boolean;
};

/**
 * How a detected build change reaches the user.
 *
 * - already prompted for this build → `skip`, so a prompt is never repeated and
 *   never followed by an automatic reload that would discard the user's choice
 * - tab not visible → `silentReload`, nobody is mid-task in this document
 * - tab visible → `prompt`, the user picks the moment so unsaved work survives
 */
export function decideUpdateFlow({
  remoteBuildId,
  promptedBuildId,
  isVisible,
}: UpdateFlowInput): UpdateFlow {
  if (remoteBuildId === promptedBuildId) return 'skip';
  return isVisible ? 'prompt' : 'silentReload';
}
