import { useState, useRef, useEffect } from 'react';
import {
  buildSignAndTradePreflightResult,
  buildOfferSheetPreflightResult,
  normalizeSignAndTradePreflightResult,
  normalizeOfferSheetPreflightResult,
} from './EditContractModal.helpers';
import type {
  PlayerLike,
  StagedSigningPayloadLike,
  SignAndTradePreflightLike,
  OfferSheetPreflightLike,
  SelectedContractAction,
  OfferSheetInitiation,
  SignAndTradeInitiation,
} from './EditContractModal.types';

type UseEditContractModalPreflightParams = {
  isOpen: boolean | undefined;
  selectedAction: SelectedContractAction;
  player: PlayerLike | null | undefined;
  resolvedSignAndTradeInitiation: SignAndTradeInitiation | null;
  resolvedDestinationTeamCode: string | null;
  signAndTradeActionDisabledReason: string | null;
  signAndTradeDispatchPayload: StagedSigningPayloadLike;
  resolvedOfferSheetInitiation: OfferSheetInitiation | null;
  offerSheetDispatchPayload: StagedSigningPayloadLike;
  isOfferSheet: boolean;
};

export const useEditContractModalPreflight = ({
  isOpen,
  selectedAction,
  player,
  resolvedSignAndTradeInitiation,
  resolvedDestinationTeamCode,
  signAndTradeActionDisabledReason,
  signAndTradeDispatchPayload,
  resolvedOfferSheetInitiation,
  offerSheetDispatchPayload,
  isOfferSheet,
}: UseEditContractModalPreflightParams) => {
  const [signAndTradePreflight, setSignAndTradePreflight] =
    useState<SignAndTradePreflightLike>(null);
  const latestSignAndTradePreflightRequestId = useRef(0);

  const [offerSheetPreflight, setOfferSheetPreflight] =
    useState<OfferSheetPreflightLike>(null);
  const latestOfferSheetPreflightRequestId = useRef(0);

  useEffect(() => {
    latestSignAndTradePreflightRequestId.current += 1;
    const requestId = latestSignAndTradePreflightRequestId.current;

    if (!isOpen || selectedAction !== 'signAndTrade') {
      setSignAndTradePreflight(null);
      return;
    }
    if (!player) {
      setSignAndTradePreflight(
        buildSignAndTradePreflightResult('incomplete', [
          'Authoritative sign-and-trade preflight is missing player context.',
        ])
      );
      return;
    }
    if (signAndTradeActionDisabledReason) {
      setSignAndTradePreflight(
        buildSignAndTradePreflightResult('blocked', [
          signAndTradeActionDisabledReason,
        ])
      );
      return;
    }
    if (!resolvedDestinationTeamCode) {
      setSignAndTradePreflight(
        buildSignAndTradePreflightResult('blocked', [
          'Destination team is required for sign-and-trade.',
        ])
      );
      return;
    }
    setSignAndTradePreflight(
      buildSignAndTradePreflightResult('incomplete', [
        'Checking authoritative sign-and-trade legality...',
      ])
    );
    void Promise.resolve(
      resolvedSignAndTradeInitiation?.getSignAndTradePreflight?.(
        player,
        signAndTradeDispatchPayload,
        resolvedDestinationTeamCode
      )
    )
      .then((result) => {
        if (latestSignAndTradePreflightRequestId.current !== requestId) return;
        setSignAndTradePreflight(normalizeSignAndTradePreflightResult(result));
      })
      .catch((error) => {
        if (latestSignAndTradePreflightRequestId.current !== requestId) return;
        setSignAndTradePreflight(
          buildSignAndTradePreflightResult('incomplete', [
            error instanceof Error
              ? error.message
              : 'Authoritative sign-and-trade preflight failed before legality could be determined.',
          ])
        );
      });
  }, [
    isOpen,
    player,
    resolvedSignAndTradeInitiation,
    resolvedDestinationTeamCode,
    selectedAction,
    signAndTradeActionDisabledReason,
    signAndTradeDispatchPayload,
  ]);

  useEffect(() => {
    latestOfferSheetPreflightRequestId.current += 1;
    const requestId = latestOfferSheetPreflightRequestId.current;

    if (!isOpen || selectedAction !== 'signNew' || !isOfferSheet) {
      setOfferSheetPreflight(null);
      return;
    }
    if (!player) {
      setOfferSheetPreflight(
        buildOfferSheetPreflightResult('incomplete', [
          'Authoritative offer sheet preflight is missing player context.',
        ])
      );
      return;
    }
    if (!resolvedOfferSheetInitiation) {
      setOfferSheetPreflight(
        buildOfferSheetPreflightResult('blocked', [
          'Offer sheet preflight unavailable (no world context).',
        ])
      );
      return;
    }
    if (offerSheetDispatchPayload.years > 4) {
      setOfferSheetPreflight(
        buildOfferSheetPreflightResult('blocked', [
          'An Offer Sheet may cover no more than four Salary Cap Years.',
        ])
      );
      return;
    }
    setOfferSheetPreflight(
      buildOfferSheetPreflightResult('incomplete', [
        'Checking authoritative offer sheet legality...',
      ])
    );
    void Promise.resolve(
      resolvedOfferSheetInitiation.getOfferSheetPreflight(
        player,
        offerSheetDispatchPayload
      )
    )
      .then((result) => {
        if (latestOfferSheetPreflightRequestId.current !== requestId) return;
        setOfferSheetPreflight(normalizeOfferSheetPreflightResult(result));
      })
      .catch((error) => {
        if (latestOfferSheetPreflightRequestId.current !== requestId) return;
        setOfferSheetPreflight(
          buildOfferSheetPreflightResult('incomplete', [
            error instanceof Error
              ? error.message
              : 'Authoritative offer sheet preflight failed before legality could be determined.',
          ])
        );
      });
  }, [
    isOpen,
    isOfferSheet,
    offerSheetDispatchPayload,
    player,
    resolvedOfferSheetInitiation,
    selectedAction,
  ]);

  return { signAndTradePreflight, offerSheetPreflight };
};
