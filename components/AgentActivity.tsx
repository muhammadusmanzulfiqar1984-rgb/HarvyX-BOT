type ToolPart = {
  type: string;
  state: string;
  input?: unknown;
  errorText?: string;
  output?: unknown;
};

const AGENT_META: Record<string, { label: string; cls: string }> = {
  delegateToOps:     { label: 'OPS AGENT',     cls: 'ops' },
  delegateToAnalyst: { label: 'ANALYST AGENT',  cls: 'analyst' },
};

function taskText(input: unknown): string | null {
  if (input && typeof input === 'object' && 'task' in input) {
    const t = (input as { task?: unknown }).task;
    return typeof t === 'string' ? t : null;
  }
  return null;
}

function failureHint(part: ToolPart): string | null {
  if (part.state === 'output-error' && typeof part.errorText === 'string' && part.errorText.trim()) {
    return part.errorText.slice(0, 200);
  }
  if (typeof part.output === 'string' && part.output.includes(' failed ·')) {
    return part.output.slice(0, 240);
  }
  return null;
}

export function AgentActivity({ toolType, part }: { toolType: string; part: ToolPart }) {
  const toolName = toolType.slice('tool-'.length);
  const meta = AGENT_META[toolName] ?? { label: toolName.toUpperCase(), cls: 'ops' };
  const task = taskText(part.input);
  const hint = failureHint(part);
  const done = part.state === 'output-available';
  const errored = part.state === 'output-error' || Boolean(hint?.includes('failed'));

  const status = errored ? 'Error' : done ? 'Complete' : 'Working';
  const dotClass = `agent-dot ${errored ? 'error' : done ? 'done' : 'working'}`;

  return (
    <div className={`agent-activity ${meta.cls}`}>
      <div className="agent-activity-header">
        <span className={dotClass} aria-hidden />
        <span className="agent-activity-name">{meta.label}</span>
        <span className="agent-activity-status">{status}</span>
      </div>
      {task && <div className="agent-activity-task">{task}</div>}
      {errored && hint && <div className="agent-activity-error">{hint}</div>}
    </div>
  );
}
