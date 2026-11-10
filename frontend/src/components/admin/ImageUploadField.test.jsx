// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ImageUploadField from './ImageUploadField.jsx';
import { contentResources } from '../../pages/admin/contentResources.js';

let hadCreateObjectUrl;
let hadRevokeObjectUrl;

beforeEach(() => {
  hadCreateObjectUrl = Object.hasOwn(URL, 'createObjectURL');
  hadRevokeObjectUrl = Object.hasOwn(URL, 'revokeObjectURL');
  if (!hadCreateObjectUrl) {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:test-image') });
  } else {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-image');
  }
  if (!Object.hasOwn(URL, 'revokeObjectURL')) {
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  } else {
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (!hadCreateObjectUrl) delete URL.createObjectURL;
  if (!hadRevokeObjectUrl) delete URL.revokeObjectURL;
});

function renderUploader(props = {}) {
  const onChange = vi.fn();
  const onFileChange = vi.fn();
  const componentProps = {
    field: { name: 'imageUrl', label: 'Business area image' },
    value: null,
    file: null,
    onChange,
    onFileChange,
    uploadProgress: null,
    ...props,
  };
  const view = render(<ImageUploadField {...componentProps} />);
  return { onChange, onFileChange, rerender: (file) => view.rerender(<ImageUploadField {...componentProps} file={file} />) };
}

describe('ImageUploadField', () => {
  it('selects a supported image, previews it, and shows upload progress', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { onFileChange, rerender } = renderUploader({ uploadProgress: 42 });
    const file = new File(['image'], 'photo.webp', { type: 'image/webp' });

    await user.upload(screen.getByLabelText('Business area image'), file);

    expect(onFileChange).toHaveBeenCalledWith(file);
    expect(screen.getByRole('progressbar', { name: 'Uploading Business area image' })).toHaveProperty('value', 42);
    rerender(file);
    await waitFor(() => expect(screen.getByAltText('Business area image preview')).toBeInTheDocument());
  });

  it('rejects unsupported types and oversized files without calling file change', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { onFileChange } = renderUploader();
    await user.upload(
      screen.getByLabelText('Business area image'),
      new File(['svg'], 'vector.svg', { type: 'image/svg+xml' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a JPEG, PNG, or WebP image.');
    expect(onFileChange).not.toHaveBeenCalled();

    const largeFile = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Business area image'), largeFile);
    expect(screen.getByRole('alert')).toHaveTextContent('Images must be 5 MB or smaller.');
  });

  it('shows existing image when editing and supports replace and remove', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const managedPath = '/uploads/images/business-areas/123e4567-e89b-42d3-a456-426614174000.jpg';
    const { onChange, onFileChange } = renderUploader({ value: managedPath });
    expect(screen.getByAltText('Business area image preview')).toHaveAttribute(
      'src',
      `${window.location.origin}${managedPath}`,
    );

    await user.upload(
      screen.getByLabelText('Business area image'),
      new File(['image'], 'replacement.png', { type: 'image/png' }),
    );
    expect(onFileChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'replacement.png' }));
    await user.click(screen.getByRole('button', { name: 'Remove Image' }));
    expect(onFileChange).toHaveBeenLastCalledWith(null);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('provides safe fallbacks when existing image previews fail', () => {
    renderUploader({ value: 'https://cdn.example.test/unavailable.webp' });
    fireEvent.error(screen.getByAltText('Business area image preview'));
    expect(screen.getByText('Image preview unavailable')).toBeInTheDocument();
  });

  it('uses the shared uploader for all existing image-bearing CMS fields', () => {
    expect(contentResources['business-areas'].fields.find((field) => field.name === 'imageUrl').type).toBe('image');
    expect(contentResources.projects.fields.find((field) => field.name === 'imageUrl').type).toBe('image');
    expect(contentResources['blog-posts'].fields.find((field) => field.name === 'coverImageUrl').type).toBe('image');
    expect(contentResources['team-members'].fields.find((field) => field.name === 'photoUrl').type).toBe('image');
    expect(contentResources['team-members'].fields.map((field) => field.name)).toEqual([
      'name', 'role', 'photoUrl', 'portfolioUrl', 'photoPosition', 'status', 'sortOrder',
    ]);
    expect(contentResources['team-members'].fields.find((field) => field.name === 'portfolioUrl').type).toBe('url');
    expect(contentResources['team-members'].fields.find((field) => field.name === 'photoPosition').max).toBe(100);
    expect(contentResources['team-members'].fields.find((field) => field.name === 'photoUrl').previewAspectRatio).toBe('4 / 5');
    expect(contentResources.services.fields.some((field) => field.type === 'image')).toBe(false);
    expect(contentResources['academic-courses'].fields.some((field) => field.type === 'image')).toBe(false);
    expect(contentResources.testimonials.fields.some((field) => field.type === 'image')).toBe(false);
  });
});
