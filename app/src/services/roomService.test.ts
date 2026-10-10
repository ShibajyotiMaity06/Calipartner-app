import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  blockUser,
  cancelRoomRequest,
  createRoom,
  getPrivacySettings,
  getRequestsInbox,
  getRoomSnapshot,
  joinRoomByCode,
  leaveRoom,
  listUserRooms,
  removeMember,
  reportTarget,
  requestToJoinRoom,
  respondSharedMeal,
  respondToRoomRequest,
  searchUserByUsername,
  sendNudge,
  sendReaction,
  sendRoomInvitation,
  setWhoCanInvite,
  tagSharedMeal,
  transferHost,
  updatePrivacySettings,
} from './roomService';
import { parseRoomError, RoomServiceError } from '@/types/rooms';

function createMockSupabase(overrides: {
  user?: { id: string; email: string } | null;
  fromHandler?: (table: string) => unknown;
  rpcHandler?: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
}): SupabaseClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: overrides.user ?? { id: 'user-123', email: 'test@example.com' } },
        error: null,
      }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (overrides.fromHandler) {
        return overrides.fromHandler(table);
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
    rpc: vi.fn().mockImplementation((fn: string, args: Record<string, unknown>) => {
      if (overrides.rpcHandler) {
        return overrides.rpcHandler(fn, args);
      }
      return Promise.resolve({ data: null, error: null });
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn().mockResolvedValue('ok'),
  } as unknown as SupabaseClient;
}

describe('roomService unit tests with mocked Supabase', () => {
  it('1. parseRoomError parses known SQL error codes into typed RoomServiceError', () => {
    const err1 = parseRoomError(new Error('P0001: PLAN_REQUIRED'));
    expect(err1.code).toBe('PLAN_REQUIRED');
    expect(err1).toBeInstanceOf(RoomServiceError);

    const errLocked = parseRoomError(new Error('P0001: ROOM_LOCKED'));
    expect(errLocked.code).toBe('ROOM_LOCKED');

    const err2 = parseRoomError({ message: 'Room member count exceeded: ROOM_FULL' });
    expect(err2.code).toBe('ROOM_FULL');

    const err3 = parseRoomError({ message: 'Maximum 3 rooms allowed: MAX_ROOMS_REACHED' });
    expect(err3.code).toBe('MAX_ROOMS_REACHED');

    const err4 = parseRoomError(new Error('Rate limit exceeded for requests'));
    expect(err4.code).toBe('RATE_LIMITED');

    const err5 = parseRoomError(new Error('USER_BLOCKED by recipient'));
    expect(err5.code).toBe('USER_BLOCKED');

    const err6 = parseRoomError(new Error('Random unexpected error occurred'));
    expect(err6.code).toBe('UNKNOWN_ERROR');

    const err7 = parseRoomError({
      message: 'Could not find the function public.create_room(p_device_hash, p_name) in the schema cache',
    });
    expect(err7.code).toBe('UNKNOWN_ERROR');
    expect(err7.message).toContain('Database migration not applied');
  });

  it('2. listUserRooms aggregates rooms and member counts', async () => {
    const mockClient = createMockSupabase({
      user: { id: 'user-alex', email: 'alex@example.com' },
      fromHandler: (table: string) => {
        if (table === 'room_members') {
          return {
            select: vi.fn().mockImplementation((query: string) => {
              if (query.includes('rooms (')) {
                return {
                  eq: vi.fn().mockReturnValue({
                    in: vi.fn().mockResolvedValue({
                      data: [
                        {
                          role: 'host',
                          status: 'active',
                          room_id: 'room-1',
                          rooms: {
                            id: 'room-1',
                            name: 'Alpha Room',
                            code: 'CP1234',
                            state: 'active',
                            who_can_invite: 'host_only',
                            plan_holder_id: 'user-alex',
                            member_cap: 5,
                            created_at: '2026-10-10T00:00:00Z',
                          },
                        },
                      ],
                      error: null,
                    }),
                  }),
                };
              }
              // Member count query
              return {
                in: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({
                    data: [{ room_id: 'room-1' }, { room_id: 'room-1' }],
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        return {};
      },
    });

    const rooms = await listUserRooms(mockClient);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.id).toBe('room-1');
    expect(rooms[0]!.name).toBe('Alpha Room');
    expect(rooms[0]!.role).toBe('host');
    expect(rooms[0]!.member_count).toBe(2);
    expect(rooms[0]!.member_cap).toBe(5);
  });

  it('3. createRoom calls RPC create_room with name and device hash', async () => {
    let calledRpc = '';
    let calledArgs: Record<string, unknown> | null = null;

    const mockClient = createMockSupabase({
      rpcHandler: async (fn, args) => {
        calledRpc = fn;
        calledArgs = args;
        return {
          data: {
            room_id: 'new-room-id',
            name: 'New Room',
            code: 'CP9999',
            role: 'host',
            state: 'dormant',
            member_cap: 5,
          },
          error: null,
        };
      },
    });

    const result = await createRoom(mockClient, 'New Room', 'test-device-hash');
    expect(calledRpc).toBe('create_room');
    const recorded = calledArgs as Record<string, unknown> | null;
    expect(recorded?.p_name).toBe('New Room');
    expect(recorded?.p_device_hash).toBe('test-device-hash');
    expect(result.room_id).toBe('new-room-id');
  });

  it('4. createRoom throws typed PLAN_REQUIRED error when trial expired', async () => {
    const mockClient = createMockSupabase({
      rpcHandler: async () => ({
        data: null,
        error: { message: 'P0001: PLAN_REQUIRED' },
      }),
    });

    await expect(createRoom(mockClient, 'Expired Trial')).rejects.toThrowError();
    try {
      await createRoom(mockClient, 'Expired Trial');
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(RoomServiceError);
      if (e instanceof RoomServiceError) {
        expect(e.code).toBe('PLAN_REQUIRED');
      }
    }
  });

  it('5. joinRoomByCode calls join_by_code and maps errors', async () => {
    const mockClient = createMockSupabase({
      rpcHandler: async (fn, args) => {
        if (args.p_code === 'INVALID') {
          return { data: null, error: { message: 'P0001: ROOM_NOT_FOUND' } };
        }
        return {
          data: { room_id: 'r-1', status: 'joined', name: 'Joined Room' },
          error: null,
        };
      },
    });

    const res = await joinRoomByCode(mockClient, 'VALID_CODE', 'dev-1');
    expect(res.status).toBe('joined');

    await expect(joinRoomByCode(mockClient, 'INVALID')).rejects.toMatchObject({
      code: 'ROOM_NOT_FOUND',
    });
  });

  it('6. getRequestsInbox maps incoming and outgoing requests with profiles', async () => {
    const mockClient = createMockSupabase({
      user: { id: 'u-me', email: 'me@example.com' },
      fromHandler: (table: string) => {
        if (table === 'room_requests') {
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'req-in-1',
                      room_id: 'r-1',
                      sender_id: 'u-friend',
                      recipient_id: 'u-me',
                      type: 'invitation',
                      status: 'pending',
                      expires_at: '2026-10-24T00:00:00Z',
                      created_at: '2026-10-10T00:00:00Z',
                      rooms: { id: 'r-1', name: 'Friend Room', code: 'CP1111' },
                    },
                    {
                      id: 'req-out-1',
                      room_id: 'r-2',
                      sender_id: 'u-me',
                      recipient_id: 'u-other',
                      type: 'join_request',
                      status: 'pending',
                      expires_at: '2026-10-24T00:00:00Z',
                      created_at: '2026-10-10T00:00:00Z',
                      rooms: { id: 'r-2', name: 'Other Room', code: 'CP2222' },
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  { id: 'u-friend', username: 'friend_user', nickname: 'Friend', avatar_url: null },
                  { id: 'u-other', username: 'other_user', nickname: 'Other', avatar_url: null },
                ],
                error: null,
              }),
            }),
          };
        }
        return {};
      },
    });

    const inbox = await getRequestsInbox(mockClient);
    expect(inbox.incoming).toHaveLength(1);
    expect(inbox.incoming[0]!.id).toBe('req-in-1');
    expect(inbox.incoming[0]!.sender_profile?.username).toBe('friend_user');
    expect(inbox.incoming[0]!.room_name).toBe('Friend Room');

    expect(inbox.outgoing).toHaveLength(1);
    expect(inbox.outgoing[0]!.id).toBe('req-out-1');
    expect(inbox.outgoing[0]!.recipient_profile?.username).toBe('other_user');
  });

  it('7. sendRoomInvitation and requestToJoin handle limits and blocks', async () => {
    const mockClient = createMockSupabase({
      rpcHandler: async (fn, args) => {
        if (fn === 'send_room_invitation') {
          if (args.p_username === 'blocked_user') {
            return { data: null, error: { message: 'P0001: USER_BLOCKED' } };
          }
          if (args.p_username === 'rate_limited_user') {
            return { data: null, error: { message: 'P0001: HOURLY_REQUEST_LIMIT_REACHED' } };
          }
          return {
            data: { request_id: 'req-ok', room_id: args.p_room_id, status: 'pending' },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });

    const inv = await sendRoomInvitation(mockClient, 'room-1', 'good_user');
    expect(inv.status).toBe('pending');

    await expect(sendRoomInvitation(mockClient, 'room-1', 'blocked_user')).rejects.toMatchObject({
      code: 'USER_BLOCKED',
    });

    await expect(sendRoomInvitation(mockClient, 'room-1', 'rate_limited_user')).rejects.toMatchObject({
      code: 'HOURLY_REQUEST_LIMIT_REACHED',
    });
  });

  it('8. respondToRoomRequest and cancelRoomRequest work correctly', async () => {
    const mockClient = createMockSupabase({
      rpcHandler: async (fn, args) => {
        if (fn === 'respond_to_request') {
          return { data: { status: args.p_accept ? 'accepted' : 'declined' }, error: null };
        }
        if (fn === 'cancel_request') {
          return { data: { status: 'cancelled' }, error: null };
        }
        return { data: null, error: null };
      },
    });

    const acceptRes = await respondToRoomRequest(mockClient, 'req-1', true);
    expect(acceptRes.status).toBe('accepted');

    const cancelRes = await cancelRoomRequest(mockClient, 'req-2');
    expect(cancelRes.status).toBe('cancelled');
  });

  it('9. getRoomSnapshot returns privacy-enforced snapshot with locked markers', async () => {
    const mockClient = createMockSupabase({
      rpcHandler: async (fn, args) => {
        if (fn === 'get_room_snapshot') {
          return {
            data: {
              room: {
                id: args.p_room_id,
                name: 'Snapshot Room',
                code: 'CP3333',
                state: 'active',
                who_can_invite: 'host_only',
                created_by: 'user-a',
              },
              caller_id: 'user-a',
              members: [
                {
                  user_id: 'user-a',
                  username: 'alex',
                  nickname: 'Alex',
                  is_self: true,
                  metrics: { calories: 2000, steps: 8000, water_ml: 2500 },
                },
                {
                  user_id: 'user-b',
                  username: 'bob',
                  nickname: 'Bob',
                  is_self: false,
                  metrics: { calories: 'locked', macros: 'locked', steps: 9000, water_ml: 'locked' },
                },
              ],
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });

    const snapshot = await getRoomSnapshot(mockClient, 'room-snap-1');
    expect(snapshot.room.name).toBe('Snapshot Room');
    expect(snapshot.members).toHaveLength(2);
    expect(snapshot.members[1]!.metrics.calories).toBe('locked');
    expect(snapshot.members[1]!.metrics.steps).toBe(9000);
  });

  it('10. Privacy settings read and update', async () => {
    const mockClient = createMockSupabase({
      user: { id: 'user-me', email: 'me@example.com' },
      fromHandler: (table: string) => {
        if (table === 'room_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      privacy_settings: {
                        share_streak: true,
                        share_calories_macros: false,
                        share_weight_number: false,
                      },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      },
      rpcHandler: async (fn, args) => {
        if (fn === 'set_privacy') {
          const priv = args.p_privacy_settings as Record<string, unknown>;
          return {
            data: {
              share_streak: true,
              share_calories_macros: priv.share_calories_macros,
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });

    const settings = await getPrivacySettings(mockClient, 'room-priv-1');
    expect(settings.share_streak).toBe(true);
    expect(settings.share_calories_macros).toBe(false);

    const updated = await updatePrivacySettings(mockClient, 'room-priv-1', {
      share_calories_macros: true,
    });
    expect(updated.share_calories_macros).toBe(true);
  });

  it('11. Nudge, reaction, shared meal and member operations', async () => {
    const mockClient = createMockSupabase({
      rpcHandler: async (fn, args) => {
        if (fn === 'nudge') {
          return { data: { status: 'sent', nudge_id: 'n-1' }, error: null };
        }
        if (fn === 'react') {
          return { data: { status: 'reacted', reaction: args.p_reaction }, error: null };
        }
        if (fn === 'tag_shared_meal') {
          return { data: { status: 'created', shared_meal_id: 'sm-1' }, error: null };
        }
        if (fn === 'respond_shared_meal') {
          return {
            data: { status: 'accepted', diary_entry_id: 'entry-sm-1', quantity: 2, calories: 400 },
            error: null,
          };
        }
        if (fn === 'leave_room') {
          return { data: { status: 'left', room_id: args.p_room_id }, error: null };
        }
        if (fn === 'remove_member') {
          return { data: { status: 'removed', user_id: args.p_target_user_id }, error: null };
        }
        if (fn === 'transfer_host') {
          return { data: { status: 'transferred', new_host_id: args.p_new_host_id }, error: null };
        }
        if (fn === 'request_to_join') {
          return { data: { status: 'pending', request_id: 'req-j1' }, error: null };
        }
        if (fn === 'set_who_can_invite') {
          return { data: { status: 'updated', who_can_invite: args.p_who_can_invite }, error: null };
        }
        if (fn === 'block_user') {
          return { data: { status: 'blocked', target_user_id: args.p_target_user_id }, error: null };
        }
        if (fn === 'report') {
          return { data: { status: 'reported', report_id: 'rep-1' }, error: null };
        }
        return { data: null, error: null };
      },
    });

    const nudgeRes = await sendNudge(mockClient, 'r-1', 'u-2', 'Time for lunch!');
    expect(nudgeRes.status).toBe('sent');

    const reactRes = await sendReaction(mockClient, 'r-1', 'e-1', 'fire');
    expect(reactRes.status).toBe('reacted');

    const joinRes = await requestToJoinRoom(mockClient, 'CP8888');
    expect(joinRes.status).toBe('pending');

    const searchRes = await searchUserByUsername(mockClient, 'testuser');
    expect(Array.isArray(searchRes)).toBe(true);

    const inviteRes = await setWhoCanInvite(mockClient, 'r-1', 'any_member');
    expect(inviteRes.who_can_invite).toBe('any_member');

    const mealRes = await tagSharedMeal(mockClient, {
      roomId: 'r-1',
      foodName: 'Grilled Chicken',
      mealSection: 'lunch',
      quantity: 1,
      unit: 'plate',
      calories: 350,
      protein: 40,
      carbs: 5,
      fat: 10,
      participantIds: ['u-2'],
    });
    expect(mealRes.status).toBe('created');

    const mealResp = await respondSharedMeal(mockClient, 'sm-1', true, 2, 'lunch');
    expect(mealResp.status).toBe('accepted');
    expect(mealResp.calories).toBe(400);

    const leaveRes = await leaveRoom(mockClient, 'r-1');
    expect(leaveRes.status).toBe('left');

    const remRes = await removeMember(mockClient, 'r-1', 'u-bad');
    expect(remRes.status).toBe('removed');

    const transRes = await transferHost(mockClient, 'r-1', 'u-new-host');
    expect(transRes.status).toBe('transferred');

    const blockRes = await blockUser(mockClient, 'u-spam');
    expect(blockRes.status).toBe('blocked');

    const repRes = await reportTarget(mockClient, 'user', 'u-spam', 'Spamming requests');
    expect(repRes.status).toBe('reported');
  });
});
