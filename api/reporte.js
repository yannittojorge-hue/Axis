// Vercel Serverless Function
const https = require('https');

export default async function handler(req, res) {
  // 1. CORS (Permisos)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { nombre, eneatipo, ala, sol, luna, ascendente } = req.body;
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Falta la API Key en Vercel." });
    }

    const prompt = `
      Actúa como psicólogo experto en Eneagrama y Astrología.
      Analiza a: ${nombre}.
      Datos: Eneatipo ${eneatipo} (Ala ${ala}), Sol ${sol}, Luna ${luna}, Asc ${ascendente}.
      
      Escribe un reporte breve (300 palabras), directo y profundo. Usa HTML (<h3>, <p>).
      
      SECCIONES:
      <h3>1. ARQUITECTURA (Tipo ${eneatipo})</h3>
      <p>Arquetipo, miedo y mentira del ego.</p>
      <h3>2. CRUCE ASTRAL</h3>
      <p>Sol/Eneagrama y Luna/Ascendente.</p>
      <h3>3. INTEGRACIÓN</h3>
      <p>Consejo de crecimiento.</p>
    `;

    // Llamada a OpenAI
    const responseText = await new Promise((resolve, reject) => {
      const reqApi = https.request({
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }, (resApi) => {
        let data = '';
        resApi.on('data', chunk => data += chunk);
        resApi.on('end', () => resolve(data));
      });
      
      reqApi.on('error', (e) => reject(e));
      reqApi.write(JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: "Eres AXIS." }, { role: "user", content: prompt }],
        temperature: 0.7
      }));
      reqApi.end();
    });

    const openaiData = JSON.parse(responseText);
    
    if (openaiData.error) {
      return res.status(500).json({ error: openaiData.error.message });
    }

    return res.status(200).json({ reporte: openaiData.choices[0].message.content });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}