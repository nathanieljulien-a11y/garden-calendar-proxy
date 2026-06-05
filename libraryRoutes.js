/**
 * libraryRoutes.js — Backend endpoints for Garden Library content ingestion
 *
 * One endpoint:
 *   GET /api/fetch-url?url=...            — fetch article text from a URL
 *
 * Content is passed straight through to the client — never stored server-side.
 * Endpoint is rate-limited by the caller's token (enforced upstream).
 *
 * Mount in server.js:
 *   const libraryRoutes = require('./libraryRoutes');
 *   app.use('/api', libraryRoutes);
 *
 * Dependencies to add to package.json:
 *   "@mozilla/readability": "^0.5.0"
 *   "node-fetch": "^3.3.2"   (if not already present)
 *   "jsdom": "^24.0.0"
 */

const express = require('express');
const router = express.Router();

// ─── URL article fetch ────────────────────────────────────────────────────────

router.get('/fetch-url', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'url parameter required' });
  }

  // Block obviously non-article URLs
  if (!/^https?:\/\//.test(url)) {
    return res.status(400).json({ error: 'Only http/https URLs are supported' });
  }

  // Block localhost and private IP ranges
  if (/localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\./.test(url)) {
    return res.status(400).json({ error: 'Private URLs are not supported' });
  }

  try {
    const { default: fetch } = await import('node-fetch');
    const { JSDOM } = require('jsdom');
    const { Readability } = require('@mozilla/readability');

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GardenCalendar/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 10000,
      size: 1024 * 1024 * 5, // 5MB limit
    });

    if (!response.ok) {
      if (response.status === 403 || response.status === 401) {
        return res.status(403).json({
          error: 'This page requires a login or subscription. Paste the text instead.'
        });
      }
      return res.status(response.status).json({
        error: `Could not fetch page (${response.status}). Paste the text instead.`
      });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return res.status(400).json({
        error: 'Only web pages (HTML) are supported via URL. Paste the content as text instead.'
      });
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.textContent || article.textContent.length < 100) {
      return res.status(422).json({
        error: 'Could not extract readable text from this page. Paste the content as text instead.'
      });
    }

    // Clean up extracted text
    const text = article.textContent
      .replace(/\n{3,}/g, '\n\n') // normalise excessive newlines
      .replace(/\t/g, ' ')
      .replace(/ {3,}/g, ' ')
      .trim();

    return res.json({
      text,
      title: article.title || 'Web article',
      wordCount: text.split(/\s+/).length,
    });

  } catch (err) {
    console.error('[libraryRoutes] fetch-url error:', err.message);

    if (err.name === 'AbortError' || err.message?.includes('timeout')) {
      return res.status(504).json({ error: 'Page took too long to load. Paste the text instead.' });
    }

    return res.status(500).json({ error: 'Could not fetch this page. Paste the text instead.' });
  }
});

module.exports = router;
