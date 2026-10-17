/** Linux cloud process ownership survives detached child groups and PID reuse. */
import { readdir, readFile } from 'node:fs/promises';

type OwnedProcess = { pid: number; start: string };
async function identity(pid: number) {
  try {
    const stat = await readFile('/proc/' + pid + '/stat', 'utf8');
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    return { pid, parent: Number(fields[1]), start: fields[19] };
  } catch { return null; }
}
export async function captureOwnedProcesses(rootPid: number): Promise<OwnedProcess[]> {
  if (!Number.isSafeInteger(rootPid) || rootPid <= 1) throw new Error('An owned child PID is required');
  const processes = (await Promise.all((await readdir('/proc')).filter((name) => /^\d+$/.test(name)).map((pid) => identity(Number(pid))))).filter((p) => p !== null);
  const owned = new Set([rootPid]);
  const result: OwnedProcess[] = [];
  for (let changed = true; changed;) {
    changed = false;
    for (const process of processes) if (owned.has(process.parent) && !owned.has(process.pid)) {
      owned.add(process.pid); result.push({ pid: process.pid, start: process.start }); changed = true;
    }
  }
  return result;
}
export async function stopOwnedProcesses(processes: OwnedProcess[]) {
  for (const owned of [...processes].reverse()) {
    const current = await identity(owned.pid);
    if (current?.start !== owned.start) continue;
    try { process.kill(owned.pid, 'SIGKILL'); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
  }
}
