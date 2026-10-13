// Single source of truth for which Claude models the backend calls.
// Override on Render with MODEL_STREAM / MODEL_CALL env vars — no code change
// or redeploy of code needed the next time a model is retired.
// Retirement dates: https://platform.claude.com/docs/en/about-claude/model-deprecations
module.exports = {
  // 12-month calendar generation — needs Sonnet quality
  MODEL_STREAM: process.env.MODEL_STREAM || 'claude-sonnet-5-5',
  // Today tasks, insights, lenses, inspo gardens, search queries — Haiku sufficient
  MODEL_CALL:   process.env.MODEL_CALL   || 'claude-haiku-5-5',
};
