// api/mp_webhook.js
// Aviso de Mercado Pago cuando cambia un pago (notification_url de la preferencia).
// Sirve para que el reporte llegue por email aunque la persona pague y no vuelva
// al sitio (por ejemplo, si cerró el navegador de Instagram).
//
// Para no duplicar el email: los primeros 10 minutos después de aprobado el pago
// se le deja la entrega a la página (respondemos 503 y Mercado Pago reintenta
// más tarde). Si para entonces la página no lo mandó, lo manda este aviso.
import { PRECIO, decodificarToken, generarReporte, marcarComprador, enviarReportePorEmail, reporteYaEnviado, marcarReporteEnviado } from "./_reporte.js";

const ESPERA_MS = 10 * 60 * 1000;

export default async function handler(req, res) {
  const q = req.query || {};
  const b = (req.body && typeof req.body === "object") ? req.body : {};
  const tipo = String(b.type || b.topic || q.type || q.topic || "");
  const id = String((b.data && b.data.id) || q["data.id"] || q.id || "");

  // Solo nos interesan los avisos de pagos
  if (!/payment/.test(tipo) || !/^\d+$/.test(id)) return res.status(200).json({ ok: true, ignorado: true });

  const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!MP_ACCESS_TOKEN) return res.status(500).json({ error: "Falta MP_ACCESS_TOKEN" });

  try {
    // Se consulta el pago a Mercado Pago: nunca se confía en lo que trae el aviso
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const pago = await r.json();
    if (!r.ok) return res.status(502).json({ error: "No se pudo consultar el pago" });
    if (pago.status !== "approved") return res.status(200).json({ ok: true, estado: pago.status });
    if (pago.currency_id !== "ARS" || Number(pago.transaction_amount) < PRECIO) {
      return res.status(200).json({ ok: true, ignorado: "monto" });
    }

    const payload = decodificarToken(pago.external_reference || "");
    if (!payload) return res.status(200).json({ ok: true, ignorado: "referencia" }); // no es un pago del test

    const destino = payload.email || (pago.payer && pago.payer.email);
    if (!destino) {
      console.error("Pago aprobado sin email para mandar el reporte:", id);
      return res.status(200).json({ ok: true, sin_email: true });
    }

    if (await reporteYaEnviado(destino, id)) return res.status(200).json({ ok: true, ya_enviado: true });

    // Recién aprobado: se le da tiempo a la página para entregarlo
    const aprobado = Date.parse(pago.date_approved || pago.date_created || "") || 0;
    if (Date.now() - aprobado < ESPERA_MS) return res.status(503).json({ reintentar: true });

    // Se marca antes de generar para que un reintento simultáneo no lo duplique
    await marcarReporteEnviado(destino, id);
    await marcarComprador([payload.email, pago.payer && pago.payer.email]);

    const { nombre, eneatipo, ala, instinto } = payload;
    let ok = false;
    try {
      const reporte = await generarReporte({ nombre, eneatipo, ala, instinto });
      ok = await enviarReportePorEmail({ email: destino, nombre, eneatipo, ala, instinto, reporte });
    } catch (e) {
      console.error("Error generando el reporte desde el aviso:", e && e.message);
    }
    if (!ok) {
      await marcarReporteEnviado(destino, ""); // libera para el próximo reintento
      return res.status(500).json({ error: "No se pudo enviar el reporte" });
    }
    return res.status(200).json({ ok: true, enviado: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error interno" });
  }
}
