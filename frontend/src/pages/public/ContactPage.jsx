import { useRef, useState } from 'react';
import buttonStyles from '../../components/common/Button.module.css';
import SocialLinks from '../../components/navigation/SocialLinks.jsx';
import { PageMetadata, PublicContentState } from '../../components/public/PublicContentState.jsx';
import { ContentSection, PageHero } from '../../components/public/PublicPage.jsx';
import { usePublicCompany } from '../../context/PublicContentContext.jsx';
import { getCompanyContact } from '../../constants/companyProfile.js';
import { submitContactMessage } from '../../services/contactApi.js';
import styles from './ContactPage.module.css';

export default function ContactPage() {
  const { company, status: companyStatus, error: companyError, retry: retryCompany } = usePublicCompany();
  const { email, phone, location } = getCompanyContact(company);
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
        <div className={styles.contactLayout}>
          <aside className={styles.detailsPanel}>
            <div className={styles.panelHeading}>
              <p className={styles.eyebrow}>We are here to help</p>
              <h2>Reach us directly</h2>
              <p>Choose the contact option that works best for you. We look forward to hearing from you.</p>
            </div>
            {(companyStatus === 'loading' || companyStatus === 'error') && (
              <PublicContentState status={companyStatus} error={companyError} retry={retryCompany} empty="Company contact details are not available yet." />
            )}
            <div className={styles.contactItems}>
              <div className={styles.contactItem}>
                <span className={styles.contactLabel}>Email</span>
                <a href={`mailto:${email}`}>{email}</a>
              </div>
              <div className={styles.contactItem}>
                <span className={styles.contactLabel}>Phone or WhatsApp</span>
                <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a>
              </div>
              <div className={styles.contactItem}>
                <span className={styles.contactLabel}>Location</span>
                <p>{location}</p>
              </div>
              {company?.hours && (
                <div className={styles.contactItem}>
                  <span className={styles.contactLabel}>Business hours</span>
                  <p>{company.hours}</p>
                </div>
              )}
            </div>
            <div className={styles.socialSection}>
              <h3>Follow us</h3>
              <SocialLinks variant="footer" />
            </div>
          </aside>
          <form
            aria-busy={submitting}
            className={styles.contactForm}
            onSubmit={handleSubmit}
          >
            <div className={styles.panelHeading}>
              <p className={styles.eyebrow}>Get in touch</p>
              <h2>Send us a message</h2>
              <p>Share a few details so our team can get back to you with the right information.</p>
            </div>
            <div className={styles.formFields}>
              <div className={styles.formField}>
                <label htmlFor="contact-name">Name or institution</label>
                <input autoComplete="name" id="contact-name" name="name" placeholder="Your name or institution" required />
              </div>
              <div className={styles.formField}>
                <label htmlFor="contact-email">Email address</label>
                <input autoComplete="email" id="contact-email" name="email" placeholder="you@example.com" required type="email" />
              </div>
              <div className={styles.formField}>
                <label htmlFor="contact-phone">Phone or WhatsApp <span>(optional)</span></label>
                <input autoComplete="tel" id="contact-phone" name="phone" placeholder="Your phone number" type="tel" />
              </div>
              <div className={styles.formField}>
                <label htmlFor="contact-topic">What can we help with?</label>
                <select defaultValue="GENERAL_QUESTION" id="contact-topic" name="topic" required>
                  <option value="GENERAL_QUESTION">General question</option>
                  <option value="REQUEST_SYSTEM">Request a system</option>
                  <option value="REQUEST_DATA_SERVICE">Request a data service</option>
                  <option value="COURSE_QUESTION">Course question</option>
                </select>
              </div>
              <div className={`${styles.formField} ${styles.messageField}`}>
                <label htmlFor="contact-message">Your message</label>
                <textarea id="contact-message" name="message" placeholder="Tell us what you need..." required rows="7" />
              </div>
            </div>
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
              <p className={styles.errorMessage} role="alert" aria-live="assertive">
                {errorMessage}
              </p>
            )}
          </form>
        </div>
      </ContentSection>
    </main>
  );
}
