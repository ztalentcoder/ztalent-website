import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp, createPrismaStub, withServer } from './helpers.js';

const validPayload = {
  name: 'Example Organization',
  email: 'person@example.com',
  phone: '+255 123 456',
  topic: 'GENERAL_QUESTION',
  message: 'Please contact me about your services.',
};

function createContactTestApp(create = async () => ({ id: 'test-id' }), options = {}) {
  return createApp({
    prismaClient: {
      ...createPrismaStub(),
      contactMessage: { create },
    },
    ...options,
  });
}

async function postContact(baseUrl, body, headers = {}) {
  return fetch(`${baseUrl}/api/contact`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test('valid contact submission returns HTTP 201 and passes normalized data to Prisma', async () => {
  let createArgs;
  const app = createContactTestApp(async (args) => {
    createArgs = args;
    return { id: 'private-id' };
  });

  await withServer(app, async (baseUrl) => {
    const response = await postContact(baseUrl, {
      ...validPayload,
      name: '  Example Organization  ',
      email: '  Person@Example.COM  ',
      phone: '  +255 123 456  ',
      message: '  Please contact me about your services.  ',
    });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      status: 'received',
      message: 'Thank you. We will get back to you soon.',
    });
    assert.deepEqual(createArgs, {
      data: {
        name: 'Example Organization',
        email: 'person@example.com',
        phone: '+255 123 456',
        topic: 'GENERAL_QUESTION',
        message: 'Please contact me about your services.',
        status: 'NEW',
      },
    });
  });
});

test('empty optional phone is stored as null', async () => {
  let createArgs;
  const app = createContactTestApp(async (args) => {
    createArgs = args;
    return {};
  });

  await withServer(app, async (baseUrl) => {
    const response = await postContact(baseUrl, { ...validPayload, phone: '  ' });

    assert.equal(response.status, 201);
    assert.equal(createArgs.data.phone, null);
    assert.equal(createArgs.data.status, 'NEW');
  });
});

test('phone must be a string when provided', async () => {
  const app = createContactTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await postContact(baseUrl, { ...validPayload, phone: null });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
  });
});

test('missing required fields return HTTP 400', async () => {
  const app = createContactTestApp();

  await withServer(app, async (baseUrl) => {
    for (const field of ['name', 'email', 'topic', 'message']) {
      const payload = { ...validPayload };
      delete payload[field];
      const response = await postContact(baseUrl, payload);
      const body = await response.json();

      assert.equal(response.status, 400, `${field} should be required`);
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    }
  });
});

test('malformed email addresses return HTTP 400', async (t) => {
  const invalidEmails = [
    'not-an-email',
    'user@domain..com',
    'user@.domain.com',
    'user@domain.com.',
    'user@-domain.com',
    'user@domain-.com',
  ];
  const app = createContactTestApp(async () => ({}), {
    contactRateLimit: { limit: invalidEmails.length, windowMs: 60_000 },
  });

  await withServer(app, async (baseUrl) => {
    for (const email of invalidEmails) {
      await t.test(email, async () => {
        const response = await postContact(baseUrl, { ...validPayload, email });
        assert.equal(response.status, 400);
        assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
      });
    }
  });
});

test('plus-addresses and normal subdomains are accepted and normalized', async () => {
  let storedData;
  const app = createContactTestApp(async ({ data }) => {
    storedData = data;
    return {};
  });

  await withServer(app, async (baseUrl) => {
    const response = await postContact(baseUrl, {
      ...validPayload,
      email: '  First.Last+tag@sub.example.com  ',
    });

    assert.equal(response.status, 201);
    assert.equal(storedData.email, 'first.last+tag@sub.example.com');
  });
});

test('invalid topic returns HTTP 400', async () => {
  const app = createContactTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await postContact(baseUrl, { ...validPayload, topic: 'NOT_A_TOPIC' });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
  });
});

test('name length over 160 characters is rejected', async () => {
  const app = createContactTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await postContact(baseUrl, { ...validPayload, name: 'n'.repeat(161) });
    assert.equal(response.status, 400);
  });
});

test('email length over 320 characters is rejected', async () => {
  const app = createContactTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await postContact(baseUrl, {
      ...validPayload,
      email: `${'a'.repeat(315)}@b.com`,
    });
    assert.equal(response.status, 400);
  });
});

test('phone length over 32 characters is rejected', async () => {
  const app = createContactTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await postContact(baseUrl, { ...validPayload, phone: '1'.repeat(33) });
    assert.equal(response.status, 400);
  });
});

