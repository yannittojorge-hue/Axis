import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Asegúrate de tener esto en tu .env
});

export default async function handler(req, res) {
  // Solo permitimos solicitudes POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Recibimos los datos que envía el index.html
    const { nombre, eneatipo, ala, instinto, astros } = req.body;

    // 2. Definimos el "Mega-Prompt" (Las instrucciones para la IA)
    const promptSistema = `
      Actúa como un experto mundial en Astrología Evolutiva y Psicología del Eneagrama (Riso-Hudson).
      Vas a recibir un perfil con: Nombre, Eneatipo, Ala, Instinto y Posiciones Astrales.

      TU TAREA:
      Generar un reporte profundo, directo y transformador para ${nombre}. 
      No uses lenguaje místico vago; usa psicología práctica y arquitectura de personalidad.
      
      ESTRUCTURA OBLIGATORIA DEL REPORTE (Usa HTML simple: <h3>, <p>, <ul>, <li>, <strong>):

      1. <h3>LA ARQUITECTURA DE TU EGO (TIPO ${eneatipo} ${instinto})</h3>
         - Explica la tensión o sinergia entre su Eneatipo (su herida: ${eneatipo}) y su Sol en ${astros.sol} / Luna en ${astros.luna}.
         - Analiza cómo su instinto (${instinto}) modifica su comportamiento principal.

      2. <h3>TU CAMINO DE DESINTEGRACIÓN (EL ESTRÉS)</h3>
         - Explica qué pasa cuando cae en su sombra. NO digas solo "te vas al número X". Explica el comportamiento tóxico real.
         - Cruza esto con su MARTE en ${astros.marte} (cómo acciona en conflicto).
         - Ejemplo: "Cuando te estresas, tu Marte en ${astros.marte} te vuelve..."

      3. <h3>TU CAMINO DE INTEGRACIÓN (LA EVOLUCIÓN)</h3>
         - Este es el núcleo. Explica qué significa evolucionar hacia su integración.
         - Explica que "Integrar" no es dejar de ser quien es, sino sumar nuevas herramientas.
         - Cruza esto con su VENUS en ${astros.venus} o ASCENDENTE (${astros.asc}) como puntos de equilibrio.

      4. <h3>HERRAMIENTAS DE ALINEACIÓN</h3>
         - Dame 3 acciones concretas (Bullet points) basadas en su Ala (${ala === 'Balanceada' ? 'Alas Balanceadas' : 'Ala ' + ala}) y su Mercurio en ${astros.mercurio}.
         - Nada de "respira hondo". Acciones reales y estratégicas.

      TONO: Profesional, empático, directo, revelador.
      FORMATO: HTML limpio (sin etiquetas de código, solo el contenido del div).
    `;

    // 3. Enviamos el mensaje a OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // O "gpt-3.5-turbo" si quieres ahorrar
      messages: [
        { role: "system", content: promptSistema },
        { role: "user", content: `Analiza este perfil: Nombre: ${nombre}, Eneatipo: ${eneatipo}, Ala: ${ala}, Instinto: ${instinto}, Astros: ${JSON.stringify(astros)}.` }
      ],
      temperature: 0.7, // Creatividad equilibrada
    });

    // 4. Devolvemos la respuesta al Frontend
    const reporteGenerado = completion.choices[0].message.content;
    res.status(200).json({ reporte: reporteGenerado });

  } catch (error) {
    console.error("Error en OpenAI:", error);
    res.status(500).json({ error: "Error generando el reporte." });
  }
}