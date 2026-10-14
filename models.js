// Single source of truth for which Claude models the backend calls.
// Override on Render with MODEL_STREAM / MODEL_CALL env vars — no code change
// or redeploy of code needed the next time a model is retired.
// Retirement dates: https://platform.claude.com/docs/en/about-claude/model-deprecations
// Claude can return several content blocks (e.g. a 'thinking' block before the answer, which
// adaptive-thinking models such as Haiku 5.5 may do). Always take the text blocks by type —
// never assume content[0] is the answer.
function extractText(content) {
  if (!Array.isArray(content)) return '';
  return content
    .filter(function(b) { return b && b.type === 'text' && typeof b.text === 'string'; })
    .map(function(b) { return b.text; })
    .join('')
    .trim();
}

module.exports = {
  extractText:  extractText,
  // 12-month calendar generation — needs Sonnet quality
  MODEL_STREAM: process.env.MODEL_STREAM || 'claude-sonnet-5-5',
  // Today tasks, insights, lenses, inspo gardens, search queries — Haiku sufficient
  MODEL_CALL:   process.env.MODEL_CALL   || 'claude-haiku-5-5',
};
