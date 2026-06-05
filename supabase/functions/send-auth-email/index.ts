import nodemailer from "npm:nodemailer@6.9.13";

const HOOK_SECRET = "v1,whsec_wigwjE5rZ/SYBYUz2zVjoEw/mULYdHOqfR1gbbvfQcUNS6g2N1fAC4y3SSp7bF1PHf40LvK1I/ap+32I";

async function verifySignature(req: Request, body: string): Promise<boolean> {
  const webhookId = req.headers.get("webhook-id");
  const webhookTimestamp = req.headers.get("webhook-timestamp");
  const webhookSignature = req.headers.get("webhook-signature");
  if (!webhookId || !webhookTimestamp || !webhookSignature) return false;

  const secretBase64 = HOOK_SECRET.replace("v1,whsec_", "");
  const secretBytes = Uint8Array.from(atob(secretBase64), (c) => c.charCodeAt(0));
  const signedContent = `${webhookId}.${webhookTimestamp}.${body}`;

  const key = await crypto.subtle.importKey(
    "raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  const computed = "v1," + btoa(String.fromCharCode(...new Uint8Array(sig)));

  return webhookSignature.split(" ").some((s) => s === computed);
}

Deno.serve(async (req) => {
  const body = await req.text();

  const valid = await verifySignature(req, body);
  if (!valid) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { user, email_data } = JSON.parse(body);

  const transporter = nodemailer.createTransport({
    host: "smtp.titan.email",
    port: 587,
    secure: false,
    auth: {
      user: "noreply@smartfines.com.au",
      pass: Deno.env.get("TITAN_SMTP_PASSWORD"),
    },
  });

  try {
    await transporter.sendMail({
      from: '"SmartFine Victoria" <noreply@smartfines.com.au>',
      to: user.email,
      subject: "Your SmartFine login code",
      html: `
        <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:32px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
            <div style="width:40px;height:40px;background:#7c3aed;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px">🚗</div>
            <div>
              <div style="font-size:18px;font-weight:700;color:#0f172a">SmartFine Victoria</div>
              <div style="font-size:12px;color:#64748b">Fine management app</div>
            </div>
          </div>
          <p style="color:#0f172a;font-size:15px;margin-bottom:8px">Your login code:</p>
          <div style="font-size:44px;font-weight:700;letter-spacing:10px;color:#7c3aed;padding:24px;background:#f5f3ff;border-radius:16px;text-align:center;border:2px solid #ede9fe">
            ${email_data.token}
          </div>
          <p style="color:#64748b;font-size:13px;margin-top:20px">
            This code expires in <strong>60 minutes</strong>.<br>
            If you didn't request this, you can safely ignore this email.
          </p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
          <p style="color:#94a3b8;font-size:11px;text-align:center">SmartFine Victoria · fines.vic.gov.au payments processed securely</p>
        </div>
      `,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("SMTP error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
