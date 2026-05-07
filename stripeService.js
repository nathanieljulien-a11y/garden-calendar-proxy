// stripeService.js — Sprint C
// Handles Stripe webhook (C1) and token re-delivery (C2)

const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Resend } = require('resend');
const tokenStore = require('./tokenStore');

const resend = new Resend(process.env.RESEND_API_KEY);
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const EMAIL_FROM = process.env.EMAIL_FROM;
const FRONTEND_URL = process.env.ALLOWED_ORIGIN || 'https://garden-calendar-frontend.vercel.app';

// ---------------------------------------------------------------------------
// C1 — POST /api/stripe/webhook
// Stripe sends checkout.session.completed here.
// Must use raw body — do NOT use express.json() on this route.
// ---------------------------------------------------------------------------

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe] Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type !== 'checkout.session.completed') {
    // Acknowledge but ignore other event types
    return res.json({ received: true });
  }

  const session = event.data.object;
  const email = session.customer_details?.email || session.customer_email;
  const sessionId = session.id;

  console.log(`[stripe] checkout.session.completed — session=${sessionId} email=${email}`);

  // Idempotency guard — don't create duplicate tokens for the same session
  const existing = tokenStore.getTokenBySourceRef(sessionId);
  if (existing) {
    console.log(`[stripe] Token already exists for session ${sessionId} — skipping`);
    return res.json({ received: true });
  }

  // Create subscriber token
  let record;
  try {
    record = tokenStore.createSubscriberToken(sessionId);
  } catch (err) {
    console.error('[stripe] Failed to create subscriber token:', err.message);
    return res.status(500).json({ error: 'Token creation failed' });
  }

  console.log(`[stripe] Created subscriber token for session ${sessionId}`);

  // Send token email
  if (email) {
    try {
      await sendTokenEmail(email, record.token);
      console.log(`[stripe] Token email sent to ${email}`);
    } catch (err) {
      console.error('[stripe] Failed to send token email:', err.message);
      // Don't fail the webhook — token is created, email can be re-sent via C2
    }
  } else {
    console.warn('[stripe] No email on session — token created but not emailed');
  }

  res.json({ received: true });
});

// ---------------------------------------------------------------------------
// C2 — POST /api/stripe/reactivate
// User submits their Stripe payment email to retrieve their token.
// Looks up matching checkout session(s) via Stripe API, finds token by sourceRef.
// ---------------------------------------------------------------------------

router.post('/reactivate', express.json(), async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  console.log(`[stripe] Reactivation requested for email: ${email}`);

  // Search Stripe for checkout sessions matching this email
  let sessions;
  try {
    const result = await stripe.checkout.sessions.list({
      customer_details: { email },
      limit: 10,
    });
    sessions = result.data;
  } catch (err) {
    console.error('[stripe] Stripe session lookup failed:', err.message);
    return res.status(500).json({ error: 'Could not look up payment record' });
  }

  if (!sessions || sessions.length === 0) {
    return res.status(404).json({ error: 'No payment found for this email address' });
  }

  // Find the most recent session that has a token in our store
  let foundToken = null;
  for (const session of sessions) {
    const record = tokenStore.getTokenBySourceRef(session.id);
    if (record) {
      foundToken = record;
      break;
    }
  }

  if (!foundToken) {
    return res.status(404).json({ error: 'No subscription token found for this email' });
  }

  // Check token is still valid (not expired)
  const now = new Date();
  const expiry = new Date(foundToken.expiresAt);
  if (expiry < now) {
    return res.status(410).json({ error: 'Your subscription has expired' });
  }

  // Re-send the token email
  try {
    await sendTokenEmail(email, foundToken.token);
    console.log(`[stripe] Reactivation email sent to ${email}`);
    res.json({ ok: true, message: 'Token re-sent to your email address' });
  } catch (err) {
    console.error('[stripe] Failed to send reactivation email:', err.message);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// ---------------------------------------------------------------------------
// Email helper
// ---------------------------------------------------------------------------

async function sendTokenEmail(to, token) {
  const appUrl = `${FRONTEND_URL}?token=${token}&ref=subscriber`;

  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: 'Your Garden Calendar subscription code',
    text: [
      'Thank you for subscribing to Garden Calendar.',
      '',
      'Your subscription code is:',
      '',
      `  ${token}`,
      '',
      'To activate your subscription:',
      '1. Go to ' + FRONTEND_URL,
      '2. Open Settings (the ⚙ icon)',
      '3. Enter your subscription code in the "I have a subscription code" field',
      '4. Click Apply',
      '',
      'Or click this link to open the app with your code pre-filled:',
      appUrl,
      '',
      'Your subscription gives you access for 6 months, including:',
      '• Up to 5 full calendar generations',
      '• Up to 26 "This Week" garden task updates',
      '• Garden Insights and Lens features',
      '',
      'Keep this email — you\'ll need the code if you ever clear your browser data.',
      '',
      'Questions? Reply to this email.',
      '',
      'Privacy policy: ' + FRONTEND_URL + '/privacy',
      '',
      '— The Garden Calendar',
    ].join('\n'),
  });
}

module.exports = router;
