/* Decorative motion layer. Every effect is optional: content, navigation and forms work without this file. */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const header = document.querySelector('.site-header');
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const decorative = node => {
    node.setAttribute('aria-hidden', 'true');
    return node;
  };
  const animated = () => !reduceMotion.matches;
  const pointerEffects = () => animated() && finePointer.matches;

  // Aurora backdrop for the dark hero areas.
  document.querySelectorAll('.hero, .page-hero').forEach(hero => {
    const aurora = decorative(element('div', 'xp-aurora'));
    aurora.append(element('i'), element('i'), element('i'), element('span', 'xp-spotlight'));
    hero.prepend(aurora);
  });

  // Services marquee built from the navigation's service links; the strip's original text stays available to screen readers.
  const strip = document.querySelector('.value-strip');
  const services = [...document.querySelectorAll('[data-nav-services] .service-menu-link')].map(link => ({
    icon: link.querySelector('svg'),
    name: link.querySelector('span:not([class])')?.textContent.trim()
  })).filter(service => service.name);
  if (strip && services.length) {
    strip.classList.add('xp-has-ticker');
    const band = decorative(element('div', 'xp-ticker'));
    const viewport = element('div', 'xp-ticker-viewport');
    const track = element('div', 'xp-ticker-track');
    // Two identical halves let the track loop seamlessly at -50%.
    for (let copy = 0; copy < 2; copy++) {
      services.forEach(service => {
        const item = element('span', 'xp-ticker-item');
        if (service.icon) item.append(service.icon.cloneNode(true));
        item.append(element('span', '', service.name));
        track.append(item);
      });
    }
    viewport.append(track);
    band.append(element('p', 'xp-ticker-label', 'Our services'), viewport);
    strip.append(band);
  }

  const footer = document.querySelector('.site-footer');
  if (footer) footer.append(decorative(element('div', 'xp-footer-mark', 'Clarigence')));

  // Scroll progress, compact header and hide-on-scroll-down.
  const progress = decorative(element('div', 'xp-progress'));
  document.body.append(progress);
  let lastY = window.scrollY;
  let ticking = false;
  const headerBusy = () => header && (header.contains(document.activeElement) ||
    header.querySelector('.nav-links.open, .nav-services.is-open'));
  const onScroll = () => {
    ticking = false;
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.setProperty('--xp-progress', max > 0 ? Math.min(y / max, 1).toFixed(4) : '0');
    if (header) {
      header.classList.toggle('is-scrolled', y > 24);
      const hide = y > lastY && y > 320 && !headerBusy();
      if (Math.abs(y - lastY) > 6) header.classList.toggle('is-hidden', hide);
    }
    lastY = y;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScroll);
    }
  }, {passive: true});
  header?.addEventListener('focusin', () => header.classList.remove('is-hidden'));
  onScroll();

  // Process steps light up as they pass the middle of the viewport.
  const steps = [...document.querySelectorAll('.process-grid article')];
  if (steps.length) {
    if (!animated() || !('IntersectionObserver' in window)) {
      steps.forEach(step => step.classList.add('is-lit'));
    } else {
      const stepObserver = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-lit');
          stepObserver.unobserve(entry.target);
        }
      }), {rootMargin: '0px 0px -35% 0px'});
      steps.forEach(step => stepObserver.observe(step));
    }
  }

  // Revealed cards drop their stagger delay so later hover transitions respond immediately.
  document.addEventListener('transitionend', event => {
    if (event.propertyName === 'opacity' && event.target.classList?.contains('reveal')) {
      event.target.style.setProperty('--reveal-delay', '0ms');
    }
  });

  if (!finePointer.matches) return;

  // Card spotlight and gentle tilt; cards rendered later by cms.js are handled through delegation.
  const spotCards = '.service-card, .solution-card, .value-grid article, .work-card, .process-grid article';
  const tiltCards = '.service-card, .work-card';
  let activeCard = null;
  const resetCard = card => {
    card.style.removeProperty('--rx');
    card.style.removeProperty('--ry');
  };
  document.addEventListener('pointermove', event => {
    if (!pointerEffects()) return;
    const card = event.target.closest?.(spotCards);
    if (activeCard && activeCard !== card) resetCard(activeCard);
    activeCard = card;
    if (!card) return;
    if (!card.querySelector(':scope > .xp-spot')) card.prepend(decorative(element('span', 'xp-spot')));
    const box = card.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    card.style.setProperty('--mx', `${x}px`);
    card.style.setProperty('--my', `${y}px`);
    if (card.matches(tiltCards)) {
      card.style.setProperty('--rx', `${((y / box.height) - .5) * -4}deg`);
      card.style.setProperty('--ry', `${((x / box.width) - .5) * 4}deg`);
    }
  }, {passive: true});

  // Hero parallax and spotlight.
  document.querySelectorAll('.hero, .page-hero').forEach(hero => {
    const visual = hero.querySelector('.hero-visual');
    const spotlight = hero.querySelector('.xp-spotlight');
    hero.addEventListener('pointermove', event => {
      if (!pointerEffects()) return;
      const box = hero.getBoundingClientRect();
      if (spotlight) {
        const stage = spotlight.getBoundingClientRect();
        spotlight.style.setProperty('--sx', `${event.clientX - stage.left}px`);
        spotlight.style.setProperty('--sy', `${event.clientY - stage.top}px`);
      }
      if (visual) {
        visual.style.setProperty('--px', (((event.clientX - box.left) / box.width) - .5).toFixed(3));
        visual.style.setProperty('--py', (((event.clientY - box.top) / box.height) - .5).toFixed(3));
      }
    });
    hero.addEventListener('pointerleave', () => {
      visual?.style.removeProperty('--px');
      visual?.style.removeProperty('--py');
    });
  });
})();
