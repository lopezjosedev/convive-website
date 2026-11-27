/* ==========================================================================
   CONVIVE — Acordeón de preguntas frecuentes
   ========================================================================== */
(() => {
  const items = document.querySelectorAll('.accordion-item');
  if (!items.length) return;

  items.forEach((item) => {
    const trigger = item.querySelector('.accordion-trigger');
    trigger?.addEventListener('click', () => {
      const isOpen = item.getAttribute('aria-expanded') === 'true';

      items.forEach((other) => {
        other.setAttribute('aria-expanded', 'false');
        other.querySelector('.accordion-trigger')?.setAttribute('aria-expanded', 'false');
      });

      if (!isOpen) {
        item.setAttribute('aria-expanded', 'true');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });
})();
