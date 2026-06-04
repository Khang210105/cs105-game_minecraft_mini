🚀 Hướng Dẫn Cài Đặt & Chạy Dự Án
Để trải nghiệm trò chơi một cách nhanh chóng nhất, bạn có thể khởi chạy trực tiếp trên trình duyệt thông qua công cụ Live Server theo 3 bước cực kỳ đơn giản dưới đây:

Bước 1: Tải mã nguồn về máy (Git Clone)
Sủ dụng Visual Studio Code, mở New Terminal, di chuyển đến thư mục muốn lưu dự án và chạy lệnh sau:

git clone [https://github.com/Khang210105/cs105-game_minecraft_mini.git](https://github.com/Khang210105/cs105-game_minecraft_mini.git)

(Hoặc tải trực tiếp file ZIP từ Github và giải nén).

Bước 2: Cài đặt tiện ích mở rộng Live Server

Mở thư mục dự án vừa tải về bằng phần mềm Visual Studio Code (VS Code).

Đi tới mục Extensions (Biểu tượng 4 ô vuông bên thanh menu trái, hoặc bấm Ctrl + Shift + X).

Tìm kiếm từ khóa "Live Server" (do Ritwick Dey phát triển).

Nhấn Install để cài đặt.

Bước 3: Khởi chạy trò chơi

Mở file index.html trong cấu trúc thư mục dự án trên VS Code.

Nhìn xuống thanh trạng thái góc dưới cùng bên phải của VS Code, nhấn vào nút 🌐 Go Live.

Hệ thống sẽ tự động khởi chạy máy chủ ảo local và mở game trên trình duyệt mặc định của bạn tại địa chỉ: http://127.0.0.1:5500

🎮 Hướng Dẫn Điều Khiển (Controls)

Kích hoạt chơi: Click chuột vào màn hình game để khóa con trỏ chuột (Pointer Lock). Nhấn ESC nếu muốn thoát chế độ khóa chuột.

Di chuyển: Dùng các phím W, A, S, D để tiến, lùi, sang trái, sang phải.

Nhìn xung quanh: Di chuyển chuột để xoay camera góc nhìn thứ nhất (FPS).

Nhảy / Bơi: Nhấn phím Space (Khoảng trắng).

Chế độ Bay (Fly mode): Nhấn đúp phím W thật nhanh để kích hoạt/hủy chế độ bay.

Khi đang bay: Giữ Space để bay lên cao, giữ Shift để hạ độ cao.

Tương tác thế giới:

Click chuột Trái: Phá hủy block (Mine) kèm hiệu ứng hạt vỡ vụn.

Click chuột Phải: Đặt block mới (Place) hoặc sử dụng Xô múc/đổ nước, dung nham.

Quản lý Vật phẩm:

Cuộn bánh xe chuột hoặc bấm phím số từ 1 đến 8 để chuyển đổi block trên thanh truy cập nhanh (Hotbar).

Nhấn phím E hoặc B để mở/đóng Kho đồ lớn (Inventory) và click chọn khối muốn đem xuống Hotbar.

✨ Các Tính Năng Nổi Bật

Hệ thống đổ bóng cải tiến (Soft Shadows): Sử dụng PCFSoftShadowMap của Three.js, khắc phục triệt để lỗi bóng tách rời khỏi chân khối và lỗi mất shadow khi xây các bức tường thành cao kiên cố.

Chu kỳ Ngày / Đêm linh hoạt: Ánh sáng mặt trời và mặt trăng chuyển động theo quỹ đạo xoay, nội suy màu sắc bầu trời theo thời gian thực kết hợp bảng tùy chỉnh thông số trực quan (Control Panel).

Hệ thống thời tiết & Mây 3D: Hiệu ứng mưa rơi sống động xây dựng bằng hệ thống hạt (Particle System) cùng các dải mây khối (Voxel Clouds) trôi lơ lửng.

Vật lý chất lỏng nâng cao: Cơ chế mô phỏng nước và dung nham chảy lan theo thuật toán loang (Flood-fill), tự động co giãn hình học (scale) thông minh để tạo dòng chảy liền mạch mượt mà.