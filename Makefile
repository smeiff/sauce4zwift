default: build

PACKAGES := node_modules/.build
BUILD := build.json

SHELL := powershell.exe

ifeq ($(OS),Windows_NT)
  WINBLOWS := true
else
  T := $(shell uname -s)
  ifeq ($(T),Linux)
    LINUX := true
  endif
  ifeq ($(UNAME_S),Darwin)
    MAC := true
  endif
endif

MODS := $(CURDIR)/node_modules
NPATH := $(MODS)/.bin
NODE := ELECTRON_RUN_AS_NODE=1 $(NPATH)/electron
TOOLPATH := $(CURDIR)/tools/bin

# Set shell for Windows builds
ifeq ($(OS),Windows_NT)
  SHELL := cmd.exe
  .SHELLFLAGS := /s /c
  .SHELL_FLAGS := /s /c
endif

ifndef WINBLOWS
	PAGES_SRC := $(shell find pages -type f)
else
	PAGES_SRC := $(shell for /r pages %%i in (*) do @echo %%~fi)
endif


$(PACKAGES): package.json
	npm install
	echo "" > $@


$(BUILD): $(PAGES_SRC) $(PACKAGES) sass deps Makefile .git/index test
ifdef WINBLOWS
	@"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "$env:ELECTRON_RUN_AS_NODE=1; & '$(NPATH)/electron' 'tools/bin/buildenv' '$(subst \,$$,$@)'"
else
	$(NODE) tools/bin/buildenv $@
endif

build: $(BUILD)


run: $(BUILD)
	npm start

run-debug: $(BUILD)
	npm run start-debug

run-debug-brk: $(BUILD)
	npm run start-debug-brk


fix-windows-integrity:
	ifdef WINBLOWS
		@"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "if (Test-Path 'dist/.cache') { Remove-Item -Recurse -Force 'dist/.cache' }"
	else
		rm -rf dist/.cache  # asar/fuses corrupt without this
	endif

ifdef WINBLOWS
  MAYBE_FIX_WINDOWS_INTEGRITY := fix-windows-integrity
endif

unpacked: $(BUILD) $(MAYBE_FIX_WINDOWS_INTEGRITY)
ifndef WINBLOWS
	SKIP_NOTARIZE=1 npm run unpacked
else
	npm run unpacked
endif

packed: $(BUILD) $(MAYBE_FIX_WINDOWS_INTEGRITY)
ifndef WINBLOWS
	SKIP_NOTARIZE=1 npm run build
else
	npm run build
endif

publish: $(BUILD) $(MAYBE_FIX_WINDOWS_INTEGRITY)
ifdef LINUX 
  ifneq ($(LINUX_SAFE_PUBLISH),true)
	@echo
	@echo Use publish-docker-linux-native for linux to avoid libc issues
	exit 1
  endif
endif
	ifdef WINBLOWS
		@"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "$env:GH_TOKEN=$env:GH_TOKEN_SAUCE4ZWIFT_RELEASE; npm run publish"
	else
		GH_TOKEN="$${GH_TOKEN_SAUCE4ZWIFT_RELEASE}" npm run publish
	endif

publish-docker-linux-native:
	docker build --build-arg arch=amd64 -t linux-s4z-build -f ./build/linux.Dockerfile .
	docker run -it --rm -v $$HOME/.git-credentials:/root/.git-credentials \
		-e GH_TOKEN_SAUCE4ZWIFT_RELEASE -e LINUX_SAFE_PUBLISH=true \
		-v $(CURDIR)/dist/docker-dist:/sauce4zwift/dist linux-s4z-build make publish

deps:
ifdef WINBLOWS
	$(MAKE) -C pages/deps
	$(MAKE) -C shared/deps
else
	$(MAKE) -j 32 -C pages/deps
	$(MAKE) -j 32 -C shared/deps
endif

sass:
	"C:\Program Files\nodejs\node.exe" node_modules/sass/sass.js pages/scss:pages/css

sass-watch:
	"C:\Program Files\nodejs\node.exe" node_modules/sass/sass.js pages/scss:pages/css --watch


lint:
	"C:\Program Files\nodejs\node.exe" node_modules/eslint/bin/eslint.js src shared pages/src

lint-watch:
ifndef WINBLOWS
  ifdef LINUX
	tools/bin/lintwatch
  else
	while true ; do \
		$(MAKE) lint; \
		sleep 5; \
	done
  endif
else
	@echo Unsupported on winblows
endif


realclean: clean
	ifdef WINBLOWS
		@"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "if (Test-Path 'node_modules') { Remove-Item -Recurse -Force 'node_modules' }"
	else
		rm -rf node_modules
	endif
	
clean:
	rm -f $(BUILD)
	rm -rf pages/css
ifdef WINBLOWS
	@"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "foreach ($p in @('dist/.cache','dist/win-unpacked')) { if (Test-Path $p) { Remove-Item -Recurse -Force $p } }"
endif
ifdef LINUX
	rm -rf dist/linux-unpacked
	sudo rm -rf dist/docker-dist/linux-unpacked
endif
ifdef MAC
	rm -rf dist/mac-universal dist/mac-arm64
endif
	$(MAKE) -C shared/deps clean
	$(MAKE) -C pages/deps clean


test:
ifdef WINBLOWS
	cmd /c "set ELECTRON_RUN_AS_NODE=1&& ""$(subst /,\,$(NPATH))\electron.cmd"" --test"
else
	$(NODE) --test
endif

test-debug:
ifdef WINBLOWS
	cmd /c "set ELECTRON_RUN_AS_NODE=1&& ""$(subst /,\,$(NPATH))\electron.cmd"" --test --experimental-test-isolation=none --inspect-brk"
else
	$(NODE) --test --experimental-test-isolation=none --inspect-brk
endif

test-watch:
ifdef WINBLOWS
	cmd /c "set ELECTRON_RUN_AS_NODE=1&& ""$(subst /,\,$(NPATH))\electron.cmd"" --test --watch"
else
	$(NODE) --test --watch
endif


.PHONY: build packed unpacked publish lint sass deps clean realclean test fix-windows-integrity
