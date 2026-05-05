#!/usr/bin/env python3
"""
MCP stdio-to-HTTP proxy with automatic gcloud token refresh.
Reads JSON-RPC messages from stdin, forwards to a Google MCP HTTP server
with a fresh Bearer token, and writes responses to stdout.

Usage: python3 gcp_mcp_proxy.py <target_url>
Example: python3 gcp_mcp_proxy.py https://bigquery.googleapis.com/mcp
"""
import sys
import os
import json
import subprocess
import urllib.request
import urllib.error

# Ensure Homebrew and common gcloud install locations are on PATH so this
# proxy works when spawned by Claude Code, which uses a restricted PATH.
_extra_paths = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/local/google-cloud-sdk/bin']
os.environ['PATH'] = ':'.join(_extra_paths) + ':' + os.environ.get('PATH', '')


def get_token():
    result = subprocess.run(
        ['gcloud', 'auth', 'print-access-token'],
        capture_output=True, text=True, check=True
    )
    return result.stdout.strip()


def forward(url, payload, token):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': f'Bearer {token}',
        },
        method='POST'
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        return {
            'jsonrpc': '2.0',
            'error': {'code': e.code, 'message': f'HTTP {e.code}: {body[:200]}'},
            'id': payload.get('id')
        }


def main():
    if len(sys.argv) < 2:
        print('Usage: gcp_mcp_proxy.py <url>', file=sys.stderr)
        sys.exit(1)

    url = sys.argv[1]

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        payload = {}
        try:
            payload = json.loads(line)
            token = get_token()
            response = forward(url, payload, token)
            print(json.dumps(response), flush=True)
        except Exception as e:
            print(json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32000, 'message': str(e)},
                'id': payload.get('id')
            }), flush=True)


if __name__ == '__main__':
    main()
