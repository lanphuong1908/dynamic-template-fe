# 🧪 Hướng dẫn Test Tính Năng Kéo Thả

## ✅ Kiểm tra các service đã chạy:

### 1. ONLYOFFICE Document Server Developer Edition
```bash
docker ps | grep onlyoffice-documentserver-de
# Phải thấy container đang chạy trên port 8080
```

### 2. File Server (http-server)
```bash
lsof -ti:3000
# Phải có process đang chạy trên port 3000
```

### 3. Angular App
```bash
lsof -ti:4200
# Phải có process đang chạy trên port 4200
```

---

## 🧪 Các bước Test:

### Bước 1: Mở trình duyệt
```
http://localhost:4200/docx-editor
```

### Bước 2: Tạo document mới
- Click vào nút **"➕ Tạo Document Mới"**
- Đợi document load xong (có thể mất 5-10 giây)

### Bước 3: Đặt cursor trong document
- **Click vào document** để đặt cursor tại vị trí muốn chèn text
- Cursor phải nhấp nháy trong document

### Bước 4: Test kéo thả
- **Kéo** một property từ list bên trái (ví dụ: `BIOMETRIC_STATUS`)
- **Thả** vào vùng editor (iframe)
- **Kết quả mong đợi:**
  - ✅ Text được tự động chèn vào vị trí cursor
  - ✅ Notification hiển thị: "✓ Đã chèn: ${BIOMETRIC_STATUS}"
  - ✅ Console log: "✅ Using Developer Edition API - Inserting text"
  - ✅ Console log: "✅ Text inserted successfully"

### Bước 5: Test click để chèn
- Click vào một property trong list
- **Kết quả mong đợi:** Text được chèn vào vị trí cursor

### Bước 6: Test download
- Click vào nút **"📥 Download DOCX"** hoặc **"📄 Download PDF"**
- **Kết quả mong đợi:** File được download về máy

---

## 🔍 Kiểm tra Console (F12):

Mở Developer Console (F12) và kiểm tra các log:

### Khi kéo thả thành công:
```
✅ Using Developer Edition API - Inserting text: ${BIOMETRIC_STATUS}
✅ Text inserted successfully: ${BIOMETRIC_STATUS} [result object]
```

### Nếu không thành công:
```
⚠️ createConnector not available - may be Community Edition
```
→ Có nghĩa là Developer Edition chưa được load đúng

---

## ❌ Troubleshooting:

### Vấn đề 1: "Editor chưa sẵn sàng"
- **Giải pháp:** Đợi document load xong (5-10 giây) rồi thử lại

### Vấn đề 2: Kéo thả không hoạt động
- **Kiểm tra:** Console có log "Drop event" không?
- **Giải pháp:** Đảm bảo đã click vào document để đặt cursor trước

### Vấn đề 3: Text không được chèn
- **Kiểm tra:** Console có log "createConnector" không?
- **Giải pháp:** 
  - Refresh trang
  - Kiểm tra xem Developer Edition có đang chạy: `docker ps | grep documentserver-de`
  - Kiểm tra network tab xem có lỗi khi load ONLYOFFICE script không

### Vấn đề 4: "createConnector is not a function"
- **Nguyên nhân:** Đang dùng Community Edition thay vì Developer Edition
- **Giải pháp:** 
  ```bash
  docker stop onlyoffice-documentserver-de
  docker rm onlyoffice-documentserver-de
  ./setup-onlyoffice.sh
  ```

---

## ✅ Checklist:

- [ ] Container Developer Edition đang chạy
- [ ] File Server đang chạy trên port 3000
- [ ] Angular App đang chạy trên port 4200
- [ ] Document đã load xong
- [ ] Cursor đã được đặt trong document
- [ ] Kéo thả property thành công
- [ ] Text được chèn tự động (không cần Ctrl+V)
- [ ] Notification hiển thị
- [ ] Download DOCX/PDF hoạt động

