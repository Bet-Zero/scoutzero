// @vitest-environment jsdom
/**
 * useImageDownload: phones get the share sheet (Save Image), desktops a file
 * download, and a share blocked for lack of a fresh tap offers a Save button.
 */
import { renderHook } from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';

const toastFn = vi.hoisted(() =>
  Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() })
);

vi.mock('react-hot-toast', () => ({ toast: toastFn }));
vi.mock('html-to-image', () => ({
  toBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));
vi.mock('@/fonts/antonBase64', () => ({ antonBase64CSS: '' }));

import { useImageDownload } from '@/shared/hooks/useImageDownload';

const setPhone = (isPhone: boolean) => {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({
      matches: isPhone,
    }) as unknown as typeof window.matchMedia;
};

const renderDownload = () => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return renderHook(() => useImageDownload({ current: el })).result.current;
};

describe('useImageDownload', () => {
  let share: ReturnType<typeof vi.fn>;
  let click: MockInstance<[], void>;

  beforeEach(() => {
    vi.clearAllMocks();
    share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share, canShare: () => true });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    click.mockRestore();
  });

  it('opens the share sheet with the image file on a phone', async () => {
    setPhone(true);
    await renderDownload()('rankings.png');

    expect(share).toHaveBeenCalledTimes(1);
    const file = share.mock.calls[0][0].files[0] as File;
    expect(file.name).toBe('rankings.png');
    expect(file.type).toBe('image/png');
    expect(click).not.toHaveBeenCalled();
    expect(toastFn.success).not.toHaveBeenCalled();
  });

  it('offers a Save image button when the phone blocks the late share', async () => {
    setPhone(true);
    share.mockRejectedValueOnce(
      new DOMException('no gesture', 'NotAllowedError')
    );
    await renderDownload()('rankings.png');

    expect(toastFn).toHaveBeenCalledTimes(1);
    const render = toastFn.mock.calls[0][0] as (t: { id: string }) => {
      props: { children: unknown[] };
    };
    const button = render({ id: 't1' }).props.children[1] as {
      props: { onClick: () => void };
    };
    button.props.onClick();
    expect(share).toHaveBeenCalledTimes(2);
    expect(toastFn.dismiss).toHaveBeenCalledWith('t1');
  });

  it('stays quiet when the person cancels the share sheet', async () => {
    setPhone(true);
    share.mockRejectedValueOnce(new DOMException('cancel', 'AbortError'));
    await renderDownload()('rankings.png');

    expect(toastFn).not.toHaveBeenCalled();
    expect(toastFn.error).not.toHaveBeenCalled();
  });

  it('downloads the file through a link on desktop', async () => {
    setPhone(false);
    await renderDownload()('rankings.png');

    expect(share).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
    expect(toastFn.success).toHaveBeenCalledWith('Image downloaded');
  });
});
