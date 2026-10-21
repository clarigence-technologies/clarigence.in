const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav-links');
const servicesGroup = document.querySelector('.nav-services');
const servicesToggle = document.querySelector('.services-toggle');
const servicesDropdown = document.querySelector('.services-dropdown');
let servicesCloseTimer;
const setServicesOpen = (open, returnFocus = false) => {
  if (!servicesGroup || !servicesToggle || !servicesDropdown) return;
  clearTimeout(servicesCloseTimer);
  servicesGroup.classList.toggle('is-open', open);
  servicesToggle.setAttribute('aria-expanded', String(open));
  servicesDropdown.inert = !open;
  if (returnFocus) servicesToggle.focus();
};
if (servicesGroup && servicesToggle) {
  servicesToggle.addEventListener('click', () => setServicesOpen(servicesToggle.getAttribute('aria-expanded') !== 'true'));
  servicesGroup.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse' && window.innerWidth > 900) setServicesOpen(true);
  });
  servicesGroup.addEventListener('pointerleave', event => {
    if (event.pointerType === 'mouse' && window.innerWidth > 900) {
      servicesCloseTimer = setTimeout(() => {
        if (!servicesGroup.contains(document.activeElement)) setServicesOpen(false);
      }, 160);
    }
  });
  servicesGroup.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      setServicesOpen(false, true);
    } else if (event.key === 'ArrowDown' && event.target === servicesToggle) {
      event.preventDefault();
      setServicesOpen(true);
      servicesDropdown.querySelector('a')?.focus();
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!servicesGroup.contains(event.target)) setServicesOpen(false);
  });
  document.addEventListener('focusin', event => {
    if (!servicesGroup.contains(event.target)) setServicesOpen(false);
  });
  window.matchMedia('(max-width: 900px)').addEventListener('change', () => setServicesOpen(false));
}
if (menuButton && nav) {
  const closeMenu = (returnFocus = false) => {
    setServicesOpen(false);
    nav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
    if (returnFocus) menuButton.focus();
  };
  menuButton.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  nav.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('open')) closeMenu(true);
  });
  document.addEventListener('click', event => {
    if (!nav.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
  });
  document.addEventListener('focusin', event => {
    if (!nav.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 900) closeMenu(); });
}

document.querySelectorAll('.contact-form').forEach(form => {
  const status = form.querySelector('#form-status');
  const fields = [...form.querySelectorAll('[name]')];
  const messages = {
    name: 'Enter your name (up to 120 characters).',
    email: 'Enter a valid email address (up to 254 characters).',
    phone: 'Use 7–30 characters: digits, spaces, +, parentheses, dots or hyphens.',
    company: 'Use up to 160 characters for the company name.',
    service: 'Please choose a service.',
    message: 'Enter a message between 10 and 5,000 characters.'
  };
  const setFieldError = (field, message = '') => {
    const error = form.querySelector(`#${field.name}-error`);
    if (error) error.textContent = message;
    if (message) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
  };
  const notify = (message, state) => {
    status.textContent = message;
    status.dataset.state = state;
  };
  const isValid = field => {
    const min = Number(field.getAttribute('minlength') || 0);
    const max = Number(field.getAttribute('maxlength') || Infinity);
    return field.checkValidity() && field.value.length >= min && field.value.length <= max;
  };
  fields.forEach(field => {
    field.addEventListener('input', () => setFieldError(field));
    field.addEventListener('change', () => setFieldError(field));
  });
  const requested = new URLSearchParams(location.search).get('service');
  if (requested) {
    const match = [...form.elements.service.options].find(option =>
      option.textContent.toLowerCase().replaceAll(' ', '-') === requested);
    if (match) form.elements.service.value = match.value;
  }
  let submissionKey = null;
  let submittedBody = null;
  form.noValidate = true;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('[type=submit]');
    if (button.disabled) return;
    if (form.elements.service.disabled) {
      notify('Services are temporarily unavailable. Please try again later or contact us by email.', 'error');
      return;
    }
    fields.forEach(field => {
      if (field.type !== 'select-one') field.value = field.value.trim();
      setFieldError(field, isValid(field) ? '' : messages[field.name]);
    });
    const invalid = fields.find(field => !isValid(field));
    if (invalid) {
      notify('Please check the highlighted fields.', 'error');
      invalid.focus();
      return;
    }
    const body = JSON.stringify(Object.fromEntries(new FormData(form)));
    if (body !== submittedBody || !submissionKey) {
      submissionKey = crypto.randomUUID();
      submittedBody = body;
    }
    const original = button.innerHTML;
    button.disabled = true;
    button.textContent = 'Sending enquiry…';
    form.setAttribute('aria-busy', 'true');
    notify('Sending your enquiry…', 'pending');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const endpoint = window.CLARIGENCE_CONFIG?.contactApiUrl;
      if (!endpoint) throw new Error('Missing contact configuration');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json', 'Idempotency-Key': submissionKey},
        body,
        signal: controller.signal
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const names = response.status === 400
          ? fields.filter(field => Object.hasOwn(result?.fieldErrors || {}, field.name)) : [];
        names.forEach(field => setFieldError(field, messages[field.name]));
        notify(names.length ? 'Please check the highlighted fields.' :
          'We couldn’t send your enquiry right now. Please try again or email hello@clarigence.in.', 'error');
        if (names.length) names[0].focus();
        return;
      }
      if (response.status !== 201 || !Number.isSafeInteger(result?.id) || result.id < 1) throw new Error('Unexpected response');
      form.reset();
      submissionKey = null;
      submittedBody = null;
      notify('Thank you. Your enquiry has been sent. We’ll be in touch to discuss your project.', 'success');
      status.focus();
    } catch {
      notify('We couldn’t confirm your enquiry. Please try again later or email hello@clarigence.in.', 'error');
    } finally {
      clearTimeout(timeout);
      button.disabled = false;
      button.innerHTML = original;
      form.removeAttribute('aria-busy');
    }
  });
});

document.querySelectorAll('[data-year]').forEach(node => { node.textContent = new Date().getFullYear(); });
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const observed = new WeakSet();
const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting && entry.intersectionRatio >= .08) {
      entry.target.classList.remove('reveal-pending');
      observer.unobserve(entry.target);
    }
  }), {threshold: .08, rootMargin: '0px 0px -32px 0px'}) : null;
function observeMotion(root = document) {
  if (!observer || motionPreference.matches) return;
  root.querySelectorAll('main > section:not(.hero):not(.page-hero), .section-heading, .service-card, .value-grid article, .work-card, .solution-card, .process-grid article, .service-detail').forEach(node => {
    if (observed.has(node)) return;
    observed.add(node);
    node.classList.add('reveal');
    const siblings = [...node.parentElement.children].filter(child => child.matches('.service-card, article'));
    const index = siblings.indexOf(node);
    if (index >= 0) node.style.setProperty('--reveal-delay', `${Math.min(index * 65, 260)}ms`);
    node.classList.add('reveal-pending');
    observer.observe(node);
  });
}
window.ClarigenceMotion = Object.freeze({observe: observeMotion});
observeMotion();
motionPreference.addEventListener('change', event => {
    if (event.matches) {
      document.querySelectorAll('.reveal-pending').forEach(node => node.classList.remove('reveal-pending'));
      observer?.disconnect();
    }
});
