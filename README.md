# Dynamic Template FE - ONLYOFFICE Editor

## Yêu cầu hệ thống

- **Docker** (bắt buộc) - [Cài đặt Docker](https://docs.docker.com/get-docker/)
- **Node.js 18+** - [Cài đặt Node.js](https://nodejs.org/)
- **npm**

## Cài đặt nhanh

### Bước 1: Clone và cài đặt dependencies

```bash
git clone <repo_url>
cd dynamic-template-fe
npm install
```

### Bước 2: Setup ONLYOFFICE Document Server

```bash
./setup-onlyoffice.sh
```

Script sẽ tự động:
- Tạo Docker container cho ONLYOFFICE Document Server
- Cấu hình cho phép private IP
- Copy sample files vào container
- Restart Document Server

### Bước 3: Chạy ứng dụng (mở 3 terminal)

| Terminal | Lệnh | Mô tả |
|----------|------|-------|
| **1** | `npx -y json-server@0.17.4 --watch db.json --routes routes.json --port 3001` | API Server |
| **2** | `cd s3-demo && npx http-server ./docs -p 3000 --cors` | File Server |
| **3** | `npm start` | Angular App |

### Bước 4: Mở trình duyệt

```
http://localhost:4200/docx-editor
```

## URLs

| Service | URL |
|---------|-----|
| Angular App | http://localhost:4200/docx-editor |
| Document Server | http://localhost:8080 |
| API Server | http://localhost:3001 |
| File Server | http://localhost:3000 |

## Sử dụng

### Tạo document mới
- Click **"➕ Tạo Document Mới"**
- Chọn loại: Word hoặc Excel

### Mở file có sẵn
- Click **"Chọn File"**
- Chọn file từ thư mục `s3-demo/docs/`

### Thêm file mới
1. Copy file vào thư mục `s3-demo/docs/`
2. Refresh trang
3. Click "Chọn File" và chọn file vừa thêm

### Chèn Properties
- Click vào property trong danh sách bên trái để chèn vào document
- Hoặc kéo thả property vào document

### Download document
- Click **"Download DOCX"** hoặc **"Download PDF"** (Word)
- Click **"Download XLSX"** (Excel)

## Troubleshooting

### Lỗi "Download failed" (Error Code -4)

**Nguyên nhân:** Document Server không thể tải file từ URL

**Giải pháp:**
```bash
# Chạy lại script setup
./setup-onlyoffice.sh
```

### Lỗi "Private IP not allowed"

**Giải pháp:**
```bash
# Tìm tên container
docker ps | grep onlyoffice

# Cấu hình cho phép private IP
docker exec <container_name> bash -c 'cat /etc/onlyoffice/documentserver/local.json | python3 -c "
import sys, json
config = json.load(sys.stdin)
config[\"services\"][\"CoAuthoring\"][\"request-filtering-agent\"] = {
    \"allowPrivateIPAddress\": True,
    \"allowMetaIPAddress\": True
}
print(json.dumps(config, indent=2))
" > /tmp/local.json && cp /tmp/local.json /etc/onlyoffice/documentserver/local.json'

# Restart Document Server
docker exec <container_name> supervisorctl restart all
```

### Tìm tên container

```bash
docker ps | grep onlyoffice
```

### Restart Document Server

```bash
docker exec <container_name> supervisorctl restart all
```

### Xem logs

```bash
docker logs <container_name> --tail 50
```

## Cấu trúc thư mục

```
dynamic-template-fe/
├── src/
│   ├── app/
│   │   └── docx-editor/          # Component chính
│   └── environments/
├── s3-demo/
│   └── docs/                     # Thư mục chứa files
│       ├── sample.docx
│       ├── sample.xlsx
│       ├── template.docx
│       └── ...
├── setup-onlyoffice.sh           # Script setup tự động
└── README.md
```

## Scripts

| Script | Mô tả |
|--------|-------|
| `./setup-onlyoffice.sh` | Setup ONLYOFFICE Document Server (chạy 1 lần) |
| `npm start` | Chạy Angular app |
| `npm run build` | Build production |
