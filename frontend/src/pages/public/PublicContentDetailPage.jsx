import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  ExternalLink,
  Image as ImageIcon,
  RefreshCw,
  UserRound,
} from 'lucide-react';
import { useEffect } from 'react';
import PublicImage from '../../components/public/PublicImage.jsx';
import MarkdownArticleContent from '../../components/common/MarkdownArticleContent.jsx';
import { CallToAction, CardGrid, ContentSection, InfoCard, PageHero, styles } from '../../components/public/PublicPage.jsx';
import { PageMetadata, PublicContentState } from '../../components/public/PublicContentState.jsx';
import usePublicContent from '../../hooks/usePublicContent.js';
import { getPublicImageUrl } from '../../services/publicContentApi.js';
import projectStyles from './ProjectDetails.module.css';
import blogStyles from './BlogDetail.module.css';

const details = {
  project: { resource: 'projects', label: 'Project', list: '/portfolio' },
  article: { resource: 'blog-posts', label: 'Article', list: '/blog' },
  course: { resource: 'academic-courses', label: 'Course', list: '/academic' },
};

function ProjectBackLink({ to }) {
  return (
    <Link className={projectStyles.backLink} to={to}>
      <ArrowLeft aria-hidden="true" size={17} />
      <span>Back to the Portfolio</span>
    </Link>
  );
}

function ArticleBackLink({ to }) {
  return (
    <Link className={blogStyles.backLink} to={to}>
      <ArrowLeft aria-hidden="true" size={17} />
      <span>Back to the Blog</span>
    </Link>
  );
}

function formatArticleDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function ArticleMetadata({ item, description }) {
  useEffect(() => {
    const image = getPublicImageUrl(item.coverImageUrl);
    const canonicalUrl = window.location.href.split('#')[0];
    const values = [
      ['property', 'og:type', 'article'],
      ['property', 'og:title', item.seoTitle || item.title],
      ['property', 'og:description', item.metaDescription || description],
      ['property', 'og:url', canonicalUrl],
      ['property', 'og:image', image],
      ['name', 'twitter:card', image ? 'summary_large_image' : 'summary'],
      ['name', 'twitter:title', item.seoTitle || item.title],
      ['name', 'twitter:description', item.metaDescription || description],
      ['name', 'twitter:image', image],
      ['property', 'article:published_time', item.publishedAt],
      ['property', 'article:modified_time', item.updatedAt],
      ['name', 'author', item.author],
    ].filter(([, , content]) => content);
    const previousMeta = values.map(([attribute, name]) => {
      const selector = `meta[${attribute}="${name}"]`;
      const existing = document.head.querySelector(selector);
      return { selector, existing, content: existing?.content };
    });

    values.forEach(([attribute, name, content]) => {
      let tag = document.head.querySelector(`meta[${attribute}="${name}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attribute, name);
        document.head.append(tag);
      }
      tag.content = content;
    });

    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: item.title,
      description,
      datePublished: item.publishedAt || undefined,
      dateModified: item.updatedAt || undefined,
      author: item.author ? { '@type': 'Person', name: item.author } : undefined,
      image: image || undefined,
      mainEntityOfPage: canonicalUrl,
    };
    let schema = document.head.querySelector('#blog-article-structured-data');
    const createdSchema = !schema;
    if (!schema) {
      schema = document.createElement('script');
      schema.id = 'blog-article-structured-data';
      schema.type = 'application/ld+json';
      document.head.append(schema);
    }
    schema.textContent = JSON.stringify(structuredData).replace(/</g, '\\u003c');

    return () => {
      previousMeta.forEach(({ selector, existing, content }) => {
        if (existing) existing.content = content;
        else document.head.querySelector(selector)?.remove();
      });
      if (createdSchema) schema.remove();
      else schema.textContent = '';
    };
  }, [description, item]);

  return null;
}

function ArticleDetails({ item }) {
  const description = item.metaDescription || item.excerpt || '';
  const publishedDate = formatArticleDate(item.publishedAt);
  const updatedDate = formatArticleDate(item.updatedAt);
  const isUpdated = item.updatedAt && item.publishedAt
    && new Date(item.updatedAt).getTime() > new Date(item.publishedAt).getTime();
  const metadata = [
    item.author,
    publishedDate && `Published ${publishedDate}`,
    isUpdated && updatedDate
      ? `Updated ${updatedDate}`
      : '',
    item.readingTimeMinutes && `${item.readingTimeMinutes} min read`,
  ].filter(Boolean);
  const relatedPosts = (Array.isArray(item.relatedPosts) ? item.relatedPosts : [])
    .filter((post) => post?.slug && post?.title);

  return (
    <>
      <ArticleMetadata item={item} description={description} />
      <PageMetadata title={item.seoTitle || item.title} description={description} />
      <article className={blogStyles.article}>
        <header className={blogStyles.articleHeader}>
          <div className={blogStyles.articleHeaderInner}>
            <nav className={blogStyles.breadcrumb} aria-label="Breadcrumb">
              <ol>
                <li><Link to="/">Home</Link></li>
                <li><Link to="/blog">Blog</Link></li>
                <li aria-current="page">{item.title}</li>
              </ol>
            </nav>
            <ArticleBackLink to="/blog" />
            {item.category?.name && <p className={blogStyles.category}>{item.category.name}</p>}
            <h1 className={blogStyles.articleTitle}>{item.title}</h1>
            {item.excerpt?.trim() && <p className={blogStyles.articleExcerpt}>{item.excerpt}</p>}
            {metadata.length > 0 && (
              <ul className={blogStyles.metadata} aria-label="Article details">
                {item.author && (
                  <li>
                    <UserRound aria-hidden="true" size={17} />
                    <span>By {item.author}</span>
                  </li>
                )}
                {publishedDate && (
                  <li>
                    <CalendarDays aria-hidden="true" size={17} />
                    <time dateTime={item.publishedAt}>Published {publishedDate}</time>
                  </li>
                )}
                {isUpdated && updatedDate && (
                  <li>
                    <RefreshCw aria-hidden="true" size={15} />
                    <time dateTime={item.updatedAt}>Updated {updatedDate}</time>
                  </li>
                )}
                {item.readingTimeMinutes && (
                  <li>
                    <Clock3 aria-hidden="true" size={17} />
                    <span>{item.readingTimeMinutes} min read</span>
                  </li>
                )}
              </ul>
            )}
          </div>
        </header>

        {item.coverImageUrl && (
          <div className={blogStyles.coverWrap}>
            <div className={blogStyles.cover}>
              <PublicImage
                src={item.coverImageUrl}
                alt={item.coverImageAlt || item.title}
                loading="eager"
                fallback={(
                  <div className={blogStyles.imageFallback} role="img" aria-label="Article cover image unavailable">
                    <ImageIcon aria-hidden="true" size={32} />
                  </div>
                )}
              />
            </div>
          </div>
        )}

        {item.body?.trim() && (
          <ContentSection className={blogStyles.articleSection}>
            <div className={blogStyles.articleContent}>
              <MarkdownArticleContent markdown={item.body} />
            </div>
          </ContentSection>
        )}
      </article>

      {relatedPosts.length > 0 && (
        <ContentSection soft>
          <div className={blogStyles.relatedHeading}>
            <h2>Related Articles</h2>
          </div>
          <CardGrid>
            {relatedPosts.map((post) => (
              <InfoCard
                key={post.slug}
                eyebrow={post.category?.name}
                title={post.title}
                description={post.excerpt || ''}
                footer={<Link to={`/blog/${post.slug}`}>Read article</Link>}
              >
                {post.coverImageUrl && (
                  <Link className={blogStyles.relatedImage} to={`/blog/${post.slug}`} aria-label={`Read ${post.title}`}>
                    <PublicImage src={post.coverImageUrl} alt={post.coverImageAlt || post.title} />
                  </Link>
                )}
              </InfoCard>
            ))}
          </CardGrid>
        </ContentSection>
      )}
      <CallToAction
        title="Have a project or idea to discuss?"
        description="Talk with our team about how we can help turn your next idea into impact."
        buttonLabel="Contact Us"
      />
    </>
  );
}

function isValidLiveUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function ProjectDetails({ item, listUrl }) {
  const features = (Array.isArray(item.keyFeatures) ? item.keyFeatures : [])
    .filter((feature) => feature?.title?.trim() && feature?.description?.trim());
  const technologies = (Array.isArray(item.technologies) ? item.technologies : [])
    .filter((technology) => typeof technology === 'string' && technology.trim());
  const galleryImages = (Array.isArray(item.galleryImages) ? item.galleryImages : [])
    .filter((imageUrl) => typeof imageUrl === 'string' && imageUrl.trim());

  return (
    <>
      <PageHero
        title={item.title}
        description={item.summary}
        beforeTitle={<ProjectBackLink to={listUrl} />}
      />
      <ContentSection className={projectStyles.projectContent}>
        <div className={projectStyles.cover}>
          <PublicImage
            src={item.imageUrl}
            alt={`${item.title} project cover`}
            loading="eager"
            fallback={(
              <div className={projectStyles.imageFallback} role="img" aria-label="Project cover image unavailable">
                <ImageIcon aria-hidden="true" size={32} />
              </div>
            )}
          />
        </div>

        {item.description?.trim() && (
          <section className={projectStyles.detailSection} aria-labelledby="project-overview">
            <h2 id="project-overview">Project Overview</h2>
            <p>{item.description}</p>
          </section>
        )}
        {item.problemStatement?.trim() && (
          <section className={projectStyles.detailSection} aria-labelledby="project-problem">
            <h2 id="project-problem">Problem Statement</h2>
            <p>{item.problemStatement}</p>
          </section>
        )}
        {item.solution?.trim() && (
          <section className={projectStyles.detailSection} aria-labelledby="project-solution">
            <h2 id="project-solution">Our Solution</h2>
            <p>{item.solution}</p>
          </section>
        )}
        {features.length > 0 && (
          <section className={projectStyles.detailSection} aria-labelledby="project-features">
            <h2 id="project-features">Key Features</h2>
            <ul className={projectStyles.featureGrid}>
              {features.map((feature, index) => (
                <li className={projectStyles.featureCard} key={`${feature.title}-${index}`}>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
        {technologies.length > 0 && (
          <section className={projectStyles.detailSection} aria-labelledby="project-technologies">
            <h2 id="project-technologies">Technologies Used</h2>
            <ul className={projectStyles.technologyList}>
              {technologies.map((technology, index) => <li key={`${technology}-${index}`}>{technology}</li>)}
            </ul>
          </section>
        )}
        {item.outcome?.trim() && (
          <section className={projectStyles.detailSection} aria-labelledby="project-outcome">
            <h2 id="project-outcome">Project Outcome / Impact</h2>
            <p>{item.outcome}</p>
          </section>
        )}
        {galleryImages.length > 0 && (
          <section className={projectStyles.detailSection} aria-labelledby="project-gallery">
            <h2 id="project-gallery">Project Gallery</h2>
            <ul className={projectStyles.gallery}>
              {galleryImages.map((imageUrl, index) => (
                <li key={`${imageUrl}-${index}`}>
                  <PublicImage
                    src={imageUrl}
                    alt={`${item.title} project screenshot ${index + 1}`}
                    fallback={(
                      <div className={projectStyles.imageFallback} role="img" aria-label={`Project screenshot ${index + 1} unavailable`}>
                        <ImageIcon aria-hidden="true" size={28} />
                      </div>
                    )}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
        {isValidLiveUrl(item.liveUrl) && (
          <div className={projectStyles.liveProject}>
            <a href={item.liveUrl} target="_blank" rel="noreferrer">
              Visit Live Project
              <ExternalLink aria-hidden="true" size={17} />
            </a>
          </div>
        )}
      </ContentSection>
    </>
  );
}

export default function PublicContentDetailPage({ type }) {
  const { slug = '' } = useParams();
  const location = useLocation();
  const detail = details[type];
  const listUrl = `${detail.list}${type === 'project' ? location.search : ''}`;
  const content = usePublicContent(`${detail.resource}/${encodeURIComponent(slug)}`);
  const item = content.data?.item;

  if (content.status === 'error') {
    const notFound = content.errorStatus === 404;
    return (
      <main>
        <PageMetadata title={notFound ? `${detail.label} not found` : detail.label} />
        <PageHero title={notFound ? `${detail.label} not found` : 'Content unavailable'} description="" />
        <ContentSection>
          {notFound
            ? <p className={styles.contentState}>This published content is unavailable.</p>
            : <PublicContentState status={content.status} error={content.error} retry={content.retry} />}
          {type === 'project'
            ? <ProjectBackLink to={listUrl} />
            : <p><Link to={listUrl}>Return to {detail.list === '/blog' ? 'the blog' : detail.list === '/academic' ? 'courses' : 'the portfolio'}</Link></p>}
        </ContentSection>
      </main>
    );
  }

  if (!item) {
    return (
      <main>
        <PageMetadata title={detail.label} />
        <PageHero title="Loading content" description="" />
        <ContentSection><PublicContentState status={content.status} error={content.error} retry={content.retry} /></ContentSection>
      </main>
    );
  }

  if (type === 'project') {
    return (
      <main>
        <PageMetadata title={item.title} description={item.summary} />
        <ProjectDetails item={item} listUrl={listUrl} />
      </main>
    );
  }

  if (type === 'article') {
    return (
      <main>
        <ArticleDetails item={item} />
      </main>
    );
  }

  const description = item.summary || item.excerpt || item.description || '';
  return (
    <main>
      <PageMetadata title={item.title} description={description} />
      <PageHero title={item.title} description={description} />
      <ContentSection>
        <PublicImage className={styles.contentImage} src={item.coverImageUrl} alt={item.title} />
        <PublicImage className={styles.contentImage} src={item.imageUrl} alt={item.title} />
        {item.category && <p className={styles.eyebrow}>{item.category.name}</p>}
        {item.businessArea && <p className={styles.eyebrow}>{item.businessArea.name}</p>}
        {item.level && <p className={styles.eyebrow}>{item.level.toLowerCase()}</p>}
        {(item.body || item.description) && <div className={styles.articleBody}>{item.body || item.description}</div>}
        {item.externalUrl && (
          <p><a className={styles.textLink} href={item.externalUrl} target="_blank" rel="noreferrer">Open course</a></p>
        )}
        {item.publishedAt && <p className={styles.contentDate}>Published {new Date(item.publishedAt).toLocaleDateString()}</p>}
        <p><Link to={listUrl}>Back to {detail.list === '/blog' ? 'the blog' : detail.list === '/academic' ? 'courses' : 'the portfolio'}</Link></p>
      </ContentSection>
    </main>
  );
}
