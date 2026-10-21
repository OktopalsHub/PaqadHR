import assert from 'node:assert/strict';
import test from 'node:test';
import { companySameAs } from '@/lib/constants/company';
import { LANDING_PRICING_BY_CURRENCY } from '@/lib/constants/plan-catalog';
import { faqPageSchema, organizationSchema, planOffers, webPageSchema } from './site-schema';

test('plan offers publish real prices in both currencies', () => {
  const offers = planOffers();

  assert.equal(offers.length, 6);
  assert.deepEqual([...new Set(offers.map((offer) => offer.priceCurrency))].sort(), ['NGN', 'USD']);
  for (const offer of offers) {
    assert.ok(offer.price > 0, `${offer.name} must have a positive price`);
    assert.equal(offer.url, 'https://paqadhr.com/pricing');
  }

  const usdStarter = offers.find((offer) => offer.name === 'Starter plan (USD)');
  assert.ok(usdStarter);
  assert.equal(usdStarter.price, LANDING_PRICING_BY_CURRENCY.USD[0].pricePerSeat);
});

test('organization schema never publishes an empty sameAs entry', () => {
  const schema = organizationSchema();
  const sameAs = (schema.sameAs as string[] | undefined) ?? [];

  assert.deepEqual(sameAs, companySameAs());
  assert.ok(sameAs.every((url) => url.startsWith('https://')));
  assert.equal(schema.url, 'https://paqadhr.com');
});

test('faq schema mirrors the visible questions', () => {
  const schema = faqPageSchema([{ question: 'Is payroll included?', answer: 'Yes.' }]);
  const mainEntity = schema.mainEntity as Array<Record<string, unknown>>;

  assert.equal(mainEntity.length, 1);
  assert.equal(mainEntity[0].name, 'Is payroll included?');
  assert.deepEqual(mainEntity[0].acceptedAnswer, {
    '@type': 'Answer',
    text: 'Yes.',
  });
});

test('web page schema uses absolute URLs and the review date', () => {
  const schema = webPageSchema({
    path: '/pricing',
    name: 'Pricing',
    description: 'Plans',
    updated: '2026-10-20',
  });

  assert.equal(schema.url, 'https://paqadhr.com/pricing');
  assert.equal(schema.dateModified, '2026-10-20');
  assert.deepEqual(schema.isPartOf, { '@id': 'https://paqadhr.com/#website' });
});
