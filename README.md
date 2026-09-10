# Gia phả dòng họ

Một trang web tĩnh để gia đình cùng xem:

- danh sách và hồ sơ chi tiết của từng thành viên;
- mối quan hệ cha mẹ, vợ chồng và con cái;
- cây gia phả theo thế hệ;
- lịch ngày giỗ, lễ họ và các dịp sum họp.

Trang không có cơ sở dữ liệu hay màn hình quản trị. Mọi thay đổi được thực hiện trong mã nguồn, kiểm tra tự động, rồi xuất bản khi commit được đẩy lên nhánh `main`.

## Chạy trên máy

Yêu cầu Node.js 22.13 trở lên.

```bash
npm ci
npm run dev
```

Các lệnh kiểm tra:

```bash
npm test
npm run validate:data
npm run lint
npm run build
```

## Cập nhật thành viên

Chỉnh tệp [`data/members.ts`](data/members.ts). Mỗi người cần một `id` duy nhất. Các trường quan trọng:

- `fullName`, `birthYear`, `birthDate`;
- `generation` và `branch`;
- `parentIds`: mã của cha/mẹ;
- `spouseIds`: mã vợ/chồng, cần khai báo ở cả hai người;
- `status`: `living` hoặc `deceased`;
- `deathDate` và `deathAnniversaryLunar` nếu đã mất.

Chạy `npm run validate:data` trước khi commit. Lệnh này phát hiện mã trùng, quan hệ trỏ tới người không tồn tại và quan hệ vợ/chồng không đối xứng.

## Cập nhật ngày lễ

Chỉnh tệp [`data/events.ts`](data/events.ts). Ngày dương lặp lại hằng năm chỉ cần `day` và `month`. Với ngày âm lịch, gia đình cần đối chiếu rồi bổ sung ngày dương của từng năm trong `solarDates`:

```ts
solarDates: {
  2026: '2026-04-28',
  2027: '2027-04-18',
}
```

Cách này tránh tự động chuyển đổi sai giữa các hệ lịch và cho phép cả nhà xác nhận ngày làm lễ trước khi xuất bản.

## Xuất bản bằng GitHub Pages

Workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) kiểm tra, build và xuất bản trang tĩnh mỗi khi có commit mới trên `main`.

Lần đầu tiên, người quản trị repository vào **Settings → Pages → Build and deployment → Source** và chọn **GitHub Actions**. Sau một lần chạy thành công, trang dự kiến có địa chỉ:

<https://vquand.github.io/clan/>

Nếu đổi tên repository, cập nhật `PAGES_BASE_PATH` trong workflow cho trùng với tên mới.

## Quy trình cập nhật đề xuất

1. Tạo nhánh mới từ `main`.
2. Chỉnh `data/members.ts` hoặc `data/events.ts`.
3. Chạy các lệnh kiểm tra.
4. Commit và mở pull request để một người khác trong gia đình duyệt.
5. Merge vào `main`; GitHub Pages tự xuất bản phiên bản mới.

> Dữ liệu hiện có hoàn toàn là dữ liệu minh hoạ. Hãy thay thế trước khi chia sẻ trang rộng rãi, và chỉ công khai thông tin cá nhân khi các thành viên đồng ý.
