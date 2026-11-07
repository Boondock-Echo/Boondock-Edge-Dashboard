#!/bin/bash
# Standalone Boondock Edge installer. Optional settings: ./install.conf.
set -euo pipefail

fail() { echo "Error: $*" >&2; exit 1; }
_is_truthy() { [[ "${1,,}" =~ ^(1|true|yes|y|on)$ ]]; }

prompt_if_unset() {
    local name="$1" label="$2" default="${3:-}" value
    [ -z "${!name:-}" ] || return 0
    [ -t 0 ] || fail "Set $name in install.conf or the environment."
    if [ "$name" = ADMIN_PASSWORD ] || [ "$name" = WIFI_PASSWORD ]; then
        read -rs -p "$label [$default]: " value
        echo
    else
        read -r -p "$label [$default]: " value
    fi
    printf -v "$name" '%s' "${value:-$default}"
}

configure() {
    local environment_root="${INSTALL_ROOT:-}" environment_data="${BOONDOCK_DATA_ROOT:-}"
    [ ! -f ./install.conf ] || source ./install.conf
    INSTALL_ROOT="${environment_root:-${INSTALL_ROOT:-}}"
    prompt_if_unset INSTALL_ROOT 'Installation directory' /opt/boondock/edge
    BOONDOCK_DATA_ROOT="${environment_data:-${BOONDOCK_DATA_ROOT:-$INSTALL_ROOT}}"
    export BOONDOCK_DATA_ROOT
    [[ "$INSTALL_ROOT" = /* && "$INSTALL_ROOT" != / ]] || fail 'INSTALL_ROOT must be an absolute directory other than /.'
    [[ "$BOONDOCK_DATA_ROOT" = /* && "$BOONDOCK_DATA_ROOT" != / ]] || fail 'BOONDOCK_DATA_ROOT must be an absolute directory other than /.'
    if [ -e "$INSTALL_ROOT" ] || [ -d "$BOONDOCK_DATA_ROOT/db" ]; then
        prompt_if_unset INSTALL_MODE 'Install or upgrade?' upgrade
    else
        INSTALL_MODE=install
    fi
    case "$INSTALL_MODE" in install|upgrade) ;; *) fail 'INSTALL_MODE must be install or upgrade.' ;; esac
    prompt_if_unset INSTALL_USER 'Service account' boondock
    prompt_if_unset INSTALL_DASHBOARD 'Install dashboard?' yes
    prompt_if_unset INSTALL_API 'Install API?' yes
    prompt_if_unset UPDATE_HOSTNAME 'Set hostname to boondock-edge?' no
    prompt_if_unset ENABLE_SERVICES 'Enable API at boot?' yes
    local name
    for name in INSTALL_API INSTALL_DASHBOARD UPDATE_HOSTNAME ENABLE_SERVICES; do
        case "${!name,,}" in
            1|true|yes|y|on|0|false|no|n|off) ;;
            *) fail "$name must be yes or no." ;;
        esac
    done
    GITHUB_WEB_URL="${GITHUB_WEB_URL:-https://github.com}"
    GITHUB_OWNER="${GITHUB_OWNER:-Boondock-Echo}"
    GITHUB_API_REPO="${GITHUB_API_REPO:-Boondock-Edge-API}"
    GITHUB_DASHBOARD_REPO="${GITHUB_DASHBOARD_REPO:-Boondock-Edge-Dashboard}"
    GITHUB_FIRMWARE_REPO="${GITHUB_FIRMWARE_REPO:-Echo-Tango}"
    # Reserved for the disabled UDP integration below.
    INSTALL_UDP="${INSTALL_UDP:-no}"
    GITHUB_UDP_REPO="${GITHUB_UDP_REPO:-Boondock-Edge-Streaming}"
    UDP_REF="${UDP_REF:-${GITHUB_REF:-latest}}"
    UDP_DIR="$INSTALL_ROOT/streaming"
    API_REF="${API_REF:-${GITHUB_REF:-latest}}"
    DASHBOARD_REF="${DASHBOARD_REF:-${GITHUB_REF:-latest}}"
    if [ "${1:-}" = beta ]; then API_REF=beta; DASHBOARD_REF=beta; fi
    API_DIR="$INSTALL_ROOT/api"
    DASHBOARD_DIR="$INSTALL_ROOT/dashboard"
    SERVICE_FILE=/etc/systemd/system/boondock-edge-api.service
}

prepare_host() {
    local packages=(python3 curl) account_group
    if _is_truthy "$INSTALL_API"; then packages+=(python3-venv ffmpeg sudo); fi
    apt-get update
    apt-get install -y "${packages[@]}"
    if ! id "$INSTALL_USER" >/dev/null 2>&1; then
        useradd --system --user-group --shell /bin/bash --home-dir "$INSTALL_ROOT" "$INSTALL_USER"
    fi
    [ "$(id -u "$INSTALL_USER")" -ne 0 ] || fail 'Use an unprivileged service account.'
    account_group=$(id -gn "$INSTALL_USER")
    INSTALL_GROUP="$account_group"
    if getent group dialout >/dev/null; then usermod -aG dialout "$INSTALL_USER"; fi
    mkdir -p "$INSTALL_ROOT" "$BOONDOCK_DATA_ROOT"
    if _is_truthy "$UPDATE_HOSTNAME"; then hostnamectl set-hostname boondock-edge; fi
}

download_github() {
    curl --fail --location --silent --show-error --retry 3 --output "$2" "$1"
}

# Stage and verify before changing installed files. The subshell owns cleanup.
install_component_release() (
    set -e
    local component="$1" tag="$2" destination="$3" repository="$4" staging archive url
    staging=$(mktemp -d)
    trap 'rm -rf -- "$staging"' EXIT
    archive="boondock-edge-${component}-${tag}.tar.gz"
    url="${GITHUB_WEB_URL%/}/${GITHUB_OWNER}/${repository}/releases/download/${tag}/${archive}"
    echo "Downloading $component $tag..."
    download_github "$url" "$staging/release.tar.gz"
    download_github "$url.sha256" "$staging/release.sha256"
    python3 - "$staging" "$component" <<'PACKAGE_PY'
import hashlib, json, sys, tarfile
from pathlib import Path, PurePosixPath
root, component = Path(sys.argv[1]), sys.argv[2]
expected = (root / "release.sha256").read_text().split()[0]
if hashlib.sha256((root / "release.tar.gz").read_bytes()).hexdigest() != expected:
    sys.exit("Release checksum verification failed")
with tarfile.open(root / "release.tar.gz") as archive:
    for member in archive.getmembers():
        path = PurePosixPath(member.name)
        if (path.is_absolute() or ".." in path.parts or not path.parts
                or path.parts[0] != component or not (member.isfile() or member.isdir())):
            sys.exit("Unsafe archive: expected only the selected component directory and regular files")
    archive.extractall(root / "unpacked")
source = root / "unpacked" / component
if not (source / "build-info.json").is_file():
    sys.exit(f"Release is missing {component}/build-info.json")
info = json.loads((source / "build-info.json").read_text())
if not isinstance(info, dict) or info.get("component") != component or not info.get("version"):
    sys.exit("Invalid component build information")
if component == "api":
    for name in ("install-api-restart.sh", "boondock-edge-api-restart",
                 "boondock-edge-api-restart.service.in"):
        if not (source / "deploy/systemd" / name).is_file():
            sys.exit(f"API release is missing deploy/systemd/{name}")
PACKAGE_PY
    # Retain the previous files alongside the database snapshot for recovery.
    if [ -e "$destination" ]; then
        mkdir -p "$BACKUP_DIR"
        mv -- "$destination" "$BACKUP_DIR/$component"
    fi
    if ! mv -- "$staging/unpacked/$component" "$destination"; then
        [ ! -e "$BACKUP_DIR/$component" ] || mv -- "$BACKUP_DIR/$component" "$destination"
        exit 1
    fi
)

update_dashboard_manifest() {
    python3 - "$DASHBOARD_DIR/build-info.json" "$BOONDOCK_DATA_ROOT/manifest.json" "$INSTALL_USER" <<'MANIFEST_PY'
import json, os, pwd, sys, tempfile
from pathlib import Path

build_path, manifest_path, user = sys.argv[1:]
path = Path(manifest_path)
dashboard = json.loads(Path(build_path).read_text(encoding="utf-8"))
if not isinstance(dashboard, dict) or dashboard.get("component") != "dashboard":
    raise ValueError("Expected dashboard build information")
manifest = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
if not isinstance(manifest, dict):
    raise ValueError("Installed manifest must be a JSON object")
manifest["dashboard"] = dashboard
previous = path.stat() if path.exists() else None
account = pwd.getpwnam(user)
with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                 prefix=".manifest-", delete=False) as output:
    try:
        json.dump(manifest, output, indent=2)
        output.write("\n")
        output.flush()
        os.fsync(output.fileno())
        os.fchown(output.fileno(), previous.st_uid if previous else account.pw_uid,
                  previous.st_gid if previous else account.pw_gid)
        if previous:
            os.fchmod(output.fileno(), previous.st_mode & 0o777)
        os.replace(output.name, path)
    finally:
        Path(output.name).unlink(missing_ok=True)
MANIFEST_PY
}

install_firmware() {
    local device asset folder timestamp
    mkdir -p "$BOONDOCK_DATA_ROOT/firmware"
    timestamp=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
    for device in echo tango; do
        folder="$WORK_DIR/latest_$device"
        mkdir -p "$folder"
        for asset in bootloader.bin firmware.bin partitions.bin; do
            download_github "${GITHUB_WEB_URL%/}/${GITHUB_OWNER}/${GITHUB_FIRMWARE_REPO}/releases/download/latest-$device/$asset" "$folder/$asset"
        done
        rm -rf -- "$BOONDOCK_DATA_ROOT/firmware/latest_$device"
        mv "$folder" "$BOONDOCK_DATA_ROOT/firmware/"
    done
    cat > "$BOONDOCK_DATA_ROOT/firmware/firmware.json" <<EOF
{
  "latest_echo": {"name": "Latest Echo", "description": "", "folder": "latest_echo", "created_at": "$timestamp"},
  "latest_tango": {"name": "Latest Tango", "description": "", "folder": "latest_tango", "created_at": "$timestamp"}
}
EOF
}

collect_setup() {
    prompt_if_unset ADMIN_EMAIL 'Administrator email'
    [[ "$ADMIN_EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || fail 'Invalid administrator email.'
    prompt_if_unset ADMIN_PASSWORD 'Administrator password'
    [ "${#ADMIN_PASSWORD}" -gt 8 ] || fail 'Administrator password must have more than 8 characters.'
    prompt_if_unset CONFIGURE_RECORDERS 'Configure recorders?' yes
    case "${CONFIGURE_RECORDERS,,}" in
        1|true|yes|y|on|0|false|no|n|off) ;; *) fail 'CONFIGURE_RECORDERS must be yes or no.' ;;
    esac
    prompt_if_unset INBOX_VIEW 'Inbox view (continuous/paged)' continuous
    prompt_if_unset MESSAGE_SORTING 'Message sorting (newest/oldest)' newest
    case "$INBOX_VIEW" in continuous|paged) ;; *) fail 'Invalid inbox view.' ;; esac
    case "$MESSAGE_SORTING" in newest|oldest) ;; *) fail 'Invalid message sorting.' ;; esac
    WIFI_SSID= WIFI_IP_ADDRESS=
    if command -v nmcli >/dev/null; then
        local device connection stored_psk derived_psk configured_password="${WIFI_PASSWORD:-}"
        device=$(LC_ALL=C nmcli -t -f DEVICE,TYPE,STATE device status | awk -F: '$2=="wifi" && $3=="connected" {print $1; exit}')
        if [ -n "$device" ]; then
            connection=$(nmcli --escape no -g GENERAL.CONNECTION device show "$device")
            WIFI_SSID=$(nmcli --escape no -g 802-11-wireless.ssid connection show "$connection")
            WIFI_PASSWORD=$(nmcli --escape no --show-secrets -g 802-11-wireless-security.psk connection show "$connection")
            WIFI_IP_ADDRESS=$(nmcli --escape no -g IP4.ADDRESS device show "$device" | head -n 1)
            WIFI_IP_ADDRESS="${WIFI_IP_ADDRESS%%/*}"
            if [[ "$WIFI_PASSWORD" =~ ^[0-9A-Fa-f]{64}$ ]]; then
                stored_psk="${WIFI_PASSWORD,,}"
                WIFI_PASSWORD="$configured_password"
                prompt_if_unset WIFI_PASSWORD "WiFi passphrase for $WIFI_SSID"
                derived_psk=$(WIFI_VERIFY_PASSWORD="$WIFI_PASSWORD" WIFI_VERIFY_SSID="$WIFI_SSID" python3 -c \
                    'import hashlib,os; print(hashlib.pbkdf2_hmac("sha1",os.environ["WIFI_VERIFY_PASSWORD"].encode(),os.environ["WIFI_VERIFY_SSID"].encode(),4096,32).hex())')
                [ "$derived_psk" = "$stored_psk" ] || fail 'WiFi passphrase does not match the stored key.'
            fi
        fi
    fi
}

initialize_components() {
    if _is_truthy "$INSTALL_API"; then
        local args=(upgrade)
        if [ "$INSTALL_MODE" = install ]; then
            SETUP_FILE="$WORK_DIR/setup.json"
            export ADMIN_EMAIL ADMIN_PASSWORD CONFIGURE_RECORDERS INBOX_VIEW MESSAGE_SORTING WIFI_SSID WIFI_PASSWORD WIFI_IP_ADDRESS
            python3 - "$SETUP_FILE" <<'SETUP_PY'
import json, os, sys
v = os.environ
wifi = {key: v.get("WIFI_" + key.upper(), "") for key in ("ssid", "password", "ip_address")}
config = {
    "admin": {"email": v["ADMIN_EMAIL"], "password": v["ADMIN_PASSWORD"]},
    "selected_devices": ["boondock_edge"] if v["CONFIGURE_RECORDERS"].lower() in ("1", "true", "yes", "y", "on") else [],
    "wifi": wifi if wifi["ssid"] else None,
    "preferences": {"inbox_view": v["INBOX_VIEW"], "message_sorting": v["MESSAGE_SORTING"]},
}
with open(sys.argv[1], "w") as stream:
    json.dump(config, stream)
SETUP_PY
            chown "$INSTALL_USER" "$SETUP_FILE"
            chmod 600 "$SETUP_FILE"
            args=(setup --config "$SETUP_FILE")
        fi
        # The API CLI records its own metadata after setup/migrations succeed.
        runuser -u "$INSTALL_USER" -- env "BOONDOCK_DATA_ROOT=$BOONDOCK_DATA_ROOT" \
            "$INSTALL_ROOT/venv/bin/python" "$API_DIR/manage.py" "${args[@]}"
        if [ -n "${SETUP_FILE:-}" ]; then rm -f -- "$SETUP_FILE"; fi
        unset ADMIN_PASSWORD WIFI_PASSWORD
    fi
    if _is_truthy "$INSTALL_DASHBOARD"; then update_dashboard_manifest; fi
    echo "Installed metadata: $BOONDOCK_DATA_ROOT/manifest.json"
}

configure_api_service() {
    cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Boondock Edge Application Server
After=network.target

[Service]
Type=simple
User=$INSTALL_USER
WorkingDirectory=$API_DIR
Environment="BOONDOCK_DATA_ROOT=$BOONDOCK_DATA_ROOT"
Environment="PATH=$INSTALL_ROOT/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
Environment="FLASK_PORT=4000"
ExecStart="$INSTALL_ROOT/venv/bin/python" "$API_DIR/run.py"
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    (cd "$API_DIR" && bash deploy/systemd/install-api-restart.sh "${SERVICE_FILE##*/}")
}

finish_services() {
    if _is_truthy "$INSTALL_API"; then
        configure_api_service
        if _is_truthy "$ENABLE_SERVICES"; then systemctl enable "${SERVICE_FILE##*/}"; fi
    fi
    if _is_truthy "$INSTALL_API" || [ "$API_WAS_RUNNING" = yes ]; then
        systemctl start "${SERVICE_FILE##*/}"
        sleep 3
        systemctl is-active --quiet "${SERVICE_FILE##*/}" || fail 'API failed to start; check its systemd journal.'
    fi
}

main() {
    case "${1:-}" in
        -h|--help) echo "Usage: $0 [beta] (settings in ./install.conf)"; return ;;
        ''|beta) ;; *) fail "Usage: $0 [beta]" ;;
    esac
    [ "$#" -le 1 ] || fail "Usage: $0 [beta]"
    [ "$EUID" -eq 0 ] || fail 'Run this installer as root.'
    configure "${1:-}"
    if ! _is_truthy "$INSTALL_API" && ! _is_truthy "$INSTALL_DASHBOARD"; then echo 'No components selected.'; return; fi
    prepare_host
    if _is_truthy "$INSTALL_API" && [ "$INSTALL_MODE" = install ]; then collect_setup; fi
    WORK_DIR=$(mktemp -d)
    # setup.json is private but must be reachable by the API service account.
    chown "$INSTALL_USER" "$WORK_DIR"
    trap 'rm -rf -- "$WORK_DIR"' EXIT
    BACKUP_DIR="$BOONDOCK_DATA_ROOT/backups/installer-$(date -u +%Y%m%dT%H%M%S)-$$"
    # Download and provision dependencies before the maintenance window.
    if _is_truthy "$INSTALL_DASHBOARD"; then
        install_component_release dashboard "$DASHBOARD_REF" "$WORK_DIR/dashboard" "$GITHUB_DASHBOARD_REPO"
    fi
    if _is_truthy "$INSTALL_API"; then
        install_component_release api "$API_REF" "$WORK_DIR/api" "$GITHUB_API_REPO"
        python3 -m venv "$INSTALL_ROOT/venv"
        "$INSTALL_ROOT/venv/bin/python" -m pip install --upgrade -r "$WORK_DIR/api/requirements.txt"
    fi
    API_WAS_RUNNING=no
    if systemctl is-active --quiet "${SERVICE_FILE##*/}"; then API_WAS_RUNNING=yes; fi
    # Stop the API before replacing either component or migrating data.
    if systemctl cat "${SERVICE_FILE##*/}" >/dev/null 2>&1; then systemctl stop "${SERVICE_FILE##*/}"; fi
    mkdir -p "$BACKUP_DIR"
    chmod 700 "$BACKUP_DIR"
    local item
    for item in db device_settings manifest.json; do
        [ ! -e "$BOONDOCK_DATA_ROOT/$item" ] || cp -a "$BOONDOCK_DATA_ROOT/$item" "$BACKUP_DIR/"
    done
    for item in api dashboard; do
        [ -d "$WORK_DIR/$item" ] || continue
        [ ! -e "$INSTALL_ROOT/$item" ] || mv "$INSTALL_ROOT/$item" "$BACKUP_DIR/$item"
        mv "$WORK_DIR/$item" "$INSTALL_ROOT/$item"
    done
    if _is_truthy "$INSTALL_API"; then
        mkdir -p "$BOONDOCK_DATA_ROOT"/{db/reports,db/recorder_configs,device_settings,logs,recordings,uploads}
        install_firmware
    fi
    # Preserve file modes; do not make databases, credentials, and every asset executable.
    chown "$INSTALL_USER:$INSTALL_GROUP" "$INSTALL_ROOT" "$BOONDOCK_DATA_ROOT"
    for item in api dashboard venv; do
        [ ! -e "$INSTALL_ROOT/$item" ] || chown -R "$INSTALL_USER:$INSTALL_GROUP" "$INSTALL_ROOT/$item"
    done
    for item in db device_settings logs recordings uploads firmware; do
        [ ! -e "$BOONDOCK_DATA_ROOT/$item" ] || chown -R "$INSTALL_USER:$INSTALL_GROUP" "$BOONDOCK_DATA_ROOT/$item"
    done
    initialize_components
    finish_services
    echo "Installation complete. Data: $BOONDOCK_DATA_ROOT"
    echo "Backup: $BACKUP_DIR"
    echo "Dashboard: http://$(hostname).local:4000"
}

