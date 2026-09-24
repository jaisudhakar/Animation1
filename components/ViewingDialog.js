'use client';

import { useEffect, useRef, useState } from 'react';

/* A quiet, native <dialog> for viewing requests. No backend: wire `onSubmit`
   to your CRM or an API route when you go live. */
export default function ViewingDialog({ open, onClose, copy }) {
  const ref = useRef(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setSent(false);
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  const onSubmit = (e) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <dialog
      ref={ref}
      className="viewing"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="viewing-title"
    >
      <div className="viewing-inner">
        <button type="button" className="viewing-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        {sent ? (
          <p className="viewing-confirm">{copy.confirm}</p>
        ) : (
          <form onSubmit={onSubmit}>
            <h3 id="viewing-title">{copy.button}</h3>
            <p className="viewing-note">Private. Discreet. By invitation of the atelier.</p>
            <label>
              <span>Name</span>
              <input name="name" required autoComplete="name" />
            </label>
            <label>
              <span>Email</span>
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label>
              <span>City</span>
              <input name="city" autoComplete="address-level2" />
            </label>
            <button type="submit" className="cta-button small">
              <span>Send request</span>
              <i aria-hidden="true" />
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
}
