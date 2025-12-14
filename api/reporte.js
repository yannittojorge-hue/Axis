import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // Configuración de seguridad para Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { nombre, eneatipo, ala, instinto } = req.body;

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
         - <p>Explica la esencia del Eneatipo ${eneatipo}: su Miedo Básico y su Deseo Fundamental.</p>
         - <p><strong>El Matiz del Ala:</strong> Explica específicamente cómo el ${ala} modifica a su eneatipo central. ¿Lo hace más introvertido, más agresivo, más mental? (Ej: Un 1 ala 9 es muy distinto a un 1 ala 2).</p>

      2. <h3>TU SUBTIPO INSTINTIVO (${instinto})</h3>
         - <p>Este es el "animal" que vive dentro de ti. Explica cómo se comporta un Eneatipo ${eneatipo} que tiene el instinto ${instinto} dominante.</p>
         - <p>Describe dónde pone su atención obsesiva automáticamente (seguridad, conexión 1 a 1, o grupo).</p>

      3. <h3>LA SOMBRA: TU DESINTEGRACIÓN</h3>
         - <p>Explica la "Ley de la Desintegración" para el Eneatipo ${eneatipo}.</p>
         - <p>Describe los síntomas de alarma: ¿Qué conductas tóxicas aparecen cuando estás bajo estrés prolongado? (Menciona hacia qué número se desplaza su energía negativamente).</p>

      4. <h3>LA LUZ: TU CAMINO DE INTEGRACIÓN</h3>
         - <p>Explica el movimiento de crecimiento psicológico.</p>
         - <p>No le digas "sé como el número X". Dile qué cualidades específicas de ese número de integración debe incorporar conscientemente para sanar.</p>
         - <p>Ejemplo: "Tu crecimiento implica soltar el control y abrazar la inocencia del Eneatipo..."</p>

      5. <h3>PRÁCTICAS DE MAESTRÍA</h3>
         - <ul>
           <li>Una práctica de auto-observación diaria para atrapar al ego en acción.</li>
           <li>Un consejo específico para equilibrar su instinto ${instinto}.</li>
           <li>Un mantra o afirmación de sanación para el Eneatipo ${eneatipo}.</li>
         </ul>

      TONO: Profesional, clínico pero cercano, empoderador y muy preciso.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // Modelo rápido y capaz
      messages: [
        { role: "system", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1600, // Aumentamos la longitud para que no se corte
    });

    res.status(200).json({ reporte: completion.choices[0].message.content });

  } catch (error) {
    console.error("Error OpenAI:", error);
    res.status(500).json({ error: "Error generando el reporte." });
  }
}