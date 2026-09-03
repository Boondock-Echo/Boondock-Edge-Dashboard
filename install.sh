#!/bin/bash
# install.sh - Installation script for Boondock Edge
# This script sets up selected Boondock Edge components in /opt/boondock/edge

set -e  # Exit on any error

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SOURCE_DIR=$(pwd)
INSTALL_CONF="$SOURCE_DIR/install.conf"

INSTALL_CHANNEL="latest"
if [ -f "$INSTALL_CONF" ]; then
    echo "Loading installation configuration from $INSTALL_CONF"
    set -a
    source "$INSTALL_CONF"
    set +a
fi

case "${1:-}" in
    "") ;;
    beta)
        INSTALL_CHANNEL="beta"
        ;;
    -h|--help)
        echo "Usage: $0 [beta]"
        echo "  beta  Install the beta tags of the dashboard and API."
        exit 0
        ;;
    *)
        echo -e "${RED}Error: Unknown installation channel '$1'.${NC}" >&2
        echo "Usage: $0 [beta]" >&2
        exit 2
        ;;
esac

if [ "$#" -gt 1 ]; then
    echo -e "${RED}Error: Too many arguments.${NC}" >&2
    echo "Usage: $0 [beta]" >&2
    exit 2
fi

prompt_if_unset() {
    local var_name="$1"
    local prompt_text="$2"
    local default_value="$3"
    local value

    if [ -n "${!var_name:-}" ]; then
        return 0
    fi

    if [ ! -t 0 ]; then
        echo -e "${RED}Error: $var_name is not set and no interactive terminal is available.${NC}" >&2
        echo "Set $var_name in the environment or run this script interactively." >&2
        exit 1
    fi

    read -r -p "$prompt_text [$default_value]: " value || {
        echo -e "${RED}Error: Unable to read $var_name.${NC}" >&2
        exit 1
    }

    printf -v "$var_name" '%s' "${value:-$default_value}"
}

_is_truthy() {
    case "${1,,}" in
        1|true|yes|y|on) return 0 ;;
        *) return 1 ;;
    esac
}

validate_boolean() {
    local var_name="$1"
    local value="${!var_name}"

    case "${value,,}" in
        1|true|yes|y|on|0|false|no|n|off) ;;
        *)
            echo -e "${RED}Error: $var_name must be yes/no, true/false, on/off, or 1/0.${NC}"
            exit 1
            ;;
    esac
}

require_env() {
    local var_name="$1"

    if [ -z "${!var_name:-}" ]; then
        echo -e "${RED}Error: $var_name must be set in the environment.${NC}" >&2
        exit 1
    fi
}

download_github() {
    local url="$1"
    local output="$2"
    local curl_headers=(
        --header "Accept: application/vnd.github+json"
        --header "X-GitHub-Api-Version: 2022-11-28"
    )
    local wget_headers=(
        --header="Accept: application/vnd.github+json"
        --header="X-GitHub-Api-Version: 2022-11-28"
    )

    if command -v curl &> /dev/null; then
        echo "curl: $url"
        curl \
            --fail \
            --location \
            --silent \
            --show-error \
            --retry 3 \
            --retry-delay 2 \
            "${curl_headers[@]}" \
            "$url" \
            --output "$output"
    elif command -v wget &> /dev/null; then
        wget \
            --quiet \
            "${wget_headers[@]}" \
            --output-document="$output" \
            "$url"
    else
        echo -e "${RED}Error: Neither curl nor wget is available.${NC}"
        return 1
    fi
}

download_github_archive() {
    local repository="$1"
    local ref="$2"
    local output="$3"

    download_github \
        "${GITHUB_WEB_URL%/}/${GITHUB_OWNER}/${repository}/tarball/${ref}" \
        "$output"
}

