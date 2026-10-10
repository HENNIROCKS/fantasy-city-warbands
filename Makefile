# Herd's nvm puts Node 16 first in PATH, and SvelteKit, Vite and svelte-check
# need 20+ – without this every target fails with a message that reads like a
# problem with the project. Where there is no Homebrew the directory does not
# exist and prepending it does nothing, so this carries no local detail.
export PATH := /opt/homebrew/bin:$(PATH)

# None of these are files. `build` in particular would otherwise be considered
# up to date, because the build writes a directory of that name.
.PHONY: install dev build check

install:
	npm install

dev:
	npm run dev

build:
	npm run build

check:
	npm run check
