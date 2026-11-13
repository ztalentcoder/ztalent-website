import { useEffect, useRef } from 'react';

const gridSelector = '[data-motion-stagger], [class*="Grid"], [class*="grid"], [class*="List"], [class*="list"]';
const sectionSelector = 'main > section, main [data-motion="hero"], main [data-motion="section"]';

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function animateElement(element, variant, delay = 0) {
  if (typeof element.animate !== 'function') return;

  const keyframes = variant === 'image'
    ? [
      { opacity: 0, transform: 'scale(0.985)' },
      { opacity: 1, transform: 'scale(1)' },
    ]
    : [
      { opacity: 0, transform: 'translateY(12px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ];
  const animation = element.animate(keyframes, {
    duration: variant === 'image' ? 600 : 480,
    delay,
    easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
    fill: 'both',
  });
  animation.onfinish = () => animation.cancel();
}

export default function PublicPageMotion({ children }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || prefersReducedMotion()) return undefined;

    let pageAnimation;
    if (typeof container.animate === 'function') {
      pageAnimation = container.animate(
        [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 360, easing: 'ease-out', fill: 'both' },
      );
      pageAnimation.onfinish = () => pageAnimation.cancel();
    }

    if (typeof window.IntersectionObserver !== 'function') {
      return () => pageAnimation?.cancel();
    }

    const observed = new WeakSet();
    const motionData = new WeakMap();
    const observer = new window.IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const motion = motionData.get(entry.target);
        if (!motion) continue;
        const { variant, delay } = motion;
        if (!prefersReducedMotion()) animateElement(entry.target, variant, delay);
        motionData.delete(entry.target);
        observer.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.12 });

    const observe = (element, variant, delay = 0) => {
      if (observed.has(element)) return;
      observed.add(element);
      motionData.set(element, { variant, delay });
      observer.observe(element);
    };

    const observeGroup = (group, addedChildren = [...group.children]) => {
      const childrenToAnimate = addedChildren.filter((child) => child instanceof HTMLElement);
      childrenToAnimate.forEach((child) => {
        const index = [...group.children].indexOf(child);
        observe(child, 'card', Math.min(Math.max(index, 0) * 75, 300));
      });
    };

    const registerTree = (node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.matches(sectionSelector)) observe(node, node.dataset.motion || 'section');
      if (node.matches('[data-motion="card"]')) observe(node, 'card');
      if (node.matches(gridSelector)) observeGroup(node);
      if (node.matches('main img') && !node.closest(gridSelector)) observe(node, 'image');
      node.querySelectorAll(sectionSelector).forEach((section) => observe(section, section.dataset.motion || 'section'));
      node.querySelectorAll('[data-motion="card"]').forEach((card) => observe(card, 'card'));
      node.querySelectorAll(gridSelector).forEach((group) => observeGroup(group));
      node.querySelectorAll('main img').forEach((image) => {
        if (!image.closest(gridSelector)) observe(image, 'image');
      });
    };

    registerTree(container);

    let mutations;
    if (typeof window.MutationObserver === 'function') {
      mutations = new window.MutationObserver((records) => {
        for (const record of records) {
          const group = record.target.closest?.(gridSelector);
          if (group) {
            observeGroup(group, [...record.addedNodes].filter((node) => node instanceof HTMLElement));
          }
          record.addedNodes.forEach(registerTree);
        }
      });
      mutations.observe(container, { childList: true, subtree: true });

    }

    return () => {
      observer.disconnect();
      mutations?.disconnect();
      pageAnimation?.cancel();
    };
  }, []);

  return <div className="public-page-motion" ref={containerRef}>{children}</div>;
}
