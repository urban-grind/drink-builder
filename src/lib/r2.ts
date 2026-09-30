import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Sha256 } from "@smithy/core/checksum";
import { HttpRequest } from "@smithy/core/protocols";
import { SignatureV4 } from "@smithy/signature-v4";

export const PRESIGN_SECONDS = 300;

export type PhotoStorage = {
  presignPut(key: string, contentType: string, contentLength: number): Promise<string>;
  head(key: string): Promise<{ contentLength: number; contentType: string } | null>;
  get(key: string): Promise<Buffer | null>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
};

type R2Config = {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
};

function requiredEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

/** All five values come from the environment. A missing secret keeps uploads off. */
export function readR2Config(): R2Config | null {
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
  const bucket = requiredEnv("R2_BUCKET");
  const endpoint = requiredEnv("R2_ENDPOINT");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !endpoint) return null;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  } catch {
    return null;
  }
  return { accessKeyId, secretAccessKey, bucket, endpoint };
}

let cachedClient: { endpoint: string; client: S3Client } | null = null;

function clientFor(config: R2Config): S3Client {
  if (cachedClient && cachedClient.endpoint === config.endpoint) return cachedClient.client;
  const client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  cachedClient = { endpoint: config.endpoint, client };
  return client;
}

function isMissingObject(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const status =
    "$metadata" in error && error.$metadata && typeof error.$metadata === "object"
      ? (error.$metadata as { httpStatusCode?: number }).httpStatusCode
      : undefined;
  return name === "NotFound" || name === "NoSuchKey" || status === 404;
}

function formatPresignedUrl(request: {
  protocol: string;
  hostname: string;
  port?: number;
  path: string;
  query?: Record<string, string | readonly string[] | null | undefined>;
}): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(request.query ?? {})) {
    const value = request.query?.[key];
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
    } else {
      params.set(key, String(value));
    }
  }
  const port = request.port && request.port !== 443 && request.port !== 80 ? `:${request.port}` : "";
  const query = params.toString();
  return `${request.protocol}//${request.hostname}${port}${request.path}${query ? `?${query}` : ""}`;
}

/**
 * Presigned PUT locked to this content type and byte length.
 * The S3 presigner treats content-type as unsigned, so this signs with SignatureV4 directly.
 */
export async function presignLockedPut(
  config: R2Config,
  key: string,
  contentType: string,
  contentLength: number,
): Promise<string> {
  const endpoint = new URL(config.endpoint);
  const prefix = endpoint.pathname.replace(/\/$/, "");
  const path = `${prefix}/${config.bucket}/${key}`.replace(/\/{2,}/g, "/");
  const signer = new SignatureV4({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    region: "auto",
    service: "s3",
    sha256: Sha256,
    uriEscapePath: false,
  });
  const request = new HttpRequest({
    method: "PUT",
    protocol: endpoint.protocol,
    hostname: endpoint.hostname,
    port: endpoint.port ? Number(endpoint.port) : undefined,
    path,
    headers: {
      host: endpoint.host,
      "content-type": contentType,
      "content-length": String(contentLength),
      "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
    },
  });
  const signed = await signer.presign(request as Parameters<SignatureV4["presign"]>[0], {
    expiresIn: PRESIGN_SECONDS,
    signableHeaders: new Set(["content-type", "content-length"]),
  });
  return formatPresignedUrl({
    protocol: signed.protocol,
    hostname: signed.hostname,
    port: signed.port,
    path: signed.path,
    query: signed.query as Record<string, string | readonly string[] | null | undefined>,
  });
}

export function createR2Storage(config: R2Config): PhotoStorage {
  const client = clientFor(config);
  return {
    presignPut(key, contentType, contentLength) {
      return presignLockedPut(config, key, contentType, contentLength);
    },
    async head(key) {
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
        return {
          contentLength: Number(head.ContentLength ?? 0),
          contentType: head.ContentType ?? "",
        };
      } catch (error) {
        if (isMissingObject(error)) return null;
        throw error;
      }
    },
    async get(key) {
      try {
        const response = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
        if (!response.Body) return null;
        return Buffer.from(await response.Body.transformToByteArray());
      } catch (error) {
        if (isMissingObject(error)) return null;
        throw error;
      }
    },
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
  };
}

let storageOverride: PhotoStorage | null = null;

export function setPhotoStorageForTests(storage: PhotoStorage | null): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Test storage cannot be installed in production.");
  }
  storageOverride = storage;
}

export function getPhotoStorage(): PhotoStorage | null {
  if (storageOverride) return storageOverride;
  const config = readR2Config();
  if (!config) return null;
  return createR2Storage(config);
}

export function photosConfigured(): boolean {
  return getPhotoStorage() !== null;
}
