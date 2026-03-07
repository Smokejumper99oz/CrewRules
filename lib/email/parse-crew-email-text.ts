export function parseCrewEmailText(body: string) {
  const pairingMatch = body.match(/Pairing\s+([A-Z0-9]+)/i);

  return {
    pairingCode: pairingMatch?.[1] ?? null,
  };
}