install_firmware_release() {
    local tag="$1"
    local destination="$2"
    local staging asset_name asset_url
    staging=$(mktemp -d)

    echo "Downloading firmware release $tag from ${GITHUB_OWNER}/${GITHUB_FIRMWARE_REPO}..."
    for asset_name in bootloader.bin firmware.bin partitions.bin; do
        asset_url="${GITHUB_WEB_URL%/}/${GITHUB_OWNER}/${GITHUB_FIRMWARE_REPO}/releases/download/${tag}/${asset_name}"

        if ! download_github "$asset_url" "$staging/$asset_name"; then
            rm -rf -- "$staging"
            echo -e "${RED}Error: Failed to download $asset_name from release $tag.${NC}" >&2
            return 1
        fi
    done

    rm -rf -- "$destination"
    mv "$staging" "$destination"
    echo "✓ Firmware release $tag installed to $destination"
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
        echo -e "${RED}Error: Failed to download $component_name from GitHub.${NC}" >&2
        return 1
    fi

    if ! tar -xzf "$archive_path" -C "$destination" --strip-components=1; then
        rm -f -- "$archive_path"
        echo -e "${RED}Error: Failed to extract $component_name archive.${NC}" >&2
        return 1
    fi

    rm -f -- "$archive_path"
    echo "✓ $component_name installed to $destination"
}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Boondock Edge Installation Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root (use sudo)${NC}"
    exit 1
fi

echo -e "${GREEN}Installation configuration${NC}"
prompt_if_unset INSTALL_ROOT "Installation root directory" "/opt/boondock/edge"
if [ -e "$INSTALL_ROOT" ]; then
    prompt_if_unset INSTALL_MODE "Do you want to update or do an install?" "update"
    case "${INSTALL_MODE,,}" in
        update)
            INSTALL_MODE="update"
            ;;
        install)
            INSTALL_MODE="install"
            ;;
        *)
            echo -e "${RED}Error: INSTALL_MODE must be update or install.${NC}" >&2
            exit 1
            ;;
    esac
else
    INSTALL_MODE="install"
fi
prompt_if_unset INSTALL_USER "Linux user that should own and run Boondock Edge" "boondock"
prompt_if_unset INSTALL_DASHBOARD "Install Boondock Edge Dashboard? (yes/no)" "yes"
prompt_if_unset INSTALL_API "Install Boondock Edge API? (yes/no)" "yes"
#prompt_if_unset INSTALL_UDP "Install Boondock Edge UDP? (yes/no)" "no"
prompt_if_unset UPDATE_HOSTNAME "Update the system hostname to boondock-edge? (yes/no)" "no"
prompt_if_unset ENABLE_SERVICES "Enable installed systemd services at boot? (yes/no)" "yes"

