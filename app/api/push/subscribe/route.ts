import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Save (or refresh) a browser push subscription for a given person/device.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { personId, subscription } = body || {};

  if (!personId || !subscription?.endpoint || !subscription?.keys) {
    return NextResponse.json(
      { error: "personId and a valid subscription are required" },
      { status: 400 }
    );
  }

  const person = await prisma.person.findUnique({ where: { id: personId } });
  if (!person) {
    return NextResponse.json({ error: "unknown person" }, { status: 404 });
  }

  const saved = await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      personId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    update: {
      personId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });

  return NextResponse.json({ ok: true, id: saved.id });
}

// Remove a subscription (e.g. when the user turns notifications off).
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}));
  const endpoint: string | undefined = body?.endpoint;
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }
  await prisma.pushSubscription
    .delete({ where: { endpoint } })
    .catch(() => undefined);
  return NextResponse.json({ ok: true });
}
