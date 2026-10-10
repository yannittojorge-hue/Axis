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
    const PRECIO = 4500;
    if (mpData.currency_id !== "ARS" || Number(mpData.transaction_amount) < PRECIO) {
      return res.status(402).json({ error: "Monto pagado incorrecto" });
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

    // 4b) Marcar en Brevo que esta persona ya compró (COMPRO = "SI"),
    // para que la secuencia de emails no le siga ofreciendo el reporte.
    // Nunca bloquea la entrega del reporte si falla.
    await marcarComprador([payload.email, mpData.payer && mpData.payer.email]);

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

FORMATO EXTRA (respetalo exactamente):
- En la sección 1, después del primer párrafo, incluí este bloque con el contenido de su tipo:
  <div class="clave"><p><strong>Deseo fundamental</strong>...</p><p><strong>Miedo básico</strong>...</p></div>
- En cada sección incluí una sola frase clave, breve y memorable, dentro de <blockquote>...</blockquote>.
CONTENIDO MÍNIMO POR SECCIÓN (el cliente pagó por esto, no lo omitas):
- Sección 1: su herida de origen, su deseo fundamental, su miedo básico y cómo su ala modifica el tipo.
- Sección 2: cómo su instinto dominante cambia la forma en que se expresa su tipo.
- Sección 3: su mecanismo de defensa principal (nombralo) y cómo reacciona bajo estrés.
- Sección 4: hacia dónde crece cuando está en su mejor versión.
- Sección 5: al menos 4 prácticas concretas, en una lista <ul>.
- No uses <h1>, <h2>, estilos en línea ni bloques de código.

${respuestasAbiertas.length ? `LO QUE ${nombre} ESCRIBIÓ EN EL TEST (usalo para personalizar: retomá estas situaciones concretas en las secciones que correspondan, parafraseadas, sin citarlas textualmente ni de forma forzada):
${respuestasAbiertas.map(x => `- ${x.p} → "${x.r}"`).join("\n")}

` : ""}TONO: Profesional, clínico pero cercano, empoderador y muy preciso.
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
        max_tokens: 2400,
      }),
    });

    const oaiData = await oaiResp.json();
    if (!oaiResp.ok) {
      return res.status(502).json({ error: "OpenAI error", detail: oaiData });
    }

    let reporte = oaiData?.choices?.[0]?.message?.content;
    if (!reporte) {
      return res.status(500).json({ error: "OpenAI no devolvió reporte" });
    }
    // Por si el modelo envuelve la respuesta en un bloque ```html
    reporte = reporte.replace(/^\s*```(?:html)?\s*/i, "").replace(/\s*```\s*$/, "");

    // 6) Copia del reporte por email (una sola vez por pago: la página avisa
    // con enviar_email=false si ya se mandó). Nunca bloquea la entrega.
    let emailCopia = null;
    if (enviar_email) {
      const destino = payload.email || (mpData.payer && mpData.payer.email);
      if (destino && await enviarReportePorEmail({ email: destino, nombre, eneatipo, ala, instinto, reporte })) {
        emailCopia = ocultarEmail(destino);
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

// Actualiza el atributo COMPRO de los contactos que ya existen en Brevo.
// Usa PUT: si el email no está en Brevo, no crea un contacto nuevo.
async function marcarComprador(emails) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return;
  const unicos = [...new Set(
    (emails || []).filter(Boolean).map(e => String(e).trim().toLowerCase())
  )];
  for (const email of unicos) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "api-key": apiKey },
        body: JSON.stringify({ attributes: { COMPRO: "SI" } }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (r.status !== 204 && r.status !== 404) {
        console.error("Brevo no marcó comprador:", r.status, await r.text().catch(() => ""));
      }
    } catch (e) {
      console.error("Error marcando comprador en Brevo:", e && e.message);
    }
  }
}

// ─── Copia del reporte por email (Brevo, email transaccional) ───────────────
function escaparHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// jo***@gmail.com: alcanza para que la persona reconozca su email sin exponerlo entero
function ocultarEmail(email) {
  const [u, d] = String(email).trim().toLowerCase().split("@");
  if (!u || !d) return null;
  return u.slice(0, 2) + "***@" + d;
}

