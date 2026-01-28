#!/bin/bash

# ============================================================
# MSB Editor - Consolidated Setup Script
# Usage: ./setup.sh [options]
# Options:
#   -l, --logo <path>   Update the logo before starting
#   -h, --help          Show this help message
# ============================================================

set -e

# --- Helper Functions ---

show_help() {
    echo "Usage: ./setup.sh [options]"
    echo ""
    echo "Options:"
    echo "  -l, --logo <path>   Update the logo with the specified image file."
    echo "  -h, --help          Show this help message."
    echo ""
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        echo "❌ Error: Docker is not installed."
        echo "   Please install Docker Desktop: https://www.docker.com/products/docker-desktop/"
        exit 1
    fi

    if ! docker info > /dev/null 2>&1; then
        echo "❌ Error: Docker daemon is not running."
        echo "   Please start Docker Desktop and try again."
        exit 1
    fi
    echo "✅ Docker is ready."
}

check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $port is in use."
        return 1
    fi
    return 0
}

check_ports() {
    echo "🔍 Checking ports..."
    # Warning only, don't stop script because it might be our own containers
    check_port 80 || echo "   (Port 80 is busy - if it's our container, it will be recreated)"
    check_port 8080 || echo "   (Port 8080 is busy - if it's our container, it will be recreated)"
    check_port 3000 || echo "   (Port 3000 is busy - if it's our container, it will be recreated)"
    check_port 3001 || echo "   (Port 3001 is busy - if it's our container, it will be recreated)"
}

update_logo() {
    local source_file="$1"
    local target_dir="./s3-demo/docs"
    local target_file="$target_dir/logo.png"

    if [ -z "$source_file" ]; then
        echo "❌ Error: Logo file path not provided."
        exit 1
    fi

    if [ ! -f "$source_file" ]; then
        echo "❌ Error: File '$source_file' not found."
        exit 1
    fi

    # Create directory if it doesn't exist (it should, but just in case)
    mkdir -p "$target_dir"

    echo "🔄 Updating logo..."
    cp "$source_file" "$target_file"
    echo "✅ Logo updated successfully!"
}

# --- Main Script ---

LOGO_PATH=""

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -l|--logo) LOGO_PATH="$2"; shift ;;
        -h|--help) show_help; exit 0 ;;
        *) echo "Unknown parameter passed: $1"; show_help; exit 1 ;;
    esac
    shift
done

echo "🚀 Starting MSB Editor Setup..."
echo ""

# 1. Check Docker
check_docker

# 2. Check Ports
check_ports

# 3. Update Logo (if requested)
if [ -n "$LOGO_PATH" ]; then
    update_logo "$LOGO_PATH"
fi

# 4. Prepare Directories
mkdir -p ./s3-demo/docs
mkdir -p ./onlyoffice-license

# 5. Start Application
echo ""
echo "🏗️  Building and Starting Services..."
echo "   This may take a while for the first run (downloading images)..."
echo ""

docker-compose up -d --build

# 6. Final Status
echo ""
echo "============================================"
echo "✅ Setup Complete! Services are running:"
echo ""
echo "   👉 App:        http://localhost"
echo "   👉 OnlyOffice: http://localhost:8080"
echo "   👉 Files:      http://localhost:3000"
echo "   👉 API:        http://localhost:3001"
echo ""
if [ -n "$LOGO_PATH" ]; then
    echo "   ℹ️  Logo was updated. You may need to Force Refresh (Cmd+Shift+R) to see changes."
fi
echo "   To stop the app, run: docker-compose down"
echo "============================================"
