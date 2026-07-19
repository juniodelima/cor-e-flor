// api/freight.js — Calcula frete por UF usando tabela regional (baseada em DF como origem)

const { FREIGHT_TABLE, DEFAULT_FREIGHT } = require('../lib/freight-table');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const cep = String(req.query.cep || '').replace(/\D/g, '');
  if (cep.length !== 8) {
    return res.status(400).json({ error: 'CEP inválido' });
  }

  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!r.ok) throw new Error('ViaCEP indisponível');
    const d = await r.json();
    if (d.erro) return res.status(404).json({ error: 'CEP não encontrado' });

    const uf      = (d.uf || '').toUpperCase();
    const freight = FREIGHT_TABLE[uf] || DEFAULT_FREIGHT;
    const freeAbove = parseFloat(process.env.FREE_SHIPPING_ABOVE || '299');

    return res.status(200).json({
      uf,
      city:       d.localidade || '',
      pac:        freight.pac,
      sedex:      freight.sedex,
      free_above: freeAbove,
    });

  } catch (err) {
    console.error('[freight]', err);
    // Retorna valores padrão se ViaCEP falhar
    return res.status(200).json({
      uf:         '??',
      city:       '',
      pac:        DEFAULT_FREIGHT.pac,
      sedex:      DEFAULT_FREIGHT.sedex,
      free_above: 299,
    });
  }
};
