export default async function handler(req, res) {
  // Solo acepta POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, nombre, eneatipo, ala, instinto } = req.body;

  if (!email || !nombre) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }

  // La API Key vive en Vercel de forma segura, no en el código
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "API key no configurada" });
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        email: email,
        firstName: nombre,
        updateEnabled: true,
        attributes: {
          ENEATIPO: String(eneatipo || ""),
          ALA: ala || "",
          INSTINTO: instinto || "",
        },
      }),
    });

    // Brevo devuelve 201 cuando crea el contacto, 204 cuando lo actualiza
    if (response.status === 201 || response.status === 204) {
      return res.status(200).json({ ok: true });
    }

    const errorData = await response.json().catch(() => ({}));
    return res.status(200).json({ ok: false, brevo_error: errorData });

  } catch (err) {
    console.error("Error llamando a Brevo:", err);
    // Devolvemos ok igual para no bloquear el flujo del usuario
    return res.status(200).json({ ok: false, error: err.message });
  }
}