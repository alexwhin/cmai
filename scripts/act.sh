#!/usr/bin/env bash

# act.sh - Wrapper for running GitHub Actions locally
#
# Usage:
#   pnpm act                                    # Run Pipeline workflow (default)
#   pnpm act -l                                 # List all jobs
#   pnpm act push                               # Run workflows triggered by push
#   pnpm act pull_request                       # Run workflows triggered by PR
#   pnpm act workflow_dispatch -W .github/workflows/release.yml  # Run release workflow
#   pnpm act -W .github/workflows/pipeline.yml -j quality-checks --matrix os:ubuntu-latest --matrix node-version:20.x  # Run specific job with matrix

# If no arguments provided, run Pipeline workflow by default
if [ $# -eq 0 ]; then
  set -- "-W" ".github/workflows/pipeline.yml"
fi

# Auto-detect OrbStack Docker socket
if [ -S "$HOME/.orbstack/run/docker.sock" ]; then
  export DOCKER_HOST="unix://$HOME/.orbstack/run/docker.sock"
fi

exec act \
  -P ubuntu-latest=catthehacker/ubuntu:act-latest \
  -P ubuntu-22.04=catthehacker/ubuntu:act-22.04 \
  -P ubuntu-20.04=catthehacker/ubuntu:act-20.04 \
  -P ubuntu-18.04=catthehacker/ubuntu:act-18.04 \
  --container-architecture linux/amd64 \
  --pull=false \
  --reuse \
  --env CI=true \
  --env ACT=true \
  --env GITHUB_ACTIONS=true \
  "$@"