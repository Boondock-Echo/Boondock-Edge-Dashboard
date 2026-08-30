# Boondock Edge Dashboard

The Boondock Edge Dashboard is the local web interface for a Boondock Edge
installation. It is installed alongside the Edge API, which serves the dashboard,
stores application data, and communicates with supported Echo and Tango recorder
hardware.

> [!IMPORTANT]
> Boondock Edge is not a life-safety system and must not be used as the primary
> means of emergency notification, dispatch, or radio monitoring. Review the
> [license](LICENSE.md), [commercial license](COMMERCIAL-LICENSE.md), and
> [compatibility notes](COMPATIBILITY.md) before deployment.

## Related projects

| Repository | Purpose |
| --- | --- |
| [Boondock-Edge-Dashboard](https://github.com/Boondock-Echo/Boondock-Edge-Dashboard) | This local browser-based dashboard and the system installer. |
| [Boondock-Edge-API](https://github.com/Boondock-Echo/Boondock-Edge-API) | The local application server, database management, device communication, and dashboard hosting. |
| [Echo-Tango](https://github.com/Boondock-Echo/Echo-Tango) | Firmware and hardware documentation for Echo and Tango recorder devices. |

## What the installer does

The provided installer can set up a complete Edge host without requiring a
separate dashboard build. By default, it:

- downloads the `latest` Dashboard and API release tags from GitHub;
- downloads the `latest-echo` and `latest-tango` firmware release assets;
- creates the installation user and `/opt/boondock/edge` directory tree;
- installs required system packages when they are missing;
- creates a Python virtual environment and installs the API dependencies;
- initializes the administrator account and application database; and
- creates, enables, and starts `boondock-edge-api.service` on port `4000`.

The installer replaces the component directories it manages. Back up application
data and any local modifications before using it to update an existing host.

## Requirements

Use a dedicated Debian- or Ubuntu-based Linux computer that has:

- `systemd`, `apt-get`, and Python 3;
- an internet connection and access to `github.com`;
- `sudo` or root access;
- enough storage for recordings, uploads, logs, firmware, and the application
  database; and
- a serial connection to each local recorder, if recorders will be managed by
  this host.

The installer adds its service account to the `dialout` group for serial-device
access. NetworkManager's `nmcli` is optional; when it is available, the installer
can copy the active Wi-Fi connection into initial device configuration.

## Quick start

### 1. Download the installer

Create a working directory and download both installer files from this repository:

```bash
mkdir -p ~/boondock-edge-install
cd ~/boondock-edge-install

curl -fLO https://raw.githubusercontent.com/Boondock-Echo/Boondock-Edge-Dashboard/main/install.sh
curl -fLo install.conf https://raw.githubusercontent.com/Boondock-Echo/Boondock-Edge-Dashboard/main/install.conf.sample
chmod +x install.sh
```

If `curl` is unavailable, use `wget`:

```bash
wget https://raw.githubusercontent.com/Boondock-Echo/Boondock-Edge-Dashboard/main/install.sh
wget -O install.conf https://raw.githubusercontent.com/Boondock-Echo/Boondock-Edge-Dashboard/main/install.conf.sample
chmod +x install.sh
```

### 2. Configure the installation

Open `install.conf` and, at minimum, replace the example administrator email and
password:

```bash
nano install.conf
```

The sample contains these settings:

| Setting | Default | Description |
| --- | --- | --- |
| `INSTALL_ROOT` | `/opt/boondock/edge` | Destination for the dashboard, API, environment, databases, recordings, and firmware. |
| `INSTALL_USER` | `boondock` | Linux service account created when it does not already exist. |
| `INSTALL_DASHBOARD` | `yes` | Install the dashboard release. |
| `INSTALL_API` | `yes` | Install and initialize the API. A complete installation should leave this enabled. |
| `UPDATE_HOSTNAME` | `no` | Change the host name to `boondock-edge`. |
| `ENABLE_SERVICES` | `yes` | Enable the API service at boot. |
| `ADMIN_EMAIL` | example value | Initial dashboard administrator login. |
| `ADMIN_PASSWORD` | example value | Initial administrator password; it must be longer than eight characters. |
| `CONFIGURE_RECORDERS` | `yes` | Include Boondock Edge recorders in initial setup. |
| `INBOX_VIEW` | `continuous` | Initial inbox layout: `continuous` or `paged`. |
| `MESSAGE_SORTING` | `newest` | Initial message order: `newest` or `oldest`. |

Use a unique password and protect this file because it contains plaintext
credentials. The password cannot contain brackets, parentheses, slashes, angle
brackets, quotes, backticks, tabs, or other control characters. Delete the local
configuration file after a successful install if you do not need to retain it.

The boolean settings accept `yes`/`no`, `true`/`false`, `on`/`off`, or `1`/`0`.
For unattended installation, every requested value must be present in
`install.conf` or the environment.

### 3. Run the installer

Install the stable release channel:

```bash
sudo ./install.sh
```

To evaluate prerelease dashboard and API builds, install the `beta` channel:

```bash
sudo ./install.sh beta
```

The beta option changes only the Dashboard and API refs. Echo and Tango firmware
still comes from the independently managed `latest-echo` and `latest-tango`
releases. Run `./install.sh --help` to display the accepted arguments.

### 4. Verify the service

```bash
sudo systemctl status boondock-edge-api.service --no-pager
curl -I http://127.0.0.1:4000
```

The service should report `active (running)`, and the HTTP request should return a
response from the application server.

### 5. Open the dashboard

On another computer on the same network, browse to either address printed by the
installer:

- `http://<edge-ip-address>:4000`
- `http://<edge-hostname>.local:4000`

Sign in with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` configured above. If `.local`
name resolution is unavailable, use the numeric address. Find it again with:

```bash
hostname -I
```

After signing in, confirm the preferences, connect the recorder hardware, and use
the dashboard's device settings to verify that each expected serial device is
visible. See [Echo-Tango](https://github.com/Boondock-Echo/Echo-Tango) for recorder
hardware and firmware guidance.

## Operating and updating Edge

### Service management

```bash
# Check current state
sudo systemctl status boondock-edge-api.service --no-pager

# Restart after a configuration or hardware change
sudo systemctl restart boondock-edge-api.service

# Follow live application logs
sudo journalctl -u boondock-edge-api.service -f

# Show logs from the current boot
sudo journalctl -u boondock-edge-api.service -b --no-pager
```

### Important paths

With the default `INSTALL_ROOT`, the installer uses:

| Path | Contents |
| --- | --- |
| `/opt/boondock/edge/dashboard` | Dashboard release files. |
| `/opt/boondock/edge/api` | [Boondock Edge API](https://github.com/Boondock-Echo/Boondock-Edge-API) application files. |
| `/opt/boondock/edge/db` | Application databases and recorder configuration. |
| `/opt/boondock/edge/recordings` | Locally retained recordings. |
| `/opt/boondock/edge/uploads` | Uploaded application data. |
| `/opt/boondock/edge/logs` | Application log files. |
| `/opt/boondock/edge/firmware` | Downloaded Echo and Tango firmware and firmware catalog. |
| `/opt/boondock/edge/venv` | Shared Python environment for the API. |
| `/etc/systemd/system/boondock-edge-api.service` | Generated service definition. |

If you select a different `INSTALL_ROOT`, substitute it in the paths above.

### Back up before updating

Stop the service and back up the persistent data directories before reinstalling:

```bash
sudo systemctl stop boondock-edge-api.service
sudo tar -czf "boondock-edge-backup-$(date +%Y%m%d-%H%M%S).tgz" \
  -C /opt/boondock/edge db recordings uploads device_settings
sudo systemctl start boondock-edge-api.service
```

Store the archive somewhere other than the Edge host. Then download fresh copies
of `install.sh` and `install.conf.sample`, review configuration changes, and rerun
the installer. Do not assume an older configuration sample contains every option
required by a newer installer.

## Troubleshooting

### The installer must be run as root

Run it through `sudo`:

```bash
sudo ./install.sh
```

If your account cannot use `sudo`, ask the system administrator to perform the
installation. Do not change ownership of system directories as a workaround.

### A required value is missing in a non-interactive install

The installer prompts only when attached to a terminal. Populate `install.conf`
with all settings from the current sample, or export the missing value before
running it. Ensure `install.conf` is in the directory from which `install.sh` is
started.

### Downloads fail

Confirm DNS, HTTPS connectivity, system time, and GitHub access:

```bash
getent hosts github.com
curl -I https://github.com
timedatectl status
```

GitHub rate limits, a captive portal, firewall filtering, or an incorrect system
clock can interrupt archive and firmware downloads. Retry only after connectivity
is stable so the component set is not partially updated.

### The API service does not start

Inspect its status and recent logs:

```bash
sudo systemctl status boondock-edge-api.service --no-pager -l
sudo journalctl -u boondock-edge-api.service -n 200 --no-pager
```

Common causes include an incomplete download, failed Python dependency
installation, invalid initial configuration, permissions under `INSTALL_ROOT`, or
port `4000` already being used. Check the port with:

```bash
sudo ss -ltnp | grep ':4000'
```

After correcting the cause, reload and restart the service:

```bash
sudo systemctl daemon-reload
sudo systemctl restart boondock-edge-api.service
```

For API-specific failures, consult the
[Boondock-Edge-API repository](https://github.com/Boondock-Echo/Boondock-Edge-API).

### The dashboard does not open from another computer

First test locally on the Edge host:

```bash
curl -I http://127.0.0.1:4000
```

If that succeeds, use `hostname -I` to confirm the host address and verify that
the client and Edge host can reach each other. Allow TCP port `4000` through the
host firewall when one is enabled; for example, on a host managed by UFW:

```bash
sudo ufw allow 4000/tcp
sudo ufw status
```

Do not expose port `4000` directly to the public internet. Use a properly secured
private network, VPN, or authenticated reverse proxy for remote access.

### The `.local` address does not resolve

Multicast DNS support varies by operating system and network. Use
`http://<edge-ip-address>:4000` instead. If desired, verify that an mDNS service
such as Avahi is installed and running on the Edge host.

### A recorder is not detected

Confirm that the device is powered, uses a data-capable USB cable, and appears as
a serial device:

```bash
ls -l /dev/ttyUSB* /dev/ttyACM* 2>/dev/null
id boondock
```

The service user should belong to `dialout`. If it was added to the group after
the service started, restart the API service. Also check the kernel and service
logs:

```bash
sudo dmesg | tail -n 50
sudo journalctl -u boondock-edge-api.service -n 100 --no-pager
```

For device-side setup, supported firmware, and flashing guidance, consult
[Echo-Tango](https://github.com/Boondock-Echo/Echo-Tango).

### Wi-Fi details are not detected

Automatic Wi-Fi discovery requires NetworkManager and an active Wi-Fi connection.
Check it with `nmcli device status`. If the saved credential is only a derived WPA
key, provide the original passphrase as `WIFI_PASSWORD` in `install.conf` for an
unattended run. Treat that file as a secret and remove it after installation.

### Login credentials do not work

Make sure the email matches exactly and that you edited `install.conf`, not only
`install.conf.sample`. The initial account is created during API database setup.
Review the API service logs for initialization errors. For account recovery or
database-management procedures, use the documentation in
[Boondock-Edge-API](https://github.com/Boondock-Echo/Boondock-Edge-API) rather than
editing the database manually.

## Security and support

- Keep the Edge host and its system packages patched.
- Restrict dashboard access to trusted networks and users.
- Do not commit `install.conf`, backups, credentials, recordings, or customer data.
- Back up persistent application data and test restoration regularly.
- Review [COMPATIBILITY.md](COMPATIBILITY.md) when pairing firmware and API
  versions.
- Review [RELEASE_NOTES.md](RELEASE_NOTES.md) before updates.
- Follow the repository's [contribution policy](CONTRIBUTING.md) before proposing
  a change.

When requesting help, include the release channel, Linux distribution, relevant
service status, and a short redacted log excerpt. Never include passwords, Wi-Fi
credentials, recordings, access tokens, or other sensitive information.
