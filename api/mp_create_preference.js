// api/mp_create_preference.js

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { token, price } = req.body;

    if (!token) return res.status(400).json({ error: "Falta token" });

    const mpAccessToken = process.env.MP_ACCESS_TOKEN;
    if (!mpAccessToken) return res.status(500).json({ error: "Falta MP_ACCESS_TOKEN en Vercel" });

    const baseUrl = process.env.BASE_URL || "https://www.mieneatipo.ar";
    const amount = Number(price || 4800);

const preferenceBody = {
  items: [
    {
      title: "Reporte Mi Eneatipo (Premium)",
      quantity: 1,
      currency_id: "ARS",
      unit_price: amount,
    },
  ],
  external_reference: token,

  back_urls: {
    success: `${baseUrl}/?mp_return=1`,
    failure: `${baseUrl}/?mp_return=1`,
    pending: `${baseUrl}/?mp_return=1`
  },

  auto_return: "approved",
};


    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferenceBody),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      return res.status(500).json({ error: "Mercado Pago error", details: mpData });
    }

    // init_point es el link para pagar
    return res.status(200).json({ init_point: mpData.init_point });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error creando preferencia" });
  }
}
