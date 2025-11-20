const https = require('https');

export default async function handler(req, res) {
  // 1. Configuración de Seguridad (CORS)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { return res.status(405).json({ error: 'Método no permitido' }); }

  try {
    const { nombre, eneatipo, ala, astros } = req.body;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) return res.status(500).json({ error: "Falta API Key" });

    // 2. PROMPT MAESTRO (Riso-Hudson + Astrología Completa)
    const prompt = `
      Actúa como un experto mundial en Eneagrama (Escuela Riso-Hudson) y Astrología Evolutiva.
      Vas a escribir el reporte "AXIS: Tu Mapa Interno" para: ${nombre}.

      DATOS DEL USUARIO:
      - Eneatipo Principal: Tipo ${eneatipo} (Ala ${ala}).
      - Carta Astral:
        * Sol (Esencia): ${astros.sol}
        * Luna (Mundo Emocional): ${astros.luna}
        * Ascendente (Máscara/Ruta): ${astros.asc}
        * Mercurio (Mente/Comunicación): ${astros.mercurio}
        * Venus (Deseo/Valores): ${astros.venus}
        * Marte (Acción/Conflicto): ${astros.marte}

      INSTRUCCIONES DE REDACCIÓN:
      - Tono: Profesional, cálido, directo y revelador ("te leo la mente").
      - Formato: HTML limpio (usa <h3> para títulos, <p> para párrafos, <strong> para énfasis). No uses Markdown.
      - Longitud: Aproximadamente 450 palabras.

      ESTRUCTURA DEL REPORTE:

      <h3>1. TU ARQUITECTURA (Eneatipo ${eneatipo}w${ala})</h3>
      <p>Define su arquetipo con un nombre creativo. Explica su <strong>Miedo Básico</strong> y su <strong>Deseo Básico</strong>. Menciona cómo su Ala ${ala} modifica su comportamiento (sin gráficos, solo explicación profunda).</p>
      <p>Revela la "Mentira Personal" que su ego le cuenta para sobrevivir.</p>

      <h3>2. EL CRUCE ASTRAL (Tus 6 Astros)</h3>
      <p><strong>Sol en ${astros.sol}:</strong> Analiza cómo tu esencia zodiacal interactúa con tu Eneatipo. ¿Se potencian o entran en conflicto?</p>
      <p><strong>Luna en ${astros.luna} y Ascendente ${astros.asc}:</strong> Cómo procesas tus emociones y cómo te muestras al mundo vs. quién eres realmente.</p>
      <p><strong>Tus Herramientas (Mercurio, Venus, Marte):</strong> Breve análisis de cómo tu mente (${astros.mercurio}), tus valores (${astros.venus}) y tu forma de actuar (${astros.marte}) colorean tu personalidad.</p>

      <h3>3. TU CAMINO DE INTEGRACIÓN</h3>
      <p>Indica hacia qué Eneatipo debe moverse para sanar (Integración) y qué comportamientos de desintegración debe evitar.</p>
      <p><em>Termina con una frase de cierre inspiradora y personalizada.</em></p>
    `;

    // 3. Llamada a OpenAI
    const responseText = await new Promise((resolve, reject) => {
      const reqApi = https.request({
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }
      }, (resApi) => {
        let data = '';
        resApi.on('data', chunk => data += chunk);
        resApi.on('end', () => resolve(data));
      });
      
      reqApi.on('error', (e) => reject(e));
      
      reqApi.write(JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: "Eres AXIS AI." }, { role: "user", content: prompt }],
        temperature: 0.7
      }));
      reqApi.end();
    });

    const data = JSON.parse(responseText);
    if (data.error) return res.status(500).json({ error: data.error.message });

    return res.status(200).json({ reporte: data.choices[0].message.content });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}