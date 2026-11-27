/* ==========================================================================
   CONVIVE — Diagrama animado "Cómo funciona"
   Resalta cada paso en secuencia cuando la sección entra en viewport,
   y luego permite activar un paso al pasar el mouse / foco.
   ========================================================================== */
(() => {
  const flow = document.querySelector('[data-flow]');
  if (!flow) return;

  const steps = Array.from(flow.querySelectorAll('.flow-step'));
  const connectors = Array.from(flow.querySelectorAll('.flow-connector'));
  if (!steps.length) return;

  let sequenceTimer = null;
  let hasRun = false;

  const clearActive = () => {
    steps.forEach((s) => s.classList.remove('is-active'));
    connectors.forEach((c) => c.classList.remove('is-active'));
  };

  const activateStep = (index) => {
    clearActive();
    steps[index]?.classList.add('is-active');
    if (index > 0) connectors[index - 1]?.classList.add('is-active');
  };

  const runSequence = () => {
    let i = 0;
    activateStep(i);
    sequenceTimer = setInterval(() => {
      i = (i + 1) % steps.length;
      activateStep(i);
    }, 1600);
  };

  const stopSequence = () => {
    clearInterval(sequenceTimer);
  };

  steps.forEach((step, index) => {
    step.addEventListener('mouseenter', () => {
      stopSequence();
      activateStep(index);
    });
    step.addEventListener('mouseleave', () => {
      if (hasRun) runSequence();
    });
  });

  const start = () => {
    if (hasRun) return;
    hasRun = true;
    runSequence();
  };

  if (!('IntersectionObserver' in window)) {
    start();
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          start();
          obs.disconnect();
        }
      });
    },
    { threshold: 0.4 }
  );

  observer.observe(flow);
})();
