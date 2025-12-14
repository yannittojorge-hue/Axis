import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // Evitamos problemas de conexión cruzada
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { nombre, eneatipo, ala, instinto, astros } = req.body;

    const prompt = `
      Actúa como un experto mundial en Eneagrama Riso-Hudson y Astrología Psicológica Avanzada.
      Estás analizando el perfil de: ${nombre}.
      
      DATOS:
      - Eneatipo Principal: ${eneatipo}
      - Ala: ${ala}
      - Instinto: ${instinto}
      - Carta Astral: Sol en ${astros.sol}, Luna en ${astros.luna}, Ascendente ${astros.asc}, Marte en ${astros.marte}, Venus en ${astros.venus}, Mercurio en ${astros.mercurio}.

      OBJETIVO:
      Crear un reporte de transformación personal extenso y profundo. Enfócate radicalmente en la INTEGRACIÓN (Sanación).

      ESTRUCTURA HTML OBLIGATORIA (Solo contenido dentro de <h3>, <p>, <ul>, <li>):

      1. <h3>TU ARQUITECTURA DE EGO (Tipo ${eneatipo} + Sol en ${astros.sol})</h3>
         - <p>Explica la fricción o armonía entre su herida del Eneagrama ${eneatipo} y su identidad solar en ${astros.sol}.</p>
         - <p>Menciona cómo su Luna en ${astros.luna} procesa las emociones de este tipo.</p>

      2. <h3>LA TRAMPA: TU DESINTEGRACIÓN</h3>
         - <p>Explica brevemente qué pasa bajo estrés. No digas solo números. Describe la conducta reactiva.</p>
         - <p>CRUCE ASTRAL: Explica cómo su MARTE en ${astros.marte} agrava esta reacción (¿Se vuelve agresivo, pasivo, huye?).</p>

      3. <h3>TU CAMINO DE INTEGRACIÓN (La Gran Evolución)</h3>
         - <p><strong>Esta es la parte más importante. Extiéndete aquí.</strong></p>
         - <p>Explica detalladamente qué significa ir hacia su Eneagrama de Integración. (Ej: Si es 8, ir al 2 no es ser débil, es cuidar). Explica el cambio de consciencia necesario.</p>
         - <p>Diferencia claramente entre actuar desde el ego vs. actuar desde la esencia integrada.</p>
         - <p><strong>LA CLAVE ASTRAL:</strong> Usa su VENUS en ${astros.venus} o su ASCENDENTE como la herramienta "secreta" para facilitar esta integración. ¿Cómo esa energía suaviza su eneatipo?</p>

      4. <h3>PRÁCTICAS DE ALINEACIÓN</h3>
         - <ul>
           <li>Una práctica concreta para su Instinto ${instinto}.</li>
           <li>Un consejo mental basado en su Mercurio en ${astros.mercurio}.</li>
           <li>Un mantra o frase de poder para su integración.</li>
         </ul>

      TONO: Directo, sofisticado, psicológico y empoderador.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1500, // Aumentado para que escriba más
    });

    res.status(200).json({ reporte: completion.choices[0].message.content });

  } catch (error) {
    console.error("Error OpenAI:", error);
    res.status(500).json({ error: "Error de conexión con la IA." });
  }
}