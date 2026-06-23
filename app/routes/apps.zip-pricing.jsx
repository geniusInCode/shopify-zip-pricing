import { authenticate } from '../shopify.server';

export default function AppBridgeBridge() {
  return null;
}

export const loader = async ({ request }) => {
  await authenticate.public.appProxy(request);
  return null;
};