test('empty message after trimming returns HTTP 400', async () => {
  const app = createContactTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await postContact(baseUrl, { ...validPayload, message: '   ' });
    assert.equal(response.status, 400);
  });
});

test('message over 5,000 characters is rejected', async () => {
  const app = createContactTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await postContact(baseUrl, { ...validPayload, message: 'm'.repeat(5001) });
    assert.equal(response.status, 400);
  });
});

test('maximum allowed field lengths are accepted', async () => {
  const maximumEmail = `${'a'.repeat(308)}@example.com`;
  assert.equal(maximumEmail.length, 320);
  const app = createContactTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await postContact(baseUrl, {
      name: 'n'.repeat(160),
      email: maximumEmail,
      phone: '1'.repeat(32),
      topic: 'GENERAL_QUESTION',
      message: 'm'.repeat(5000),
    });

    assert.equal(response.status, 201);
  });
});

test('every supported contact topic is accepted', async () => {
  const topics = [
    'GENERAL_QUESTION',
    'REQUEST_SYSTEM',
    'REQUEST_DATA_SERVICE',
    'COURSE_QUESTION',
  ];
  const app = createContactTestApp(async () => ({}), {
    contactRateLimit: { limit: topics.length, windowMs: 60_000 },
  });

  await withServer(app, async (baseUrl) => {
    for (const topic of topics) {
      const response = await postContact(baseUrl, { ...validPayload, topic });
      assert.equal(response.status, 201, `${topic} should be accepted`);
    }
  });
});

test('unexpected request properties are rejected', async () => {
  const app = createContactTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await postContact(baseUrl, { ...validPayload, isAdmin: true });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
  });
});

test('database insertion failure returns generic 500 without exposing diagnostics or PII', async () => {
  const diagnostic = 'database-password-and-internal-detail';
  const personalEmail = 'private-person@example.com';
  const app = createContactTestApp(async () => {
    throw new Error(diagnostic);
  });
  const originalError = console.error;
  let loggedOutput = '';
  console.error = (...values) => { loggedOutput += values.join(' '); };

  try {
    await withServer(app, async (baseUrl) => {
      const response = await postContact(baseUrl, { ...validPayload, email: personalEmail });
      const body = await response.text();

      assert.equal(response.status, 500);
      assert.deepEqual(JSON.parse(body), {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred.',
        },
      });
      assert.equal(body.includes(diagnostic), false);
      assert.equal(body.includes(personalEmail), false);
      assert.equal(loggedOutput.includes(diagnostic), false);
      assert.equal(loggedOutput.includes(personalEmail), false);
    });
  } finally {
    console.error = originalError;
  }
});

test('contact endpoint limits submissions to five per IP and sends standard rate-limit headers', async () => {
  const app = createContactTestApp(async () => ({}), {
    contactRateLimit: { limit: 5, windowMs: 60_000 },
  });
  assert.equal(app.get('trust proxy'), false);

  await withServer(app, async (baseUrl) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await postContact(baseUrl, validPayload);
      assert.ok(response.headers.get('ratelimit'));
      assert.equal(response.status, 201);
    }

    const limited = await postContact(baseUrl, validPayload);
    const body = await limited.json();

    assert.equal(limited.status, 429);
    assert.equal(body.error.code, 'RATE_LIMITED');
    assert.ok(limited.headers.get('ratelimit'));
    assert.equal(limited.headers.get('x-ratelimit-limit'), null);
  });
});

test('production rate limit defaults to five requests per IP per 15 minutes', async () => {
  const app = createContactTestApp();
  assert.equal(app.get('trust proxy'), false);

  await withServer(app, async (baseUrl) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await postContact(baseUrl, validPayload);
      assert.equal(response.status, 201);
    }

    const limited = await postContact(baseUrl, validPayload);
    assert.equal(limited.status, 429);
    assert.match(limited.headers.get('ratelimit-policy'), /q=5;\s*w=900/);
  });
});

test('spoofed X-Forwarded-For values cannot bypass the per-IP rate limit', async () => {
  const app = createContactTestApp(async () => ({}), {
    contactRateLimit: { limit: 2, windowMs: 60_000 },
  });
  assert.equal(app.get('trust proxy'), false);

  await withServer(app, async (baseUrl) => {
    const first = await postContact(baseUrl, validPayload, {
      'X-Forwarded-For': '198.51.100.10',
    });
    const second = await postContact(baseUrl, validPayload, {
      'X-Forwarded-For': '203.0.113.20',
    });
    const third = await postContact(baseUrl, validPayload, {
      'X-Forwarded-For': '192.0.2.30',
    });

    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(third.status, 429);
  });
});
