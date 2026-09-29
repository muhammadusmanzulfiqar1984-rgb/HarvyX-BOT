'use client';

import { parseJson } from '@/lib/client-api';
import { useCallback, useEffect, useState } from 'react';

type BotOpt = { slug: string; name: string; role: string; status: string };
type Room = {
  id: string;
  name: string;
  description: string;
  status: string;
  mode: string;
  botSlugs: string[];
};
type Mission = {
  id: string;
  roomId: string;
  title: string;
  objective: string;
  status: string;
  progressPct: number;
  resultSummary?: string;
  selectedBots: string[];
};
type Task = {
  id: string;
  title: string;
  assignedBot: string;
  status: string;
  pool: string;
  errorMessage?: string;
};
type Pool = { slug: string; name: string; capacity: number; activeRuns: number; enabled: boolean };
type Progress = {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  waiting: number;
  pending: number;
  byPool: Record<string, { running: number; queued: number }>;
};
type Msg = { id: string; role: string; botSlug?: string | null; content: string };
type Event = { id: string; event: string; detail: Record<string, unknown>; createdAt: string };

type Tab = 'missions' | 'teams' | 'pools' | 'activity';

export function MissionControlView() {
  const [tab, setTab] = useState<Tab>('missions');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bots, setBots] = useState<BotOpt[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [activity, setActivity] = useState<Event[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chatText, setChatText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Create forms
  const [roomName, setRoomName] = useState('UAE Market Entry');
  const [roomBots, setRoomBots] = useState<string[]>(['mian', 'scrape', 'analyst']);
  const [missionTitle, setMissionTitle] = useState('Research a test market');
  const [missionObjective, setMissionObjective] = useState(
    'Research a test market and prepare a short analysis.',
  );

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) ?? null;
  const selectedMission = missions.find((m) => m.id === selectedMissionId) ?? null;

  const refreshTeams = useCallback(async () => {
    const res = await fetch('/api/teams');
    const data = await parseJson(res);
    if (!res.ok) throw new Error(data?.error || 'Failed to load teams.');
    setRooms(data.rooms || []);
    setBots(data.selectableBots || []);
  }, []);

  const refreshMissions = useCallback(async () => {
    const q = selectedRoomId ? `?roomId=${encodeURIComponent(selectedRoomId)}` : '';
    const res = await fetch(`/api/missions${q}`);
    const data = await parseJson(res);
    if (!res.ok) throw new Error(data?.error || 'Failed to load missions.');
    setMissions(data.missions || []);
    setPools(data.pools || []);
    setActivity(data.activity || []);
  }, [selectedRoomId]);

  const refreshMissionDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/missions/${id}`);
    const data = await parseJson(res);
    if (!res.ok) throw new Error(data?.error || 'Failed to load mission.');
    setTasks(data.tasks || []);
    setProgress(data.progress || null);
    if (data.mission) {
      setMissions((prev) => {
        const others = prev.filter((m) => m.id !== data.mission.id);
        return [data.mission, ...others];
      });
    }
  }, []);

  const refreshRoom = useCallback(async (id: string) => {
    const res = await fetch(`/api/teams/${id}`);
    const data = await parseJson(res);
    if (!res.ok) throw new Error(data?.error || 'Failed to load room.');
    setMessages(data.messages || []);
    if (data.room) {
      setRooms((prev) => {
        const others = prev.filter((r) => r.id !== data.room.id);
        return [data.room, ...others];
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshTeams();
        await refreshMissions();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Load failed.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshTeams, refreshMissions]);

  useEffect(() => {
    if (selectedMissionId) void refreshMissionDetail(selectedMissionId).catch(() => undefined);
  }, [selectedMissionId, refreshMissionDetail]);

  useEffect(() => {
    if (selectedRoomId) void refreshRoom(selectedRoomId).catch(() => undefined);
  }, [selectedRoomId, refreshRoom]);

  async function createRoom() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName, botSlugs: roomBots, mode: 'manager_led' }),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Create room failed.');
      setInfo(`Room created: ${data.room.name}`);
      setSelectedRoomId(data.room.id);
      await refreshTeams();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create room failed.');
    } finally {
      setBusy(false);
    }
  }

  async function createMission() {
    if (!selectedRoomId) {
      setError('Select or create a Team Room first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: selectedRoomId,
          title: missionTitle,
          objective: missionObjective,
          selectedBots: selectedRoom?.botSlugs,
        }),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Create mission failed.');
      setInfo(`Mission created: ${data.mission.title}`);
      setSelectedMissionId(data.mission.id);
      await refreshMissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create mission failed.');
    } finally {
      setBusy(false);
    }
  }

  async function missionAction(action: 'start' | 'pause' | 'resume' | 'cancel') {
    if (!selectedMissionId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/missions/${selectedMissionId}/${action}`, { method: 'POST' });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || `${action} failed.`);
      setInfo(`Mission ${action} OK — status=${data.mission?.status || data.mission?.status}`);
      await refreshMissionDetail(selectedMissionId);
      await refreshMissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed.`);
    } finally {
      setBusy(false);
    }
  }

  async function sendChat() {
    if (!selectedRoomId || !chatText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/teams/${selectedRoomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'message', text: chatText }),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Send failed.');
      setChatText('');
      await refreshRoom(selectedRoomId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed.');
    } finally {
      setBusy(false);
    }
  }

  function toggleRoomBot(slug: string) {
    setRoomBots((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  return (
    <div className="view-shell shell-view">
      <div className="view-header">
        <h1>Mission Control</h1>
        <p>
          Team Rooms, Missions, task queues, and worker pools — orchestration above Bot Factory.
          Manager-led by default; use @Bot to target.
        </p>
      </div>

      <div className="shell-tabs" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['missions', 'teams', 'pools', 'activity'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? 'shell-btn shell-btn-primary' : 'shell-btn'}
            onClick={() => setTab(t)}
            disabled={busy}
          >
            {t}
          </button>
        ))}
      </div>

      {error ? (
        <p className="shell-error" role="alert">
          {error}
        </p>
      ) : null}
      {info ? <p className="shell-muted">{info}</p> : null}

      {tab === 'teams' && (
        <div className="shell-grid-2" style={{ display: 'grid', gap: 24, gridTemplateColumns: '1fr 1fr' }}>
          <section className="shell-panel">
            <h2>Create Team Room</h2>
            <label className="shell-field">
              <span>Name</span>
              <input value={roomName} onChange={(e) => setRoomName(e.target.value)} disabled={busy} />
            </label>
            <div className="shell-field">
              <span>Bots</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {bots.map((b) => (
                  <label key={b.slug} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={roomBots.includes(b.slug)}
                      onChange={() => toggleRoomBot(b.slug)}
                      disabled={busy || b.slug === 'mian'}
                    />
                    {b.name}
                  </label>
                ))}
              </div>
            </div>
            <button type="button" className="shell-btn shell-btn-primary" onClick={createRoom} disabled={busy}>
              Create room
            </button>
          </section>
          <section className="shell-panel">
            <h2>Rooms</h2>
            <ul className="shell-list">
              {rooms.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="shell-linkish"
                    onClick={() => {
                      setSelectedRoomId(r.id);
                      setTab('missions');
                    }}
                  >
                    {r.name} — {r.status} ({r.botSlugs.join(', ')})
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {tab === 'missions' && (
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: '220px 1fr 260px',
            minHeight: 420,
          }}
        >
          <section className="shell-panel">
            <h2>Team</h2>
            <select
              value={selectedRoomId || ''}
              onChange={(e) => setSelectedRoomId(e.target.value || null)}
              disabled={busy}
            >
              <option value="">Select room…</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            {selectedRoom ? (
              <ul className="shell-list" style={{ marginTop: 12 }}>
                {selectedRoom.botSlugs.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            ) : null}
            <hr />
            <h3>New mission</h3>
            <label className="shell-field">
              <span>Title</span>
              <input value={missionTitle} onChange={(e) => setMissionTitle(e.target.value)} disabled={busy} />
            </label>
            <label className="shell-field">
              <span>Objective</span>
              <textarea
                value={missionObjective}
                onChange={(e) => setMissionObjective(e.target.value)}
                disabled={busy}
                rows={3}
              />
            </label>
            <button type="button" className="shell-btn shell-btn-primary" onClick={createMission} disabled={busy}>
              Create mission
            </button>
            <ul className="shell-list" style={{ marginTop: 12 }}>
              {missions.map((m) => (
                <li key={m.id}>
                  <button type="button" className="shell-linkish" onClick={() => setSelectedMissionId(m.id)}>
                    {m.title} — {m.status} ({m.progressPct}%)
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="shell-panel">
            <h2>Chat</h2>
            <div
              style={{
                minHeight: 240,
                maxHeight: 320,
                overflow: 'auto',
                border: '1px solid var(--border, #333)',
                padding: 12,
                marginBottom: 12,
              }}
            >
              {messages.map((m) => (
                <div key={m.id} style={{ marginBottom: 8 }}>
                  <strong>
                    {m.role === 'user' ? 'YOU' : (m.botSlug || m.role).toUpperCase()}
                  </strong>
                  <div>{m.content}</div>
                </div>
              ))}
              {!messages.length ? <p className="shell-muted">No messages yet. Try @Analyst or plain text.</p> : null}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ flex: 1 }}
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="@Research investigate competitors…"
                disabled={busy || !selectedRoomId}
              />
              <button type="button" className="shell-btn" onClick={sendChat} disabled={busy || !selectedRoomId}>
                Send
              </button>
            </div>
          </section>

          <section className="shell-panel">
            <h2>Mission</h2>
            {selectedMission ? (
              <>
                <p>
                  <strong>{selectedMission.title}</strong>
                  <br />
                  {selectedMission.status.toUpperCase()} · {selectedMission.progressPct}%
                </p>
                <p className="shell-muted">{selectedMission.objective}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  <button type="button" className="shell-btn shell-btn-primary" onClick={() => missionAction('start')} disabled={busy}>
                    Start
                  </button>
                  <button type="button" className="shell-btn" onClick={() => missionAction('pause')} disabled={busy}>
                    Pause
                  </button>
                  <button type="button" className="shell-btn" onClick={() => missionAction('resume')} disabled={busy}>
                    Resume
                  </button>
                  <button type="button" className="shell-btn" onClick={() => missionAction('cancel')} disabled={busy}>
                    Cancel
                  </button>
                </div>
                {progress ? (
                  <dl className="shell-dl">
                    <div>
                      <dt>Queued</dt>
                      <dd>{progress.queued}</dd>
                    </div>
                    <div>
                      <dt>Running</dt>
                      <dd>{progress.running}</dd>
                    </div>
                    <div>
                      <dt>Completed</dt>
                      <dd>{progress.completed}</dd>
                    </div>
                    <div>
                      <dt>Failed</dt>
                      <dd>{progress.failed}</dd>
                    </div>
                  </dl>
                ) : null}
                <h3>Tasks</h3>
                <ul className="shell-list">
                  {tasks.map((t) => (
                    <li key={t.id}>
                      [{t.status}] {t.assignedBot}: {t.title}
                      {t.errorMessage ? ` — ${t.errorMessage}` : ''}
                    </li>
                  ))}
                </ul>
                {selectedMission.resultSummary ? (
                  <>
                    <h3>Results</h3>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{selectedMission.resultSummary}</pre>
                  </>
                ) : null}
              </>
            ) : (
              <p className="shell-muted">Select a mission.</p>
            )}
          </section>
        </div>
      )}

      {tab === 'pools' && (
        <section className="shell-panel">
          <h2>Worker Pools</h2>
          <p className="shell-muted">
            Queue-based execution. Capacity is configurable (1–1000) without rewriting the system. Workers are not
            permanent LLM chats.
          </p>
          <table className="shell-table">
            <thead>
              <tr>
                <th>Pool</th>
                <th>Capacity</th>
                <th>Active</th>
                <th>Enabled</th>
              </tr>
            </thead>
            <tbody>
              {pools.map((p) => (
                <tr key={p.slug}>
                  <td>{p.name}</td>
                  <td>{p.capacity}</td>
                  <td>{p.activeRuns}</td>
                  <td>{p.enabled ? 'yes' : 'no'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'activity' && (
        <section className="shell-panel">
          <h2>Activity</h2>
          <ul className="shell-list">
            {activity.map((e) => (
              <li key={e.id}>
                <code>{e.createdAt}</code> — {e.event}
              </li>
            ))}
            {!activity.length ? <li className="shell-muted">No events yet.</li> : null}
          </ul>
        </section>
      )}
    </div>
  );
}
