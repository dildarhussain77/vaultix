import React from 'react';

interface PasswordStrengthProps {
  password?: string;
}

export default function PasswordStrength({ password }: PasswordStrengthProps) {
  if (!password) return null;

  const getStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 2) return { label: 'Weak', color: 'var(--error-color)', width: '33%' };
    if (score <= 4) return { label: 'Average', color: '#f59e0b', width: '66%' };
    return { label: 'Strong', color: 'var(--success-color)', width: '100%' };
  };

  const { label, color, width } = getStrength(password);

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--text-muted)' }}>
        <span>Password Strength</span>
        <span style={{ color }}>{label}</span>
      </div>
      <div style={{ height: '4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width, backgroundColor: color, transition: 'all 0.3s ease' }}></div>
      </div>
    </div>
  );
}
