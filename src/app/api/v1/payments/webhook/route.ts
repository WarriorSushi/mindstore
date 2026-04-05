import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/v1/payments/webhook — Dodo Payments webhook stub
 *
 * Phase 1: Logs events and returns 200. Actual tier upgrade logic
 * will be wired when Dodo Payments account is live.
 *
 * Env vars needed (not yet set):
 *   DODO_WEBHOOK_SECRET — used to verify webhook signature
 *
 * Event types to handle:
 *   payment.success   → upgrade user to Pro tier
 *   subscription.cancelled → downgrade to Free
 *   subscription.renewed   → extend Pro
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eventType = body?.type || 'unknown';

    // TODO: verify Dodo-Signature header using DODO_WEBHOOK_SECRET
    // const sig = req.headers.get('Dodo-Signature');
    // if (!verifySignature(sig, rawBody, process.env.DODO_WEBHOOK_SECRET)) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    // }

    console.log('[payments/webhook] Received event:', eventType, JSON.stringify(body).slice(0, 200));

    switch (eventType) {
      case 'payment.success':
      case 'subscription.activated':
        // TODO: set user tier to 'pro' in users table
        // await db.execute(sql`UPDATE users SET tier = 'pro', tier_expires_at = ... WHERE id = ${userId}`);
        console.log('[payments/webhook] TODO: upgrade user to Pro');
        break;

      case 'subscription.cancelled':
      case 'subscription.expired':
        // TODO: set user tier back to 'free'
        console.log('[payments/webhook] TODO: downgrade user to Free');
        break;

      case 'subscription.renewed':
        // TODO: extend Pro expiry
        console.log('[payments/webhook] TODO: renew Pro subscription');
        break;

      default:
        console.log('[payments/webhook] Unhandled event type:', eventType);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[payments/webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
