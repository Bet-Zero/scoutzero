import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { StrictMode, useState } from 'react';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from '@testing-library/react';
import { WorldSelector } from '@/features/architect/GMDashboard/components/WorldSelector';
import { writePersistedActiveWorldId } from '@/features/architect/GMDashboard/hooks/useArchitectState.helpers';
import { auth } from '@/firebaseConfig';
import {
  createWorld,
  recoverPendingWorldCreation,
} from '@/features/architect/utils/worldManager.core';
import {
  readPendingWorldCreation,
  acknowledgeWorldCreation,
} from '@/features/architect/utils/worldCreationRecovery';
import { seedMockData } from '../../../tests/__mocks__/firebase';

const input = { name: 'Recovery probe', userId: 'synthetic-owner' };
const sent: Array<{ worldId: string; userId: string }> = [];
function commit(body: { worldId: string; userId: string }) {
  seedMockData(`architect_worlds/${body.worldId}`, {
    worldId: body.worldId,
    createdBy: body.userId,
    worldName: input.name,
  });
}
function response(status: number, worldId?: string) {
  return {
    ok: status === 200,
    status,
    json: async () =>
      status === 200 ? { ok: true, worldId } : { error: 'unavailable' },
  };
}
beforeEach(() => {
  localStorage.clear();
  sent.length = 0;
  vi.stubEnv('VITE_SCOUTZERO_WORLD_HTTP', 'true');
  Object.assign(auth, {
    currentUser: { uid: input.userId, getIdToken: async () => 'synthetic' },
  });
  let tail: Promise<unknown> = Promise.resolve();
  vi.stubGlobal('navigator', {
    locks: {
      request: (_key: string, run: () => Promise<unknown>) => {
        const next = tail.then(run);
        tail = next.catch(() => {});
        return next;
      },
    },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function Selector({
  onSelect,
  restored = true,
}: {
  onSelect: (id: string | null) => void;
  restored?: boolean;
}) {
  const [worldId, setWorldId] = useState<string | null>(null);
  return (
    <WorldSelector
      userId={input.userId}
      activeWorldOwner={{
        worldId,
        identityToken: 1,
        hasRestoredActiveWorld: restored,
        setActiveWorld: (id) => {
          setWorldId(id);
          writePersistedActiveWorldId(input.userId, id);
          onSelect(id);
        },
      }}
      worldModeBoundary={
        worldId
          ? { kind: 'world', worldId, onReloadWorldData: async () => null }
          : { kind: 'sandbox', worldId: null, onReloadWorldData: null }
      }
    />
  );
}

describe('HTTP creation identity and recovery', () => {
  it('keeps recovery state until active selection is successfully persisted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) => {
        const body = JSON.parse(options.body);
        commit(body);
        return response(200, body.worldId);
      })
    );
    const result = await createWorld(input);
    const write = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('storage full');
      });
    expect(() =>
      writePersistedActiveWorldId(input.userId, result.worldId)
    ).toThrow();
    expect(readPendingWorldCreation(input.userId)?.worldId).toBe(
      result.worldId
    );
    write.mockRestore();
    writePersistedActiveWorldId(input.userId, result.worldId);
    expect(readPendingWorldCreation(input.userId)).toBeNull();
    expect(
      localStorage.getItem(`architect.activeWorldId.${input.userId}`)
    ).toBe(result.worldId);
  });
  it('never adopts a committed root owned by someone else during ambiguous recovery', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) => {
        const body = JSON.parse(options.body);
        commit({ ...body, userId: 'another-owner' });
        throw new Error('lost response');
      })
    );
    await expect(createWorld(input)).rejects.toThrow('could not be confirmed');
    expect(readPendingWorldCreation(input.userId)).not.toBeNull();
  });
  it('does not retain or transmit invalid new request data', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(
      createWorld({ ...input, name: 'x'.repeat(121) })
    ).rejects.toThrow();
    expect(readPendingWorldCreation(input.userId)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('a remounted selector recovers and selects the committed world, then clears the pending request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(503))
    );
    await expect(createWorld(input)).rejects.toThrow();
    const pending = readPendingWorldCreation(input.userId)!;
    commit(pending);
    // The response can remain unavailable: owner-authorized metadata confirms it.
    const onSelect = vi.fn();
    const rendered = render(
      <StrictMode>
        <Selector onSelect={onSelect} restored={false} />
      </StrictMode>
    );
    await screen.findByTitle('Create new world');
    expect(onSelect).not.toHaveBeenCalled();
    rendered.rerender(
      <StrictMode>
        <Selector onSelect={onSelect} />
      </StrictMode>
    );
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(pending.worldId));
    await waitFor(() =>
      expect(readPendingWorldCreation(input.userId)).toBeNull()
    );
  });
  it('a failed reload recovery offers an explicit same-ID retry instead of silently consuming another attempt', async () => {
    let succeed = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) => {
        const body = JSON.parse(options.body);
        sent.push(body);
        if (succeed) {
          commit(body);
          return response(200, body.worldId);
        }
        return response(429);
      })
    );
    await expect(createWorld(input)).rejects.toThrow();
    const pending = readPendingWorldCreation(input.userId)!;
    const onSelect = vi.fn();
    render(<Selector onSelect={onSelect} />);
    const retry = await screen.findByRole('button', {
      name: 'Retry world creation',
    });
    await waitFor(() =>
      expect((retry as HTMLButtonElement).disabled).toBe(false)
    );
    expect(onSelect).not.toHaveBeenCalled();
    expect(sent).toHaveLength(2);
    expect(
      (screen.getByTitle('Create new world') as HTMLButtonElement).disabled
    ).toBe(true);
    succeed = true;
    fireEvent.click(retry);
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(pending.worldId));
    expect(sent).toHaveLength(3);
    expect(new Set(sent.map((b) => b.worldId)).size).toBe(1);
  });
  it('retains the same payload through failure, reload and concurrent retry; acknowledges only the selected result', async () => {
    let fail = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) => {
        const body = JSON.parse(options.body);
        sent.push(body);
        if (fail) return response(503);
        commit(body);
        return response(200, body.worldId);
      })
    );
    await expect(createWorld(input)).rejects.toThrow('could not be confirmed');
    const pending = readPendingWorldCreation(input.userId)!;
    // The recovery entry point receives no in-memory request, just the owner.
    fail = false;
    const [a, b] = await Promise.all([
      recoverPendingWorldCreation(input.userId),
      createWorld(input),
    ]);
    expect(a?.worldId).toBe(pending.worldId);
    expect(b.worldId).toBe(pending.worldId);
    expect(
      sent.every((body) => JSON.stringify(body) === JSON.stringify(pending))
    ).toBe(true);
    acknowledgeWorldCreation(input.userId, 'another-world');
    expect(readPendingWorldCreation(input.userId)).not.toBeNull();
    acknowledgeWorldCreation(input.userId, pending.worldId);
    expect(readPendingWorldCreation(input.userId)).toBeNull();
  });
  it.each(['network', '503'])(
    'recovers a committed world after %s response loss without another creation',
    async (mode) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url, options) => {
          const body = JSON.parse(options.body);
          sent.push(body);
          commit(body);
          if (mode === 'network') throw new Error('lost response');
          return response(503);
        })
      );
      expect((await createWorld(input)).worldId).toBe(sent[0].worldId);
      expect(sent).toHaveLength(1);
      expect(readPendingWorldCreation(input.userId)?.worldId).toBe(
        sent[0].worldId
      );
    }
  );
  it.each([401, 403, 409, 429])(
    'keeps pending identity and refuses to adopt a world after explicit %s',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url, options) => {
          const body = JSON.parse(options.body);
          sent.push(body);
          commit(body);
          return response(status);
        })
      );
      await expect(createWorld(input)).rejects.toMatchObject({ status });
      await expect(
        recoverPendingWorldCreation(input.userId)
      ).rejects.toMatchObject({ status });
      expect(sent[0].worldId).toBe(sent[1].worldId);
    }
  );
  it('rejects changed payload, corrupt storage, unavailable storage/locks and switched owners before requests', async () => {
    const fetch = vi.fn(async () => response(503));
    vi.stubGlobal('fetch', fetch);
    await expect(createWorld(input)).rejects.toThrow();
    await expect(createWorld({ ...input, name: 'different' })).rejects.toThrow(
      'pending world'
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    Object.assign(auth, { currentUser: { uid: 'another-owner' } });
    await expect(recoverPendingWorldCreation(input.userId)).rejects.toThrow(
      'account'
    );
    Object.assign(auth, { currentUser: { uid: input.userId } });
    localStorage.setItem(
      `architect.pendingWorldCreation.${input.userId}`,
      '{}'
    );
    await expect(createWorld(input)).rejects.toThrow('recovery is unavailable');
    localStorage.clear();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    await expect(createWorld(input)).rejects.toThrow('recovery is unavailable');
    vi.stubGlobal('navigator', {});
    await expect(createWorld(input)).rejects.toThrow('recovery is unavailable');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('isolates pending requests by owner and does not restart creation when HTTP mode is off', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(503))
    );
    await expect(createWorld(input)).rejects.toThrow();
    expect(readPendingWorldCreation('another-owner')).toBeNull();
    vi.stubEnv('VITE_SCOUTZERO_WORLD_HTTP', 'false');
    expect(await recoverPendingWorldCreation(input.userId)).toBeNull();
    expect(readPendingWorldCreation(input.userId)).not.toBeNull();
  });
});
