// Guarda en Brevo a quien terminó el test y lo suma a la lista que dispara
// la secuencia de emails (Automatización #1 en Brevo).
export default async function handler(req, res) {
  // Solo acepta POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, nombre, eneatipo, ala, instinto } = req.body || {};

  if (!email || !nombre) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }

  // La API Key vive en Vercel de forma segura, no en el código
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "API key no configurada" });
  }

  // Lista "Su primera lista" (#2): entrar a esta lista arranca la secuencia.
  const listId = Number(process.env.BREVO_LIST_ID || 2);

  // Link personal para los emails: lleva directo a la pantalla de pago con su
  // resultado cargado, sin repetir el test.
  const r = Buffer.from(JSON.stringify({
    t: String(eneatipo || ""), a: String(ala || ""), i: String(instinto || ""),
  }), "utf-8").toString("base64url");
  const linkReporte = `https://www.mieneatipo.ar/?r=${r}&utm_source=brevo&utm_medium=email&utm_campaign=secuencia_test`;

  try {
    const response = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        email: String(email).trim().toLowerCase(),
        updateEnabled: true,
        listIds: [listId],
        // Los nombres de los campos tienen que coincidir con los atributos
        // creados en Brevo (NOMBRE, ENEATIPO, ALA, INSTINTO).
        attributes: {
          NOMBRE: String(nombre).trim().slice(0, 60),
          ENEATIPO: String(eneatipo || ""),
          ALA: String(ala || ""),
          INSTINTO: String(instinto || ""),
          LINK_REPORTE: linkReporte,
        },
      }),
    });

    // Brevo devuelve 201 cuando crea el contacto, 204 cuando lo actualiza
    if (response.status === 201 || response.status === 204) {
      return res.status(200).json({ ok: true });
    }

    const errorData = await response.json().catch(() => ({}));
    // Queda registrado en los logs de Vercel para poder detectarlo
    console.error("Brevo rechazó el contacto:", response.status, JSON.stringify(errorData));
    return res.status(200).json({ ok: false, brevo_error: errorData });

  } catch (err) {
    console.error("Error llamando a Brevo:", err);
    // Devolvemos ok igual para no bloquear el flujo del usuario
    return res.status(200).json({ ok: false, error: err.message });
  }
}
