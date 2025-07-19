#!/bin/bash

pnpm build
# shellcheck disable=SC2006
version=`jq -r '.version' './package.json'`
code --install-extension "./vscode-rectorphp-$version.vsix" 