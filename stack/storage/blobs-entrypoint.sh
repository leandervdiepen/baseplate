#!/bin/sh
# SeaweedFS reads its S3 identities from a file. Those credentials are generated
# per project and arrive in the environment, so the file is written here at
# start rather than committed to this repo with a working secret in it.
set -e

mkdir -p /etc/seaweedfs
cat > /etc/seaweedfs/s3.json <<JSON
{
  "identities": [
    {
      "name": "baseplate",
      "credentials": [
        {
          "accessKey": "${STORAGE_ACCESS_KEY}",
          "secretKey": "${STORAGE_SECRET_KEY}"
        }
      ],
      "actions": ["Admin", "Read", "Write", "List", "Tagging"]
    }
  ]
}
JSON
chmod 600 /etc/seaweedfs/s3.json

exec weed server \
  -dir=/data \
  -s3 \
  -s3.config=/etc/seaweedfs/s3.json \
  -master.volumeSizeLimitMB=1024
