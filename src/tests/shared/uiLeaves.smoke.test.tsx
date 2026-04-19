import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from '@/shared/components/ErrorBoundary';
import Modal from '@/shared/components/ui/Modal';
import VideoExamples from '@/shared/components/ui/VideoExamples';
import OverallGradeBlock from '@/shared/components/ui/grades/OverallGradeBlock';

const ThrowingChild = () => {
  throw new Error('shared leaf smoke error');
};

afterEach(() => {
  cleanup();
});

describe('shared UI leaves', () => {
  it('renders the ErrorBoundary fallback when a child throws', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    consoleSpy.mockRestore();
  });

  it('calls Modal onClose from Escape', () => {
    const onClose = vi.fn();

    render(
      <Modal title="Smoke Modal" onClose={onClose}>
        <textarea aria-label="Notes" />
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('emits normalized video examples when adding a link', () => {
    const onChange = vi.fn();

    render(
      <VideoExamples
        contextKey="overall"
        videos={[]}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('YouTube URL'), {
      target: { value: 'https://youtu.be/testvideo' },
    });
    fireEvent.change(screen.getByPlaceholderText('Label (optional)'), {
      target: { value: 'Handle package' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Video' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        url: 'https://youtu.be/testvideo',
        label: 'Handle package',
      }),
    ]);
  });

  it('submits edited overall grade on Enter', () => {
    const onGradeChange = vi.fn();

    render(<OverallGradeBlock grade={88} onGradeChange={onGradeChange} />);

    fireEvent.click(screen.getByTitle('Click to edit'));
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '91' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onGradeChange).toHaveBeenCalledWith(91);
  });
});
