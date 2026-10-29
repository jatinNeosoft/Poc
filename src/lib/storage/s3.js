// S3 / S3-compatible driver — same interface as the local driver.
// Not wired up in the POC: install @aws-sdk/client-s3 and implement these with
// PutObject / HeadObject / GetObject (Range) / DeleteObject using S3_BUCKET, S3_REGION, S3_ENDPOINT.

function notConfigured() {
  throw new Error("S3 storage is not configured yet. Set STORAGE_DRIVER=local or implement src/lib/storage/s3.js")
}

export const s3StorageDriver = {
  name: "s3",
  save: notConfigured,
  stat: notConfigured,
  read: notConfigured,
  remove: notConfigured,
}