# UDP is reserved for later enablement. Keep its source download and service
# scaffolding here; the active installer selects only API and dashboard.
download_github_archive() {
    local repository="$1"
    local ref="$2"
    local output="$3"

    download_github \
        "${GITHUB_WEB_URL%/}/${GITHUB_OWNER}/${repository}/tarball/${ref}" \
        "$output"
}

install_component_archive() {
    local repository="$1"
    local ref="$2"
    local destination="$3"
    local component_name="$4"
    local archive_path

    archive_path=$(mktemp --suffix=.tgz)

    rm -rf "$destination"
    mkdir -p "$destination"

    echo "Downloading $component_name from GitHub repository ${GITHUB_OWNER}/${repository} at ref ${ref}..."
    if ! download_github_archive "$repository" "$ref" "$archive_path"; then
        rm -f -- "$archive_path"
        echo "Error: Failed to download $component_name from GitHub." >&2 >&2
        return 1
    fi

    if ! tar -xzf "$archive_path" -C "$destination" --strip-components=1; then
        rm -f -- "$archive_path"
        echo "Error: Failed to extract $component_name archive." >&2 >&2
        return 1
    fi

    rm -f -- "$archive_path"
    echo "✓ $component_name installed to $destination"
}

# prompt_if_unset INSTALL_UDP "Install Boondock Edge UDP? (yes/no)" "no"
# if _is_truthy "$INSTALL_UDP"; then
#     install_component_archive "$GITHUB_UDP_REPO" "$UDP_REF" "$UDP_DIR" "UDP"
# fi
#UDP_SERVICE_FILE="/etc/systemd/system/boondock-edge-udp.service"
#if _is_truthy "$INSTALL_UDP"; then
#    echo "Creating systemd service for UDP..."
#    cat > "$UDP_SERVICE_FILE" << EOF
# [Unit]
# Description=Boondock Edge UDP Service
# After=network.target

# [Service]
# Type=simple
# User=$INSTALL_USER
# SupplementaryGroups=dialout
# WorkingDirectory=$UDP_DIR
# Environment="PATH=$INSTALL_ROOT/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
# ExecStart=$INSTALL_ROOT/venv/bin/python $UDP_DIR/run.py
# Restart=always
# RestartSec=10
# StandardOutput=journal
# StandardError=journal

# [Install]
# WantedBy=multi-user.target
# EOF

#     echo "✓ UDP service file created: $UDP_SERVICE_FILE"
# fi

# systemctl enable boondock-edge-udp.service
# systemctl start boondock-edge-udp.service

# Allow isolated function tests without running the appliance installation.
if [[ "${BASH_SOURCE[0]}" = "$0" ]]; then main "$@"; fi
