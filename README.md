# ⚡ SupaPulse (`supa-pulse`)

> **Automated heartbeat & cron ping tool to keep Supabase Free Tier projects active 24/7.**

Tool tự động phát "nhịp tim" (heartbeat) đọc & ghi vào Database Supabase định kỳ để **ngăn không cho Supabase Deactive/Pause dự án Free Tier** của bạn do không hoạt động.

---

## 📌 Nguyên lý hoạt động

Supabase gói Free sẽ tự động tạm dừng (pause) các dự án không có lưu lượng truy cập API hoặc kết nối Database trong **7 ngày liên tục**. 

Vì dịch vụ `pg_cron` nội bộ của Supabase cũng sẽ bị dừng khi dự án pause, giải pháp tối ưu nhất là sử dụng một **dịch vụ Cron bên ngoài (External Trigger)**:
1. **GitHub Actions (Khuyên dùng)**: Hoàn toàn miễn phí, tự động chạy theo lịch đặt sẵn (00:00, 08:00, 16:00 UTC).
2. **Cron-job.org**: Dịch vụ Web-Cron miễn phí không cần dùng Git/Code.

---

## 🛠️ Hướng dẫn cài đặt

### Bước 1: Tạo bảng `keep_alive_logs` trên Supabase

1. Đăng nhập vào [Supabase Dashboard](https://supabase.com/dashboard).
2. Chọn dự án của bạn -> vào mục **SQL Editor**.
3. Mở file [`sql/schema.sql`](./sql/schema.sql), dán toàn bộ nội dung vào SQL Editor và nhấn **Run**:

```sql
CREATE TABLE IF NOT EXISTS public.keep_alive_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    note TEXT
);

ALTER TABLE public.keep_alive_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read keep_alive_logs" ON public.keep_alive_logs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow anon insert keep_alive_logs" ON public.keep_alive_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow anon delete keep_alive_logs" ON public.keep_alive_logs FOR DELETE TO anon, authenticated USING (true);
```

---

### Bước 2: Cấu hình GitHub Actions (Cách 1 - Tự động hóa tốt nhất)

1. Tạo 1 Repository mới trên GitHub (Public hoặc Private đều được) và push thư mục này lên:
   ```bash
   git init
   git add .
   git commit -m "feat: initial release of SupaPulse"
   git branch -M main
   git remote add origin https://github.com/<your-username>/supa-pulse.git
   git push -u origin main
   ```
2. Lấy thông tin Supabase:
   - Vào **Project Settings** -> **API**.
   - Copy **Project URL** và **`anon` `public` Key** (hoặc `service_role` key).
3. Thêm Secrets vào GitHub Repository:
   - Vào Repository trên GitHub -> **Settings** -> **Secrets and variables** -> **Actions**.
   - Nhấn **New repository secret**:
     - `SUPABASE_URL`: `<Project URL của bạn>` (ví dụ: `https://xyzcompany.supabase.co`)
     - `SUPABASE_KEY`: `<anon key hoặc service_role key của bạn>`
4. Kiểm tra:
   - Vào tab **Actions** trên GitHub Repo -> chọn **Supabase Keep Alive Cron**.
   - Nhấn **Run workflow** để chạy thử thủ công ngay lập tức.
   - Kiểm tra bảng `keep_alive_logs` trên Supabase sẽ thấy log mới xuất hiện!

---

### Cách 2: Dùng Cron-job.org (Không cần Git/Code)

Nếu bạn không muốn tạo GitHub Repo:
1. Đăng ký tài khoản miễn phí tại [cron-job.org](https://cron-job.org).
2. Tạo 1 Cronjob mới với cấu hình:
   - **URL**: `https://<your-project-ref>.supabase.co/rest/v1/keep_alive_logs`
   - **Execution schedule**: Every 8 hours (hoặc 1 ngày 3 lần).
   - **Request Method**: `POST`
   - **Request Headers**:
     - `apikey`: `<your-supabase-anon-key>`
     - `Authorization`: `Bearer <your-supabase-anon-key>`
     - `Content-Type`: `application/json`
   - **Request Body**: `{"note": "Ping from cron-job.org"}`

---

## 🧪 Test tại máy cục bộ (Local Test)

Muốn chạy thử ngay ở máy cá nhân:
1. Copy file `.env.example` thành `.env`:
   ```bash
   cp .env.example .env
   ```
2. Điền thông tin `SUPABASE_URL` và `SUPABASE_KEY` vào file `.env`.
3. Chạy lệnh:
   ```bash
   node scripts/keep_alive.js
   ```
