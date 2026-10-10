// Análisis GRATIS que se muestra al terminar el test (después de dejar el email).
// Lo escribe la IA con las respuestas de la persona, pero NUNCA revela el
// eneatipo, el ala ni el instinto: eso es parte del resultado pago.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Falta OPENAI_API_KEY" });

  const { nombre, eneatipo, ala, instinto, abiertas } = req.body || {};
  const tipo = Number(eneatipo);
  if (!(tipo >= 1 && tipo <= 9)) return res.status(400).json({ error: "Eneatipo inválido" });

  const limpiar = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
  const respuestas = (Array.isArray(abiertas) ? abiertas : [])
    .slice(0, 4)
    .map(x => ({ p: limpiar(x && x.p, 160), r: limpiar(x && x.r, 400) }))
    .filter(x => x.r.length >= 2);

  const bloqueRespuestas = respuestas.length
    ? respuestas.map(x => `- Pregunta: "${x.p}"\n  Respuesta: "${x.r}"`).join("\n")
    : "(No respondió las preguntas abiertas.)";

  const prompt = `Sos un psicoterapeuta experto en Eneagrama (escuela Riso-Hudson) y escribís en español rioplatense, con voseo.

Vas a escribir un ANÁLISIS BREVE GRATUITO para ${limpiar(nombre, 40) || "la persona"}, que acaba de terminar un test de Eneagrama.

DATOS INTERNOS (solo para que tu análisis sea preciso; NO los menciones):
- Eneatipo: ${tipo}
- ${limpiar(ala, 30)}
- Instinto dominante: ${limpiar(instinto, 30)}

LO QUE LA PERSONA ESCRIBIÓ:
${bloqueRespuestas}

REGLAS ESTRICTAS:
1. NUNCA nombres ni insinúes el número del eneatipo, el nombre del tipo (Reformador, Ayudador, Triunfador, Individualista, Investigador, Leal, Entusiasta, Desafiador, Pacificador), el ala ni el instinto. No uses la palabra "eneatipo" seguida de un número ni la palabra "tipo" con un número.
2. Describí su motivación de fondo, cómo procesa lo que le pasa y un patrón que probablemente reconozca, usando lo que caracteriza a ese eneatipo, pero con palabras propias.
3. Si respondió las preguntas abiertas, retomá con naturalidad una o dos de sus respuestas (parafraseadas) para que sienta que el análisis habla de su vida.
4. Dos párrafos, entre 90 y 130 palabras en total. Segunda persona, tono cálido, preciso y sin frases de horóscopo.
5. Terminá con una oración que genere curiosidad por lo que todavía no sabe (de dónde viene ese patrón, qué lo activa o hacia dónde puede crecer), sin mencionar precios ni pagos.
6. Solo texto plano: sin títulos, sin listas, sin markdown. Separá los párrafos con una línea en blanco.
7. Usá voseo argentino en TODOS los verbos (sentís, tenés, experimentás, podés, ¿te preguntaste...?). Nunca uses tuteo ("experimentas", "tienes", "te has preguntado") ni "usted".`;

  // Por si el modelo igual se filtra: frases con el tipo, el ala o el instinto
  const prohibido = /\b(eneatipo|tipo|ala)\s*(n[uú]mero\s*)?[1-9]\b|\b[1-9]\s*w\s*[1-9]\b|reformador|ayudador|triunfador|individualista|investigador|\bleal(es)?\b|entusiasta|desafiador|pacificador|autoconservaci|instinto (social|sexual)|subtipo/i;

  async function pedir(extra) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.8,
          max_tokens: 400,
          messages: [{ role: "user", content: prompt + (extra || "") }],
        }),
        signal: ctrl.signal,
      });
      const j = await r.json();
      if (!r.ok) throw new Error((j && j.error && j.error.message) || "OpenAI error");
      return String(j?.choices?.[0]?.message?.content || "").trim();
    } finally {
      clearTimeout(t);
    }
  }

  try {
    let texto = await pedir();
    if (prohibido.test(texto)) {
      texto = await pedir("\n\nIMPORTANTE: tu respuesta anterior mencionaba el tipo, el ala o el instinto. Reescribilo sin ninguna de esas referencias.");
    }
    if (prohibido.test(texto)) {
      // Último recurso: sacar las oraciones que se filtran
      texto = texto.split(/(?<=[.!?])\s+/).filter(o => !prohibido.test(o)).join(" ");
    }
    texto = texto.replace(/[#*_`>]/g, "").trim();
    if (texto.length < 80) throw new Error("Análisis demasiado corto");
    return res.status(200).json({ analisis: texto });
  } catch (e) {
    console.error("Error generando análisis gratis:", e && e.message);
    return res.status(502).json({ error: "No se pudo generar el análisis" });
  }
}
