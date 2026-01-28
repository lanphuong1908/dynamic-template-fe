# Hướng dẫn Thay đổi Logo và Cơ chế hoạt động

Bạn có thắc mắc về việc **"copy ảnh vào docker là chỗ nào?"**. Tài liệu này sẽ giải thích cơ chế và hướng dẫn cách thay đổi.

## 1. Cơ chế hoạt động (Giải thích kỹ thuật)

Chúng ta **không copy ảnh "chết" vào trong container** mỗi khi build (vì như thế rất bất tiện khi muốn đổi ảnh).

Thay vào đó, chúng ta sử dụng cơ chế **Volume Mounting** (Ánh xạ thư mục) của Docker.

Trong file `docker-compose.yml`:

```yaml
file-server:
  volumes:
    - ./s3-demo/docs:/app/docs  <-- DÒNG QUAN TRỌNG
```

- **`./s3-demo/docs`**: Là thư mục thật trên máy của bạn (Host).
- **`/app/docs`**: Là thư mục bên trong Docker Container.

👉 **Nghĩa là:** Bất cứ file nào bạn bỏ vào thư mục `s3-demo/docs` trên máy tính, nó sẽ **xuất hiện ngay lập tức** trong Docker mà không cần chạy lệnh gì cả.

## 2. Cách thay đổi Logo

### Cách 1: Dùng script setup thành (Khuyên dùng)

Bạn có thể update logo ngay lúc chạy setup bằng lệnh:

```bash
./setup.sh --logo <đường_dẫn_ảnh_mới_của_bạn>
```

**Ví dụ:**

```bash
./setup.sh --logo /Users/nguyenhoanghiep/Downloads/anh-msb-moi.png
```

### Cách 2: Làm thủ công (Copy Paste)

Chỉ cần copy file ảnh của bạn vào thư mục `s3-demo/docs` và đổi tên thành `logo.png`.

1.  Mở Finder/Explorer.
2.  Vào thư mục dự án `dynamic-template-fe`.
3.  Vào tiếp `s3-demo` -> `docs`.
4.  Paste ảnh mới vào đây và đổi tên thành `logo.png` (ghi đè file cũ).

## 3. Lưu ý về Cache

Vì trình duyệt hay lưu cache hình ảnh, sau khi đổi logo, bạn cần **Refresh cứng** để thấy thay đổi:

- **Windows**: `Ctrl + Shift + R`
- **Mac**: `Cmd + Shift + R`
