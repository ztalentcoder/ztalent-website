import { useEffect, useRef, useState } from 'react';
import { getPublicImageUrl } from '../../services/publicContentApi.js';
import styles from './ImageUploadField.module.css';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export default function ImageUploadField({
  field,
  value,
  file,
  onChange,
  onFileChange,
  uploadProgress,
}) {
  const inputRef = useRef(null);
  const [previewError, setPreviewError] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [localPreview, setLocalPreview] = useState('');

  useEffect(() => {
    if (!file) {
      setLocalPreview('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => setPreviewError(false), [value, file]);

  const preview = file ? localPreview : getPublicImageUrl(value) || '';
  const showPreview = preview && !previewError;

  function chooseFile(event) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    if (!SUPPORTED_TYPES.has(selected.type)) {
      setValidationError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setValidationError('Images must be 5 MB or smaller.');
      return;
    }
    setValidationError('');
    onFileChange(selected);
  }

  function removeImage() {
    setValidationError('');
    setPreviewError(false);
    onFileChange(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={`image-upload-${field.name}`}>{field.label}</label>
      <div className={styles.uploader}>
        <div className={styles.preview} aria-live="polite">
          {showPreview
            ? <img src={preview} alt={`${field.label} preview`} onError={() => setPreviewError(true)} />
            : <span>{previewError ? 'Image preview unavailable' : 'No image selected'}</span>}
        </div>
        <div className={styles.actions}>
          <input
            ref={inputRef}
            className={styles.fileInput}
            id={`image-upload-${field.name}`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={chooseFile}
            aria-describedby={validationError ? `image-error-${field.name}` : undefined}
          />
          <button type="button" className={styles.actionButton} onClick={() => inputRef.current?.click()}>
            {preview ? (file ? 'Replace Image' : 'Choose Image') : 'Upload Image'}
          </button>
          {preview && (
            <button type="button" className={styles.removeButton} onClick={removeImage}>
              Remove Image
            </button>
          )}
          {file && <span className={styles.fileName}>{file.name}</span>}
        </div>
      </div>
      {validationError && <p className={styles.error} id={`image-error-${field.name}`} role="alert">{validationError}</p>}
      {uploadProgress !== null && uploadProgress !== undefined && (
        <div className={styles.progress}>
          <progress aria-label={`Uploading ${field.label}`} max="100" value={uploadProgress} />
          <span>{uploadProgress}% uploaded</span>
        </div>
      )}
      {!file && value && <span className={styles.help}>Existing image will be kept unless removed or replaced.</span>}
    </div>
  );
}
