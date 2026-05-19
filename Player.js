// Tất cả những gì liên quan đến bàn phím, nhảy, trọng lực, tốc độ sẽ nằm gọn ở đây.

// Player.js
import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

export class Player {
	constructor(camera, domElement, world) {
		this.camera = camera;
		this.world = world;
		this.controls = new PointerLockControls(camera, domElement);

		// Thông số cơ thể Minecraft
		this.size = { w: 0.6, h: 1.8 }; // Rộng 0.6, Cao 1.8 (Vừa lọt hang 2 block)
		this.eyeLevel = 1.6; // Mắt cách chân 1.6 block

		// Vị trí "Chân" của nhân vật (Thả rơi từ độ cao 1)
		this.position = new THREE.Vector3(0, 1, 0); // Độ cao khi bắt đầu chơi
		this.velocity = new THREE.Vector3();

		this.keys = {
			w: false,
			a: false,
			s: false,
			d: false,
			space: false,
			shift: false,
		};
		this.canJump = false;
		this.isFlying = false;
		this.lastWPressTime = 0;
		this.doubleTapWindowMs = 400;

		this.flightIndicator = document.getElementById("flight-indicator");

		this.initEventListeners();
		this.updateFlightIndicator();
	}

	updateFlightIndicator() {
		if (!this.flightIndicator) return;

		if (this.isFlying) {
			this.flightIndicator.textContent = "Flight: ON";
			this.flightIndicator.classList.add("active");
		} else {
			this.flightIndicator.textContent = "Flight: OFF";
			this.flightIndicator.classList.remove("active");
		}
	}

	initEventListeners() {
		document.addEventListener("keydown", (e) => {
			switch (e.code) {
				case "KeyW": {
					if (!e.repeat) {
						const now = e.timeStamp;
						if (now - this.lastWPressTime <= this.doubleTapWindowMs) {
							this.isFlying = !this.isFlying;
							this.velocity.y = 0;
							this.canJump = false;
							this.updateFlightIndicator();
						}
						this.lastWPressTime = now;
					}
					this.keys.w = true;
					break;
				}
				case "KeyS":
					this.keys.s = true;
					break;
				case "KeyA":
					this.keys.a = true;
					break;
				case "KeyD":
					this.keys.d = true;
					break;
				case "Space":
					if (this.isFlying) {
						this.keys.space = true;
					} else if (this.canJump) {
						this.velocity.y = 8.0; // Lực nhảy giúp bay qua đúng 1.25 block
						this.canJump = false;
					}
					break;
				case "ShiftLeft":
				case "ShiftRight":
					this.keys.shift = true;
					break;
			}
		});

		document.addEventListener("keyup", (e) => {
			switch (e.code) {
				case "KeyW":
					this.keys.w = false;
					break;
				case "KeyS":
					this.keys.s = false;
					break;
				case "KeyA":
					this.keys.a = false;
					break;
				case "KeyD":
					this.keys.d = false;
					break;
				case "Space":
					this.keys.space = false;
					break;
				case "ShiftLeft":
				case "ShiftRight":
					this.keys.shift = false;
					break;
			}
		});
	}

	// Hàm kiểm tra xem một vị trí block có đè lên cơ thể người chơi không
	intersectsBlock(bx, by, bz) {
		// 1. Tính toán Hộp giới hạn (Bounding Box) của Block sắp đặt
		// Vì block kích thước 1x1x1 và tâm nằm ở giữa, nên các cạnh cách tâm 0.5
		const bMinX = bx - 0.5,
			bMaxX = bx + 0.5;
		const bMinY = by - 0.5,
			bMaxY = by + 0.5;
		const bMinZ = bz - 0.5,
			bMaxZ = bz + 0.5;

		// 2. Tính toán Hộp giới hạn của Người chơi
		// Người chơi rộng 0.6 (size.w), cao 1.9 (size.h) và tâm X, Z nằm ở giữa, gốc Y nằm ở chân
		const pMinX = this.position.x - this.size.w / 2;
		const pMaxX = this.position.x + this.size.w / 2;
		const pMinY = this.position.y; // Chân
		const pMaxY = this.position.y + this.size.h; // Đỉnh đầu
		const pMinZ = this.position.z - this.size.w / 2;
		const pMaxZ = this.position.z + this.size.w / 2;

		// 3. Kiểm tra va chạm (Có sự giao nhau ở cả 3 trục tọa độ thì tức là đang đè lên nhau)
		const overlapX = pMinX < bMaxX && pMaxX > bMinX;
		const overlapY = pMinY < bMaxY && pMaxY > bMinY;
		const overlapZ = pMinZ < bMaxZ && pMaxZ > bMinZ;

		return overlapX && overlapY && overlapZ;
	}

