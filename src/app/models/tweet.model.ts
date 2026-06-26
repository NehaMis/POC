/**
 * Tweet model interface.
 * Represents a tweet/post from X (formerly Twitter).
 * The `id` field is the Tweet ID from your NTTD stream —
 * it is the only field required to open a threaded reply via Intent URL.
 */
export interface Tweet {
  id: string;               // Tweet ID from NTTD stream — e.g. "1016181746992969994"
  displayName: string;
  username: string;
  avatarInitials: string;
  avatarColor: string;
  isVerified: boolean;
  timestamp: string;
  text: string;
  replyCount?: number;
  retweetCount?: number;
  likeCount?: number;
}

/**
 * Mock tweet using the real Tweet ID provided: 1016181746992969994
 * In production this object comes from your backend (NTTD stream data).
 * The `id` field is what drives the Intent URL — everything else is display only.
 */
export const MOCK_TWEET: Tweet = {
 id: '2070444389919605240',
 displayName: 'Neha Mishra',
 username: 'NehaMis12966740',
 avatarInitials: 'NM',
 avatarColor: '#E0245E',
 isVerified: true,
 timestamp: '2026/June',
 text: '楽天モバイルでおトクにスタート🎉新規・乗り換えなら、ポイントたっぷり✨ Vivo家族全員で14,000ポイントが新規開拓まで行く、まで14,000P 😊 https://t.co/nambsC5kUi ...楽天モバイル🚀ブランドパートナー...',
 };