// Desactivado: este endpoint no lo usa la página y permitía obtener
// el reporte premium sin pagar (y gastar créditos de OpenAI / enviar emails).
// El reporte se genera solo en /api/mp_verify_and_report, después de verificar el pago.
export default function handler(req, res) {
  return res.status(410).json({ error: "Endpoint desactivado" });
}