if _is_truthy "$INSTALL_API" && [ "$INSTALL_MODE" = "install" ]; then
    if [ -z "${ADMIN_EMAIL:-}" ]; then
        if [ ! -t 0 ]; then
            echo -e "${RED}Error: ADMIN_EMAIL is not set and no interactive terminal is available.${NC}" >&2
            exit 1
        fi
        read -r -p "Admin Email: " ADMIN_EMAIL
    fi

    if [[ ! "$ADMIN_EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
        echo -e "${RED}Error: ADMIN_EMAIL is not a valid email address.${NC}"
        exit 1
    fi

    if [ -z "${ADMIN_PASSWORD:-}" ]; then
        if [ ! -t 0 ]; then
            echo -e "${RED}Error: ADMIN_PASSWORD is not set and no interactive terminal is available.${NC}" >&2
            exit 1
        fi
        read -r -p "Admin Password: " ADMIN_PASSWORD
        echo ""
    fi

    if [ "${#ADMIN_PASSWORD}" -le 8 ]; then
        echo -e "${RED}Error: ADMIN_PASSWORD must be more than 8 characters.${NC}"
        exit 1
    fi

    case "$ADMIN_PASSWORD" in
        *'['*|*']'*|*'('*|*')'*|*'\'*|*'/'*|*'<'*|*'>'*|*"'"*|*'"'*|*'`'*)
            echo -e "${RED}Error: ADMIN_PASSWORD contains a forbidden character.${NC}"
            exit 1
            ;;
    esac

    if [[ "$ADMIN_PASSWORD" =~ [[:cntrl:]] ]]; then
        echo -e "${RED}Error: ADMIN_PASSWORD cannot contain tabs or other control characters.${NC}"
        exit 1
    fi

    prompt_if_unset CONFIGURE_RECORDERS "Configure Boondock Edge recorders? (yes/no)" "yes"
    prompt_if_unset INBOX_VIEW "Inbox view (continuous/paged)" "continuous"
    prompt_if_unset MESSAGE_SORTING "Message sorting (newest/oldest)" "newest"

    WIFI_SSID=""
    WIFI_CONFIG_PASSWORD="${WIFI_PASSWORD:-}"
    WIFI_PASSWORD=""
    WIFI_SETUP=None
    if command -v nmcli &> /dev/null; then
        WIFI_DEVICE=$(LC_ALL=C nmcli -t -f DEVICE,TYPE,STATE device status | \
            awk -F: '$2 == "wifi" && $3 == "connected" { print $1; exit }')
        if [ -n "$WIFI_DEVICE" ]; then
            WIFI_CONNECTION=$(LC_ALL=C nmcli --escape no -g GENERAL.CONNECTION \
                device show "$WIFI_DEVICE")
            WIFI_SSID=$(LC_ALL=C nmcli --escape no -g 802-11-wireless.ssid \
                connection show "$WIFI_CONNECTION")
            WIFI_PASSWORD=$(LC_ALL=C nmcli --escape no --show-secrets \
                -g 802-11-wireless-security.psk \
                connection show "$WIFI_CONNECTION")
            WIFI_IP_ADDRESS=$(LC_ALL=C nmcli --escape no -g IP4.ADDRESS \
                device show "$WIFI_DEVICE" | head -n 1)
            WIFI_IP_ADDRESS="${WIFI_IP_ADDRESS%%/*}"

            # A 64-character hex PSK is the derived WPA key, not the original passphrase.
            # Ask for the passphrase (or use WIFI_PASSWORD from install.conf/environment)
            # and verify it by deriving the WPA PSK from the SSID.
            if [ "${#WIFI_PASSWORD}" -eq 64 ] && [[ "$WIFI_PASSWORD" =~ ^[0-9A-Fa-f]{64}$ ]]; then
                WIFI_STORED_PSK="${WIFI_PASSWORD,,}"

                if [ -n "$WIFI_CONFIG_PASSWORD" ]; then
                    WIFI_PASSWORD="$WIFI_CONFIG_PASSWORD"
                elif [ -t 0 ]; then
                    read -r -p "WiFi Password for $WIFI_SSID: " WIFI_PASSWORD
                    echo ""
                else
                    echo -e "${RED}Error: WiFi password is stored as a derived PSK. Set WIFI_PASSWORD for a non-interactive install.${NC}" >&2
                    exit 1
                fi

                if [ -z "$WIFI_PASSWORD" ]; then
                    echo -e "${RED}Error: WiFi password cannot be empty.${NC}" >&2
                    exit 1
                fi

                if [ "${#WIFI_PASSWORD}" -eq 64 ] && [[ "$WIFI_PASSWORD" =~ ^[0-9A-Fa-f]{64}$ ]]; then
                    WIFI_DERIVED_PSK="${WIFI_PASSWORD,,}"
                else
                    WIFI_DERIVED_PSK=$(WIFI_VERIFY_SSID="$WIFI_SSID" WIFI_VERIFY_PASSWORD="$WIFI_PASSWORD" \
                        python3 -c 'import hashlib, os; print(hashlib.pbkdf2_hmac("sha1", os.environ["WIFI_VERIFY_PASSWORD"].encode(), os.environ["WIFI_VERIFY_SSID"].encode(), 4096, 32).hex())')
                fi

                if [ "$WIFI_DERIVED_PSK" != "$WIFI_STORED_PSK" ]; then
                    echo -e "${RED}Error: WiFi password does not match the stored WPA key.${NC}" >&2
                    exit 1
                fi

                echo "✓ WiFi password verified"
                unset WIFI_STORED_PSK WIFI_DERIVED_PSK WIFI_CONFIG_PASSWORD
            fi
        fi
        WIFI_SETUP=$(printf '{"ssid":"%s","password":"%s","ip_address":"%s"}' \
            "$WIFI_SSID" \
            "$WIFI_PASSWORD" \
            "$WIFI_IP_ADDRESS")

    fi


fi
echo ""

validate_boolean INSTALL_DASHBOARD
validate_boolean INSTALL_API
#validate_boolean INSTALL_UDP
validate_boolean UPDATE_HOSTNAME
validate_boolean ENABLE_SERVICES
if _is_truthy "$INSTALL_API" && [ "$INSTALL_MODE" = "install" ]; then
    validate_boolean CONFIGURE_RECORDERS
    case "$INBOX_VIEW" in
        continuous|paged) ;;
        *) echo -e "${RED}Error: INBOX_VIEW must be continuous or paged.${NC}"; exit 1 ;;
    esac
    case "$MESSAGE_SORTING" in
        newest|oldest) ;;
        *) echo -e "${RED}Error: MESSAGE_SORTING must be newest or oldest.${NC}"; exit 1 ;;
    esac
fi

if _is_truthy "$UPDATE_HOSTNAME"; then
    echo -e "${GREEN}Updating system hostname...${NC}"
    hostnamectl set-hostname "boondock-edge"
    echo "✓ System hostname updated to boondock-edge"
fi

if ! _is_truthy "$INSTALL_DASHBOARD" && ! _is_truthy "$INSTALL_API" && ! _is_truthy "$INSTALL_UDP"; then
    echo -e "${YELLOW}No Boondock Edge components selected. Nothing to install.${NC}"
    exit 0
fi

if _is_truthy "$INSTALL_API" || _is_truthy "$INSTALL_UDP"; then
    # Debian/Ubuntu package Python's venv/ensurepip support separately.
    # Install python3-venv explicitly so `python3 -m venv` can create a usable environment.
    if ! command -v python3 &> /dev/null; then
        echo -e "${YELLOW}Python 3 not found. Installing Python 3 and venv support...${NC}"
        apt-get update
        apt-get install -y python3 python3-venv
    fi

    if ! command -v ffmpeg &> /dev/null; then
        echo -e "${YELLOW}ffmpeg not found. Installing ffmpeg...${NC}"
        apt-get update
        apt-get install -y ffmpeg
        echo "✓ ffmpeg installed"
    else
        echo "✓ ffmpeg is already installed"
    fi
fi

if ! command -v tar &> /dev/null; then
    echo -e "${YELLOW}tar not found. Installing tar...${NC}"
    apt-get update
    apt-get install -y tar
fi

if ! command -v curl &> /dev/null && ! command -v wget &> /dev/null; then
    echo -e "${YELLOW}Neither curl nor wget found. Installing curl...${NC}"
    apt-get update
    apt-get install -y curl
fi

echo -e "${GREEN}Stopping Boondock Edge services before installing files...${NC}"
if systemctl list-unit-files "boondock-edge-api.service" --no-legend 2>/dev/null | grep -q '^boondock-edge-api.service'; then
    systemctl stop "boondock-edge-api.service"
    echo "✓ API service stopped"
else
    echo "✓ API service is not installed"
fi

echo -e "${GREEN}[1/8] Creating installation directory...${NC}"
if [ "$INSTALL_MODE" = "install" ] && [ -e "$INSTALL_ROOT" ]; then
    echo "Removing existing installation directory: $INSTALL_ROOT"
    rm -rf -- "$INSTALL_ROOT"
fi
mkdir -p "$INSTALL_ROOT"
echo "✓ Directory created: $INSTALL_ROOT"

if ! id "$INSTALL_USER" &>/dev/null; then
    echo -e "${YELLOW}User '$INSTALL_USER' not found. Creating user...${NC}"
    useradd -r -s /bin/bash -d "$INSTALL_ROOT" "$INSTALL_USER" || {
        echo -e "${YELLOW}Note: User '$INSTALL_USER' may already exist or creation failed. Continuing...${NC}"
    }
    # Add install user to dialout group for serial device access
    if getent group dialout &>/dev/null; then
        usermod -aG dialout "$INSTALL_USER"
        echo "✓ Added $INSTALL_USER to dialout group"
    else
        echo -e "${YELLOW}Warning: dialout group does not exist on this system.${NC}"
    fi
fi

GITHUB_WEB_URL="${GITHUB_WEB_URL:-https://github.com}"
GITHUB_OWNER="${GITHUB_OWNER:-Boondock-Echo}"
GITHUB_REF="${GITHUB_REF:-latest}"
GITHUB_DASHBOARD_REPO="${GITHUB_DASHBOARD_REPO:-Boondock-Edge-Dashboard}"
GITHUB_API_REPO="${GITHUB_API_REPO:-Boondock-Edge-API}"
GITHUB_UDP_REPO="${GITHUB_UDP_REPO:-Boondock-Edge-Streaming}"
GITHUB_FIRMWARE_REPO="${GITHUB_FIRMWARE_REPO:-Echo-Tango}"
DASHBOARD_REF="${DASHBOARD_REF:-$GITHUB_REF}"
API_REF="${API_REF:-$GITHUB_REF}"
UDP_REF="${UDP_REF:-$GITHUB_REF}"

# The beta channel applies only to the dashboard and API. Firmware and any
# future optional components continue to use their independently configured refs.
if [ "$INSTALL_CHANNEL" = "beta" ]; then
    DASHBOARD_REF="beta"
    API_REF="beta"
    echo -e "${YELLOW}Beta channel selected: dashboard and API will use the beta tags.${NC}"
fi

DASHBOARD_DIR="$INSTALL_ROOT/dashboard"
API_DIR="$INSTALL_ROOT/api"
UDP_DIR="$INSTALL_ROOT/streaming"

echo -e "${GREEN}[2/8] Dashboard...${NC}"
if _is_truthy "$INSTALL_DASHBOARD"; then
    install_component_archive "$GITHUB_DASHBOARD_REPO" "$DASHBOARD_REF" "$DASHBOARD_DIR" "Dashboard"
else
    echo -e "${YELLOW}Skipping Boondock Edge Dashboard.${NC}"
fi

echo -e "${GREEN}[3/8] API...${NC}"
if _is_truthy "$INSTALL_API"; then
    install_component_archive "$GITHUB_API_REPO" "$API_REF" "$API_DIR" "API"
else
    echo -e "${YELLOW}Skipping Boondock Edge API.${NC}"
fi

#echo -e "${GREEN}[4/8] UDP...${NC}"
#if _is_truthy "$INSTALL_UDP"; then
#    install_component_archive "$GITHUB_UDP_REPO" "$UDP_REF" "$UDP_DIR" "UDP"
#else
#    echo -e "${YELLOW}Skipping Boondock Edge UDP.${NC}"
#fi

echo -e "${GREEN}[5/8] Creating application directories...${NC}"
mkdir -p "$INSTALL_ROOT/db"
mkdir -p "$INSTALL_ROOT/db/reports"
mkdir -p "$INSTALL_ROOT/db/recorder_configs"
mkdir -p "$INSTALL_ROOT/device_settings"
mkdir -p "$INSTALL_ROOT/logs"
mkdir -p "$INSTALL_ROOT/recordings"
mkdir -p "$INSTALL_ROOT/uploads"
mkdir -p "$INSTALL_ROOT/firmware"
echo "✓ Directories created"

echo -e "${GREEN}[6/8] Installing Echo and Tango firmware...${NC}"
install_firmware_release "latest-echo" "$INSTALL_ROOT/firmware/latest_echo"
ECHO_FIRMWARE_CREATED_AT=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
install_firmware_release "latest-tango" "$INSTALL_ROOT/firmware/latest_tango"
TANGO_FIRMWARE_CREATED_AT=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
cat > "$INSTALL_ROOT/firmware/firmware.json" <<EOF
{
  "latest_echo": {
    "name": "Latest Echo",
    "description": "",
    "folder": "latest_echo",
    "created_at": "$ECHO_FIRMWARE_CREATED_AT"
  },
  "latest_tango": {
    "name": "Latest Tango",
    "description": "",
    "folder": "latest_tango",
    "created_at": "$TANGO_FIRMWARE_CREATED_AT"
  }
}
EOF
echo "✓ Firmware catalog written to $INSTALL_ROOT/firmware/firmware.json"

echo -e "${GREEN}[7/8] Python virtual environment...${NC}"
if _is_truthy "$INSTALL_API" || _is_truthy "$INSTALL_UDP"; then
    cd "$INSTALL_ROOT"

    if [ "$INSTALL_MODE" = "install" ] && [ -d "venv" ]; then
        echo -e "${YELLOW}Warning: Virtual environment already exists. Removing old one...${NC}"
        rm -rf "venv"
    fi

    if [ ! -x "venv/bin/python" ] && ! python3 -m venv "venv" &> /dev/null; then
        echo -e "${YELLOW}Python venv support is incomplete. Installing python3-venv...${NC}"

        apt-get update
        apt-get install -y python3-venv
    fi

    if [ ! -x "venv/bin/python" ] && ! python3 -m venv "venv"; then
        rm -rf "$VENV_TEST_DIR"
        echo -e "${RED}Error: Unable to create a Python virtual environment.${NC}"
        exit 1
    fi

    if [ "$INSTALL_MODE" = "update" ]; then
        echo "✓ Existing shared virtual environment retained: venv"
    else
        echo "✓ Shared virtual environment created: venv"
    fi

    echo -e "${GREEN}[8/8] Installing Python dependencies...${NC}"
    source "$INSTALL_ROOT/venv/bin/activate"
    pip install --upgrade pip --quiet

    if [ -f "$API_DIR/requirements.txt" ]; then
        if [ "$INSTALL_MODE" = "update" ]; then
            pip install --upgrade -r "$API_DIR/requirements.txt"
        else
            pip install -r "$API_DIR/requirements.txt"
        fi
        echo "✓ Dependencies installed from $API_DIR/requirements.txt"
    elif [ -f "$UDP_DIR/requirements.txt" ]; then
        echo -e "${YELLOW}API requirements.txt not available. Using UDP requirements instead.${NC}"
        if [ "$INSTALL_MODE" = "update" ]; then
            pip install --upgrade -r "$UDP_DIR/requirements.txt"
        else
            pip install -r "$UDP_DIR/requirements.txt"
        fi
        echo "✓ Dependencies installed from $UDP_DIR/requirements.txt"
    else
        deactivate
        echo -e "${RED}Error: No requirements.txt found for the selected API/UDP components.${NC}"
        exit 1
    fi

    deactivate
    echo "✓ Shared virtual environment setup complete"
else
    echo -e "${YELLOW}API and UDP are both disabled. No Python virtual environment is required.${NC}"
    echo -e "${GREEN}[8/8] Python dependencies... skipped${NC}"
fi

SERVICE_FILE="/etc/systemd/system/boondock-edge-api.service"
if _is_truthy "$INSTALL_API"; then
    echo -e "${GREEN}Creating systemd service for API...${NC}"

    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Boondock Edge Application Server
After=network.target

[Service]
Type=simple
User=$INSTALL_USER
SupplementaryGroups=dialout
WorkingDirectory=$INSTALL_ROOT/api
Environment="PATH=$INSTALL_ROOT/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
Environment="FLASK_PORT=4000"
ExecStart=$INSTALL_ROOT/venv/bin/python $INSTALL_ROOT/api/run.py
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    echo "✓ Service file created: $SERVICE_FILE"
fi

#UDP_SERVICE_FILE="/etc/systemd/system/boondock-edge-udp.service"
#if _is_truthy "$INSTALL_UDP"; then
#    echo -e "${GREEN}Creating systemd service for UDP...${NC}"
#    cat > "$UDP_SERVICE_FILE" << EOF
# [Unit]
# Description=Boondock Edge UDP Service
# After=network.target

# [Service]
# Type=simple
# User=$INSTALL_USER
# SupplementaryGroups=dialout
# WorkingDirectory=$INSTALL_ROOT/udp
# Environment="PATH=$INSTALL_ROOT/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
# ExecStart=$INSTALL_ROOT/venv/bin/python $INSTALL_ROOT/udp/run.py
# Restart=always
# RestartSec=10
# StandardOutput=journal
# StandardError=journal

# [Install]
# WantedBy=multi-user.target
# EOF

#     echo "✓ UDP service file created: $UDP_SERVICE_FILE"
# fi

echo -e "${GREEN}Setting final ownership and permissions for $INSTALL_USER:$INSTALL_USER...${NC}"
chown -R "$INSTALL_USER:$INSTALL_USER" "$INSTALL_ROOT"
chmod -R 755 "$INSTALL_ROOT"
# if _is_truthy "$INSTALL_API" && [ -f "$SETUP_FILE" ]; then
#     chmod 600 "$SETUP_FILE"
# fi
echo "✓ Ownership set to $INSTALL_USER:$INSTALL_USER with 755 permissions"

if _is_truthy "$INSTALL_API"; then
    if [ "$INSTALL_MODE" = "update" ]; then
        echo -e "${GREEN}Updating application data...${NC}"
        runuser -u "$INSTALL_USER" -- \
            "$INSTALL_ROOT/venv/bin/python" \
            "$API_DIR/manage.py" update
        echo "✓ Application data updated"
    else
        SETUP_FILE="$INSTALL_ROOT/db/setup.json"
        echo -e "${GREEN}Writing setup configuration...${NC}"
        SELECTED_DEVICES="[]"
        if _is_truthy "$CONFIGURE_RECORDERS"; then
            SELECTED_DEVICES='["boondock_edge"]'
        fi
        cat > "$SETUP_FILE" <<EOF
{
  "admin": {
    "email": "$ADMIN_EMAIL",
    "password": "$ADMIN_PASSWORD"
  },
  "selected_devices": $SELECTED_DEVICES,
  "wifi": $WIFI_SETUP,
  "preferences": {
    "inbox_view": "$INBOX_VIEW",
    "message_sorting": "$MESSAGE_SORTING"
  }
}
EOF

        chown "$INSTALL_USER:$INSTALL_USER" "$SETUP_FILE"
        chmod 600 "$SETUP_FILE"
        trap 'rm -f -- "$SETUP_FILE"' EXIT
        echo "✓ Setup configuration written to $SETUP_FILE"

        echo -e "${GREEN}Initializing application data...${NC}"
        runuser -u "$INSTALL_USER" -- \
            "$INSTALL_ROOT/venv/bin/python" \
            "$API_DIR/manage.py" setup --config "$SETUP_FILE"
        rm -f -- "$SETUP_FILE"
        trap - EXIT
        # Credentials are no longer needed in this installer process.
        unset ADMIN_PASSWORD

        echo "✓ Application data initialized"
    fi
fi

if _is_truthy "$INSTALL_API" || _is_truthy "$INSTALL_UDP"; then
    echo -e "${GREEN}Reloading systemd...${NC}"
    systemctl daemon-reload
fi

if _is_truthy "$ENABLE_SERVICES"; then
    if _is_truthy "$INSTALL_API"; then
        systemctl enable "boondock-edge-api.service"
    fi

    # if _is_truthy "$INSTALL_UDP"; then
    #     systemctl enable "boondock-edge-udp.service"
    # fi
else
    echo -e "${YELLOW}Installed services will not be enabled at boot.${NC}"
fi

if _is_truthy "$INSTALL_API"; then
    systemctl start "boondock-edge-api.service"
fi

# if _is_truthy "$INSTALL_UDP"; then
#     systemctl start "boondock-edge-udp.service"
# fi

if _is_truthy "$INSTALL_API" || _is_truthy "$INSTALL_UDP"; then
    sleep 3
fi

if _is_truthy "$INSTALL_API"; then
    if systemctl is-active --quiet "boondock-edge-api.service"; then
        echo -e "${GREEN}✓ API service is running successfully${NC}"
    else
        echo -e "${RED}✗ API service failed to start${NC}"
        echo "Checking service status..."
        systemctl status "boondock-edge-api.service" --no-pager -l
        exit 1
    fi
fi

# if _is_truthy "$INSTALL_UDP"; then
#     if systemctl is-active --quiet "boondock-edge-udp.service"; then
#         echo -e "${GREEN}✓ UDP service is running successfully${NC}"
#     else
#         echo -e "${RED}✗ UDP service failed to start${NC}"
#         echo "Checking UDP service status..."
#         systemctl status "boondock-edge-udp.service" --no-pager -l
#     fi
# fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Installation directory: $INSTALL_ROOT"

if _is_truthy "$INSTALL_DASHBOARD"; then
    echo "Dashboard: installed in $DASHBOARD_DIR"
else
    echo "Dashboard: not installed"
fi

if _is_truthy "$INSTALL_API"; then
    echo "API: installed in $API_DIR"
    SYSTEM_HOSTNAME=$(hostname)
    SYSTEM_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    SYSTEM_IP="${SYSTEM_IP:-unavailable}"
    echo "Hostname: $SYSTEM_HOSTNAME"
    echo "IP address: $SYSTEM_IP"
    echo "HTTP port: 4000"
    echo "URL: http://$SYSTEM_IP:4000 or http://$SYSTEM_HOSTNAME.local:4000"
    echo "API service: boondock-edge-api.service"
else
    echo "API: not installed"
fi

# if _is_truthy "$INSTALL_UDP"; then
#     echo "UDP: installed in $UDP_DIR"
#     echo "UDP service: boondock-edge-udp.service"
# else
#     echo "UDP: not installed"
# fi

echo ""

if _is_truthy "$INSTALL_API" || _is_truthy "$INSTALL_UDP"; then
    echo "Useful commands:"

    if _is_truthy "$INSTALL_API"; then
        echo "  sudo systemctl status boondock-edge-api.service"
        echo "  sudo systemctl restart boondock-edge-api.service"
        echo "  sudo journalctl -u boondock-edge-api.service -f"
    fi

    # if _is_truthy "$INSTALL_UDP"; then
    #     echo "  sudo systemctl status boondock-edge-udp.service"
    #     echo "  sudo systemctl restart boondock-edge-udp.service"
    #     echo "  sudo journalctl -u boondock-edge-udp.service -f"
    # fi
fi

echo ""
