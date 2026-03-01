import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const tradeEditorPath = path.resolve(
  process.cwd(),
  'src/features/architect/tradeMachine/TradeEditor.jsx'
);

describe('TradeEditor DEV S&T injector gating guardrail', () => {
  it('keeps injector behind DEV mode and explicit localStorage flag', () => {
    const source = fs.readFileSync(tradeEditorPath, 'utf-8');

    expect(source).toContain('import.meta.env.DEV');
    expect(source).toContain("window.localStorage?.getItem(DEV_SNT_INJECTOR_FLAG) === 'true'");
    expect(source).toContain('showSntInjector={isDevSntInjectorEnabled}');
  });
});

