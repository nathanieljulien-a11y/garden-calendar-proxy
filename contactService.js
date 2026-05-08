// contactService.js — D3
// Handles contact form submissions from /contact page.
// Sends an email via Resend to the operator. Does not store any data.

const express = require('express');
const router  = express.Router();
const { Resend } = require('resend');

const resend    = new Resend(process.env.RESEND_API_KEY);
const EMAIL_FROM = process.env.EMAIL_FROM;
const EMAIL_TO   = process.env.CONTACT_EMAIL || process.env.EMAIL_FROM; // where to deliver contact messages

const TOPIC_LABELS = {
  feedback:     'App feedback',
  bug:          'Bug report',
  privacy:      'Privacy / data request',
  subscription: 'Subscription question',
  other:        'Other',
};

router.post('/api/contact', express.json(), async (req, res) => {
  const { name, email, topic, token, message } = req.body || {};

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  if (!topic || !TOPIC_LABELS[topic]) {
    return res.status(400).json({ error: 'Valid topic required' });
  }
  if (!message || typeof message !== 'string' || message.trim().length < 3) {
    return res.status(400).json({ error: 'Message required' });
  }

  const topicLabel = TOPIC_LABELS[topic];
  const fromName   = name ? name.trim() : 'Anonymous';
  const tokenLine  = token ? `\nToken: ${token.trim()}` : '';

  try {
    await resend.emails.send({
      from:    EMAIL_FROM,
      to:      EMAIL_TO,
      replyTo: email,
      subject: `[Garden Calendar] ${topicLabel} — from ${fromName}`,
      text: [
        `Topic: ${topicLabel}`,
        `From: ${fromName} <${email}>${tokenLine}`,
        '',
        message.trim(),
        '',
        '---',
        'Sent via Garden Calendar contact form',
      ].join('\n'),
    });

    console.log(`[contact] Message received — topic=${topic} email=${email}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[contact] Failed to send contact email:', err.message);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