// Los programas de email no leen las clases del sitio: los estilos van en línea.
function reporteParaEmail(html) {
  let n = 0;
  return String(html)
    .replace(/<div class="clave">([\s\S]*?)<\/div>/g, (_, dentro) => {
      const colores = [["#E8F1EC", "#2E5941"], ["#FFF1EC", "#C2513C"]];
      let k = 0;
      return dentro.replace(/<p>([\s\S]*?)<\/p>/g, (__, txt) => {
        const [fondo, color] = colores[Math.min(k++, 1)];
        return `<div style="background:${fondo};border-radius:10px;padding:12px 14px;margin:0 0 8px 0;font-size:15px;line-height:1.5;color:#3A3A3A;">` +
          txt.replace(/<strong>/, `<strong style="display:block;font-size:13px;color:${color};margin-bottom:3px;">`) + `</div>`;
      });
    })
    .replace(/<h3>/g, () => `<h3 style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1.35;color:#274E55;margin:30px 0 12px 0;padding-top:18px;border-top:1px solid #EFE9E1;"><span style="display:inline-block;width:26px;height:26px;line-height:26px;border-radius:13px;background:#FF7F66;color:#ffffff;text-align:center;font-size:14px;margin-right:8px;">${++n}</span>`)
    .replace(/<blockquote>/g, `<blockquote style="margin:18px 0;padding:2px 0 2px 14px;border-left:3px solid #FF7F66;font-family:Georgia,serif;font-style:italic;font-size:17px;line-height:1.5;color:#274E55;">`)
    .replace(/<p>/g, `<p style="margin:0 0 14px 0;font-size:16px;line-height:1.65;color:#3A3A3A;">`)
    .replace(/<ul>/g, `<ul style="margin:0 0 14px 0;padding-left:20px;">`)
    .replace(/<li>/g, `<li style="margin:0 0 8px 0;font-size:16px;line-height:1.55;color:#3A3A3A;">`)
    .replace(/<strong>/g, `<strong style="color:#274E55;">`);
}

async function enviarReportePorEmail({ email, nombre, eneatipo, ala, instinto, reporte }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey || !email) return false;
  const chip = txt => `<span style="display:inline-block;background:rgba(255,255,255,0.16);color:#ffffff;font-size:13px;padding:4px 10px;border-radius:12px;margin:0 4px 4px 0;">${escaparHtml(txt)}</span>`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#F4EFE9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4EFE9;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
<tr><td style="background:#274E55;padding:26px 28px;">
  <div style="font-size:13px;color:#C9D6D8;margin-bottom:4px;">Mi Eneatipo</div>
  <div style="font-size:24px;font-weight:bold;color:#ffffff;margin-bottom:12px;">Tu mapa interno</div>
  ${chip("Eneatipo " + eneatipo)}${chip(ala)}${chip("Instinto " + instinto)}
</td></tr>
<tr><td style="padding:26px 28px 8px 28px;">
  <p style="margin:0 0 6px 0;font-size:16px;line-height:1.6;color:#3A3A3A;">Hola ${escaparHtml(nombre)},</p>
  <p style="margin:0 0 4px 0;font-size:16px;line-height:1.6;color:#3A3A3A;">Gracias por tu compra. Acá tenés tu reporte completo. Guardá este email: es tu copia para volver a leerlo cuando quieras.</p>
  ${reporteParaEmail(reporte)}
</td></tr>
<tr><td style="padding:18px 28px 26px 28px;border-top:1px solid #EFE9E1;font-size:13px;line-height:1.6;color:#888888;">
  Tenés garantía de 7 días: si el reporte no te aporta valor, respondé este email y te devolvemos el 100%.<br>
  Mi Eneatipo · <a href="https://www.mieneatipo.ar" style="color:#274E55;">mieneatipo.ar</a>
</td></tr>
</table></td></tr></table></body></html>`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({
        sender: { name: "Mi Eneatipo", email: "hola@mieneatipo.ar" },
        to: [{ email: String(email).trim().toLowerCase(), name: String(nombre).slice(0, 60) }],
        replyTo: { email: "yannittojorge@gmail.com", name: "Mi Eneatipo" },
        subject: `Tu reporte completo: Eneatipo ${eneatipo}`,
        htmlContent: html,
        tags: ["reporte"],
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (r.status === 201 || r.status === 200) return true;
    console.error("Brevo no envió el reporte:", r.status, await r.text().catch(() => ""));
    return false;
  } catch (e) {
    console.error("Error enviando el reporte por email:", e && e.message);
    return false;
  }
}
