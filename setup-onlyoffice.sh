#!/bin/bash

# ============================================================
# Script tự động setup ONLYOFFICE Document Server
# Chạy: ./setup-onlyoffice.sh
# ============================================================

set -e

echo "============================================"
echo "🚀 Setup ONLYOFFICE Document Server"
echo "============================================"
echo ""

# 1. Kiểm tra Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker chưa được cài đặt. Vui lòng cài đặt Docker trước."
    echo "   https://docs.docker.com/get-docker/"
    exit 1
fi
echo "✓ Docker đã cài đặt"

# 2. Kiểm tra xem container đã chạy chưa (Developer Edition)
EXISTING_CONTAINER=$(docker ps -a --filter "ancestor=onlyoffice/documentserver-de" --format "{{.Names}}" | head -1)

if [ -n "$EXISTING_CONTAINER" ]; then
    echo "⚠️  Container '$EXISTING_CONTAINER' đã tồn tại"
    read -p "Bạn muốn xóa và tạo mới không? (y/n): " CONFIRM
    if [ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ]; then
        echo "Đang xóa container cũ..."
        docker rm -f $EXISTING_CONTAINER
        CONTAINER_NAME=""
    else
        echo "Sử dụng container hiện có: $EXISTING_CONTAINER"
        CONTAINER_NAME=$EXISTING_CONTAINER
    fi
fi

# 3. Tạo container mới nếu chưa có (Developer Edition)
if [ -z "$CONTAINER_NAME" ]; then
    echo ""
    echo "📦 Đang tạo ONLYOFFICE Document Server Developer Edition container..."
    CONTAINER_NAME="onlyoffice-documentserver-de"
    
    # Tạo thư mục cho license nếu chưa có
    LICENSE_DIR="./onlyoffice-license"
    if [ ! -d "$LICENSE_DIR" ]; then
        mkdir -p "$LICENSE_DIR"
        echo "ℹ️  Thư mục license đã được tạo: $LICENSE_DIR"
        echo "   Nếu có file license.lic, đặt vào thư mục này"
    fi
    
    docker run -d \
        --name $CONTAINER_NAME \
        -p 8080:80 \
        -e JWT_ENABLED=false \
        -v "$(pwd)/$LICENSE_DIR:/var/www/onlyoffice/Data" \
        onlyoffice/documentserver-de
    
    echo "✓ Container '$CONTAINER_NAME' (Developer Edition) đã được tạo"
    echo "ℹ️  Developer Edition có đầy đủ API như createConnector().executeMethod()"
fi

# 4. Đợi container khởi động
echo ""
echo "⏳ Đang đợi Document Server khởi động (có thể mất 30-60 giây)..."
sleep 10

# Kiểm tra container đang chạy
MAX_ATTEMPTS=30
ATTEMPT=0
while ! docker exec $CONTAINER_NAME curl -s http://localhost/healthcheck > /dev/null 2>&1; do
    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -ge $MAX_ATTEMPTS ]; then
        echo "⚠️  Timeout đợi Document Server khởi động"
        echo "   Vui lòng đợi thêm và chạy lại script"
        exit 1
    fi
    echo "   Đang đợi... ($ATTEMPT/$MAX_ATTEMPTS)"
    sleep 5
done
echo "✓ Document Server đã sẵn sàng"

# 5. Cấu hình cho phép private IP (để dùng host.docker.internal)
echo ""
echo "🔧 Đang cấu hình cho phép private IP..."
docker exec $CONTAINER_NAME bash -c 'cat /etc/onlyoffice/documentserver/local.json | python3 -c "
import sys, json
config = json.load(sys.stdin)
if \"services\" not in config:
    config[\"services\"] = {}
if \"CoAuthoring\" not in config[\"services\"]:
    config[\"services\"][\"CoAuthoring\"] = {}
config[\"services\"][\"CoAuthoring\"][\"request-filtering-agent\"] = {
    \"allowPrivateIPAddress\": True,
    \"allowMetaIPAddress\": True
}
print(json.dumps(config, indent=2))
" > /tmp/local.json && cp /tmp/local.json /etc/onlyoffice/documentserver/local.json'
echo "✓ Đã cấu hình cho phép private IP"

# 6. Restart Document Server
echo ""
echo "🔄 Đang restart Document Server..."
docker exec $CONTAINER_NAME supervisorctl restart all > /dev/null 2>&1
sleep 5
echo "✓ Document Server đã restart"

echo ""
echo "============================================"
echo "✅ Setup hoàn tất!"
echo "============================================"
echo ""
echo "📋 Các bước tiếp theo (mở 3 terminal):"
echo ""
echo "   Terminal 1 - API Server:"
echo "   npx -y json-server@0.17.4 --watch db.json --routes routes.json --port 3001"
echo ""
echo "   Terminal 2 - File Server:"
echo "   cd s3-demo && npx http-server ./docs -p 3000 --cors"
echo ""
echo "   Terminal 3 - Angular App:"
echo "   npm start"
echo ""
echo "🌐 Mở trình duyệt: http://localhost:4200/docx-editor"
echo ""
