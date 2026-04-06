/**
 * Month Overview: training credit accumulation (event_type === "training").
 * Training credit counts toward monthly credit; training block never uses this path — only trips add to totalBlock.
 * Extracted for regression tests and to keep getMonthStats training math in one place.
 */

export type ScheduleEventLikeForTrainingMonthCredit = {
  credit_minutes: number | null;
  credit_hours: number | null;
  protected_full_trip_paid_minutes: number | null;
  protected_credit_minutes: number | null;
  pairing_days: number | null;
};

export function computeTrainingMonthCreditDeltas(
  ev: ScheduleEventLikeForTrainingMonthCredit,
  segmentsLength: number
): { addTrainingCreditMinutes: number; addProtectedCreditMinutes: number } {
  const fullTripProtectedPaidTrain =
    ev.protected_full_trip_paid_minutes != null && ev.protected_full_trip_paid_minutes > 0
      ? ev.protected_full_trip_paid_minutes
      : null;

  let addProtectedCreditMinutes = 0;
  if (fullTripProtectedPaidTrain == null && (ev.protected_credit_minutes ?? 0) > 0) {
    addProtectedCreditMinutes = ev.protected_credit_minutes ?? 0;
  }

  if (segmentsLength === 0) {
    return { addTrainingCreditMinutes: 0, addProtectedCreditMinutes };
  }

  const pairingDaysTrain = ev.pairing_days ?? segmentsLength;
  const ratioTrain =
    pairingDaysTrain > 0 ? Math.min(1, segmentsLength / pairingDaysTrain) : 1;

  let addTrainingCreditMinutes = 0;
  if (fullTripProtectedPaidTrain != null) {
    addTrainingCreditMinutes = Math.round(fullTripProtectedPaidTrain * ratioTrain);
  } else {
    const cm =
      ev.credit_minutes != null
        ? ev.credit_minutes
        : ev.credit_hours != null
          ? Math.round(ev.credit_hours * 60)
          : 0;
    if (cm > 0) addTrainingCreditMinutes = Math.round(cm * ratioTrain);
  }

  return { addTrainingCreditMinutes, addProtectedCreditMinutes };
}
