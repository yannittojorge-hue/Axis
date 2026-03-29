export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { email, payment_id, reporte_html, basic } = req.body || {};
    if (!email || !payment_id || !reporte_html) {
      return res.status(400).json({ error: "Faltan datos (email / payment_id / reporte_html)" });
    }

    const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    if (!MP_ACCESS_TOKEN) return res.status(500).json({ error: "Falta MP_ACCESS_TOKEN en Vercel" });

    // 1) Verifico en Mercado Pago que esté aprobado (seguridad básica)
    const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const mpData = await mpResp.json();
    if (!mpResp.ok) return res.status(502).json({ error: "Mercado Pago error", detail: mpData });
    if (mpData.status !== "approved") return res.status(402).json({ error: "Pago no aprobado", status: mpData.status });

    // 2) Enviar email (acá va tu proveedor)
    // Recomendado: RESEND (muy simple)
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const FROM_EMAIL = process.env.FROM_EMAIL; // ejemplo: "Mi Eneatipo <hola@mieneatipo.ar>"

    if (!RESEND_API_KEY) return res.status(500).json({ error: "Falta RESEND_API_KEY en Vercel" });
    if (!FROM_EMAIL) return res.status(500).json({ error: "Falta FROM_EMAIL en Vercel" });

    const subject = `Tu informe Mi Eneatipo ${basic?.type ? "— " + basic.type : ""}`;
    const html = `
      <div style="font-family:Arial,sans-serif; line-height:1.6;">
        <h2>Tu Mapa Interno</h2>
        <p>Hola ${basic?.name || ""}</p>
        <p><strong>${basic?.type || ""}</strong> • <strong>${basic?.wing || ""}</strong> • <strong>${basic?.instinct || ""}</strong></p>
        <hr/>
        ${reporte_html}
        <hr/>
        <p style="color:#777; font-size:12px;">Mi Eneatipo</p>
      </div>
    `;

    const sendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
       from: process.env.FROM_EMAIL,
       to: email,
       subject: "Tu reporte Mi Eneatipo",
       html,
       reply_to: "yannittojorge@gmail.com"
     }),


    });

    const sendData = await sendResp.json();
    if (!sendResp.ok) return res.status(502).json({ error: "Error enviando email", detail: sendData });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error interno", detail: String(e) });
  }
}
