import { assertEquals } from 'jsr:@std/assert@1';
import type { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleFeedRequest, projectComparison } from './index.ts';
import { checkMediaSafety, hasMediaSignature } from '../chat-image-moderation/index.ts';

const post = 'f1000000-0000-4000-8000-000000000001';
const user = 'f1000000-0000-4000-8000-000000000002';
const mutation = 'f1000000-0000-4000-8000-000000000003';
function request(action: string, body?: string, token = true) {
  return new Request('https://feed.test/?post=' + post + '&action=' + action + '&id=' + mutation, {
    method: 'POST',
    headers: token ? { authorization: 'Bearer signed-in' } : undefined,
    body,
  });
}

function client(respond: (name: string, args: Record<string, unknown>) => unknown) {
  return (() => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: user } }, error: null }) },
    rpc: (name: string, args: Record<string, unknown>) =>
      Promise.resolve({ data: respond(name, args), error: null }),
  })) as unknown as typeof createClient;
}
const noNetwork = (() => {
  throw new Error('Unexpected external fetch');
}) as typeof fetch;

Deno.test('Feed Edge requires authentication and checks viewer access before signing', async () => {
  let called = false;
  const db = client((name, args) => {
    called = true;
    assertEquals(name, 'feed_media_for_viewer');
    assertEquals(args, { p_post: post, p_viewer: user });
    return null;
  });
  const noAuth = await handleFeedRequest(request('media', undefined, false), db, noNetwork);
  assertEquals(noAuth.status, 401);
  assertEquals(called, false);
  const noAccess = await handleFeedRequest(request('media'), db, noNetwork);
  assertEquals(noAccess.status, 403);
  assertEquals(await noAccess.json(), { error: 'FEED_UNAVAILABLE' });
  assertEquals(called, true);
});

Deno.test(
  'Feed comparison sends only percentages and preserves locked and hidden responses',
  async () => {
    const targets = { calories: 2400, protein: 100, carbs: 200, fat: 40, steps: 8000, water: 2000 };
    const values = { calories: 1200, protein: 50, carbs: 100, fat: 20, steps: 4000, water: 0 };
    const input = {
      status: 'ready' as const,
      date: '2026-11-20',
      you: { values, targets, enabled: null },
      author: null,
    };
    assertEquals(projectComparison(input), {
      status: 'ready',
      date: '2026-11-20',
      you: 50,
      author: null,
    });
    for (const status of ['locked', 'hidden'] as const) {
      const result = await handleFeedRequest(
        request('compare'),
        client((name, args) => {
          assertEquals(name, 'feed_compare_inputs');
          assertEquals(args, { p_post: post, p_viewer: user });
          return { status };
        }),
        noNetwork,
      );
      assertEquals(await result.json(), { status });
    }
  },
);

Deno.test(
  'Feed Edge acknowledges an already committed comment without a second moderation call',
  async () => {
    const result = await handleFeedRequest(
      request('comment', 'Good morning'),
      client((name, args) => {
        assertEquals(name, 'feed_comment_status');
        assertEquals(args, { p_post: post, p_actor: user, p_id: mutation, p_body: 'Good morning' });
        return true;
      }),
      noNetwork,
    );
    assertEquals(result.status, 200);
    assertEquals(await result.json(), { id: mutation });
  },
);

Deno.test(
  'Feed upload retries acknowledge previously published posts without reading or replacing media',
  async () => {
    const checked: Record<string, string> = {};
    const db = (() => ({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: user } }, error: null }) },
      from: (table: string) => {
        assertEquals(table, 'feed_posts');
        const query = {
          select: () => query,
          eq: (column: string, value: string) => {
            checked[column] = value;
            return query;
          },
          maybeSingle: () => Promise.resolve({ data: { state: 'published' }, error: null }),
        };
        return query;
      },
    })) as unknown as typeof createClient;
    const response = await handleFeedRequest(request('publish'), db, noNetwork);
    assertEquals(response.status, 200);
    assertEquals(await response.json(), { id: post });
    assertEquals(checked, { id: post, author_id: user });
  },
);

Deno.test(
  'Feed video sends the validated media and post text to the video-capable moderator',
  async () => {
    const previous = Deno.env.get('GEMINI_API_KEY');
    Deno.env.set('GEMINI_API_KEY', 'test-video-moderation');
    try {
      const media = new Uint8Array([0, 0, 0, 12, 102, 116, 121, 112, 105, 115, 111, 109]);
      assertEquals(hasMediaSignature(media, 'video/mp4'), true);
      assertEquals(hasMediaSignature(media, 'image/jpeg'), false);
      const fetcher = ((input, init) => {
        assertEquals(new URL(String(input)).hostname, 'generativelanguage.googleapis.com');
        const payload = JSON.parse(String(init?.body));
        assertEquals(payload.generationConfig.thinkingConfig, { thinkingLevel: 'minimal' });
        assertEquals(payload.contents[0].parts.at(-1).inline_data.mime_type, 'video/mp4');
        assertEquals(JSON.parse(payload.contents[0].parts[1].text).caption, 'Trail walk');
        return Promise.resolve(
          Response.json({
            candidates: [{ content: { parts: [{ text: '{"safe":true}' }] } }],
          }),
        );
      }) as typeof fetch;
      assertEquals(
        await checkMediaSafety(media, 'video/mp4', fetcher, {
          caption: 'Trail walk',
          description: 'Footpath on a hill',
        }),
        true,
      );
    } finally {
      if (previous === undefined) Deno.env.delete('GEMINI_API_KEY');
      else Deno.env.set('GEMINI_API_KEY', previous);
    }
  },
);
