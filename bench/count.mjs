import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

const client = new S3Client({
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: { accessKeyId: 'minioadmin', secretAccessKey: 'minioadmin' },
})

let n = 0,
  token
do {
  const r = await client.send(
    new ListObjectsV2Command({ Bucket: 'uoozer-vault', ContinuationToken: token })
  )
  n += r.KeyCount ?? 0
  token = r.IsTruncated ? r.NextContinuationToken : undefined
} while (token)
console.log('objects in MinIO:', n)
