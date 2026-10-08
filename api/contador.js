// api/contador.js
// Contador real de personas que terminaron el test.
// GET  -> devuelve el total (base histórica + tests terminados desde que existe el contador)
// POST -> suma 1 (como máximo una vez cada 10 minutos por conexión, para evitar inflarlo)
//
// Usa la base de datos Upstash Redis conectada desde Vercel (Storage). Si todavía no
// está conectada, responde error y la página sigue mostrando "+10.000".

import crypto from "crypto";

const BASE_HISTORICA = 10000; // personas que hicieron el test antes de existir el contador
const CLAVE = "tests_completados";

const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(...cmd) {
  const r = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || "Error de base de datos");
  return j.result;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!URL || !TOKEN) return res.status(503).json({ error: "Contador sin base de datos" });

  try {
    if (req.method === "POST") {
      const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "sin-ip";
      const huella = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
      const nuevo = await redis("SET", `contador_ip:${huella}`, "1", "NX", "EX", "600");
      if (nuevo === "OK") await redis("INCR", CLAVE);
    } else if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }
    const completados = Number(await redis("GET", CLAVE)) || 0;
    return res.status(200).json({ total: BASE_HISTORICA + completados });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error leyendo el contador" });
  }
}
