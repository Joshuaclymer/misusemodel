import React, { useState } from 'react';

const PasswordPage = ({ onCorrectPassword, requirePassword = false }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!requirePassword) {
    onCorrectPassword();
    return null;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === 'carrot') {
      onCorrectPassword();
    } else {
      setError('Incorrect password');
      setPassword('');
    }
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        padding: '2rem',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        maxWidth: '400px',
        width: '90%'
      }}>
        <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Enter Password</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              marginBottom: '1rem',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
            placeholder="Enter password"
          />
          {error && <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>}
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#1A4F76',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Submit
          </button>
        </form>
      </div>
    </div>
  );
};

export default PasswordPage;
