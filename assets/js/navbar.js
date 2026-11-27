/* ==========================================================================
   CONVIVE — Navbar: estado al hacer scroll + menú móvil
   ========================================================================== */
(() => {
  const navbar = document.querySelector('.navbar');
  const toggle = document.querySelector('.nav-toggle');
  const mobileMenu = document.querySelector('.mobile-menu');
  const mobileClose = document.querySelector('.mobile-menu-close');
  const mobileLinks = document.querySelectorAll('.mobile-menu a');

  if (!navbar) return;

  const SCROLL_THRESHOLD = 12;

  const onScroll = () => {
    navbar.classList.toggle('is-scrolled', window.scrollY > SCROLL_THRESHOLD);
  };

  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const openMenu = () => {
    mobileMenu?.classList.add('is-open');
    toggle?.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };

  const closeMenu = () => {
    mobileMenu?.classList.remove('is-open');
    toggle?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  toggle?.addEventListener('click', () => {
    const isOpen = mobileMenu?.classList.contains('is-open');
    isOpen ? closeMenu() : openMenu();
  });

  mobileClose?.addEventListener('click', closeMenu);
  mobileLinks.forEach((link) => link.addEventListener('click', closeMenu));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
})();
