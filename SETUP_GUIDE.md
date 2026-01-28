# Hướng dẫn Cài đặt & Triển khai Dự án (Setup Guide)

Tài liệu này hướng dẫn cách setup và chạy dự án Dynamic Template FE cùng với OnlyOffice trên một máy tính mới hoàn toàn.

## 1. Yêu cầu hệ thống (Prerequisites)

Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt:

- **Git**: Để clone source code.
- **Docker Desktop**: Để chạy container ứng dụng và OnlyOffice.
  - [Tải Docker cho Windows/Mac](https://www.docker.com/products/docker-desktop/)

## 2. Lấy Source Code

Mở terminal (hoặc Git Bash trên Windows) và chạy lệnh:

```bash
git clone <repository-url>
cd dynamic-template-fe
```

_(Thay `<repository-url>` bằng link git của bạn)_

## 3. Cấu hình & Chạy Dự án

### Cách 1: Sử dụng Script tự động (Khuyên dùng)

Chạy file script `start.sh` để tự động kiểm tra và khởi chạy:

```bash
./start.sh
```

### Cách 2: Chạy thủ công bằng Docker Compose

Tại thư mục gốc của dự án (`dynamic-template-fe`), chạy lệnh sau:

```bash
docker-compose up -d --build
```

### Quá trình này sẽ làm gì?

1.  **Build Angular App**: Tải các thư viện (npm install), biên dịch code và đóng gói vào Nginx.
2.  **Tải OnlyOffice**: Tải image `onlyoffice/documentserver-de` (khoảng 1.6GB, lần đầu sẽ hơi lâu).
3.  **Khởi động các dịch vụ hỗ trợ**: JSON Server (Mock API) và File Server (chứa tài liệu mẫu).

## 4. Kiểm tra & Truy cập

Sau khi lệnh chạy xong, bạn có thể truy cập các dịch vụ tại:

- **Trang chính (Angular App)**: [http://localhost/docx-editor](http://localhost/docx-editor)
- **OnlyOffice Server**: [http://localhost:8080](http://localhost:8080)
- **File Server**: [http://localhost:3000](http://localhost:3000)

## 5. Các lệnh thường dùng

- **Dừng toàn bộ hệ thống**:

  ```bash
  docker-compose down
  ```

- **Xem log (để debug)**:

  ```bash
  docker-compose logs -f
  ```

- **Khởi động lại (nếu gặp lỗi)**:
  ```bash
  docker-compose restart
  ```

## 6. Xử lý sự cố thường gặp (Troubleshooting)

- **Lỗi không thấy Logo/Tên MSB**:
  - Hãy thử nhấn `Ctrl + Shift + R` (hoặc `Cmd + Shift + R`) để xóa cache trình duyệt.
  - Đảm bảo container `file-server` đang chạy (cổng 3000).

- **Lỗi "This site can't be reached"**:
  - Đảm bảo Docker Desktop đang chạy.
  - Kiểm tra xem có ứng dụng nào khác đang chiếm dụng cổng 80, 8080 hoặc 3000 không.

- **OnlyOffice báo lỗi "Download failed"**:
  - Lỗi này thường do OnlyOffice trong Docker không thể gọi ngược lại máy host. Cấu hình mạng đã được xử lý trong `docker-compose.yml`, nhưng nếu bạn dùng VPN hoặc mạng công ty chặn, có thể cần tắt VPN.
