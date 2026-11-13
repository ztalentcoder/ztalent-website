import { useRef, useState } from 'react';
import MarkdownArticleContent from '../common/MarkdownArticleContent.jsx';
import { MAX_IMAGE_FILE_SIZE, SUPPORTED_IMAGE_TYPES } from './ImageUploadField.jsx';
import { uploadAdminImage } from '../../services/adminContentApi.js';
import styles from './MarkdownArticleEditor.module.css';

const toolbarItems = [
  { label: 'Heading', before: '## ', after: '', block: true },
  { label: 'Bold', before: '**', after: '**' },
  { label: 'Italic', before: '*', after: '*' },
  { label: 'Link', before: '[link text](', after: ')' },
  { label: 'Bulleted list', before: '- ', after: '', block: true },
  { label: 'Numbered list', before: '1. ', after: '', block: true },
  { label: 'Quote', before: '> ', after: '', block: true },
  { label: 'Code block', before: '```\n', after: '\n```', block: true },
];

export default function MarkdownArticleEditor({ value, onChange, onImageUploaded, required = false }) {
  const editorRef = useRef(null);
  const fileRef = useRef(null);
  const [activeTab, setActiveTab] = useState('write');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  function insertText(before, after = '', block = false) {
    const editor = editorRef.current;
    const content = String(value ?? '');
    const start = editor?.selectionStart ?? content.length;
    const end = editor?.selectionEnd ?? start;
    const selected = content.slice(start, end);
    const prefix = block && start > 0 && content[start - 1] !== '\n' ? '\n' : '';
    const suffix = block && end < content.length && content[end] !== '\n' ? '\n' : '';
    const insertion = `${prefix}${before}${selected || (after ? 'text' : '')}${after}${suffix}`;
    const next = `${content.slice(0, start)}${insertion}${content.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      editor?.focus();
      const cursor = start + insertion.length - suffix.length;
      editor?.setSelectionRange(cursor, cursor);
    });
  }

  async function uploadImage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
      setError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_IMAGE_FILE_SIZE) {
      setError('Images must be 5 MB or smaller.');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const image = await uploadAdminImage('blog-posts', file);
      if (!image?.url) throw new Error('The image upload did not return an image URL.');
      onImageUploaded(image.url);
      insertText(`![${file.name.replace(/\.[^.]+$/, '')}](${image.url})`, '', true);
    } catch (uploadError) {
      setError(uploadError.message || 'The image could not be uploaded.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={styles.editor}>
      <div className={styles.toolbar} role="toolbar" aria-label="Article formatting">
        {toolbarItems.map((item) => (
          <button key={item.label} type="button" onClick={() => insertText(item.before, item.after, item.block)}>
            {item.label}
          </button>
        ))}
        <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? 'Uploading image…' : 'Insert image'}
        </button>
        <input
          ref={fileRef}
          className={styles.fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={uploadImage}
          aria-label="Upload an article image"
        />
      </div>
      <div className={styles.tabs} role="tablist" aria-label="Article editor mode">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'write'}
          onClick={() => setActiveTab('write')}
        >Write</button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'preview'}
          onClick={() => setActiveTab('preview')}
        >Preview</button>
      </div>
      {activeTab === 'write'
        ? (
          <textarea
            ref={editorRef}
            className={styles.textarea}
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value)}
            rows={18}
            required={required}
            aria-label="Article content in Markdown"
          />
        )
        : <div className={styles.preview}><MarkdownArticleContent markdown={value} /></div>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <p className={styles.help}>Supports headings, lists, quotes, links, images, and fenced code blocks. Raw HTML is not rendered.</p>
    </div>
  );
}
