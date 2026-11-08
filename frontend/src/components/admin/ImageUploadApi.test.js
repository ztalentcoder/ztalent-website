// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { uploadAdminImage } from '../../services/adminContentApi.js';

class MockXMLHttpRequest {
  static instances = [];

  upload = { addEventListener: vi.fn((name, handler) => { this.upload[name] = handler; }) };

  handlers = {};

  constructor() {
    MockXMLHttpRequest.instances.push(this);
  }

  addEventListener(name, handler) {
    this.handlers[name] = handler;
  }

  open(method, url) {
    this.method = method;
    this.url = url;
  }

  send(body) {
    this.body = body;
    this.status = MockXMLHttpRequest.status;
    this.responseText = MockXMLHttpRequest.responseText;
    if (MockXMLHttpRequest.triggerProgress) {
      this.upload.progress?.({ lengthComputable: true, loaded: 25, total: 100 });
    }
    this.handlers.load();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  MockXMLHttpRequest.instances = [];
});

describe('uploadAdminImage', () => {
  it('sends multipart data with credentials and reports upload progress', async () => {
    MockXMLHttpRequest.status = 201;
    MockXMLHttpRequest.responseText = JSON.stringify({
      image: { url: '/uploads/images/business-areas/123e4567-e89b-42d3-a456-426614174000.webp', format: 'webp', bytes: 42 },
    });
    MockXMLHttpRequest.triggerProgress = true;
    vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest);
    const progress = vi.fn();

    const image = await uploadAdminImage('business-areas', new File(['image'], 'area.webp', { type: 'image/webp' }), progress);
    const request = MockXMLHttpRequest.instances[0];

    expect(image.format).toBe('webp');
    expect(progress).toHaveBeenCalledWith(25);
    expect(request.method).toBe('POST');
    expect(request.url).toContain('/api/admin/images/business-areas');
    expect(request.withCredentials).toBe(true);
    expect(request.body.get('image').name).toBe('area.webp');
  });

  it('rejects upload failures with the backend validation message', async () => {
    MockXMLHttpRequest.status = 400;
    MockXMLHttpRequest.responseText = JSON.stringify({ error: { code: 'INVALID_IMAGE_CONTENT', message: 'Invalid image.' } });
    MockXMLHttpRequest.triggerProgress = false;
    vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest);

    await expect(uploadAdminImage('projects', new File(['bad'], 'bad.png', { type: 'image/png' })))
      .rejects.toMatchObject({ code: 'INVALID_IMAGE_CONTENT', message: 'Invalid image.' });
  });
});