	// Hàm quan trọng nhất: Quét 3D xem có chạm tường không
	checkCollision(pos) {
		const EPS = 0.001; // Khoảng đệm siêu nhỏ để không bị dính vào vách
		const minX = pos.x - this.size.w / 2 + EPS;
		const maxX = pos.x + this.size.w / 2 - EPS;
		const minY = pos.y + EPS;
		const maxY = pos.y + this.size.h - EPS;
		const minZ = pos.z - this.size.w / 2 + EPS;
		const maxZ = pos.z + this.size.w / 2 - EPS;

		const minGx = Math.floor(minX + 0.5);
		const maxGx = Math.floor(maxX + 0.5);
		const minGy = Math.floor(minY + 0.5);
		const maxGy = Math.floor(maxY + 0.5);
		const minGz = Math.floor(minZ + 0.5);
		const maxGz = Math.floor(maxZ + 0.5);

		for (let x = minGx; x <= maxGx; x++) {
			for (let y = minGy; y <= maxGy; y++) {
				for (let z = minGz; z <= maxGz; z++) {
					const block = this.world.getBlock(x, y, z);

					if (block) {
						// KIỂM TRA ĐI XUYÊN:
						// Nếu block có chứa dữ liệu loại (type) và có đánh dấu solid: false thì bỏ qua
						if (
							block.userData &&
							block.userData.type &&
							block.userData.type.solid === false
						) {
							continue; // Bỏ qua block này, cho phép đi xuyên!
						}
						return true; // Nếu không, báo va chạm (Đập đầu/Chạm tường!)
					}
				}
			}
		}
	}

	update(delta) {
		if (!this.controls.isLocked) return;

		// 1. Trọng lực
		if (!this.isFlying) {
			this.velocity.y -= 25.0 * delta;
		} else {
			this.velocity.y = 0;
		}

		// 2. Tính hướng đi dưa trên camera hiện tại
		const forward = new THREE.Vector3();
		this.camera.getWorldDirection(forward);
		forward.y = 0; // Không bay lên trời khi ngẩng mặt
		forward.normalize();
		const right = new THREE.Vector3()
			.crossVectors(forward, new THREE.Vector3(0, 1, 0))
			.normalize();

		const moveDir = new THREE.Vector3();
		if (this.keys.w) moveDir.add(forward);
		if (this.keys.s) moveDir.sub(forward);
		if (this.keys.d) moveDir.add(right);
		if (this.keys.a) moveDir.sub(right);
		moveDir.normalize();

		// Kiểm tra xem chân nhân vật có đang chạm nước không
		const feetY = Math.floor(this.position.y - this.eyeLevel + 0.1);
		const blockAtFeet = this.world.getBlock(
			this.position.x,
			feetY,
			this.position.z,
		);

		let moveSpeed = 5.0; // Tốc độ đi bộ: 5 block/giây
		let verticalSpeed = 0;
		if (this.isFlying) {
			const flySpeed = 5.0;
			if (this.keys.space) verticalSpeed += flySpeed;
			if (this.keys.shift) verticalSpeed -= flySpeed;
		}

		const dx = moveDir.x * moveSpeed * delta;
		const dy = (this.isFlying ? verticalSpeed : this.velocity.y) * delta;
		const dz = moveDir.z * moveSpeed * delta;

		let nextPos = this.position.clone();

		// 3. Tách xử lý va chạm ra 3 trục để trượt được dọc bờ tường
		// Trục X
		nextPos.x += dx;
		if (this.checkCollision(nextPos)) nextPos.x = this.position.x; // Hủy bước X

		// Trục Z
		nextPos.z += dz;
		if (this.checkCollision(nextPos)) nextPos.z = this.position.z; // Hủy bước Z

		// Trục Y (Trọng lực / Nhảy lên chạm trần)
		nextPos.y += dy;
		if (this.checkCollision(nextPos)) {
			if (this.velocity.y < 0) this.canJump = true; // Đang rơi -> Chạm đất
			this.velocity.y = 0; // Triệt tiêu lực
			nextPos.y = this.position.y;
		} else {
			if (this.velocity.y < 0) this.canJump = false; // Lơ lửng trên không
		}

		// Chống rơi ra ngoài map vĩnh viễn (respawn)
		if (nextPos.y < -20) {
			const spawn = this.world.findSafeSpawnPosition(0, 0);

			nextPos.set(spawn.x, spawn.y, spawn.z);
			this.velocity.set(0, 0, 0);
			this.canJump = false;
		}

		this.position.copy(nextPos);

		// Đặt camera đúng tầm mắt
		this.camera.position.set(
			this.position.x,
			this.position.y + this.eyeLevel,
			this.position.z,
		);
	}
}
