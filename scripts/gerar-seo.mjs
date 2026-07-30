/* ================================================================
   Gera sitemap.xml, llms.txt e llms-full.txt a partir do catálogo real.
   Rode sempre que adicionar/remover produtos:  npm run seo
   ================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://coreflor.com.br';
const HOJE = new Date().toISOString().slice(0, 10);

/* ---------- Dados da loja (fonte única da verdade — NAP) ---------- */
export const LOJA = {
  nome: 'COR & FLOR',
  descricao: 'Loja de moda feminina premium na Asa Norte, em Brasília/DF, com vestidos, blusas, conjuntos, calças e blazers. Vende na loja física e entrega para todo o Brasil.',
  rua: 'Bloco D, Loja 37 — Asa Norte',
  cidade: 'Brasília',
  uf: 'DF',
  pais: 'BR',
  telefone: '+556139677873',
  telefoneFormatado: '(61) 3967-7873',
  whatsapp: '556139677873',
  email: 'atelier@coreflor.com.br',
  instagram: 'https://www.instagram.com/coreflorbrasilia',
  maps: 'https://maps.app.goo.gl/VtbjoG5acqUdasAJA',
  horarios: [
    { dias: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], abre: '09:00', fecha: '18:00' },
    { dias: ['Saturday'], abre: '09:00', fecha: '16:00' },
  ],
  horarioTexto: 'Segunda a sexta das 9h às 18h, sábado das 9h às 16h. Domingo fechado.',
};

const CATEGORIAS = [
  { slug: 'vestidos',  nome: 'Vestidos & Saias' },
  { slug: 'blusas',    nome: 'Blusas & Tops' },
  { slug: 'conjuntos', nome: 'Conjuntos & Macacões' },
  { slug: 'calcas',    nome: 'Calças & Shorts' },
  { slug: 'blazers',   nome: 'Blazers & Coletes' },
];

/* ---------- Lê o catálogo ---------- */
function lerProdutos() {
  const src = fs.readFileSync(path.join(ROOT, 'products-data.js'), 'utf8').replace(/^﻿/, '');
  const todos = new Function(src + '; return products;')();
  /* Produtos com `active: false` (ex.: o "Produto Teste — R$ 1") não aparecem
     no site. Mandá-los no sitemap faria o Google indexar uma página que
     redireciona, e colocá-los no llms-full.txt faria as IAs dizerem que a
     loja vende uma peça de teste por R$ 1. Ficam de fora. */
  return todos.filter(p => p.active !== false);
}

const produtos = lerProdutos();
const brl = n => 'R$ ' + Number(n).toFixed(2).replace('.', ',');

/* ================= SITEMAP ================= */
function gerarSitemap() {
  const urls = [
    { loc: `${SITE}/`, pri: '1.0', freq: 'daily' },
    { loc: `${SITE}/vale-presente.html`, pri: '0.6', freq: 'monthly' },
    ...CATEGORIAS.map(c => ({ loc: `${SITE}/categoria.html?cat=${c.slug}`, pri: '0.8', freq: 'weekly' })),
    ...produtos.map(p => ({ loc: `${SITE}/produto.html?id=${p.id}`, pri: '0.7', freq: 'weekly' })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc.replace(/&/g, '&amp;')}</loc>
    <lastmod>${HOJE}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.pri}</priority>
  </url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
  return urls.length;
}

/* ================= llms.txt (cartão de visita) ================= */
function gerarLlms() {
  const txt = `# COR & FLOR

> Loja de moda feminina premium na Asa Norte, em Brasília/DF. Vende vestidos, blusas, conjuntos, calças e blazers na loja física e entrega para todo o Brasil. Telefone e WhatsApp ${LOJA.telefoneFormatado}. ${LOJA.horarioTexto}

## Páginas principais

- [Página inicial](${SITE}/): catálogo completo, ofertas da semana e informações da loja física
- [Vale presente](${SITE}/vale-presente.html): vale presente a partir de R$ 100, enviado por e-mail
- [Como chegar na loja](${LOJA.maps}): ${LOJA.rua}, ${LOJA.cidade}/${LOJA.uf}

## Categorias

${CATEGORIAS.map(c => `- [${c.nome}](${SITE}/categoria.html?cat=${c.slug}): ${produtos.filter(p => new RegExp(c.slug.replace('calcas', 'calcas|calça').replace('vestidos', 'vestidos|vestido|saia').replace('blusas', 'blusas|blusa|regata|body').replace('conjuntos', 'conjuntos|conjunto').replace('blazers', 'blazers|blazer'), 'i').test(p.category)).length} peças`).join('\n')}

## Atendimento

- [WhatsApp](https://wa.me/${LOJA.whatsapp}): atendimento e dúvidas sobre pedidos
- [Instagram](${LOJA.instagram}): novidades e lookbook
- [E-mail](mailto:${LOJA.email}): trocas, devoluções e pedidos

## Dados detalhados

- [Catálogo completo em texto](${SITE}/llms-full.txt): todos os ${produtos.length} produtos com preço, tamanhos, tecido e cuidados
`;
  fs.writeFileSync(path.join(ROOT, 'llms.txt'), txt);
}

