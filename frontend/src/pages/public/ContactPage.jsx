import { useRef, useState } from 'react';
import buttonStyles from '../../components/common/Button.module.css';
import SocialLinks from '../../components/navigation/SocialLinks.jsx';
import { PageMetadata, PublicContentState } from '../../components/public/PublicContentState.jsx';
import { ContentSection, PageHero, styles } from '../../components/public/PublicPage.jsx';
import { usePublicCompany } from '../../context/PublicContentContext.jsx';
import { submitContactMessage } from '../../services/contactApi.js';

export default function ContactPage() {
  const { company, status: companyStatus, error: companyError, retry: retryCompany } = usePublicCompany();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const submissionInProgress = useRef(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submissionInProgress.current) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    submissionInProgress.current = true;
    setSubmitting(true);
    setSubmitted(false);
    setErrorMessage('');

    try {
      const { status, body } = await submitContactMessage(payload);
      if (
        status === 201 &&
        body?.status === 'received' &&
        body?.message === 'Thank you. We will get back to you soon.'
      ) {
        form.reset();
        setSubmitted(true);
      } else if (status === 429) {
        setErrorMessage('Too many messages were sent. Please wait a little while and try again.');
      } else if (status === 400) {
        setErrorMessage(body?.error?.message || 'Please check your details and try again.');
      } else {
        setErrorMessage('We could not send your message right now. Please try again later.');
      }
    } catch {
      setErrorMessage('Unable to connect right now. Please check your connection and try again.');
    } finally {
      submissionInProgress.current = false;
      setSubmitting(false);
    }
  };

  return (
    <main>
      <PageMetadata title="Contact" description={company?.tagline || 'Contact Ztalent Coder.'} />
      <PageHero title="Contact Us" description="Tell us what you need. We reply quickly." />
      <ContentSection>
        <div className={styles.split}>
          <form
            aria-busy={submitting}
            className={`${styles.card} ${styles.contactForm}`}
            onSubmit={handleSubmit}
          >
            <h2>Send us a message</h2>
            <input aria-label="Name or institution" name="name" placeholder="Name or institution" required />
            <input aria-label="Email" name="email" placeholder="Email" required type="email" />
            <input aria-label="Phone or WhatsApp" name="phone" placeholder="Phone or WhatsApp" type="tel" />
            <select aria-label="Message topic" defaultValue="GENERAL_QUESTION" name="topic" required>
              <option value="GENERAL_QUESTION">General question</option>
              <option value="REQUEST_SYSTEM">Request a system</option>
              <option value="REQUEST_DATA_SERVICE">Request a data service</option>
              <option value="COURSE_QUESTION">Course question</option>
            </select>
            <textarea aria-label="Describe what you need" name="message" placeholder="Describe what you need" required rows="5" />
            <button
              className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.submitButton}`}
              disabled={submitting}
              type="submit"
            >
              {submitting ? 'Sending...' : 'Send message'}
            </button>
            {submitting && (
              <p role="status" aria-live="polite">
                Sending your message...
              </p>
            )}
            {submitted && (
              <p className={styles.successMessage} role="status" aria-live="polite">
                Thank you. We will get back to you soon.
              </p>
            )}
            {errorMessage && (
              <p role="alert" aria-live="assertive">
                {errorMessage}
              </p>
            )}
          </form>
          <div className={`${styles.card} ${styles.contactDetails}`}>
            <h2>Reach us directly</h2>
            {companyStatus === 'loading' || companyStatus === 'error'
              ? <PublicContentState status={companyStatus} error={companyError} retry={retryCompany} empty="Company contact details are not available yet." />
              : company ? (
                <>
                  {company.email && <p>Email: <a href={`mailto:${company.email}`}>{company.email}</a></p>}
                  {company.phone && <p>Phone: <a href={`tel:${company.phone}`}>{company.phone}</a></p>}
                  {company.location && <p>Location: {company.location}</p>}
                  {company.hours && <p>Hours: {company.hours}</p>}
                  {company.socialLinks.length > 0 && (
                    <>
                      <h3>Follow us</h3>
                      <div className={styles.socialRow}>
                        <SocialLinks variant="footer" />
                      </div>
                    </>
                  )}
                  {!company.email && !company.phone && !company.location && !company.hours && company.socialLinks.length === 0 && (
                    <p className={styles.contentState}>Company contact details are not available yet.</p>
                  )}
                </>
              ) : <p className={styles.contentState}>Company contact details are not available yet.</p>}
          </div>
        </div>
      </ContentSection>
    </main>
  );
}
