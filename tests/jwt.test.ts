import { describe, expect, it } from 'vitest';

const jwtModule = await import('../scripts/jwt.mjs');
const { signJWT, verifyJWT, bearerOf, base64url, ACCESS_TTL, REFRESH_TTL } = jwtModule;

describe('scripts/jwt', function () {
  it('signJWT 应生成 header.payload.signature 三段结构', function () {
    const token = signJWT({ sub: '1', name: 'Ada' }, ACCESS_TTL);
    const parts = token.split('.');

    expect(parts.length).toBe(3);
    expect(JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))).toEqual({
      alg: 'HS256',
      typ: 'JWT'
    });
  });

  it('verifyJWT 应正确解析有效 token 的 claims', function () {
    const token = signJWT({ sub: '1', name: 'Ada', role: 'admin' }, ACCESS_TTL);
    const result = verifyJWT(token);

    expect(result.valid).toBe(true);
    expect(result.payload!.sub).toBe('1');
    expect(result.payload!.name).toBe('Ada');
    expect(result.payload!.role).toBe('admin');
    expect(result.payload!.iat).toBeTypeOf('number');
    expect(result.payload!.exp).toBe(result.payload!.iat + ACCESS_TTL);
  });

  it('verifyJWT 应识别过期 token', function () {
    const token = signJWT({ sub: '1' }, -60);
    const result = verifyJWT(token);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('expired');
    expect(result.payload!.sub).toBe('1');
  });

  it('verifyJWT 应拒绝篡改签名的 token', function () {
    const token = signJWT({ sub: '1' }, ACCESS_TTL);
    const parts = token.split('.');
    const tampered = parts[0] + '.' + parts[1] + '.invalid-signature';

    expect(verifyJWT(tampered).reason).toBe('invalid_signature');
  });

  it('verifyJWT 应拒绝错误密钥签发的 token', function () {
    const token = signJWT({ sub: '1' }, ACCESS_TTL, 'other-secret');
    expect(verifyJWT(token).reason).toBe('invalid_signature');
  });

  it('verifyJWT 应拒绝无效结构的 token', function () {
    expect(verifyJWT('').reason).toBe('missing');
    expect(verifyJWT('invalid').reason).toBe('malformed');

    const badPayload = base64url('not-json') + '.' + base64url('{}') + '.sig';
    expect(verifyJWT(badPayload).reason).toBe('invalid_signature');

    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const badBody = header + '.' + base64url('not-json') + '.sig';
    const result = verifyJWT(badBody, 'sig');
    expect(result.valid).toBe(false);
  });

  it('verifyJWT 应拒绝非法 payload 的 token', async function () {
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = base64url('not-json');
    const { createHmac } = await import('node:crypto');
    const signature = createHmac('sha256', 'layui-request-demo-secret')
      .update(header + '.' + payload)
      .digest('base64url');

    const result = verifyJWT(header + '.' + payload + '.' + signature);
    expect(result.reason).toBe('invalid_payload');
  });

  it('bearerOf 应提取 Bearer token', function () {
    expect(bearerOf('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(bearerOf('bearer abc')).toBe('abc');
    expect(bearerOf('Basic abc')).toBeNull();
    expect(bearerOf('')).toBeNull();
  });

  it('ACCESS_TTL 与 REFRESH_TTL 应为预期时长', function () {
    expect(ACCESS_TTL).toBe(120);
    expect(REFRESH_TTL).toBe(3600);
  });
});
