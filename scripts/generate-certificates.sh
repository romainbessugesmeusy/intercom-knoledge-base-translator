#!/bin/bash

# Create certificates directory if it doesn't exist
mkdir -p certificates

# Generate private key and certificate with modern settings
openssl req -x509 \
  -newkey rsa:2048 \
  -keyout certificates/key.pem \
  -out certificates/cert.pem \
  -days 365 \
  -nodes \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
  -addext "extendedKeyUsage=serverAuth" \
  -addext "keyUsage=digitalSignature,keyEncipherment"

# Set proper permissions
chmod 600 certificates/key.pem
chmod 600 certificates/cert.pem

echo "SSL certificates generated successfully in the certificates directory" 