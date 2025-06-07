// src/PasswordGate.jsx
import { useState } from 'react';

const PasswordGate = ({ children }) => {
  const [accessGranted, setAccessGranted] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const correctPassword = 'Makenzie1!'; // change this to your real password

  const handleSubmit = (e) => {
    e.preventDefault();
    if (passwordInput === correctPassword) {
      setAccessGranted(true);
    } else {
      alert('Incorrect password');
    }
  };

  if (accessGranted) return children;

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-neutral-900 text-white px-6">
      <h1 className="text-2xl font-bold mb-4">
        Enter Password to Access ScoutZero
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col items-center">
        <input
          type="password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          className="px-4 py-2 rounded text-black mb-3 w-64"
          placeholder="Enter password"
        />
        <button
          type="submit"
          className="bg-white text-black px-4 py-2 rounded shadow"
        >
          Submit
        </button>
      </form>
    </div>
  );
};

export default PasswordGate;
