/* ==========================================================================
   CONVIVE — Formulario de solicitud de demostración
   Validación en cliente + estado de envío simulado.
   Para producción: reemplazar `submitDemoRequest` por la llamada real
   (fetch a un endpoint propio, o integración con CRM / email).
   ========================================================================== */
(() => {
  const form = document.querySelector('#demo-form');
  if (!form) return;

  const statusBox = form.querySelector('.form-status');
  const submitBtn = form.querySelector('[type="submit"]');
  const submitLabel = submitBtn.querySelector('.btn-label') || submitBtn;
  const submitLabelDefault = submitLabel.textContent;

  const validators = {
    name: (v) => v.trim().length >= 2,
    school: (v) => v.trim().length >= 2,
    role: (v) => v.trim().length >= 2,
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
    phone: (v) => v.trim().length === 0 || /^[0-9+\s()-]{6,}$/.test(v.trim()),
  };

  const validateField = (field) => {
    const name = field.name;
    const validate = validators[name];
    if (!validate) return true;

    const wrapper = field.closest('.field');
    const valid = validate(field.value);
    wrapper?.classList.toggle('has-error', !valid);
    return valid;
  };

  form.querySelectorAll('input, select, textarea').forEach((field) => {
    field.addEventListener('blur', () => validateField(field));
    field.addEventListener('input', () => {
      if (field.closest('.field')?.classList.contains('has-error')) {
        validateField(field);
      }
    });
  });

  // Simula el envío a un backend. Reemplazar por la integración real.
  const submitDemoRequest = (payload) =>
    new Promise((resolve) => {
      console.info('[CONVIVE] Solicitud de demo (simulada):', payload);
      setTimeout(resolve, 900);
    });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fields = Array.from(form.querySelectorAll('input, select, textarea'));
    const allValid = fields
      .filter((f) => validators[f.name])
      .map(validateField)
      .every(Boolean);

    if (!allValid) {
      form.querySelector('.field.has-error input, .field.has-error select')?.focus();
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());

    submitBtn.disabled = true;
    submitLabel.textContent = 'Enviando...';

    await submitDemoRequest(data);

    form.reset();
    submitBtn.disabled = false;
    submitLabel.textContent = submitLabelDefault;
    statusBox?.classList.add('is-visible');

    setTimeout(() => statusBox?.classList.remove('is-visible'), 6000);
  });
})();
