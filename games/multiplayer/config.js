// Public deployment configuration. Never put permanent private TURN credentials
// in this file. For testing, use the per-tab settings panel with temporary ones.
export const multiplayerConfig = {
  relayConfig: { redundancy: 3 },
  // turnConfig: [{ urls: 'turns:turn.example.org:5349', username: '', credential: '' }],
};
