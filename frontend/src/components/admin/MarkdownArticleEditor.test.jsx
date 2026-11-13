// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MarkdownArticleEditor from './MarkdownArticleEditor.jsx';

const mocks = vi.hoisted(() => ({ uploadAdminImage: vi.fn() }));
vi.mock('../../services/adminContentApi.js', () => ({ uploadAdminImage: mocks.uploadAdminImage }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('MarkdownArticleEditor', () => {
  it('inserts toolbar formatting and renders a safe preview', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<MarkdownArticleEditor value="Plain text" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Bold' }));
    expect(onChange).toHaveBeenCalledWith('**text**Plain text');

    rerender(<MarkdownArticleEditor value={'## Heading\n\n<script>alert(1)</script>'} onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: 'Preview' }));
    expect(screen.getByRole('heading', { name: 'Heading' })).toBeInTheDocument();
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(document.body.querySelector('script')).not.toBeInTheDocument();
  });

  it('uploads supported local images and inserts their managed URL', async () => {
    const onChange = vi.fn();
    const onImageUploaded = vi.fn();
    mocks.uploadAdminImage.mockResolvedValue({
      url: '/uploads/images/blog/12345678-1234-4123-8123-123456789012.png',
    });
    render(
      <MarkdownArticleEditor
        value=""
        onChange={onChange}
        onImageUploaded={onImageUploaded}
      />,
    );
    const file = new File(['image'], 'dashboard.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Upload an article image'), { target: { files: [file] } });

    expect(await screen.findByRole('button', { name: 'Insert image' })).toBeInTheDocument();
    expect(mocks.uploadAdminImage).toHaveBeenCalledWith('blog-posts', file);
    expect(onImageUploaded).toHaveBeenCalledWith('/uploads/images/blog/12345678-1234-4123-8123-123456789012.png');
    expect(onChange).toHaveBeenCalledWith(
      '![dashboard](/uploads/images/blog/12345678-1234-4123-8123-123456789012.png)',
    );
  });

  it('rejects unsupported image formats before upload', async () => {
    render(<MarkdownArticleEditor value="" onChange={vi.fn()} onImageUploaded={vi.fn()} />);
    const file = new File(['image'], 'photo.gif', { type: 'image/gif' });
    fireEvent.change(screen.getByLabelText('Upload an article image'), { target: { files: [file] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a JPEG, PNG, or WebP image.');
    expect(mocks.uploadAdminImage).not.toHaveBeenCalled();
  });
});
