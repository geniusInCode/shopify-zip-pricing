import { json } from '@remix-run/node';
import { authenticate } from '../shopify.server';

export const action = async ({ request }) => {
  await authenticate.admin(request);
  const form = await request.formData();
  const rule = {
    zip: form.get('zip'),
    price: form.get('price'),
    label: form.get('label'),
    priority: form.get('priority') || '0',
  };

  // Forward to backend
  const backend = process.env.BACKEND_URL || 'http://localhost:3000';
  try {
    const resp = await fetch(`${backend}/admin/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: '*',
        zipPattern: rule.zip,
        priceCents: Math.round(parseFloat(rule.price) * 100),
        label: rule.label,
        priority: parseInt(rule.priority, 10),
        active: true,
      }),
    });
    const data = await resp.json();
    return json(data);
  } catch (e) {
    return json({ ok: false, error: e.message }, { status: 500 });
  }
};

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return json({ ok: true });
};