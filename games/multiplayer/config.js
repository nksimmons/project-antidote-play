// Public deployment configuration. Never put permanent private TURN credentials
// in this file. A deployed TURN service should issue short-lived credentials.
export const multiplayerConfig = {
  relayConfig: { redundancy: 3 },
  // turnConfig: [{ urls: 'turns:turn.example.org:5349', username: '', credential: '' }],
};
