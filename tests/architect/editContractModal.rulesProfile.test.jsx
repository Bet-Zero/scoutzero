import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EditContractModal from '@/shared/components/EditContractModal.jsx';

const stubRulesProfile = {
  extensionEligibility: {
    isEligible: false,
    reason: 'Too early to extend',
  },
  extensionTerms: null,
};

const stubPlayer = {
  name: 'Test Player',
  contract: {
    salariesByYear: [
      { season: '2024-25', salary: 10000000, capHit: 10000000, guaranteed: true },
    ],
    originalLength: 4,
  },
};

describe('EditContractModal with rules profile integration', () => {
  it('disables confirm when extension is not eligible per rules profile', () => {
    render(
      <EditContractModal
        isOpen
        player={stubPlayer}
        initialAction="extend"
        teamCapSheet={{ players: [stubPlayer] }}
        currentYear={2025}
        onClose={() => {}}
        onExtend={() => {}}
        rulesProfile={stubRulesProfile}
      />
    );

    const confirmButton = screen.getByRole('button', {
      name: /force action/i,
    });
    expect(confirmButton.disabled).toBe(true);
  });
});
