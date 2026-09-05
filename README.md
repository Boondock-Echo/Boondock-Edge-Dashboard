# Boondock Edge Dashboard

The Boondock Edge Dashboard is the local web interface for a Boondock Edge
installation. It is installed alongside the Edge API, stores application data, 
and communicates with supported Echo and Tango recorder hardware.

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
| [Echo-Tango](https://github.com/Boondock-Echo/Echo-Tango) | Firmware for Echo and Tango recorder devices. |

## Requirements

Use a dedicated Debian- or Ubuntu-based Linux computer that has:

- `systemd`, `journalctl`, and `apt`
- an internet connection and access to `github.com`;
- `sudo` or root access;
- enough storage for recordings, uploads, logs, firmware, and the application
  database; and
- recorders with network access. (optional)USB connection to the local recorders.

The installer adds its service account to the `dialout` group for serial-device
access. NetworkManager's `nmcli` is optional; when it is available, the installer
can copy the active Wi-Fi connection into initial device configuration.

## Installation

Create a working directory(to make there isn't already an install.sh in the directory) and run the following commands:

```bash
wget https://raw.githubusercontent.com/Boondock-Echo/Boondock-Edge-Dashboard/main/install.sh
chmod +x install.sh && sudo ./install.sh
```

You can use an optional install.conf for non-interactive installation. See [install.conf.sample](https://github.com/ajprog/Boondock-Edge-Dashboard/blob/main/install.conf.sample)

### Viewing the dashboard

On another computer on the same network, browse to either address printed by the
installer:

- `http://<edge-ip-address>:4000`
- `http://<edge-hostname>.local:4000`


## Operating and updating Edge

### Viewing the dashboard

On the local machine:

- `http://127.0.0.1:4000

On another computer on the same network, browse to either address printed by the
installer:

- `http://<edge-ip-address>:4000`
- `http://<edge-hostname>.local:4000`
- 
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
| `/opt/boondock/edge/recordings` | Locally retained recordings. |
| `/opt/boondock/edge/logs` | Application log files. |

If you select a different `INSTALL_ROOT`, substitute it in the paths above.

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

Also check the kernel and service
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

### HTTP client policy

The dashboard uses the browser-native Fetch API for HTTP requests. Its
advantages are no client dependency, standard `Request`/`Response` objects,
native streaming, and cancellation through `AbortController`. Authentication,
base URLs, timeouts, JSON decoding, and non-success response handling can all be
implemented in the shared Fetch client; none of those capabilities requires an
additional HTTP library.

Use `api` from `src/utils/apiClient.js` for JSON API calls. It provides the
project's normalized `data` and HTTP-error contract. Use `apiFetch` from the same
module only when code needs the native browser `Response`, such as media, blob,
or streaming reads. Both entry points share the API prefix, bearer token,
timeout, and unauthorized-session handling. Do not call `window.fetch` directly.

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
