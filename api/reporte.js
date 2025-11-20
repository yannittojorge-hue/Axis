const https = require('https');

export default async function handler(req, res) {
  // 1. CORS y Configuración
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { return res.status(405).json({ error: 'Método no permitido' }); }

  try {
    // 2. Recibir Datos Completos
    const { nombre, eneatipo, ala, astros } = req.body; // 'astros' es un objeto con Sol, Luna, Asc, Mar, Mer, Ven
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Falta API Key" });

    // 3. Prompt de Alta Ingeniería (Riso-Hudson + Astrología Avanzada)
    const prompt = `
      Actúa como un consultor experto en Psicología Transpersonal (especialista en Riso-Hudson) y Astrólogo evolutivo.
      
      PERFIL DEL CLIENTE:
      - Nombre: ${nombre}
      - Eneagrama: Tipo ${eneatipo} con Ala ${ala}.
      - Carta Astral:
        * Sol (Esencia): ${astros.sol}
        * Luna (Emoción): ${astros.luna}
        * Ascendente (Máscara): ${astros.asc}
        * Mercurio (Mente): ${astros.mercurio}
        * Venus (Deseo/Valor): ${astros.venus}
        * Marte (Acción): ${astros.marte}

      OBJETIVO: Redactar un reporte "Mapa Interno AXIS" profundo, directo y revelador. Tono profesional pero empático.
      
      ESTRUCTURA HTML (Usa solo <h3>, <p>, <strong>):
      
      <h3>1. TU ARQUITECTURA PSICOLÓGICA (Tipo ${eneatipo}w${ala})</h3>
      <p>Define el arquetipo y explica el <strong>Miedo Básico</strong> y el <strong>Deseo Básico</strong> según Riso-Hudson.</p>
      <p>Explica la "Mentira Personal" que su ego le cuenta para sobrevivir.</p>
      <p>Analiza brevemente su Ala ${ala} y cómo modifica su comportamiento principal.</p>

      <h3>2. TU MAPA ASTRAL (El Cruce)</h3>
      <p><strong>Sol en ${astros.sol}:</strong> Cómo tu esencia zodiacal interactúa con tu Eneatipo. ¿Potencia o conflicto?</p>
      <p><strong>Tu Mundo Emocional:</strong> Análisis de la Luna en ${astros.luna}.</p>
      <p><strong>Tu Máscara y Acción:</strong> Cómo te ven (Ascendente ${astros.asc}) y cómo luchas por lo que quieres (Marte en ${astros.marte}).</p>
      <p><strong>Tu Mente y Valores:</strong> Breve mención a Mercurio en ${astros.mercurio} y Venus en ${astros.venus} en relación a su personalidad.</p>

      <h3>3. TU CAMINO DE INTEGRACIÓN</h3>
      <p>Indica hacia qué Eneatipo debe moverse para sanar (Integración) y qué comportamientos debe soltar (Desintegración).</p>
      <p><em>Cierra con una frase poderosa y personalizada.</em></p>
    `;

    // 4. Llamada a OpenAI
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

    const openaiData = JSON.parse(responseText);
    if (openaiData.error) return res.status(500).json({ error: openaiData.error.message });

    return res.status(200).json({ reporte: openaiData.choices[0].message.content });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}