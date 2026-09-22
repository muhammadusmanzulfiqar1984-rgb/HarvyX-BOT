import { HorseRunningIcon, LionRoaringIcon } from './AgentTotems';

type ToolPart = {
  type: string;
  state: string;
  input?: unknown;
  errorText?: string;
  output?: unknown;
};

const AGENT_META: Record<
  string,
  { label: string; cls: 'ops' | 'analyst' | 'social' | 'scrape'; thinking: string }
> = {
  delegateToOps: {
    label: 'OPS AGENT',
    cls: 'ops',
    thinking: 'Horse on the corridor — fetching HarvYX…',
  },
  delegateToAnalyst: {
    label: 'ANALYST AGENT',
    cls: 'analyst',
    thinking: 'Lion in the den — reasoning…',
  },
  delegateToSocial: {
    label: 'SOCIAL AGENT',
    cls: 'social',
    thinking: 'Lion on the platform — strategizing…',
  },
  delegateToScrape: {
    label: 'SCRAPE AGENT',
    cls: 'scrape',
    thinking: 'Horse on the open web — fetching…',
  },
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
 * Specialist activity card — Claude-style “thinking” motion via animal totems:
 * OPS = running horse, Analyst = roaring lion.
 */
export function AgentActivity({ toolType, part }: { toolType: string; part: ToolPart }) {
  const toolName = toolType.slice('tool-'.length);
  const meta = AGENT_META[toolName] ?? {
    label: toolName.toUpperCase(),
    cls: 'ops' as const,
    thinking: 'Working…',
  };
  const task = taskText(part.input);
  const hint = failureHint(part);
  const done = part.state === 'output-available';
  const errored = part.state === 'output-error' || Boolean(hint?.includes('failed'));
  const working = !done && !errored;

  const status = errored ? 'Error' : done ? 'Complete' : 'Thinking';

  return (
    <div className={`agent-activity ${meta.cls}${working ? ' is-thinking' : ''}`}>
      <div className="agent-activity-header">
        <span className="agent-totem-wrap" aria-hidden>
          {meta.cls === 'analyst' || meta.cls === 'social' ? (
            <LionRoaringIcon active={working} />
          ) : (
            <HorseRunningIcon active={working} />
          )}
        </span>
        <span className="agent-activity-name">{meta.label}</span>
        <span className="agent-activity-status">{status}</span>
      </div>
      {working && <div className="agent-thinking-line">{meta.thinking}</div>}
      {task && <div className="agent-activity-task">{task}</div>}
      {errored && hint && <div className="agent-activity-error">{hint}</div>}
    </div>
  );
}
