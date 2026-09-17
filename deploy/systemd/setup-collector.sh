#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SERVICE_FILE="$SCRIPT_DIR/meta-collector.service"
TIMER_FILE="$SCRIPT_DIR/meta-collector.timer"
SYSTEMD_DIR="/etc/systemd/system"

echo "==> Installing meta-collector systemd units"

if [ "$(id -u)" -ne 0 ]; then
  echo "Error: run with sudo to install systemd units"
  exit 1
fi

cp "$SERVICE_FILE" "$SYSTEMD_DIR/meta-collector.service"
cp "$TIMER_FILE" "$SYSTEMD_DIR/meta-collector.timer"

systemctl daemon-reload
systemctl enable meta-collector.timer
systemctl start meta-collector.timer

echo "==> Installed and started meta-collector.timer"
echo ""
echo "Useful commands:"
echo "  Check timer status:   systemctl list-timers meta-collector.timer"
echo "  View collector logs:  journalctl -u meta-collector.service -f"
echo "  Trigger manual run:   systemctl start meta-collector.service"
echo "  Stop scheduling:      systemctl stop meta-collector.timer"
echo "  Disable permanently:  systemctl disable meta-collector.timer"
