import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // Configuración de cabeceras
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // YA NO recibimos astros, solo datos del Eneagrama
    const { nombre, eneatipo, ala, instinto } = req.body;

    const prompt = `
      Actúa como un experto mundial en Psicología del Eneagrama (Escuela Riso-Hudson).
      Vas a analizar el perfil de: ${nombre}.
      
      DATOS TÉCNICOS:
      - Eneatipo Central: ${eneatipo}
      - Ala Dominante: ${ala}
      - Instinto Predominante: ${instinto}

      OBJETIVO:
      Crear un reporte de autoconocimiento radical, sin misticismo, basado en la estructura de la personalidad y la neurosis.

      ESTRUCTURA HTML OBLIGATORIA (Solo devuelve el contenido dentro de las etiquetas <h3>, <p>, <ul>, <li>):

      1. <h3>TU ARQUITECTURA PSICOLÓGICA (Tipo ${eneatipo})</h3>
         - <p>Describe con precisión quirúrgica su herida básica y su motivación principal.</p>
         - <p>Explica cómo el Instinto ${instinto} "colorea" o modifica específicamente a este Eneatipo (Subtipo).</p>

      2. <h3>EL SUEÑO HIPNÓTICO (Tu Desintegración)</h3>
         - <p>Describe los síntomas de estrés específicos de este perfil. No digas "vas al número X", describe la conducta tóxica y el mecanismo de defensa que se activa.</p>

      3. <h3>EL CAMINO DE INTEGRACIÓN (La Salida)</h3>
         - <p>Explica qué significa psicológicamente avanzar hacia su punto de integración.</p>
         - <p>Aclara que integrar no es cambiar de personalidad, sino incorporar herramientas que le faltan.</p>
         - <p>Da un ejemplo concreto de cómo se ve este tipo cuando está sano y centrado.</p>

      4. <h3>HERRAMIENTAS DE ALINEACIÓN</h3>
         - <ul>
           <li>Una práctica de auto-observación específica para el Tipo ${eneatipo}.</li>
           <li>Un consejo para equilibrar su Ala ${ala}.</li>
           <li>Una frase de recordatorio para desactivar su piloto automático.</li>
         </ul>

      TONO: Profesional, directo, empático y transformador.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1200,
    });

    res.status(200).json({ reporte: completion.choices[0].message.content });

  } catch (error) {
    console.error("Error OpenAI:", error);
    res.status(500).json({ error: "Error de conexión con la IA." });
  }
}