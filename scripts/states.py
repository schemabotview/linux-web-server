#!/usr/bin/env python3
"""Saved machines as GitHub release assets: one release, tag `states`, one asset per step.

  python3 scripts/states.py push base first-login/03-ssh     upload these steps' states (RELEASE_TOKEN)
  python3 scripts/states.py push --all                        every state in .machine/states
  python3 scripts/states.py pull first-login/04-commands      download what a step needs: its whole
                                                              chain from base (no token: the repo is public)

An asset is `<course>--<step>.tar` (`base.tar`): the step's .machine/states/<step>/ folder — each VM's
compressed disk overlay, RAM delta and state.json. A pull checks every file against state.json and,
for a recorded step, state.json against recorded.json: a state that is not the recording's is refused.
Re-pushing a step replaces its asset (a re-recorded step has new states).

The token is a fine-grained one for this repository only, Contents: read and write, in the
environment as RELEASE_TOKEN — never in a file, never on a command line.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import ssl
import sys
import tarfile
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from machine import STATES, sha  # noqa: E402
from record import SPINE, chain_of  # noqa: E402

REPO = 'schemabotview/linux-web-server'
TAG = 'states'
API = f'https://api.github.com/repos/{REPO}'
CA = '/root/.ccr/ca-bundle.crt'   # a cloud session's egress proxy re-signs TLS
CTX = ssl.create_default_context(cafile=CA if os.path.exists(CA) else None)


def call(method: str, url: str, body: bytes | None = None, ctype: str = 'application/json', auth: bool = True):
    req = urllib.request.Request(url, data=body, method=method, headers={
        'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': ctype})
    if auth:
        token = os.environ.get('RELEASE_TOKEN')
        if not token:
            raise SystemExit('RELEASE_TOKEN is not set: add it to the environment (see this file\'s docstring)')
        req.add_header('Authorization', f'Bearer {token}')
    with urllib.request.urlopen(req, context=CTX, timeout=3600) as r:
        data = r.read()
        return json.loads(data) if data and 'json' in r.headers.get('Content-Type', '') else data


def asset_name(step: str) -> str:
    return step.replace('/', '--') + '.tar'


def release(create: bool) -> dict | None:
    try:
        return call('GET', f'{API}/releases/tags/{TAG}', auth=create)
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise
    if not create:
        return None
    return call('POST', f'{API}/releases', json.dumps({
        'tag_name': TAG, 'target_commitish': 'main', 'name': 'Saved machines',
        'body': 'The recorder\'s saved VM states, one asset per spine step (scripts/states.py). '
                'Not a release of the course.', 'prerelease': True}).encode())


def push(steps: list[str]) -> None:
    rel = release(create=True)
    existing = {a['name']: a for a in call('GET', f'{API}/releases/{rel["id"]}/assets?per_page=100')}
    upload = rel['upload_url'].split('{')[0]
    for step in steps:
        d = STATES / step
        if not (d / 'state.json').exists():
            raise SystemExit(f'{step}: no saved state in {d}')
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode='w') as tar:
            for f in sorted(d.iterdir()):
                tar.add(f, arcname=f.name)
        name = asset_name(step)
        if name in existing:
            call('DELETE', f'{API}/releases/assets/{existing[name]["id"]}')
        call('POST', f'{upload}?name={name}', buf.getvalue(), 'application/x-tar')
        print(f'{step}: pushed {buf.tell() / 1e6:.1f} MB')


def pull(step: str) -> None:
    rel = release(create=False)
    if rel is None:
        raise SystemExit(f'no release {TAG!r} on {REPO}: nothing has been pushed yet')
    assets = {a['name']: a for a in rel['assets']}
    for s in chain_of(step):
        d = STATES / s
        if (d / 'state.json').exists():
            continue
        name = asset_name(s)
        if name not in assets:
            raise SystemExit(f'{s}: no asset {name} — record it, or push it from where it was recorded')
        data = call('GET', assets[name]['browser_download_url'], auth=False)
        d.mkdir(parents=True, exist_ok=True)
        with tarfile.open(fileobj=io.BytesIO(data)) as tar:
            tar.extractall(d, filter='data')
        meta = json.loads((d / 'state.json').read_text())
        for vm, m in meta.items():
            if sha(d / f'{vm}.ram.zst') != m['ram_sha'] or sha(d / f'{vm}.qcow2') != m['disk_sha']:
                raise SystemExit(f'{s}: {vm} does not match its state.json — refused')
        if s != 'base':
            rec = json.loads((SPINE / s / 'recorded.json').read_text())
            if rec['states'] != meta:
                raise SystemExit(f'{s}: the release holds a different recording than recorded.json — refused')
        print(f'{s}: pulled {len(data) / 1e6:.1f} MB')


if __name__ == '__main__':
    if len(sys.argv) < 3 or sys.argv[1] not in ('push', 'pull'):
        raise SystemExit(__doc__)
    if sys.argv[1] == 'push':
        push(sorted(str(p.parent.relative_to(STATES)) for p in STATES.rglob('state.json'))
             if sys.argv[2:] == ['--all'] else sys.argv[2:])
    else:
        for step in sys.argv[2:]:
            pull(step)