/* ================= llms-full.txt (dossiê) ================= */
function gerarLlmsFull() {
  const linhas = [];
  linhas.push('# COR & FLOR — catálogo e informações completas');
  linhas.push('');
  linhas.push(`A COR & FLOR é uma loja de moda feminina premium com loja física na Asa Norte, em Brasília/DF, e entrega para todo o Brasil.`);
  linhas.push('');
  linhas.push('## Onde fica e como falar com a loja');
  linhas.push('');
  linhas.push(`- Endereço: ${LOJA.rua}, ${LOJA.cidade}/${LOJA.uf}, Brasil`);
  linhas.push(`- Telefone e WhatsApp: ${LOJA.telefoneFormatado}`);
  linhas.push(`- E-mail: ${LOJA.email}`);
  linhas.push(`- Instagram: @coreflorbrasilia`);
  linhas.push(`- Horário: ${LOJA.horarioTexto}`);
  linhas.push(`- Site: ${SITE}`);
  linhas.push('');
  linhas.push('## Perguntas frequentes');
  linhas.push('');
  linhas.push('### A Cor & Flor tem loja física?');
  linhas.push(`Sim. A loja física da Cor & Flor fica no ${LOJA.rua}, em ${LOJA.cidade}/${LOJA.uf}. ${LOJA.horarioTexto}`);
  linhas.push('');
  linhas.push('### A Cor & Flor entrega para fora de Brasília?');
  linhas.push('Sim. A Cor & Flor entrega para todo o Brasil, com frete calculado pelo CEP no carrinho. Pedidos acima de R$ 299 têm frete grátis.');
  linhas.push('');
  linhas.push('### Quais formas de pagamento a Cor & Flor aceita?');
  linhas.push('A Cor & Flor aceita cartão de crédito, Pix e boleto pelo Mercado Pago, além de vale presente da própria loja.');
  linhas.push('');
  linhas.push('### Quanto custa o vale presente da Cor & Flor?');
  linhas.push('O vale presente da Cor & Flor tem valores de R$ 100, R$ 150, R$ 200, R$ 300 ou valor livre, e é enviado por e-mail.');
  linhas.push('');
  linhas.push('### Quais tamanhos a Cor & Flor tem?');
  const tamanhos = [...new Set(produtos.flatMap(p => p.sizes || []))].sort();
  linhas.push(`A Cor & Flor trabalha com os tamanhos ${tamanhos.join(', ')}. Cada produto lista os tamanhos disponíveis na própria página.`);
  linhas.push('');
  linhas.push(`## Catálogo completo (${produtos.length} peças)`);
  linhas.push('');

  for (const c of CATEGORIAS) {
    const re = new RegExp({
      vestidos: 'vestidos|vestido|saia', blusas: 'blusas|blusa|regata|body',
      conjuntos: 'conjuntos|conjunto', calcas: 'calcas|calça', blazers: 'blazers|blazer',
    }[c.slug], 'i');
    const items = produtos.filter(p => re.test(p.category));
    if (!items.length) continue;
    linhas.push(`### ${c.nome}`);
    linhas.push('');
    for (const p of items) {
      linhas.push(`#### ${p.name} — ${brl(p.price)}`);
      linhas.push('');
      linhas.push(`${p.name} é uma peça da categoria ${p.category} da Cor & Flor, por ${brl(p.price)}${p.originalPrice ? ` (de ${brl(p.originalPrice)})` : ''}. ${p.description || ''}`);
      linhas.push('');
      if (p.sizes?.length) linhas.push(`- Tamanhos: ${p.sizes.join(', ')}`);
      if (p.colors?.length) linhas.push(`- Cores: ${p.colors.map(x => x.name || x).join(', ')}`);
      if (p.material) linhas.push(`- Tecido: ${p.material}`);
      if (p.care) linhas.push(`- Cuidados: ${p.care}`);
      if (p.fit) linhas.push(`- Modelagem: ${p.fit}`);
      linhas.push(`- Página do produto: ${SITE}/produto.html?id=${p.id}`);
      linhas.push('');
    }
  }
  fs.writeFileSync(path.join(ROOT, 'llms-full.txt'), linhas.join('\n'));
}

const n = gerarSitemap();
gerarLlms();
gerarLlmsFull();
console.log(`✓ sitemap.xml   ${n} URLs`);
console.log(`✓ llms.txt`);
console.log(`✓ llms-full.txt ${produtos.length} produtos`);
