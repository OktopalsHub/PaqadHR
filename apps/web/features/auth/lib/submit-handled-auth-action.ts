// Login and signup mutations already surface errors through the auth provider's
// toast handlers. The forms should not rethrow those handled failures.
export async function submitHandledAuthAction(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch {}
}
