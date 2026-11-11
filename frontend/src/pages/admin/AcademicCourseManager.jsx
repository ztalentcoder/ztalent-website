import { useCallback, useEffect, useRef, useState } from 'react';
import AdminConfirmationDialog from '../../components/admin/AdminConfirmationDialog.jsx';
import ImageUploadField from '../../components/admin/ImageUploadField.jsx';
import useAutoDismissNotice from '../../hooks/useAutoDismissNotice.js';
import {
  createAdminContent,
  createCourseEpisode,
  deleteAdminContent,
  deleteAdminImage,
  deleteCourseEpisode,
  listAdminContent,
  listCourseEpisodes,
  reorderCourseEpisodes,
  updateAdminContent,
  updateCourseEpisode,
  uploadAdminImage,
} from '../../services/adminContentApi.js';
import styles from './AcademicCourseManager.module.css';

const pageSize = 10;
const levels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const statuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

function slugFromTitle(title) {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200)
    .replace(/-+$/g, '');
  return slug || 'course';
}

function emptyCourse() {
  return {
    title: '',
    slug: '',
    summary: '',
    description: '',
    imageUrl: null,
    level: 'BEGINNER',
    language: '',
    externalUrl: '',
    learningOutcomes: '',
    requirements: '',
    courseCategoryId: '',
    status: 'DRAFT',
    sortOrder: 0,
  };
}

function emptyCategory() {
  return {
    name: '',
    slug: '',
    description: '',
    imageUrl: null,
    status: 'PUBLISHED',
    sortOrder: 0,
  };
}

function emptyEpisode(sortOrder = 0) {
  return {
    title: '',
    summary: '',
    youtubeUrl: '',
    status: 'DRAFT',
    sortOrder,
  };
}

function getErrorMessage(error) {
  if (error.status === 401) return 'Your admin session expired. Please sign in again.';
  if (error.status === 403) return 'You do not have permission to manage courses.';
  return error.message || 'The request could not be completed.';
}

async function cleanupImage(url) {
  if (typeof url !== 'string' || !url.startsWith('/uploads/images/')) return true;
  try {
    await deleteAdminImage(url);
    return true;
  } catch (error) {
    console.error('Managed course image cleanup failed.', error);
    return false;
  }
}

