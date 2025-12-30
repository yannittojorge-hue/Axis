export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { payment_id } = req.body || {};
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

    // 3) Tomar token desde external_reference (este es el punto clave)
    const extRefRaw = mpData.external_reference || "";
    const tok = extRefRaw ? decodeURIComponent(extRefRaw) : "";
    if (!tok) {
      return res.status(400).json({ error: "Pago aprobado pero falta external_reference en Mercado Pago" });
    }

    // 4) Token es base64 con JSON: decodificar
    const jsonStr = Buffer.from(tok, "base64").toString("utf-8");
    let payload;
    try {
      payload = JSON.parse(jsonStr);
    } catch {
      return res.status(400).json({ error: "external_reference inválido (no es JSON base64)" });
    }

    const { nombre, eneatipo, ala, instinto } = payload || {};
    if (!nombre || !eneatipo || !ala || !instinto) {
      return res.status(400).json({ error: "Token incompleto", payload });
    }

    // 5) Generar reporte con OpenAI
    const prompt = `
Actúa como un Psicoterapeuta experto en Eneagrama Transpersonal (Escuela Riso-Hudson).
Vas a redactar un informe de personalidad profunda para: ${nombre}.

DATOS DEL PERFIL:
- Eneatipo Central: Tipo ${eneatipo}
- Ala Dominante: ${ala}
- Instinto (Subtipo): ${instinto}

OBJETIVO:
Crear un análisis psicológico detallado, serio y transformador. Nada de horóscopos ni generalidades.
Quiero que desgloses la mecánica de su psique.

ESTRUCTURA OBLIGATORIA (usa etiquetas HTML: <h3>, <p>, <ul>, <li>, <strong>):

1. <h3>TU PERFIL NUCLEAR (Eneatipo ${eneatipo} con ${ala})</h3>
2. <h3>TU SUBTIPO INSTINTIVO (${instinto})</h3>
3. <h3>LA SOMBRA: TU DESINTEGRACIÓN</h3>
4. <h3>LA LUZ: TU CAMINO DE INTEGRACIÓN</h3>
5. <h3>PRÁCTICAS DE MAESTRÍA</h3>

TONO: Profesional, clínico pero cercano, empoderador y muy preciso.
`;

    const oaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "Sos un psicoterapeuta experto en Eneagrama Transpersonal (Riso-Hudson)." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1600,
      }),
    });

    const oaiData = await oaiResp.json();
    if (!oaiResp.ok) {
      return res.status(502).json({ error: "OpenAI error", detail: oaiData });
    }

    const reporte = oaiData?.choices?.[0]?.message?.content;
    if (!reporte) {
      return res.status(500).json({ error: "OpenAI no devolvió reporte" });
    }

    return res.status(200).json({ reporte });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error interno", detail: String(e) });
  }
}
