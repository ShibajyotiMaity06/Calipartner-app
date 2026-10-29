import { AwsClient } from 'npm:aws4fetch@1.0.20';

/** Server-only AWS Signature V4 signing. Never fall back to mock credentials. */
export async function signR2Url({
  method,
  key,
  expiresInSeconds = 300,
  contentType,
}: {
  method: 'GET' | 'PUT' | 'HEAD' | 'DELETE';
  key: string;
  expiresInSeconds?: number;
  contentType?: string;
}): Promise<string> {
  const account = Deno.env.get('R2_ACCOUNT_ID');
  const bucket = Deno.env.get('R2_CHAT_BUCKET') || 'calipartner-chat-private';
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  if (!account || !accessKeyId || !secretAccessKey) throw new Error('MEDIA_NOT_CONFIGURED');
  if (!/^[a-zA-Z0-9]+$/.test(account) || !/^[a-z0-9.-]+$/.test(bucket))
    throw new Error('MEDIA_NOT_CONFIGURED');
  const path = key.split('/').map(encodeURIComponent).join('/');
  const url = new URL(`https://${account}.r2.cloudflarestorage.com/${bucket}/${path}`);
  url.searchParams.set('X-Amz-Expires', String(Math.min(900, Math.max(1, expiresInSeconds))));
  const client = new AwsClient({ service: 's3', region: 'auto', accessKeyId, secretAccessKey });
  return (
    await client.sign(
      new Request(url, {
        method,
        headers: contentType ? { 'Content-Type': contentType } : undefined,
      }),
      { aws: { signQuery: true, allHeaders: true } },
    )
  ).url;
}
