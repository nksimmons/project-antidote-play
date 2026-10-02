// Public deployment configuration. Never put permanent private TURN credentials
// in this file. A deployed TURN service should issue short-lived credentials.
export const multiplayerConfig = {
  relayConfig: { redundancy: 3 },
  // Trystero appends these to its default STUN servers. ICE can use a direct
  // connection or fall back to a relay, including TCP/TLS when UDP is blocked.
  // Open Relay's published guest access is public, not a private deployment secret.
  turnConfig: [{
    urls: [
      'turn:openrelay.metered.ca:80?transport=udp',
      'turn:openrelay.metered.ca:443?transport=tcp',
      'turns:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  }],
  rtcConfig: { iceTransportPolicy: 'all' },
};
