// lib/order-email.js — E-mails de pedido via Resend (https://resend.com)
// Variáveis de ambiente necessárias na Vercel:
//   RESEND_API_KEY     — chave da API do Resend (obrigatória para enviar)
//   EMAIL_FROM         — remetente, ex: "Cor & Flor <pedidos@modacoreflor.com.br>"
//   ORDER_NOTIFY_EMAIL — e-mail da loja que recebe aviso de novo pedido (opcional)

const BRL = n => 'R$ ' + Number(n || 0).toFixed(2).replace('.', ',');
const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[email] RESEND_API_KEY não configurada — e-mail não enviado');
    return false;
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Cor & Flor <onboarding@resend.dev>',
        to,
        subject,
        html,
      }),
    });
    if (!r.ok) console.error('[email] erro ao enviar:', await r.text());
    return r.ok;
  } catch (err) {
    console.error('[email] exceção:', err);
    return false;
  }
}

function orderEmailHtml(order, shortId, approved) {
  const itemsRows = (order.items || []).map(i => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f3e2ea;font-size:14px;color:#1C1414">
        ${esc(i.name)}${i.size ? ` <span style="color:#8a7d7d">· Tam ${esc(i.size)}</span>` : ''}
        <span style="color:#8a7d7d">× ${i.qty}</span>
      </td>
      <td align="right" style="padding:10px 0;border-bottom:1px solid #f3e2ea;font-size:14px;color:#1C1414;white-space:nowrap">
        ${BRL(i.price * i.qty)}
      </td>
    </tr>`).join('');

  const addr = order.address || {};
  const addressHtml = addr.rua ? `
    <p style="margin:4px 0 0;font-size:13px;color:#4A4040;line-height:1.6">
      ${esc(addr.rua)}, ${esc(addr.num)}${addr.comp ? ` — ${esc(addr.comp)}` : ''}<br>
      ${esc(addr.bairro)} · ${esc(addr.cidade)}/${esc(addr.estado)} · CEP ${esc(addr.cep)}
    </p>` : '';

  const statusMsg = approved
    ? 'Seu pagamento foi <strong style="color:#2e7d4f">aprovado</strong> e já estamos preparando o seu pedido com todo carinho.'
    : 'Seu pagamento está <strong style="color:#b8860b">em análise</strong>. Assim que for aprovado, começamos a preparar o seu pedido.';

  return `
  <div style="background:#FDF8F5;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#9B3068,#D4679A);padding:32px 24px;text-align:center">
        <p style="margin:0;font-size:24px;letter-spacing:4px;color:#ffffff;font-weight:bold">COR &amp; FLOR</p>
        <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,.85)">moda feminina que floresce ✿</p>
      </div>
      <div style="padding:28px 28px 8px">
        <h1 style="margin:0 0 6px;font-size:22px;color:#1C1414">Pedido confirmado! 🌸</h1>
        <p style="margin:0 0 4px;font-size:14px;color:#4A4040">Olá, <strong>${esc(order.customer_name)}</strong>!</p>
        <p style="margin:0 0 18px;font-size:14px;color:#4A4040;line-height:1.6">${statusMsg}</p>
        <div style="background:#FDF8F5;border-radius:10px;padding:12px 16px;margin-bottom:18px">
          <p style="margin:0;font-size:12px;color:#8a7d7d;text-transform:uppercase;letter-spacing:1px">Número do pedido</p>
          <p style="margin:2px 0 0;font-size:20px;color:#9B3068;font-weight:bold;letter-spacing:2px">#${esc(shortId)}</p>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px">
          ${itemsRows}
          <tr>
            <td style="padding:10px 0 2px;font-size:13px;color:#8a7d7d">Subtotal</td>
            <td align="right" style="padding:10px 0 2px;font-size:13px;color:#4A4040">${BRL(order.subtotal)}</td>
          </tr>
          ${Number(order.discount) > 0 ? `
          <tr>
            <td style="padding:2px 0;font-size:13px;color:#8a7d7d">Desconto${order.coupon_code ? ` (${esc(order.coupon_code)})` : ''}</td>
            <td align="right" style="padding:2px 0;font-size:13px;color:#2e7d4f">− ${BRL(order.discount)}</td>
          </tr>` : ''}
          <tr>
            <td style="padding:2px 0;font-size:13px;color:#8a7d7d">Frete${order.freight_service ? ` (${esc(order.freight_service)})` : ''}</td>
            <td align="right" style="padding:2px 0;font-size:13px;color:#4A4040">${Number(order.freight) > 0 ? BRL(order.freight) : 'Grátis ✿'}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;font-size:16px;color:#1C1414;font-weight:bold;border-top:1px solid #f3e2ea">Total</td>
            <td align="right" style="padding:10px 0;font-size:18px;color:#9B3068;font-weight:bold;border-top:1px solid #f3e2ea">${BRL(order.total)}</td>
          </tr>
        </table>
        ${addressHtml ? `
        <p style="margin:14px 0 0;font-size:12px;color:#8a7d7d;text-transform:uppercase;letter-spacing:1px">Endereço de entrega</p>
        ${addressHtml}` : ''}
      </div>
      <div style="padding:20px 28px 28px">
        <p style="margin:0;font-size:12px;color:#8a7d7d;line-height:1.7">
          Qualquer dúvida, é só responder este e-mail ou chamar a gente no Instagram
          <a href="https://www.instagram.com/coreflorbrasilia" style="color:#9B3068">@coreflorbrasilia</a>.<br>
          Obrigada por florescer com a gente! ✿
        </p>
      </div>
    </div>
  </div>`;
}

// Envia confirmação para a cliente + aviso de novo pedido para a loja
async function sendOrderEmails(order, shortId, approved) {
  if (order.customer_email) {
    await sendEmail({
      to: order.customer_email,
      subject: approved
        ? `Pedido confirmado! 🌸 #${shortId} — Cor & Flor`
        : `Pedido recebido — pagamento em análise · #${shortId} — Cor & Flor`,
      html: orderEmailHtml(order, shortId, approved),
    });
  }

  const notify = process.env.ORDER_NOTIFY_EMAIL;
  if (notify) {
    await sendEmail({
      to: notify,
      subject: `🛍️ Novo pedido #${shortId} — ${BRL(order.total)} — ${order.customer_name}`,
      html: orderEmailHtml(order, shortId, approved),
    });
  }
}

module.exports = { sendOrderEmails };
