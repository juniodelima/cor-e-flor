// api/freight.js — Calcula frete por UF usando tabela regional (baseada em DF como origem)

const FREIGHT_TABLE = {
  // Centro-Oeste
  DF: { pac: { price: 14.90, days: 2 }, sedex: { price: 24.90, days: 1 } },
  GO: { pac: { price: 16.90, days: 3 }, sedex: { price: 27.90, days: 2 } },
  MT: { pac: { price: 25.90, days: 7 }, sedex: { price: 41.90, days: 4 } },
  MS: { pac: { price: 22.90, days: 6 }, sedex: { price: 36.90, days: 3 } },
  // Sudeste
  MG: { pac: { price: 18.90, days: 4 }, sedex: { price: 30.90, days: 2 } },
  SP: { pac: { price: 19.90, days: 4 }, sedex: { price: 31.90, days: 2 } },
  RJ: { pac: { price: 22.90, days: 5 }, sedex: { price: 35.90, days: 2 } },
  ES: { pac: { price: 24.90, days: 6 }, sedex: { price: 38.90, days: 3 } },
  // Sul
  PR: { pac: { price: 23.90, days: 6 }, sedex: { price: 36.90, days: 3 } },
  SC: { pac: { price: 24.90, days: 7 }, sedex: { price: 38.90, days: 3 } },
  RS: { pac: { price: 26.90, days: 8 }, sedex: { price: 42.90, days: 3 } },
  // Nordeste
  BA: { pac: { price: 27.90, days: 8 }, sedex: { price: 43.90, days: 4 } },
  SE: { pac: { price: 28.90, days: 8 }, sedex: { price: 44.90, days: 4 } },
  AL: { pac: { price: 29.90, days: 9 }, sedex: { price: 46.90, days: 5 } },
  PE: { pac: { price: 29.90, days: 9 }, sedex: { price: 46.90, days: 5 } },
  PB: { pac: { price: 31.90, days: 9 }, sedex: { price: 48.90, days: 5 } },
  RN: { pac: { price: 31.90, days: 9 }, sedex: { price: 48.90, days: 5 } },
  CE: { pac: { price: 31.90, days: 9 }, sedex: { price: 48.90, days: 5 } },
  PI: { pac: { price: 33.90, days: 10 }, sedex: { price: 52.90, days: 6 } },
  MA: { pac: { price: 33.90, days: 10 }, sedex: { price: 52.90, days: 6 } },
  // Norte
  TO: { pac: { price: 27.90, days: 8 }, sedex: { price: 44.90, days: 4 } },
  PA: { pac: { price: 35.90, days: 11 }, sedex: { price: 56.90, days: 6 } },
  AM: { pac: { price: 42.90, days: 13 }, sedex: { price: 68.90, days: 7 } },
  AP: { pac: { price: 44.90, days: 14 }, sedex: { price: 72.90, days: 8 } },
  RO: { pac: { price: 38.90, days: 12 }, sedex: { price: 62.90, days: 6 } },
  RR: { pac: { price: 46.90, days: 15 }, sedex: { price: 76.90, days: 8 } },
  AC: { pac: { price: 44.90, days: 14 }, sedex: { price: 72.90, days: 7 } },
};

const DEFAULT_FREIGHT = { pac: { price: 29.90, days: 10 }, sedex: { price: 48.90, days: 5 } };

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
