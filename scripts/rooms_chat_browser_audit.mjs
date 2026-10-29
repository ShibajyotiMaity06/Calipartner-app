import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { harness } from './rooms_profile_browser_audit.mjs';
export async function runChatHostedBrowser(options) {
  const { saved, rpc, admin, query } = options,
    room = saved.group.room_id;
  const paid = [0, 1, 2, 4, 6].map((i) => saved.accounts[i]);
  for (const a of paid) await rpc(a.c, 'accept_chat_terms');
  const sent = await Promise.all(
    paid.flatMap((a, index) =>
      Array.from({ length: 6 }, (_, j) =>
        rpc(a.c, 'send_chat_message', {
          p_room_id: room,
          p_client_id: crypto.randomUUID(),
          p_text: `Concurrent ${index}/${j}`,
        }),
      ),
    ),
  );
  assert.equal(new Set(sent.map((m) => m.id)).size, 30);
  for (const a of paid) {
    const got = await rpc(a.c, 'get_chat_messages_v2', { p_room_id: room });
    assert.equal(got.filter((m) => m.text?.startsWith('Concurrent ')).length, 30);
  }
  console.log(
    'PASS Hosted: five paid accounts sent 30 concurrent messages; every reader sees all exactly once',
  );
  const temporary = saved.accounts.slice(0, 20).filter((_, i) => ![0, 1, 2, 4, 6].includes(i));
  const original = await query(
    admin
      .from('entitlements')
      .select('*')
      .in(
        'user_id',
        temporary.map((a) => a.id),
      ),
  );

  try {
    await query(
      admin.from('entitlements').upsert(
        temporary.map((a) => ({
          user_id: a.id,
          tier: 'plus',
          status: 'paid',
          source: 'none',
          plan: 'annual',
          period_end: new Date(Date.now() + 86400000).toISOString(),
        })),
      ),
    );
    await Promise.all(temporary.map((a) => rpc(a.c, 'accept_chat_terms')));
    const all = await Promise.all(
      saved.accounts.slice(0, 20).map((a, i) =>
        rpc(a.c, 'send_chat_message', {
          p_room_id: room,
          p_client_id: crypto.randomUUID(),
          p_text: `All 20 simultaneous ${i}`,
        }),
      ),
    );
    assert.equal(new Set(all.map((m) => m.id)).size, 20);
    for (const a of [saved.accounts[0], saved.accounts[19]])
      assert.equal(
        (await rpc(a.c, 'get_chat_messages_v2', { p_room_id: room })).filter((m) =>
          m.text?.startsWith('All 20 simultaneous'),
        ).length,
        20,
      );
    console.log(
      'PASS Hosted: all 20 members send concurrently; restored mixed-plan fixtures afterward',
    );
  } finally {
    if (original.length) await query(admin.from('entitlements').upsert(original));
    const absent = temporary
      .filter((a) => !original.some((e) => e.user_id === a.id))
      .map((a) => a.id);
    if (absent.length) await query(admin.from('entitlements').delete().in('user_id', absent));
  }
  return runChatMediaBrowser(options, paid);
}
export async function runChatMediaBrowser(options, paid = null) {
  const { saved, rpc, persist, admin, query } = options,
    room = saved.group.room_id;
  const call = async (account, name, body) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await account.c.functions.invoke(name, { body });
      if (!result.error) return result.data;
      const detail = await result.error.context
        ?.clone()
        .json()
        .catch(() => ({}));
      if (
        name === 'chat-image-moderation' &&
        detail?.reason === 'MODERATION_PROVIDER_429' &&
        attempt < 2
      ) {
        console.log(
          'WAIT Moderation provider rate limit; retrying the same owned upload after 65 seconds',
        );
        await new Promise((r) => setTimeout(r, 60000));
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      throw new Error(
        `${name} rejected (${result.error.context?.status ?? 'unknown'}): ${detail?.reason ?? detail?.error ?? 'unavailable'}`,
      );
    }
  };
  for (const a of saved.accounts.slice(0, 2)) await rpc(a.c, 'accept_chat_terms');
  await harness(options, async ({ open }) => {
    const chat = async (index) => {
      const page = await open(saved.accounts[index], '/room');
      await page.getByTestId('btn-room-title-switcher').waitFor({ timeout: 60000 });
      if (saved.rooms.length > 1) {
        await page.getByTestId('btn-room-title-switcher').click();
        await page.getByTestId(`btn-switch-room-${room}`).click();
      }
      await page.getByTestId('room-tab-chat').click();
      await page.getByTestId('input-chat-message').waitFor({ timeout: 30000 });
      return page;
    };
    const host = await chat(0),
      plus = await chat(1);
    assert.equal(await plus.getByTestId('btn-chat-attach-photo').isDisabled(), true);
    assert.equal(await host.getByTestId('btn-chat-attach-photo').isDisabled(), false);
    if (paid?.length > 3) {
      const typingTimer = setInterval(() => {
        for (const a of paid.slice(1))
          void rpc(a.c, 'set_chat_typing', { p_room_id: room, p_is_typing: true }).catch(() => {});
      }, 2000);
      try {
        for (const a of paid.slice(1))
          await rpc(a.c, 'set_chat_typing', { p_room_id: room, p_is_typing: true });
        await host.getByTestId('chat-typing-indicator').waitFor({ timeout: 20000 });
        await host.waitForFunction(
          () =>
            globalThis.document
              .querySelector('[data-testid=chat-typing-indicator]')
              ?.textContent?.includes('1 other'),
          {},
          { timeout: 20000 },
        );
        await host.screenshot({ path: '.cache/profile-room-chat-many-typing.png', fullPage: true });
      } finally {
        clearInterval(typingTimer);
        for (const a of paid.slice(1))
          await rpc(a.c, 'set_chat_typing', { p_room_id: room, p_is_typing: false });
      }
      await host.getByTestId('chat-typing-indicator').waitFor({ state: 'hidden', timeout: 15000 });
    }
    const live = 'Browser real-time ' + crypto.randomUUID();
    await plus.getByTestId('input-chat-message').fill(live);
    await plus.getByTestId('btn-chat-send').click();
    await host.getByText(live, { exact: true }).waitFor({ timeout: 20000 });
    console.log(
      'PASS Browser: multiple typing names collapse, stop disappears, Plus text arrives on Pro screen',
    );
    const fixtures = await host.evaluate(async () => {
      const canvas = globalThis.document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#356b96';
      ctx.fillRect(0, 0, 320, 180);
      ctx.fillStyle = '#eeeeee';
      ctx.font = '24px sans-serif';
      ctx.fillText('Fitness room test', 45, 90);
      const photo = canvas.toDataURL('image/png').split(',')[1];
      const chunks = [],
        stream = canvas.captureStream(5),
        videoMime = globalThis.MediaRecorder.isTypeSupported('video/mp4')
          ? 'video/mp4'
          : 'video/webm',
        rec = new globalThis.MediaRecorder(stream, { mimeType: videoMime });
      let frame = 0;
      const animation = setInterval(() => {
        ctx.fillStyle = '#356b96';
        ctx.fillRect(0, 0, 320, 180);
        ctx.fillStyle = '#eeeeee';
        ctx.fillRect(20 + (frame++ % 20) * 8, 50, 30, 30);
      }, 100);
      const video = await new Promise((resolve) => {
        rec.ondataavailable = (e) => chunks.push(e.data);
        rec.onstop = () => {
          const reader = new globalThis.FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.readAsDataURL(new Blob(chunks, { type: videoMime }));
        };
        rec.start();
        setTimeout(() => rec.stop(), 2200);
      });
      clearInterval(animation);
      stream.getTracks().forEach((t) => t.stop());
      return { photo, video, videoMime };
    });
    saved.mediaOwners = [saved.accounts[0].id];
    persist();
    await host.getByTestId('btn-chat-attach-photo').click();
    const chooserPromise = host.waitForEvent('filechooser');
    await host.getByTestId('choose-chat-media').click();
    await (
      await chooserPromise
    ).setFiles({
      name: 'audit-picker.png',
      mimeType: 'image/png',
      buffer: Buffer.from(fixtures.photo, 'base64'),
    });
    await host.getByTestId('composer-preview-0').waitFor({ timeout: 30000 });
    await host.getByTestId('input-chat-message').fill('Picker photo audit');
    await host.getByTestId('btn-chat-send').click();
    await plus.getByText('Picker photo audit', { exact: true }).waitFor({ timeout: 60000 });
    const pickerDeadline = Date.now() + 60000;
    let pickerMessage;
    do {
      pickerMessage = (
        await rpc(saved.accounts[0].c, 'get_chat_messages_v2', { p_room_id: room })
      ).find((m) => m.text === 'Picker photo audit');
      if (pickerMessage?.attachments?.[0]?.moderation_status === 'ok') break;
      await new Promise((r) => setTimeout(r, 1000));
    } while (Date.now() < pickerDeadline);
    assert.equal(
      pickerMessage?.attachments?.[0]?.moderation_status,
      'ok',
      'Real picker photo conversion/upload/moderation',
    );
    console.log('PASS Browser: native web picker, photo conversion, upload, send and moderation');
    const media = [];
    for (const [name, mime, b64] of [
      ['photo', 'image/png', fixtures.photo],
      ['video', fixtures.videoMime, fixtures.video],
    ]) {
      const bytes = Buffer.from(b64, 'base64'),
        client = crypto.randomUUID();
      const args = {
        room_id: room,
        client_id: client,
        mime_type: mime,
        size: bytes.length,
        attachment_index: 0,
      };
      const denied = await saved.accounts[1].c.functions.invoke('chat-upload-url', { body: args });
      assert.equal(denied.error?.context?.status, 403);
      const signed = await call(saved.accounts[0], 'chat-upload-url', args);
      const uploaded = await host.evaluate(
        async ({ url, mime, b64 }) => {
          const bytes = Uint8Array.from(atob(b64), (x) => x.charCodeAt(0));
          const r = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': mime },
            body: bytes,
          });
          return r.status;
        },
        { url: signed.upload_url, mime, b64 },
      );
      assert(uploaded >= 200 && uploaded < 300, `${name} upload ${uploaded}`);
      const msg = await rpc(saved.accounts[0].c, 'send_chat_message', {
        p_room_id: room,
        p_client_id: client,
        p_text: `Shared audit ${name}`,
        p_attachments: [
          {
            storage_key: signed.storage_key,
            size: bytes.length,
            mime_type: mime,
            width: 320,
            height: 180,
          },
        ],
      });
      const premature = await saved.accounts[1].c.functions.invoke('chat-signed-url', {
        body: { room_id: room, storage_key: signed.storage_key },
      });
      assert.equal(premature.error?.context?.status, 403);
      const finalized = await call(saved.accounts[0], 'chat-image-moderation', {
        action: 'finalize',
        storage_key: signed.storage_key,
      });
      assert.equal(finalized.status, 'ok', `${name} moderation`);
      const link = await call(saved.accounts[1], 'chat-signed-url', {
        room_id: room,
        storage_key: signed.storage_key,
      });
      const url = link.signed_url ?? link.url;
      assert(url);
      const downloaded = await fetch(url);
      assert.equal(downloaded.status, 200);
      assert.equal(Buffer.compare(Buffer.from(await downloaded.arrayBuffer()), bytes), 0);
      media.push({ msg, key: signed.storage_key, url });
      await plus.getByText(`Shared audit ${name}`, { exact: true }).waitFor({ timeout: 20000 });
      const row = await query(
        admin.from('chat_attachments').select('id').eq('storage_key', signed.storage_key).single(),
      );
      await plus.getByTestId(`att-image-${row.id}`).click();
      await plus.getByTestId('chat-image-viewer-modal').waitFor();
      if (name === 'video') {
        await plus.locator('video').waitFor({ timeout: 20000 });
        await plus.waitForFunction(
          () => globalThis.document.querySelector('video')?.readyState >= 2,
          {},
          { timeout: 20000 },
        );
        await plus.locator('video').evaluate(async (video) => {
          video.muted = true;
          await video.play();
        });
        await plus.waitForFunction(
          () => globalThis.document.querySelector('video')?.currentTime > 0,
          {},
          { timeout: 10000 },
        );
      } else await plus.getByLabel('Full size chat image').waitFor({ timeout: 20000 });
      await plus.screenshot({
        path: `.cache/profile-room-chat-${name}-viewer.png`,
        fullPage: true,
      });
      await plus.getByTestId('btn-close-viewer').click();
    }
    await query(admin.from('entitlements').delete().eq('user_id', saved.accounts[1].id));
    const denied = await saved.accounts[1].c.functions.invoke('chat-signed-url', {
      body: { room_id: room, storage_key: media[0].key },
    });
    assert.equal(denied.error?.context?.status, 403);
    await options.plan(1, 'plus');
    const removed = await call(saved.accounts[0], 'chat-image-moderation', {
      action: 'delete_message',
      message_id: media[0].msg.id,
    });
    assert.equal(removed.status, 'deleted');
    assert.equal((await fetch(media[0].url)).status, 404);
    const deleted = await saved.accounts[1].c.functions.invoke('chat-signed-url', {
      body: { room_id: room, storage_key: media[0].key },
    });
    assert.equal(deleted.error?.context?.status, 403);
    await call(saved.accounts[0], 'chat-image-moderation', { action: 'cleanup' });
    assert.equal((await fetch(media[1].url)).status, 404);
    assert.equal(
      (
        await query(
          admin
            .from('chat_media_uploads')
            .select('storage_key')
            .eq('user_id', saved.accounts[0].id),
        )
      ).length,
      0,
    );
    console.log(
      'PASS Hosted + browser: private photo/video upload, real moderation/viewing, Pro-only writes, downgrade/read denial, physical R2 deletion',
    );
  });
}
