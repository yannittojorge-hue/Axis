// api/mp_verify_and_report.js

import OpenAI from "openai";

function decodeToken(token) {
  // Token simple (NO seguro criptográficamente, pero suficiente si igual verificamos pago)
  // Formato: base64(json)
  const json = Buffer.from(token, "base64").toString("utf8");
  return JSON.parse(json);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { token, payment_id, collection_id } = req.body;

    if (!token) return res.status(400).json({ error: "Falta token" });
    const payId = payment_id || collection_id;
    if (!payId) return res.status(400).json({ error: "Falta payment_id/collection_id" });

    const mpAccessToken = process.env.MP_ACCESS_TOKEN;
    if (!mpAccessToken) return res.status(500).json({ error: "Falta MP_ACCESS_TOKEN" });

    // 1) Consultamos el pago a Mercado Pago
    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${payId}`, {
      headers: { Authorization: `Bearer ${mpAccessToken}` },
    });
    const payData = await payRes.json();

    if (!payRes.ok) return res.status(500).json({ error: "No pude verificar el pago", details: payData });

    // 2) Validamos estado
    const status = (payData.status || "").toLowerCase();
    if (status !== "approved") {
      return res.status(402).json({ error: `Pago no aprobado (status=${status})` });
    }

    // 3) Validamos que el pago corresponde a este token
   const extRef = payData.external_reference ? decodeURIComponent(payData.external_reference) : "";
   const tok = token ? decodeURIComponent(token) : "";

   if (extRef !== tok) {
     return res.status(403).json({ error: "external_reference no coincide", extRef, tok });
}


    // 4) Generamos reporte (OpenAI)
    const { nombre, eneatipo, ala, instinto } = decodeToken(token);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `
Actúa como un Psicoterapeuta experto en Eneagrama Transpersonal (Escuela Riso-Hudson).
Vas a redactar un informe de personalidad profunda para: ${nombre}.

DATOS DEL PERFIL:
- Eneatipo Central: Tipo ${eneatipo}
- Ala Dominante: ${ala}
- Instinto (Subtipo): ${instinto}

OBJETIVO:
Crear un análisis psicológico detallado, serio y transformador. Nada de horóscopos ni generalidades.
Quiero que desgloses la "mecanica" de su psique.

ESTRUCTURA OBLIGATORIA DEL REPORTE (Usa estas etiquetas HTML: <h3>, <p>, <ul>, <li>, <strong>):

1. <h3>TU PERFIL NUCLEAR (Eneatipo ${eneatipo} con ${ala})</h3>
2. <h3>TU SUBTIPO INSTINTIVO (${instinto})</h3>
3. <h3>LA SOMBRA: TU DESINTEGRACIÓN</h3>
4. <h3>LA LUZ: TU CAMINO DE INTEGRACIÓN</h3>
5. <h3>PRÁCTICAS DE MAESTRÍA</h3>

TONO: Profesional, clínico pero cercano, empoderador y muy preciso.
`.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: prompt }],
      temperature: 0.7,
      max_tokens: 1600,
    });

    return res.status(200).json({ reporte: completion.choices[0].message.content });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error verificando/generando reporte" });
  }
}