function FormField({ id, label, value, onChange, required = false, type = 'text', options, rows = 4, hint }) {
  return (
    <label className={styles.field} htmlFor={id}>
      <span>{label}</span>
      {options ? (
        <select id={id} value={value ?? ''} required={required} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={option.value ?? option} value={option.value ?? option}>
              {option.label ?? option}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea id={id} value={value ?? ''} required={required} rows={rows} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input id={id} type={type} value={value ?? ''} required={required} onChange={(event) => onChange(event.target.value)} />
      )}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function ImageField({ resource, label, value, file, onChange, onFileChange, progress }) {
  return (
    <ImageUploadField
      field={{ name: resource, label }}
      value={value}
      file={file}
      onChange={onChange}
      onFileChange={onFileChange}
      uploadProgress={progress}
    />
  );
}

export default function AcademicCourseManager() {
  const [categories, setCategories] = useState([]);
  const [courses, setCourses] = useState([]);
  const [coursePagination, setCoursePagination] = useState({ pageCount: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [courseError, setCourseError] = useState('');
  const [notice, setNotice] = useAutoDismissNotice();
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [courseForm, setCourseForm] = useState(null);
  const [courseId, setCourseId] = useState(null);
  const [courseSlugCustomized, setCourseSlugCustomized] = useState(false);
  const [courseFile, setCourseFile] = useState(null);
  const [courseProgress, setCourseProgress] = useState(null);
  const [courseSaving, setCourseSaving] = useState(false);
  const [categoryForm, setCategoryForm] = useState(null);
  const [categoryId, setCategoryId] = useState(null);
  const [categoryFile, setCategoryFile] = useState(null);
  const [categoryProgress, setCategoryProgress] = useState(null);
  const [categorySaving, setCategorySaving] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const episodeDialogRef = useRef(null);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodeForm, setEpisodeForm] = useState(null);
  const [episodeId, setEpisodeId] = useState(null);
  const [episodeSaving, setEpisodeSaving] = useState(false);
  const [episodeReordering, setEpisodeReordering] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadCategories = useCallback(async () => {
    setCategoryLoading(true);
    setCategoryError('');
    try {
      const response = await listAdminContent('course-categories', { page: 1, pageSize: 100 });
      setCategories(response.items ?? []);
    } catch (error) {
      setCategoryError(getErrorMessage(error));
    } finally {
      setCategoryLoading(false);
    }
  }, []);

  const loadCourses = useCallback(async () => {
    setCoursesLoading(true);
    setCourseError('');
    try {
      const response = await listAdminContent('academic-courses', {
        page,
        pageSize,
        search: searchQuery,
        ...(categoryFilter ? { courseCategoryId: categoryFilter } : {}),
        ...(levelFilter ? { level: levelFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      setCourses(response.items ?? []);
      setCoursePagination(response.pagination ?? { pageCount: 1, total: 0 });
    } catch (error) {
      setCourseError(getErrorMessage(error));
    } finally {
      setCoursesLoading(false);
    }
  }, [page, searchQuery, categoryFilter, levelFilter, statusFilter]);

  useEffect(() => { void loadCategories(); }, [loadCategories]);
  useEffect(() => { void loadCourses(); }, [loadCourses]);
  useEffect(() => {
    if (!selectedCourse) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;
    document.body.style.overflow = 'hidden';
    const dialog = episodeDialogRef.current;
    const focusableElements = () => [...(dialog?.querySelectorAll(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]',
    ) ?? [])];
    focusableElements()[0]?.focus();
    const handleDialogKey = (event) => {
      if (event.key === 'Escape') {
        setSelectedCourse(null);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = focusableElements();
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', handleDialogKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleDialogKey);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus();
    };
  }, [selectedCourse]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearchQuery(search.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  function startCourseCreate() {
    setCourseForm(emptyCourse());
    setCourseId(null);
    setCourseSlugCustomized(false);
    setCourseFile(null);
    setCourseProgress(null);
    setCourseError('');
    setNotice('');
  }

  function startCourseEdit(course) {
    setCourseId(course.id);
    setCourseSlugCustomized(course.slug !== slugFromTitle(course.title));
    setCourseFile(null);
    setCourseProgress(null);
    setCourseError('');
    setNotice('');
    setCourseForm({
      ...emptyCourse(),
      ...course,
      externalUrl: course.externalUrl ?? '',
      learningOutcomes: (course.learningOutcomes ?? []).join('\n'),
      requirements: (course.requirements ?? []).join('\n'),
    });
  }

  async function saveCourse(event) {
    event.preventDefault();
    if (!courseForm || courseSaving) return;
    setCourseSaving(true);
    setCourseError('');
    setNotice('');
    let uploadedUrl = null;
    try {
      const body = {
        title: courseForm.title,
        slug: courseForm.slug,
        summary: courseForm.summary || null,
        description: courseForm.description,
        imageUrl: courseForm.imageUrl || null,
        level: courseForm.level,
        language: courseForm.language || null,
        externalUrl: courseForm.externalUrl.trim() || null,
        learningOutcomes: courseForm.learningOutcomes.split('\n').map((item) => item.trim()).filter(Boolean),
        requirements: courseForm.requirements.split('\n').map((item) => item.trim()).filter(Boolean),
        courseCategoryId: courseForm.courseCategoryId,
        status: courseForm.status,
        sortOrder: Number(courseForm.sortOrder),
      };
      if (courseFile) {
        const image = await uploadAdminImage('academic-courses', courseFile, setCourseProgress);
        uploadedUrl = image.url;
        body.imageUrl = image.url;
      }
      await (courseId
        ? updateAdminContent('academic-courses', courseId, body)
        : createAdminContent('academic-courses', body));
      const oldImage = courseId ? courses.find((item) => item.id === courseId)?.imageUrl : null;
      const cleanupSucceeded = oldImage && oldImage !== body.imageUrl
        ? await cleanupImage(oldImage)
        : true;
      setCourseForm(null);
      setCourseFile(null);
      setNotice(`Course ${courseId ? 'updated' : 'created'} successfully.${cleanupSucceeded ? '' : ' The previous image could not be removed.'}`);
      await Promise.all([loadCourses(), loadCategories()]);
    } catch (error) {
      if (uploadedUrl) {
        const removed = await cleanupImage(uploadedUrl);
        setCourseError(`${getErrorMessage(error)}${removed ? '' : ' The uploaded image could not be removed.'}`);
      } else {
        setCourseError(getErrorMessage(error));
      }
    } finally {
      setCourseSaving(false);
      setCourseProgress(null);
    }
  }

  function startCategoryCreate() {
    setCategoryForm(emptyCategory());
    setCategoryId(null);
    setCategoryFile(null);
    setCategoryProgress(null);
    setCategoryError('');
    setNotice('');
  }

  function startCategoryEdit(category) {
    setCategoryId(category.id);
    setCategoryFile(null);
    setCategoryProgress(null);
    setCategoryError('');
    setCategoryForm({ ...emptyCategory(), ...category });
  }

  async function saveCategory(event) {
    event.preventDefault();
    if (!categoryForm || categorySaving) return;
    setCategorySaving(true);
    setCategoryError('');
    setNotice('');
    let uploadedUrl = null;
    try {
      const body = {
        name: categoryForm.name,
        slug: categoryForm.slug,
        description: categoryForm.description || null,
        imageUrl: categoryForm.imageUrl || null,
        status: categoryForm.status,
        sortOrder: Number(categoryForm.sortOrder),
      };
      if (categoryFile) {
        const image = await uploadAdminImage('course-categories', categoryFile, setCategoryProgress);
        uploadedUrl = image.url;
        body.imageUrl = image.url;
      }
      await (categoryId
        ? updateAdminContent('course-categories', categoryId, body)
        : createAdminContent('course-categories', body));
      const previousImage = categoryId ? categories.find((item) => item.id === categoryId)?.imageUrl : null;
      const cleanupSucceeded = previousImage && previousImage !== body.imageUrl
        ? await cleanupImage(previousImage)
        : true;
      setCategoryForm(null);
      setCategoryFile(null);
      setNotice(`Course category ${categoryId ? 'updated' : 'created'} successfully.${cleanupSucceeded ? '' : ' The previous image could not be removed.'}`);
      await Promise.all([loadCategories(), loadCourses()]);
    } catch (error) {
      if (uploadedUrl) {
        const removed = await cleanupImage(uploadedUrl);
        setCategoryError(`${getErrorMessage(error)}${removed ? '' : ' The uploaded image could not be removed.'}`);
      } else {
        setCategoryError(getErrorMessage(error));
      }
    } finally {
      setCategorySaving(false);
      setCategoryProgress(null);
    }
  }

  async function loadEpisodes(course) {
    setEpisodesLoading(true);
    setCourseError('');
    setEpisodes([]);
    try {
      const response = await listCourseEpisodes(course.id);
      setEpisodes(response.items ?? []);
    } catch (error) {
      setCourseError(getErrorMessage(error));
    } finally {
      setEpisodesLoading(false);
    }
  }

  async function manageEpisodes(course) {
    setSelectedCourse(course);
    setEpisodeForm(null);
    setEpisodeId(null);
    await loadEpisodes(course);
  }

  async function toggleCoursePublication(course) {
    const status = course.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    setCourseError('');
    setNotice('');
    try {
      await updateAdminContent('academic-courses', course.id, { status });
      setNotice(`Course ${status === 'PUBLISHED' ? 'published' : 'unpublished'} successfully.`);
      await loadCourses();
    } catch (error) {
      setCourseError(getErrorMessage(error));
    }
  }

  async function saveEpisode(event) {
    event.preventDefault();
    if (!episodeForm || !selectedCourse || episodeSaving) return;
    setEpisodeSaving(true);
    setCourseError('');
    setNotice('');
    try {
      const body = {
        title: episodeForm.title,
        summary: episodeForm.summary || null,
        youtubeUrl: episodeForm.youtubeUrl,
        sortOrder: Number(episodeForm.sortOrder),
        status: episodeForm.status,
      };
      await (episodeId
        ? updateCourseEpisode(selectedCourse.id, episodeId, body)
        : createCourseEpisode(selectedCourse.id, body));
      setEpisodeForm(null);
      setEpisodeId(null);
      setNotice(`Episode ${episodeId ? 'updated' : 'created'} successfully.`);
      await Promise.all([loadEpisodes(selectedCourse), loadCourses()]);
    } catch (error) {
      setCourseError(getErrorMessage(error));
    } finally {
      setEpisodeSaving(false);
    }
  }

  async function moveEpisode(index, direction) {
    const destination = index + direction;
    if (episodeReordering || destination < 0 || destination >= episodes.length || !selectedCourse) return;
    const reordered = [...episodes];
    [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
    setEpisodeReordering(true);
    setCourseError('');
    try {
      await reorderCourseEpisodes(selectedCourse.id, reordered.map((episode) => episode.id));
      await loadEpisodes(selectedCourse);
    } catch (error) {
      setCourseError(getErrorMessage(error));
      await loadEpisodes(selectedCourse);
    } finally {
      setEpisodeReordering(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    const target = pendingDelete;
    setDeleting(true);
    setCourseError('');
    setCategoryError('');
    setNotice('');
    try {
      if (target.type === 'course') {
        await deleteAdminContent('academic-courses', target.item.id);
        const removed = await cleanupImage(target.item.imageUrl);
        if (selectedCourse?.id === target.item.id) {
          setSelectedCourse(null);
          setEpisodes([]);
        }
        setNotice(`Course deleted.${removed ? '' : ' Its image could not be removed.'}`);
        await loadCourses();
      } else if (target.type === 'category') {
        await deleteAdminContent('course-categories', target.item.id);
        const removed = await cleanupImage(target.item.imageUrl);
        setNotice(`Course category deleted.${removed ? '' : ' Its image could not be removed.'}`);
        await Promise.all([loadCategories(), loadCourses()]);
      } else {
        await deleteCourseEpisode(target.courseId, target.item.id);
        setNotice('Episode deleted.');
        await Promise.all([loadEpisodes(selectedCourse), loadCourses()]);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      if (target.type === 'category') setCategoryError(message);
      else setCourseError(message);
    } finally {
      setPendingDelete(null);
      setDeleting(false);
    }
  }

  function updateCourseField(field, value) {
    if (field === 'slug') {
      setCourseSlugCustomized(value !== slugFromTitle(courseForm?.title ?? ''));
      setCourseForm((current) => ({ ...current, slug: value }));
      return;
    }
    if (field === 'title' && !courseSlugCustomized) {
      setCourseForm((current) => ({ ...current, title: value, slug: slugFromTitle(value) }));
      return;
    }
    setCourseForm((current) => ({ ...current, [field]: value }));
  }

  function updateCategoryField(field, value) {
    setCategoryForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Academic content</p>
          <h1>Academic Courses</h1>
          <p>Manage the course catalogue, categories, and published lessons.</p>
        </div>
        <button className={styles.primaryButton} type="button" onClick={startCourseCreate}>Create course</button>
      </header>

      {notice && <p className={styles.success} role="status">{notice}</p>}
      {courseError && <p className={styles.error} role="alert">{courseError}</p>}

      <section className={styles.panel} aria-labelledby="course-list-heading">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="course-list-heading">Courses</h2>
            <p>{coursePagination.total} courses</p>
          </div>
        </div>
        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <span>Search courses</span>
            <input type="search" value={search} placeholder="Search by course title" onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label>
            <span>Category</span>
            <select value={categoryFilter} onChange={(event) => { setPage(1); setCategoryFilter(event.target.value); }}>
              <option value="">All categories</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label>
            <span>Level</span>
            <select value={levelFilter} onChange={(event) => { setPage(1); setLevelFilter(event.target.value); }}>
              <option value="">All levels</option>
              {levels.map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value); }}>
              <option value="">All statuses</option>
              {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
        </div>
        {coursesLoading ? (
          <p className={styles.state} role="status">Loading courses…</p>
        ) : courses.length === 0 ? (
          <p className={styles.state}>No courses match these filters.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.courseTable}>
              <colgroup>
                <col className={styles.courseColumn} />
                <col className={styles.levelColumn} />
                <col className={styles.episodeColumn} />
                <col className={styles.statusColumn} />
                <col className={styles.actionsColumn} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Course</th>
                  <th scope="col">Level</th>
                  <th scope="col">Episodes</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.id}>
                    <td className={styles.courseCell}>
                      <strong>{course.title}</strong>
                      <span>{course.category?.name ?? 'Category required'}</span>
                    </td>
                    <td>{course.level}</td>
                    <td>{course._count?.episodes ?? 0}</td>
                    <td><span className={styles.status}>{course.status}</span></td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.textButton} type="button" onClick={() => startCourseEdit(course)}>Edit</button>
                        <button className={styles.textButton} type="button" onClick={() => void manageEpisodes(course)}>Manage Episodes</button>
                        <button
                          className={styles.textButton}
                          type="button"
                          onClick={() => void toggleCoursePublication(course)}
                        >
                          {course.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                        </button>
                        <button className={styles.dangerButton} type="button" onClick={() => setPendingDelete({ type: 'course', item: course })}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {coursePagination.pageCount > 1 && (
          <nav className={styles.pagination} aria-label="Course management pages">
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
            <span>Page {page} of {coursePagination.pageCount}</span>
            <button type="button" disabled={page >= coursePagination.pageCount} onClick={() => setPage((current) => current + 1)}>Next</button>
          </nav>
        )}
      </section>

      {courseForm && (
        <section className={styles.panel} aria-labelledby="course-form-heading">
          <div className={styles.sectionHeading}>
            <h2 id="course-form-heading">{courseId ? 'Edit course' : 'Create course'}</h2>
            <button className={styles.textButton} type="button" onClick={() => setCourseForm(null)}>Cancel</button>
          </div>
          <form className={styles.form} onSubmit={saveCourse}>
            <div className={styles.fields}>
              <FormField id="course-title" label="Title" value={courseForm.title} required onChange={(value) => updateCourseField('title', value)} />
              <FormField id="course-slug" label="Slug" value={courseForm.slug} required onChange={(value) => updateCourseField('slug', value)} hint="Generated from the title. Edit to set a custom course URL." />
              <FormField id="course-category" label="Category" value={courseForm.courseCategoryId} required onChange={(value) => updateCourseField('courseCategoryId', value)} options={[{ value: '', label: 'Select a category' }, ...categories.map((category) => ({ value: category.id, label: `${category.name}${category.status !== 'PUBLISHED' ? ' (hidden)' : ''}` }))]} />
              <FormField id="course-level" label="Level" value={courseForm.level} required onChange={(value) => updateCourseField('level', value)} options={levels} />
              <FormField id="course-summary" label="Short description" type="textarea" rows={3} value={courseForm.summary} onChange={(value) => updateCourseField('summary', value)} />
              <FormField id="course-language" label="Language (optional)" value={courseForm.language} onChange={(value) => updateCourseField('language', value)} />
              <FormField id="course-description" label="Full description" type="textarea" value={courseForm.description} required onChange={(value) => updateCourseField('description', value)} />
              <FormField id="course-youtube" label="YouTube course URL (optional)" type="url" value={courseForm.externalUrl} onChange={(value) => updateCourseField('externalUrl', value)} hint="Use a YouTube video URL; no URL is shown publicly if left blank." />
              <FormField id="course-outcomes" label="What you will learn" type="textarea" value={courseForm.learningOutcomes} onChange={(value) => updateCourseField('learningOutcomes', value)} hint="Enter one learning outcome per line." />
              <FormField id="course-requirements" label="Course requirements" type="textarea" value={courseForm.requirements} onChange={(value) => updateCourseField('requirements', value)} hint="Enter one requirement per line." />
              <FormField id="course-status" label="Publication status" value={courseForm.status} required onChange={(value) => updateCourseField('status', value)} options={statuses} />
              <FormField id="course-sort-order" label="Display order" type="number" value={courseForm.sortOrder} onChange={(value) => updateCourseField('sortOrder', value)} />
            </div>
            <ImageField
              resource="course-image"
              label="Course image"
              value={courseForm.imageUrl}
              file={courseFile}
              progress={courseProgress}
              onChange={(value) => updateCourseField('imageUrl', value)}
              onFileChange={setCourseFile}
            />
            <div className={styles.formActions}>
              <button className={styles.primaryButton} type="submit" disabled={courseSaving || categoryLoading || categories.length === 0}>
                {courseSaving ? 'Saving…' : courseId ? 'Save course' : 'Create course'}
              </button>
              <span>Episodes can be added after saving the course.</span>
            </div>
          </form>
        </section>
      )}

      {selectedCourse && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedCourse(null);
          }}
        >
          <section
            ref={episodeDialogRef}
            className={styles.episodeDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="episodes-heading"
          >
            <div className={styles.sectionHeading}>
              <div>
                <h2 id="episodes-heading">Episodes for {selectedCourse.title}</h2>
                <p>Only published episodes are visible on the public course page.</p>
              </div>
              <div className={styles.actions}>
                <button className={styles.primaryButton} type="button" onClick={() => { setEpisodeId(null); setEpisodeForm(emptyEpisode(episodes.length)); }}>Add episode</button>
                <button className={styles.textButton} type="button" onClick={() => setSelectedCourse(null)}>Close</button>
              </div>
            </div>
            {episodesLoading ? (
              <p className={styles.state} role="status">Loading episodes…</p>
            ) : episodes.length === 0 ? (
              <p className={styles.state}>No episodes added. Add an episode whenever it is ready.</p>
            ) : (
              <ol className={styles.episodeList}>
                {episodes.map((episode, index) => (
                  <li className={styles.episodeRow} key={episode.id}>
                    <span className={styles.episodeNumber}>{index + 1}</span>
                    <div className={styles.episodeInfo}>
                      <strong>{episode.title}</strong>
                      <span>{episode.status} · order {episode.sortOrder}</span>
                    </div>
                    <div className={styles.actions}>
                      <button className={styles.textButton} type="button" disabled={episodeReordering || index === 0} aria-label={`Move ${episode.title} up`} onClick={() => void moveEpisode(index, -1)}>Up</button>
                      <button className={styles.textButton} type="button" disabled={episodeReordering || index === episodes.length - 1} aria-label={`Move ${episode.title} down`} onClick={() => void moveEpisode(index, 1)}>Down</button>
                      <button className={styles.textButton} type="button" onClick={() => { setEpisodeId(episode.id); setEpisodeForm({ ...episode }); }}>Edit</button>
                      <button className={styles.dangerButton} type="button" onClick={() => setPendingDelete({ type: 'episode', item: episode, courseId: selectedCourse.id })}>Delete</button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {episodeForm && (
              <form className={styles.episodeForm} onSubmit={saveEpisode}>
                <h3>{episodeId ? 'Edit episode' : 'Add episode'}</h3>
                <div className={styles.fields}>
                  <FormField id="episode-title" label="Episode title" value={episodeForm.title} required onChange={(value) => setEpisodeForm((current) => ({ ...current, title: value }))} />
                  <FormField id="episode-url" label="YouTube URL" type="url" value={episodeForm.youtubeUrl} required onChange={(value) => setEpisodeForm((current) => ({ ...current, youtubeUrl: value }))} />
                  <FormField id="episode-summary" label="Short description" type="textarea" value={episodeForm.summary} onChange={(value) => setEpisodeForm((current) => ({ ...current, summary: value }))} />
                  <FormField id="episode-status" label="Publication status" value={episodeForm.status} required onChange={(value) => setEpisodeForm((current) => ({ ...current, status: value }))} options={statuses} />
                  <FormField id="episode-order" label="Display order" type="number" value={episodeForm.sortOrder} onChange={(value) => setEpisodeForm((current) => ({ ...current, sortOrder: value }))} />
                </div>
                <div className={styles.actions}>
                  <button className={styles.primaryButton} type="submit" disabled={episodeSaving}>{episodeSaving ? 'Saving…' : 'Save episode'}</button>
                  <button className={styles.textButton} type="button" onClick={() => { setEpisodeForm(null); setEpisodeId(null); }}>Cancel</button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      <section className={styles.panel} aria-labelledby="categories-heading">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="categories-heading">Course Categories</h2>
            <p>Published categories are available to visitors. Categories with assigned courses cannot be deleted.</p>
          </div>
          {!categoryForm && <button className={styles.primaryButton} type="button" onClick={startCategoryCreate}>Add category</button>}
        </div>
        {categoryError && <p className={styles.error} role="alert">{categoryError}</p>}
        {categoryLoading ? (
          <p className={styles.state} role="status">Loading categories…</p>
        ) : categories.length === 0 ? (
          <p className={styles.state}>No categories yet. Add a category before creating a course.</p>
        ) : (
          <div className={styles.categoryList}>
            {categories.map((category) => (
              <article className={styles.categoryRow} key={category.id}>
                <div>
                  <strong>{category.name}</strong>
                  <span>{category.status} · {category._count?.courses ?? 0} courses · order {category.sortOrder}</span>
                </div>
                <div className={styles.actions}>
                  <button className={styles.textButton} type="button" onClick={() => startCategoryEdit(category)}>Edit</button>
                  <button className={styles.dangerButton} type="button" onClick={() => setPendingDelete({ type: 'category', item: category })}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
        {categoryForm && (
          <form className={styles.categoryForm} onSubmit={saveCategory}>
            <div className={styles.sectionHeading}>
              <h3>{categoryId ? 'Edit category' : 'Create category'}</h3>
              <button className={styles.textButton} type="button" onClick={() => setCategoryForm(null)}>Cancel</button>
            </div>
            <div className={styles.fields}>
              <FormField id="category-name" label="Name" value={categoryForm.name} required onChange={(value) => updateCategoryField('name', value)} />
              <FormField id="category-slug" label="Slug" value={categoryForm.slug} required onChange={(value) => updateCategoryField('slug', value)} />
              <FormField id="category-description" label="Description" type="textarea" value={categoryForm.description} onChange={(value) => updateCategoryField('description', value)} />
              <FormField id="category-status" label="Visibility" value={categoryForm.status} required onChange={(value) => updateCategoryField('status', value)} options={statuses} />
              <FormField id="category-order" label="Display order" type="number" value={categoryForm.sortOrder} onChange={(value) => updateCategoryField('sortOrder', value)} />
            </div>
            <ImageField
              resource="category-image"
              label="Category image (optional)"
              value={categoryForm.imageUrl}
              file={categoryFile}
              progress={categoryProgress}
              onChange={(value) => updateCategoryField('imageUrl', value)}
              onFileChange={setCategoryFile}
            />
            <button className={styles.primaryButton} type="submit" disabled={categorySaving}>
              {categorySaving ? 'Saving…' : 'Save category'}
            </button>
          </form>
        )}
      </section>

      <AdminConfirmationDialog
        open={Boolean(pendingDelete)}
        title={`Delete ${pendingDelete?.type === 'episode' ? 'episode' : pendingDelete?.type === 'category' ? 'category' : 'course'}?`}
        message={pendingDelete?.type === 'category'
          ? 'Categories with assigned courses cannot be deleted. Reassign or delete those courses first.'
          : pendingDelete?.type === 'episode'
            ? `Delete the episode "${pendingDelete.item.title}"? This cannot be undone.`
            : `Delete the course "${pendingDelete?.item.title}" and its episodes? This cannot be undone.`}
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  );
}
