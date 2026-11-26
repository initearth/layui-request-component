export declare const JWT_SECRET: string;
export declare const ACCESS_TTL: number;
export declare const REFRESH_TTL: number;

export declare function base64url(input: string | Buffer): string;
export declare function signJWT(payload: Record<string, any>, expiresIn: number, secret?: string): string;
export declare function verifyJWT(token: string, secret?: string): {
  valid: boolean;
  reason?: string;
  payload: Record<string, any> | null;
};
export declare function bearerOf(header: string | undefined | null): string | null;
