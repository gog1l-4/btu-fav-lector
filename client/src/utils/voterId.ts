const VOTER_KEY = 'btu_voter_token';

export function getOrCreateVoterId(): string {
  let id = localStorage.getItem(VOTER_KEY);
  if (!id) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      id = crypto.randomUUID();
    } else {
      id = 'voter_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
    }
    localStorage.setItem(VOTER_KEY, id);
  }
  return id;
}
