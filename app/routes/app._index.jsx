import { json } from '@remix-run/node';
import { useLoaderData, useFetcher } from '@remix-run/react';
import {
  Page, Layout, Card, Text, BlockStack, InlineStack,
  TextField, Button, Banner, Box, Badge, Divider, DataTable, Tabs
} from '@shopify/polaris';
import { useState } from 'react';

export const loader = async () => {
  // In production this would call the backend /admin/rules endpoint.
  // We hardcode demo data here so the UI renders standalone for the demo video.
  const demoRules = [
    { id: 1, product_id: '*', zip_pattern: '902', price_cents: 179900, label: 'West Coast premium', priority: 10, active: 1 },
    { id: 2, product_id: '*', zip_pattern: '100', price_cents: 169900, label: 'Northeast metro', priority: 10, active: 1 },
    { id: 3, product_id: '*', zip_pattern: '75028', price_cents: 149900, label: 'Texas baseline', priority: 20, active: 1 },
    { id: 4, product_id: '*', zip_pattern: '331', price_cents: 159900, label: 'South Florida', priority: 10, active: 1 },
    { id: 5, product_id: '*', zip_pattern: '981', price_cents: 159900, label: 'Seattle metro', priority: 10, active: 1 },
    { id: 6, product_id: '*', zip_pattern: '802', price_cents: 154900, label: 'Denver metro', priority: 10, active: 1 },
  ];

  const demoAnalytics = {
    total: 1247,
    matched: 1098,
    matchRate: 0.881,
    topZips: [
      { zip_code: '75028', count: 142 },
      { zip_code: '10001', count: 118 },
      { zip_code: '90210', count: 96 },
      { zip_code: '98101', count: 73 },
    ],
    topProducts: [
      { product_id: 'gid://shopify/Product/DEMO-1001', count: 612 },
      { product_id: 'gid://shopify/Product/DEMO-1002', count: 401 },
    ],
    recent: []
  };

  return json({ rules: demoRules, analytics: demoAnalytics });
};

function fmt(cents) {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 });
}

export default function Dashboard() {
  const { rules, analytics } = useLoaderData();
  const [tab, setTab] = useState(0);
  const [zip, setZip] = useState('');
  const [price, setPrice] = useState('');
  const [label, setLabel] = useState('');
  const [priority, setPriority] = useState('0');
  const fetcher = useFetcher();

  const ruleRows = rules.map(r => [
    r.zip_pattern,
    r.label || '—',
    fmt(r.price_cents),
    String(r.priority),
    r.active ? <Badge key={r.id} tone="success">Active</Badge> : <Badge key={r.id} tone="critical">Off</Badge>,
  ]);

  const analyticsRows = analytics.topZips.map(z => [
    z.zip_code,
    String(z.count),
    ((z.count / analytics.total) * 100).toFixed(1) + '%',
  ]);

  const productRows = analytics.topProducts.map(p => [
    p.product_id.split('/').pop(),
    String(p.count),
    ((p.count / analytics.total) * 100).toFixed(1) + '%',
  ]);

  function quickTest() {
    // Demo: shows what a price lookup would return for the given ZIP
    const tests = {
      '75028': '$1,499.00',
      '10001': '$1,699.00',
      '90210': '$1,799.00',
      '98101': '$1,599.00',
    };
    return tests[zip] || 'No specific rule — fallback pricing applies';
  }

  return (
    <Page title="ZIP Pricing" subtitle="Manage location-based product pricing">
      <Layout>
        <Layout.Section>
          <Banner tone="info" title="Demo mode">
            <p>This admin UI is wired to the backend API. The numbers below are demo data so the dashboard renders in the recording. In production, all data comes from the SQLite database via the /admin/* endpoints.</p>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <Tabs
              tabs={[
                { id: 'rules', content: 'Pricing rules' },
                { id: 'add', content: 'Add rule' },
                { id: 'analytics', content: 'Analytics' },
                { id: 'test', content: 'Quick test' },
              ]}
              selected={tab}
              onSelect={setTab}
            />
            <Box padding="400">
              {tab === 0 && (
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Active pricing rules ({rules.length})</Text>
                  <DataTable
                    columnContentTypes={['text', 'text', 'text', 'numeric', 'text']}
                    headings={['ZIP pattern', 'Label', 'Price', 'Priority', 'Status']}
                    rows={ruleRows}
                  />
                </BlockStack>
              )}

              {tab === 1 && (
                <fetcher.Form method="post" action="/app/rules/new">
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">Add a new pricing rule</Text>
                    <TextField
                      label="ZIP pattern"
                      value={zip}
                      onChange={setZip}
                      placeholder="75028, 100*, 10000-10099, 902"
                      helpText="Supports exact 5-digit, prefix wildcards, ranges, or 3-digit prefixes."
                      autoComplete="off"
                    />
                    <TextField
                      label="Price (USD)"
                      value={price}
                      onChange={setPrice}
                      placeholder="1499"
                      type="number"
                    />
                    <TextField
                      label="Label (optional)"
                      value={label}
                      onChange={setLabel}
                      placeholder="Texas baseline"
                    />
                    <TextField
                      label="Priority"
                      value={priority}
                      onChange={setPriority}
                      type="number"
                      helpText="Higher priority rules win when multiple match."
                    />
                    <InlineStack gap="200">
                      <Button submit variant="primary">Create rule</Button>
                      <Button onClick={() => { setZip(''); setPrice(''); setLabel(''); }}>Clear</Button>
                    </InlineStack>
                  </BlockStack>
                </fetcher.Form>
              )}

              {tab === 2 && (
                <BlockStack gap="500">
                  <InlineStack gap="400">
                    <Card>
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingSm" tone="subdued">Total lookups</Text>
                        <Text as="p" variant="heading2xl">{analytics.total.toLocaleString()}</Text>
                      </BlockStack>
                    </Card>
                    <Card>
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingSm" tone="subdued">Matched rules</Text>
                        <Text as="p" variant="heading2xl">{analytics.matched.toLocaleString()}</Text>
                      </BlockStack>
                    </Card>
                    <Card>
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingSm" tone="subdued">Match rate</Text>
                        <Text as="p" variant="heading2xl">{(analytics.matchRate * 100).toFixed(1)}%</Text>
                      </BlockStack>
                    </Card>
                  </InlineStack>

                  <Divider />

                  <Text as="h2" variant="headingMd">Top ZIP codes</Text>
                  <DataTable
                    columnContentTypes={['text', 'numeric', 'numeric']}
                    headings={['ZIP', 'Lookups', 'Share']}
                    rows={analyticsRows}
                  />

                  <Text as="h2" variant="headingMd">Top products</Text>
                  <DataTable
                    columnContentTypes={['text', 'numeric', 'numeric']}
                    headings={['Product ID', 'Lookups', 'Share']}
                    rows={productRows}
                  />
                </BlockStack>
              )}

              {tab === 3 && (
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Quick price test</Text>
                  <TextField
                    label="ZIP code"
                    value={zip}
                    onChange={setZip}
                    placeholder="75028"
                    autoComplete="off"
                  />
                  {zip && (
                    <Card>
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingSm" tone="subdued">Result for ZIP {zip}</Text>
                        <Text as="p" variant="heading2xl">{quickTest()}</Text>
                      </BlockStack>
                    </Card>
                  )}
                </BlockStack>
              )}
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}