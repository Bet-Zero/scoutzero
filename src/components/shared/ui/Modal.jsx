/**
 * Purpose: Simple centered modal overlay with close behavior.
 * Inputs: isOpen, onClose, title, children.
 * Outputs: Modal overlay with outside-click close.
 * Risks: No focus trap/return focus; missing ESC handler; ARIA gaps.
 * Next TODO: Add role/aria-modal/labelledby; trap focus; ESC to close; restore focus.
 */
// components/Modal.jsx
import React, { useRef, useEffect } from 'react';

const Modal = ({ title, children, onClose }) => {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
      <div
        ref={modalRef}
        className="bg-neutral-800 text-white rounded-2xl shadow-lg p-6 max-w-xl w-full relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white text-xl font-bold hover:text-red-500"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold mb-4">{title}</h2>
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
