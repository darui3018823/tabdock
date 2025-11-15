# tabdock
Put your spare tablets to good use.<br>

[日本語](README_ja.md)

# Recommended Environment

This application has been tested and confirmed to work in the following environments:

## Verified Devices
- iPad (5th Generation / 9th Generation)
- Safari on iPadOS 16 or later

All features have been confirmed to work as expected in the environment above.

## Supported Devices (Not Tested on Actual Devices)
The following devices have not been tested directly, but are expected to be supported based on specifications:

- iPad (5rd Generation or later)
- iPad Air (3rd Generation or later)
- iPad Pro (11" 2nd Generation or later)
- iPad mini (1st Generation or later)

Devices with similar **CSS pixel density** are also likely to be compatible.

#### Notes
- The application generally works on any device that supports modern CSS.  
  However, on larger devices like the iPad Pro 12.9", the system may identify the device as a desktop, which can negatively affect UI display.
- When using on an iPad, it is recommended to set the display zoom to 90%.
- Official support is limited to **iPadOS 16 or later**.
- As this application utilizes a **CDN**, please ensure that both the server and the iPad are connected to the **same local network**.
- **Android devices may also work, but they have not been tested. Use at your own discretion.**

<br>

---

<br>
<br>

# Host Requirements
The host machine must meet the following requirements:

## Supported Operating Systems (One of the following)
- Windows 10 or later
- macOS M1~ (^1)
- `systemd` capable Linux distributions (^2)

## Minimum Specifications
- PowerShell 5.1 or 7.5 and above
- Golang 1.23.2 or later
- CPU: 1.00 GHz or higher
- RAM: At least 300 MB
- Storage: At least 300 MB of available space
- Internet: Stable connection with at least 10 Mbps bandwidth

⚠️ Devices that do not meet these requirements are **not guaranteed to function correctly.**
^1 Although it should work on Macs with M1 chips based on specifications, official support is not planned.
^2 On Linux systems, it is strongly recommended to use `systemd` instead of PowerShell.  
  A setup script is provided at `./ps/linux_server_setup.ps1` to configure `systemd`, but it may not work in all environments.

<br>

---

<br>
<br>

# Third-Party Licenses

This project uses third-party materials under the following licenses:

### Material Symbols
- **Copyright**: 2025 Google Inc.
- **License**: Apache License 2.0
- **Source**: https://fonts.google.com/icons
- **Usage**: UI icons and symbols throughout the interface
