import { PRECIO, decodificarToken, generarReporte, marcarComprador, enviarReportePorEmail, ocultarEmail, reporteYaEnviado, marcarReporteEnviado } from "./_reporte.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { payment_id, enviar_email, abiertas } = req.body || {};
    // Respuestas abiertas del test (las manda el navegador; solo personalizan el texto)
    const limpiarTxt = (s, n) => String(s || "").replace(/\s+/g, " ").replace(/[<>`]/g, "").trim().slice(0, n);
    const respuestasAbiertas = (Array.isArray(abiertas) ? abiertas : []).slice(0, 4)
      .map(x => ({ p: limpiarTxt(x && x.p, 160), r: limpiarTxt(x && x.r, 400) }))
      .filter(x => x.r.length >= 2);
    if (!payment_id) {
      return res.status(400).json({ error: "Falta payment_id" });
    }

    const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!MP_ACCESS_TOKEN) return res.status(500).json({ error: "Falta MP_ACCESS_TOKEN en Vercel" });
    if (!OPENAI_API_KEY) return res.status(500).json({ error: "Falta OPENAI_API_KEY en Vercel" });

    // 1) Consultar pago a Mercado Pago
    const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });

    const mpData = await mpResp.json();
    if (!mpResp.ok) {
      return res.status(502).json({ error: "Mercado Pago error", detail: mpData });
    }

    // 2) Validar aprobado
    if (mpData.status !== "approved") {
      return res.status(402).json({ error: "Pago no aprobado", status: mpData.status });
    }

    // 2b) Validar que se haya pagado el precio completo
    if (mpData.currency_id !== "ARS" || Number(mpData.transaction_amount) < PRECIO) {
      return res.status(402).json({ error: "Monto pagado incorrecto" });
    }

    // 3) Datos del perfil desde external_reference (base64 con JSON)
    const payload = decodificarToken(mpData.external_reference || "");
    if (!payload) {
      return res.status(400).json({ error: "Pago aprobado pero el external_reference falta o es inválido" });
    }
    const { nombre, eneatipo, ala, instinto } = payload;

    // 4b) Marcar en Brevo que esta persona ya compró (COMPRO = "SI"),
    // para que la secuencia de emails no le siga ofreciendo el reporte.
    // Nunca bloquea la entrega del reporte si falla.
    await marcarComprador([payload.email, mpData.payer && mpData.payer.email]);

    // 5) Generar reporte con OpenAI
    let reporte;
    try {
      reporte = await generarReporte({ nombre, eneatipo, ala, instinto, respuestasAbiertas });
    } catch (e) {
      console.error(e);
      return res.status(502).json({ error: "No se pudo generar el reporte", detail: String(e && e.message) });
    }

    // 6) Copia del reporte por email (una sola vez por pago: la página avisa
    // con enviar_email=false si ya se mandó). Nunca bloquea la entrega.
    let emailCopia = null;
    if (enviar_email) {
      const destino = payload.email || (mpData.payer && mpData.payer.email);
      if (destino && await reporteYaEnviado(destino, payment_id)) {
        emailCopia = ocultarEmail(destino); // ya lo mandó el aviso de Mercado Pago
      } else if (destino && await enviarReportePorEmail({ email: destino, nombre, eneatipo, ala, instinto, reporte })) {
        emailCopia = ocultarEmail(destino);
        await marcarReporteEnviado(destino, payment_id);
      }
    }

    return res.status(200).json({
     reporte,
     perfil: { nombre, eneatipo, ala, instinto },
     email_copia: emailCopia
   });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error interno", detail: String(e) });
  }
}
