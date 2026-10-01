export function roomFromLocation(location) {
  return new URLSearchParams(location.hash.slice(1)).get('room') || new URLSearchParams(location.search).get('room');
}

export function sessionIdentity(storage, game, room, randomId = () => crypto.randomUUID()) {
  const key = `antidote:${game}:seat:${room || 'host'}`;
  try {
    let id = storage.getItem(key);
    if (!id) { id = randomId(); storage.setItem(key, id); }
    return id;
  } catch { return randomId(); }
}

export function safeAvatar(value) {
  return {
    bgColor: /^#[0-9a-f]{6}$/i.test(value?.bgColor) ? value.bgColor : '#457b9d',
    drawing: typeof value?.drawing === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value.drawing) && value.drawing.length <= 15_000 ? value.drawing : null,
  };
}
