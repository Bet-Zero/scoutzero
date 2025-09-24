/**
 * Purpose: Simple centered modal overlay with close behavior.
 * Inputs: isOpen, onClose, title, children.
 * Outputs: Modal overlay with outside-click close.
 * Risks: None known.
 * Next TODO: Review against focus-trap utility for edge cases.
*/
// components/Modal.jsx
import React, { useEffect, useRef } from 'react';

const Modal = ({ title, children, onClose, isOpen = true }) => {
  const modalRef = useRef(null);
  const previouslyFocusedElement = useRef(null);
  const titleId = React.useId();

  useEffect(() => {
    if (!isOpen) return undefined;

    previouslyFocusedElement.current = document.activeElement;

    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose?.();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }

      if (event.key !== 'Tab' || !modalRef.current) {
        return;
      }

      const focusableSelectors = [
        'a[href]',
        'button:not([disabled])',
        'textarea',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ];

      const focusable = modalRef.current.querySelectorAll(
        focusableSelectors.join(',')
      );

      if (!focusable.length) {
        event.preventDefault();
        modalRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    if (modalRef.current) {
      modalRef.current.focus({ preventScroll: true });
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocusedElement.current instanceof HTMLElement) {
        previouslyFocusedElement.current.focus({ preventScroll: true });
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center"
      role="presentation"
    >
      <div
        ref={modalRef}
        className="bg-neutral-800 text-white rounded-2xl shadow-lg p-6 max-w-xl w-full relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
      >
        <button
          onClick={() => onClose?.()}
          className="absolute top-4 right-4 text-white text-xl font-bold hover:text-red-500"
          type="button"
          aria-label="Close"
        >
          ×
        </button>
        {title && (
          <h2 id={titleId} className="text-2xl font-bold mb-4">
            {title}
          </h2>
        )}
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
