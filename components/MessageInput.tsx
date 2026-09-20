'use client';

import { useState, type KeyboardEvent } from 'react';

export function MessageInput({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState('');

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="input-bar">
      <textarea
        rows={1}
        value={value}
        placeholder="Ask anything..."
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button className="send-btn" onClick={submit} disabled={disabled || !value.trim()}>
        Send
      </button>
    </div>
  );
}
