type ToolPart = {
  type: string;
  state: string;
  input?: unknown;
  errorText?: string;
  output?: unknown;
};

const AGENT_LABEL: Record<string, string> = {
  delegateToOps: 'OPS',
  delegateToAnalyst: 'ANALYST',
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

/**
 * Renders Manager delegate-to-{ops,analyst} tool calls as a named agent's
 * activity card. Only reflects real UI-part state — no invented sub-steps.
 */
export function AgentActivity({ toolType, part }: { toolType: string; part: ToolPart }) {
  const toolName = toolType.slice('tool-'.length);
  const label = AGENT_LABEL[toolName] ?? toolName;
  const task = taskText(part.input);
  const hint = failureHint(part);
  const done = part.state === 'output-available';
  const errored = part.state === 'output-error' || Boolean(hint && hint.includes('failed'));

  const status = errored ? 'Error' : done ? 'Complete' : 'Working';
  const dotClass = errored ? 'agent-dot error' : done ? 'agent-dot done' : 'agent-dot working';

  return (
    <div className="agent-activity">
      <div className="agent-activity-header">
        <span className={dotClass} aria-hidden />
        <span className="agent-activity-name">{label}</span>
        <span className="agent-activity-status">{status}</span>
      </div>
      {task && <div className="agent-activity-task">{task}</div>}
      {errored && hint && <div className="agent-activity-error">{hint}</div>}
    </div>
  );
}
