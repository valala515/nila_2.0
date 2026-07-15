import { useState, type FormEvent } from 'react';

export interface TokenGateProps {
  error: boolean;
  onSubmit: (token: string) => void;
}

export function TokenGate({ error, onSubmit }: TokenGateProps) {
  const [value, setValue] = useState('');

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  }

  return (
    <form className="token-gate" onSubmit={handleSubmit}>
      <h1>Nila AI Dashboard</h1>
      <p>Enter the dashboard access token to continue.</p>
      <input
        type="password"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Dashboard token"
        autoFocus
      />
      <button type="submit">Continue</button>
      {error && <div className="token-gate-error">Invalid token — try again.</div>}
    </form>
  );
}
